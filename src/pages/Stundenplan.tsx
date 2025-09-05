import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, RefreshCw, Wifi } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { OfflineIndicator } from '@/components/OfflineIndicator';

interface ScheduleEntry {
  Stunde: number;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
}

const Stundenplan = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const { isOnline } = useNetworkStatus();
  const { saveData, getData } = useOfflineStorage();
  const [schedule10bA, setSchedule10bA] = useState<ScheduleEntry[]>([]);
  const [schedule10cA, setSchedule10cA] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadScheduleData();

    // Handle scroll to specific class
    const scrollToClass = searchParams.get('scrollTo');
    if (scrollToClass) {
      setTimeout(() => {
        const element = document.getElementById(`schedule-${scrollToClass}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    }
  }, [user, navigate, searchParams]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && lastSyncTime) {
      const timeSinceLastSync = Date.now() - lastSyncTime.getTime();
      if (timeSinceLastSync > 5 * 60 * 1000) { // 5 minutes
        fetchSchedules();
      }
    }
  }, [isOnline]);

  const loadScheduleData = async () => {
    // Try to load from cache first
    const cached10b = await getData('schedule_10b');
    const cached10c = await getData('schedule_10c');
    
    if (cached10b) setSchedule10bA(cached10b);
    if (cached10c) setSchedule10cA(cached10c);
    
    // If we have cached data, show it immediately
    if (cached10b || cached10c) {
      setLoading(false);
    }
    
    // Then fetch fresh data if online
    if (isOnline) {
      await fetchSchedules();
    } else if (!cached10b && !cached10c) {
      setLoading(false);
      toast({
        title: "Offline-Modus",
        description: "Stundenpläne werden geladen wenn eine Internetverbindung besteht."
      });
    }
  };

  const fetchSchedules = async () => {
    if (!isOnline) return;
    
    try {
      setLoading(true);
      
      // Fetch 10b_A schedule
      const { data: data10bA, error: error10bA } = await supabase
        .from('Stundenplan_10b_A')
        .select('*')
        .order('Stunde');

      // Fetch 10c_A schedule  
      const { data: data10cA, error: error10cA } = await supabase
        .from('Stundenplan_10c_A')
        .select('*')
        .order('Stunde');

      if (error10bA || error10cA) {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Stundenplan konnte nicht geladen werden."
        });
      } else {
        const scheduleData10b = data10bA || [];
        const scheduleData10c = data10cA || [];
        
        setSchedule10bA(scheduleData10b);
        setSchedule10cA(scheduleData10c);
        
        // Cache the data for offline use
        await saveData('schedule_10b', scheduleData10b, 24 * 60); // 24 hours
        await saveData('schedule_10c', scheduleData10c, 24 * 60);
        
        setLastSyncTime(new Date());
        
        if (isOnline) {
          toast({
            title: "Daten aktualisiert",
            description: "Stundenpläne wurden erfolgreich synchronisiert."
          });
        }
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast({
        variant: "destructive", 
        title: "Fehler",
        description: "Verbindung zum Server fehlgeschlagen."
      });
    } finally {
      setLoading(false);
    }
  };

  const parseScheduleEntry = (entry: string) => {
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

  const renderScheduleTable = (schedule: ScheduleEntry[], className: string) => {
    const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-border">
          <thead>
            <tr className="bg-muted">
              <th className="border border-border p-3 text-left font-semibold">Stunde</th>
              {days.map((day) => (
                <th key={day} className="border border-border p-3 text-left font-semibold">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.map((entry) => (
              <tr key={entry.Stunde} className="hover:bg-muted/50">
                <td className="border border-border p-3 font-medium">
                  {entry.Stunde}. Stunde
                </td>
                {dayKeys.map((day) => {
                  const dayEntry = entry[day];
                  const parsedEntries = parseScheduleEntry(dayEntry);

                  return (
                    <td key={day} className="border border-border p-2">
                      <div className="space-y-1">
                         {parsedEntries.length > 0 ? (
                           parsedEntries.length > 1 ? (
                             <div className="grid grid-cols-2 gap-1">
                               {parsedEntries.map((parsed, idx) => (
                                 <div key={idx} className="p-2 bg-muted/30 rounded text-xs border">
                                   <div className="font-medium">{parsed.subject}</div>
                                   <div className="text-muted-foreground">{parsed.teacher}</div>
                                   <div className="text-muted-foreground">{parsed.room}</div>
                                 </div>
                               ))}
                             </div>
                           ) : (
                             <div className="p-2 bg-muted/30 rounded text-sm">
                               <div className="font-medium">{parsedEntries[0].subject}</div>
                               <div className="text-muted-foreground">{parsedEntries[0].teacher}</div>
                               <div className="text-muted-foreground">{parsedEntries[0].room}</div>
                             </div>
                           )
                         ) : (
                           <div className="text-center text-muted-foreground">-</div>
                         )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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
                  <h1 className="text-2xl font-bold text-foreground">Stundenplan</h1>
                  <p className="text-muted-foreground">Aktuelle Stundenpläne</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {lastSyncTime && (
                <span className="text-sm text-muted-foreground">
                  Aktualisiert: {lastSyncTime.toLocaleTimeString()}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSchedules}
                disabled={!isOnline || loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Wird geladen...' : 'Aktualisieren'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <OfflineIndicator />
        
        <div className="space-y-8">
          {/* Class 10b */}
          <Card id="schedule-10b">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Klasse 10b
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedule10bA.length > 0 ? (
                renderScheduleTable(schedule10bA, "10b")
              ) : (
                <p className="text-muted-foreground">Kein Stundenplan verfügbar.</p>
              )}
            </CardContent>
          </Card>

          {/* Class 10c */}
          <Card id="schedule-10c">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Klasse 10c
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedule10cA.length > 0 ? (
                renderScheduleTable(schedule10cA, "10c")
              ) : (
                <p className="text-muted-foreground">Kein Stundenplan verfügbar.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Stundenplan;