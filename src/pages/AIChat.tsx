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
      // First, check if user has auth session and get the real user_id
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
        // Robustly parse the first AKTION line and all key:value pairs
        const actionLineMatch = assistantContent.match(/AKTION:[^\n\r]+/i);
        if (actionLineMatch) {
          const actionLine = actionLineMatch[0];
          const parts = actionLine.split('|').map(p => p.trim()).filter(Boolean);
          const actionName = parts.shift()!.replace(/^AKTION:/i, '').trim();

          // Parse parameters (support values containing colons)
          const parameters: any = {};
          for (const part of parts) {
            const [rawKey, ...rawValParts] = part.split(':');
            if (!rawKey || rawValParts.length === 0) continue;
            const key = rawKey.trim();
            const value = rawValParts.join(':').trim();
            if (key) parameters[key] = value;
          }

          // Normalize teacher honorifics early (edge function also normalizes)
          if (parameters.teacherName) {
            parameters.teacherName = parameters.teacherName.replace(/\b(fr\.?|herr|frau|hr\.?)\s+/i, '').trim();
          }

          // Ensure weekly schedule when user didn't ask for a specific day
          if (actionName.toLowerCase() === 'get_schedule') {
            const inputLower = currentInput.toLowerCase();
            const wantsWeek = /(ganze?n?\s*woche|der\s*woche|woche|alle\s*tage)/i.test(inputLower);
            const mentionsDay = /(montag|dienstag|mittwoch|donnerstag|freitag|\bmo\b|\bdi\b|\bmi\b|\bdo\b|\bfr\b)/i.test(inputLower);
            if (wantsWeek || !mentionsDay) {
              delete parameters.day;
            }
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
                  username: profile?.username,
                  permission_lvl: profile?.permission_lvl
                }
              }
            });
            
            if (actionError) {
              assistantContent += `\n\nFehler bei der Ausführung: ${actionError.message}`;
            } else if (actionResult?.success) {
              // Render structured data from edge function to avoid Halluzinationen
              const res = actionResult.result || {};
              let details = '';
              switch (actionName.toLowerCase()) {
                case 'get_teachers': {
                  const htmlTable = res.htmlTable as string | undefined;
                  if (htmlTable) {
                    details = `\n\n<div style="overflow-x:auto;">${htmlTable}</div>`;
                  } else {
                    const textList = res.textList as string | undefined;
                    if (textList) {
                      details = `\n\nLehrkräfte:\n${textList}`;
                    }
                  }
                  break;
                }
                case 'get_schedule': {
                  const htmlTable = res.htmlTable as string | undefined;
                  if (htmlTable) {
                    details = `\n\n<div style="overflow-x:auto;">${htmlTable}</div>`;
                  } else {
                    const rows = (res.schedule || []) as Array<any>;
                    if (rows.length && 'entry' in rows[0]) {
                      const lines = rows.map((r: any) => `Stunde ${r.period}: ${r.entry || '-'}`).join('\n');
                      details = `\n\nStundenplan (Tag):\n${lines}`;
                    } else if (rows.length) {
                      const lines = rows.map((r: any) => `Stunde ${r.period}: Mo:${r.monday||'-'} Di:${r.tuesday||'-'} Mi:${r.wednesday||'-'} Do:${r.thursday||'-'} Fr:${r.friday||'-'}`).join('\n');
                      details = `\n\nStundenplan (Woche):\n${lines}`;
                    }
                  }
                  break;
                }
                case 'plan_substitution': {
                  const conf = (res.confirmations || []) as Array<string>;
                  const subs = res.details?.substitutions;
                  if (conf.length) {
                    details = `\n\nVertretungsplan vorgeschlagen:\n- ${conf.join('\n- ')}`;
                    
                    // Add confirmation buttons for substitution planning
                    if (subs && Array.isArray(subs)) {
                      details += `\n\n<div style="margin-top: 16px;">
                        <button 
                          onclick="window.confirmSubstitution({substitutions: ${JSON.stringify(subs).replace(/"/g, '&quot;')}, sickTeacher: '${res.details?.sickTeacher}', date: '${res.details?.dateISO || res.details?.date}'})" 
                          style="background: #22c55e; color: white; padding: 8px 16px; border: none; border-radius: 4px; margin-right: 8px; cursor: pointer;">
                          Vertretungsplan erstellen
                        </button>
                        <button 
                          onclick="window.cancelSubstitution()" 
                          style="background: #ef4444; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">
                          Abbrechen
                        </button>
                      </div>`;
                    }
                  }
                  break;
                }
                default: {
                  // No special rendering
                }
              }
              assistantContent = `\n\n✅ ${res.message || 'Aktion erfolgreich ausgeführt!'}${details}`;
            } else {
              assistantContent += `\n\n❌ ${actionResult?.result?.error || 'Aktion fehlgeschlagen'}`;
            }

            // Make sure we don't keep earlier LLM hallucinations around
            assistantContent = assistantContent.trim();
          } catch (error) {
            console.error('Action execution error:', error);
            assistantContent += `\n\nFehler bei der Ausführung: ${error}`;
          }
        }
      }
      
      // Fallback: Lehrerlisten-Anfrage ohne Aktion -> DB-gestützt laden
      if (/lehrerliste|liste.*lehr|alle\s+lehrer/i.test(currentInput)) {
        try {
          const { data: actionResult } = await supabase.functions.invoke('ai-actions', {
            body: {
              action: 'get_teachers',
              parameters: {},
              userProfile: {
                user_id: profile?.id,
                name: profile?.username || profile?.name,
                permission_lvl: profile?.permission_lvl
              }
            }
          });
          if (actionResult?.success) {
            const res = actionResult.result || {};
            const htmlTable = res.htmlTable as string | undefined;
            const details = htmlTable ? `\n\n<div style="overflow-x:auto;">${htmlTable}</div>` : '';
            assistantContent = `\n\n✅ ${res.message || 'Lehrerliste geladen.'}${details}`;
          }
        } catch (e) {
          console.error('Fallback get_teachers error:', e);
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
          const userId = profile?.id?.toString();
          await supabase.functions.invoke('chat-service', {
            body: {
              action: 'touch_conversation',
              profileId: userId,
              conversationId,
            }
          });
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
          <SheetContent side="left" className="w-80 p-0">
            <ChatSidebar
              currentConversationId={currentConversationId}
              onConversationSelect={handleConversationSelect}
              onNewChat={handleNewChat}
            />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="px-2 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Mobile Hamburger Menu */}
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="lg:hidden flex-shrink-0">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
              </Sheet>
              
              <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="flex-shrink-0">
                <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Zurück</span>
              </Button>
              <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">E.D.U.A.R.D.</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden md:block truncate">Education, Data, Utility & Automation for Resource Distribution</p>
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
                      <h3 className="text-lg font-medium mb-2">Willkommen bei E.D.U.A.R.D.</h3>
                      <p>Education, Data, Utility & Automation for Resource Distribution</p>
                      <p className="text-sm mt-2">Stellen Sie eine Frage oder bitten Sie mich, eine Aktion durchzuführen.</p>
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
                         <div 
                           className="prose prose-sm max-w-none dark:prose-invert"
                           dangerouslySetInnerHTML={{ 
                             __html: (() => {
                               const raw = message.content;
                               const hasHTML = /<[^>]+>/i.test(raw);
                               const withLineBreaks = hasHTML ? raw : raw.replace(/\n/g, '<br>');
                               return withLineBreaks.replace(/```([^`]+)```/g, '<pre style="background:#f5f5f5;padding:8px;border-radius:4px;overflow-x:auto;"><code>$1</code></pre>');
                             })()
                           }}
                         />
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
    </div>
  );
};

export default AIChat;
