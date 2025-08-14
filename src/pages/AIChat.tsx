import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Bot, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ChatSidebar from '@/components/ChatSidebar';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AIChat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [input, setInput] = useState(location.state?.initialMessage || '');
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  // Load conversation when selected
  const loadConversation = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setConversation((data || []) as ChatMessage[]);
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast({
        title: "Fehler",
        description: "Chat konnte nicht geladen werden",
        variant: "destructive"
      });
    }
  };

  // Save message to database
  const saveMessage = async (message: ChatMessage, conversationId: string) => {
    try {
      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: message.role,
          content: message.content
        });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  // Create new conversation
  const createNewConversation = async (firstMessage: string) => {
    if (!profile?.id) return null;

    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: profile.id.toString(),
          title: firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '')
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user' as const, content: input };
    setConversation(prev => [...prev, userMessage]);
    setIsLoading(true);
    const currentInput = input;
    setInput('');

    // Create conversation if it doesn't exist
    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = await createNewConversation(currentInput);
      if (conversationId) {
        setCurrentConversationId(conversationId);
      }
    }

    // Save user message
    if (conversationId) {
      await saveMessage(userMessage, conversationId);
    }

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

VERFÜGBARE AKTIONEN für Level ${profile?.permission_lvl}:
${profile?.permission_lvl && profile.permission_lvl >= 10 ? 
  '- CREATE_USER: Benutzer erstellen (Parameter: email, password, username, fullName, permissionLevel)\n- UPDATE_VERTRETUNGSPLAN: Vertretung erstellen (Parameter: date, className, period, originalTeacher, originalSubject, originalRoom, substituteTeacher, substituteSubject, substituteRoom, note)\n- CREATE_ANNOUNCEMENT: Ankündigung erstellen (Parameter: title, content, priority, targetClass, targetPermissionLevel)' :
  profile?.permission_lvl && profile.permission_lvl >= 9 ?
  '- UPDATE_VERTRETUNGSPLAN: Vertretung erstellen (Parameter: date, className, period, originalTeacher, originalSubject, originalRoom, substituteTeacher, substituteSubject, substituteRoom, note)\n- CREATE_ANNOUNCEMENT: Ankündigung erstellen (Parameter: title, content, priority, targetClass, targetPermissionLevel)' :
  profile?.permission_lvl && profile.permission_lvl >= 4 ?
  '- CREATE_ANNOUNCEMENT: Ankündigung erstellen (Parameter: title, content, priority, targetClass, targetPermissionLevel)' :
  'Keine Aktionen verfügbar'
}

WICHTIGE REGELN:
1. Du kannst ECHTE AKTIONEN ausführen! Wenn ein Benutzer eine Aktion anfordert, führe sie aus.
2. Wenn du eine Aktion ausführen sollst, antworte mit: "AKTION:[ACTION_NAME]|PARAMETER1:wert1|PARAMETER2:wert2|..."
3. Beispiel: "AKTION:CREATE_ANNOUNCEMENT|title:Wichtiger Hinweis|content:Morgen ist schulfrei|priority:high"
4. Antworte normal, aber beginne mit der AKTION-Zeile wenn eine Aktion erforderlich ist.

Antworte auf Deutsch und führe die angeforderten Aktionen aus.`
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
      let assistantContent = data.message.content;
      
      // Check if AI wants to perform an action
      if (assistantContent.includes('AKTION:')) {
        const actionMatch = assistantContent.match(/AKTION:([^|]+)(\|[^|]+:[^|]+)*/);
        if (actionMatch) {
          const actionName = actionMatch[1].trim();
          const paramString = actionMatch[2] || '';
          
          // Parse parameters
          const parameters: any = {};
          if (paramString) {
            const paramPairs = paramString.split('|').filter(p => p.includes(':'));
            paramPairs.forEach(pair => {
              const [key, value] = pair.split(':');
              if (key && value) {
                parameters[key.trim()] = value.trim();
              }
            });
          }
          
          try {
            // Call ai-actions edge function
            const { data: actionResult, error: actionError } = await supabase.functions.invoke('ai-actions', {
              body: {
                action: actionName.toLowerCase(),
                parameters,
                userProfile: {
                  user_id: profile?.id,
                  name: profile?.name,
                  permission_lvl: profile?.permission_lvl
                }
              }
            });
            
            if (actionError) {
              assistantContent += `\n\nFehler bei der Ausführung: ${actionError.message}`;
            } else if (actionResult?.success) {
              assistantContent += `\n\n✅ ${actionResult.result.message || 'Aktion erfolgreich ausgeführt!'}`;
            } else {
              assistantContent += `\n\n❌ ${actionResult?.result?.error || 'Aktion fehlgeschlagen'}`;
            }
          } catch (error) {
            console.error('Action execution error:', error);
            assistantContent += `\n\nFehler bei der Ausführung: ${error}`;
          }
        }
      }
      
      const assistantResponse = {
        role: 'assistant' as const,
        content: assistantContent
      };
      
      setConversation(prev => [...prev, assistantResponse]);

      // Save assistant message
      if (conversationId) {
        await saveMessage(assistantResponse, conversationId);
        
        // Update conversation timestamp
        await supabase
          .from('chat_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }
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

  const handleConversationSelect = (conversationId: string | null) => {
    if (conversationId) {
      loadConversation(conversationId);
    } else {
      setCurrentConversationId(null);
      setConversation([]);
    }
  };

  const handleNewChat = () => {
    setCurrentConversationId(null);
    setConversation([]);
    setInput('');
  };

  // Handle initial message from location state
  useEffect(() => {
    if (location.state?.initialMessage && !currentConversationId) {
      // Auto-submit initial message
      const submitInitialMessage = async () => {
        const event = new Event('submit') as any;
        await handleSubmit(event);
      };
      if (input === location.state.initialMessage) {
        submitInitialMessage();
      }
    }
  }, [location.state?.initialMessage, currentConversationId, input]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <ChatSidebar
        currentConversationId={currentConversationId}
        onConversationSelect={handleConversationSelect}
        onNewChat={handleNewChat}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="px-4 py-4">
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

        {/* Chat Area */}
        <main className="flex-1 p-4">
          <div className="max-w-4xl mx-auto h-full flex flex-col space-y-4">
            {/* Conversation */}
            <Card className="flex-1 min-h-0">
              <CardHeader>
                <CardTitle>
                  {currentConversationId ? 'Chat' : 'Neuer Chat'}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-full flex flex-col">
                {conversation.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                    <div>
                      <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">Willkommen beim KI-Assistenten</h3>
                      <p>Stellen Sie eine Frage oder bitten Sie mich, eine Aktion durchzuführen.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 space-y-4 overflow-y-auto max-h-[60vh]">
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
                     <div ref={messagesEndRef} />
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
    </div>
  );
};

export default AIChat;