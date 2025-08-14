import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SubstitutionEntry {
  id: string;
  date: string;
  class: string;
  period: number;
  subject: string;
  teacher: string;
  substituteTeacher: string;
  room: string;
  note?: string;
}

const Vertretungsplan = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [substitutions, setSubstitutions] = useState<SubstitutionEntry[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSubstitution, setNewSubstitution] = useState({
    date: '',
    class: '',
    period: 1,
    subject: '',
    teacher: '',
    substituteTeacher: '',
    room: '',
    note: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (profile && profile.permission_lvl < 5) {
      toast({
        variant: "destructive",
        title: "Zugriff verweigert",
        description: "Sie haben keine Berechtigung für den Vertretungsplan."
      });
      navigate('/');
      return;
    }
    // Sample data
    setSubstitutions([
      {
        id: '1',
        date: new Date().toISOString().split('T')[0],
        class: '10b_A',
        period: 3,
        subject: 'Mathematik',
        teacher: 'Herr Schmidt',
        substituteTeacher: 'Frau Müller',
        room: 'R201',
        note: 'Arbeitsblätter mitbringen'
      },
      {
        id: '2',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        class: '10c_A',
        period: 5,
        subject: 'Deutsch',
        teacher: 'Frau Weber',
        substituteTeacher: 'Herr König',
        room: 'R105'
      }
    ]);
  }, [user, profile, navigate]);

  const handleCreateSubstitution = () => {
    if (!newSubstitution.date || !newSubstitution.class || !newSubstitution.subject) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus."
      });
      return;
    }

    const substitution: SubstitutionEntry = {
      id: Date.now().toString(),
      ...newSubstitution
    };

    setSubstitutions([...substitutions, substitution].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    ));
    
    setNewSubstitution({
      date: '',
      class: '',
      period: 1,
      subject: '',
      teacher: '',
      substituteTeacher: '',
      room: '',
      note: ''
    });
    setShowCreateForm(false);
    
    toast({
      title: "Vertretung erstellt",
      description: "Die Vertretung wurde erfolgreich hinzugefügt."
    });
  };

  const handleDeleteSubstitution = (id: string) => {
    setSubstitutions(substitutions.filter(sub => sub.id !== id));
    toast({
      title: "Vertretung gelöscht",
      description: "Die Vertretung wurde entfernt."
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const canEditSubstitutions = profile?.permission_lvl && profile.permission_lvl >= 5;

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
                <Calendar className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Vertretungsplan</h1>
                  <p className="text-muted-foreground">Vertretungen verwalten</p>
                </div>
              </div>
            </div>
            {canEditSubstitutions && (
              <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Neue Vertretung
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Create Form */}
          {showCreateForm && canEditSubstitutions && (
            <Card>
              <CardHeader>
                <CardTitle>Neue Vertretung erstellen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="date">Datum *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newSubstitution.date}
                      onChange={(e) => setNewSubstitution({...newSubstitution, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="class">Klasse *</Label>
                    <Input
                      id="class"
                      value={newSubstitution.class}
                      onChange={(e) => setNewSubstitution({...newSubstitution, class: e.target.value})}
                      placeholder="z.B. 10b_A"
                    />
                  </div>
                  <div>
                    <Label htmlFor="period">Stunde</Label>
                    <Input
                      id="period"
                      type="number"
                      min="1"
                      max="10"
                      value={newSubstitution.period}
                      onChange={(e) => setNewSubstitution({...newSubstitution, period: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="subject">Fach *</Label>
                    <Input
                      id="subject"
                      value={newSubstitution.subject}
                      onChange={(e) => setNewSubstitution({...newSubstitution, subject: e.target.value})}
                      placeholder="z.B. Mathematik"
                    />
                  </div>
                  <div>
                    <Label htmlFor="teacher">Ursprünglicher Lehrer</Label>
                    <Input
                      id="teacher"
                      value={newSubstitution.teacher}
                      onChange={(e) => setNewSubstitution({...newSubstitution, teacher: e.target.value})}
                      placeholder="z.B. Herr Schmidt"
                    />
                  </div>
                  <div>
                    <Label htmlFor="substituteTeacher">Vertretungslehrer</Label>
                    <Input
                      id="substituteTeacher"
                      value={newSubstitution.substituteTeacher}
                      onChange={(e) => setNewSubstitution({...newSubstitution, substituteTeacher: e.target.value})}
                      placeholder="z.B. Frau Müller"
                    />
                  </div>
                  <div>
                    <Label htmlFor="room">Raum</Label>
                    <Input
                      id="room"
                      value={newSubstitution.room}
                      onChange={(e) => setNewSubstitution({...newSubstitution, room: e.target.value})}
                      placeholder="z.B. R201"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="note">Notiz</Label>
                    <Input
                      id="note"
                      value={newSubstitution.note}
                      onChange={(e) => setNewSubstitution({...newSubstitution, note: e.target.value})}
                      placeholder="Zusätzliche Informationen"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleCreateSubstitution}>Vertretung hinzufügen</Button>
                  <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                    Abbrechen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Substitutions List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Aktuelle Vertretungen</h2>
            
            {substitutions.map((substitution) => (
              <Card key={substitution.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1">
                      <div>
                        <p className="text-sm text-muted-foreground">Datum</p>
                        <p className="font-medium">{formatDate(substitution.date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Klasse & Stunde</p>
                        <p className="font-medium">{substitution.class} - {substitution.period}. Std</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Fach</p>
                        <p className="font-medium">{substitution.subject}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Vertretung</p>
                        <p className="font-medium">
                          {substitution.teacher && `${substitution.teacher} → `}
                          {substitution.substituteTeacher || 'Entfall'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Raum</p>
                        <p className="font-medium">{substitution.room || '-'}</p>
                      </div>
                    </div>
                    {canEditSubstitutions && (
                      <div className="flex gap-2 ml-4">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive"
                          onClick={() => handleDeleteSubstitution(substitution.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {substitution.note && (
                    <div className="mt-4 p-3 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">Notiz:</p>
                      <p className="text-sm">{substitution.note}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {substitutions.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Keine Vertretungen vorhanden.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Vertretungsplan;