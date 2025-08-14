import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  KeyRound, 
  Plus, 
  Search, 
  Shield, 
  Clock,
  User,
  Building
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const Keycard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Check permissions
  if (!profile || profile.permission_lvl < 8) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Zugriff verweigert</CardTitle>
            <CardDescription>
              Sie haben keine Berechtigung für das Keycard-System.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zum Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sample keycard data
  const keycards = [
    {
      id: 1,
      cardNumber: "CARD001",
      holder: "Max Mustermann",
      role: "Lehrer",
      accessLevel: "Hoch",
      rooms: ["101", "102", "203", "Lehrerzimmer"],
      lastUsed: "2024-01-14 09:30",
      status: "Aktiv"
    },
    {
      id: 2,
      cardNumber: "CARD002", 
      holder: "Anna Schmidt",
      role: "Schüler",
      accessLevel: "Niedrig",
      rooms: ["Klassenzimmer"],
      lastUsed: "2024-01-14 08:15",
      status: "Aktiv"
    },
    {
      id: 3,
      cardNumber: "CARD003",
      holder: "Dr. Weber",
      role: "Schulleitung",
      accessLevel: "Vollzugriff",
      rooms: ["Alle Räume"],
      lastUsed: "2024-01-14 10:45",
      status: "Aktiv"
    }
  ];

  const filteredKeycards = keycards.filter(card =>
    card.holder.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.cardNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case "Vollzugriff": return "default";
      case "Hoch": return "secondary";
      case "Niedrig": return "outline";
      default: return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    return status === "Aktiv" ? "default" : "destructive";
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
                Zurück
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Keycard-System</h1>
                <p className="text-muted-foreground">Zugangskontrolle verwalten</p>
              </div>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Neue Keycard
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aktive Karten</CardTitle>
                <KeyRound className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground">
                  +0 seit letzter Woche
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Zugriffe heute</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">127</div>
                <p className="text-xs text-muted-foreground">
                  +12% seit gestern
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesperrte Räume</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2</div>
                <p className="text-xs text-muted-foreground">
                  Wartungsarbeiten
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Letzter Zugriff</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">10:45</div>
                <p className="text-xs text-muted-foreground">
                  Dr. Weber - Büro
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <Card>
            <CardHeader>
              <CardTitle>Keycard-Verwaltung</CardTitle>
              <CardDescription>
                Verwalten Sie Zugangskarten und Berechtigungen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nach Karteninhaber oder Kartennummer suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Keycard List */}
              <div className="space-y-4">
                {filteredKeycards.map((card) => (
                  <Card key={card.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-primary/10 rounded-lg">
                            <KeyRound className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{card.holder}</h3>
                            <p className="text-sm text-muted-foreground">
                              {card.cardNumber} • {card.role}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={getAccessLevelColor(card.accessLevel)}>
                                {card.accessLevel}
                              </Badge>
                              <Badge variant={getStatusColor(card.status)}>
                                {card.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Letzter Zugriff: {card.lastUsed}
                            </p>
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            <p className="font-medium">Zugriff auf:</p>
                            <p>{card.rooms.join(", ")}</p>
                          </div>
                          
                          <Button variant="outline" size="sm">
                            Bearbeiten
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Keycard;