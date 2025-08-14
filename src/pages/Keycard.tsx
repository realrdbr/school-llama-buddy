import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, KeyRound, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface KeycardData {
  id: string;
  cardNumber: string;
  owner: string;
  accessLevel: string;
  isActive: boolean;
  lastUsed?: string;
}

const Keycard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [keycards, setKeycards] = useState<KeycardData[]>([]);
  const [showCreateKeycard, setShowCreateKeycard] = useState(false);
  const [showEditKeycard, setShowEditKeycard] = useState(false);
  const [selectedKeycard, setSelectedKeycard] = useState<KeycardData | null>(null);
  const [newKeycard, setNewKeycard] = useState({ cardNumber: '', owner: '', accessLevel: 'Schüler' });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (profile && profile.permission_lvl < 1) {
      toast({
        variant: "destructive",
        title: "Zugriff verweigert",
        description: "Sie haben keine Berechtigung für diese Seite."
      });
      navigate('/');
      return;
    }
    
    // Sample data for demonstration
    setKeycards([
      {
        id: '1',
        cardNumber: '1234567890',
        owner: 'Max Mustermann',
        accessLevel: 'Schüler',
        isActive: true,
        lastUsed: '2024-01-15T10:30:00Z'
      },
      {
        id: '2',
        cardNumber: '0987654321',
        owner: 'Maria Schmidt',
        accessLevel: 'Lehrer',
        isActive: true,
        lastUsed: '2024-01-15T14:20:00Z'
      }
    ]);
  }, [user, profile, navigate]);

  const canManageKeycards = profile?.permission_lvl && profile.permission_lvl >= 8;

  const handleCreateKeycard = () => {
    if (!newKeycard.cardNumber || !newKeycard.owner) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte füllen Sie alle Felder aus."
      });
      return;
    }

    const keycard: KeycardData = {
      id: Date.now().toString(),
      cardNumber: newKeycard.cardNumber,
      owner: newKeycard.owner,
      accessLevel: newKeycard.accessLevel,
      isActive: true
    };

    setKeycards([...keycards, keycard]);
    setNewKeycard({ cardNumber: '', owner: '', accessLevel: 'Schüler' });
    setShowCreateKeycard(false);
    
    toast({
      title: "Keycard erstellt",
      description: `Keycard für ${newKeycard.owner} wurde erfolgreich registriert.`
    });
  };

  const handleEditKeycard = () => {
    if (!selectedKeycard || !selectedKeycard.cardNumber || !selectedKeycard.owner) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte füllen Sie alle Felder aus."
      });
      return;
    }

    setKeycards(keycards.map(card => 
      card.id === selectedKeycard.id ? selectedKeycard : card
    ));
    setShowEditKeycard(false);
    setSelectedKeycard(null);
    
    toast({
      title: "Keycard bearbeitet",
      description: `Keycard wurde erfolgreich aktualisiert.`
    });
  };

  const handleDeleteKeycard = (id: string) => {
    setKeycards(keycards.filter(card => card.id !== id));
    toast({
      title: "Keycard gelöscht",
      description: "Die Keycard wurde erfolgreich entfernt."
    });
  };

  const toggleKeycard = (id: string) => {
    setKeycards(keycards.map(card => 
      card.id === id ? { ...card, isActive: !card.isActive } : card
    ));
    
    const card = keycards.find(c => c.id === id);
    toast({
      title: card?.isActive ? "Keycard deaktiviert" : "Keycard aktiviert",
      description: `Die Keycard wurde ${card?.isActive ? 'deaktiviert' : 'aktiviert'}.`
    });
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? "default" : "secondary";
  };

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
                <KeyRound className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Keycard-System</h1>
                  <p className="text-muted-foreground">
                    {canManageKeycards ? "Zugangskarten verwalten" : "Keycard-Übersicht"}
                  </p>
                </div>
              </div>
            </div>
            {canManageKeycards && (
              <Dialog open={showCreateKeycard} onOpenChange={setShowCreateKeycard}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Keycard registrieren
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Neue Keycard registrieren</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="cardNumber">Keycard-Nummer</Label>
                      <Input
                        id="cardNumber"
                        value={newKeycard.cardNumber}
                        onChange={(e) => setNewKeycard({...newKeycard, cardNumber: e.target.value})}
                        placeholder="z.B. 1234567890"
                      />
                    </div>
                    <div>
                      <Label htmlFor="owner">Besitzer</Label>
                      <Input
                        id="owner"
                        value={newKeycard.owner}
                        onChange={(e) => setNewKeycard({...newKeycard, owner: e.target.value})}
                        placeholder="z.B. Max Mustermann"
                      />
                    </div>
                    <div>
                      <Label htmlFor="accessLevel">Zugriffsebene</Label>
                      <select
                        id="accessLevel"
                        value={newKeycard.accessLevel}
                        onChange={(e) => setNewKeycard({...newKeycard, accessLevel: e.target.value})}
                        className="w-full p-2 border border-border rounded-md"
                      >
                        <option value="Schüler">Schüler</option>
                        <option value="Lehrer">Lehrer</option>
                        <option value="Verwaltung">Verwaltung</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCreateKeycard}>Registrieren</Button>
                      <Button variant="outline" onClick={() => setShowCreateKeycard(false)}>
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Keycards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {keycards.map((keycard) => (
              <Card key={keycard.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <KeyRound className="h-5 w-5" />
                      {keycard.owner}
                    </CardTitle>
                    <Badge variant={getStatusBadge(keycard.isActive)}>
                      {keycard.isActive ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Kartennummer</p>
                    <p className="font-mono">{keycard.cardNumber}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Zugriffsebene</p>
                    <p className="font-medium">{keycard.accessLevel}</p>
                  </div>

                  {keycard.lastUsed && (
                    <div>
                      <p className="text-sm text-muted-foreground">Zuletzt verwendet</p>
                      <p className="text-sm">{new Date(keycard.lastUsed).toLocaleString('de-DE')}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {canManageKeycards && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedKeycard(keycard);
                            setShowEditKeycard(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => toggleKeycard(keycard.id)}
                        >
                          {keycard.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleDeleteKeycard(keycard.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {keycards.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <KeyRound className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Keine Keycards verfügbar.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Edit Keycard Dialog */}
      <Dialog open={showEditKeycard} onOpenChange={setShowEditKeycard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keycard bearbeiten</DialogTitle>
          </DialogHeader>
          {selectedKeycard && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="editCardNumber">Keycard-Nummer</Label>
                <Input
                  id="editCardNumber"
                  value={selectedKeycard.cardNumber}
                  onChange={(e) => setSelectedKeycard({...selectedKeycard, cardNumber: e.target.value})}
                  placeholder="z.B. 1234567890"
                />
              </div>
              <div>
                <Label htmlFor="editOwner">Besitzer</Label>
                <Input
                  id="editOwner"
                  value={selectedKeycard.owner}
                  onChange={(e) => setSelectedKeycard({...selectedKeycard, owner: e.target.value})}
                  placeholder="z.B. Max Mustermann"
                />
              </div>
              <div>
                <Label htmlFor="editAccessLevel">Zugriffsebene</Label>
                <select
                  id="editAccessLevel"
                  value={selectedKeycard.accessLevel}
                  onChange={(e) => setSelectedKeycard({...selectedKeycard, accessLevel: e.target.value})}
                  className="w-full p-2 border border-border rounded-md"
                >
                  <option value="Schüler">Schüler</option>
                  <option value="Lehrer">Lehrer</option>
                  <option value="Verwaltung">Verwaltung</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleEditKeycard}>Speichern</Button>
                <Button variant="outline" onClick={() => setShowEditKeycard(false)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Keycard;