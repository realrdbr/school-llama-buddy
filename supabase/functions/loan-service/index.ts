import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type Actor = { id: number; permission_lvl: number; username: string; name: string };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const deny = (status = 401, message = "Unauthorized") =>
    new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });

  try {
    const payload = await req.json();
    const { action, actorUserId, actorUsername } = payload;
    console.log('[loan-service] input', payload);

    // Resolve actor
    let actor: Actor | null = null;
    if (actorUserId) {
      const { data, error } = await supabase
        .from('permissions')
        .select('id, permission_lvl, username, name')
        .eq('id', actorUserId)
        .maybeSingle();
      if (error) {
        console.error('[loan-service] actor lookup by id error', error);
        return deny(500, 'Actor lookup failed');
      }
      actor = data as Actor | null;
    } else if (actorUsername) {
      const { data, error } = await supabase
        .from('permissions')
        .select('id, permission_lvl, username, name')
        .eq('username', actorUsername)
        .maybeSingle();
      if (error) {
        console.error('[loan-service] actor lookup by username error', error);
        return deny(500, 'Actor lookup failed');
      }
      actor = data as Actor | null;
    }

    if (!actor) {
      return deny(400, 'Missing or invalid actor');
    }

    switch (action) {
      case 'list_my_loans': {
        const profileId = payload.profileId as number | undefined;
        if (!profileId) return deny(400, 'profileId required');
        // Only allow user to view their own loans OR librarians (6+)
        if (actor.id !== profileId && (actor.permission_lvl ?? 0) < 6) {
          return deny(403, 'Keine Berechtigung');
        }
        const { data, error } = await supabase
          .from('loans')
          .select(`*, books (*), permissions!loans_user_id_fkey (name, username)`) // same shape as frontend
          .eq('user_id', profileId)
          .eq('is_returned', false);
        if (error) {
          console.error('[loan-service] list_my_loans error', error);
          return deny(500, error.message);
        }
        return new Response(JSON.stringify({ success: true, loans: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'list_all_loans': {
        if ((actor.permission_lvl ?? 0) < 6) {
          return deny(403, 'Bibliotheks-Berechtigung erforderlich (Level 6+)');
        }
        const { data, error } = await supabase
          .from('loans')
          .select(`*, books (*), permissions!loans_user_id_fkey (name, username)`) // same shape
          .order('loan_date', { ascending: false });
        if (error) {
          console.error('[loan-service] list_all_loans error', error);
          return deny(500, error.message);
        }
        return new Response(JSON.stringify({ success: true, loans: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'list_user_loans': {
        if ((actor.permission_lvl ?? 0) < 6) {
          return deny(403, 'Bibliotheks-Berechtigung erforderlich (Level 6+)');
        }
        const userId = payload.user_id as number | undefined;
        if (!userId) return deny(400, 'user_id required');
        const { data, error } = await supabase
          .from('loans')
          .select(`*, books (*)`)
          .eq('user_id', userId)
          .eq('is_returned', false);
        if (error) {
          console.error('[loan-service] list_user_loans error', error);
          return deny(500, error.message);
        }
        return new Response(JSON.stringify({ success: true, loans: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'return_book': {
        if ((actor.permission_lvl ?? 0) < 6) {
          return deny(403, 'Bibliotheks-Berechtigung erforderlich (Level 6+)');
        }
        const loanId = payload.loan_id as string | undefined;
        if (!loanId) return deny(400, 'loan_id required');

        // Get loan with book
        const { data: loan, error: loanErr } = await supabase
          .from('loans')
          .select('id, book_id, is_returned, books(available_copies)')
          .eq('id', loanId)
          .maybeSingle();
        if (loanErr) {
          console.error('[loan-service] return_book loan lookup error', loanErr);
          return deny(500, loanErr.message);
        }
        if (!loan) {
          return deny(404, 'Ausleihe nicht gefunden');
        }
        if (loan.is_returned) {
          return deny(400, 'Buch bereits zurückgegeben');
        }

        // Mark as returned
        const { error: updateLoanErr } = await supabase
          .from('loans')
          .update({ is_returned: true, return_date: new Date().toISOString() })
          .eq('id', loanId);
        if (updateLoanErr) {
          console.error('[loan-service] return_book update loan error', updateLoanErr);
          return deny(500, updateLoanErr.message);
        }

        // Increment available copies
        const available = (loan as any).books?.available_copies ?? null;
        if (available !== null) {
          const { error: bookErr } = await supabase
            .from('books')
            .update({ available_copies: available + 1 })
            .eq('id', loan.book_id);
          if (bookErr) {
            console.error('[loan-service] return_book update book error', bookErr);
            return deny(500, bookErr.message);
          }
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return deny(400, 'Unknown action');
    }
  } catch (e) {
    console.error('[loan-service] error', e);
    const message = (e as any)?.message || 'Internal error';
    return new Response(JSON.stringify({ success: false, error: message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
