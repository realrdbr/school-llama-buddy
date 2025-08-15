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
            created_by: userProfile.user_id || null
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
              target_permission_level: parameters.targetPermissionLevel,
              created_by: userProfile.user_id?.toString() || null
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
          try {
            // Get available teachers and rooms from database for suggestions
            const { data: teachers } = await supabase
              .from('profiles')
              .select('name, username')
              .not('name', 'is', null)
              .limit(10);

            const { data: existingSubstitutions } = await supabase
              .from('vertretungsplan')
              .select('substitute_teacher, substitute_room, date, period')
              .gte('date', new Date().toISOString().split('T')[0]);

            // Simple AI logic for suggestions based on context
            const suggestions = [];
            const context = parameters.context || '';
            const prompt = parameters.prompt || '';

            // Generate basic suggestions based on available data
            if (teachers && teachers.length > 0) {
              const availableTeachers = teachers.filter(t => 
                !existingSubstitutions?.some(sub => sub.substitute_teacher === t.name)
              ).slice(0, 3);

              if (availableTeachers.length > 0) {
                suggestions.push(`Verfügbare Lehrkräfte: ${availableTeachers.map(t => t.name).join(', ')}`);
              }
            }

            // Room suggestions (basic logic)
            const commonRooms = ['101', '102', '103', '201', '202', '203', 'Aula', 'Turnhalle'];
            const occupiedRooms = existingSubstitutions?.map(sub => sub.substitute_room) || [];
            const availableRooms = commonRooms.filter(room => !occupiedRooms.includes(room)).slice(0, 3);
            
            if (availableRooms.length > 0) {
              suggestions.push(`Verfügbare Räume: ${availableRooms.join(', ')}`);
            }

            suggestions.push('Empfehlung: Prüfen Sie die aktuellen Stundenpläne für Konflikte');
            suggestions.push('Hinweis: Informieren Sie betroffene Klassen rechtzeitig');

            result = { 
              message: 'Vertretungsvorschläge generiert',
              suggestions: suggestions,
              availableTeachers: teachers?.map(t => t.name) || [],
              availableRooms: availableRooms
            };
            success = true;
          } catch (error) {
            result = { error: `Fehler bei der Generierung: ${error.message}` };
          }
        } else {
          result = { error: 'Keine Berechtigung für AI-Vertretungsplanung - Level 10 erforderlich' };
        }
        break

      case 'suggest_substitution':
        if (userProfile.permission_lvl >= 10) {
          try {
            // Get context for current substitution request
            const originalTeacher = parameters.originalTeacher || '';
            const className = parameters.className || '';
            const period = parameters.period || 1;
            const date = parameters.date || new Date().toISOString().split('T')[0];

            // Query database for suggestions
            const { data: teachers } = await supabase
              .from('profiles')
              .select('name, username')
              .not('name', 'is', null);

            const { data: conflicts } = await supabase
              .from('vertretungsplan')
              .select('substitute_teacher, substitute_room, class_name, period')
              .eq('date', date)
              .eq('period', period);

            // Filter out teachers already assigned in this period
            const busyTeachers = conflicts?.map(c => c.substitute_teacher) || [];
            const availableTeachers = teachers?.filter(t => 
              t.name !== originalTeacher && !busyTeachers.includes(t.name)
            ) || [];

            // Room suggestions
            const occupiedRooms = conflicts?.map(c => c.substitute_room) || [];
            const allRooms = ['101', '102', '103', '201', '202', '203', '301', '302', 'Aula', 'Turnhalle', 'Computerraum'];
            const availableRooms = allRooms.filter(room => !occupiedRooms.includes(room));

            result = {
              suggestedTeachers: availableTeachers.slice(0, 5).map(t => t.name),
              suggestedRooms: availableRooms.slice(0, 5),
              conflicts: conflicts?.length || 0,
              message: `${availableTeachers.length} Lehrkräfte und ${availableRooms.length} Räume verfügbar`
            };
            success = true;
          } catch (error) {
            result = { error: `Fehler bei Vorschlagsgenerierung: ${error.message}` };
          }
        } else {
          result = { error: 'Keine Berechtigung für Vertretungsvorschläge' };
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