import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useSessionValidator = () => {
  const { profile, signOut } = useAuth();
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const validateSession = async () => {
      const sessionId = localStorage.getItem('school_session_id');
      if (!sessionId) return;

      setIsValidating(true);
      try {
        const { data: isValid } = await supabase.rpc('is_session_valid', {
          session_id_param: sessionId
        });

        if (!isValid) {
          toast({
            variant: "destructive",
            title: "Sitzung abgelaufen",
            description: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an."
          });
          await signOut();
        } else {
          // Also check if primary status changed
          const { data: hasAdminRights } = await supabase.rpc('session_has_admin_rights', {
            session_id_param: sessionId
          });
          
          const currentPrimary = localStorage.getItem('school_session_primary') === 'true';
          if (currentPrimary && !hasAdminRights) {
            localStorage.setItem('school_session_primary', 'false');
            toast({
              title: "Admin-Rechte entzogen",
              description: "Ein anderes Gerät hat jetzt die Admin-Rechte übernommen."
            });
          }
        }
      } catch (error) {
        console.error('Session validation error:', error);
      } finally {
        setIsValidating(false);
      }
    };

    // Initial validation
    validateSession();

    // Validate every 30 seconds
    const interval = setInterval(validateSession, 30000);

    return () => clearInterval(interval);
  }, [profile, signOut]);

  return { isValidating };
};