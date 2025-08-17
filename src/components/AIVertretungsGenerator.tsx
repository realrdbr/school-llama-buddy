import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bot, Zap, Users, Calendar, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface AIVertretungsGeneratorProps {
  onGenerated?: () => void;
}

interface SubstitutionPlan {
  date: string;
  teacher: string;
  affectedLessons: Array<{
    className: string;
    period: number;
    subject: string;
    room: string;
    substitute?: string;
  }>;
}

const AIVertretungsGenerator = ({ onGenerated }: AIVertretungsGeneratorProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [selectedTeacher, setSelectedTeacher] = useState('König');
  const [selectedDate, setSelectedDate] = useState('morgen');
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [proposedPlan, setProposedPlan] = useState<SubstitutionPlan | null>(null);

  const teacherOptions = [
    'König', 'Müller', 'Schmidt', 'Weber', 'Hansen', 'Fischer', 'Meyer', 'Wagner'
  ];

  const dateOptions = [
    { value: 'heute', label: 'Heute' },
    { value: 'morgen', label: 'Morgen' },
    { value: 'übermorgen', label: 'Übermorgen' },
    { value: 'montag', label: 'Nächster Montag' },
    { value: 'dienstag', label: 'Nächster Dienstag' },
    { value: 'mittwoch', label: 'Nächster Mittwoch' },
    { value: 'donnerstag', label: 'Nächster Donnerstag' },
    { value: 'freitag', label: 'Nächster Freitag' }
  ];

  const calculateTargetDate = (dateOption: string) => {
    const now = new Date();
    let targetDate = new Date(now);
    
    if (dateOption === 'heute') {
      // heute
    } else if (dateOption === 'morgen') {
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (dateOption === 'übermorgen') {
      targetDate.setDate(targetDate.getDate() + 2);
    } else {
      const map: Record<string, number> = { montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5 };
      const targetDow = map[dateOption];
      const todayDow = targetDate.getDay(); // 0..6
      const todayMap: Record<number, number> = { 0: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
      const cur = todayMap[todayDow];
      let diff = targetDow - cur;
      if (diff < 0) diff += 7;
      if (diff === 0) diff = 7; // wenn gleicher Tag genannt, nimm nächste Woche
      targetDate.setDate(targetDate.getDate() + diff);
    }
    
    return new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).toISOString().split('T')[0];
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const targetDate = calculateTargetDate(selectedDate);
      
      const { data, error } = await supabase.functions.invoke('ai-actions', {
        body: {
          action: 'plan_substitution',
          parameters: {
            teacherName: selectedTeacher,
            date: targetDate
          },
          userProfile: {
            user_id: profile?.id,
            name: profile?.name || profile?.username,
            permission_lvl: profile?.permission_lvl
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        const result = data.result;
        
        // Create proposed plan for confirmation
        setProposedPlan({
          date: targetDate,
          teacher: selectedTeacher,
          affectedLessons: result.affectedLessons || []
        });
        
        setShowConfirmation(true);
        
        toast({
          title: 'Vertretungsplan erstellt',
          description: 'Bitte überprüfen Sie den Plan vor der Bestätigung.'
        });
      } else {
        throw new Error(data.result.error);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!proposedPlan) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-actions', {
        body: {
          action: 'confirm_substitution',
          parameters: {
            teacherName: proposedPlan.teacher,
            date: proposedPlan.date
          },
          userProfile: {
            user_id: profile?.id,
            name: profile?.name || profile?.username,
            permission_lvl: profile?.permission_lvl
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Vertretungsplan bestätigt',
          description: 'Der Vertretungsplan wurde erfolgreich erstellt und gespeichert.'
        });
        
        setShowConfirmation(false);
        setProposedPlan(null);
        onGenerated?.();
      } else {
        throw new Error(data.result.error);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error.message
      });
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Vertretungsplan Generator
            <Badge variant="secondary" className="ml-2">
              <Zap className="h-3 w-3 mr-1" />
              Beta
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selection Interface */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Abwesende Lehrkraft</label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger>
                  <SelectValue placeholder="Lehrkraft auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {teacherOptions.map((teacher) => (
                    <SelectItem key={teacher} value={teacher}>
                      Herr/Frau {teacher}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Datum der Abwesenheit</label>
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger>
                  <SelectValue placeholder="Datum auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {dateOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerate} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Bot className="h-4 w-4 mr-2 animate-spin" />
                AI generiert Vertretungsplan...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Vertretungsplan generieren
              </>
            )}
          </Button>

          {/* Info */}
          <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
            <Calendar className="h-3 w-3 inline mr-1" />
            Die AI analysiert verfügbare Lehrer, Räume und erstellt automatisch passende Vertretungen.
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Vertretungsplan bestätigen
            </DialogTitle>
          </DialogHeader>
          
          {proposedPlan && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="font-medium mb-2">
                  Abwesenheit: Herr/Frau {proposedPlan.teacher}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Datum: {new Date(proposedPlan.date).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              {proposedPlan.affectedLessons && proposedPlan.affectedLessons.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Betroffene Stunden:</h4>
                  <div className="space-y-2">
                    {proposedPlan.affectedLessons.map((lesson, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                        <div>
                          <span className="font-medium">{lesson.className}</span>
                          <span className="text-muted-foreground ml-2">
                            {lesson.period}. Stunde - {lesson.subject} (Raum {lesson.room})
                          </span>
                        </div>
                        {lesson.substitute && (
                          <Badge variant="secondary">
                            Vertretung: {lesson.substitute}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1"
                >
                  Abbrechen
                </Button>
                <Button 
                  onClick={handleConfirm}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Bestätigen und Speichern
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AIVertretungsGenerator;