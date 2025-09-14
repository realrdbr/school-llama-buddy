import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { useAdminRights } from './useAdminRights';
import { supabase } from '@/integrations/supabase/client';

export const useSessionCleanup = () => {
  const { profile } = useAuth();
  const { hasAdminRights } = useAdminRights();

  useEffect(() => {
    if (!profile) return;

    // Auto-cleanup sessions when user is inactive
    const handleInactivity = async () => {
      if (hasAdminRights) {
        try {
          await supabase.rpc('release_primary_session', {
            target_user_id: profile.id
          });
          localStorage.setItem('school_session_primary', 'false');
        } catch (error) {
          console.error('Error releasing admin rights on inactivity:', error);
        }
      }
    };

    // Set up inactivity timer (30 minutes)
    let inactivityTimer: NodeJS.Timeout;
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(handleInactivity, 30 * 60 * 1000); // 30 minutes
    };

    // Events that reset the inactivity timer
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, true);
    });

    // Initial timer
    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer, true);
      });
    };
  }, [profile, hasAdminRights]);

  // Periodic check for session validity
  useEffect(() => {
    if (!profile) return;

    const checkSessionValidity = async () => {
      const sessionId = localStorage.getItem('school_session_id');
      if (!sessionId) return;

      try {
        const { data: isValid } = await supabase.rpc('is_session_valid', {
          session_id_param: sessionId
        });

        if (!isValid) {
          // Session is invalid, try to get a new primary session
          const { data: newPrimaryId } = await supabase.rpc('auto_assign_primary_session', {
            target_user_id: profile.id
          });
          
          if (newPrimaryId === sessionId) {
            localStorage.setItem('school_session_primary', 'true');
          }
        }
      } catch (error) {
        console.error('Error checking session validity:', error);
      }
    };

    // Check every 5 minutes
    const interval = setInterval(checkSessionValidity, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [profile]);
};