import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Bot, Zap, Users, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface AIVertretungsGeneratorProps {
  onGenerated?: () => void;
}

const AIVertretungsGenerator = ({ onGenerated }: AIVertretungsGeneratorProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const promptExamples = [
    "Herr König ist morgen krank - generiere Vertretungsplan für Klasse 10b",
    "Frau Müller übernimmt alle Mathe-Stunden von Herrn Schmidt diese Woche",
    "Raum 201 ist gesperrt - finde alternative Räume für alle Stunden",
    "Erstelle Vertretungsplan für nächste Woche - Herr Weber ist im Urlaub"
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        variant: "destructive",
        title: "Eingabe erforderlich",
        description: "Bitte geben Sie eine Anweisung für die AI ein."
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-actions', {
        body: {
          action: 'plan_substitution',
          parameters: {
            teacherName: prompt,
            date: 'today'
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
        toast({
          title: 'Vertretungsplanung',
          description: result.message || 'Planung abgeschlossen.'
        });
        setSuggestions(result.confirmations || result.suggestions || []);
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
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  return (
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
        {/* Prompt Examples */}
        <div>
          <h4 className="text-sm font-medium mb-2">Beispiele:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {promptExamples.map((example, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-left justify-start h-auto p-2 text-xs"
                onClick={() => handleExampleClick(example)}
              >
                {example}
              </Button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Beschreiben Sie die Vertretungssituation... (z.B. 'Herr König fällt morgen aus, Klasse 10b braucht Vertretung')"
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Generate Button */}
        <Button 
          onClick={handleGenerate} 
          disabled={loading || !prompt.trim()}
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

        {/* AI Suggestions */}
        {suggestions.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              AI Vorschläge:
            </h4>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="p-2 bg-muted rounded text-sm">
                  {suggestion}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
          <Calendar className="h-3 w-3 inline mr-1" />
          Die AI analysiert verfügbare Lehrer, Räume und erstellt automatisch passende Vertretungen.
        </div>
      </CardContent>
    </Card>
  );
};

export default AIVertretungsGenerator;