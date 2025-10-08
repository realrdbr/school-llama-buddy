import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, sessionId, userId, permissionId, level, allowed } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Session ID required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Resolve actor from session directly to avoid GUC/session pooling issues
    const { data: actorId, error: actorErr } = await supabase.rpc('resolve_current_user_from_session', {
      v_session_id: sessionId
    });

    if (actorErr || !actorId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Fetch actor permission level
    const { data: actor, error: fetchErr } = await supabase
      .from('permissions')
      .select('permission_lvl')
      .eq('id', actorId)
      .maybeSingle();

    if (fetchErr || !actor) {
      return new Response(
        JSON.stringify({ success: false, error: 'Actor not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    if ((actor.permission_lvl ?? 0) < 10) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    if (action === 'set_user_permission') {
      const { error } = await supabase
        .from('user_permissions')
        .upsert(
          {
            user_id: userId,
            permission_id: permissionId,
            allowed: allowed,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id,permission_id' }
        );

      if (error) {
        console.error('Error setting user permission:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'set_level_permission') {
      const { error } = await supabase
        .from('level_permissions')
        .upsert(
          {
            level: level,
            permission_id: permissionId,
            allowed: allowed,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'level,permission_id' }
        );

      if (error) {
        console.error('Error setting level permission:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Unknown action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  } catch (error) {
    console.error('Error in permission-manager:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
