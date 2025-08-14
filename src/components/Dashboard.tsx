import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Users, 
  Megaphone, 
  KeyRound, 
  Settings,
  LogOut,
  Clock,
  BookOpen,
  UserPlus
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import CreateUserModal from './CreateUserModal';
import AIAssistant from './AIAssistant';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [showCreateUser, setShowCreateUser] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Abgemeldet",
      description: "Sie wurden erfolgreich abgemeldet."
    });
  };

  const getPermissionBadgeVariant = (level: number) => {
    if (level >= 10) return "default"; // Schulleitung
    if (level >= 8) return "secondary"; // Verwaltung/Administrator  
    if (level >= 5) return "outline"; // Lehrer
    return "destructive"; // Besucher/Schüler
  };

  const getPermissionColor = (level: number) => {
    if (level >= 10) return "text-primary";
    if (level >= 8) return "text-secondary-foreground";
    if (level >= 5) return "text-muted-foreground";
    return "text-destructive";
  };

  const adminFeatures = [
    { icon: Users, title: "Benutzerverwaltung", description: "Benutzer und Berechtigungen verwalten", path: "/user-management" },
    { icon: KeyRound, title: "Keycard-System", description: "Zugangskontrolle konfigurieren", path: "/keycard" },
    { icon: Settings, title: "Systemeinstellungen", description: "Arduino-Geräte verwalten", path: "/settings" }
  ];

  const teacherFeatures = [
    { icon: Calendar, title: "Vertretungsplan", description: "Stunden verwalten und Vertretungen planen", path: "/vertretungsplan" },
    { icon: Megaphone, title: "Ankündigungen", description: "Durchsagen erstellen und verwalten", path: "/announcements" },
    { icon: BookOpen, title: "Klassenverwaltung", description: "Klassen und Stundenpläne bearbeiten", path: "/klassenverwaltung" }
  ];

  const studentFeatures = [
    { icon: Clock, title: "Stundenplan", description: "Aktueller Stundenplan und Vertretungen", path: "/stundenplan" },
    { icon: Calendar, title: "Vertretungsplan", description: "Aktuelle Vertretungen einsehen", path: "/vertretungsplan" },
    { icon: Megaphone, title: "Ankündigungen", description: "Aktuelle Schulnachrichten", path: "/announcements" }
  ];

  const renderFeatureCards = (features: any[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {features.map((feature, index) => (
        <Card 
          key={index} 
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => feature.path && navigate(feature.path)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">{feature.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>{feature.description}</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">E.D.U.A.R.T.</h1>
              <p className="text-muted-foreground">Schulmanagementsystem</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium text-foreground">{profile?.name || user?.email}</p>
                <div className="flex items-center gap-2">
                  <Badge variant={getPermissionBadgeVariant(profile?.permission_lvl || 1)}>
                    {profile?.permission_lvl >= 10 ? "Schulleitung" : profile?.permission_lvl >= 8 ? "Verwaltung" : profile?.permission_lvl >= 5 ? "Lehrkraft" : profile?.permission_lvl > 1 ? "Schüler" : "Besucher"}
                  </Badge>
                  <span className={`text-sm ${getPermissionColor(profile?.permission_lvl || 1)}`}>
                    Level {profile?.permission_lvl || 1}
                  </span>
                </div>
              </div>
              {profile?.permission_lvl && profile.permission_lvl >= 10 && (
                <Button variant="outline" size="sm" onClick={() => setShowCreateUser(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Benutzer erstellen
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Abmelden
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <Card>
            <CardHeader>
              <CardTitle>Willkommen, {profile?.name || "Benutzer"}!</CardTitle>
              <CardDescription>
                {profile?.permission_lvl && profile.permission_lvl >= 10 
                  ? "Als Schulleitung haben Sie Zugriff auf alle Systemfunktionen."
                  : profile?.permission_lvl && profile.permission_lvl >= 8
                  ? "Als Verwaltung/Administrator haben Sie Zugriff auf erweiterte Systemfunktionen."
                  : profile?.permission_lvl && profile.permission_lvl >= 5
                  ? "Als Lehrkraft können Sie Stundenpläne und Ankündigungen verwalten."
                  : profile?.permission_lvl && profile.permission_lvl > 1
                  ? `Als Schüler der Klasse 10b (Klassenlehrer: Frau Kunadt) können Sie Ihren Stundenplan einsehen und den Hausaufgaben-Assistenten nutzen.`
                  : "Als Besucher haben Sie eingeschränkten Zugriff auf öffentliche Inhalte."
                }
              </CardDescription>
            </CardHeader>
          </Card>
          
          {/* AI Assistant */}
          <AIAssistant />
          
          {/* Admin Features */}
          {profile?.permission_lvl && profile.permission_lvl >= 8 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">
                {profile.permission_lvl >= 10 ? "Schulleitung" : "Verwaltung"}
              </h2>
              {renderFeatureCards(adminFeatures)}
            </div>
          )}

          {/* Teacher Features */}
          {profile?.permission_lvl && profile.permission_lvl >= 5 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">
                {profile.permission_lvl >= 8 ? "Lehrkraft-Funktionen" : "Ihre Funktionen"}
              </h2>
              {renderFeatureCards(teacherFeatures)}
            </div>
          )}

          {/* Student/Visitor Features */}
          {profile?.permission_lvl && profile.permission_lvl >= 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">
                {profile.permission_lvl >= 5 ? "Schüler-Funktionen" : profile.permission_lvl > 1 ? "Ihre Funktionen" : "Verfügbare Funktionen"}
              </h2>
              {renderFeatureCards(studentFeatures)}
            </div>
          )}
        </div>
      </main>

      <CreateUserModal 
        isOpen={showCreateUser} 
        onClose={() => setShowCreateUser(false)}
      />
    </div>
  );
};

export default Dashboard;