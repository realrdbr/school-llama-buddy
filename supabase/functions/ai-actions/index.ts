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
          const { data, error } = await supabase.auth.admin.createUser({
            email: parameters.email,
            password: parameters.password,
            email_confirm: true,
          })
          
          if (!error && data.user) {
            // Create profile
            await supabase.from('profiles').insert({
              user_id: data.user.id,
              username: parameters.username,
              full_name: parameters.fullName,
              permission_id: parameters.permissionLevel
            })
            
            result = { message: `Benutzer ${parameters.username} wurde erfolgreich erstellt.` }
            success = true
          } else {
            result = { error: error?.message || 'Fehler beim Erstellen des Benutzers' }
          }
        } else {
          result = { error: 'Keine Berechtigung zum Erstellen von Benutzern' }
        }
        break

      case 'update_vertretungsplan':
        if (userProfile.permission_lvl >= 10) {
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
          
          const { data, error } = await supabase
            .from('vertretungsplan')
            .insert({
              date: dateValue.toISOString().split('T')[0], // Format as YYYY-MM-DD
              class_name: parameters.className,
              period: parseInt(parameters.period) || 1,
              original_teacher: parameters.originalTeacher,
              original_subject: parameters.originalSubject,
              original_room: parameters.originalRoom,
              substitute_teacher: parameters.substituteTeacher,
              substitute_subject: parameters.substituteSubject,
              substitute_room: parameters.substituteRoom,
              note: parameters.note,
              created_by: null  // Set to null since we're using username-based auth
            })
          
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
              created_by: null  // Set to null since we're using username-based auth
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