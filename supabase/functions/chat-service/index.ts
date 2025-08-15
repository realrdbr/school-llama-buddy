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
    const body = await req.json()
    const { action } = body

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (!action) {
      return new Response(JSON.stringify({ success: false, error: 'Missing action' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Helper: verify conversation belongs to user
    const ensureOwnership = async (conversationId: string, profileId: string) => {
      const { data: conv, error } = await supabase
        .from('chat_conversations')
        .select('user_id')
        .eq('id', conversationId)
        .maybeSingle()
      if (error) throw error
      if (!conv || conv.user_id !== profileId) {
        throw new Error('Forbidden')
      }
    }

    switch (action) {
      case 'list_conversations': {
        const { profileId } = body
        if (!profileId) throw new Error('Missing profileId')

        const { data, error } = await supabase
          .from('chat_conversations')
          .select('id, title, created_at, updated_at')
          .eq('user_id', profileId)
          .order('updated_at', { ascending: false })
        if (error) throw error
        return new Response(JSON.stringify({ success: true, conversations: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'list_messages': {
        const { profileId, conversationId } = body
        if (!profileId || !conversationId) throw new Error('Missing profileId or conversationId')
        await ensureOwnership(conversationId, profileId)

        const { data, error } = await supabase
          .from('chat_messages')
          .select('role, content, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
        if (error) throw error
        return new Response(JSON.stringify({ success: true, messages: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'create_conversation': {
        const { profileId, title } = body
        if (!profileId || !title) throw new Error('Missing profileId or title')
        const { data, error } = await supabase
          .from('chat_conversations')
          .insert({ user_id: profileId, title })
          .select('id')
          .single()
        if (error) throw error
        return new Response(JSON.stringify({ success: true, conversationId: data.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'add_message': {
        const { profileId, conversationId, role, content } = body
        if (!profileId || !conversationId || !role || !content) throw new Error('Missing fields')
        await ensureOwnership(conversationId, profileId)

        const { error: msgErr } = await supabase
          .from('chat_messages')
          .insert({ conversation_id: conversationId, role, content })
        if (msgErr) throw msgErr

        const { error: updErr } = await supabase
          .from('chat_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)
        if (updErr) throw updErr

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'delete_conversation': {
        const { profileId, conversationId } = body
        if (!profileId || !conversationId) throw new Error('Missing profileId or conversationId')
        await ensureOwnership(conversationId, profileId)

        // Delete messages first (FK might not cascade)
        await supabase.from('chat_messages').delete().eq('conversation_id', conversationId)
        await supabase.from('chat_conversations').delete().eq('id', conversationId)
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'delete_all_conversations': {
        const { profileId } = body
        if (!profileId) throw new Error('Missing profileId')

        // Get all conv ids
        const { data: convs, error: convErr } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('user_id', profileId)
        if (convErr) throw convErr

        const ids = (convs || []).map(c => c.id)
        if (ids.length > 0) {
          await supabase.from('chat_messages').delete().in('conversation_id', ids)
          await supabase.from('chat_conversations').delete().in('id', ids)
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'touch_conversation': {
        const { profileId, conversationId } = body
        if (!profileId || !conversationId) throw new Error('Missing profileId or conversationId')
        await ensureOwnership(conversationId, profileId)
        await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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