import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Bot, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const AIChat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [input, setInput] = useState(location.state?.initialMessage || '');
  const [conversation, setConversation] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user' as const, content: input };
    setConversation(prev => [...prev, userMessage]);
    setIsLoading(true);
    const currentInput = input;
    setInput('');

    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3.1:8b',
          messages: [
            {
              role: 'system',
              content: `Du bist ein KI-Assistent für ein Schulmanagementsystem. Der Benutzer "${profile?.name}" hat Berechtigung Level ${profile?.permission_lvl}.

BERECHTIGUNGSLEVEL-SYSTEM:
- Level 1-3: SCHÜLER (können nur Stundenpläne, Vertretungen und Ankündigungen einsehen)
- Level 4-8: LEHRKRÄFTE (können Ankündigungen erstellen/bearbeiten, Vertretungen einsehen)
- Level 9: KOORDINATION/STELLVERTRETUNG (können Vertretungen erstellen/bearbeiten, Klassen verwalten)
- Level 10: SCHULLEITUNG/ADMIN (können Benutzer verwalten, alle Systemeinstellungen ändern)

WICHTIGE REGELN:
1. ERFINDE NIEMALS Daten! Du hast keinen Zugriff auf die echte Datenbank.
2. Gib NIEMALS vor, spezifische Vertretungen, Termine oder Personen zu kennen.
3. Bei Fragen zu aktuellen Daten sage: "Für aktuelle Informationen schauen Sie bitte direkt in den entsprechenden Bereich der Anwendung."
4. Du kannst nur über die Funktionen der App sprechen, nicht über spezifische Inhalte.

VERFÜGBARE FUNKTIONEN für Level ${profile?.permission_lvl}:
${profile?.permission_lvl && profile.permission_lvl >= 10 ? 
  '- Benutzer erstellen und verwalten\n- Alle Systemeinstellungen\n- Vertretungen verwalten\n- Ankündigungen verwalten' :
  profile?.permission_lvl && profile.permission_lvl >= 9 ?
  '- Vertretungen erstellen und bearbeiten\n- Ankündigungen verwalten\n- Klassenverwaltung' :
  profile?.permission_lvl && profile.permission_lvl >= 4 ?
  '- Ankündigungen erstellen und bearbeiten\n- Vertretungen einsehen\n- Stundenplan einsehen' :
  '- Stundenplan einsehen\n- Vertretungen anzeigen\n- Ankündigungen lesen'
}

Antworte auf Deutsch und erkläre nur die verfügbaren Funktionen der App.`
            },
            ...conversation,
            { role: 'user', content: currentInput }
          ],
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const assistantResponse = {
        role: 'assistant' as const,
        content: data.message.content
      };
      
      setConversation(prev => [...prev, assistantResponse]);
    } catch (error) {
      console.error('Ollama error:', error);
      toast({
        title: "Fehler",
        description: "Ollama-Server nicht erreichbar. Stellen Sie sicher, dass Ollama läuft und das Modell 'llama3.1:8b' installiert ist.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Button>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">KI-Assistent</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Conversation */}
          <Card className="min-h-[500px]">
            <CardHeader>
              <CardTitle>Chat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {conversation.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Willkommen beim KI-Assistenten</h3>
                  <p>Stellen Sie eine Frage oder bitten Sie mich, eine Aktion durchzuführen.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {conversation.map((message, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground ml-8'
                          : 'bg-muted mr-8'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-2 p-4 bg-muted mr-8 rounded-lg">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>KI denkt nach...</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Input */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  placeholder="Stellen Sie hier Ihre Frage oder bitten Sie um eine Aktion..."
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AIChat;