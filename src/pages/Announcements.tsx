import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Megaphone, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  created_at: string;
  priority: 'normal' | 'high' | 'urgent';
}

const Announcements = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    priority: 'normal' as 'normal' | 'high' | 'urgent'
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    // For demo purposes, show sample announcements
    setAnnouncements([
      {
        id: '1',
        title: 'Wichtige Schulnachricht',
        content: 'Bitte beachten Sie die neuen Pausenzeiten ab nächster Woche.',
        author: 'Schulleitung',
        created_at: new Date().toISOString(),
        priority: 'high'
      },
      {
        id: '2',
        title: 'Elternabend',
        content: 'Der nächste Elternabend findet am 20. September statt.',
        author: 'Klassenlehrer',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        priority: 'normal'
      }
    ]);
  }, [user, navigate]);

  const handleCreateAnnouncement = () => {
    if (!newAnnouncement.title || !newAnnouncement.content) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte füllen Sie alle Felder aus."
      });
      return;
    }

    const announcement: Announcement = {
      id: Date.now().toString(),
      title: newAnnouncement.title,
      content: newAnnouncement.content,
      author: profile?.name || 'Unbekannt',
      created_at: new Date().toISOString(),
      priority: newAnnouncement.priority
    };

    setAnnouncements([announcement, ...announcements]);
    setNewAnnouncement({ title: '', content: '', priority: 'normal' });
    setShowCreateForm(false);
    
    toast({
      title: "Ankündigung erstellt",
      description: "Die Ankündigung wurde erfolgreich veröffentlicht."
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Dringend';
      case 'high': return 'Wichtig';
      default: return 'Normal';
    }
  };

  const canCreateAnnouncements = profile?.permission_lvl && profile.permission_lvl >= 5;

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
                <Megaphone className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Ankündigungen</h1>
                  <p className="text-muted-foreground">Aktuelle Schulnachrichten</p>
                </div>
              </div>
            </div>
            {canCreateAnnouncements && (
              <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Neue Ankündigung
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Create Form */}
          {showCreateForm && canCreateAnnouncements && (
            <Card>
              <CardHeader>
                <CardTitle>Neue Ankündigung erstellen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Titel</Label>
                  <Input
                    id="title"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                    placeholder="Titel der Ankündigung"
                  />
                </div>
                <div>
                  <Label htmlFor="content">Inhalt</Label>
                  <Textarea
                    id="content"
                    value={newAnnouncement.content}
                    onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                    placeholder="Inhalt der Ankündigung"
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Priorität</Label>
                  <select
                    id="priority"
                    value={newAnnouncement.priority}
                    onChange={(e) => setNewAnnouncement({...newAnnouncement, priority: e.target.value as any})}
                    className="w-full p-2 border border-border rounded-md"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">Wichtig</option>
                    <option value="urgent">Dringend</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateAnnouncement}>Veröffentlichen</Button>
                  <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                    Abbrechen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Announcements List */}
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <Card key={announcement.id} className={`border-l-4 ${getPriorityColor(announcement.priority)}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4" />
                      {announcement.title}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {getPriorityText(announcement.priority)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground mb-4">{announcement.content}</p>
                  <div className="text-sm text-muted-foreground">
                    Von: {announcement.author} • {new Date(announcement.created_at).toLocaleDateString('de-DE')}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {announcements.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Keine Ankündigungen verfügbar.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Announcements;