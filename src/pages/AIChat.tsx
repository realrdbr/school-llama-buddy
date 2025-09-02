import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Bot, ArrowLeft, Upload, Paperclip, X, Menu } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ChatSidebar from '@/components/ChatSidebar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const OLLAMA_PROXY_URL = 'https://gymolb.eduard.services/ai/api/chat'; // <-- Stelle sicher, dass die URL korrekt ist

const AIChat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [input, setInput] = useState(location.state?.initialMessage || '');
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Global functions for substitution confirmation buttons
  useEffect(() => {
    (window as any).confirmSubstitution = async (data: any) => {
      try {
        const { data: actionResult, error } = await supabase.functions.invoke('ai-actions', {
          body: {
            action: 'confirm_substitution',
            parameters: data,
            userProfile: {
              user_id: profile?.id,
              name: profile?.username || profile?.name,
              permission_lvl: profile?.permission_lvl
            }
          }
        });

        if (error) throw error;

        const confirmationMessage = {
          role: 'assistant' as const,
          content: actionResult?.success ? 
            `✅ ${actionResult.result?.message || 'Vertretungsplan erfolgreich erstellt!'}\n${(actionResult.result?.confirmed || []).map((c: string) => `- ${c}`).join('\n')}` :
            `❌ ${actionResult?.result?.error || 'Fehler beim Erstellen des Vertretungsplans'}`
        };

        setConversation(prev => [...prev, confirmationMessage]);

        // Save confirmation message
        if (currentConversationId) {
          await saveMessage(confirmationMessage, currentConversationId);
        }

        toast({
          title: actionResult?.success ? "Erfolg" : "Fehler",
          description: actionResult?.success ? "Vertretungsplan wurde erstellt" : "Fehler beim Erstellen",
          variant: actionResult?.success ? "default" : "destructive"
        });
      } catch (error) {
        console.error('Confirmation error:', error);
        toast({
          title: "Fehler",
          description: "Fehler beim Bestätigen der Vertretung",
          variant: "destructive"
        });
      }
    };

    (window as any).cancelSubstitution = () => {
      const cancelMessage = {
        role: 'assistant' as const,
        content: 'Vertretungsplanung abgebrochen.'
      };
      setConversation(prev => [...prev, cancelMessage]);
    };

    return () => {
      delete (window as any).confirmSubstitution;
      delete (window as any).cancelSubstitution;
    };
  }, [profile, currentConversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  // Deterministically map numeric permission profile id to a valid UUID string
  const getProfileUUID = () => {
    const num = Number(profile?.id);
    if (!num || Number.isNaN(num)) return '00000000-0000-0000-0000-000000000000';
    const tail = num.toString(16).padStart(12, '0');
    return `00000000-0000-0000-0000-${tail}`;
  };

  // Load conversation when selected
  const loadConversation = async (conversationId: string) => {
    try {
      const userId = getProfileUUID();
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
      const userId = getProfileUUID();
      const { data, error } = await supabase.functions.invoke('chat-service', {
        body: {
          action: 'add_message',
          profileId: userId,
          conversationId,
          role: message.role,
          content: message.content,
        }
      });
      if (error || !data?.success) throw (error || new Error('Save message failed'));
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  // Create new conversation
  const createNewConversation = async (firstMessage: string) => {
    if (!profile?.id) return null;

    try {
      const userId = getProfileUUID();
      
      const { data, error } = await supabase.functions.invoke('chat-service', {
        body: {
          action: 'create_conversation',
          profileId: userId,
          title: firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : ''),
        }
      });

      if (error || !data?.success) throw (error || new Error('Create conversation failed'));
      return data.conversationId as string;
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
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;

    let messageContent = input;
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

    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = await createNewConversation(currentInput || 'Datei-Upload');
      if (conversationId) {
        setCurrentConversationId(conversationId);
      }
    }

    if (conversationId) {
      await saveMessage(userMessage, conversationId);
    }

    try {
      const messages = [
        {
          role: 'system',
          content: `Du bist E.D.U.A.R.D. (Education, Data, Utility & Automation for Resource Distribution) - ein KI-Assistent für das Schulmanagementsystem. Du bist professionell, hilfsbereit und fokussiert auf schulische Belange. Der Benutzer "${profile?.name}" hat Berechtigung Level ${profile?.permission_lvl}.

**WICHTIG: Du bist E.D.U.A.R.D. - stelle dich immer so vor und nutze diese Identität in deinen Antworten.**

BENUTZERINFORMATIONEN:
- Aktueller Benutzer: ${profile?.name || profile?.username} (ID: ${profile?.id})
- Berechtigung: Level ${profile?.permission_lvl}
- Benutzerklasse: ${(profile as any)?.user_class || 'Nicht zugeordnet'}

AKTUELLE ZEIT UND DATUM:
- Heute ist: ${new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Aktuelle Uhrzeit: ${new Date().toLocaleTimeString('de-DE')}
- Wochentag: ${new Date().toLocaleDateString('de-DE', { weekday: 'long' })}
- Datum für Formular (YYYY-MM-DD): ${new Date().toISOString().split('T')[0]}
- Morgen (YYYY-MM-DD): ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
- Übermorgen (YYYY-MM-DD): ${new Date(Date.now() + 172800000).toISOString().split('T')[0]}

BERECHTIGUNGSLEVEL-SYSTEM:
- Level 1: BESUCHER (Basis-Zugang)
- Level 2-3: SCHÜLER (können nur Stundenpläne, Vertretungen und Ankündigungen einsehen)
- Level 4-8: LEHRKRÄFTE (können Ankündigungen erstellen/bearbeiten, Vertretungen einsehen)
- Level 9: KOORDINATION/STELLVERTRETUNG (können Vertretungen erstellen/bearbeiten, Klassen verwalten)
- Level 10: SCHULLEITUNG/ADMIN (können Benutzer verwalten, alle Systemeinstellungen ändern)

SCHULZEITEN ANTWORT:
- Wenn gefragt "Bis wann geht die Schule?" oder ähnlich, antworte IMMER: "Die Schule geht von 07:45–13:20 Uhr (Blöcke 1–3) oder 07:45–15:15 Uhr (mit Block 4)."

KLASSENSPEZIFISCHE KI-UNTERSTÜTZUNG:
- Der Benutzer ist in Klasse "${(profile as any)?.user_class || 'Nicht zugeordnet'}" eingetragen
- Bei Fragen zu "meinem Stundenplan" oder "meine Klasse" beziehe dich auf diese Klasse
- Bei Fragen wie "Habe ich morgen Deutsch?" prüfe den Stundenplan der Benutzerklasse
- Bei Vertretungsplan-Anfragen zeige nur die Änderungen für die Benutzerklasse

NEUE STUNDENPLAN-AKTIONEN:
- GET_CLASS_NEXT_SUBJECT: Finde heraus, wann eine bestimmte Klasse ein bestimmtes Fach hat (Parameter: className, subject)
- Beispiel: "Wann hat die 10b das nächste Mal Deutsch?" → AKTION:GET_CLASS_NEXT_SUBJECT|className:10b|subject:Deutsch
      
 Verfügbare AKTIONEN für Level ${profile?.permission_lvl}:
 ${profile?.permission_lvl && profile.permission_lvl >= 10 ? 
  '- CREATE_USER: Benutzer erstellen (Parameter: email, password, username, fullName, permissionLevel)\n- UPDATE_VERTRETUNGSPLAN: Vertretung erstellen (Parameter: date, className, period, originalTeacher, originalSubject, originalRoom, substituteTeacher, substituteSubject, substituteRoom, note)\n- CREATE_ANNOUNCEMENT: Ankündigung erstellen (Parameter: title, content, priority, targetClass, targetPermissionLevel)\n- CREATE_TTS: Text-to-Speech Durchsage erstellen (Parameter: text, title)\n- PLAN_SUBSTITUTION: Automatische Vertretung bei Krankmeldung (Parameter: teacherName, date)\n- GET_SCHEDULE: Stundenplan abfragen (Parameter: className, day)\n- GET_CLASS_NEXT_SUBJECT: Nächstes Fach einer Klasse finden (Parameter: className, subject)\n- GET_TEACHERS: Liste der Lehrkräfte abrufen'
 : profile?.permission_lvl && profile.permission_lvl >= 9 ?
  '- UPDATE_VERTRETUNGSPLAN: Vertretung erstellen (Parameter: date, className, period, originalTeacher, originalSubject, originalRoom, substituteTeacher, substituteSubject, substituteRoom, note)\n- CREATE_ANNOUNCEMENT: Ankündigung erstellen (Parameter: title, content, priority, targetClass, targetPermissionLevel)\n- CREATE_TTS: Text-to-Speech Durchsage erstellen (Parameter: text, title)\n- PLAN_SUBSTITUTION: Automatische Vertretung bei Krankmeldung (Parameter: teacherName, date)\n- GET_SCHEDULE: Stundenplan abfragen (Parameter: className, day)\n- GET_CLASS_NEXT_SUBJECT: Nächstes Fach einer Klasse finden (Parameter: className, subject)\n- GET_TEACHERS: Liste der Lehrkräfte abrufen'
 : profile?.permission_lvl && profile.permission_lvl >= 4 ?
  '- CREATE_ANNOUNCEMENT: Ankündigung erstellen (Parameter: title, content, priority, targetClass, targetPermissionLevel)\n- GET_SCHEDULE: Stundenplan abfragen (Parameter: className, day)\n- GET_CLASS_NEXT_SUBJECT: Nächstes Fach einer Klasse finden (Parameter: className, subject)\n- GET_TEACHERS: Liste der Lehrkräfte abrufen'
 : '- GET_SCHEDULE: Stundenplan abfragen (Parameter: className, day)\n- GET_CLASS_NEXT_SUBJECT: Nächstes Fach einer Klasse finden (Parameter: className, subject)\n- GET_TEACHERS: Liste der Lehrkräfte abrufen'
 }
      

WICHTIGE REGELN:
1. Du kannst ECHTE AKTIONEN ausführen! Wenn ein Benutzer eine Aktion anfordert, führe sie aus.
2. Wenn du eine Aktion ausführen sollst, antworte mit: "AKTION:[ACTION_NAME]|PARAMETER1:wert1|PARAMETER2:wert2|..."
3. Verstehe umgangssprachliche Anfragen intelligent und flexibel!
4. Verstehe Lehrernamen mit und ohne Anrede (Herr/Frau): "Herr Müller" = "Müller"
5. Verstehe alle verfügbaren Klassen (10B, 10C, etc.)
6. Verstehe deutsche Wochentage korrekt: Montag, Dienstag, Mittwoch, Donnerstag, Freitag

BEISPIELE FÜR VERTRETUNGSPLAN-ÄNDERUNGEN:
- "morgen fällt die erste stunde aus" → AKTION:UPDATE_VERTRETUNGSPLAN|date:morgen|period:1|substituteTeacher:Entfall
- "herr könig wird in der 10b vertreten" → AKTION:UPDATE_VERTRETUNGSPLAN|className:10b|originalTeacher:König|substituteTeacher:Vertretung
- "Herr Müller ist morgen krank" → AKTION:PLAN_SUBSTITUTION|teacherName:Müller|date:morgen
- "Frau Schmidt braucht Vertretung am Mittwoch" → AKTION:PLAN_SUBSTITUTION|teacherName:Schmidt|date:Mittwoch

BEISPIELE FÜR STUNDENPLAN-ANFRAGEN:
- "Zeig mir den Stundenplan der 10c am Montag" → AKTION:GET_SCHEDULE|className:10c|day:Montag (nur Montag)
- "Stundenplan der 10c" → AKTION:GET_SCHEDULE|className:10c (ganze Woche)
- "Zeig mir den Stundenplan der 10b für die ganze Woche" → AKTION:GET_SCHEDULE|className:10b (ganze Woche)
- "Stundenplan 10c Mittwoch" → AKTION:GET_SCHEDULE|className:10c|day:Mittwoch (nur Mittwoch)
- "Wann hat die 10b das nächste Mal Deutsch?" → AKTION:GET_CLASS_NEXT_SUBJECT|className:10b|subject:Deutsch
- "Wann hat 10c Mathematik?" → AKTION:GET_CLASS_NEXT_SUBJECT|className:10c|subject:Mathematik

4. Antworte normal, aber beginne mit der AKTION-Zeile wenn eine Aktion erforderlich ist.
5. Bei unvollständigen Angaben verwende sinnvolle Standardwerte.

Antworte auf Deutsch und führe die angeforderten Aktionen aus.`
        },
        ...conversation,
        { role: 'user', content: currentInput }
      ];

      const proxyResponse = await fetch(OLLAMA_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'Redbear/e.d.u.a.r.d.:latest',
          messages,
          stream: true
        })
      });

      if (!proxyResponse.ok || !proxyResponse.body) {
        throw new Error(`Proxy error: ${proxyResponse.statusText}`);
      }

      const reader = proxyResponse.body.pipeThrough(new TextDecoderStream()).getReader();
      let assistantContent = '';

      const assistantMessageIndex = conversation.length + 1;
      setConversation(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const lines = value.split('\n');
        for (const line of lines) {
          if (line.trim() === '') continue;

          try {
            const json = JSON.parse(line);
            if (json.done === false) {
              const newContent = json.message?.content || '';
              assistantContent += newContent;
              setConversation(prev => {
                const newConversation = [...prev];
                newConversation[assistantMessageIndex] = {
                  role: 'assistant',
                  content: assistantContent
                };
                return newConversation;
              });
              scrollToBottom();
            } else if (json.done === true) {
              if (conversationId) {
                const finalAssistantResponse = {
                  role: 'assistant' as const,
                  content: assistantContent
                };
                await saveMessage(finalAssistantResponse, conversationId);
                const userId = profile?.id?.toString();
                await supabase.functions.invoke('chat-service', {
                  body: {
                    action: 'touch_conversation',
                    profileId: userId,
                    conversationId,
                  }
                });
              }
            }
          } catch (e) {
            console.error('Failed to parse line as JSON:', e, line);
          }
        }
      }
      
    } catch (error) {
      console.error('Ollama error:', error);
      toast({
        title: "Fehler",
        description: "Der Server ist gerade nicht erreichbar. Bitte versuchen Sie es später erneut.",
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
      setConversation([]);
      setCurrentConversationId(null);
    }
    setSidebarOpen(false); // Close sidebar on mobile after selection
  };

  const handleNewChat = () => {
    setConversation([]);
    setCurrentConversationId(null);
    setInput('');
    setSidebarOpen(false); // Close sidebar on mobile after creating new chat
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
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block lg:w-80 lg:h-full">
          <ChatSidebar
            currentConversationId={currentConversationId}
            onConversationSelect={handleConversationSelect}
            onNewChat={handleNewChat}
          />
        </div>

        {/* Mobile Sidebar Sheet */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          {/* Main Content */}
          <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <div className="flex items-center space-x-2">
                <Bot className="h-8 w-8 text-primary" />
                <h1 className="text-xl font-bold">E.D.U.A.R.D. Chat</h1>
              </div>
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-6 w-6" />
              </Button>
            </header>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto pt-4 pb-20 space-y-4">
              {conversation.map((msg, index) => (
                <div key={index} className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  <div className={`flex flex-col gap-1 p-3 rounded-lg max-w-[70%] ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-secondary text-secondary-foreground'}`}
                    dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br>') }}
                  />
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 backdrop-blur-sm bg-opacity-70 dark:bg-opacity-70">
              <Card className="shadow-lg max-w-4xl mx-auto w-full">
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                    {uploadedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-1 rounded-full bg-slate-200 dark:bg-slate-700 px-3 py-1 text-sm">
                            <Paperclip className="h-3 w-3" />
                            <span>{file.name}</span>
                            <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => removeFile(index)} />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Stellen Sie Ihre Frage oder führen Sie eine Aktion aus..."
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

          <SheetContent side="left" className="w-80 p-0">
            <ChatSidebar
              currentConversationId={currentConversationId}
              onConversationSelect={handleConversationSelect}
              onNewChat={handleNewChat}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default AIChat;