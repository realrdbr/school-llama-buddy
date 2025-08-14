import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
  const [schedule10bA, setSchedule10bA] = useState<ScheduleEntry[]>([]);
  const [schedule10cA, setSchedule10cA] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchSchedules();
  }, [user, navigate]);

  const fetchSchedules = async () => {
    try {
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
        setSchedule10bA(data10bA || []);
        setSchedule10cA(data10cA || []);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
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
                {dayKeys.map((day) => (
                  <td key={day} className="border border-border p-3">
                    {entry[day] || '-'}
                  </td>
                ))}
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
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Class 10b_A */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Klasse 10b_A
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedule10bA.length > 0 ? (
                renderScheduleTable(schedule10bA, "10b_A")
              ) : (
                <p className="text-muted-foreground">Kein Stundenplan verfügbar.</p>
              )}
            </CardContent>
          </Card>

          {/* Class 10c_A */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Klasse 10c_A
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedule10cA.length > 0 ? (
                renderScheduleTable(schedule10cA, "10c_A")
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