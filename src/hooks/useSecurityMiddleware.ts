import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SecurityEvent {
  type: 'session_timeout' | 'suspicious_activity' | 'permission_change';
  timestamp: Date;
  details: string;
}

export const useSecurityMiddleware = () => {
  const { profile, signOut } = useAuth();
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Session validation and rotation
  useEffect(() => {
    if (!profile) return;

    const validateSession = async () => {
      try {
        // Check if current session is still valid
        const storedSession = localStorage.getItem('sb-session');
        if (!storedSession) {
          await signOut();
          return;
        }

        const session = JSON.parse(storedSession);
        const currentToken = session.access_token;

        // Rotate session token every 30 minutes
        const tokenAge = Date.now() - parseInt(currentToken.split('_')[2] || '0');
        if (tokenAge > 30 * 60 * 1000) { // 30 minutes
          await rotateSessionToken(currentToken);
        }
      } catch (error) {
        console.error('Session validation error:', error);
        await signOut();
      }
    };

    // Validate session every 5 minutes
    const interval = setInterval(validateSession, 5 * 60 * 1000);
    validateSession(); // Initial validation

    return () => clearInterval(interval);
  }, [profile, signOut]);

  // Monitor for suspicious activity
  useEffect(() => {
    if (!profile) return;

    const detectSuspiciousActivity = () => {
      // Monitor rapid page navigation (potential bot activity)
      let pageChangeCount = 0;
      const resetCounter = () => { pageChangeCount = 0; };
      
      const handleNavigation = () => {
        pageChangeCount++;
        if (pageChangeCount > 10) { // More than 10 page changes in 1 minute
          logSecurityEvent('suspicious_activity', 'Rapid navigation detected');
          pageChangeCount = 0;
        }
        setTimeout(resetCounter, 60000); // Reset counter after 1 minute
      };

      // Monitor clipboard access (potential data theft)
      const handleCopy = () => {
        logSecurityEvent('suspicious_activity', 'Clipboard access detected');
      };

      // Monitor developer tools (potential security bypass)
      const handleDevTools = () => {
        if (typeof window !== 'undefined') {
          const threshold = 160;
          setInterval(() => {
            if (window.outerHeight - window.innerHeight > threshold || 
                window.outerWidth - window.innerWidth > threshold) {
              logSecurityEvent('suspicious_activity', 'Developer tools detected');
            }
          }, 1000);
        }
      };

      window.addEventListener('beforeunload', handleNavigation);
      document.addEventListener('copy', handleCopy);
      handleDevTools();

      return () => {
        window.removeEventListener('beforeunload', handleNavigation);
        document.removeEventListener('copy', handleCopy);
      };
    };

    const cleanup = detectSuspiciousActivity();
    return cleanup;
  }, [profile]);

  // Auto logout on suspicious activity
  useEffect(() => {
    const suspiciousEvents = securityEvents.filter(
      event => event.type === 'suspicious_activity' && 
      Date.now() - event.timestamp.getTime() < 60000 // Within last minute
    );

    if (suspiciousEvents.length >= 3) {
      toast({
        variant: "destructive",
        title: "Sicherheitswarnung",
        description: "Verdächtige Aktivitäten erkannt. Sie werden automatisch abgemeldet."
      });
      signOut();
    }
  }, [securityEvents, signOut]);

  const rotateSessionToken = async (oldToken: string) => {
    try {
      // For now, create a new token locally until the RPC is available in types
      const newTokenValue = `session_${profile?.id}_${Date.now()}`;

      // Update stored session with new token
      const storedSession = localStorage.getItem('sb-session');
      if (storedSession) {
        const session = JSON.parse(storedSession);
        session.access_token = newTokenValue;
        localStorage.setItem('sb-session', JSON.stringify(session));
        setSessionToken(newTokenValue);
      }
    } catch (error) {
      console.error('Session rotation error:', error);
      logSecurityEvent('session_timeout', 'Session rotation failed');
      await signOut();
    }
  };

  const logSecurityEvent = async (type: SecurityEvent['type'], details: string) => {
    const event: SecurityEvent = {
      type,
      timestamp: new Date(),
      details
    };
    
    setSecurityEvents(prev => [...prev.slice(-9), event]); // Keep last 10 events
    
    // Log to console for debugging (remove in production)
    console.warn('Security Event:', event);
    
    // Log to secure audit trail in database
    if (profile?.id) {
      try {
        await supabase.from('security_audit_log').insert({
          user_id: profile.id,
          event_type: type,
          event_details: { details, timestamp: event.timestamp.toISOString() },
          ip_address: null, // Could be enhanced with IP detection
          user_agent: navigator.userAgent
        });
      } catch (error) {
        console.error('Failed to log security event:', error);
      }
    }
  };

  const clearSecurityEvents = () => {
    setSecurityEvents([]);
  };

  return {
    securityEvents,
    sessionToken,
    clearSecurityEvents,
    logSecurityEvent
  };
};