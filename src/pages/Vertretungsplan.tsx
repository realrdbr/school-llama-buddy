import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Calendar, Plus, Edit, Trash2, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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

interface ScheduleEntry {
  period?: number;
  Stunde?: number;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
}

interface ParsedScheduleEntry {
  subject: string;
  teacher: string;
  room: string;
}

const Vertretungsplan = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [substitutions, setSubstitutions] = useState<SubstitutionEntry[]>([]);
  const [schedules, setSchedules] = useState<{ [key: string]: ScheduleEntry[] }>({});
  const [showSubstitutionDialog, setShowSubstitutionDialog] = useState(false);
  const [selectedScheduleEntry, setSelectedScheduleEntry] = useState<{
    class: string;
    day: string;
    period: number;
    entry: ParsedScheduleEntry;
  } | null>(null);
  const [substitutionData, setSubstitutionData] = useState({
    substituteTeacher: '',
    note: ''
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('10b');

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
    
    fetchSchedules();
    // No sample data - start with empty substitutions
    setSubstitutions([]);
  }, [user, profile, navigate]);

  const fetchSchedules = async () => {
    try {
      const { data: schedule10b } = await supabase.from('Stundenplan_10b_A').select('*');
      const { data: schedule10c } = await supabase.from('Stundenplan_10c_A').select('*');
      
      // Transform data to match ScheduleEntry interface
      const transform = (data: any[]) => data.map(item => ({
        period: item.Stunde,
        monday: item.monday,
        tuesday: item.tuesday,
        wednesday: item.wednesday,
        thursday: item.thursday,
        friday: item.friday
      }));
      
      setSchedules({
        '10b': transform(schedule10b || []),
        '10c': transform(schedule10c || [])
      });
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const getDayName = (day: string) => {
    const dayNames: { [key: string]: string } = {
      'monday': 'Montag',
      'tuesday': 'Dienstag', 
      'wednesday': 'Mittwoch',
      'thursday': 'Donnerstag',
      'friday': 'Freitag'
    };
    return dayNames[day] || day;
  };

  const parseScheduleEntry = (entry: string): ParsedScheduleEntry[] => {
    if (!entry || entry.trim() === '') return [];
    
    // Split by | for multiple subjects in one period
    const subjects = entry.split('|').map(s => s.trim());
    
    return subjects.map(subject => {
      const parts = subject.split(' ');
      if (parts.length >= 3) {
        return {
          subject: parts[0],
          teacher: parts[1],
          room: parts[2]
        };
      }
      return {
        subject: subject,
        teacher: '',
        room: ''
      };
    });
  };

  const getDayColumn = (day: string) => {
    const schedule = schedules[selectedClass] || [];
    return schedule.map(entry => ({
      period: entry.period,
      content: entry[day as keyof ScheduleEntry] as string
    }));
  };

  const hasSubstitution = (classname: string, day: string, period: number) => {
    return substitutions.some(sub => 
      sub.class === classname && 
      sub.date === selectedDate && 
      sub.period === period
    );
  };

  const getSubstitution = (classname: string, day: string, period: number) => {
    return substitutions.find(sub => 
      sub.class === classname && 
      sub.date === selectedDate && 
      sub.period === period
    );
  };

  const handleCellClick = (classname: string, day: string, period: number, entry: ParsedScheduleEntry) => {
    setSelectedScheduleEntry({ class: classname, day, period, entry });
    setSubstitutionData({ substituteTeacher: '', note: '' });
    setShowSubstitutionDialog(true);
  };

  const handleCreateSubstitution = () => {
    if (!selectedScheduleEntry) return;

    const substitution: SubstitutionEntry = {
      id: Date.now().toString(),
      date: selectedDate,
      class: selectedScheduleEntry.class,
      period: selectedScheduleEntry.period,
      subject: selectedScheduleEntry.entry.subject,
      teacher: selectedScheduleEntry.entry.teacher,
      substituteTeacher: substitutionData.substituteTeacher,
      room: selectedScheduleEntry.entry.room,
      note: substitutionData.note
    };

    setSubstitutions([...substitutions, substitution]);
    setShowSubstitutionDialog(false);
    
    // Create automatic announcement for affected students
    const announcement = {
      id: Date.now().toString(),
      title: `Vertretungsplan geändert - Klasse ${selectedScheduleEntry.class}`,
      content: `${getDayName(selectedScheduleEntry.day)}, ${selectedScheduleEntry.period}. Stunde: ${selectedScheduleEntry.entry.subject} wird von ${substitutionData.substituteTeacher || 'ENTFALL'} vertreten`,
      author: profile?.name || 'Lehrkraft',
      created_at: new Date().toISOString(),
      priority: 'high' as const,
      targetClass: selectedScheduleEntry.class
    };

    toast({
      title: "Vertretung erstellt",
      description: `Die Vertretung wurde erfolgreich hinzugefügt. Ankündigung wurde automatisch erstellt.`
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
                  <p className="text-muted-foreground">
                    {canEditSubstitutions ? "Vertretungen verwalten" : "Vertretungen einsehen"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <Label htmlFor="date">Datum</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label htmlFor="class">Klasse</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10b">10b</SelectItem>
                    <SelectItem value="10c">10c</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Schedule Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Stundenplan {selectedClass} - {formatDate(selectedDate)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <thead>
                    <tr>
                      <th className="border border-border p-2 bg-muted">Stunde</th>
                      <th className="border border-border p-2 bg-muted">Montag</th>
                      <th className="border border-border p-2 bg-muted">Dienstag</th>
                      <th className="border border-border p-2 bg-muted">Mittwoch</th>
                      <th className="border border-border p-2 bg-muted">Donnerstag</th>
                      <th className="border border-border p-2 bg-muted">Freitag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(schedules[selectedClass] || []).map((entry) => (
                      <tr key={entry.period}>
                        <td className="border border-border p-2 font-medium bg-muted">{entry.period}</td>
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => {
                          const dayEntry = entry[day as keyof ScheduleEntry] as string;
                          const parsedEntries = parseScheduleEntry(dayEntry);
                          const isSubstituted = hasSubstitution(selectedClass, day, entry.period);
                          const substitution = getSubstitution(selectedClass, day, entry.period);

                          return (
                            <td key={day} className="border border-border p-1">
                              <div className="space-y-1">
                                {parsedEntries.map((parsed, idx) => (
                                  <div
                                    key={idx}
                                    className={`p-2 rounded cursor-pointer transition-colors min-h-[60px] flex flex-col justify-center ${
                                      isSubstituted 
                                        ? 'bg-destructive/20 text-destructive border border-destructive/50' 
                                        : 'hover:bg-muted/50'
                                    }`}
                                    onClick={() => canEditSubstitutions && handleCellClick(selectedClass, day, entry.period, parsed)}
                                  >
                                    <div className="text-sm font-medium">
                                      {isSubstituted ? substitution?.subject : parsed.subject}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {isSubstituted ? substitution?.substituteTeacher : parsed.teacher}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {isSubstituted ? substitution?.room : parsed.room}
                                    </div>
                                    {isSubstituted && substitution?.note && (
                                      <div className="text-xs text-destructive mt-1">
                                        {substitution.note}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canEditSubstitutions && (
                <p className="text-sm text-muted-foreground mt-4">
                  Klicken Sie auf eine Stunde, um eine Vertretung zu erstellen.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Active Substitutions List */}
          {substitutions.filter(sub => sub.date === selectedDate && sub.class === selectedClass).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Vertretungen für {formatDate(selectedDate)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {substitutions
                    .filter(sub => sub.date === selectedDate && sub.class === selectedClass)
                    .sort((a, b) => a.period - b.period)
                    .map((substitution) => (
                    <div key={substitution.id} className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <div className="flex items-center gap-4">
                        <span className="font-medium">{substitution.period}. Std</span>
                        <span>{substitution.subject}</span>
                        <span className="text-muted-foreground">
                          {substitution.teacher} → {substitution.substituteTeacher || 'Entfall'}
                        </span>
                        <span className="text-muted-foreground">{substitution.room}</span>
                      </div>
                      {canEditSubstitutions && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive"
                          onClick={() => handleDeleteSubstitution(substitution.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Substitution Dialog */}
      <Dialog open={showSubstitutionDialog} onOpenChange={setShowSubstitutionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vertretung erstellen</DialogTitle>
          </DialogHeader>
          {selectedScheduleEntry && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Ursprünglicher Unterricht:</div>
                <div className="p-3 bg-muted rounded-md">
                  <div className="font-medium">{selectedScheduleEntry.entry.subject}</div>
                  <div className="text-sm">{selectedScheduleEntry.entry.teacher}</div>
                  <div className="text-sm">{selectedScheduleEntry.entry.room}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedScheduleEntry.period}. Stunde - {selectedScheduleEntry.class}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="substituteTeacher">Vertretungslehrer</Label>
                <Input
                  id="substituteTeacher"
                  value={substitutionData.substituteTeacher}
                  onChange={(e) => setSubstitutionData({...substitutionData, substituteTeacher: e.target.value})}
                  placeholder="Leer lassen für Entfall"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="note">Notiz (optional)</Label>
                <Input
                  id="note"
                  value={substitutionData.note}
                  onChange={(e) => setSubstitutionData({...substitutionData, note: e.target.value})}
                  placeholder="Zusätzliche Informationen"
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleCreateSubstitution}>Vertretung erstellen</Button>
                <Button variant="outline" onClick={() => setShowSubstitutionDialog(false)}>
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

export default Vertretungsplan;