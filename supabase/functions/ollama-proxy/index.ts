import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json()

    // Get Ollama API URL from environment variable with fallback
    const ollamaApiUrl = Deno.env.get('OLLAMA_API_URL') || 'http://127.0.0.1:11434/api/chat'

    // Forward request to local Ollama instance
    const ollamaResponse = await fetch(ollamaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API error: ${ollamaResponse.status}`)
    }

    const responseData = await ollamaResponse.json()

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Ollama proxy error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: `Stelle sicher, dass Ollama läuft und erreichbar ist über: ${Deno.env.get('OLLAMA_API_URL') || 'http://127.0.0.1:11434'} und das Modell llama3.1:8b installiert ist.`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})