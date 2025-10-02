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
    const { action } = payload || {};
    console.log('[book-service] input', payload);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const deny = (status = 401, message = "Unauthorized") =>
      new Response(JSON.stringify({ success: false, error: message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });

    if (!action) return deny(400, "Missing action");

    const { actorUserId, actorUsername } = payload || {};
    if (!actorUserId && !actorUsername) {
      return deny(400, "Missing actor information");
    }

    // Resolve actor and check permissions (librarian level 6+)
    let actor;
    if (actorUserId) {
      const { data } = await supabase
        .from('permissions')
        .select('id, permission_lvl, username, name')
        .eq('id', actorUserId)
        .maybeSingle();
      actor = data;
    } else if (actorUsername) {
      const { data } = await supabase
        .from('permissions')
        .select('id, permission_lvl, username, name')
        .eq('username', actorUsername)
        .maybeSingle();
      actor = data;
    }

    console.log('[book-service] actor', actor);

    if (!actor || (actor.permission_lvl ?? 0) < 6) {
      return deny(403, 'Keine Berechtigung (Level 6 erforderlich)');
    }

    switch (action) {
      case 'add_book': {
        const { book } = payload || {};
        if (!book || !book.title || !book.author) {
          return deny(400, 'Missing required fields');
        }

        const insertPayload: Record<string, unknown> = {
          title: String(book.title),
          author: String(book.author),
          isbn: book.isbn ?? null,
          publisher: book.publisher ?? null,
          publication_year: book.publication_year ?? null,
          genre: book.genre ?? null,
          total_copies: typeof book.total_copies === 'number' ? book.total_copies : 1,
          available_copies: typeof book.total_copies === 'number' ? book.total_copies : 1,
          description: book.description ?? null,
        };

        const { data: created, error } = await supabase
          .from('books')
          .insert(insertPayload)
          .select()
          .maybeSingle();

        if (error) {
          console.error('[book-service] add_book error', error);
          return deny(500, `Fehler beim Erstellen: ${error.message}`);
        }

        return new Response(JSON.stringify({ success: true, book: created }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'update_book': {
        const { book } = payload || {};
        if (!book || !book.id || !book.title || !book.author) {
          return deny(400, 'Missing required fields');
        }

        // Fetch current counts to adjust availability like in RPC
        const { data: current, error: currentErr } = await supabase
          .from('books')
          .select('total_copies, available_copies')
          .eq('id', book.id)
          .maybeSingle();
        if (currentErr || !current) {
          console.error('[book-service] update_book current error', currentErr);
          return deny(404, 'Buch nicht gefunden');
        }

        const newTotal = typeof book.total_copies === 'number' ? book.total_copies : current.total_copies;
        const diff = newTotal - current.total_copies;
        let newAvailable = (current.available_copies ?? 0) + diff;
        if (newAvailable < 0) newAvailable = 0;

        const updatePayload: Record<string, unknown> = {
          title: String(book.title),
          author: String(book.author),
          isbn: book.isbn ?? null,
          publisher: book.publisher ?? null,
          publication_year: book.publication_year ?? null,
          genre: book.genre ?? null,
          total_copies: newTotal,
          available_copies: newAvailable,
          description: book.description ?? null,
          updated_at: new Date().toISOString(),
        };

        const { data: updated, error } = await supabase
          .from('books')
          .update(updatePayload)
          .eq('id', book.id)
          .select()
          .maybeSingle();

        if (error) {
          console.error('[book-service] update_book error', error);
          return deny(500, `Fehler beim Aktualisieren: ${error.message}`);
        }

        return new Response(JSON.stringify({ success: true, book: updated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'delete_book': {
        const { bookId } = payload || {};
        if (!bookId) return deny(400, 'Missing bookId');

        const { error } = await supabase
          .from('books')
          .delete()
          .eq('id', bookId);
        if (error) {
          console.error('[book-service] delete_book error', error);
          return deny(500, `Fehler beim Löschen: ${error.message}`);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return deny(400, 'Unknown action');
    }
  } catch (e) {
    console.error('[book-service] error', e);
    return new Response(
      JSON.stringify({ success: false, error: e?.message || 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});