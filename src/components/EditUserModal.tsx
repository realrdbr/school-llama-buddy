import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  const [selectedClass, setSelectedClass] = useState<string>(user.user_class || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
      // Update class
      const { error: classErr } = await supabase
        .from('permissions')
        .update({ user_class: selectedClass || null })
        .eq('id', user.id);
      if (classErr) throw classErr;

      // Update password if provided
      if (newPassword) {
        const { error: pwErr } = await supabase.rpc('change_user_password', {
          user_id_input: user.id,
          old_password: '',
          new_password: newPassword,
        });
        if (pwErr) throw pwErr;
      }

      toast({
        title: 'Erfolg',
        description: `Benutzer aktualisiert${newPassword ? ' und Passwort geändert' : ''}.`,
      });
      onClose();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({ title: 'Fehler', description: 'Benutzer konnte nicht aktualisiert werden.', variant: 'destructive' });
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
                <SelectItem value="">Keine Klasse</SelectItem>
                <SelectItem value="10b">10b</SelectItem>
                <SelectItem value="10c">10c</SelectItem>
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
