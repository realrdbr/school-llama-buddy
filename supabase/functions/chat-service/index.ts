import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, profileId, conversationId } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (!action) {
      return new Response(JSON.stringify({ success: false, error: 'Missing action' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    switch (action) {
      case 'list_conversations': {
        if (!profileId) {
          return new Response(JSON.stringify({ success: false, error: 'Missing profileId' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }

        const { data, error } = await supabase
          .from('chat_conversations')
          .select('id, title, created_at, updated_at')
          .eq('user_id', profileId)
          .order('updated_at', { ascending: false })

        if (error) throw error

        return new Response(JSON.stringify({ success: true, conversations: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      case 'list_messages': {
        if (!profileId || !conversationId) {
          return new Response(JSON.stringify({ success: false, error: 'Missing profileId or conversationId' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }

        // Verify conversation ownership
        const { data: conv, error: convErr } = await supabase
          .from('chat_conversations')
          .select('user_id')
          .eq('id', conversationId)
          .maybeSingle()

        if (convErr) throw convErr
        if (!conv || conv.user_id !== profileId) {
          return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          })
        }

        const { data, error } = await supabase
          .from('chat_messages')
          .select('role, content, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })

        if (error) throw error

        return new Response(JSON.stringify({ success: true, messages: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      default:
        return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
    }
  } catch (error) {
    console.error('chat-service error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message || 'Internal error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
