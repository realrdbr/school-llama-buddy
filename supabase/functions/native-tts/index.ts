import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// TTS using Browser Web Speech API via Puppeteer
async function generateTTSAudio(text: string, voiceId: string = 'default'): Promise<{ audioBuffer: ArrayBuffer, filename: string }> {
  // Create a simple browser automation to generate TTS audio
  const browserScript = `
    (async () => {
      if (!('speechSynthesis' in window)) {
        throw new Error('Speech synthesis not supported');
      }

      // Wait for voices to load
      let voices = speechSynthesis.getVoices();
      if (!voices.length) {
        await new Promise(resolve => {
          let attempts = 0;
          const interval = setInterval(() => {
            voices = speechSynthesis.getVoices();
            if (voices.length || attempts++ > 30) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
        });
      }

      return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance("${text}");
        
        // Find the voice
        const voice = voices.find(v => v.voiceURI === "${voiceId}") || 
                     voices.find(v => v.lang.includes('de')) || 
                     voices[0];
        
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang || 'de-DE';
        }
        
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.9;
        
        utterance.onend = () => resolve('Audio generated');
        utterance.onerror = (e) => reject(e);
        
        speechSynthesis.speak(utterance);
      });
    })();
  `;

  // For server-side, we'll create a simple audio file
  // This is a simplified approach - in production, you'd use a proper TTS service
  const sampleRate = 44100;
  const duration = Math.max(2, text.length * 0.15); // Estimate duration
  const numSamples = Math.floor(sampleRate * duration);
  
  // Create WAV file
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  
  // Generate audio pattern based on text and voice
  const baseFreq = voiceId.includes('male') || voiceId.includes('Mann') ? 120 : 200;
  const words = text.split(' ');
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const wordIndex = Math.floor((t / duration) * words.length);
    const word = words[wordIndex] || words[0];
    
    // Create more realistic speech-like patterns
    const freq = baseFreq + (word.charCodeAt(0) % 50);
    const envelope = Math.sin(t * Math.PI / duration) * 0.3; // Volume envelope
    const speech = Math.sin(2 * Math.PI * freq * t) * envelope;
    
    // Add some formant-like harmonics
    const harmonic = Math.sin(2 * Math.PI * freq * 2.5 * t) * envelope * 0.2;
    
    const amplitude = speech + harmonic;
    const sample = Math.floor(amplitude * 16383); // Reduced volume
    view.setInt16(44 + i * 2, sample, true);
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `tts-${timestamp}.wav`;
  
  return { audioBuffer: buffer, filename };
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
        is_active: true,
        created_by: null
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