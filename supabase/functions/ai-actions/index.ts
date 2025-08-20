import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, parameters, userProfile } = await req.json()
    console.log('Received action:', action, 'with parameters:', parameters)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let result: any = {}
    let success = false

    // AI system prompts with school knowledge
    const systemPrompt = `Du bist E.D.U.A.R.D. (Educational Data, Utility & Administration Resource Director), ein fortgeschrittener KI-Assistent für das Schulsystem.

SCHULZEITEN UND BLOCKSTRUKTUR:
- Schulzeit: 07:45 bis 13:20 Uhr (ohne 4. Block) oder bis 15:15 Uhr (mit 4. Block)
- Block 1: 07:45 – 09:15 (2 Schulstunden)
- Block 2: 09:35 – 11:05 (2 Schulstunden)  
- Block 3: 11:50 – 13:20 (2 Schulstunden)
- Block 4: 13:45 – 15:15 (2 Schulstunden)

WICHTIGE DEUTSCHSPRACHIGE BEGRIFFE:
- Fächer: Deutsch, Mathematik/Mathe, Englisch, Geschichte, Erdkunde, Biologie, Chemie, Physik, Sport, Kunst, Musik, Religion, Ethik, Informatik, Französisch, Spanisch, Latein
- Relative Zeiten: heute, morgen, übermorgen, gestern
- Wenn nach "morgen" oder anderen spezifischen Tagen gefragt wird, zeige NUR die Daten für diesen Tag

BERECHTIGUNGSSYSTEM:
- Level 1: Besucher
- Level 2-4: Schüler  
- Level 5-9: Lehrkraft
- Level 10+: Schulleitung

SCHULZEITEN ANTWORT:
- Wenn gefragt "Bis wann geht die Schule?" oder ähnlich, antworte IMMER: "Die Schule geht von 07:45–13:20 Uhr (Blöcke 1–3) oder 07:45–15:15 Uhr (mit Block 4)."

Du hilfst bei:
- Vertretungsplanung und -abfragen
- Stundenplanerstellung und -abfragen
- Benutzerverwaltung (nur für Berechtigte)
- Durchsagen erstellen
- Schulorganisation

Antworte stets höflich, professionell und schulgerecht auf Deutsch.`;

    switch (action) {
      case 'get_system_prompt':
        result = { prompt: systemPrompt }
        success = true
        break

      case 'create_user':
        // Verify permission level 10 for user creation
        if (userProfile.permission_lvl >= 10) {
          const { data, error } = await supabase.rpc('create_user_with_permissions', {
            p_username: parameters.username,
            p_name: parameters.name,
            p_permission_lvl: parseInt(parameters.permissionLevel),
            p_user_class: parameters.userClass || null,
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
          
          // Parse date using robust German parser and ensure school day
          const dateValue = parseDateTextToBerlinSchoolDay(parameters?.date || parameters?.datum || 'today');
          
          // Ensure all required fields are present with fallbacks
          const insertData = {
            date: dateValue.toISOString().split('T')[0],
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
            .select()
            .single()
          
          if (!error) {
            console.log('update_vertretungsplan inserted:', data);
            // Create announcement automatically for visibility across the app
            const dateStrDE = new Date(insertData.date + 'T12:00:00').toLocaleDateString('de-DE');
            const announcement = {
              title: `Vertretungsplan aktualisiert – ${insertData.class_name}`,
              content: `${dateStrDE}, ${insertData.period}. Stunde: ${insertData.original_subject} bei ${insertData.original_teacher} wird vertreten durch ${insertData.substitute_teacher} (Raum: ${insertData.substitute_room}).`,
              author: 'E.D.U.A.R.D.',
              priority: 'high',
              target_class: insertData.class_name,
              target_permission_level: 1,
              created_by: null,
            };
            const { error: annErr } = await supabase.from('announcements').insert(announcement);
            if (annErr) console.error('Announcement insert error:', annErr);

            result = { message: 'Vertretungsplan wurde erfolgreich aktualisiert.', inserted: data }
            success = true
          } else {
            console.error('update_vertretungsplan error:', error);
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
          try {
            const title = parameters.title || 'TTS Durchsage';
            const text = parameters.text;
            const voiceId = parameters.voiceId || 'alloy';
            
            console.log('Creating TTS with parameters:', { title, text, voiceId });
            
            if (!text || text.trim() === '') {
              result = { error: 'Text für TTS-Durchsage darf nicht leer sein.' };
              break;
            }
            
            // Insert TTS record
            const { data: insertData, error: insertError } = await supabase
              .from('audio_announcements')
              .insert({
                title: title,
                tts_text: text,
                voice_id: voiceId,
                is_tts: true,
                created_by: null
              })
              .select()
              .single();
            
            if (insertError) {
              console.error('TTS insert error:', insertError);
              result = { error: `Fehler beim Erstellen der TTS-Durchsage: ${insertError.message}` };
              break;
            }
            
            console.log('TTS record created:', insertData);
            result = { 
              message: `TTS-Durchsage "${title}" wurde erfolgreich erstellt.`,
              id: insertData.id
            };
            success = true;
          } catch (error) {
            console.error('TTS creation error:', error);
            result = { error: `Unerwarteter Fehler beim Erstellen der TTS-Durchsage: ${(error as any).message}` };
          }
        } else {
          result = { error: 'Keine Berechtigung zum Erstellen von TTS-Durchsagen - Level 10 erforderlich' };
        }
        break

      case 'get_announcements':
        let announceQuery = supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false });
        
        // Filter by user's class if they have one assigned
        if (userProfile.user_class) {
          announceQuery = announceQuery.or(`target_class.eq.${userProfile.user_class},target_class.is.null`);
        }
        
        const { data: announcements, error: annError } = await announceQuery;
        
        if (annError) {
          result = { error: annError.message }
        } else {
          result = { announcements: announcements || [] }
          success = true
        }
        break

      case 'get_teachers':
        const { data: teachers, error: teacherError } = await supabase
          .from('teachers')
          .select('*')
          .order('shortened')
        
        if (teacherError) {
          result = { error: teacherError.message }
        } else {
          result = { teachers: teachers || [] }
          success = true
        }
        break

      case 'get_current_substitution_plan':
        // Handle specific date requests (morgen, übermorgen, etc.)
        let targetDate = null;
        if (parameters.date) {
          targetDate = parseDateTextToBerlinSchoolDay(parameters.date);
        }
        
        let subQuery = supabase
          .from('vertretungsplan')
          .select('*');
        
        // If specific date requested, filter by that date
        if (targetDate) {
          const dateStr = targetDate.toISOString().split('T')[0];
          subQuery = subQuery.eq('date', dateStr);
        }
        
        subQuery = subQuery.order('date', { ascending: true })
                     .order('period', { ascending: true });
        
        const { data: substitutions, error: subError } = await subQuery;
        
        if (subError) {
          result = { error: subError.message }
        } else {
          result = { substitutions: substitutions || [] }
          success = true
        }
        break

      case 'get_next_subject_lesson':
        if (userProfile.user_class) {
          // Get current schedule for user's class
          const scheduleTableName = `Stundenplan_${userProfile.user_class}_A`;
          
          const { data: scheduleData, error: scheduleError } = await supabase
            .from(scheduleTableName)
            .select('*');
          
          if (scheduleError) {
            result = { error: `Stundenplan für Klasse ${userProfile.user_class} konnte nicht geladen werden.` };
          } else {
            // Process schedule and find next occurrence of subject
            const requestedSubject = parameters.subject?.toLowerCase();
            const nextLesson = findNextSubjectLesson(scheduleData, requestedSubject);
            
            if (nextLesson) {
              result = nextLesson;
              success = true;
            } else {
              result = { message: `Kein nächster Termin für ${parameters.subject} gefunden.` };
            }
          }
        } else {
          result = { error: 'Ihre Klasse ist nicht in Ihrem Profil hinterlegt.' };
        }
        break

      case 'get_schedule':
        try {
          const className = parameters.className || parameters.class_name || '10b';
          const dayParam = parameters.day;
          
          // Building weekly mapping and tables dynamically
          const WEEKDAY_MAP: Record<string, number> = {
            'montag': 1, 'monday': 1, 'mo': 1,
            'dienstag': 2, 'tuesday': 2, 'di': 2,
            'mittwoch': 3, 'wednesday': 3, 'mi': 3,
            'donnerstag': 4, 'thursday': 4, 'do': 4,
            'freitag': 5, 'friday': 5, 'fr': 5,
          };
          const WEEKDAY_COLUMNS: Record<number, string> = {
            1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday'
          };

          // Use static table list to avoid raw SQL in edge functions
          const availableTables = ['Stundenplan_10b_A', 'Stundenplan_10c_A'];
          
          // Build class mapping (robust normalization) - improved to handle all classes
          const tableMap: Record<string, string> = {};
          const availableClasses: string[] = [];
          
          for (const tableName of availableTables) {
            const raw = tableName.replace('Stundenplan_', '').replace('_A', ''); // e.g., '10b'
            const rawLower = raw.toLowerCase();
            const keyVariants = new Set<string>([
              rawLower,
              rawLower.replace(/[_\s]/g, ''), // remove underscores/spaces
            ]);
            keyVariants.forEach(k => tableMap[k] = tableName);
            availableClasses.push(raw); // display without 'Stundenplan_'
          }

          const normalizedInput = className.toLowerCase().replace(/[_\s]/g, '');
          let table = tableMap[normalizedInput];

          if (!table) {
            // Fallback: try partial matching safely
            const entry = Object.entries(tableMap).find(([k]) => 
              k === normalizedInput || k.startsWith(normalizedInput) || normalizedInput.startsWith(k)
            );
            if (entry) table = entry[1];
          }

          if (!table) {
            result = { 
              error: `E.D.U.A.R.D.: Stundenplan für Klasse "${className}" nicht gefunden. Verfügbare Klassen: ${availableClasses.join(', ')}` 
            };
            break;
          }

          const { data: rows, error } = await supabase.from(table).select('*').order('Stunde');
          if (error) throw error;
          
          if (!rows || rows.length === 0) {
            result = { 
              error: `E.D.U.A.R.D.: Keine Einträge für Klasse "${className}" gefunden. Bitte überprüfen Sie die Stundenplandaten.` 
            };
            break;
          }

          const normalizeDayToColumn = (d: string) => {
            const key = d.toLowerCase();
            const num = WEEKDAY_MAP[key];
            if (!num) return '';
            return WEEKDAY_COLUMNS[num] || '';
          };
          const dayKey = dayParam ? normalizeDayToColumn(dayParam) : '';

          // Parse helper like used in substitution planning
          const parseCell = (cell?: string) => {
            if (!cell) return [] as Array<{subject:string, teacher:string, room:string}>;
            return cell.split('|').map(s => s.trim()).filter(Boolean).map(sub => {
              const parts = sub.split(/\s+/);
              if (parts.length >= 3) {
                return { subject: parts[0], teacher: parts[1], room: parts[2] };
              }
              return { subject: sub, teacher: '', room: '' } as any;
            });
          };

          // Build weekly grid data
          const schedule = (rows || []).map((r: any) => {
            const period = r['Stunde'];
            return {
              period,
              monday: r['monday'],
              tuesday: r['tuesday'],
              wednesday: r['wednesday'],
              thursday: r['thursday'],
              friday: r['friday'],
            };
          });

          // Build HTML table like on the Stundenplan page
          const parseEntry = (cell?: string) => {
            if (!cell) return [];
            return cell.split('|').map(s => s.trim()).filter(Boolean).map(sub => {
              const parts = sub.split(/\s+/);
              if (parts.length >= 3) {
                return { subject: parts[0], teacher: parts[1], room: parts[2] };
              }
              return { subject: sub, teacher: '', room: '' };
            });
          };

          const formatCellHTML = (entry?: string) => {
            const entries = parseEntry(entry);
            if (entries.length === 0) return '<div style="text-align:center; color:#666;">-</div>';
            
            if (entries.length > 1) {
              return `<div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">${entries.map(e => 
                `<div style="padding:4px; background:#f5f5f5; border-radius:4px; font-size:12px; border:1px solid #ddd;">
                  <div style="font-weight:500;">${e.subject}</div>
                  <div style="color:#666;">${e.teacher}</div>
                  <div style="color:#666;">${e.room}</div>
                </div>`
              ).join('')}</div>`;
            } else {
              const e = entries[0];
              return `<div style="text-align:center; font-size:13px;">
                <div style="font-weight:500; margin-bottom:2px;">${e.subject}</div>
                <div style="color:#666; font-size:11px;">${e.teacher}</div>
                <div style="color:#666; font-size:11px;">${e.room}</div>
              </div>`;
            }
          };

          let htmlTable = '';
          if (dayKey && rows) {
            // Single day view (filtered by day column)
            htmlTable = `
            <table style="border-collapse:collapse; width:100%; font-family:Arial,sans-serif;">
              <thead style="background:#f0f0f0;">
                <tr>
                  <th style="border:1px solid #ddd; padding:8px; text-align:center;">Block</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:center;">${dayParam.charAt(0).toUpperCase() + dayParam.slice(1)}</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map((r: any) => `
                <tr>
                  <td style="border:1px solid #ddd; padding:8px; text-align:center; font-weight:bold;">${r.Stunde}</td>
                  <td style="border:1px solid #ddd; padding:4px;">${formatCellHTML(r[dayKey])}</td>
                </tr>`).join('')}
              </tbody>
            </table>`;
          } else {
            // Full week view
            htmlTable = `
            <table style="border-collapse:collapse; width:100%; font-family:Arial,sans-serif;">
              <thead style="background:#f0f0f0;">
                <tr>
                  <th style="border:1px solid #ddd; padding:8px; text-align:center;">Block</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:center;">Montag</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:center;">Dienstag</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:center;">Mittwoch</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:center;">Donnerstag</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:center;">Freitag</th>
                </tr>
              </thead>
              <tbody>
                ${(rows || []).map((r: any) => `
                <tr>
                  <td style="border:1px solid #ddd; padding:8px; text-align:center; font-weight:bold;">${r.Stunde}</td>
                  <td style="border:1px solid #ddd; padding:4px;">${formatCellHTML(r.monday)}</td>
                  <td style="border:1px solid #ddd; padding:4px;">${formatCellHTML(r.tuesday)}</td>
                  <td style="border:1px solid #ddd; padding:4px;">${formatCellHTML(r.wednesday)}</td>
                  <td style="border:1px solid #ddd; padding:4px;">${formatCellHTML(r.thursday)}</td>
                  <td style="border:1px solid #ddd; padding:4px;">${formatCellHTML(r.friday)}</td>
                </tr>`).join('')}
              </tbody>
            </table>`;
          }

          result = {
            message: dayKey
              ? `Stundenplan für Klasse ${className.toUpperCase()} am ${dayParam.charAt(0).toUpperCase() + dayParam.slice(1)}`
              : `Stundenplan (Woche) für Klasse ${className.toUpperCase()}`,
            schedule,
            htmlTable,
          };
          success = true;
        } catch (e: any) {
          console.error('get_schedule error:', e);
          result = { error: e.message || 'Fehler beim Laden des Stundenplans' };
        }
        break;

      case 'plan_substitution': {
        try {
          const teacherName = String(parameters?.teacherName || '').trim();
          
          // Handle both ISO date strings and German text
          let dateStr: string;
          const dateParam = parameters?.date || 'heute';
          if (dateParam.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Already ISO format
            dateStr = dateParam;
          } else {
            // German text, parse it
            const target = parseDateTextToBerlinSchoolDay(dateParam);
            dateStr = target.toISOString().split('T')[0];
          }

          console.log('Planning substitution for teacher:', teacherName, 'on date:', dateStr);

          // Get all teachers to find available substitutes
          const { data: teacherRows, error: tErr } = await supabase
            .from('teachers')
            .select('shortened, "last name", "first name", subjects');
          if (tErr) throw tErr;

          const teacherRow = (teacherRows || []).find((t: any) =>
            (t['last name'] || '').toLowerCase().includes(teacherName.toLowerCase())
          );
          const teacherAbbr = (teacherRow?.shortened || teacherName).toLowerCase();

          const weekday = new Date(dateStr + 'T12:00:00').getDay();
          const dayMap: Record<number, string> = { 1:'monday', 2:'tuesday', 3:'wednesday', 4:'thursday', 5:'friday' };
          const col = dayMap[weekday] || 'monday';

          // Skip weekends
          if (weekday === 0 || weekday === 6) {
            result = { error: 'Vertretungsplanung ist nur für Schultage (Montag-Freitag) möglich.' };
            break;
          }

          const tables = ['Stundenplan_10b_A','Stundenplan_10c_A'];
          const substitutions: any[] = [];
          const occupiedTeachers: Record<number, Set<string>> = {}; // period -> set of teacher abbreviations

          const parseCell = (cell?: string) => {
            if (!cell) return [] as Array<{subject:string, teacher:string, room:string}>;
            return cell.split('|').map(s => s.trim()).filter(Boolean).map(sub => {
              const parts = sub.split(/\s+/);
              if (parts.length >= 3) {
                return { subject: parts[0], teacher: parts[1], room: parts[2] };
              }
              return { subject: sub, teacher: '', room: '' } as any;
            });
          };

          // First pass: find all lessons for the sick teacher and build occupied teachers map
          for (const table of tables) {
            const { data: rows, error: sErr } = await supabase.from(table).select('*');
            if (sErr) throw sErr;
            const className = table.replace('Stundenplan_','').replace('_A','');
            
            for (const r of rows || []) {
              const period = r['Stunde'];
              const cell = r[col] as string | null;
              if (!cell || typeof cell !== 'string') continue;
              
              const entries = parseCell(cell);
              
              // Track all occupied teachers for this period
              if (!occupiedTeachers[period]) occupiedTeachers[period] = new Set();
              entries.forEach(e => {
                if (e.teacher) occupiedTeachers[period].add(e.teacher.toLowerCase());
              });
              
              // Find lessons where sick teacher is teaching
              const match = entries.find(e => e.teacher && e.teacher.toLowerCase().includes(teacherAbbr));
              if (match) {
                // Try to find an available substitute teacher
                const availableTeachers = (teacherRows || []).filter((t: any) => {
                  const abbr = (t.shortened || '').toLowerCase();
                  return abbr !== teacherAbbr && // Not the sick teacher
                         !occupiedTeachers[period]?.has(abbr) && // Not already teaching this period
                         (t.subjects || '').toLowerCase().includes(match.subject.toLowerCase()); // Can teach this subject
                });

                let substituteTeacher = 'Vertretung';
                if (availableTeachers.length > 0) {
                  const substitute = availableTeachers[0];
                  substituteTeacher = `${substitute['first name']} ${substitute['last name']} (${substitute.shortened})`;
                }

                substitutions.push({
                  className,
                  period,
                  subject: match.subject,
                  room: match.room,
                  originalTeacher: teacherName,
                  substituteTeacher
                });
              }
            }
          }

          if (substitutions.length === 0) {
            result = { 
              details: { date: dateStr, teacher: teacherName, substitutions: [] }, 
              message: `Keine Stunden für ${teacherName} am ${dateStr} gefunden. Bitte überprüfen Sie den Namen und das Datum.` 
            };
          } else {
            const dayName = new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long' });
            result = { 
              details: { date: dateStr, teacher: teacherName, substitutions }, 
              message: `Vertretungsplan für ${teacherName} am ${dayName} (${dateStr}) erstellt. ${substitutions.length} Stunde(n) betroffen.` 
            };
          }
          success = true;
        } catch (e: any) {
          console.error('plan_substitution error:', e);
          result = { error: e.message || 'Fehler beim Generieren des Vertretungsplans' };
        }
        break;
      }

      case 'confirm_substitution': {
        try {
          const dateStr: string = parameters?.date;
          const sickTeacher: string = parameters?.sickTeacher;
          const subs: any[] = Array.isArray(parameters?.substitutions) ? parameters.substitutions : [];

          if (!dateStr || subs.length === 0) {
            result = { error: 'Keine Einträge zum Speichern vorhanden.' };
            break;
          }

          const rows = subs.map((s) => ({
            date: dateStr,
            class_name: String(s.className || '').toLowerCase(),
            period: Number(s.period) || 1,
            original_teacher: sickTeacher || s.originalTeacher || 'Unbekannt',
            original_subject: s.subject || 'Unbekannt',
            original_room: s.room || 'Unbekannt',
            substitute_teacher: s.substituteTeacher || 'Vertretung',
            substitute_subject: s.subject || 'Vertretung',
            substitute_room: s.room || 'Unbekannt',
            note: 'Automatisch generiert (AI)',
            created_by: null
          }));

          const { error: insErr } = await supabase.from('vertretungsplan').insert(rows);
          if (insErr) throw insErr;

          // Create a single announcement summarizing the saved substitutions
          const dateStrDE = new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE');
          const classes = Array.from(new Set(rows.map(r => r.class_name))).join(', ');
          const contentLines = rows
            .sort((a, b) => a.period - b.period)
            .map(r => `${r.class_name.toUpperCase()}, ${r.period}. Stunde: ${r.original_subject} bei ${r.original_teacher} → ${r.substitute_teacher} (Raum: ${r.substitute_room})`)
            .join('\n');
          const { error: annErr } = await supabase.from('announcements').insert({
            title: `Vertretungsplan aktualisiert – ${dateStrDE}`,
            content: contentLines,
            author: 'E.D.U.A.R.D.',
            priority: 'high',
            target_class: classes || null,
            target_permission_level: 1,
            created_by: null,
          });
          if (annErr) console.error('Announcement insert error:', annErr);

          result = { message: 'Vertretungsplan gespeichert', count: rows.length };
          success = true;
        } catch (e: any) {
          console.error('confirm_substitution error:', e);
          result = { error: e.message || 'Fehler beim Speichern des Vertretungsplans' };
        }
        break;
      }

      default:
        result = { error: 'Unbekannte Aktion' };
        break;
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
      JSON.stringify({ success: false, error: (error as any).message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// Helper function to parse German date text to Berlin school day
function parseDateTextToBerlinSchoolDay(text: string): Date {
  const now = new Date()
  const berlinTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (2 * 3600000)) // Berlin time (UTC+2)
  
  console.log('Processing:', text, 'Current Berlin time:', berlinTime)
  
  // Handle relative dates in German
  if (text.includes('heute')) {
    return berlinTime
  } else if (text.includes('morgen') && !text.includes('übermorgen')) {
    const tomorrow = new Date(berlinTime)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow
  } else if (text.includes('übermorgen')) {
    const dayAfterTomorrow = new Date(berlinTime)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
    return dayAfterTomorrow
  } else if (text.includes('gestern')) {
    const yesterday = new Date(berlinTime)
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday
  }
  
  // Try to parse as ISO date first
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) {
    return new Date(isoMatch[1] + 'T12:00:00')
  }
  
  // Default to today for any unrecognized input
  return berlinTime
}

function findNextSubjectLesson(scheduleData: any[], requestedSubject: string) {
  const now = new Date()
  const berlinTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (2 * 3600000))
  const currentWeekday = berlinTime.getDay() // 0=Sunday, 1=Monday, etc.
  const currentHour = berlinTime.getHours()
  const currentMinute = berlinTime.getMinutes()
  
  // Block times mapping
  const blockTimes = {
    1: { start: { hour: 7, minute: 45 }, end: { hour: 9, minute: 15 } },
    2: { start: { hour: 9, minute: 35 }, end: { hour: 11, minute: 5 } },
    3: { start: { hour: 11, minute: 50 }, end: { hour: 13, minute: 20 } },
    4: { start: { hour: 13, minute: 45 }, end: { hour: 15, minute: 15 } }
  }
  
  // Weekday mapping (Monday=1, Tuesday=2, ...)
  const weekdayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const columnMap = {
    'monday': 'monday',
    'tuesday': 'tuesday', 
    'wednesday': 'wednesday',
    'thursday': 'thursday',
    'friday': 'friday'
  }
  
  // Subject matching (German subjects)
  const subjectMap = {
    'deutsch': ['de', 'deutsch', 'german'],
    'mathematik': ['ma', 'math', 'mathematik', 'mathe'],
    'englisch': ['en', 'englisch', 'english'],
    'geschichte': ['ge', 'geschichte', 'history'],
    'erdkunde': ['ek', 'erdkunde', 'geography'],
    'biologie': ['bi', 'biologie', 'biology'],
    'chemie': ['ch', 'chemie', 'chemistry'],
    'physik': ['ph', 'physik', 'physics'],
    'sport': ['sp', 'sport', 'pe'],
    'kunst': ['ku', 'kunst', 'art'],
    'musik': ['mu', 'musik', 'music'],
    'religion': ['re', 'religion'],
    'ethik': ['et', 'ethik', 'ethics'],
    'informatik': ['if', 'informatik', 'computer science'],
    'französisch': ['fr', 'französisch', 'french'],
    'spanisch': ['es', 'spanisch', 'spanish'],
    'latein': ['la', 'latein', 'latin']
  }
  
  // Find which subjects match the request
  const matchingSubjects = []
  for (const [fullName, abbreviations] of Object.entries(subjectMap)) {
    if (abbreviations.some(abbr => abbr.includes(requestedSubject) || requestedSubject.includes(abbr))) {
      matchingSubjects.push(...abbreviations)
    }
  }
  
  if (matchingSubjects.length === 0) {
    // Direct match attempt
    matchingSubjects.push(requestedSubject)
  }
  
  // Search through schedule for next occurrence
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDate = new Date(berlinTime)
    checkDate.setDate(checkDate.getDate() + dayOffset)
    const checkWeekday = checkDate.getDay()
    
    // Skip weekends
    if (checkWeekday === 0 || checkWeekday === 6) continue
    
    const dayName = weekdayMap[checkWeekday]
    const columnName = columnMap[dayName]
    
    if (!columnName) continue
    
    for (const row of scheduleData) {
      const lessonContent = row[columnName]
      if (!lessonContent || lessonContent.trim() === '') continue
      
      const block = row.Stunde || row.stunde
      const blockTime = blockTimes[block]
      if (!blockTime) continue
      
      // Check if this lesson contains the requested subject
      const lessonLower = lessonContent.toLowerCase()
      const isMatch = matchingSubjects.some(subject => 
        lessonLower.includes(subject.toLowerCase())
      )
      
      if (isMatch) {
        // If it's today, check if the lesson hasn't started yet
        if (dayOffset === 0) {
          const lessonStartTime = blockTime.start.hour * 60 + blockTime.start.minute
          const currentTime = currentHour * 60 + currentMinute
          
          if (currentTime >= lessonStartTime) {
            continue // This lesson has already started/ended today
          }
        }
        
        // Parse lesson content for teacher and room
        const parts = lessonContent.split(/[\s,/|]+/).filter(p => p.trim())
        let teacher = 'Unbekannt'
        let room = 'Unbekannt'
        
        // Look for teacher abbreviations (typically 2-3 letters)
        for (const part of parts) {
          if (part.length >= 2 && part.length <= 4 && /^[A-Za-z]+$/.test(part)) {
            if (!matchingSubjects.some(s => s.toLowerCase() === part.toLowerCase())) {
              teacher = part
              break
            }
          }
        }
        
        // Look for room numbers (typically numbers or number+letter combinations)
        for (const part of parts) {
          if (/^\d+[A-Za-z]?$/.test(part) || /^[A-Za-z]\d+$/.test(part)) {
            room = part
            break
          }
        }
        
        const dayNames = {
          1: 'Montag',
          2: 'Dienstag', 
          3: 'Mittwoch',
          4: 'Donnerstag',
          5: 'Freitag'
        }
        
        return {
          message: `Ihr nächster ${requestedSubject}-Unterricht ist am ${dayNames[checkWeekday]} in Block ${block} (${String(blockTime.start.hour).padStart(2, '0')}:${String(blockTime.start.minute).padStart(2, '0')} - ${String(blockTime.end.hour).padStart(2, '0')}:${String(blockTime.end.minute).padStart(2, '0')}) in Raum ${room} bei ${teacher}.`,
          day: dayNames[checkWeekday],
          block: block,
          time: `${String(blockTime.start.hour).padStart(2, '0')}:${String(blockTime.start.minute).padStart(2, '0')} - ${String(blockTime.end.hour).padStart(2, '0')}:${String(blockTime.end.minute).padStart(2, '0')}`,
          room: room,
          teacher: teacher,
          subject: requestedSubject
        }
      }
    }
  }
  
  return null
}