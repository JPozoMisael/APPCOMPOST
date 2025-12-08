import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { GeneralService } from './general-service';
import { Usuario } from '../model/usuario';

/** Roles que maneja la API */
type RolAPI = 'ADMINISTRADOR' | 'TECNICO' | 'ESTANDAR';

/** Payload de usuario tal como lo expone la API */
interface UsuarioAPI {
  id: number;
  nombre: string;
  email: string;
  rol: RolAPI;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  /** Asegúrate de que GeneralService apunte a /api y concatene este endpoint */
  private endpoint = 'usuarios';

  constructor(private generalService: GeneralService) {}

  /* =========================
   *   Mapping API <-> UI
   * ========================= */

  /** API -> UI */
  private toUiRole(r: RolAPI): Usuario['rol'] {
    switch (r) {
      case 'ADMINISTRADOR':
        return 'administrador';
      case 'TECNICO':
        return 'tecnico';
      case 'ESTANDAR':
      default:
        return 'estandar';
    }
  }

  /** UI -> API */
  private toApiRole(r?: Usuario['rol']): RolAPI | undefined {
    if (!r) return undefined;
    switch (r) {
      case 'administrador':
        return 'ADMINISTRADOR';
      case 'tecnico':
        return 'TECNICO';
      case 'estandar':
      default:
        return 'ESTANDAR';
    }
  }

  /* ================
   *      CRUD
   * ================ */

  getUsuarios(): Observable<Usuario[]> {
    return this.generalService.get<UsuarioAPI[]>(this.endpoint).pipe(
      map((arr) =>
        (arr || []).map((u) => ({
          id: u.id,
          nombre: u.nombre,
          email: u.email,
          rol: this.toUiRole(u.rol),
        }))
      )
    );
  }

  getUsuarioById(id: number): Observable<Usuario> {
    return this.generalService.get<UsuarioAPI>(`${this.endpoint}/${id}`).pipe(
      map((u) => ({
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        rol: this.toUiRole(u.rol),
      }))
    );
  }

  agregarUsuario(usuario: Partial<Usuario>): Observable<Usuario> {
    const payload: Partial<UsuarioAPI> = {
      nombre: usuario.nombre!,
      email: usuario.email!,
      // Si no viene rol desde el form, enviamos ESTANDAR por defecto
      rol: this.toApiRole(usuario.rol) ?? 'ESTANDAR',
    };

    return this.generalService.post<UsuarioAPI>(this.endpoint, payload).pipe(
      map((u) => ({
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        rol: this.toUiRole(u.rol),
      }))
    );
  }

  /**
   * Edita nombre/email/rol.
   * Nota: El backend validará permisos (solo ADMIN puede cambiar rol).
   */
  actualizarUsuario(id: number, usuario: Partial<Usuario>): Observable<{ mensaje: string } | any> {
    const payload: any = {
      nombre: usuario.nombre,
      email: usuario.email,
    };

    if (typeof usuario.rol !== 'undefined') {
      payload.rol = this.toApiRole(usuario.rol); // ADMIN lo aceptará; no-admin se ignora server-side
    }

    return this.generalService.put(`${this.endpoint}/${id}`, payload);
  }

  eliminarUsuario(id: number): Observable<any> {
    return this.generalService.delete(`${this.endpoint}/${id}`);
  }

  /* =========================
   *   Reset de contraseña
   *   (solo admin)
   * ========================= */

  /**
   * Si pasas password, el backend la usará; si no, generará una temporal.
   * Devuelve { tempPassword } en modo demo para mostrar al admin.
   */
  resetPassword(id: number, password?: string): Observable<{ tempPassword: string }> {
    return this.generalService.post<{ tempPassword: string }>(
      `${this.endpoint}/${id}/reset-password`,
      password ? { password } : {}
    );
  }
}
