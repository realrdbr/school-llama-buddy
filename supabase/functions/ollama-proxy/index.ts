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

    // Only use chat endpoint with messages format
    const url = 'https://gymolb.eduard.services/ai/api/chat';
    console.log(`Connecting to Ollama at: ${url}`);

    // Always use chat format with messages
    const messages = Array.isArray(requestBody?.messages)
      ? requestBody.messages
      : [{ role: 'user', content: requestBody?.prompt || '' }];
    
    const body = {
      model: requestBody.model,
      messages,
      stream: false,
      options: requestBody.options || undefined,
    };

    console.log(`Request body:`, JSON.stringify(body, null, 2));

    const ollamaResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API error: ${ollamaResponse.status} - ${ollamaResponse.statusText}`);
    }

    console.log(`Successfully connected to Ollama at: ${url}`);

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