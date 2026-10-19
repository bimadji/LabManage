import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabase';

export interface SessionState {
  session: Session | null;
  loading: boolean;
}

/** Tracks the Supabase Auth session and re-renders on sign-in, sign-out, and token refresh. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;

    supabaseClient()
      .auth.getSession()
      .then(({ data }) => {
        if (active) setState({ session: data.session, loading: false });
      });

    const { data } = supabaseClient().auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
