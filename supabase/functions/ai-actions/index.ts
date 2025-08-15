import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, parameters, userProfile } = await req.json()
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    let result = null
    let success = false

    // Check user permissions and execute actions
    switch (action) {
      case 'create_user':
        if (userProfile.permission_lvl >= 10) {
          // Use the create_school_user function
          const { data, error } = await supabase.rpc('create_school_user', {
            username_input: parameters.username,
            password_input: parameters.password,
            full_name_input: parameters.fullName,
            permission_level_input: parameters.permissionLevel,
            creator_user_id: userProfile.user_id
          });
          
          if (!error && (data as any)?.success) {
            result = { message: `Benutzer ${parameters.username} wurde erfolgreich erstellt.` }
            success = true
          } else {
            result = { error: (data as any)?.error || error?.message || 'Fehler beim Erstellen des Benutzers' }
          }
        } else {
          result = { error: 'Keine Berechtigung zum Erstellen von Benutzern' }
        }
        break

      case 'update_vertretungsplan':
        if (userProfile.permission_lvl >= 10) {
          console.log('Raw parameters received:', parameters)
          
          // Convert date parameter to proper date format
          let dateValue = new Date();
          if (parameters.date) {
            const dateParam = parameters.date.toLowerCase();
            if (dateParam === 'morgen' || dateParam === 'tomorrow') {
              dateValue = new Date();
              dateValue.setDate(dateValue.getDate() + 1);
            } else if (dateParam === 'heute' || dateParam === 'today') {
              dateValue = new Date();
            } else if (dateParam === 'übermorgen') {
              dateValue = new Date();
              dateValue.setDate(dateValue.getDate() + 2);
            } else {
              // Try to parse as date
              const parsedDate = new Date(parameters.date);
              if (!isNaN(parsedDate.getTime())) {
                dateValue = parsedDate;
              }
            }
          }
          
          // Ensure all required fields are present with fallbacks
          const insertData = {
            date: dateValue.toISOString().split('T')[0], // Format as YYYY-MM-DD
            class_name: parameters.className || parameters.class_name || 'Unbekannte Klasse',
            period: parseInt(parameters.period) || 1,
            original_teacher: parameters.originalTeacher || parameters.original_teacher || 'Unbekannt',
            original_subject: parameters.originalSubject || parameters.original_subject || 'Unbekannt', 
            original_room: parameters.originalRoom || parameters.original_room || 'Unbekannt',
            substitute_teacher: parameters.substituteTeacher || parameters.substitute_teacher || 'Vertretung',
            substitute_subject: parameters.substituteSubject || parameters.substitute_subject || 'Vertretung',
            substitute_room: parameters.substituteRoom || parameters.substitute_room || 'Unbekannt',
            note: parameters.note || 'Keine Notizen',
            created_by: null
          }
          
          console.log('Inserting data:', insertData)
          
          const { data, error } = await supabase
            .from('vertretungsplan')
            .insert(insertData)
          
          if (!error) {
            result = { message: 'Vertretungsplan wurde erfolgreich aktualisiert.' }
            success = true
          } else {
            result = { error: error.message }
          }
        } else {
          result = { error: 'Keine Berechtigung zum Bearbeiten des Vertretungsplans - Level 10 erforderlich' }
        }
        break

      case 'create_announcement':
        if (userProfile.permission_lvl >= 4) {
          const { data, error } = await supabase
            .from('announcements')
            .insert({
              title: parameters.title,
              content: parameters.content,
              author: userProfile.name,
              priority: parameters.priority || 'normal',
              target_class: parameters.targetClass,
              target_permission_level: parseInt(parameters.targetPermissionLevel) || null,
              created_by: null
            })
          
          if (!error) {
            result = { message: 'Ankündigung wurde erfolgreich erstellt.' }
            success = true
          } else {
            result = { error: error.message }
          }
        } else {
          result = { error: 'Keine Berechtigung zum Erstellen von Ankündigungen' }
        }
        break

      case 'create_tts':
        if (userProfile.permission_lvl >= 10) {
          const { data, error } = await supabase
            .from('audio_announcements')
            .insert({
              title: 'TTS Durchsage',
              description: `Text-to-Speech Durchsage erstellt von ${userProfile.name}`,
              is_tts: true,
              tts_text: parameters.text,
              voice_id: 'alloy',
              is_active: true,
              created_by: userProfile.user_id?.toString() || null
            })
          
          if (!error) {
            result = { 
              message: 'TTS-Durchsage wurde erfolgreich erstellt!',
              tts_text: parameters.text
            }
            success = true
          } else {
            result = { error: error.message }
          }
        } else {
          result = { error: 'Keine Berechtigung für TTS-Durchsagen - Level 10 erforderlich' }
        }
        break

      case 'generate_vertretungsplan':
        if (userProfile.permission_lvl >= 10) {
          result = { 
            message: 'AI-Vertretungsplan-Generator ist noch in Entwicklung. Verwenden Sie stattdessen die Vertretungsplan-Bearbeitung.',
            suggestions: [
              'Verwenden Sie "Vertretung erstellen" für spezifische Einträge',
              'Nutzen Sie die normale Vertretungsplan-Verwaltung',
              'Feature kommt in einer zukünftigen Version'
            ]
          }
          success = true
        } else {
          result = { error: 'Keine Berechtigung für AI-Vertretungsplan-Generator - Level 10 erforderlich' }
        }
        break

      case 'plan_substitution':
        if (userProfile.permission_lvl >= 9) {
          try {
            const teacherName = parameters.teacherName || parameters.teacher || parameters.name;
            const dateParam = parameters.date || parameters.datum || 'today';

            if (!teacherName) {
              result = { error: 'Lehrkraft-Name fehlt (teacherName)' }
              break;
            }

            // Parse date and weekday
            let dateValue = new Date();
            const lower = String(dateParam).toLowerCase();
            if (lower === 'morgen' || lower === 'tomorrow') {
              dateValue.setDate(dateValue.getDate() + 1);
            } else if (lower === 'übermorgen') {
              dateValue.setDate(dateValue.getDate() + 2);
            } else if (lower !== 'heute' && lower !== 'today') {
              const parsed = new Date(dateParam);
              if (!isNaN(parsed.getTime())) dateValue = parsed;
            }
            const weekday = dateValue.getDay(); // 0=Sun ... 6=Sat
            const weekdayMap: Record<number, 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'> = {
              1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday'
            } as const;
            if (!(weekday in weekdayMap)) {
              result = { error: 'Ausgewähltes Datum liegt am Wochenende' }
              break;
            }
            const dayKey = weekdayMap[weekday as 1|2|3|4|5];

            const normalize = (s: string) => s.toLowerCase().replace(/\b(fr\.?|herr|frau|hr\.?|fr\.?)/g, '').trim();
            const normSick = normalize(teacherName);

            const parseCell = (cell?: string) => {
              if (!cell) return [] as Array<{subject: string, teacher: string, room: string}>;
              return cell.split('|').map(s => s.trim()).filter(Boolean).map(sub => {
                const parts = sub.split(/\s+/);
                if (parts.length >= 3) {
                  return { subject: parts[0], teacher: parts[1], room: parts[2] };
                }
                return { subject: sub, teacher: '', room: '' } as any;
              });
            };

            const classTables = ['Stundenplan_10b_A', 'Stundenplan_10c_A'];
            const affected: Array<{ className: string, period: number, subject: string, room: string }> = [];
            const expertise: Record<string, Set<string>> = {};

            for (const table of classTables) {
              const { data: rows, error } = await supabase.from(table).select('*').order('Stunde');
              if (error) { console.error('Read schedule error', table, error.message); continue; }
              for (const row of rows as any[]) {
                const period = row['Stunde'];
                const cell = row[dayKey] as string | undefined;
                const entries = parseCell(cell);
                // build expertise from all days (simple heuristic)
                const dayKeys = ['monday','tuesday','wednesday','thursday','friday'] as const;
                for (const dk of dayKeys) {
                  const e2 = parseCell(row[dk]);
                  for (const e of e2) {
                    const n = normalize(e.teacher);
                    if (!n) continue;
                    if (!expertise[n]) expertise[n] = new Set<string>();
                    if (e.subject) expertise[n].add(e.subject);
                  }
                }
                for (const e of entries) {
                  if (normalize(e.teacher) === normSick) {
                    affected.push({ className: table.replace('Stundenplan_', ''), period, subject: e.subject || 'Unbekannt', room: e.room || 'Unbekannt' });
                  }
                }
              }
            }

            // Helper to check availability of a teacher at given dayKey+period
            const isFree = async (teacherNorm: string, period: number) => {
              for (const table of classTables) {
                const { data: rows } = await supabase.from(table).select('Stunde,'+dayKey).eq('Stunde', period);
                const row = (rows as any[])[0];
                if (!row) continue;
                const entries = parseCell(row[dayKey]);
                if (entries.some(e => normalize(e.teacher) === teacherNorm)) return false;
              }
              return true;
            };

            const confirmations: string[] = [];
            for (const a of affected) {
              // Find candidate
              let chosen: string | null = null;
              const candidates = Object.keys(expertise).filter(t => t !== normSick && expertise[t].has(a.subject));
              for (const cand of candidates) {
                if (await isFree(cand, a.period)) { chosen = cand; break; }
              }
              const chosenDisplay = chosen ? chosen : 'Vertretung';

              // Insert into vertretungsplan
              await supabase.from('vertretungsplan').insert({
                date: dateValue.toISOString().split('T')[0],
                class_name: a.className,
                period: a.period,
                original_teacher: teacherName,
                original_subject: a.subject,
                original_room: a.room,
                substitute_teacher: chosenDisplay,
                substitute_subject: a.subject,
                substitute_room: a.room,
                note: 'Automatisch geplant',
                created_by: null
              });

              const dateStr = dateValue.toISOString().split('T')[0];
              confirmations.push(`${chosenDisplay} übernimmt die ${a.period}. Stunde ${a.subject} für ${teacherName} am ${dateStr}.`);
            }

            if (confirmations.length === 0) {
              result = { error: 'Keine betroffenen Stunden gefunden' };
            } else {
              result = { message: 'Vertretungen geplant', confirmations };
              success = true;
            }
          } catch (e) {
            console.error('plan_substitution error:', e);
            result = { error: e.message || 'Fehler bei der Vertretungsplanung' };
          }
        } else {
          result = { error: 'Keine Berechtigung für automatische Vertretungsplanung - Level 9 erforderlich' }
        }
        break

      default:
        result = { error: 'Unbekannte Aktion' }
    }

    return new Response(
      JSON.stringify({ success, result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in ai-actions:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})