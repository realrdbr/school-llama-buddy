import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedPermissions } from '@/hooks/useEnhancedPermissions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Users, Shield, Save, RefreshCw, Settings, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface User {
  id: number;
  username: string;
  name: string;
  permission_lvl: number;
  user_class?: string;
}

const PermissionManager = () => {
  const { profile } = useAuth();
  const { 
    permissions, 
    userPermissions, 
    levelPermissions, 
    setUserPermission, 
    setLevelPermission, 
    reloadPermissions,
    isLoaded,
    hasPermission
  } = useEnhancedPermissions();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.permission_lvl >= 10) {
      fetchUsers();
    }
  }, [profile]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('id, username, name, permission_lvl, user_class')
        .order('permission_lvl', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Benutzer konnten nicht geladen werden."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserPermissionToggle = async (userId: number, permissionId: string, currentValue: boolean) => {
    const success = await setUserPermission(userId, permissionId, !currentValue);
    if (success) {
      toast({
        title: "Erfolg",
        description: "Berechtigung wurde aktualisiert."
      });
    } else {
      toast({
        variant: "destructive", 
        title: "Fehler",
        description: "Berechtigung konnte nicht aktualisiert werden."
      });
    }
  };

  const handleLevelPermissionToggle = async (level: number, permissionId: string, currentValue: boolean) => {
    const success = await setLevelPermission(level, permissionId, !currentValue);
    if (success) {
      toast({
        title: "Erfolg", 
        description: "Level-Berechtigung wurde aktualisiert."
      });
    } else {
      toast({
        variant: "destructive",
        title: "Fehler", 
        description: "Level-Berechtigung konnte nicht aktualisiert werden."
      });
    }
  };

  const getUserPermission = (userId: number, permissionId: string): boolean => {
    const user = users.find(u => u.id === userId);
    if (!user) return false;
    
    // Check user-specific permission first
    const userSpecific = userPermissions[userId]?.[permissionId];
    if (userSpecific !== undefined) return userSpecific;
    
    // Fall back to level permission
    const levelPerm = levelPermissions[user.permission_lvl]?.[permissionId];
    if (levelPerm !== undefined) return levelPerm;

    // Fallback to basic level-based check if no database entry exists
    const permission = permissions.find(p => p.id === permissionId);
    return permission ? user.permission_lvl >= permission.requiresLevel : false;
  };

  const getLevelPermission = (level: number, permissionId: string): boolean => {
    const levelPerm = levelPermissions[level]?.[permissionId];
    if (levelPerm !== undefined) return levelPerm;
    
    // Fallback to basic level-based check
    const permission = permissions.find(p => p.id === permissionId);
    return permission ? level >= permission.requiresLevel : false;
  };

  const getPermissionBadge = (level: number) => {
    if (level >= 10) return { text: "Schulleitung", variant: "default" as const };
    if (level >= 8) return { text: "Administrator", variant: "secondary" as const };
    if (level >= 5) return { text: "Lehrkraft", variant: "outline" as const };
    if (level === 1) return { text: "Besucher", variant: "outline" as const };
    return { text: "Schüler", variant: "outline" as const };
  };

  const handleReloadPermissions = async () => {
    await reloadPermissions();
    await fetchUsers();
    toast({
      title: "Erfolg",
      description: "Berechtigungen wurden neu geladen."
    });
  };

  if (profile?.permission_lvl < 10) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Zugriff verweigert</h3>
          <p className="text-muted-foreground">Sie benötigen Level 10 Berechtigung, um Berechtigungen zu verwalten.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading || !isLoaded) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Lade Berechtigungen...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Berechtigungsverwaltung</h2>
          <p className="text-muted-foreground">Verwalten Sie Benutzerberechtigungen individuell oder nach Level</p>
        </div>
        <Button onClick={handleReloadPermissions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Neu laden
        </Button>
      </div>

      <Tabs defaultValue="individual" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Individuelle Berechtigungen
          </TabsTrigger>
          <TabsTrigger value="levels" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Level-Berechtigungen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Individuelle Benutzerberechtigungen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {users.map((user) => {
                  const badge = getPermissionBadge(user.permission_lvl);
                  return (
                    <div key={user.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-medium">{user.name}</h4>
                          <p className="text-sm text-muted-foreground">@{user.username}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={badge.variant}>{badge.text}</Badge>
                            <span className="text-sm text-muted-foreground">Level {user.permission_lvl}</span>
                            {user.user_class && (
                              <Badge variant="outline">{user.user_class}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {permissions.map((permission) => {
                          const currentValue = getUserPermission(user.id, permission.id);
                          return (
                          <div key={permission.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div className="space-y-0.5 flex-1">
                              <Label className="text-sm font-medium">{permission.name}</Label>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                            </div>
                            <Switch
                              checked={currentValue}
                              onCheckedChange={() => handleUserPermissionToggle(user.id, permission.id, currentValue)}
                            />
                          </div>
                        )})}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="levels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Level-Standardberechtigungen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => {
                  const badge = getPermissionBadge(level);
                  return (
                    <div key={level} className="border rounded-lg p-4">
                      <div className="flex items-center gap-4 mb-4">
                        <Badge variant={badge.variant}>{badge.text}</Badge>
                        <span className="font-medium">Level {level}</span>
                        <span className="text-sm text-muted-foreground">
                          ({users.filter(u => u.permission_lvl === level).length} Benutzer)
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {permissions.map((permission) => {
                          const currentValue = getLevelPermission(level, permission.id);
                          return (
                          <div key={permission.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div className="space-y-0.5 flex-1">
                              <Label className="text-sm font-medium">{permission.name}</Label>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                            </div>
                            <Switch
                              checked={currentValue}
                              onCheckedChange={() => handleLevelPermissionToggle(level, permission.id, currentValue)}
                              disabled={level < permission.requiresLevel}
                            />
                          </div>
                        )})}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PermissionManager;