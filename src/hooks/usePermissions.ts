import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Lightweight permission helper that merges user-specific and level defaults
export function usePermissions() {
  const { profile } = useAuth();
  const [levelPerms, setLevelPerms] = useState<Record<number, Record<string, boolean>>>({});
  const [userPerms, setUserPerms] = useState<Record<string, boolean>>({});
  const [classPerms, setClassPerms] = useState<Record<string, boolean>>({});
  const [requiresLevel, setRequiresLevel] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        // Load level permissions
        const { data: lp } = await supabase.from('level_permissions').select('*');
        const lvl: Record<number, Record<string, boolean>> = {};
        for (let i = 1; i <= 10; i++) lvl[i] = {};
        (lp || []).forEach((r: any) => {
          if (!lvl[r.level]) lvl[r.level] = {} as any;
          lvl[r.level][r.permission_id] = r.allowed;
        });

        // Load user permissions
        const uid = profile?.id;
        let up: Record<string, boolean> = {};
        if (uid) {
          const { data: upData } = await supabase.from('user_permissions').select('*').eq('user_id', uid);
          (upData || []).forEach((r: any) => { up[r.permission_id] = r.allowed; });
        }

        // Load class permissions
        const userClass = (profile as any)?.user_class;
        let cp: Record<string, boolean> = {};
        if (userClass) {
          const { data: cpData } = await supabase.from('class_permissions').select('*').eq('class_name', userClass);
          (cpData || []).forEach((r: any) => { cp[r.permission_id] = r.allowed; });
        }

        // Load permission definitions (requires_level)
        const { data: defs } = await supabase.from('permission_definitions').select('id, requires_level');
        const req: Record<string, number> = {};
        (defs || []).forEach((d: any) => { req[d.id] = d.requires_level; });

        if (!active) return;
        setLevelPerms(lvl);
        setUserPerms(up);
        setClassPerms(cp);
        setRequiresLevel(req);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [profile?.id]);

  const can = useMemo(() => {
    return (permissionId: string) => {
      const lvl = profile?.permission_lvl || 1;
      // Enforce minimal required level if present
      const minLvl = requiresLevel[permissionId];
      if (typeof minLvl === 'number' && lvl < minLvl) return false;
      // User-specific override first
      if (permissionId in userPerms) return !!userPerms[permissionId];
      // Class-specific override second
      if (permissionId in classPerms) return !!classPerms[permissionId];
      // Fallback to level default
      return !!levelPerms[lvl]?.[permissionId];
    };
  }, [profile?.permission_lvl, userPerms, classPerms, levelPerms, requiresLevel]);

  return { can, loading };
}
