import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useAdminRights = () => {
  const { profile } = useAuth();
  const [hasAdminRights, setHasAdminRights] = useState(false);
  const [isCheckingRights, setIsCheckingRights] = useState(true);

  // New simple rule: All level 10+ users always have admin rights on all devices
  useEffect(() => {
    if (!profile) {
      setHasAdminRights(false);
      setIsCheckingRights(false);
      return;
    }
    const isAdmin = (profile.permission_lvl ?? 0) >= 10;
    setHasAdminRights(isAdmin);
    setIsCheckingRights(false);
  }, [profile]);

  // No-op: keeping API for UI components, but rights are level-based now
  const requestAdminRights = async (): Promise<boolean> => {
    return (profile?.permission_lvl ?? 0) >= 10;
  };

  const releaseAdminRights = async (): Promise<boolean> => {
    return (profile?.permission_lvl ?? 0) >= 10;
  };

  return {
    hasAdminRights,
    isCheckingRights,
    requestAdminRights,
    releaseAdminRights
  };
};