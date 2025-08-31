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
    // Try endpoints in priority order as specified
    const endpoints = [
      { url: 'https://gymolb.eduard.services/ollama', paths: ['/api/generate', '/api/chat'] },
      { url: 'http://79.243.42.245:11434', paths: ['/api/chat'] },
      { url: 'https://gymolb.eduard.services/ollama_fallback', paths: ['/api/generate', '/api/chat'] },
      { url: 'http://79.243.42.245:11435', paths: ['/api/chat'] }
    ];
    
    let ollamaResponse: Response | null = null;
    let lastError: any;
    let connected = false;
    
    for (const endpoint of endpoints) {
      for (const path of endpoint.paths) {
        try {
          const url = `${endpoint.url}${path}`;
          console.log(`Trying Ollama at: ${url}`);
          
          // Choose appropriate body for endpoint
          const body = path.endsWith('/api/generate')
            ? payload
            : (requestBody && Array.isArray(requestBody.messages)
                ? {
                    model: requestBody.model,
                    messages: requestBody.messages,
                    stream: !!requestBody.stream,
                    options: requestBody.options || undefined,
                  }
                : {
                    model: requestBody.model,
                    messages: [{ role: 'user', content: payload?.prompt || requestBody?.prompt || '' }],
                    stream: !!requestBody.stream,
                    options: requestBody.options || undefined,
                  }
              );
    
          ollamaResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
    
          if (ollamaResponse.ok) {
            console.log(`Successfully connected to Ollama at: ${url}`);
            connected = true;
            break;
          } else {
            throw new Error(`Ollama API error: ${ollamaResponse.status}`);
          }
        } catch (error) {
          console.error(`Failed to connect to ${endpoint.url}${path}:`, (error as any).message || error);
          lastError = error;
          ollamaResponse = null;
          continue;
        }
      }
      if (connected) break;
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
        details: 'Stelle sicher, dass Ollama auf 127.0.0.1:11434 läuft und das Modell Redbear/e.d.u.a.r.d. installiert ist.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})