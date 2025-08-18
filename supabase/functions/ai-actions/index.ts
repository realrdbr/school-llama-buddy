
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

// Helper to normalize teacher names (remove honorifics)
const normalizeTeacherName = (name: string): string => {
  return name.toLowerCase()
    .replace(/\b(fr\.?|herr|frau|hr\.?|fr\.?)\s+/g, '')
    .trim()
}

// Robust date text parser for German inputs, always returning a school day (Mon-Fri)
const parseDateTextToBerlinSchoolDay = (raw?: string): Date => {
  const now = getBerlinDate();
  if (!raw || typeof raw !== 'string') return adjustWeekend(now);
  let text = raw.toLowerCase().trim();

  // Qualifiers influence next/over-next week
  let weekOffset = 0;
  if (/übernächste?n?/.test(text)) weekOffset = 2;
  else if (/nächste?n?|kommende?n?/.test(text)) weekOffset = 1;

  // Remove filler words
  text = text.replace(/\b(am|den|diesen|kommenden|kommende|nächsten|nächster|nächste|übernächsten|übernächste)\b/g, '').trim();

  const today = getBerlinDate();
  const todayW = today.getDay() === 0 ? 7 : today.getDay();

  const moveToNextOccurrence = (targetW: number) => {
    let diff = targetW - todayW;
    if (diff <= 0) diff += 7;
    const d = new Date(today);
    d.setDate(d.getDate() + diff + weekOffset * 7);
    return adjustWeekend(d);
  };

  // Common relative cases
  if (text === 'heute' || text === 'today') return adjustWeekend(today);
  if (text === 'morgen' || text === 'tomorrow') return adjustWeekend(new Date(today.setDate(today.getDate() + 1)));
  if (text === 'übermorgen') return adjustWeekend(new Date(now.setDate(now.getDate() + 2)));

  // Weekday names contained anywhere in the string
  for (const [k, v] of Object.entries(WEEKDAY_MAP)) {
    if (v >= 1 && v <= 7 && text.includes(k)) {
      return moveToNextOccurrence(v);
    }
  }

  // Try DD.MM.YYYY
  const m = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10) - 1;
    const yyyy = parseInt(m[3], 10);
    const dt = new Date(Date.UTC(yyyy, mm, dd, 12, 0, 0));
    return adjustWeekend(new Date(dt.toLocaleString('en-US', { timeZone: 'Europe/Berlin' })));
  }

  // Try native Date
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return adjustWeekend(parsed);

  // Fallback: next Monday
  const d = getBerlinDate();
  const w = d.getDay() === 0 ? 7 : d.getDay();
  const toMonday = w === 7 ? 1 : (8 - w);
  d.setDate(d.getDate() + toMonday);
  return d;
}

// Ensure Mon-Fri; if Sat/Sun, push to next Monday
const adjustWeekend = (date: Date): Date => {
  const d = new Date(date);
  const w = d.getDay() === 0 ? 7 : d.getDay();
  if (w === 6) d.setDate(d.getDate() + 2);
  if (w === 7) d.setDate(d.getDate() + 1);
  return d;
};

// Block times for the school system
const BLOCK_TIMES = {
  1: { start: '07:45', end: '09:15', periods: [1, 2] },
  2: { start: '09:35', end: '11:05', periods: [3, 4] },
  3: { start: '11:50', end: '13:20', periods: [5, 6] },
  4: { start: '13:45', end: '15:15', periods: [7, 8] }
}

