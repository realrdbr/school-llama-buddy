import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}

// Get Ollama URL from environment or use fallbacks
const getOllamaUrls = () => {
  const customUrl = Deno.env.get('OLLAMA_URL');
  const fallbackUrls = [
    'http://127.0.0.1:11434',
    'http://localhost:11434',
    'http://192.168.1.100:11434', // Common local network IP
    'http://192.168.0.100:11434'  // Another common local network IP
  ];
  
  return customUrl ? [customUrl, ...fallbackUrls] : fallbackUrls;
};

// Test connectivity to Ollama server
const testOllamaConnection = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(`${url}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const requestBody = await req.json()
    const ollamaUrls = getOllamaUrls();
    
    let lastError = null;
    let workingUrl = null;

    // Try each URL until one works
    for (const baseUrl of ollamaUrls) {
      try {
        console.log(`Attempting to connect to Ollama at: ${baseUrl}`);
        
        // Test connection first
        const isConnected = await testOllamaConnection(baseUrl);
        if (!isConnected) {
          console.log(`Connection test failed for: ${baseUrl}`);
          continue;
        }

        // Forward request to Ollama instance
        const ollamaResponse = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(30000) // 30 second timeout for chat
        })

        if (!ollamaResponse.ok) {
          throw new Error(`Ollama API error: ${ollamaResponse.status} - ${ollamaResponse.statusText}`)
        }

        const responseData = await ollamaResponse.json()
        workingUrl = baseUrl;
        console.log(`Successfully connected to Ollama at: ${baseUrl}`);

        return new Response(
          JSON.stringify(responseData),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )

      } catch (error) {
        console.error(`Failed to connect to Ollama at ${baseUrl}:`, error);
        lastError = error;
        continue;
      }
    }

    // If we get here, all URLs failed
    throw new Error(`Could not connect to Ollama server. Tried URLs: ${ollamaUrls.join(', ')}. Last error: ${lastError?.message}`)

  } catch (error) {
    console.error('Ollama proxy error:', error)
    
    // Provide detailed troubleshooting information
    const troubleshootingInfo = `
Ollama-Server Verbindungsfehler:

1. Prüfen Sie, ob Ollama läuft:
   - Windows/Mac: Ollama sollte in der Taskleiste/Menüleiste sichtbar sein
   - Linux: Führen Sie 'ollama serve' in einem Terminal aus

2. Testen Sie die Verbindung manuell:
   - Öffnen Sie http://127.0.0.1:11434 in Ihrem Browser
   - Oder führen Sie aus: curl http://127.0.0.1:11434/api/tags

3. Prüfen Sie, ob das Modell 'llama3.1:8b' installiert ist:
   - Führen Sie aus: ollama list
   - Falls nicht installiert: ollama pull llama3.1:8b

4. Firewall/Netzwerk prüfen:
   - Stellen Sie sicher, dass Port 11434 nicht blockiert ist
   - Bei Problemen mit 127.0.0.1, versuchen Sie localhost

5. Konfiguration über Umgebungsvariable:
   - Setzen Sie OLLAMA_URL auf Ihre spezifische Ollama-Adresse
   - Beispiel: OLLAMA_URL=http://192.168.1.100:11434

Fehlerdetails: ${error.message}`;

    return new Response(
      JSON.stringify({ 
        error: 'Ollama-Server nicht erreichbar',
        details: troubleshootingInfo.trim(),
        technical_error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})