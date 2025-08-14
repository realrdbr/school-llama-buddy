import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Loader2, Bot } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const AIAssistant = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { profile } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    const userInput = input;
    setInput('');

    try {
      // Call local Ollama API with llama3.1:8b
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3.1:8b',
          prompt: `Du bist ein KI-Assistent für ein Schulsystem. Der Benutzer "${profile?.name}" (Username: ${profile?.username}) hat Berechtigung Level ${profile?.permission_lvl} (10=Schulleitung, 9=Lehrer, 1=Schüler/Gast).

Verfügbare Aktionen je nach Berechtigung:
- Level 10 (Schulleitung): Kann alles - Benutzer erstellen, Vertretungen erstellen/löschen, Ankündigungen erstellen/bearbeiten, Klassen verwalten, Einstellungen ändern
- Level 9 (Lehrer): Kann Vertretungen einsehen, Ankündigungen erstellen/bearbeiten, Klassen verwalten
- Level 1 (Schüler/Gast): Kann nur Stundenplan, Vertretungen und Ankündigungen einsehen

Anfrage: "${userInput}"

Prüfe, ob diese Aktion erlaubt ist für Level ${profile?.permission_lvl}. Antworte auf Deutsch und kurz. Falls erlaubt, erkläre was gemacht werden würde. Falls nicht erlaubt, erkläre warum nicht.`,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error('Lokale KI nicht verfügbar. Stelle sicher, dass Ollama läuft und llama3.1:8b installiert ist.');
      }

      const data = await response.json();
      
      toast({
        title: "KI-Assistent",
        description: data.response,
      });

    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Fehler beim Kontaktieren der lokalen KI",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">KI-Assistent (llama3.1:8b)</h3>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Frage mich etwas oder bitte mich, eine Aktion durchzuführen..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim() || isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          Die KI prüft automatisch deine Berechtigung und führt erlaubte Aktionen aus.
        </p>
      </CardContent>
    </Card>
  );
};

export default AIAssistant;