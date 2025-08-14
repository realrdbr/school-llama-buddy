import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  permission_id: number | null;
  permission_level?: number;
  permission_name?: string;
  must_change_password?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: any; mustChangePassword?: boolean }>;
  signOut: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ error: any }>;
  createUser: (username: string, password: string, fullName: string, permissionLevel: number) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch profile when user is authenticated
        if (session?.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          fetchUserProfile(session.user.id);
        }, 0);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          permissions (
            permission_lvl,
            name
          )
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      setProfile({
        ...data,
        permission_level: data.permissions?.permission_lvl,
        permission_name: data.permissions?.name
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const signInWithUsername = async (username: string, password: string) => {
    try {
      const { data, error } = await supabase.rpc('verify_user_login', {
        username_input: username,
        password_input: password
      });

      if (error || !data || data.length === 0) {
        return { error: { message: 'Ungültiger Benutzername oder Passwort' } };
      }

      const userData = data[0];
      
      // Create a dummy session for internal auth
      const dummyUser: User = {
        id: userData.user_id,
        app_metadata: {},
        user_metadata: { username, full_name: userData.full_name },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: `${username}@internal.school`
      };

      setUser(dummyUser);
      setProfile({
        id: userData.profile_id,
        user_id: userData.user_id,
        email: `${username}@internal.school`,
        full_name: userData.full_name,
        permission_id: null,
        permission_level: userData.permission_level,
        permission_name: '',
        must_change_password: userData.must_change_password
      });

      return { 
        error: null, 
        mustChangePassword: userData.must_change_password 
      };
    } catch (error) {
      return { error };
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    if (!user) return { error: { message: 'Nicht angemeldet' } };

    try {
      const { data, error } = await supabase.rpc('change_user_password', {
        user_id_input: user.id,
        old_password: oldPassword,
        new_password: newPassword
      });

      if (error) return { error };
      
      const result = data as any;
      if (result?.error) return { error: { message: result.error } };

      // Update profile to remove must_change_password flag
      if (profile) {
        setProfile({ ...profile, must_change_password: false });
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const createUser = async (username: string, password: string, fullName: string, permissionLevel: number) => {
    if (!user) return { error: { message: 'Nicht angemeldet' } };

    try {
      const { data, error } = await supabase.rpc('create_school_user', {
        username_input: username,
        password_input: password,
        full_name_input: fullName,
        permission_level_input: permissionLevel,
        creator_user_id: user.id
      });

      if (error) return { error };
      
      const result = data as any;
      if (result?.error) return { error: { message: result.error } };

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      signInWithUsername,
      signOut,
      changePassword,
      createUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};