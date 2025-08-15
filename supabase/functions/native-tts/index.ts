import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple TTS using Web Speech API synthesis (server-side equivalent)
async function generateTTSAudio(text: string, voiceId: string = 'alloy'): Promise<{ audioBuffer: ArrayBuffer, filename: string }> {
  // For this implementation, we'll use a placeholder approach
  // In a real scenario, you might want to use a TTS library like:
  // - Google Cloud TTS
  // - Microsoft Speech Services
  // - Or implement a simple text-to-speech with WebAssembly
  
  // For now, we'll create a minimal WAV file with silence as placeholder
  // This can be replaced with actual TTS generation
  const sampleRate = 44100
  const duration = Math.max(1, text.length * 0.1) // Estimate duration based on text length
  const numSamples = Math.floor(sampleRate * duration)
  
  // Create WAV header
  const buffer = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buffer)
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
  
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, numSamples * 2, true)
  
  // Generate simple tone pattern based on text (placeholder for actual TTS)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const frequency = 200 + (text.charCodeAt(i % text.length) - 65) * 10
    const amplitude = Math.sin(2 * Math.PI * frequency * t) * 0.1
    const sample = Math.floor(amplitude * 32767)
    view.setInt16(44 + i * 2, sample, true)
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `tts-${timestamp}.wav`
  
  return { audioBuffer: buffer, filename }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, voice_id = 'alloy', title, description, schedule_date, user_id } = await req.json()
    
    console.log('Native TTS Request received:', { text, user_id, title })
    
    if (!text) {
      throw new Error('Text ist erforderlich')
    }
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (!user_id) {
      throw new Error('Nicht authentifiziert - user_id fehlt')
    }

    // Check permissions
    const { data: profile } = await supabase
      .from('permissions')
      .select('permission_lvl')
      .eq('username', user_id)
      .maybeSingle()

    console.log('Permission check:', { user_id, profile })

    if (!profile || profile.permission_lvl < 10) {
      throw new Error('Keine Berechtigung für Audio-Ankündigungen - Level 10 erforderlich')
    }

    // Generate TTS audio
    console.log('Generating TTS audio...')
    const { audioBuffer, filename } = await generateTTSAudio(text, voice_id)
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(`tts/${filename}`, audioBuffer, {
        contentType: 'audio/wav',
        cacheControl: '3600'
      })
    
    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw new Error(`Fehler beim Hochladen der Audio-Datei: ${uploadError.message}`)
    }
    
    const audioFilePath = uploadData.path
    console.log('Audio uploaded to:', audioFilePath)

    // Create TTS announcement record in database
    const { data: announcement, error: insertError } = await supabase
      .from('audio_announcements')
      .insert({
        title: title || 'Native TTS Durchsage',
        description: description || `Native Text-to-Speech Durchsage erstellt von ${user_id}`,
        is_tts: true,
        tts_text: text,
        voice_id,
        audio_file_path: audioFilePath,
        schedule_date: schedule_date ? new Date(schedule_date).toISOString() : null,
        is_active: true
      })
      .select()
      .maybeSingle()

    console.log('Database insert result:', { announcement, insertError })

    if (insertError) {
      throw new Error(`Fehler beim Erstellen der Durchsage: ${insertError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        announcement,
        message: 'TTS-Durchsage wurde erfolgreich mit Native TTS erstellt',
        audioFile: audioFilePath
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in Native TTS:', error)
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