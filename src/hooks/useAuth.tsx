import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: number;
  user_id: string;
  username: string;
  name: string;
  permission_lvl: number;
  password: string;
  created_at: string;
  must_change_password?: boolean;
  user_class?: string | null;
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
    // Check for stored login data in cookies
    const storedProfile = localStorage.getItem('school_profile');
    if (storedProfile) {
      try {
        const profile = JSON.parse(storedProfile);
        setProfile(profile);
        setUser({
          id: profile.username,
          app_metadata: {},
          user_metadata: { username: profile.username, full_name: profile.name },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          email: `${profile.username}@internal.school`
        });
      } catch (error) {
        console.error('Error loading stored profile:', error);
        localStorage.removeItem('school_profile');
      }
    }
    setLoading(false);
  }, []);

  const signInWithUsername = async (username: string, password: string) => {
    try {
      setLoading(true);
      
      // Use the verify_user_login function instead of direct password check
      const { data, error } = await supabase.rpc('verify_user_login', {
        username_input: username,
        password_input: password
      });

      if (error || !data || data.length === 0) {
        setLoading(false);
        return { error: { message: 'Ungültiger Benutzername oder Passwort' } };
      }

      const userData = data[0];

      // Fetch additional profile info (e.g., class)
      const { data: permRow } = await supabase
        .from('permissions')
        .select('user_class')
        .eq('id', userData.user_id)
        .single();

      // Create a dummy user for internal auth
      const dummyUser: User = {
        id: username,
        app_metadata: {},
        user_metadata: { username, full_name: userData.full_name },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: `${username}@internal.school`
      };

      const profileData: Profile = {
        id: userData.user_id,
        user_id: userData.user_id.toString(),
        username: username,
        name: userData.full_name,
        permission_lvl: userData.permission_level,
        password: 'encrypted',
        created_at: new Date().toISOString(),
        must_change_password: userData.must_change_password || false,
        user_class: permRow?.user_class ?? null
      };

      // Set user and profile state
      setUser(dummyUser);
      setProfile(profileData);
      
      // Store login data in localStorage for persistence
      localStorage.setItem('school_profile', JSON.stringify(profileData));
      
      setLoading(false);
      return { 
        error: null, 
        mustChangePassword: userData.must_change_password || false 
      };
    } catch (error) {
      setLoading(false);
      return { error };
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    if (!user || !profile) return { error: { message: 'Nicht angemeldet' } };

    try {
      const { data, error } = await supabase.rpc('change_user_password', {
        user_id_input: profile.id,
        old_password: oldPassword,
        new_password: newPassword
      });

      if (error) {
        console.error('Password change error:', error);
        return { error: { message: 'Fehler beim Ändern des Passworts' } };
      }

      if ((data as any)?.success) {
        // Update local profile state
        setProfile({ ...profile, must_change_password: false });
        return { error: null };
      } else {
        return { error: { message: (data as any)?.error || 'Passwort konnte nicht geändert werden' } };
      }
    } catch (error) {
      console.error('Change password error:', error);
      return { error };
    }
  };

  const createUser = async (username: string, password: string, fullName: string, permissionLevel: number) => {
    if (!user || !profile) return { error: { message: 'Nicht angemeldet' } };

    // Check if creator has permission level 10 (Schulleitung)
    if (profile.permission_lvl < 10) {
      return { error: { message: 'Keine Berechtigung zum Erstellen von Benutzern' } };
    }

    try {
      const { data, error } = await supabase.rpc('create_school_user', {
        username_input: username,
        password_input: password,
        full_name_input: fullName,
        permission_level_input: permissionLevel,
        creator_user_id: profile.id
      });

      if (error) {
        console.error('Create user error:', error);
        return { error: { message: error.message } };
      }

      if ((data as any)?.success) {
        return { error: null };
      } else {
        return { error: { message: (data as any)?.error || 'Benutzer konnte nicht erstellt werden' } };
      }
    } catch (error) {
      console.error('Create user error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    // Clear stored login data
    localStorage.removeItem('school_profile');
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