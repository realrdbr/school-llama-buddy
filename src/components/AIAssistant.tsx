import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Bot } from 'lucide-react';

const AIAssistant = () => {
  const [input, setInput] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Navigate to chat page with the initial message
    navigate('/ai-chat', { state: { initialMessage: input } });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">KI-Assistent</h3>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Frage mich etwas oder bitte mich, eine Aktion durchzuführen..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim()}>
            <Send className="h-4 w-4" />
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