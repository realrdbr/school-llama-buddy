import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, actorUserId, sessionId } = await req.json();
    console.log('[admin-users] input', { action, actorUserId, sessionId });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const deny = (status = 401, message = "Unauthorized") =>
      new Response(JSON.stringify({ success: false, error: message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });

    if (!action) return deny(400, "Missing action");
    if (!actorUserId || !sessionId) return deny(400, "Missing actorUserId or sessionId");

    // Verify session (must belong to actorUserId and be recent)
    const { data: sessionRow, error: sessionErr } = await supabase
      .from("user_sessions")
      .select("id, user_id, created_at, is_active, is_primary")
      .eq("id", sessionId)
      .eq("user_id", actorUserId)
      .maybeSingle();
    console.log('[admin-users] sessionRow', { sessionRow, sessionErr });
      .from("user_sessions")
      .select("id, user_id, created_at")
      .eq("id", sessionId)
      .eq("user_id", actorUserId)
      .maybeSingle();

    if (sessionErr) {
      console.error("admin-users session lookup error:", sessionErr);
      return deny(500, "Session check failed");
    }

    if (!sessionRow) return deny(401, "Invalid session");

    // Optional freshness check: 48h
    const createdAt = new Date(sessionRow.created_at || Date.now());
    const maxAgeMs = 1000 * 60 * 60 * 48; // 48 hours
    if (Date.now() - createdAt.getTime() > maxAgeMs) {
      return deny(401, "Session expired");
    }

    // Verify actor is level 10+
    const { data: actor, error: actorErr } = await supabase
      .from("permissions")
      .select("permission_lvl, username, name")
      .eq("id", actorUserId)
      .maybeSingle();
    console.log('[admin-users] actor', { actor, actorErr });
      .from("permissions")
      .select("permission_lvl")
      .eq("id", actorUserId)
      .maybeSingle();

    if (actorErr) {
      console.error("admin-users actor lookup error:", actorErr);
      return deny(500, "Actor lookup failed");
    }

    if (!actor || (actor.permission_lvl ?? 0) < 10) {
      return deny(403, "Insufficient permissions");
    }

    switch (action) {
      case "list_users": {
        const { data, error } = await supabase
          .from("permissions")
          .select("id, username, name, permission_lvl, created_at, user_class")
          .order("permission_lvl", { ascending: false })
          .order("name", { ascending: true });
        console.log('[admin-users] list_users result', { count: data?.length, error });
          .from("permissions")
          .select("id, username, name, permission_lvl, created_at, user_class")
          .order("permission_lvl", { ascending: false })
          .order("name", { ascending: true });
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, users: data || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      default:
        return deny(400, "Unknown action");
    }
  } catch (e) {
    console.error("admin-users error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message || "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});