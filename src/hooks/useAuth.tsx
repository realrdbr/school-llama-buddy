import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: number;
  username: string;
  name: string;
  permission_lvl: number;
  password: string;
  created_at: string;
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
    setLoading(false);
  }, []);

  const signInWithUsername = async (username: string, password: string) => {
    try {
      setLoading(true);
      
      // Use Supabase client instead of direct HTTP requests
      const { data: users, error } = await supabase
        .from('permissions')
        .select('*')
        .eq('username', username)
        .eq('password', password);

      if (error || !users || users.length === 0) {
        setLoading(false);
        return { error: { message: 'Ungültiger Benutzername oder Passwort' } };
      }

      const userData = users[0] as any;

      // Create a dummy user for internal auth
      const dummyUser: User = {
        id: userData.username,
        app_metadata: {},
        user_metadata: { username, full_name: userData.name },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: `${username}@internal.school`
      };

      // Set user and profile state
      setUser(dummyUser);
      setProfile({
        id: userData.id,
        username: userData.username,
        name: userData.name,
        permission_lvl: userData.permission_lvl,
        password: userData.password,
        created_at: userData.created_at
      });
      
      setLoading(false);
      return { 
        error: null, 
        mustChangePassword: false 
      };
    } catch (error) {
      setLoading(false);
      return { error };
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    if (!user || !profile) return { error: { message: 'Nicht angemeldet' } };

    try {
      // Verify old password
      if (profile.password !== oldPassword) {
        return { error: { message: 'Falsches aktuelles Passwort' } };
      }

      // Update password using Supabase client
      const { error } = await supabase
        .from('permissions')
        .update({ password: newPassword } as any)
        .eq('username', profile.username);

      if (error) {
        console.error('Update error:', error);
        return { error: { message: 'Fehler beim Aktualisieren des Passworts: ' + error.message } };
      }

      // Update local profile state
      setProfile({ ...profile, password: newPassword });

      return { error: null };
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
      // Check if username already exists
      const { data: existingUsers } = await supabase
        .from('permissions')
        .select('id')
        .eq('username', username);

      if (existingUsers && existingUsers.length > 0) {
        return { error: { message: 'Benutzername bereits vergeben' } };
      }

      // Create new user using Supabase client
      const { error: insertError } = await supabase
        .from('permissions')
        .insert([{
          username,
          password,
          name: fullName,
          permission_lvl: permissionLevel
        } as any]);

      if (insertError) {
        console.error('Insert error:', insertError);
        return { error: { message: 'Fehler beim Erstellen des Benutzers: ' + insertError.message } };
      }

      return { error: null };
    } catch (error) {
      console.error('Create user error:', error);
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