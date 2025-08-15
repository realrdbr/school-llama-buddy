import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Bot, ArrowLeft, Upload, Paperclip, X } from 'lucide-react';
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
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
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
      const userId = profile?.id?.toString();
      const { data, error } = await supabase.functions.invoke('chat-service', {
        body: {
          action: 'list_messages',
          conversationId,
          profileId: userId,
        }
      });

      if (error) throw error;
      const msgs = (data?.messages || []).map((m: any) => ({ role: m.role, content: m.content })) as ChatMessage[];
      setConversation(msgs);
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
      // First, check if user has auth session and get the real user_id
      const userId = profile?.id?.toString() || 'anonymous';
      
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: userId,
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'text/plain'];
    
    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Fehler",
          description: `Dateityp ${file.type} nicht unterstützt. Erlaubt: PNG, JPG, PDF, TXT`,
          variant: "destructive"
        });
        return false;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "Fehler", 
          description: `Datei ${file.name} ist zu groß (max. 10MB)`,
          variant: "destructive"
        });
        return false;
      }
      return true;
    });

    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && uploadedFiles.length === 0 || isLoading) return;

    let messageContent = input;
    
    // Add file information to message if files are uploaded
    if (uploadedFiles.length > 0) {
      const fileDescriptions = uploadedFiles.map(file => 
        `📎 ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)} KB)`
      ).join('\n');
      messageContent = `${input}\n\n--- Angehängte Dateien ---\n${fileDescriptions}`;
    }
    
    const userMessage = { role: 'user' as const, content: messageContent };
    setConversation(prev => [...prev, userMessage]);
    setIsLoading(true);
    const currentInput = input;
    const currentFiles = uploadedFiles;
    setInput('');
    setUploadedFiles([]);

    // Create conversation if it doesn't exist
    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = await createNewConversation(currentInput || 'Datei-Upload');
      if (conversationId) {
        setCurrentConversationId(conversationId);
      }
    }

    // Save user message
    if (conversationId) {
      await saveMessage(userMessage, conversationId);
    }

    try {
      // Process uploaded files for context
      let fileContext = '';
      if (currentFiles.length > 0) {
        fileContext = '\n\nBEIGEFÜGTE DATEIEN:\n';
        for (const file of currentFiles) {
          fileContext += `- ${file.name} (${file.type})\n`;
          
          // Read file content for context (simplified)
          if (file.type.startsWith('text/')) {
            try {
              const text = await file.text();
              fileContext += `  Inhalt: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}\n`;
            } catch (error) {
              fileContext += `  (Text konnte nicht gelesen werden)\n`;
            }
          } else if (file.type.startsWith('image/')) {
            fileContext += `  (Bild-Datei - Analyse nicht implementiert)\n`;
          } else if (file.type === 'application/pdf') {
            fileContext += `  (PDF-Datei - Analyse nicht implementiert)\n`;
          }
        }
      }

      // Use Supabase Edge Function as proxy to avoid CORS issues
      const { data: responseData, error: proxyError } = await supabase.functions.invoke('ollama-proxy', {
        body: {
          model: 'llama3.1:8b',
          messages: [
            {
              role: 'system',
              content: `Du bist ein KI-Assistent für ein Schulmanagementsystem. Der Benutzer "${profile?.name}" hat Berechtigung Level ${profile?.permission_lvl}.

BENUTZERINFORMATIONEN:
- Aktueller Benutzer: ${profile?.name || profile?.username} (ID: ${profile?.id})
- Berechtigung: Level ${profile?.permission_lvl}

AKTUELLE ZEIT UND DATUM:
- Heute ist: ${new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Aktuelle Uhrzeit: ${new Date().toLocaleTimeString('de-DE')}
- Wochentag: ${new Date().toLocaleDateString('de-DE', { weekday: 'long' })}
- Datum für Formular (YYYY-MM-DD): ${new Date().toISOString().split('T')[0]}
- Morgen (YYYY-MM-DD): ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
- Übermorgen (YYYY-MM-DD): ${new Date(Date.now() + 172800000).toISOString().split('T')[0]}

BERECHTIGUNGSLEVEL-SYSTEM:
- Level 1-3: SCHÜLER (können nur Stundenpläne, Vertretungen und Ankündigungen einsehen)
- Level 4-8: LEHRKRÄFTE (können Ankündigungen erstellen/bearbeiten, Vertretungen einsehen)
- Level 9: KOORDINATION/STELLVERTRETUNG (können Vertretungen erstellen/bearbeiten, Klassen verwalten)
- Level 10: SCHULLEITUNG/ADMIN (können Benutzer verwalten, alle Systemeinstellungen ändern)

Verf fcGBARE AKTIONEN f fcr Level ${profile?.permission_lvl}:
${profile?.permission_lvl && profile.permission_lvl >= 10 ? 
  '- CREATE_USER: Benutzer erstellen (Parameter: email, password, username, fullName, permissionLevel)\n- UPDATE_VERTRETUNGSPLAN: Vertretung erstellen (Parameter: date, className, period, originalTeacher, originalSubject, originalRoom, substituteTeacher, substituteSubject, substituteRoom, note)\n- CREATE_ANNOUNCEMENT: Ankündigung erstellen (Parameter: title, content, priority, targetClass, targetPermissionLevel)\n- CREATE_TTS: Text-to-Speech Durchsage erstellen (Parameter: text)\n- PLAN_SUBSTITUTION: Automatische Vertretung bei Krankmeldung (Parameter: teacherName, date)' :
  profile?.permission_lvl && profile.permission_lvl >= 9 ?
  '- UPDATE_VERTRETUNGSPLAN: Vertretung erstellen (Parameter: date, className, period, originalTeacher, originalSubject, originalRoom, substituteTeacher, substituteSubject, substituteRoom, note)\n- CREATE_ANNOUNCEMENT: Ankündigung erstellen (Parameter: title, content, priority, targetClass, targetPermissionLevel)\n- PLAN_SUBSTITUTION: Automatische Vertretung bei Krankmeldung (Parameter: teacherName, date)' :
  profile?.permission_lvl && profile.permission_lvl >= 4 ?
  '- CREATE_ANNOUNCEMENT: Ankündigung erstellen (Parameter: title, content, priority, targetClass, targetPermissionLevel)' :
  'Keine Aktionen verfügbar'
}


WICHTIGE REGELN:
1. Du kannst ECHTE AKTIONEN ausführen! Wenn ein Benutzer eine Aktion anfordert, führe sie aus.
2. Wenn du eine Aktion ausführen sollst, antworte mit: "AKTION:[ACTION_NAME]|PARAMETER1:wert1|PARAMETER2:wert2|..."
3. Verstehe umgangssprachliche Anfragen intelligent und flexibel!

BEISPIELE FÜR VERTRETUNGSPLAN-ÄNDERUNGEN:
- "morgen fällt die erste stunde aus" → AKTION:UPDATE_VERTRETUNGSPLAN|date:morgen|period:1|substituteTeacher:Entfall
- "herr könig wird in der 10b vertreten" → AKTION:UPDATE_VERTRETUNGSPLAN|className:10b|originalTeacher:König|substituteTeacher:Vertretung
- "raum 201 wird zu 204 gewechselt" → AKTION:UPDATE_VERTRETUNGSPLAN|originalRoom:201|substituteRoom:204
- "frau müller übernimmt die mathe stunde" → AKTION:UPDATE_VERTRETUNGSPLAN|substituteTeacher:Müller|substituteSubject:Mathe

4. Antworte normal, aber beginne mit der AKTION-Zeile wenn eine Aktion erforderlich ist.
5. Bei unvollständigen Angaben verwende sinnvolle Standardwerte.

Antworte auf Deutsch und führe die angeforderten Aktionen aus.${fileContext}`
            },
            ...conversation,
            { role: 'user', content: currentInput + fileContext }
          ],
          stream: false
        }
      });

      if (proxyError) {
        throw new Error(`Proxy error: ${proxyError.message}`);
      }

      const data = responseData;
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
                  name: profile?.username || profile?.name,
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
    setUploadedFiles([]);
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
                {/* File Upload Area */}
                {uploadedFiles.length > 0 && (
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Angehängte Dateien:</p>
                    <div className="space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-background p-2 rounded">
                          <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            <span className="text-sm">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Stellen Sie hier Ihre Frage oder bitten Sie um eine Aktion..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <input
                      type="file"
                      id="file-upload"
                      multiple
                      accept=".png,.jpg,.jpeg,.pdf,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={isLoading}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button type="submit" disabled={(!input.trim() && uploadedFiles.length === 0) || isLoading}>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Unterstützte Dateien: PNG, JPG, PDF, TXT (max. 10MB)
                  </p>
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