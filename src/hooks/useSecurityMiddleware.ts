import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SecurityEvent {
  type: 'session_timeout' | 'suspicious_activity' | 'permission_change' | 'session_error';
  timestamp: Date;
  details: string;
}

export const useSecurityMiddleware = () => {
  const { profile, signOut } = useAuth();
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Enhanced session validation and security
  useEffect(() => {
    if (!profile) return;

    const validateSession = async () => {
      try {
        // Enhanced session validation with server-side verification
        const storedSession = localStorage.getItem('sessionToken');
        if (!storedSession) {
          await cleanupSession();
          return;
        }

        // Validate session with server
        const { data, error } = await supabase.rpc('validate_session_security', {
          session_id_param: storedSession
        });
        
        if (error || !data) {
          logSecurityEvent('session_timeout', 'Session validation failed - auto logout');
          await cleanupSession();
          return;
        }

        // Check for token rotation need (every 20 minutes for enhanced security)
        const sessionData = JSON.parse(localStorage.getItem('profile') || '{}');
        const lastRotation = sessionData.lastTokenRotation || 0;
        if (Date.now() - lastRotation > 20 * 60 * 1000) { // 20 minutes
          await rotateSessionToken(storedSession);
        }
      } catch (error) {
        console.error('Session validation error:', error);
        logSecurityEvent('session_error', 'Critical session validation error');
        await cleanupSession();
      }
    };

    const cleanupSession = async () => {
      // Enhanced session cleanup
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('profile');
      localStorage.removeItem('lastRoute');
      sessionStorage.clear();
      await signOut();
    };

    // Validate session every 3 minutes (more frequent for security)
    const interval = setInterval(validateSession, 3 * 60 * 1000);
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
      // Enhanced session rotation with server-side validation
      const { data, error } = await supabase.rpc('rotate_session_token', {
        old_session_token: oldToken
      });

      if (error || !data) {
        logSecurityEvent('session_timeout', 'Session rotation failed');
        await signOut();
        return;
      }

      // Update stored session with new token
      localStorage.setItem('sessionToken', data);
      setSessionToken(data);
      
      // Update last rotation timestamp
      const profileData = JSON.parse(localStorage.getItem('profile') || '{}');
      profileData.lastTokenRotation = Date.now();
      localStorage.setItem('profile', JSON.stringify(profileData));
      
      logSecurityEvent('session_timeout', 'Session token rotated successfully');
    } catch (error) {
      console.error('Session rotation error:', error);
      logSecurityEvent('session_timeout', 'Session rotation failed with error');
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