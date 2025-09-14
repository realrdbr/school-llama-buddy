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
    const payload = await req.json();
    const { action, actorUserId } = payload;
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

      case "update_user": {
        const { targetUserId, updates } = payload;
        console.log('[admin-users] update_user input', { targetUserId, updates });

        if (!targetUserId) return deny(400, "Missing targetUserId");

        // Check if target user exists
        const { data: targetUser, error: targetError } = await supabase
          .from("permissions")
          .select("id, username, name")
          .eq("id", targetUserId)
          .maybeSingle();

        console.log('[admin-users] target user check', { targetUser, targetError });

        if (targetError) {
          console.error("Target user lookup error:", targetError);
          return deny(500, `Fehler beim Suchen des Benutzers: ${targetError.message}`);
        }

        if (!targetUser) {
          return deny(404, "Benutzer nicht gefunden");
        }

        const updatePayload: Record<string, unknown> = {};
        
        // Handle class update
        if ("user_class" in updates) {
          updatePayload.user_class = updates.user_class ?? null;
        }
        
        // Handle password update (only if password is provided and not empty)
        if (updates?.new_password && updates.new_password.trim()) {
          updatePayload.password = updates.new_password.trim();
          updatePayload.must_change_password = false;
        }

        if (Object.keys(updatePayload).length === 0) {
          return deny(400, "Keine Änderungen angegeben");
        }

        console.log('[admin-users] updating with payload', updatePayload);

        const { data: updatedUser, error } = await supabase
          .from("permissions")
          .update(updatePayload)
          .eq("id", targetUserId)
          .select("id, username, name, user_class")
          .single();

        if (error) {
          console.error("Update error:", error);
          return deny(500, `Fehler beim Aktualisieren: ${error.message}`);
        }

        console.log('[admin-users] update successful', { updatedUser });

        return new Response(
          JSON.stringify({ success: true, user: updatedUser }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete_user": {
        const { targetUserId } = payload;
        console.log('[admin-users] delete_user input', { targetUserId });
        if (!targetUserId) return deny(400, "Missing targetUserId");

        const { error } = await supabase
          .from("permissions")
          .delete()
          .eq("id", targetUserId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
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