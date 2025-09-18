import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface Permission {
  id: string;
  name: string;
  description: string;
  requiresLevel: number;
}

export interface UserPermissions {
  [userId: number]: {
    [permissionId: string]: boolean;
  };
}

export interface LevelPermissions {
  [level: number]: {
    [permissionId: string]: boolean;
  };
}

export const useEnhancedPermissions = () => {
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({});
  const [levelPermissions, setLevelPermissions] = useState<LevelPermissions>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load permissions from Supabase
  const loadPermissions = useCallback(async () => {
    if (!profile?.id) {
      setIsLoaded(true);
      return;
    }

    try {
      // Load permission definitions first
      const { data: permDefs, error: permDefError } = await supabase
        .from('permission_definitions')
        .select('*')
        .order('name');

      if (permDefError) console.error('Error loading permission definitions:', permDefError);

      // Convert to Permission format
      const loadedPermissions: Permission[] = (permDefs || []).map(def => ({
        id: def.id,
        name: def.name,
        description: def.description || '',
        requiresLevel: def.requires_level
      }));

      setPermissions(loadedPermissions);

      // Load user-specific permissions
      const { data: userPerms, error: userError } = await supabase
        .from('user_permissions')
        .select('*');

      // Load level-based permissions
      const { data: levelPerms, error: levelError } = await supabase
        .from('level_permissions')
        .select('*');

      if (userError) console.error('Error loading user permissions:', userError);
      if (levelError) console.error('Error loading level permissions:', levelError);

      // Process user permissions
      const processedUserPerms: UserPermissions = {};
      if (userPerms) {
        userPerms.forEach(perm => {
          if (!processedUserPerms[perm.user_id]) {
            processedUserPerms[perm.user_id] = {};
          }
          processedUserPerms[perm.user_id][perm.permission_id] = perm.allowed;
        });
      }

      // Process level permissions
      const processedLevelPerms: LevelPermissions = {};
      if (levelPerms) {
        levelPerms.forEach(perm => {
          if (!processedLevelPerms[perm.level]) {
            processedLevelPerms[perm.level] = {};
          }
          processedLevelPerms[perm.level][perm.permission_id] = perm.allowed;
        });
      }

      setUserPermissions(processedUserPerms);
      setLevelPermissions(processedLevelPerms);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setIsLoaded(true);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // Check if user has a specific permission
  const hasPermission = useCallback((permissionId: string): boolean => {
    if (!profile || !isLoaded) return false;

    const userId = profile.id;
    const userLevel = profile.permission_lvl;

    // Check user-specific permission first (highest priority)
    const userSpecific = userPermissions[userId]?.[permissionId];
    if (userSpecific !== undefined) return userSpecific;

    // Fall back to level permission
    const levelPerm = levelPermissions[userLevel]?.[permissionId];
    if (levelPerm !== undefined) return levelPerm;

    // Fallback to basic level-based check if no database entry exists
    const permission = permissions.find(p => p.id === permissionId);
    return permission ? userLevel >= permission.requiresLevel : false;
  }, [profile, userPermissions, levelPermissions, isLoaded]);

  // Check if user can access a specific feature
  const canAccess = useCallback((requiredPermission: string): boolean => {
    return hasPermission(requiredPermission);
  }, [hasPermission]);

  // Check if user can manage permissions
  const canManagePermissions = useCallback((): boolean => {
    return profile?.permission_lvl >= 10;
  }, [profile?.permission_lvl]);

  // Save user permission to database
  const setUserPermission = useCallback(async (userId: number, permissionId: string, allowed: boolean) => {
    if (!canManagePermissions()) return false;

    try {
      // Use native PostgreSQL UPSERT with ON CONFLICT
      const { error } = await supabase
        .from('user_permissions')
        .upsert(
          { user_id: userId, permission_id: permissionId, allowed, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,permission_id' }
        );

      if (error) {
        console.error('Error upserting user permission:', error);
        return false;
      }

      // Update local state
      setUserPermissions(prev => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          [permissionId]: allowed
        }
      }));
      return true;
    } catch (error) {
      console.error('Error setting user permission:', error);
      return false;
    }
  }, [canManagePermissions]);

  // Save level permission to database
  const setLevelPermission = useCallback(async (level: number, permissionId: string, allowed: boolean) => {
    if (!canManagePermissions()) return false;

    try {
      // Use native PostgreSQL UPSERT with ON CONFLICT
      const { error } = await supabase
        .from('level_permissions')
        .upsert(
          { level, permission_id: permissionId, allowed, updated_at: new Date().toISOString() },
          { onConflict: 'level,permission_id' }
        );

      if (error) {
        console.error('Error upserting level permission:', error);
        return false;
      }

      // Update local state
      setLevelPermissions(prev => ({
        ...prev,
        [level]: {
          ...prev[level],
          [permissionId]: allowed
        }
      }));
      return true;
    } catch (error) {
      console.error('Error setting level permission:', error);
      return false;
    }
  }, [canManagePermissions]);

  return {
    permissions,
    hasPermission,
    canAccess,
    canManagePermissions,
    userPermissions,
    levelPermissions,
    isLoaded,
    setUserPermission,
    setLevelPermission,
    reloadPermissions: loadPermissions
  };
};