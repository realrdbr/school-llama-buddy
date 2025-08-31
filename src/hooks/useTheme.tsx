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

// Preset themes
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
      'card-foreground': '222.2 84% 4.9%'
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
      'card-foreground': '210 40% 98%'
    },
    is_preset: true
  },
  {
    name: 'Cyan Accent',
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
      'card-foreground': '222.2 84% 4.9%'
    },
    is_preset: true
  }
];

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(presetThemes[0]); // Default to White Mode
  const [userThemes, setUserThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Apply theme colors to CSS variables
  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
    setCurrentTheme(theme);
  };

  // Load user themes from database
  const loadUserThemes = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_themes')
        .select('*')
        .eq('user_id', Number(user.id))
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

      // Find active theme or use default
      const activeTheme = themes.find(theme => theme.is_active);
      if (activeTheme) {
        applyTheme(activeTheme);
      } else {
        // Set default White Mode theme as active
        await setTheme(presetThemes[0]);
      }
    } catch (error) {
      console.error('Error loading user themes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Set theme as active
  const setTheme = async (theme: Theme) => {
    if (!user) return;

    try {
      // Deactivate all current themes
      await supabase
        .from('user_themes')
        .update({ is_active: false })
        .eq('user_id', Number(user.id));

      let themeId = theme.id;

      // If it's a preset, create a copy for the user
      if (theme.is_preset || !theme.id) {
        const { data, error } = await supabase
          .from('user_themes')
          .insert({
            user_id: Number(user.id),
            name: theme.name,
            colors: theme.colors as any,
            is_preset: false,
            is_active: true
          })
          .select()
          .single();

        if (error) throw error;
        themeId = data.id;
      } else {
        // Activate existing theme
        await supabase
          .from('user_themes')
          .update({ is_active: true })
          .eq('id', theme.id);
      }

      applyTheme(theme);
      await loadUserThemes();
    } catch (error) {
      console.error('Error setting theme:', error);
    }
  };

  // Create new custom theme
  const createTheme = async (name: string, colors: ThemeColors) => {
    if (!user) return;

    try {
      // Deactivate all current themes
      await supabase
        .from('user_themes')
        .update({ is_active: false })
        .eq('user_id', Number(user.id));

      const { data, error } = await supabase
        .from('user_themes')
        .insert({
          user_id: Number(user.id),
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

  // Update existing theme
  const updateTheme = async (themeId: string, colors: ThemeColors) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_themes')
        .update({ colors: colors as any })
        .eq('id', themeId)
        .eq('user_id', Number(user.id));

      if (error) throw error;

      if (currentTheme?.id === themeId) {
        applyTheme({ ...currentTheme, colors });
      }
      await loadUserThemes();
    } catch (error) {
      console.error('Error updating theme:', error);
    }
  };

  // Delete theme
  const deleteTheme = async (themeId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_themes')
        .delete()
        .eq('id', themeId)
        .eq('user_id', Number(user.id));

      if (error) throw error;

      // If deleted theme was active, switch to default
      if (currentTheme?.id === themeId) {
        await setTheme(presetThemes[0]);
      }
      await loadUserThemes();
    } catch (error) {
      console.error('Error deleting theme:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserThemes();
    } else {
      // Apply default theme for non-authenticated users
      applyTheme(presetThemes[0]);
      setLoading(false);
    }
  }, [user]);

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