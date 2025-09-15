import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Custom hook for making session-based database requests
export const useSessionRequest = () => {
  const { sessionId } = useAuth();

  const withSession = async <T,>(
    operation: () => Promise<T>
  ): Promise<T> => {
    if (!sessionId) {
      throw new Error('No active session');
    }

    // Set session context for the database to use in RLS policies
    await supabase.rpc('set_config', {
      setting_name: 'app.current_session_id',
      setting_value: sessionId,
      is_local: false
    });

    try {
      return await operation();
    } finally {
      // Clean up session context
      await supabase.rpc('set_config', {
        setting_name: 'app.current_session_id',
        setting_value: '',
        is_local: false
      });
    }
  };

  return { withSession };
};