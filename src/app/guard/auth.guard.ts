import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

type RolAPI = 'ADMINISTRADOR' | 'TECNICO' | 'USUARIO';

const toApiRole = (r: unknown): RolAPI => {
  const s = String(r ?? '').toUpperCase();
  if (s === 'ADMIN' || s === 'ADMINISTRADOR') return 'ADMINISTRADOR';
  if (s === 'TECNICO' || s === 'TÉCNICO') return 'TECNICO';
  return 'USUARIO';
};

const isTokenExpired = (token: string): boolean => {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return false; 
    const payload = JSON.parse(atob(payloadB64));
    const exp = Number(payload?.exp);
    if (!exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return exp <= now;
  } catch {
    return true;
  }
};

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  const token = localStorage.getItem('token');
  const expirado = token ? isTokenExpired(token) : true;

  if (!token || expirado) {
    if (expirado) {
      localStorage.removeItem('token');
      localStorage.removeItem('rol');
      localStorage.removeItem('nombre');
      localStorage.removeItem('usuario');
    }

    return router.parseUrl(
      '/auth?returnUrl=' + encodeURIComponent(state.url)
    );
  }
  const allowedRaw = (route.data?.['roles'] as string[] | undefined) ?? [];
  if (allowedRaw.length === 0) return true;

  const allowed: RolAPI[] = allowedRaw.map(toApiRole);

  const myRole: RolAPI = toApiRole(localStorage.getItem('rol') || 'USUARIO');


  if (allowed.includes(myRole)) return true;

  return router.parseUrl('/dashboard');
};
