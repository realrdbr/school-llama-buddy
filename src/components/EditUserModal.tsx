import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: number;
    username: string;
    name: string;
    user_class?: string | null;
  };
}

const EditUserModal = ({ isOpen, onClose, user }: EditUserModalProps) => {
  const [selectedClass, setSelectedClass] = useState<string>(user.user_class || 'none');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const { profile } = useAuth();

  // Load available classes from database
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const { data, error } = await supabase
          .from('Klassen')
          .select('name')
          .order('name');
        
        if (error) {
          console.error('Error loading classes:', error);
          // Fallback to hardcoded classes
          setAvailableClasses(['10b', '10c']);
        } else {
          setAvailableClasses(data.map(cls => cls.name));
        }
      } catch (error) {
        console.error('Error loading classes:', error);
        setAvailableClasses(['10b', '10c']);
      }
    };
    
    if (isOpen) {
      loadClasses();
    }
  }, [isOpen]);

  // Reset form when user changes
  useEffect(() => {
    setSelectedClass(user.user_class || 'none');
    setNewPassword('');
    setConfirmPassword('');
  }, [user]);

  const handleSave = async () => {
    if (newPassword && newPassword.length < 6) {
      toast({
        title: 'Fehler',
        description: 'Das Passwort muss mindestens 6 Zeichen lang sein.',
        variant: 'destructive',
      });
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast({
        title: 'Fehler',
        description: 'Die Passwörter stimmen nicht überein.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (!profile) throw new Error('Kein Profil gefunden');

      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'update_user',
          actorUserId: profile.id,
          actorUsername: profile.username,
          targetUserId: user.id,
          targetUsername: user.username,
          updates: {
            user_class: selectedClass === 'none' ? null : selectedClass,
            new_password: newPassword || null
          }
        }
      });

      if (error || !data?.success) {
        const errorMessage = data?.error || error?.message || 'Unbekannter Fehler';
        throw new Error(errorMessage);
      }

      toast({
        title: 'Erfolg',
        description: `Benutzer aktualisiert${newPassword ? ' und Passwort geändert' : ''}.`,
      });
      onClose();
    } catch (error) {
      console.error('Error updating user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Benutzer konnte nicht aktualisiert werden.';
      toast({ 
        title: 'Fehler', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Benutzer bearbeiten - {user.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label className="mb-2 block">Klasse auswählen</Label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="Keine Klasse zugewiesen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Klasse</SelectItem>
                {availableClasses.map(className => (
                  <SelectItem key={className} value={className}>{className}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Neues Passwort (optional)</Label>
            <Input
              type="password"
              placeholder="Mindestens 6 Zeichen"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Neues Passwort bestätigen</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserModal;
