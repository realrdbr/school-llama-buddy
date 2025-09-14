import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useAdminRights = () => {
  const { profile } = useAuth();
  const [hasAdminRights, setHasAdminRights] = useState(false);
  const [isCheckingRights, setIsCheckingRights] = useState(true);

  useEffect(() => {
    if (!profile) {
      setHasAdminRights(false);
      setIsCheckingRights(false);
      return;
    }

    const checkAdminRights = async () => {
      const sessionId = localStorage.getItem('school_session_id');
      const isPrimaryFromStorage = localStorage.getItem('school_session_primary') === 'true';
      
      if (!sessionId) {
        setHasAdminRights(false);
        setIsCheckingRights(false);
        return;
      }

      try {
        // First check locally stored primary status
        if (isPrimaryFromStorage) {
          // Verify with database
          const { data: hasRights } = await supabase.rpc('session_has_admin_rights', {
            session_id_param: sessionId
          });
          
          setHasAdminRights(!!hasRights);
        } else {
          setHasAdminRights(false);
        }
      } catch (error) {
        console.error('Error checking admin rights:', error);
        setHasAdminRights(false);
      } finally {
        setIsCheckingRights(false);
      }
    };

    checkAdminRights();
  }, [profile]);

  const requestAdminRights = async (): Promise<boolean> => {
    if (!profile) return false;

    const sessionId = localStorage.getItem('school_session_id');
    if (!sessionId) return false;

    try {
      await supabase.rpc('set_primary_session', {
        target_user_id: profile.id,
        session_id_param: sessionId
      });

      localStorage.setItem('school_session_primary', 'true');
      setHasAdminRights(true);
      return true;
    } catch (error) {
      console.error('Error requesting admin rights:', error);
      return false;
    }
  };

  return {
    hasAdminRights,
    isCheckingRights,
    requestAdminRights
  };
};