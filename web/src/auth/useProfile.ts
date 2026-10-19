import { useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabase';
import type { Role } from '../types';

export interface Profile {
  id: string;
  role: Role;
  fullName: string;
}

export interface ProfileState {
  profile: Profile | null;
  loading: boolean;
}

/** Reads the signed-in user's profile. RLS already allows reading one's own row. */
export function useProfile(): ProfileState {
  const [state, setState] = useState<ProfileState>({ profile: null, loading: true });

  useEffect(() => {
    let active = true;
    const supabase = supabaseClient();

    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (!data.user) return null;
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, full_name')
          .eq('id', data.user.id)
          .single<{ id: string; role: Role; full_name: string }>();
        return profile;
      })
      .then((profile) => {
        if (!active) return;
        setState({
          profile: profile
            ? { id: profile.id, role: profile.role, fullName: profile.full_name }
            : null,
          loading: false,
        });
      })
      .catch(() => {
        if (active) setState({ profile: null, loading: false });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
