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

    // Normalize payload: convert chat-style messages to generate prompt if necessary
    let payload: any = requestBody;
    if (requestBody && Array.isArray(requestBody.messages)) {
      const prompt = requestBody.messages.map((m: any) => {
        const role = m.role || 'user'
        const prefix = role === 'system' ? 'System' : role === 'assistant' ? 'Assistant' : 'User'
        return `${prefix}: ${m.content}`
      }).join('\n\n')
      payload = {
        model: requestBody.model,
        prompt,
        stream: !!requestBody.stream,
        options: requestBody.options || undefined,
      }
    }

    // Forward request to Ollama instance
    // Try new public IP first, then fallback to local endpoints for development
    const ollamaUrls = [
      'http://79.243.42.245:11434/api/generate',
      'http://host.docker.internal:11434/api/generate',
      'http://localhost:11434/api/generate',
      'http://127.0.0.1:11434/api/generate'
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
          body: JSON.stringify(payload)
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

    // Normalize to chat-like shape for frontend compatibility
    const normalized = responseData?.message?.content
      ? responseData
      : { ...responseData, message: { role: 'assistant', content: responseData?.response || '' } }

    return new Response(
      JSON.stringify(normalized),
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