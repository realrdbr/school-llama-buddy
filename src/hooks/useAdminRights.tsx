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
          // Check if we can auto-assign admin rights
          const { data: newPrimaryId } = await supabase.rpc('auto_assign_primary_session', {
            target_user_id: profile.id
          });
          
          if (newPrimaryId === sessionId) {
            localStorage.setItem('school_session_primary', 'true');
            setHasAdminRights(true);
          } else {
            setHasAdminRights(false);
          }
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

  // Handle page leave/unload - release admin rights
  useEffect(() => {
    if (!profile || !hasAdminRights) return;

    const releaseAdminRights = async () => {
      try {
        await supabase.rpc('release_primary_session', {
          target_user_id: profile.id
        });
        localStorage.setItem('school_session_primary', 'false');
      } catch (error) {
        console.error('Error releasing admin rights:', error);
      }
    };

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable cleanup on page unload
      if (navigator.sendBeacon) {
        const data = new FormData();
        data.append('action', 'release_rights');
        data.append('user_id', profile.id.toString());
        navigator.sendBeacon('/api/cleanup-session', data);
      } else {
        releaseAdminRights();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        releaseAdminRights();
      }
    };

    // Listen for page unload and visibility changes
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [profile, hasAdminRights]);

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

  const releaseAdminRights = async (): Promise<boolean> => {
    if (!profile) return false;

    try {
      await supabase.rpc('release_primary_session', {
        target_user_id: profile.id
      });

      localStorage.setItem('school_session_primary', 'false');
      setHasAdminRights(false);
      return true;
    } catch (error) {
      console.error('Error releasing admin rights:', error);
      return false;
    }
  };

  return {
    hasAdminRights,
    isCheckingRights,
    requestAdminRights,
    releaseAdminRights
  };
};