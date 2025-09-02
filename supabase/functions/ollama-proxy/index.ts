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

  // Only allow POST requests for chat endpoints
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST for chat requests.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405
      }
    )
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
        stream: false,
        options: requestBody.options || undefined,
      }
    }

    // Forward request to Ollama instance - try HTTP first to avoid TLS issues, then HTTPS
    const endpoints = [
      { url: 'https://gymolb.eduard.services/ai', paths: ['/api/generate', '/api/chat'] }
    ];
    
    let ollamaResponse: Response | null = null;
    let lastError: any;
    let connected = false;
    
    for (const endpoint of endpoints) {
      for (const path of endpoint.paths) {
        try {
          const url = `${endpoint.url}${path}`;
          console.log(`Trying Ollama at: ${url}`);
          
          // Choose appropriate body for endpoint - force non-streaming JSON for stability
          const useGenerate = path.endsWith('/api/generate');

          let body: any;
          if (useGenerate) {
            const prompt = requestBody?.prompt
              ?? (Array.isArray(requestBody?.messages)
                ? requestBody.messages.map((m: any) => {
                    const role = m.role || 'user';
                    const prefix = role === 'system' ? 'System' : role === 'assistant' ? 'Assistant' : 'User';
                    return `${prefix}: ${m.content}`;
                  }).join('\n\n')
                : '');
            body = {
              model: requestBody.model,
              prompt,
              stream: false,
              options: requestBody.options || undefined,
            };
          } else {
            const messages = Array.isArray(requestBody?.messages)
              ? requestBody.messages
              : [{ role: 'user', content: requestBody?.prompt || '' }];
            body = {
              model: requestBody.model,
              messages,
              stream: false,
              options: requestBody.options || undefined,
            };
          }

          ollamaResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
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

    // Log response details for debugging
    const contentType = ollamaResponse.headers.get('content-type') || 'unknown'
    console.log(`Response Content-Type: ${contentType}`)
    
    // Read raw text first to handle both JSON and NDJSON robustly
    const raw = await ollamaResponse.text()
    console.log(`Raw response length: ${raw.length}`)
    console.log(`Response starts with: ${raw.substring(0, 100)}...`)

    let responseData: any = null
    try {
      // Try full JSON first
      responseData = JSON.parse(raw)
      console.log('Successfully parsed as single JSON object')
    } catch (jsonError) {
      console.log('Single JSON parsing failed, trying NDJSON parsing...')
      
      // Handle NDJSON by parsing all valid JSON lines and merging
      const lines = raw.split(/\r?\n/).filter(Boolean)
      console.log(`Found ${lines.length} lines to parse`)
      
      const parsedLines: any[] = []
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          parsedLines.push(parsed)
        } catch (lineError) {
          console.log(`Failed to parse line: ${line.substring(0, 50)}...`)
        }
      }

      if (parsedLines.length > 0) {
        console.log(`Successfully parsed ${parsedLines.length} NDJSON lines`)
        
        // Find the final response object (where done: true)
        const finalObj = parsedLines.find(obj => obj.done === true) || parsedLines[parsedLines.length - 1]
        
        // Concatenate all message content from all lines
        const completeContent = parsedLines
          .filter(obj => obj.message?.content) // Only lines with content
          .map(obj => obj.message.content)
          .join('')
        
        console.log(`Complete content length: ${completeContent.length}`)
        console.log(`Complete content: ${completeContent.substring(0, 100)}...`)
        
        // Build the final response object
        responseData = {
          ...finalObj,
          response: completeContent,
          message: {
            role: 'assistant',
            content: completeContent
          }
        }
      } else {
        console.log('No valid JSON lines found, using raw content as fallback')
        // As a last resort, return the raw content as response
        responseData = { 
          response: raw,
          message: { role: 'assistant', content: raw }
        }
      }
    }

    // Normalize to chat-like shape for frontend compatibility
    const normalized = responseData?.message?.content
      ? responseData
      : { ...responseData, message: { role: 'assistant', content: String(responseData?.response ?? '') } }

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