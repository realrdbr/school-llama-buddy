
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  'primary-foreground': string;
  secondary: string;
  'secondary-foreground': string;
  accent: string;
  'accent-foreground': string;
  muted: string;
  'muted-foreground': string;
  border: string;
  card: string;
  'card-foreground': string;
  destructive: string;
  'destructive-foreground': string;
  popover: string;
  'popover-foreground': string;
  input: string;
  ring: string;
}

interface Theme {
  id?: string;
  name: string;
  colors: ThemeColors;
  is_preset?: boolean;
  is_active?: boolean;
}

interface ThemeContextType {
  currentTheme: Theme | null;
  userThemes: Theme[];
  presets: Theme[];
  loading: boolean;
  setTheme: (theme: Theme) => Promise<void>;
  createTheme: (name: string, colors: ThemeColors) => Promise<void>;
  updateTheme: (themeId: string, colors: ThemeColors) => Promise<void>;
  deleteTheme: (themeId: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Preset themes with complete color definitions
const presetThemes: Theme[] = [
  {
    name: 'White Mode',
    colors: {
      background: '0 0% 100%',
      foreground: '222.2 84% 4.9%',
      primary: '222.2 47.4% 11.2%',
      'primary-foreground': '210 40% 98%',
      secondary: '210 40% 96.1%',
      'secondary-foreground': '222.2 47.4% 11.2%',
      accent: '210 40% 96.1%',
      'accent-foreground': '222.2 47.4% 11.2%',
      muted: '210 40% 96.1%',
      'muted-foreground': '215.4 16.3% 46.9%',
      border: '214.3 31.8% 91.4%',
      card: '0 0% 100%',
      'card-foreground': '222.2 84% 4.9%',
      destructive: '0 84.2% 60.2%',
      'destructive-foreground': '210 40% 98%',
      popover: '0 0% 100%',
      'popover-foreground': '222.2 84% 4.9%',
      input: '214.3 31.8% 91.4%',
      ring: '222.2 84% 4.9%'
    },
    is_preset: true
  },
  {
    name: 'Dark Mode',
    colors: {
      background: '222.2 84% 4.9%',
      foreground: '210 40% 98%',
      primary: '210 40% 98%',
      'primary-foreground': '222.2 47.4% 11.2%',
      secondary: '217.2 32.6% 17.5%',
      'secondary-foreground': '210 40% 98%',
      accent: '217.2 32.6% 17.5%',
      'accent-foreground': '210 40% 98%',
      muted: '217.2 32.6% 17.5%',
      'muted-foreground': '215 20.2% 65.1%',
      border: '217.2 32.6% 17.5%',
      card: '222.2 84% 4.9%',
      'card-foreground': '210 40% 98%',
      destructive: '0 62.8% 30.6%',
      'destructive-foreground': '210 40% 98%',
      popover: '222.2 84% 4.9%',
      'popover-foreground': '210 40% 98%',
      input: '217.2 32.6% 17.5%',
      ring: '212.7 26.8% 83.9%'
    },
    is_preset: true
  },
  {
    name: 'Gymolb Accent',
    colors: {
      background: '0 0% 100%',
      foreground: '222.2 84% 4.9%',
      primary: '188 100% 33%',
      'primary-foreground': '210 40% 98%',
      secondary: '210 40% 96.1%',
      'secondary-foreground': '222.2 47.4% 11.2%',
      accent: '188 100% 33%',
      'accent-foreground': '210 40% 98%',
      muted: '210 40% 96.1%',
      'muted-foreground': '215.4 16.3% 46.9%',
      border: '214.3 31.8% 91.4%',
      card: '0 0% 100%',
      'card-foreground': '222.2 84% 4.9%',
      destructive: '0 84.2% 60.2%',
      'destructive-foreground': '210 40% 98%',
      popover: '0 0% 100%',
      'popover-foreground': '222.2 84% 4.9%',
      input: '214.3 31.8% 91.4%',
      ring: '188 100% 33%'
    },
    is_preset: true
  }
];

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(presetThemes[0]);
  const [userThemes, setUserThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();

  // Apply theme colors to CSS variables
  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    
    // Apply all theme colors as CSS custom properties
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
    
    // Also set sidebar colors based on theme
    if (theme.name === 'Dark Mode') {
      root.style.setProperty('--sidebar-background', '240 5.9% 10%');
      root.style.setProperty('--sidebar-foreground', '240 4.8% 95.9%');
      root.style.setProperty('--sidebar-primary', '224.3 76.3% 48%');
      root.style.setProperty('--sidebar-primary-foreground', '0 0% 100%');
      root.style.setProperty('--sidebar-accent', '240 3.7% 15.9%');
      root.style.setProperty('--sidebar-accent-foreground', '240 4.8% 95.9%');
      root.style.setProperty('--sidebar-border', '240 3.7% 15.9%');
      root.style.setProperty('--sidebar-ring', '217.2 91.2% 59.8%');
    } else if (theme.name === 'Gymolb Accent') {
      root.style.setProperty('--sidebar-background', '0 0% 98%');
      root.style.setProperty('--sidebar-foreground', '240 5.3% 26.1%');
      root.style.setProperty('--sidebar-primary', '188 100% 33%');
      root.style.setProperty('--sidebar-primary-foreground', '0 0% 98%');
      root.style.setProperty('--sidebar-accent', '188 95% 90%');
      root.style.setProperty('--sidebar-accent-foreground', '188 100% 33%');
      root.style.setProperty('--sidebar-border', '220 13% 91%');
      root.style.setProperty('--sidebar-ring', '188 100% 33%');
    } else {
      // Default light mode sidebar
      root.style.setProperty('--sidebar-background', '0 0% 98%');
      root.style.setProperty('--sidebar-foreground', '240 5.3% 26.1%');
      root.style.setProperty('--sidebar-primary', '240 5.9% 10%');
      root.style.setProperty('--sidebar-primary-foreground', '0 0% 98%');
      root.style.setProperty('--sidebar-accent', '240 4.8% 95.9%');
      root.style.setProperty('--sidebar-accent-foreground', '240 5.9% 10%');
      root.style.setProperty('--sidebar-border', '220 13% 91%');
      root.style.setProperty('--sidebar-ring', '217.2 91.2% 59.8%');
    }
    
    setCurrentTheme(theme);
  };

  // Load user themes from database
  const loadUserThemes = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_themes')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const themes = data?.map(theme => ({
        id: theme.id,
        name: theme.name,
        colors: theme.colors as unknown as ThemeColors,
        is_preset: theme.is_preset,
        is_active: theme.is_active
      })) || [];

      setUserThemes(themes);

      const activeTheme = themes.find(theme => theme.is_active);
      if (activeTheme) {
        applyTheme(activeTheme);
      } else {
        await setTheme(presetThemes[0]);
      }
    } catch (error) {
      console.error('Error loading user themes:', error);
    } finally {
      setLoading(false);
    }
  };

  const setTheme = async (theme: Theme) => {
    // Always apply visually
    applyTheme(theme);

    if (!profile) {
      return;
    }

    try {
      // Deactivate all user's themes
      await supabase
        .from('user_themes')
        .update({ is_active: false })
        .eq('user_id', profile.id);

      if (theme.id) {
        await supabase
          .from('user_themes')
          .update({ is_active: true, colors: theme.colors as any })
          .eq('id', theme.id)
          .eq('user_id', profile.id);
      } else {
        // Handle presets or unsaved themes: try update existing by name, else insert
        const { data: existing } = await supabase
          .from('user_themes')
          .select('id')
          .eq('user_id', profile.id)
          .eq('name', theme.name)
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from('user_themes')
            .update({ colors: theme.colors as any, is_active: true })
            .eq('id', existing.id)
            .eq('user_id', profile.id);
        } else {
          await supabase
            .from('user_themes')
            .insert({
              user_id: profile.id,
              name: theme.name,
              colors: theme.colors as any,
              is_preset: false,
              is_active: true
            });
        }
      }

      await loadUserThemes();
    } catch (error) {
      console.error('Error setting theme:', error);
    }
  };

  const createTheme = async (name: string, colors: ThemeColors) => {
    // Apply immediately for visual feedback
    applyTheme({ name, colors });

    if (!profile) return;

    try {
      await supabase
        .from('user_themes')
        .update({ is_active: false })
        .eq('user_id', profile.id);

      const { data, error } = await supabase
        .from('user_themes')
        .insert({
          user_id: profile.id,
          name,
          colors: colors as any,
          is_preset: false,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      applyTheme({ id: data.id, name, colors, is_preset: false, is_active: true });
      await loadUserThemes();
    } catch (error) {
      console.error('Error creating theme:', error);
    }
  };

  const updateTheme = async (themeId: string, colors: ThemeColors) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('user_themes')
        .update({ colors: colors as any })
        .eq('id', themeId)
        .eq('user_id', profile.id);

      if (error) throw error;

      if (currentTheme?.id === themeId) {
        applyTheme({ ...currentTheme, colors });
      }
      await loadUserThemes();
    } catch (error) {
      console.error('Error updating theme:', error);
    }
  };

  const deleteTheme = async (themeId: string) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('user_themes')
        .delete()
        .eq('id', themeId)
        .eq('user_id', profile.id);

      if (error) throw error;

      if (currentTheme?.id === themeId) {
        await setTheme(presetThemes[0]);
      }
      await loadUserThemes();
    } catch (error) {
      console.error('Error deleting theme:', error);
    }
  };

  useEffect(() => {
    if (profile) {
      loadUserThemes();
    } else {
      applyTheme(presetThemes[0]);
      setLoading(false);
    }
  }, [profile]);

  return (
    <ThemeContext.Provider value={{
      currentTheme,
      userThemes,
      presets: presetThemes,
      loading,
      setTheme,
      createTheme,
      updateTheme,
      deleteTheme
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
