import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, UserPlus, Edit, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import CreateUserModal from '@/components/CreateUserModal';
import EditUserModal from '@/components/EditUserModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
interface User {
  id: number;
  username: string;
  name: string;
  permission_lvl: number;
  created_at: string;
  user_class?: string;
}

const UserManagement = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
const [showCreateModal, setShowCreateModal] = useState(false);
const [showEditModal, setShowEditModal] = useState(false);
const [selectedUser, setSelectedUser] = useState<User | null>(null);
const [confirmDeleteOpen1, setConfirmDeleteOpen1] = useState(false);
const [confirmDeleteOpen2, setConfirmDeleteOpen2] = useState(false);
const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (profile && profile.permission_lvl < 10) {
      toast({
        variant: "destructive",
        title: "Zugriff verweigert",
        description: "Sie haben keine Berechtigung für die Benutzerverwaltung."
      });
      navigate('/');
      return;
    }
    fetchUsers();
  }, [user, profile, navigate]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('id, username, name, permission_lvl, created_at, user_class')
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Benutzer konnten nicht geladen werden."
        });
      } else {
        setUsers(data || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserCreated = () => {
    setShowCreateModal(false);
    fetchUsers(); // Refresh the user list
  };

const handleEditUser = (user: User) => {
  setSelectedUser(user);
  setShowEditModal(true);
};

const handleEditModalClose = () => {
  setShowEditModal(false);
  setSelectedUser(null);
  fetchUsers(); // Refresh the user list
};

const requestDeleteUser = (u: User) => {
  setSelectedUser(u);
  setConfirmDeleteOpen1(true);
};

const handleConfirmStep1 = () => {
  setConfirmDeleteOpen1(false);
  setConfirmDeleteOpen2(true);
};

const handleDeleteUser = async () => {
  if (!selectedUser) return;
  setDeleting(true);
  try {
    const { error } = await supabase
      .from('permissions')
      .delete()
      .eq('id', selectedUser.id);
    if (error) throw error;

    toast({ title: 'Benutzer gelöscht', description: `${selectedUser.name} wurde entfernt.` });
    setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
  } catch (err) {
    console.error('Error deleting user:', err);
    toast({ title: 'Fehler', description: 'Benutzer konnte nicht gelöscht werden.', variant: 'destructive' });
  } finally {
    setDeleting(false);
    setConfirmDeleteOpen2(false);
    setSelectedUser(null);
  }
};
  const getPermissionBadge = (level: number) => {
    if (level >= 10) return { text: "Schulleitung", variant: "default" as const };
    if (level >= 8) return { text: "Administrator", variant: "secondary" as const };
    if (level >= 5) return { text: "Lehrkraft", variant: "outline" as const };
    return { text: "Schüler", variant: "outline" as const };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück zum Dashboard
              </Button>
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Benutzerverwaltung</h1>
                  <p className="text-muted-foreground">Benutzer und Berechtigungen verwalten</p>
                </div>
              </div>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Neuer Benutzer
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gesamt</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Schulleitung</p>
                    <p className="text-2xl font-bold">{users.filter(u => u.permission_lvl >= 10).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lehrkräfte</p>
                    <p className="text-2xl font-bold">{users.filter(u => u.permission_lvl >= 5 && u.permission_lvl < 10).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Users className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Schüler</p>
                    <p className="text-2xl font-bold">{users.filter(u => u.permission_lvl < 5).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Alle Benutzer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold">Benutzername</th>
                      <th className="text-left p-4 font-semibold">Name</th>
                      <th className="text-left p-4 font-semibold">Berechtigung</th>
                      <th className="text-left p-4 font-semibold">Klasse</th>
                      <th className="text-left p-4 font-semibold">Level</th>
                      <th className="text-left p-4 font-semibold">Erstellt</th>
                      <th className="text-left p-4 font-semibold">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((userItem) => {
                      const badge = getPermissionBadge(userItem.permission_lvl);
                      return (
                        <tr key={userItem.id} className="border-b hover:bg-muted/50">
                          <td className="p-4 font-medium">{userItem.username}</td>
                          <td className="p-4">{userItem.name}</td>
                          <td className="p-4">
                            <Badge variant={badge.variant}>{badge.text}</Badge>
                          </td>
                          <td className="p-4">
                            {userItem.user_class ? (
                              <Badge variant="outline">{userItem.user_class}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-4">{userItem.permission_lvl}</td>
                          <td className="p-4 text-muted-foreground">
                            {formatDate(userItem.created_at)}
                          </td>
                          <td className="p-4">
<div className="flex gap-2">
  <Button 
    variant="ghost" 
    size="sm"
    onClick={() => handleEditUser(userItem)}
    title="Benutzer bearbeiten"
  >
    <Edit className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="sm" className="text-destructive" title="Benutzer löschen" onClick={() => requestDeleteUser(userItem)}>
    <Trash2 className="h-4 w-4" />
  </Button>
</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {users.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Keine Benutzer gefunden.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <CreateUserModal 
        isOpen={showCreateModal}
        onClose={handleUserCreated}
      />

{selectedUser && (
  <EditUserModal
    isOpen={showEditModal}
    onClose={handleEditModalClose}
    user={selectedUser}
  />
)}

{/* Double confirmation dialogs for safe deletion */}
<AlertDialog open={confirmDeleteOpen1} onOpenChange={setConfirmDeleteOpen1}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Benutzer wirklich löschen?</AlertDialogTitle>
      <AlertDialogDescription>
        Diese Aktion kann nicht rückgängig gemacht werden. Möchten Sie fortfahren?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirmStep1}>Ja, weiter</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

<AlertDialog open={confirmDeleteOpen2} onOpenChange={setConfirmDeleteOpen2}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Letzte Bestätigung</AlertDialogTitle>
      <AlertDialogDescription>
        Bitte bestätigen Sie erneut, dass {selectedUser?.name} endgültig gelöscht werden soll.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
      <AlertDialogAction onClick={handleDeleteUser} disabled={deleting}>
        {deleting ? 'Löschen...' : 'Ja, endgültig löschen'}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
    </div>
  );
};

export default UserManagement;