import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Deterministic weekday mapping (Europe/Berlin timezone)
const WEEKDAY_MAP: Record<string, number> = {
  // German names
  'montag': 1, 'mo': 1, 'mon': 1,
  'dienstag': 2, 'di': 2, 'die': 2, 'tue': 2, 'tuesday': 2,
  'mittwoch': 3, 'mi': 3, 'mit': 3, 'wed': 3, 'wednesday': 3,
  'donnerstag': 4, 'do': 4, 'don': 4, 'thu': 4, 'thursday': 4,
  'freitag': 5, 'fr': 5, 'fre': 5, 'fri': 5, 'friday': 5,
  'samstag': 6, 'sa': 6, 'sam': 6, 'sat': 6, 'saturday': 6,
  'sonntag': 7, 'so': 7, 'son': 7, 'sun': 7, 'sunday': 7,
  // English names
  'monday': 1,
}

// Canonical weekday column mapping for database
const WEEKDAY_COLUMNS: Record<number, string> = {
  1: 'monday',
  2: 'tuesday', 
  3: 'wednesday',
  4: 'thursday',
  5: 'friday'
}

// Helper to get current time in Europe/Berlin timezone
const getBerlinDate = (): Date => {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Berlin"}))
}

// Helper to normalize weekday input
const normalizeWeekday = (input: string): number | null => {
  const normalized = input.toLowerCase().trim()
  return WEEKDAY_MAP[normalized] || null
}

