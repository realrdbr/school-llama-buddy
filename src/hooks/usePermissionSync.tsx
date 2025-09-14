import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

/**
 * Hook für Realtime-Synchronisation von Berechtigungsänderungen
 * Überwacht Änderungen in der permissions Tabelle und reagiert entsprechend
 */
export const usePermissionSync = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;

    // Subscribe to realtime changes on permissions table
    const channel = supabase
      .channel('permission-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'permissions',
          filter: `id=eq.${profile.id}` // Only listen to changes for current user
        },
        (payload) => {
          console.log('Permission change detected:', payload);
          
          const newPermissionLevel = payload.new?.permission_lvl;
          const oldPermissionLevel = payload.old?.permission_lvl;
          
          // Check if permission level changed
          if (newPermissionLevel !== oldPermissionLevel) {
            // If user lost admin rights (Level 10)
            if (oldPermissionLevel >= 10 && newPermissionLevel < 10) {
              toast({
                title: "Berechtigung geändert",
                description: "Ihre Admin-Rechte wurden entfernt. Sie werden zur Anmeldung weitergeleitet.",
                variant: "destructive"
              });
              
              // Sign out and redirect after short delay
              setTimeout(async () => {
                await signOut();
                navigate('/auth');
              }, 2000);
            }
            // If user gained admin rights
            else if (oldPermissionLevel < 10 && newPermissionLevel >= 10) {
              toast({
                title: "Berechtigung erweitert",
                description: "Sie haben jetzt Admin-Rechte erhalten.",
              });
              
              // Reload page to update UI with new permissions
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            }
            // Other permission level changes
            else {
              toast({
                title: "Berechtigung geändert",
                description: `Ihr Berechtigungslevel wurde auf ${newPermissionLevel} geändert.`,
              });
              
              // Reload page to update UI
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            }
          }
          
          // Check if class assignment changed
          if (payload.new?.user_class !== payload.old?.user_class) {
            const newClass = payload.new?.user_class;
            const oldClass = payload.old?.user_class;
            
            toast({
              title: "Klasse geändert",
              description: newClass 
                ? `Sie wurden der Klasse ${newClass} zugewiesen.`
                : "Ihre Klassenzuweisung wurde entfernt."
            });
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, signOut, navigate]);

  // Also listen to changes for all users to refresh user lists in admin interfaces
  useEffect(() => {
    if (!profile || profile.permission_lvl < 10) return;

    const allUsersChannel = supabase
      .channel('all-users-sync')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'permissions'
        },
        (payload) => {
          console.log('User data changed:', payload);
          
          // Trigger custom event that components can listen to
          window.dispatchEvent(new CustomEvent('userDataChanged', { 
            detail: { payload } 
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(allUsersChannel);
    };
  }, [profile]);
};

/**
 * Hook für Komponenten die auf Benutzerdatenänderungen reagieren sollen
 */
export const useUserDataSync = (callback: () => void) => {
  useEffect(() => {
    const handleUserDataChange = () => {
      callback();
    };

    window.addEventListener('userDataChanged', handleUserDataChange);
    
    return () => {
      window.removeEventListener('userDataChanged', handleUserDataChange);
    };
  }, [callback]);
};
