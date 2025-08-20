import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import Dashboard from '@/components/Dashboard';
import { useSessionStorage } from '@/hooks/useSessionStorage';

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const { loadLastRoute } = useSessionStorage();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Fallback: if user lands on '/', redirect to last visited route (preserves history via replace)
  useEffect(() => {
    if (!loading && user && location.pathname === '/') {
      (async () => {
        try {
          const lastRoute = await loadLastRoute();
          if (lastRoute && lastRoute !== '/') {
            navigate(lastRoute, { replace: true });
          }
        } catch (e) {
          // ignore
        }
      })();
    }
  }, [loading, user, location.pathname, loadLastRoute, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return <Dashboard />;
};

export default Index;
