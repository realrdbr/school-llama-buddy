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

    // Forward request to Ollama instance
    // Try public IP first, then fallback to local endpoints for development
    const ollamaUrls = [
      'http://79.243.36.52:11434/api/chat',
      'http://host.docker.internal:11434/api/chat',
      'http://localhost:11434/api/chat',
      'http://127.0.0.1:11434/api/chat'
    ];
    
    let ollamaResponse;
    let lastError;
    
    for (const url of ollamaUrls) {
      try {
        console.log(`Trying Ollama at: ${url}`);
        ollamaResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        if (ollamaResponse.ok) {
          console.log(`Successfully connected to Ollama at: ${url}`);
          break;
        } else {
          throw new Error(`Ollama API error: ${ollamaResponse.status}`);
        }
      } catch (error) {
        console.error(`Failed to connect to ${url}:`, error.message);
        lastError = error;
        ollamaResponse = null;
      }
    }

    if (!ollamaResponse) {
      throw new Error(`Could not connect to Ollama. Last error: ${lastError?.message}`);
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
        details: 'Stelle sicher, dass Ollama auf 127.0.0.1:11434 läuft und das Modell llama3.1:8b installiert ist.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})