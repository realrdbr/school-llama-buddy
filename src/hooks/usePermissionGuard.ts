import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from './usePermissions';
import { useToast } from './use-toast';

interface UsePermissionGuardOptions {
  requiredPermission: string;
  redirectTo?: string;
  showToast?: boolean;
}

export function usePermissionGuard({ 
  requiredPermission, 
  redirectTo = '/', 
  showToast = true 
}: UsePermissionGuardOptions) {
  const { can, loading } = usePermissions();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (loading) return;
    
    if (!can(requiredPermission)) {
      if (showToast) {
        toast({
          variant: "destructive",
          title: "Zugriff verweigert",
          description: "Sie haben keine Berechtigung für diese Funktion."
        });
      }
      navigate(redirectTo);
    }
  }, [can, requiredPermission, loading, navigate, redirectTo, showToast, toast]);

  return { hasPermission: can(requiredPermission), loading };
}