// Helper to get next lesson for a user in a specific subject
const getNextLesson = async (supabase: any, userClass: string, subject: string) => {
  const today = getBerlinDate()
  const currentDay = today.getDay() === 0 ? 7 : today.getDay()
  
  // Get schedule for the user's class
  const tableName = `Stundenplan_${userClass}_A`
  const { data: schedule } = await supabase.from(tableName).select('*')
  
  if (!schedule || schedule.length === 0) return null
  
  // Find next occurrence of the subject
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDay = ((currentDay - 1 + dayOffset) % 7) + 1
    const dayColumn = WEEKDAY_COLUMNS[checkDay]
    
    if (!dayColumn) continue
    
    for (const row of schedule) {
      if (row[dayColumn] && row[dayColumn].toLowerCase().includes(subject.toLowerCase())) {
        const [subjectCode, teacher, room] = row[dayColumn].split(' ')
        const block = Math.ceil(row.Stunde / 2)
        
        return {
          day: Object.keys(WEEKDAY_MAP).find(k => WEEKDAY_MAP[k] === checkDay),
          date: new Date(today.getTime() + dayOffset * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE'),
          period: row.Stunde,
          block: block,
          blockTime: BLOCK_TIMES[block],
          subject: subjectCode,
          teacher: teacher,
          room: room
        }
      }
    }
  }
  return null
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
            const voice_id = parameters.voice_id || 'Aria';

            if (!text) {
              result = { error: 'Text für TTS-Durchsage fehlt' };
              break;
            }

            // Invoke native-tts edge function to actually generate audio
            // Pass the username for permission check compatibility
            const { data: ttsData, error: ttsError } = await supabase.functions.invoke('native-tts', {
              body: {
                text,
                voice_id,
                title,
                user_id: userProfile?.name || userProfile?.username || 'admin'
              }
            });

            if (ttsError) {
              console.error('native-tts invoke error:', ttsError);
              result = { error: ttsError.message || 'Fehler bei TTS-Erstellung' };
              break;
            }

            result = {
              message: `TTS-Durchsage "${title}" wurde erstellt` ,
              tts: ttsData || null,
            };
            success = true;
          } catch (e: any) {
            console.error('create_tts error:', e);
            result = { error: e?.message || 'Unerwarteter Fehler bei TTS' };
          }
        } else {
          result = { error: 'Keine Berechtigung für TTS-Durchsagen - Level 10 erforderlich' }
        }
        break

      case 'show_substitution_plan':
        // Show current substitution plan
        const targetDate = parseDateTextToBerlinSchoolDay(parameters?.date || 'heute')
        const dateStr = targetDate.toISOString().split('T')[0]
        
        const { data: substitutions } = await supabase
          .from('vertretungsplan')
          .select('*')
          .eq('date', dateStr)
          .order('class_name, period')
        
        if (!substitutions || substitutions.length === 0) {
          result = { 
            message: `Keine Vertretungen für ${targetDate.toLocaleDateString('de-DE')} gefunden.`,
            date: targetDate.toLocaleDateString('de-DE')
          }
        } else {
          const formattedSubs = substitutions.map(sub => {
            const block = Math.ceil(sub.period / 2)
            const blockTime = BLOCK_TIMES[block]
            return `${sub.class_name}, ${sub.period}. Stunde (Block ${block}: ${blockTime.start}-${blockTime.end}): ${sub.original_subject} bei ${sub.original_teacher} → ${sub.substitute_subject} bei ${sub.substitute_teacher} (Raum: ${sub.substitute_room})`
          }).join('\n')
          
          result = {
            message: `Vertretungsplan für ${targetDate.toLocaleDateString('de-DE')}:\n\n${formattedSubs}`,
            date: targetDate.toLocaleDateString('de-DE'),
            substitutions: substitutions
          }
        }
        success = true
        break

      case 'get_block_times':
        result = {
          message: 'Unterrichtszeiten:\n\nBlock 1: 07:45 – 09:15 (1. und 2. Stunde)\nBlock 2: 09:35 – 11:05 (3. und 4. Stunde)\nBlock 3: 11:50 – 13:20 (5. und 6. Stunde)\nBlock 4: 13:45 – 15:15 (7. und 8. Stunde)',
          blocks: BLOCK_TIMES
        }
        success = true
        break

      case 'next_lesson':
        if (userProfile.user_class && parameters?.subject) {
          const nextLesson = await getNextLesson(supabase, userProfile.user_class, parameters.subject)
          if (nextLesson) {
            result = {
              message: `Nächste ${parameters.subject}-Stunde: ${nextLesson.day}, ${nextLesson.date}, ${nextLesson.period}. Stunde (Block ${nextLesson.block}: ${nextLesson.blockTime.start}-${nextLesson.blockTime.end}) bei ${nextLesson.teacher} in Raum ${nextLesson.room}`,
              lesson: nextLesson
            }
          } else {
            result = { message: `Keine ${parameters.subject}-Stunde in den nächsten 7 Tagen gefunden.` }
          }
        } else {
          result = { message: 'Klasse oder Fach nicht angegeben. Bitte geben Sie beide Parameter an.' }
        }
        success = true
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

            // Parse date using robust parser and force to school day
            let dateValue = parseDateTextToBerlinSchoolDay(dateParam?.toString() || 'today');
            
            const weekday = ((): number => {
              const ymd = dateValue.toISOString().split('T')[0];
              return getWeekdayFromDate(ymd);
            })();
            
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
            const normSick = normalizeTeacherName(teacherName);
            
            let sickTeacherShortened: string | null = null;
            let possibleMatches: Array<{shortened: string, name: string, score: number}> = [];
            
            for (const [shortened, data] of Object.entries(teacherMap)) {
              let score = 0;
              const normTeacherName = normalizeTeacherName(data.name);
              const normShortened = normalizeTeacherName(shortened);
              
              if (normShortened === normSick) score = 100;
              else if (normTeacherName.includes(normSick)) score = 90;
              else if (normSick.length >= 3) {
                if (normTeacherName.includes(normSick.substring(0, 3))) score = 60;
                else if (normShortened.includes(normSick.substring(0, 3))) score = 70;
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

            // Use all available schedule tables (supporting all classes)
            const classTables = ['Stundenplan_10b_A', 'Stundenplan_10c_A'];

            const affected: Array<{ 
              className: string, 
              period: number, 
              subject: string, 
              room: string 
            }> = [];

            // Find affected lessons for that weekday (all classes)
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
                    const className = table.replace('Stundenplan_', '').replace('_A', '');
                    affected.push({ 
                      className, 
                      period, 
                      subject: normalizeSubject(entry.subject) || 'UNBEKANNT', 
                      room: entry.room || 'Unbekannt' 
                    });
                  }
                }
              }
            }

            console.log(`Affected lessons: ${affected.length}`, affected);

            // Availability check (improved to check all classes)
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
                  dateISO: dateValue.toISOString().split('T')[0],
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
          const { data, error } = await supabase.from('teachers').select('*');
          if (error) throw error;
          const teachersRaw = (data || []) as any[];
          const teachers = teachersRaw
            .map((t: any) => ({
              firstName: t['first name'],
              lastName: t['last name'],
              shortened: t['shortened'],
              subjects: t['subjects'],
              fav_rooms: t['fav_rooms'] || null,
            }))
            .sort((a: any, b: any) => String(a.lastName || '').localeCompare(String(b.lastName || ''), 'de'));
          
          // Format as HTML table instead of plain text
          const htmlTable = `
            <table style="width:100%; border-collapse:collapse; border:1px solid #ddd; margin-top:10px;">
              <thead>
                <tr style="background:#f5f5f5;">
                  <th style="border:1px solid #ddd; padding:8px; text-align:left;">Name</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:left;">Kürzel</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:left;">Fächer</th>
                  <th style="border:1px solid #ddd; padding:8px; text-align:left;">Räume</th>
                </tr>
              </thead>
              <tbody>
                ${teachers.map(t => `
                  <tr>
                    <td style="border:1px solid #ddd; padding:8px;">${t.lastName}, ${t.firstName}</td>
                    <td style="border:1px solid #ddd; padding:8px; font-weight:bold;">${t.shortened}</td>
                    <td style="border:1px solid #ddd; padding:8px;">${t.subjects}</td>
                    <td style="border:1px solid #ddd; padding:8px;">${t.fav_rooms || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
          
          const textList = teachers.map(t => `- ${t.lastName}, ${t.firstName} [${t.shortened}] — ${t.subjects}`).join('\n');
          result = { 
            message: `Es wurden ${teachers.length} Lehrkräfte geladen.`, 
            teachers, 
            textList,
            htmlTable
          };
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
            const inserted: any[] = [];
            
            // Process each substitution with atomic transactions
            // Parse incoming date to ISO once (supports 'YYYY-MM-DD' and 'DD.MM.YYYY')
            const parseDateToISO = (d: string): string => {
              if (!d) return new Date().toISOString().split('T')[0];
              if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
              const m = d.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
              if (m) {
                const dd = parseInt(m[1], 10);
                const mm = parseInt(m[2], 10) - 1;
                const yyyy = parseInt(m[3], 10);
                const dt = new Date(Date.UTC(yyyy, mm, dd, 12, 0, 0));
                return dt.toISOString().split('T')[0];
              }
              const t = new Date(d);
              if (!isNaN(t.getTime())) return t.toISOString().split('T')[0];
              console.warn('Unrecognized date format for substitution confirmation, defaulting to today:', d);
              return new Date().toISOString().split('T')[0];
            };
            const isoDate = parseDateToISO(date);

            for (const sub of substitutions) {
              try {
                const { data: insertedRow, error: insertError } = await supabase.from('vertretungsplan').insert({
                  date: isoDate,
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
                }).select().single();
                
                if (insertError) {
                  console.error('Substitution insert error:', insertError);
                  failed.push(`${sub.className}, ${sub.period}. Stunde: ${insertError.message}`);
                } else {
                  confirmed.push(`${sub.substituteTeacher} übernimmt ${sub.className}, ${sub.period}. Stunde ${sub.subject}`);
                  inserted.push(insertedRow);
                  console.log('Substitution inserted:', { id: insertedRow?.id, date: isoDate, class_name: sub.className, period: sub.period, subject: sub.subject, substitute: sub.substituteTeacher });
                }
              } catch (e) {
                console.error('Substitution processing error:', e);
                failed.push(`${sub.className}, ${sub.period}. Stunde: ${e.message}`);
              }
            }
            
            if (confirmed.length > 0) {
              console.log('confirm_substitution inserted rows:', inserted.map(r => r?.id));

              // Create announcements for each inserted substitution
              try {
                const dateStrDE = new Date(isoDate + 'T12:00:00').toLocaleDateString('de-DE');
                const ann = inserted.map((r: any) => ({
                  title: `Vertretungsplan aktualisiert – ${r.class_name}`,
                  content: `${dateStrDE}, ${r.period}. Stunde: ${r.original_subject} bei ${r.original_teacher} wird vertreten durch ${r.substitute_teacher} (Raum: ${r.substitute_room}).`,
                  author: 'E.D.U.A.R.D.',
                  priority: 'high',
                  target_class: r.class_name,
                  target_permission_level: 1,
                  created_by: null,
                }));
                const { error: annErr } = await supabase.from('announcements').insert(ann);
                if (annErr) console.error('Announcement insert error:', annErr);
              } catch (e) {
                console.error('Announcement creation failed:', e);
              }

              result = {
                message: `Vertretungsplan erfolgreich erstellt für ${sickTeacher}`,
                confirmed: confirmed,
                inserted,
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
