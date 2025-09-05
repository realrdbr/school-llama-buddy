import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Calendar, Plus, Edit, Trash2, Clock, Bot, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import RoleBasedLayout from '@/components/RoleBasedLayout';
import AIVertretungsGenerator from '@/components/AIVertretungsGenerator';
import DebugVertretungsplan from '@/components/DebugVertretungsplan';
import { EditSubstitutionDialog } from '@/components/EditSubstitutionDialog';
import { useIsMobile } from '@/hooks/use-mobile';

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

const toISODateLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const startOfWeekLocal = (d: Date) => {
  const day = d.getDay(); // 0 Sun, 1 Mon, ...
  const daysToMonday = day === 0 ? 6 : day - 1;
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - daysToMonday);
  return s;
};

const endOfWeekLocal = (start: Date) => {
  const e = new Date(start);
  e.setDate(e.getDate() + 4); // Monday + 4 = Friday
  return e;
};

const formatWeekRange = (start: Date) => {
  const end = endOfWeekLocal(start);
  const startStr = start.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startStr} – ${endStr}`;
};

const Vertretungsplan = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const [substitutions, setSubstitutions] = useState<SubstitutionEntry[]>([]);
  const [schedules, setSchedules] = useState<{ [key: string]: ScheduleEntry[] }>({});
  const [showSubstitutionDialog, setShowSubstitutionDialog] = useState(false);
  const [selectedScheduleEntry, setSelectedScheduleEntry] = useState<{
    class: string;
    day: string; 
    period: number;
    entry: ParsedScheduleEntry;
    targetDate?: string;
    isEdit?: boolean;
    substitutionId?: string;
  } | null>(null);
  const [substitutionData, setSubstitutionData] = useState({
    substituteTeacher: '',
    substituteSubject: '',
    substituteRoom: '',
    note: ''
  });
const [selectedDate, setSelectedDate] = useState(toISODateLocal(new Date()));
  const [selectedClass, setSelectedClass] = useState('10b');

  const handlePrevWeek = () => {
    const cur = new Date(selectedDate + 'T00:00:00');
    const s = startOfWeekLocal(cur);
    s.setDate(s.getDate() - 7);
    setSelectedDate(toISODateLocal(s));
  };

  const handleNextWeek = () => {
    const cur = new Date(selectedDate + 'T00:00:00');
    const s = startOfWeekLocal(cur);
    s.setDate(s.getDate() + 7);
    setSelectedDate(toISODateLocal(s));
  };

  const handleThisWeek = () => {
    setSelectedDate(toISODateLocal(new Date()));
  };

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
    fetchSubstitutions();
  }, [user, profile, navigate, selectedDate]);

  const fetchSubstitutions = async () => {
    try {
      // Get the week range for the selected date
      const selectedDateObj = new Date(selectedDate + 'T00:00:00');
      const dayOfWeek = selectedDateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Calculate start of week (Monday)
      const startOfWeek = new Date(selectedDateObj);
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days
      startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
      
      // Calculate end of range (next Monday, inclusive) to catch cross-week "tomorrow" cases
      const endOfRange = new Date(startOfWeek);
      endOfRange.setDate(endOfRange.getDate() + 7);
      
      const startDateString = toISODateLocal(startOfWeek);
      const endDateString = toISODateLocal(endOfRange);

      console.log('Fetching substitutions for date range:', startDateString, 'to', endDateString);

      const { data, error } = await supabase
        .from('vertretungsplan')
        .select('*')
        .gte('date', startDateString)
        .lte('date', endDateString);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Raw substitution data from database:', data);

      const substitutionData = data.map(sub => ({
        id: sub.id,
        date: sub.date,
        class: (sub.class_name || '').toLowerCase(),
        period: sub.period,
        subject: sub.substitute_subject || sub.original_subject,
        teacher: sub.original_teacher,
        substituteTeacher: sub.substitute_teacher,
        room: sub.substitute_room || sub.original_room,
        note: sub.note
      }));

      console.log('Processed substitution data:', substitutionData);
      setSubstitutions(substitutionData);
    } catch (error) {
      console.error('Error fetching substitutions:', error);
    }
  };

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
    // Get the actual date for this weekday in the selected week
    const selectedDateObj = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = selectedDateObj.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(selectedDateObj);
    startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
    
    const dayMapping = { 'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4 };
    const targetDay = new Date(startOfWeek);
    targetDay.setDate(targetDay.getDate() + dayMapping[day as keyof typeof dayMapping]);
    const targetDateString = toISODateLocal(targetDay);
    
    return substitutions.some(sub => 
      (sub.class || '').toLowerCase() === (classname || '').toLowerCase() && 
      sub.date === targetDateString && 
      sub.period === period
    );
  };

  const getSubstitution = (classname: string, day: string, period: number) => {
    // Get the actual date for this weekday in the selected week
    const selectedDateObj = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = selectedDateObj.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(selectedDateObj);
    startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
    
    const dayMapping = { 'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4 };
    const targetDay = new Date(startOfWeek);
    targetDay.setDate(targetDay.getDate() + dayMapping[day as keyof typeof dayMapping]);
    const targetDateString = toISODateLocal(targetDay);
    
    return substitutions.find(sub => 
      (sub.class || '').toLowerCase() === (classname || '').toLowerCase() && 
      sub.date === targetDateString && 
      sub.period === period
    );
  };

  const handleCellClick = (classname: string, day: string, period: number, entry: ParsedScheduleEntry) => {
    // Calculate the actual date for this specific weekday
    const selectedDateObj = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = selectedDateObj.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(selectedDateObj);
    startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
    
    const dayMapping = { 'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4 };
    const targetDay = new Date(startOfWeek);
    targetDay.setDate(targetDay.getDate() + dayMapping[day as keyof typeof dayMapping]);
    const targetDateString = toISODateLocal(targetDay);
    
    // Check if there's an existing substitution
    const existingSubstitution = getSubstitution(classname, day, period);
    
    if (existingSubstitution) {
      // Edit existing substitution
      setSelectedScheduleEntry({ 
        class: classname, 
        day, 
        period, 
        entry, 
        targetDate: targetDateString,
        isEdit: true,
        substitutionId: existingSubstitution.id
      });
      setSubstitutionData({ 
        substituteTeacher: existingSubstitution.substituteTeacher || '', 
        substituteSubject: existingSubstitution.subject,
        substituteRoom: existingSubstitution.room,
        note: existingSubstitution.note || ''
      });
    } else {
      // Create new substitution
      setSelectedScheduleEntry({ class: classname, day, period, entry, targetDate: targetDateString, isEdit: false });
      setSubstitutionData({ 
        substituteTeacher: '', 
        substituteSubject: entry.subject,
        substituteRoom: entry.room,
        note: '' 
      });
    }
    
    setShowSubstitutionDialog(true);
  };

  const handleCreateSubstitution = async () => {
    if (!selectedScheduleEntry) return;

    const targetDate = selectedScheduleEntry.targetDate || selectedDate;
    
    try {
      if (selectedScheduleEntry.isEdit && selectedScheduleEntry.substitutionId) {
        // Update existing substitution
        const { error } = await supabase
          .from('vertretungsplan')
          .update({
            substitute_teacher: substitutionData.substituteTeacher,
            substitute_subject: substitutionData.substituteSubject,
            substitute_room: substitutionData.substituteRoom,
            note: substitutionData.note
          })
          .eq('id', selectedScheduleEntry.substitutionId);

        if (error) throw error;
        
        toast({
          title: "Vertretung aktualisiert",
          description: "Die Vertretung wurde erfolgreich aktualisiert."
        });
      } else {
        // Create new substitution
        const { error } = await supabase.from('vertretungsplan').insert({
          date: targetDate,
          class_name: selectedScheduleEntry.class,
          period: selectedScheduleEntry.period,
          original_subject: selectedScheduleEntry.entry.subject,
          original_teacher: selectedScheduleEntry.entry.teacher,
          original_room: selectedScheduleEntry.entry.room,
          substitute_teacher: substitutionData.substituteTeacher,
          substitute_subject: substitutionData.substituteSubject,
          substitute_room: substitutionData.substituteRoom,
          note: substitutionData.note
        });

        if (error) throw error;
        
        toast({
          title: "Vertretung erstellt",
          description: "Die Vertretung wurde erfolgreich erstellt."
        });
      }

      // Refresh data and close dialog
      await fetchSubstitutions(startOfWeekLocal(new Date(selectedDate)), endOfWeekLocal(new Date(selectedDate)));
      setShowSubstitutionDialog(false);
      setSelectedScheduleEntry(null);
      
    } catch (error) {
      console.error('Error handling substitution:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Die Vertretung konnte nicht gespeichert werden."
      });
    }
  };

  const handleDeleteSubstitution = async () => {
    if (!selectedScheduleEntry?.substitutionId) return;

    try {
      const { error } = await supabase
        .from('vertretungsplan')
        .delete()
        .eq('id', selectedScheduleEntry.substitutionId);

      if (error) throw error;

      toast({
        title: "Vertretung gelöscht",
        description: "Die Vertretung wurde erfolgreich gelöscht."
      });

      // Refresh data and close dialog
      await fetchSubstitutions(startOfWeekLocal(new Date(selectedDate)), endOfWeekLocal(new Date(selectedDate)));
      setShowSubstitutionDialog(false);
      setSelectedScheduleEntry(null);
      
    } catch (error) {
      console.error('Error deleting substitution:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Die Vertretung konnte nicht gelöscht werden."
      });
  };

  const handleDeleteSubstitution = async () => {
    if (!selectedScheduleEntry?.substitutionId) return;

    try {
      const { error } = await supabase
        .from('vertretungsplan')
        .delete()
        .eq('id', selectedScheduleEntry.substitutionId);

      if (error) throw error;

      toast({
        title: "Vertretung gelöscht",
        description: "Die Vertretung wurde erfolgreich gelöscht."
      });

      // Refresh data and close dialog
      await fetchSubstitutions(startOfWeekLocal(new Date(selectedDate)), endOfWeekLocal(new Date(selectedDate)));
      setShowSubstitutionDialog(false);
      setSelectedScheduleEntry(null);
      
    } catch (error) {
      console.error('Error deleting substitution:', error);
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Die Vertretung konnte nicht gelöscht werden."
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const canEditSubstitutions = profile?.permission_lvl && profile.permission_lvl >= 10;

  // Compute week range info for UI
  const __selectedDateObj = new Date(selectedDate + 'T00:00:00');
  const __weekStart = startOfWeekLocal(__selectedDateObj);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size={isMobile ? "icon" : "sm"} onClick={() => navigate('/')} className="h-10">
                <ArrowLeft className="h-4 w-4" />
                {!isMobile && <span className="ml-2">Zurück zum Dashboard</span>}
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
            {!isMobile && (
              <div className="flex items-end gap-4">
                <div className="flex flex-col items-center">
                  <div className="hidden md:block mb-2 text-center">
                    <Label>Woche</Label>
                    <div className="text-sm text-muted-foreground">{formatWeekRange(__weekStart)}</div>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevWeek}
                      className="relative h-10 w-40"
                    >
                      <ChevronLeft className="absolute left-3 h-4 w-4" />
                      <span className="block w-full text-center">Vorherige Woche</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleThisWeek}
                      className="h-10 w-32"
                    >
                      Diese Woche
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextWeek}
                      className="relative h-10 w-40"
                    >
                      <span className="block w-full text-center">Nächste Woche</span>
                      <ChevronRight className="absolute right-3 h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="class">Klasse</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="w-32 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10b">10b</SelectItem>
                      <SelectItem value="10c">10c</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          
          {/* AI Generator - nur für Schulleitung */}
          <RoleBasedLayout requiredPermission={10}>
            <AIVertretungsGenerator onGenerated={fetchSubstitutions} />
          </RoleBasedLayout>

          {/* Mobile Navigation Controls */}
          {isMobile && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="mobile-class">Klasse</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger className="w-full h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10b">10b</SelectItem>
                        <SelectItem value="10c">10c</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="block mb-2">Woche: {formatWeekRange(__weekStart)}</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevWeek}
                        className="flex-1"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Vorherige
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleThisWeek}
                        className="flex-1"
                      >
                        Diese Woche
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextWeek}
                        className="flex-1"
                      >
                        Nächste
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Schedule Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
Stundenplan {selectedClass} - Woche {formatWeekRange(__weekStart)}
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
                    {(schedules[selectedClass] || []).sort((a, b) => a.period - b.period).map((entry) => (
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
                                {parsedEntries.map((parsed, idx) => {
                                  // Get the actual date for this weekday in the selected week
                                  const selectedDateObj = new Date(selectedDate + 'T00:00:00');
                                  const dayOfWeek = selectedDateObj.getDay();
                                  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                                  const startOfWeek = new Date(selectedDateObj);
                                  startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
                                  
                                  const dayMapping = { 'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4 };
                                  const targetDay = new Date(startOfWeek);
                                  targetDay.setDate(targetDay.getDate() + dayMapping[day as keyof typeof dayMapping]);
                                  
                                  // Check if there's a substitution for this specific date/class/period
                                  const specificSubstitution = substitutions.find(sub => 
                                    (sub.class || '').toLowerCase() === (selectedClass || '').toLowerCase() && 
                                    sub.date === toISODateLocal(targetDay) && 
                                    sub.period === entry.period
                                  );
                                  
                                  return (
                                    <div
                                      key={idx}
                                      className={`p-2 rounded cursor-pointer transition-colors min-h-[60px] flex flex-col justify-center ${
                                        specificSubstitution
                                          ? 'bg-destructive/20 text-destructive border border-destructive/50' 
                                          : canEditSubstitutions
                                          ? 'hover:bg-muted/50'
                                          : 'hover:bg-muted/30'
                                      }`}
                                      onClick={() => canEditSubstitutions && handleCellClick(selectedClass, day, entry.period, parsed)}
                                    >
                                      <div className="text-sm font-medium">
                                        {specificSubstitution ? (specificSubstitution.subject || parsed.subject) : parsed.subject}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {specificSubstitution ? (specificSubstitution.substituteTeacher || 'ENTFALL') : parsed.teacher}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {specificSubstitution ? (specificSubstitution.room || parsed.room) : parsed.room}
                                      </div>
                                      {specificSubstitution?.note && (
                                        <div className="text-xs text-destructive mt-1">
                                          {specificSubstitution.note}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
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

          {/* Active Substitutions List for the whole week */}
          {substitutions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Alle Vertretungen dieser Woche</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {substitutions
                    .sort((a, b) => {
                      // Sort by date first, then by period
                      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
                      return dateCompare !== 0 ? dateCompare : a.period - b.period;
                    })
                    .map((substitution) => {
                      const subDate = new Date(substitution.date);
                      const dayName = subDate.toLocaleDateString('de-DE', { weekday: 'long' });
                      const isToday = substitution.date === toISODateLocal(new Date());
                      
                      return (
                        <div key={substitution.id} className="flex items-center justify-between p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                          <div className="flex items-center gap-4">
                            <span className="font-medium text-sm">{dayName}</span>
                            <span className="font-medium">{substitution.period}. Std</span>
                            <span className="font-medium">{substitution.class}</span>
                            <span>{substitution.subject}</span>
                            <span className="text-muted-foreground">
                              {substitution.teacher} → {substitution.substituteTeacher || 'Entfall'}
                            </span>
                            <span className="text-muted-foreground">{substitution.room}</span>
                            {substitution.note && (
                              <span className="text-xs text-muted-foreground italic">({substitution.note})</span>
                            )}
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
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Debug Component */}
          <DebugVertretungsplan />
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
                <Label htmlFor="substituteSubject">Fach</Label>
                <Input
                  id="substituteSubject"
                  value={substitutionData.substituteSubject}
                  onChange={(e) => setSubstitutionData({...substitutionData, substituteSubject: e.target.value})}
                  placeholder="Fach"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="substituteRoom">Raum</Label>
                <Input
                  id="substituteRoom"
                  value={substitutionData.substituteRoom}
                  onChange={(e) => setSubstitutionData({...substitutionData, substituteRoom: e.target.value})}
                  placeholder="Raum"
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
                {selectedScheduleEntry?.isEdit ? (
                  <>
                    <Button onClick={handleCreateSubstitution}>Änderungen speichern</Button>
                    <Button variant="destructive" onClick={handleDeleteSubstitution}>Vertretung löschen</Button>
                    <Button variant="outline" onClick={() => setShowSubstitutionDialog(false)}>
                      Abbrechen
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={handleCreateSubstitution}>Vertretung erstellen</Button>
                    <Button variant="outline" onClick={() => setShowSubstitutionDialog(false)}>
                      Abbrechen
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vertretungsplan;
