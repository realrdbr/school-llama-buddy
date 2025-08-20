import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, User, Users, Save, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Permission {
  id: string;
  name: string;
  description: string;
  requiresLevel: number;
}

interface User {
  id: number;
  username: string;
  name: string;
  permission_lvl: number;
  user_class?: string;
}

interface UserPermissions {
  [userId: number]: {
    [permissionId: string]: boolean;
  };
}

interface LevelPermissions {
  [level: number]: {
    [permissionId: string]: boolean;
  };
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
    isLoaded
  } = useEnhancedPermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Define all available permissions
  const permissions: Permission[] = [
    { id: 'view_chat', name: 'KI-Chat verwenden', description: 'Zugriff auf den KI-Assistenten', requiresLevel: 1 },
    { id: 'view_schedule', name: 'Stundenplan einsehen', description: 'Eigenen Stundenplan anzeigen', requiresLevel: 1 },
    { id: 'view_announcements', name: 'Ankündigungen lesen', description: 'Schulankündigungen einsehen', requiresLevel: 1 },
    { id: 'view_vertretungsplan', name: 'Vertretungsplan einsehen', description: 'Vertretungen anzeigen', requiresLevel: 1 },
    { id: 'create_announcements', name: 'Ankündigungen erstellen', description: 'Neue Ankündigungen verfassen', requiresLevel: 4 },
    { id: 'edit_announcements', name: 'Ankündigungen bearbeiten', description: 'Bestehende Ankündigungen ändern', requiresLevel: 4 },
    { id: 'manage_substitutions', name: 'Vertretungen verwalten', description: 'Vertretungsplan bearbeiten', requiresLevel: 9 },
    { id: 'manage_schedules', name: 'Stundenpläne verwalten', description: 'Stundenpläne erstellen/bearbeiten', requiresLevel: 9 },
    { id: 'document_analysis', name: 'Dokumenten-Analyse', description: 'KI-Dokumentenanalyse verwenden', requiresLevel: 4 },
    { id: 'audio_announcements', name: 'Audio-Durchsagen', description: 'TTS-Durchsagen erstellen/verwalten', requiresLevel: 10 },
    { id: 'user_management', name: 'Benutzerverwaltung', description: 'Benutzer erstellen/bearbeiten/löschen', requiresLevel: 10 },
    { id: 'permission_management', name: 'Berechtigungen verwalten', description: 'Benutzerberechtigungen ändern', requiresLevel: 10 },
    { id: 'keycard_system', name: 'Keycard-System', description: 'Zugangskontrolle konfigurieren', requiresLevel: 10 },
    { id: 'system_settings', name: 'Systemeinstellungen', description: 'Arduino-Geräte und System verwalten', requiresLevel: 10 }
  ];

  useEffect(() => {
    if (profile?.permission_lvl >= 10) {
      fetchUsers();
      loadPermissions();
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

  const loadPermissions = () => {
    // Load from localStorage or set defaults
    const savedUserPermissions = localStorage.getItem('userPermissions');
    const savedLevelPermissions = localStorage.getItem('levelPermissions');

    if (savedUserPermissions) {
      setUserPermissions(JSON.parse(savedUserPermissions));
    }

    if (savedLevelPermissions) {
      setLevelPermissions(JSON.parse(savedLevelPermissions));
    } else {
      // Set default permissions for each level
      const defaultLevelPerms: LevelPermissions = {};
      for (let level = 1; level <= 10; level++) {
        defaultLevelPerms[level] = {};
        permissions.forEach(perm => {
          defaultLevelPerms[level][perm.id] = level >= perm.requiresLevel;
        });
      }
      setLevelPermissions(defaultLevelPerms);
    }
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      // Save to localStorage (in a real app, this would be saved to database)
      localStorage.setItem('userPermissions', JSON.stringify(userPermissions));
      localStorage.setItem('levelPermissions', JSON.stringify(levelPermissions));

      toast({
        title: "Erfolg",
        description: "Berechtigungen wurden gespeichert."
      });
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Berechtigungen konnten nicht gespeichert werden."
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleUserPermission = (userId: number, permissionId: string) => {
    setUserPermissions(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [permissionId]: !prev[userId]?.[permissionId]
      }
    }));
  };

  const toggleLevelPermission = (level: number, permissionId: string) => {
    setLevelPermissions(prev => ({
      ...prev,
      [level]: {
        ...prev[level],
        [permissionId]: !prev[level]?.[permissionId]
      }
    }));
  };

  const getUserPermission = (userId: number, permissionId: string): boolean => {
    const user = users.find(u => u.id === userId);
    if (!user) return false;
    
    // Check user-specific permission first, then fall back to level permission
    const userSpecific = userPermissions[userId]?.[permissionId];
    if (userSpecific !== undefined) return userSpecific;
    
    return levelPermissions[user.permission_lvl]?.[permissionId] || false;
  };

  const getLevelPermission = (level: number, permissionId: string): boolean => {
    return levelPermissions[level]?.[permissionId] || false;
  };

  const getPermissionBadge = (level: number) => {
    if (level >= 10) return { text: "Schulleitung", variant: "default" as const };
    if (level >= 8) return { text: "Administrator", variant: "secondary" as const };
    if (level >= 5) return { text: "Lehrkraft", variant: "outline" as const };
    if (level === 1) return { text: "Besucher", variant: "outline" as const };
    return { text: "Schüler", variant: "outline" as const };
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
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
        <Button onClick={savePermissions} disabled={saving}>
          {saving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Speichern
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
                        {permissions.map((permission) => (
                          <div key={permission.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div className="space-y-0.5 flex-1">
                              <Label className="text-sm font-medium">{permission.name}</Label>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                            </div>
                            <Switch
                              checked={getUserPermission(user.id, permission.id)}
                              onCheckedChange={() => toggleUserPermission(user.id, permission.id)}
                            />
                          </div>
                        ))}
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
                        {permissions.map((permission) => (
                          <div key={permission.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div className="space-y-0.5 flex-1">
                              <Label className="text-sm font-medium">{permission.name}</Label>
                              <p className="text-xs text-muted-foreground">{permission.description}</p>
                            </div>
                            <Switch
                              checked={getLevelPermission(level, permission.id)}
                              onCheckedChange={() => toggleLevelPermission(level, permission.id)}
                              disabled={level < permission.requiresLevel}
                            />
                          </div>
                        ))}
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