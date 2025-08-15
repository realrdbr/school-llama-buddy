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

            console.log(`E.D.U.A.R.D. planning substitution for ${teacherName} on ${dateParam}`);

            // Parse date including German weekday words
            let dateValue = new Date();
            const lower = String(dateParam).toLowerCase();
            const weekdayMap: Record<string, number> = { montag:1, dienstag:2, mittwoch:3, donnerstag:4, freitag:5 };
            if (lower === 'morgen' || lower === 'tomorrow') {
              dateValue.setDate(dateValue.getDate() + 1);
            } else if (lower === 'übermorgen') {
              dateValue.setDate(dateValue.getDate() + 2);
            } else if (lower !== 'heute' && lower !== 'today') {
              if (weekdayMap[lower]) {
                const today = new Date();
                const todayDow = today.getDay() === 0 ? 7 : today.getDay(); // 1..7
                let diff = weekdayMap[lower] - todayDow;
                if (diff < 0) diff += 7;
                if (diff === 0) diff = 7; // same day → next week
                dateValue.setDate(today.getDate() + diff);
              } else {
                const parsed = new Date(dateParam);
                if (!isNaN(parsed.getTime())) dateValue = parsed;
              }
            }
            
            const weekday = dateValue.getDay(); // 0=Sun ... 6=Sat
            const weekdayKeyMap: Record<number, 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'> = {
              1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday'
            } as const;
            
            if (!(weekday in weekdayKeyMap)) {
              result = { error: 'E.D.U.A.R.D.: Ausgewähltes Datum liegt am Wochenende' }
              break;
            }
            const dayKey = weekdayKeyMap[weekday as 1|2|3|4|5];

            // Load all teachers from database
            const { data: teachersData, error: teachersError } = await supabase
              .from('teachers')
              .select('*');

            if (teachersError) {
              console.error('E.D.U.A.R.D. Error loading teachers:', teachersError);
              result = { error: 'E.D.U.A.R.D.: Fehler beim Laden der Lehrerdaten' };
              break;
            }

            // Build teacher expertise map
            const teachers = teachersData as Array<{
              'first name': string;
              'last name': string;
              shortened: string;
              subjects: string;
              fav_rooms?: string;
            }>;

            const teacherMap: Record<string, {
              name: string;
              subjects: Set<string>;
              rooms: string[];
              shortened: string;
            }> = {};

            for (const teacher of teachers) {
              const fullName = `${teacher['first name']} ${teacher['last name']}`;
              const subjects = teacher.subjects ? teacher.subjects.split(',').map(s => s.trim()) : [];
              const rooms = teacher.fav_rooms ? teacher.fav_rooms.split(',').map(r => r.trim()) : [];
              
              teacherMap[teacher.shortened] = {
                name: fullName,
                subjects: new Set(subjects),
                rooms,
                shortened: teacher.shortened
              };
            }

            console.log('Loaded teachers:', Object.keys(teacherMap));

            // Find the sick teacher
            const normalize = (s: string) => s.toLowerCase().replace(/\b(fr\.?|herr|frau|hr\.?|fr\.?)/g, '').trim();
            const normSick = normalize(teacherName);
            
            let sickTeacherShortened: string | null = null;
            for (const [shortened, data] of Object.entries(teacherMap)) {
              if (normalize(data.name).includes(normSick) || normalize(shortened) === normSick) {
                sickTeacherShortened = shortened;
                break;
              }
            }

            if (!sickTeacherShortened) {
              result = { error: `E.D.U.A.R.D.: Lehrkraft "${teacherName}" nicht in der Datenbank gefunden` };
              break;
            }

            console.log(`E.D.U.A.R.D. found sick teacher: ${sickTeacherShortened} (${teacherMap[sickTeacherShortened].name})`);

            // Parse schedule entries
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

            // Get all schedule tables
            const { data: tables } = await supabase.rpc('information_schema_tables') || {};
            const classTables = ['Stundenplan_10b_A', 'Stundenplan_10c_A']; // Known tables for now

            const affected: Array<{ 
              className: string, 
              period: number, 
              subject: string, 
              room: string 
            }> = [];

            // Find affected lessons
            for (const table of classTables) {
              const { data: rows, error } = await supabase.from(table).select('*').order('Stunde');
              if (error) { 
                console.error('Read schedule error', table, error.message); 
                continue; 
              }
              
              for (const row of rows as any[]) {
                const period = row['Stunde'];
                const cell = row[dayKey] as string | undefined;
                const entries = parseCell(cell);
                
                for (const entry of entries) {
                  if (entry.teacher === sickTeacherShortened) {
                    affected.push({ 
                      className: table.replace('Stundenplan_', '').replace('_', ' '), 
                      period, 
                      subject: entry.subject || 'Unbekannt', 
                      room: entry.room || 'Unbekannt' 
                    });
                  }
                }
              }
            }

            console.log(`Found ${affected.length} affected lessons:`, affected);

            // Helper to check if a teacher is available at a specific time
            const isTeacherAvailable = async (teacherShortened: string, period: number): Promise<boolean> => {
              for (const table of classTables) {
                const { data: rows } = await supabase.from(table).select('Stunde,' + dayKey).eq('Stunde', period);
                if (!rows || rows.length === 0) continue;
                
                const row = rows[0] as any;
                const entries = parseCell(row[dayKey]);
                
                if (entries.some(e => e.teacher === teacherShortened)) {
                  return false; // Teacher is busy
                }
              }
              return true; // Teacher is free
            };

            // Find substitute teachers and create substitution entries
            const confirmations: string[] = [];
            const substitutions: Array<{
              period: number;
              className: string;
              subject: string;
              originalTeacher: string;
              substituteTeacher: string;
              room: string;
            }> = [];

            for (const lesson of affected) {
              let bestSubstitute: string | null = null;
              let bestScore = -1;

              // Find the best substitute teacher
              for (const [shortened, teacher] of Object.entries(teacherMap)) {
                if (shortened === sickTeacherShortened) continue; // Skip sick teacher
                
                // Check availability
                const isAvailable = await isTeacherAvailable(shortened, lesson.period);
                if (!isAvailable) continue;

                let score = 0;
                
                // Score based on subject expertise
                if (teacher.subjects.has(lesson.subject)) {
                  score += 10; // High priority for subject match
                }
                
                // Score based on preferred rooms
                if (teacher.rooms.includes(lesson.room)) {
                  score += 5; // Bonus for familiar room
                }
                
                // Random factor to avoid always choosing the same teacher
                score += Math.random() * 2;

                if (score > bestScore) {
                  bestScore = score;
                  bestSubstitute = shortened;
                }
              }

              const substituteTeacher = bestSubstitute || 'Vertretung';
              const substituteTeacherName = bestSubstitute ? teacherMap[bestSubstitute].name : 'Vertretung';

              // Insert into vertretungsplan
              const { error: insertError } = await supabase.from('vertretungsplan').insert({
                date: dateValue.toISOString().split('T')[0],
                class_name: lesson.className,
                period: lesson.period,
                original_teacher: teacherMap[sickTeacherShortened].name,
                original_subject: lesson.subject,
                original_room: lesson.room,
                substitute_teacher: substituteTeacherName,
                substitute_subject: lesson.subject,
                substitute_room: lesson.room,
                note: bestSubstitute ? 
                  `E.D.U.A.R.D.: ${substituteTeacherName} kann ${lesson.subject} unterrichten` : 
                  'E.D.U.A.R.D.: Keine passende Lehrkraft verfügbar',
                created_by: null
              });

              if (insertError) {
                console.error('Error inserting substitution:', insertError);
                continue;
              }

              substitutions.push({
                period: lesson.period,
                className: lesson.className,
                subject: lesson.subject,
                originalTeacher: teacherMap[sickTeacherShortened].name,
                substituteTeacher: substituteTeacherName,
                room: lesson.room
              });

              const dateStr = dateValue.toLocaleDateString('de-DE');
              const confirmation = `${substituteTeacherName} übernimmt die ${lesson.period}. Stunde ${lesson.subject} in Klasse ${lesson.className} für ${teacherMap[sickTeacherShortened].name} am ${dateStr} (Raum ${lesson.room}).`;
              confirmations.push(confirmation);
            }

            if (confirmations.length === 0) {
              result = { 
                error: `Keine Unterrichtsstunden für ${teacherMap[sickTeacherShortened]?.name || teacherName} am ${dateValue.toLocaleDateString('de-DE')} gefunden.` 
              };
            } else {
              result = { 
                message: `Vertretungsplan für ${teacherMap[sickTeacherShortened].name} erfolgreich erstellt`,
                confirmations,
                details: {
                  sickTeacher: teacherMap[sickTeacherShortened].name,
                  date: dateValue.toLocaleDateString('de-DE'),
                  affectedLessons: affected.length,
                  substitutions
                }
              };
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
      
      case 'get_teachers': {
        try {
          const { data, error } = await supabase.from('teachers').select('*').order('last name');
          if (error) throw error;
          const teachersRaw = (data || []) as any[];
          const teachers = teachersRaw.map((t: any) => ({
            firstName: t['first name'],
            lastName: t['last name'],
            shortened: t['shortened'],
            subjects: t['subjects'],
            fav_rooms: t['fav_rooms'] || null,
          }));
          const textList = teachers.map(t => `- ${t.lastName}, ${t.firstName} [${t.shortened}] — ${t.subjects}`).join('\n');
          result = { message: `Es wurden ${teachers.length} Lehrkräfte geladen.`, teachers, textList };
          success = true;
        } catch (e: any) {
          console.error('get_teachers error:', e);
          result = { error: e.message || 'Fehler beim Laden der Lehrkräfte' };
        }
        break
      }

      case 'get_schedule': {
        try {
          const className = (parameters.className || parameters.klasse || '10b').toString().trim().toLowerCase();
          const dayParam = (parameters.day || parameters.tag || '').toString().trim().toLowerCase();
          const tableMap: Record<string, string> = { '10b': 'Stundenplan_10b_A', '10c': 'Stundenplan_10c_A' };
          const table = tableMap[className];
          if (!table) {
            result = { error: `Unbekannte Klasse: ${className}` };
            break;
          }

          const { data: rows, error } = await supabase.from(table).select('*').order('Stunde');
          if (error) throw error;

          const normalizeDay = (d: string) => {
            const map: Record<string, string> = { montag:'monday', dienstag:'tuesday', mittwoch:'wednesday', donnerstag:'thursday', freitag:'friday' };
            return map[d] || d;
          };
          const dayKey = dayParam ? normalizeDay(dayParam) : '';

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

          // Build human friendly strings
          const formatEntry = (s?: string) => {
            const entries = parseCell(s);
            if (entries.length === 0) return '';
            return entries.map(e => `${e.subject}${e.teacher?` (${e.teacher}`:''}${e.room?`${e.teacher?`, `:''}${e.room}`:''}${e.teacher?`)`:''}`).join(' | ');
          };

          // Create ASCII table similar to UI
          const pad = (str: string, len: number) => (str || '').padEnd(len, ' ');
          const colWidths = { Stunde: 6, Mo: 18, Di: 18, Mi: 18, Do: 18, Fr: 18 };
          const header = `${pad('Stunde', colWidths.Stunde)} | ${pad('Montag', colWidths.Mo)} | ${pad('Dienstag', colWidths.Di)} | ${pad('Mittwoch', colWidths.Mi)} | ${pad('Donnerstag', colWidths.Do)} | ${pad('Freitag', colWidths.Fr)}`;
          const sep = `${'-'.repeat(colWidths.Stunde)}-+-${'-'.repeat(colWidths.Mo)}-+-${'-'.repeat(colWidths.Di)}-+-${'-'.repeat(colWidths.Mi)}-+-${'-'.repeat(colWidths.Do)}-+-${'-'.repeat(colWidths.Fr)}`;
          const lines: string[] = [header, sep];

          for (const r of schedule) {
            if (dayKey) {
              const entry = formatEntry((r as any)[dayKey]);
              lines.push(`${pad(String(r.period), colWidths.Stunde)} | ${pad(entry, colWidths.Mo)}${' '.repeat(colWidths.Di+colWidths.Mi+colWidths.Do+colWidths.Fr + 13)}`);
            } else {
              lines.push(`${pad(String(r.period), colWidths.Stunde)} | ${pad(formatEntry(r.monday), colWidths.Mo)} | ${pad(formatEntry(r.tuesday), colWidths.Di)} | ${pad(formatEntry(r.wednesday), colWidths.Mi)} | ${pad(formatEntry(r.thursday), colWidths.Do)} | ${pad(formatEntry(r.friday), colWidths.Fr)}`);
            }
          }

          const textTable = lines.join('\n');

          result = {
            message: dayKey
              ? `Stundenplan für Klasse ${className.toUpperCase()} am ${dayParam.charAt(0).toUpperCase() + dayParam.slice(1)}`
              : `Stundenplan (Woche) für Klasse ${className.toUpperCase()}`,
            schedule,
            textTable,
          };
          success = true;
        } catch (e: any) {
          console.error('get_schedule error:', e);
          result = { error: e.message || 'Fehler beim Laden des Stundenplans' };
        }
        break
      }

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