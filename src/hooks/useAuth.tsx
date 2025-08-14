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
      
      // Direct query to permissions table  
      const response = await fetch(
        `https://afnfyivevmqihuqijusi.supabase.co/rest/v1/permissions?username=eq.${username}&password=eq.${password}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmZ5aXZldm1xaWh1cWlqdXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNzQ4MzAsImV4cCI6MjA3MDc1MDgzMH0.iZNTzN55MZK8p0hrZzsaAxbSALp5tVrloUQUiosmbRU',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmZ5aXZldm1xaWh1cWlqdXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNzQ4MzAsImV4cCI6MjA3MDc1MDgzMH0.iZNTzN55MZK8p0hrZzsaAxbSALp5tVrloUQUiosmbRU'
          }
        }
      );

      const users = await response.json();

      if (!response.ok || !users || users.length === 0) {
        setLoading(false);
        return { error: { message: 'Ungültiger Benutzername oder Passwort' } };
      }

      const userData = users[0];

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

      // Manual update since types don't allow password column
      const response = await fetch(
        `https://afnfyivevmqihuqijusi.supabase.co/rest/v1/permissions?username=eq.${profile.username}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmZ5aXZldm1xaWh1cWlqdXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNzQ4MzAsImV4cCI6MjA3MDc1MDgzMH0.iZNTzN55MZK8p0hrZzsaAxbSALp5tVrloUQUiosmbRU',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmZ5aXZldm1xaWh1cWlqdXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNzQ4MzAsImV4cCI6MjA3MDc1MDgzMH0.iZNTzN55MZK8p0hrZzsaAxbSALp5tVrloUQUiosmbRU'
          },
          body: JSON.stringify({ password: newPassword })
        }
      );

      if (!response.ok) {
        throw new Error('Password update failed');
      }

      // Update local profile state
      setProfile({ ...profile, password: newPassword });

      return { error: null };
    } catch (error) {
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
      const checkResponse = await fetch(
        `https://afnfyivevmqihuqijusi.supabase.co/rest/v1/permissions?username=eq.${username}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmZ5aXZldm1xaWh1cWlqdXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNzQ4MzAsImV4cCI6MjA3MDc1MDgzMH0.iZNTzN55MZK8p0hrZzsaAxbSALp5tVrloUQUiosmbRU',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmZ5aXZldm1xaWh1cWlqdXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNzQ4MzAsImV4cCI6MjA3MDc1MDgzMH0.iZNTzN55MZK8p0hrZzsaAxbSALp5tVrloUQUiosmbRU'
          }
        }
      );
      const existingUsers = await checkResponse.json();

      if (existingUsers && existingUsers.length > 0) {
        return { error: { message: 'Benutzername bereits vergeben' } };
      }

      // Manual insert since types don't allow all columns
      const response = await fetch(
        'https://afnfyivevmqihuqijusi.supabase.co/rest/v1/permissions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmZ5aXZldm1xaWh1cWlqdXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNzQ4MzAsImV4cCI6MjA3MDc1MDgzMH0.iZNTzN55MZK8p0hrZzsaAxbSALp5tVrloUQUiosmbRU',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmbmZ5aXZldm1xaWh1cWlqdXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNzQ4MzAsImV4cCI6MjA3MDc1MDgzMH0.iZNTzN55MZK8p0hrZzsaAxbSALp5tVrloUQUiosmbRU'
          },
          body: JSON.stringify({
            username,
            password,
            name: fullName,
            permission_lvl: permissionLevel
          })
        }
      );

      if (!response.ok) {
        throw new Error('User creation failed');
      }

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