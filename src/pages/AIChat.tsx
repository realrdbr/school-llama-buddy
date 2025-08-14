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
      // Simulate AI response since Ollama might not be running locally
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const assistantResponse = {
        role: 'assistant' as const,
        content: `Hallo ${profile?.name}! Als Benutzer mit Berechtigung Level ${profile?.permission_lvl} kann ich Ihnen bei folgenden Aktionen helfen:

${profile?.permission_lvl && profile.permission_lvl >= 10 ? 
  '• Benutzer erstellen und verwalten\n• Vertretungen erstellen und löschen\n• Ankündigungen bearbeiten\n• Systemeinstellungen ändern' :
  profile?.permission_lvl && profile.permission_lvl >= 9 ?
  '• Vertretungen einsehen\n• Ankündigungen erstellen und bearbeiten\n• Klassen verwalten' :
  '• Stundenplan einsehen\n• Vertretungen anzeigen\n• Ankündigungen lesen'
}

Ihre Anfrage "${currentInput}" wird verarbeitet. Die KI-Integration befindet sich noch in der Entwicklung.`
      };
      
      setConversation(prev => [...prev, assistantResponse]);
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Kontaktieren der KI",
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