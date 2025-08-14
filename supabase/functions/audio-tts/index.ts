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
    const { text, voice_id = 'alloy', title, description, schedule_date, user_id } = await req.json()
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // user_id is already extracted from the request body above
    
    if (!user_id) {
      throw new Error('Nicht authentifiziert - user_id fehlt')
    }

    // Check permissions using our custom permission system
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        *,
        permissions!inner(permission_lvl)
      `)
      .eq('user_id', user_id)
      .single()

    if (!profile || profile.permissions.permission_lvl < 10) {
      throw new Error('Keine Berechtigung für Durchsagen')
    }

    // Create TTS announcement record
    const { data: announcement, error: insertError } = await supabase
      .from('audio_announcements')
      .insert({
        title,
        description,
        is_tts: true,
        tts_text: text,
        voice_id,
        schedule_date: schedule_date ? new Date(schedule_date).toISOString() : null,
        created_by: user_id,
        is_active: true
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Fehler beim Erstellen der Durchsage: ${insertError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        announcement,
        message: 'TTS-Durchsage wurde erfolgreich erstellt'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in TTS generation:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})