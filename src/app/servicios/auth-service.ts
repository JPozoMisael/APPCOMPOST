import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, tap, map } from 'rxjs';
import { GeneralService } from './general-service';

type RolUI = 'administrador' | 'tecnico' | 'usuario';
export type RolAPI = 'ADMINISTRADOR' | 'TECNICO' | 'USUARIO';

export interface UsuarioSesion {
  id?: number;
  nombre?: string;
  email?: string;   // backend
  rol: RolAPI;
}

export interface LoginResponse {
  token?: string;
  usuario?: UsuarioSesion;
  [k: string]: any;
}

export interface MeResponse {
  id: number | string;
  nombre: string;
  correo: string;   // UI usa 'correo'
  rol: RolAPI;
  avatar?: string;  // opcional, si el backend lo envía
}

export interface PerfilPayload { nombre: string; correo: string; }

export interface CambioPasswordPayload {
  actual: string;  // coincide con req.body.actual en el backend
  nueva: string;   // coincide con req.body.nueva en el backend
}

export interface SeguridadState {
  twoFA: boolean;
  ocultarCorreo: boolean;
  dispositivos: number;
}

export interface SeguridadPayload {
  twoFA?: boolean;
  ocultarCorreo?: boolean;
}

export interface UploadAvatarResponse { url: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private endpoint = 'auth';
  private rolSubject = new BehaviorSubject<string>(this.getRol());
  rol$ = this.rolSubject.asObservable();

  constructor(private generalService: GeneralService) {}

  // ================== helpers de rol ==================
  private toApiRole(r: RolUI | RolAPI | string | undefined): RolAPI {
    const s = (r || '').toString().toLowerCase();
    if (s.startsWith('admin')) return 'ADMINISTRADOR';
    if (s.startsWith('téc') || s.startsWith('tec')) return 'TECNICO';
    return 'USUARIO';
  }

  private toUiRole(r: RolAPI | string | undefined): RolUI {
    const s = (r || '').toString().toUpperCase();
    if (s === 'ADMINISTRADOR') return 'administrador';
    if (s === 'TECNICO') return 'tecnico';
    return 'usuario';
  }

  // ================== auth básica ==================
  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    const payload = {
      email: String(credentials.email || '').trim(),
      password: credentials.password,
    };

    return this.generalService.post<LoginResponse>(`${this.endpoint}/login`, payload).pipe(
      tap((res) => {
        if (res?.token) localStorage.setItem('token', res.token);
        if (res?.usuario) {
          const rolUI = this.toUiRole(res.usuario.rol);
          const nombre = res.usuario.nombre || '';
          const correo = res.usuario.email || '';

          localStorage.setItem('nombre', nombre);
          localStorage.setItem('rol', rolUI);
          localStorage.setItem('usuario', JSON.stringify(res.usuario));
          if (correo) localStorage.setItem('correo', correo);

          this.rolSubject.next(rolUI);
        }
      })
    );
  }

  register(data: {
    nombre: string;
    email: string;
    password: string;
    rol: RolUI | RolAPI | string;
  }): Observable<any> {
    const payload = { ...data, rol: this.toApiRole(data.rol) };
    return this.generalService.post(`${this.endpoint}/register`, payload);
  }

  /** Olvidé mi contraseña (POST /auth/recover) */
  recoverPassword(email: string): Observable<any> {
    return this.generalService.post(`${this.endpoint}/recover`, {
      email: String(email || '').trim(),
    });
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
    localStorage.removeItem('nombre');
    localStorage.removeItem('usuario');
    localStorage.removeItem('correo');
    localStorage.removeItem('avatar');
    this.rolSubject.next('usuario');
  }

  // ================== helpers de sesión ==================
  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  getRol(): string {
    return localStorage.getItem('rol') || 'usuario';
  }

  getNombreUsuario(): string {
    return localStorage.getItem('nombre') || 'Invitado';
  }

  getUsuario(): UsuarioSesion | null {
    const usuario = localStorage.getItem('usuario');
    return usuario ? (JSON.parse(usuario) as UsuarioSesion) : null;
  }

  // ================== Perfil (/auth/me) ==================
  getMe(): Observable<MeResponse> {
    return this.generalService.get<any>(`${this.endpoint}/me`).pipe(
      tap((raw) => {
        if (raw?.nombre) localStorage.setItem('nombre', raw.nombre);

        // contemplamos tanto 'correo' como 'email'
        if (raw?.correo) localStorage.setItem('correo', raw.correo);
        else if (raw?.email) localStorage.setItem('correo', raw.email);

        if (raw?.avatar) localStorage.setItem('avatar', raw.avatar);
        if (raw?.rol) localStorage.setItem('rol', this.toUiRole(raw.rol));
      }),
      map((raw) => ({
        id: raw?.id,
        nombre: raw?.nombre ?? '',
        correo: raw?.correo ?? raw?.email ?? '',
        rol: (raw?.rol || 'USUARIO') as RolAPI,
        avatar: raw?.avatar ?? undefined,
      }))
    );
  }

  actualizarPerfil(payload: PerfilPayload): Observable<PerfilPayload> {
    // Enviamos ambos: correo + email, para que el backend updateMe los soporte.
    const body = {
      nombre: payload.nombre,
      correo: payload.correo,
      email: payload.correo,
    };

    return this.generalService.put<any>(`${this.endpoint}/me`, body).pipe(
      map((res) => {
        const nombre = res?.nombre ?? payload.nombre;
        const correo = res?.correo ?? res?.email ?? payload.correo;
        localStorage.setItem('nombre', nombre);
        localStorage.setItem('correo', correo);
        return { nombre, correo };
      })
    );
  }

  // ================== Avatar ==================
  subirAvatar(file: File): Observable<UploadAvatarResponse> {
    const form = new FormData();
    form.append('avatar', file); // <-- el nombre 'avatar' debe coincidir con tu backend

    return this.generalService.post<UploadAvatarResponse>(`${this.endpoint}/avatar`, form).pipe(
      tap((res) => {
        if (res?.url) {
          localStorage.setItem('avatar', res.url);
        }
      })
    );
  }

  // ================== Seguridad ==================
  cambiarPassword(payload: CambioPasswordPayload): Observable<any> {
    // backend acepta { actual, nueva }
    return this.generalService.post(`${this.endpoint}/change-password`, payload);
  }

  getSeguridad(): Observable<SeguridadState> {
    return this.generalService.get<SeguridadState>(`${this.endpoint}/security`);
  }

  actualizarSeguridad(payload: SeguridadPayload): Observable<any> {
    return this.generalService.patch(`${this.endpoint}/security`, payload);
  }

  cerrarOtrasSesiones(): Observable<any> {
    return this.generalService.post(`${this.endpoint}/close-sessions`, {});
  }

  eliminarCuenta(): Observable<any> {
    return this.generalService.delete(`${this.endpoint}/me`);
  }
}
