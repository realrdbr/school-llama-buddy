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
    const { action, actorUserId } = await req.json();
    console.log('[admin-users] input', { action, actorUserId });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const deny = (status = 401, message = "Unauthorized") =>
      new Response(JSON.stringify({ success: false, error: message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });

    if (!action) return deny(400, "Missing action");
    if (!actorUserId) return deny(400, "Missing actorUserId");

    // Verify actor is level 10+
    const { data: actor, error: actorErr } = await supabase
      .from("permissions")
      .select("permission_lvl, username, name")
      .eq("id", actorUserId)
      .maybeSingle();
    
    console.log('[admin-users] actor', { actor, actorErr });

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