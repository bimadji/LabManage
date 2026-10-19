import type { RequestHandler, Response } from 'express';
import type { Config } from '../config.js';
import { anonClient, userClient } from '../supabase.js';

export const ROLES = ['anggota', 'admin', 'advisor'] as const;
export type Role = (typeof ROLES)[number];

export interface AuthUser {
  id: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/** Resolves a bearer token to a user and role, or null when the token is not valid. */
export interface AuthVerifier {
  verify(token: string): Promise<AuthUser | null>;
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

/** Verifies the JWT with Supabase Auth, then reads the role from `profiles` as that user. */
export function supabaseVerifier(config: Config): AuthVerifier {
  const auth = anonClient(config).auth;
  return {
    async verify(token) {
      const { data, error } = await auth.getUser(token);
      if (error || !data.user) return null;

      const { data: profile, error: profileError } = await userClient(config, token)
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile || !isRole(profile.role)) return null;

      return { id: data.user.id, role: profile.role };
    },
  };
}

/** Requires `Authorization: Bearer <jwt>`; sets `req.user` or responds 401. */
export function requireAuth(verifier: AuthVerifier): RequestHandler {
  return async (req, res, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
    if (!match) {
      sendError(res, 401, 'UNAUTHENTICATED', 'Token login tidak ada');
      return;
    }

    const user = await verifier.verify(match[1]);
    if (!user) {
      sendError(res, 401, 'UNAUTHENTICATED', 'Token login tidak valid');
      return;
    }

    req.user = user;
    next();
  };
}

/** Must run after `requireAuth`; responds 403 when the user's role is not allowed. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      sendError(res, 401, 'UNAUTHENTICATED', 'Token login tidak ada');
      return;
    }
    if (!roles.includes(req.user.role)) {
      sendError(res, 403, 'FORBIDDEN', 'Peran Anda tidak diizinkan untuk aksi ini');
      return;
    }
    next();
  };
}
