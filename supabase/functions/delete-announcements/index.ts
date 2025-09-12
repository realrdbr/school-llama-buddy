import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteRequest {
  id?: string;
  all?: boolean;
  user_id: string;
}

function sanitizeStoragePath(path: string): string {
  // Remove bucket prefixes and leading slashes
  return path.replace(/^(audio-announcements|audio-files)\//, '').replace(/^\/+/, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { id, all, user_id }: DeleteRequest = await req.json();

    // Check user permissions
    const { data: userPermission, error: permError } = await supabaseClient
      .from('permissions')
      .select('permission_lvl')
      .eq('username', user_id)
      .single();

    if (permError || !userPermission || userPermission.permission_lvl < 10) {
      console.error('Permission check failed:', permError);
      return new Response(
        JSON.stringify({ error: 'Keine Berechtigung für diese Aktion' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔧 Delete request: ${all ? 'ALL' : `ID: ${id}`} by user: ${user_id}`);

    if (all) {
      // Delete all announcements
      const { data: announcements, error: fetchError } = await supabaseClient
        .from('audio_announcements')
        .select('*');

      if (fetchError) {
        console.error('Failed to fetch announcements:', fetchError);
        throw new Error('Fehler beim Abrufen der Durchsagen');
      }

      // Group files by bucket
      const audioAnnouncementFiles: string[] = [];
      const audioFiles: string[] = [];

      announcements?.forEach(announcement => {
        if (announcement.audio_file_path) {
          const sanitizedPath = sanitizeStoragePath(announcement.audio_file_path);
          if (announcement.is_tts) {
            audioAnnouncementFiles.push(sanitizedPath);
          } else {
            audioFiles.push(sanitizedPath);
          }
        }
      });

      console.log(`🗑️ Deleting ${audioAnnouncementFiles.length} TTS files and ${audioFiles.length} uploaded files`);

      // Delete from storage buckets
      if (audioAnnouncementFiles.length > 0) {
        const { error: storageError1 } = await supabaseClient.storage
          .from('audio-announcements')
          .remove(audioAnnouncementFiles);
        if (storageError1) {
          console.warn('Storage deletion error (audio-announcements):', storageError1);
        }
      }

      if (audioFiles.length > 0) {
        const { error: storageError2 } = await supabaseClient.storage
          .from('audio-files')
          .remove(audioFiles);
        if (storageError2) {
          console.warn('Storage deletion error (audio-files):', storageError2);
        }
      }

      // Delete all from database
      const { error: dbError } = await supabaseClient
        .from('audio_announcements')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (dbError) {
        console.error('Database deletion error:', dbError);
        throw new Error('Fehler beim Löschen aus der Datenbank');
      }

      console.log(`✅ Successfully deleted all ${announcements?.length || 0} announcements`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          deleted: announcements?.length || 0,
          message: 'Alle Durchsagen wurden gelöscht'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Delete single announcement
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'ID erforderlich für Einzellöschung' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get announcement details
      const { data: announcement, error: fetchError } = await supabaseClient
        .from('audio_announcements')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Failed to fetch announcement:', fetchError);
        throw new Error('Durchsage nicht gefunden');
      }

      // Delete from storage if file exists
      if (announcement.audio_file_path) {
        const bucket = announcement.is_tts ? 'audio-announcements' : 'audio-files';
        const sanitizedPath = sanitizeStoragePath(announcement.audio_file_path);
        
        console.log(`🗑️ Deleting file from bucket "${bucket}": ${sanitizedPath}`);

        const { error: storageError } = await supabaseClient.storage
          .from(bucket)
          .remove([sanitizedPath]);

        if (storageError) {
          console.warn('Storage deletion error (continuing with DB deletion):', storageError);
        } else {
          console.log(`✅ Successfully deleted file from storage: ${sanitizedPath}`);
        }
      }

      // Delete from database
      const { error: dbError } = await supabaseClient
        .from('audio_announcements')
        .delete()
        .eq('id', id);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        throw new Error('Fehler beim Löschen aus der Datenbank');
      }

      console.log(`✅ Successfully deleted announcement: ${id}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Durchsage wurde gelöscht'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('Error in delete-announcements function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unbekannter Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});