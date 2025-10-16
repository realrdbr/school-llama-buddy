import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { action, sessionId } = payload;
    console.log('[admin-users] input', { action });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const deny = (status = 401, message = "Unauthorized") =>
      new Response(JSON.stringify({ success: false, error: message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });

    if (!action) return deny(400, "Missing action");

    // Input validation for sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      return deny(400, "Missing or invalid sessionId");
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return deny(400, "Invalid sessionId format");
    }

    // Server-side permission verification for level 10 operations
    const { data: permCheck, error: permError } = await supabase.rpc('verify_permission_server_side', {
      session_id_param: sessionId,
      required_level: 10
    }).single();

    if (permError || !permCheck?.is_valid) {
      console.error('[admin-users] Permission check failed:', permError, permCheck);
      return deny(403, permCheck?.error_message || "Unauthorized - Invalid session or insufficient permissions");
    }

    const actorUserId = permCheck.user_id;

    // Get full actor info
    const { data: actor, error: actorErr } = await supabase
      .from('permissions')
      .select('id, permission_lvl, username, name, user_class, keycard_number, keycard_active')
      .eq('id', actorUserId)
      .maybeSingle();

    if (actorErr || !actor) {
      console.error('[admin-users] Actor lookup failed:', actorErr);
      return deny(500, "Actor lookup failed");
    }

    switch (action) {
      case "list_users": {
        // Use safe public view instead of direct permissions table access
        const { data, error } = await supabase
          .from("user_public_info")
          .select("id, username, name, permission_lvl, user_class, created_at")
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
        const { targetUserId, targetUsername, updates } = payload;
        console.log('[admin-users] update_user input', { targetUserId, targetUsername, updates });

        // Input validation
        if (!targetUserId && !targetUsername) return deny(400, "Missing target identifier");
        
        if (targetUserId && (typeof targetUserId !== 'number' || targetUserId <= 0)) {
          return deny(400, "Invalid targetUserId");
        }

        if (targetUsername && (typeof targetUsername !== 'string' || targetUsername.length > 255)) {
          return deny(400, "Invalid targetUsername");
        }

        if (!updates || typeof updates !== 'object') {
          return deny(400, "Invalid updates object");
        }

        // Resolve target user by id or username
        let targetUserIdResolved = targetUserId;
        if (!targetUserIdResolved && targetUsername) {
          const { data: targetByName, error: targetByNameErr } = await supabase
            .from("permissions")
            .select("id, username, name")
            .eq("username", targetUsername)
            .maybeSingle();
          if (targetByNameErr) {
            console.error("Target user lookup by username error:", targetByNameErr);
            return deny(500, `Fehler beim Suchen des Benutzers: ${targetByNameErr.message}`);
          }
          if (!targetByName) return deny(404, "Benutzer nicht gefunden");
          targetUserIdResolved = targetByName.id;
        }

        // Check if target user exists
        const { data: targetUser, error: targetError } = await supabase
          .from("permissions")
          .select("id, username, name")
          .eq("id", targetUserIdResolved)
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
        
        // Handle keycard updates
        if ("keycard_number" in updates) {
          updatePayload.keycard_number = updates.keycard_number || null;
        }
        
        if ("keycard_active" in updates) {
          updatePayload.keycard_active = updates.keycard_active ?? true;
        }
        
        // Handle password update using secure function
        if (updates?.new_password && updates.new_password.trim()) {
          // Use admin password override function
          const { data: result, error: pwError } = await supabase.rpc('admin_change_user_password', {
            admin_user_id: actor.id,
            target_user_id: targetUserIdResolved,
            new_password: updates.new_password.trim()
          });

          if (pwError || !result?.success) {
            console.error('[admin-users] Password change error:', pwError, result);
            return deny(500, result?.error || 'Fehler beim Ändern des Passworts');
          }
          
          // Log admin operation
          await supabase.from('admin_operation_log').insert({
            user_id: actor.id,
            operation: 'password_change',
            target_user_id: targetUserIdResolved,
            operation_details: { targetUser: targetUser.username, actor: actor.username }
          }).catch(err => console.error('Failed to log admin operation:', err));
        }

        if (Object.keys(updatePayload).length === 0) {
          // No-op update: nothing to change, but consider it a success for idempotency
          return new Response(
            JSON.stringify({ success: true, user: targetUser }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log('[admin-users] updating with payload', updatePayload);

        const { data: updatedUser, error } = await supabase
          .from("permissions")
          .update(updatePayload)
          .eq("id", targetUserIdResolved)
          .select("id, username, name, user_class, keycard_number, keycard_active")
          .maybeSingle();

        if (error) {
          console.error("Update error:", error);
          return deny(500, `Fehler beim Aktualisieren: ${error.message}`);
        }
        if (!updatedUser) {
          return deny(404, "Benutzer nicht gefunden");
        }

        console.log('[admin-users] update successful', { updatedUser });

        return new Response(
          JSON.stringify({ success: true, user: updatedUser }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete_user": {
        const { targetUserId, targetUsername } = payload;
        console.log('[admin-users] delete_user input', { targetUserId, targetUsername });
        
        // Input validation
        if (!targetUserId && !targetUsername) return deny(400, "Missing target identifier");
        
        if (targetUserId && (typeof targetUserId !== 'number' || targetUserId <= 0)) {
          return deny(400, "Invalid targetUserId");
        }

        if (targetUsername && (typeof targetUsername !== 'string' || targetUsername.length > 255)) {
          return deny(400, "Invalid targetUsername");
        }

        // Resolve target id if only username provided
        let targetIdResolved = targetUserId;
        if (!targetIdResolved && targetUsername) {
          const { data: targetByName, error: targetByNameErr } = await supabase
            .from("permissions")
            .select("id")
            .eq("username", targetUsername)
            .maybeSingle();
          if (targetByNameErr) {
            console.error("Target user lookup by username error:", targetByNameErr);
            return deny(500, `Fehler beim Suchen des Benutzers: ${targetByNameErr.message}`);
          }
          if (!targetByName) return deny(404, "Benutzer nicht gefunden");
          targetIdResolved = targetByName.id;
        }

        const { error } = await supabase
          .from("permissions")
          .delete()
          .eq("id", targetIdResolved);

        if (error) {
          console.error('Delete error:', error);
          return deny(500, `Fehler beim Löschen: ${error.message}`);
        }

        // Log admin operation
        await supabase.from('admin_operation_log').insert({
          user_id: actor.id,
          operation: 'user_deletion',
          target_user_id: targetIdResolved,
          operation_details: { targetUserId: targetIdResolved }
        }).catch(err => console.error('Failed to log admin operation:', err));

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_self": {
        return new Response(
          JSON.stringify({ success: true, user: actor }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_user_by_id": {
        const { targetUserId } = payload;
        
        // Input validation
        if (!targetUserId) return deny(400, "Missing targetUserId");
        if (typeof targetUserId !== 'number' || targetUserId <= 0) {
          return deny(400, "Invalid targetUserId");
        }

        // Re-check permission level for librarians (need level 6+)
        if ((actor.permission_lvl ?? 0) < 6) return deny(403, "Insufficient permissions");
        const { data: userRow, error: userErr } = await supabase
          .from('permissions')
          .select('id, username, name, keycard_number, keycard_active')
          .eq('id', targetUserId)
          .maybeSingle();
        if (userErr) {
          console.error('[admin-users] get_user_by_id error', userErr);
          return deny(500, `Fehler beim Suchen des Benutzers: ${userErr.message}`);
        }
        if (!userRow) return deny(404, 'Benutzer nicht gefunden');
        return new Response(
          JSON.stringify({ success: true, user: userRow }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return deny(400, "Unknown action");
    
    case 'search_by_keycard':
      // Re-check permission for librarians
      if ((actor.permission_lvl ?? 0) < 6) {
        return deny(403, "Bibliotheks-Berechtigung erforderlich");
      }
      
      // Input validation
      if (!payload.keycard_number) {
        return deny(400, 'Keycard-Nummer fehlt');
      }

      if (typeof payload.keycard_number !== 'string' || payload.keycard_number.length > 100) {
        return deny(400, 'Invalid keycard_number');
      }
      
      const searchResult = await supabase
        .from('permissions')
        .select('id, name, username, keycard_number, keycard_active')
        .eq('keycard_number', payload.keycard_number)
        .eq('keycard_active', true)
        .maybeSingle();
      
      if (searchResult.error) {
        console.error('Search error:', searchResult.error);
        return deny(500, `Fehler bei der Suche: ${searchResult.error.message}`);
      }
      
      if (!searchResult.data) {
        return deny(404, 'Keycard nicht gefunden oder deaktiviert');
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        user: searchResult.data 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  } catch (e) {
    console.error("admin-users error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message || "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});