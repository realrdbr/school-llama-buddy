import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BookOpen, Users, Calendar, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ClassInfo {
  name: string;
  students: number;
  classTeacher: string;
  room: string;
  subjects: string[];
}

const Klassenverwaltung = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [classes, setClasses] = useState<ClassInfo[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (profile && profile.permission_lvl < 5) {
      toast({
        variant: "destructive",
        title: "Zugriff verweigert",
        description: "Sie haben keine Berechtigung für die Klassenverwaltung."
      });
      navigate('/');
      return;
    }
    
    // Sample data
    setClasses([
      {
        name: '10b_A',
        students: 24,
        classTeacher: 'Frau Kunadt',
        room: 'R201',
        subjects: ['Mathematik', 'Deutsch', 'Englisch', 'Geschichte', 'Biologie', 'Physik']
      },
      {
        name: '10c_A',
        students: 22,
        classTeacher: 'Herr König',
        room: 'R205',
        subjects: ['Mathematik', 'Deutsch', 'Englisch', 'Geographie', 'Chemie', 'Sport']
      },
      {
        name: '9a',
        students: 26,
        classTeacher: 'Herr Schmidt',
        room: 'R103',
        subjects: ['Mathematik', 'Deutsch', 'Englisch', 'Geschichte', 'Biologie']
      }
    ]);
  }, [user, profile, navigate]);

  const navigateToSchedule = (className: string) => {
    if (className === '10b_A' || className === '10c_A') {
      navigate('/stundenplan');
    } else {
      toast({
        title: "Stundenplan nicht verfügbar",
        description: `Für die Klasse ${className} ist noch kein Stundenplan hinterlegt.`
      });
    }
  };

  const canEditClasses = profile?.permission_lvl && profile.permission_lvl >= 8;

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
                <BookOpen className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Klassenverwaltung</h1>
                  <p className="text-muted-foreground">Klassen und Stundenpläne verwalten</p>
                </div>
              </div>
            </div>
            {canEditClasses && (
              <Button>
                <Settings className="h-4 w-4 mr-2" />
                Klassen bearbeiten
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Klassen gesamt</p>
                    <p className="text-2xl font-bold">{classes.length}</p>
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
                    <p className="text-sm text-muted-foreground">Schüler gesamt</p>
                    <p className="text-2xl font-bold">{classes.reduce((sum, cls) => sum + cls.students, 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Calendar className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Stundenpläne</p>
                    <p className="text-2xl font-bold">2</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Classes Grid */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Alle Klassen</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map((classInfo) => (
                <Card key={classInfo.name} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Klasse {classInfo.name}
                      </CardTitle>
                      {(classInfo.name === '10b_A' || classInfo.name === '10c_A') && (
                        <Badge variant="secondary">Stundenplan verfügbar</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Schüler</p>
                        <p className="font-medium">{classInfo.students}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Raum</p>
                        <p className="font-medium">{classInfo.room}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Klassenlehrer</p>
                      <p className="font-medium">{classInfo.classTeacher}</p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Fächer</p>
                      <div className="flex flex-wrap gap-1">
                        {classInfo.subjects.map((subject) => (
                          <Badge key={subject} variant="outline" className="text-xs">
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button 
                        size="sm" 
                        onClick={() => navigateToSchedule(classInfo.name)}
                        className="flex-1"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Stundenplan
                      </Button>
                      {canEditClasses && (
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Schnellzugriff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  onClick={() => navigate('/stundenplan')}
                >
                  <Calendar className="h-6 w-6 mb-2" />
                  Alle Stundenpläne
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  onClick={() => navigate('/vertretungsplan')}
                >
                  <BookOpen className="h-6 w-6 mb-2" />
                  Vertretungsplan
                </Button>
                <Button 
                  variant="outline" 
                  className="h-20 flex-col"
                  onClick={() => navigate('/announcements')}
                >
                  <Users className="h-6 w-6 mb-2" />
                  Ankündigungen
                </Button>
                {canEditClasses && (
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col"
                    onClick={() => navigate('/user-management')}
                  >
                    <Settings className="h-6 w-6 mb-2" />
                    Benutzerverwaltung
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Klassenverwaltung;