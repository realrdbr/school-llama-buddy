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
    await supabase.rpc('set_session_context', {
      session_id_param: sessionId
    });

    try {
      return await operation();
    } finally {
      // Clean up session context
      await supabase.rpc('set_session_context', {
        session_id_param: ''
      });
    }
  };

  return { withSession };
};