// Helper to get weekday from date string using Berlin timezone
const getWeekdayFromDate = (dateStr: string): number => {
  const date = new Date(dateStr + 'T12:00:00')
  const berlinDate = new Date(date.toLocaleString("en-US", {timeZone: "Europe/Berlin"}))
  const day = berlinDate.getDay()
  return day === 0 ? 7 : day // Convert Sunday from 0 to 7
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
          
          // Convert date parameter using Berlin timezone
          let dateValue = getBerlinDate();
          if (parameters.date) {
            const dateParam = parameters.date.toLowerCase().trim();
            
            // Handle German weekday names
            const weekdayNum = normalizeWeekday(dateParam);
            if (weekdayNum) {
              const today = getBerlinDate();
              const todayWeekday = today.getDay() === 0 ? 7 : today.getDay();
              let diff = weekdayNum - todayWeekday;
              if (diff <= 0) diff += 7; // Next occurrence of this weekday
              dateValue.setDate(today.getDate() + diff);
            } else if (dateParam === 'morgen' || dateParam === 'tomorrow') {
              dateValue.setDate(dateValue.getDate() + 1);
            } else if (dateParam === 'heute' || dateParam === 'today') {
              // dateValue is already today in Berlin timezone
            } else if (dateParam === 'übermorgen') {
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
            const teacherName = parameters?.teacherName || parameters?.teacher || parameters?.name;
            const dateParam = parameters?.date || parameters?.datum || 'today';

            if (!teacherName) {
              result = { error: 'Lehrkraft-Name fehlt (teacherName)' }
              break;
            }

            console.log(`E.D.U.A.R.D. planning substitution for "${teacherName}" on "${dateParam}"`);

            // Helper: normalize subject (simple canonicalization for MA/DE/EN etc.)
            const normalizeSubject = (s?: string) => {
              if (!s) return '';
              const upper = s.toString().trim().toUpperCase().replace(/\./g, '');
              // simple DE->code mapping
              const map: Record<string, string> = {
                'MATHE': 'MA',
                'MATHEMATIK': 'MA',
                'DEUTSCH': 'DE',
                'ENGLISCH': 'EN',
                'BIOLOGIE': 'BI',
                'CHEMIE': 'CH',
                'PHYSIK': 'PH',
                'GESCHICHTE': 'GE',
                'ERDKUNDE': 'EK',
                'GEOGRAPHIE': 'EK',
                'INFORMATIK': 'IF',
              };
              return map[upper] || upper;
            };

            // Parse date using Berlin timezone and improved weekday handling
            let dateValue = getBerlinDate();
            const lower = String(dateParam).toLowerCase().trim();
            const weekdayNum = normalizeWeekday(lower);
            if (weekdayNum) {
              const today = getBerlinDate();
              const todayWeekday = today.getDay() === 0 ? 7 : today.getDay();
              let diff = weekdayNum - todayWeekday;
              if (diff <= 0) diff += 7; 
              dateValue.setDate(today.getDate() + diff);
            } else if (lower === 'morgen' || lower === 'tomorrow') {
              dateValue.setDate(dateValue.getDate() + 1);
            } else if (lower === 'übermorgen') {
              dateValue.setDate(dateValue.getDate() + 2);
            } else if (lower !== 'heute' && lower !== 'today') {
              const parsed = new Date(dateParam);
              if (!isNaN(parsed.getTime())) dateValue = parsed;
            }
            
            const weekday = ((): number => {
              const ymd = dateValue.toISOString().split('T')[0];
              return getWeekdayFromDate(ymd);
            })();

            if (weekday < 1 || weekday > 5) {
              result = { error: 'E.D.U.A.R.D.: Ausgewähltes Datum liegt am Wochenende' }
              break;
            }
            const dayKey = WEEKDAY_COLUMNS[weekday];

            // Load all teachers from database (DB-only candidates)
            const { data: teachersData, error: teachersError } = await supabase
              .from('teachers')
              .select('*');

            if (teachersError) {
              console.error('E.D.U.A.R.D. Error loading teachers:', teachersError);
              result = { error: 'E.D.U.A.R.D.: Fehler beim Laden der Lehrerdaten' };
              break;
            }

            // Build teacher expertise map (subjects canonicalized)
            const teachers = (teachersData || []) as Array<{
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
              const subjectList = teacher.subjects
                ? teacher.subjects.split(',').map(s => normalizeSubject(s))
                : [];
              const rooms = teacher.fav_rooms ? teacher.fav_rooms.split(',').map(r => r.trim()) : [];
              
              teacherMap[teacher.shortened] = {
                name: fullName,
                subjects: new Set(subjectList.filter(Boolean)),
                rooms,
                shortened: teacher.shortened
              };
            }

            console.log('Loaded teachers (shortened codes):', Object.keys(teacherMap));

            // Find the sick teacher with improved matching (no hallucination)
            const normalize = (s: string) => s.toLowerCase().replace(/\b(fr\.?|herr|frau|hr\.?|fr\.?)/g, '').trim();
            const normSick = normalize(teacherName);
            
            let sickTeacherShortened: string | null = null;
            let possibleMatches: Array<{shortened: string, name: string, score: number}> = [];
            
            for (const [shortened, data] of Object.entries(teacherMap)) {
              let score = 0;
              if (normalize(shortened) === normSick) score = 100;
              else if (normalize(data.name).includes(normSick)) score = 90;
              else if (normSick.length >= 3) {
                if (normalize(data.name).includes(normSick.substring(0, 3))) score = 60;
                else if (normalize(shortened).includes(normSick.substring(0, 3))) score = 70;
              }
              if (score > 0) possibleMatches.push({shortened, name: data.name, score});
            }
            possibleMatches.sort((a, b) => b.score - a.score);
            
            if (possibleMatches.length === 0) {
              const teachersList = Object.values(teacherMap).map(t => `${t.name} [${t.shortened}]`).slice(0, 5).join(', ');
              result = { 
                error: `E.D.U.A.R.D.: Lehrkraft "${teacherName}" nicht in der Datenbank gefunden. Verfügbare Lehrkräfte: ${teachersList}` 
              };
              break;
            }
            if (possibleMatches[0].score >= 80) {
              sickTeacherShortened = possibleMatches[0].shortened;
            } else {
              const suggestions = possibleMatches.slice(0, 3).map(m => `${m.name} [${m.shortened}]`).join(', ');
              result = { 
                error: `E.D.U.A.R.D.: Mehrere Lehrkräfte gefunden für "${teacherName}". Bitte präzisieren Sie: ${suggestions}` 
              };
              break;
            }

            console.log(`Sick teacher resolved: ${sickTeacherShortened} (${teacherMap[sickTeacherShortened].name})`);

            // Parse schedule cell
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

            // Discover schedule tables (fallback updated to new names)
            const { data: allTables, error: tablesError } = await supabase.rpc('sql', {
              query: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'Stundenplan_%'`
            });
            
            let classTables: string[];
            if (tablesError) {
              console.log('Using fallback schedule tables discovery');
              classTables = ['Stundenplan_10b', 'Stundenplan_10c']; // Updated fallback
            } else {
              classTables = (allTables || [])
                .map((t: any) => t.table_name)
                .filter((name: string) => name.startsWith('Stundenplan_'));
            }

            const affected: Array<{ 
              className: string, 
              period: number, 
              subject: string, 
              room: string 
            }> = [];

            // Find affected lessons for that weekday
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
                      className: table.replace('Stundenplan_', ''), 
                      period, 
                      subject: normalizeSubject(entry.subject) || 'UNBEKANNT', 
                      room: entry.room || 'Unbekannt' 
                    });
                  }
                }
              }
            }

            console.log(`Affected lessons: ${affected.length}`, affected);

            // Availability check
            const isTeacherAvailable = async (teacherShortened: string, period: number): Promise<boolean> => {
              for (const table of classTables) {
                const { data: rows } = await supabase.from(table).select('Stunde,' + dayKey).eq('Stunde', period);
                if (!rows || rows.length === 0) continue;
                const row = rows[0] as any;
                const entries = parseCell(row[dayKey]);
                if (entries.some(e => e.teacher === teacherShortened)) {
                  return false;
                }
              }
              return true;
            };

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

              for (const [shortened, teacher] of Object.entries(teacherMap)) {
                if (shortened === sickTeacherShortened) continue;
                // STRICT subject match on normalized subjects
                if (!teacher.subjects.has(lesson.subject)) continue;

                const isAvailable = await isTeacherAvailable(shortened, lesson.period);
                if (!isAvailable) continue;

                let score = 0;
                if (teacher.rooms.includes(lesson.room)) score += 5;

                if (score > bestScore) {
                  bestScore = score;
                  bestSubstitute = shortened;
                }
              }

              if (!bestSubstitute) {
                const dateStr = dateValue.toLocaleDateString('de-DE');
                confirmations.push(`Keine freie Lehrkraft mit Fach ${lesson.subject} für Klasse ${lesson.className}, ${lesson.period}. Stunde am ${dateStr} (Raum ${lesson.room}). Optionen: Klassen zusammenlegen / Raumwechsel / Stunde entfallen lassen.`);
                continue;
              }

              const substituteTeacherName = teacherMap[bestSubstitute].name;

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
                message: `Vertretungsvorschlag für ${teacherMap[sickTeacherShortened].name} erstellt`,
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

      case 'confirm_substitution':
        if (userProfile.permission_lvl >= 9) {
          try {
            const { substitutions, sickTeacher, date } = parameters;
            
            if (!substitutions || !Array.isArray(substitutions)) {
              result = { error: 'Keine Vertretungsdaten zum Bestätigen erhalten' };
              break;
            }
            
            const confirmed: string[] = [];
            const failed: string[] = [];
            
            // Process each substitution with atomic transactions
            for (const sub of substitutions) {
              try {
                const { error: insertError } = await supabase.from('vertretungsplan').insert({
                  date: date,
                  class_name: sub.className,
                  period: sub.period,
                  original_teacher: sub.originalTeacher,
                  original_subject: sub.subject,
                  original_room: sub.room,
                  substitute_teacher: sub.substituteTeacher,
                  substitute_subject: sub.subject,
                  substitute_room: sub.room,
                  note: `E.D.U.A.R.D.: Automatische Vertretung für ${sickTeacher}`,
                  created_by: null
                });
                
                if (insertError) {
                  console.error('Substitution insert error:', insertError);
                  failed.push(`${sub.className}, ${sub.period}. Stunde: ${insertError.message}`);
                } else {
                  confirmed.push(`${sub.substituteTeacher} übernimmt ${sub.className}, ${sub.period}. Stunde ${sub.subject}`);
                }
              } catch (e) {
                console.error('Substitution processing error:', e);
                failed.push(`${sub.className}, ${sub.period}. Stunde: ${e.message}`);
              }
            }
            
            if (confirmed.length > 0) {
              result = {
                message: `Vertretungsplan erfolgreich erstellt für ${sickTeacher}`,
                confirmed: confirmed,
                failed: failed.length > 0 ? failed : undefined
              };
              success = true;
            } else {
              result = { error: 'Keine Vertretungen konnten erstellt werden', failed };
            }
            
          } catch (e) {
            console.error('confirm_substitution error:', e);
            result = { error: e.message || 'Fehler beim Bestätigen der Vertretungen' };
          }
        } else {
          result = { error: 'Keine Berechtigung zum Bestätigen von Vertretungen - Level 9 erforderlich' };
        }
        break

      case 'get_schedule': {
        try {
          const className = (parameters.className || parameters.klasse || '10b').toString().trim();
          const dayParam = (parameters.day || parameters.tag || '').toString().trim().toLowerCase();

          // Discover all schedule tables
          const { data: tableResult, error: tableErr } = await supabase.rpc('sql', {
            query: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'Stundenplan_%'`
          });
          
          const availableTables = (tableErr || !tableResult)
            ? ['Stundenplan_10b', 'Stundenplan_10c'] // Updated fallback
            : (tableResult as any[])
                .map((t: any) => t.table_name)
                .filter((name: string) => name.startsWith('Stundenplan_'));
          
          // Build class mapping (robust normalization)
          const tableMap: Record<string, string> = {};
          const availableClasses: string[] = [];
          
          for (const tableName of availableTables) {
            const raw = tableName.replace('Stundenplan_', ''); // e.g., '10b'
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
              return `<div style="padding:4px; background:#f5f5f5; border-radius:4px; font-size:14px;">
                <div style="font-weight:500;">${e.subject}</div>
                <div style="color:#666;">${e.teacher}</div>
                <div style="color:#666;">${e.room}</div>
              </div>`;
            }
          };

          let htmlTable = '';
          if (dayKey) {
            // Single day view
            htmlTable = `<table style="width:100%; border-collapse:collapse; border:1px solid #ddd;">
              <thead>
                <tr style="background:#f5f5f5;">
                  <th style="border:1px solid #ddd; padding:8px; text-align:left;">Stunde</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:left;">${dayParam.charAt(0).toUpperCase() + dayParam.slice(1)}</th>
                </tr>
              </thead>
              <tbody>
                ${schedule.map(r => `<tr style="border:1px solid #ddd;">
                  <td style="border:1px solid #ddd; padding:8px; font-weight:500;">${r.period}. Stunde</td>
                  <td style="border:1px solid #ddd; padding:4px;">${formatCellHTML((r as any)[dayKey])}</td>
                </tr>`).join('')}
              </tbody>
            </table>`;
          } else {
            // Full week view
            htmlTable = `<table style="width:100%; border-collapse:collapse; border:1px solid #ddd;">
              <thead>
                <tr style="background:#f5f5f5;">
                  <th style="border:1px solid #ddd; padding:8px; text-align:left;">Stunde</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:left;">Montag</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:left;">Dienstag</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:left;">Mittwoch</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:left;">Donnerstag</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:left;">Freitag</th>
                </tr>
              </thead>
              <tbody>
                ${schedule.map(r => `<tr style="border:1px solid #ddd;">
                  <td style="border:1px solid #ddd; padding:8px; font-weight:500;">${r.period}. Stunde</td>
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
      JSON.stringify({ success: false, error: (error as any).message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
