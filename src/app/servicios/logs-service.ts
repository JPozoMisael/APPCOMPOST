import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { GeneralService } from './general-service';
import { map } from 'rxjs/operators';

export interface LogRow {
  // Campos de la API
  id?: number;
  accion: string;
  descripcion?: string;
  usuario_id?: number | null;
  dispositivo_id?: number | null;
  ip?: string | null;
  user_agent?: string | null;
  creado_en?: string;

  // Alias para tu UI (OBLIGATORIOS para evitar undefined en templates)
  detalle: string; // alias de descripcion
  fecha: string;   // alias de creado_en
}

export interface LogsQuery {
  accion?: string;
  usuario_id?: number;
  dispositivo_id?: number;
  desde?: string;
  hasta?: string;
  /** No lo usa el backend; lo aplicamos en cliente para mantener compatibilidad */
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class LogsService {
  private endpoint = 'logs'; // -> http://localhost:3000/api/logs

  constructor(private generalService: GeneralService) {}

  /**
   * Crear log genérico.
   * Backend espera { accion, descripcion, dispositivo_id? }.
   */
  crear(
    accion: string,
    descripcion: string,
    dispositivo_id?: number | null
  ): Observable<{ ok: boolean; id: number }> {
    const body: any = { accion, descripcion };
    if (typeof dispositivo_id !== 'undefined') {
      body.dispositivo_id = dispositivo_id;
    }
    return this.generalService.post<{ ok: boolean; id: number }>(
      `${this.endpoint}`,
      body
    );
  }

  /** Compat: registrarLog(mensaje) -> accion fija APP_LOG */
  registrarLog(mensaje: string): Observable<any> {
    return this.crear('APP_LOG', String(mensaje ?? ''));
  }

  /**
   * Compat con Perfil / otros módulos:
   * Descripción queda como: "ACCION | usuario | detalle"
   * Ej: "LOGIN | Misael | Inició sesión desde Chrome"
   */
  registrarLogDetallado(
    accion: string,
    usuario?: string,
    detalle?: string
  ): Observable<any> {
    const partes = [accion, usuario, detalle].filter(Boolean).join(' | ');
    return this.crear(accion, partes || accion);
  }

  /**
   * Helper algo más flexible:
   * - Si envías (accion, 'Misael', 'Detalle X') → usa registrarLogDetallado.
   * - Si solo envías (accion, 'Descripción directa') → no se pone usuario.
   */
  registrarLogSimple(
    accion: string,
    usuarioODescripcion?: string,
    detalleOpcional?: any
  ): Observable<any> {
    if (detalleOpcional !== undefined) {
      // usuario + detalle
      return this.registrarLogDetallado(
        accion,
        String(usuarioODescripcion ?? ''),
        String(detalleOpcional ?? '')
      );
    }
    // Solo descripción
    return this.registrarLogDetallado(
      accion,
      undefined,
      String(usuarioODescripcion ?? '')
    );
  }

  /**
   * === Helpers específicos para CONFIGURACIÓN DE PARÁMETROS ===
   * No son obligatorios, pero ayudan a mantener nombres consistentes.
   */

  /**
   * Log cuando un usuario actualiza los parámetros del proceso.
   * Ej: ACCION = PARAMETROS_ACTUALIZADOS
   */
  registrarCambioParametros(
    usuario: string,
    payload: any
  ): Observable<any> {
    const detalle = `Actualizó parámetros del proceso: ${JSON.stringify(
      payload
    )}`;
    return this.registrarLogDetallado(
      'PARAMETROS_ACTUALIZADOS',
      usuario,
      detalle
    );
  }

  /**
   * Log cuando un usuario restablece los parámetros a valores sugeridos.
   * Ej: ACCION = PARAMETROS_RESTABLECIDOS
   */
  registrarRestablecerParametros(usuario: string): Observable<any> {
    const detalle =
      'Restableció parámetros del proceso a valores sugeridos por el sistema.';
    return this.registrarLogDetallado(
      'PARAMETROS_RESTABLECIDOS',
      usuario,
      detalle
    );
  }

  /**
   * Listado (ADMIN).
   * Mapea a tu UI:
   * - 'creado_en' -> 'fecha' (string, default '')
   * - 'descripcion' -> 'detalle' (string, default '')
   * Soporta 'limit' en cliente para no tocar el backend.
   *
   * Hacemos el método genérico para permitir llamadas tipo:
   *   obtenerLogs<LogRow[]>({ ... })
   */
  obtenerLogs<T = LogRow[]>(params?: LogsQuery): Observable<T> {
    const { limit, ...serverParams } = params || {};

    return this.generalService
      .get<any[]>(`${this.endpoint}`, { params: serverParams as any })
      .pipe(
        map((rows: any[]) => {
          const withAliases: LogRow[] = (rows || []).map((r: any) => ({
            ...r,
            // Evitar undefined en las plantillas:
            fecha: (r.fecha ?? r.creado_en ?? '') as string,
            detalle: (r.detalle ?? r.descripcion ?? '') as string,
          }));

          const limited =
            typeof limit === 'number'
              ? withAliases.slice(0, Math.max(0, limit))
              : withAliases;

          return limited as unknown as T;
        })
      );
  }

  /**
   * Wrapper sencillo para el componente de auditoría:
   * Permite obtener todos los logs o limitar la cantidad.
   */
  getLogs(limit?: number): Observable<LogRow[]> {
    return this.obtenerLogs<LogRow[]>({
      limit,
    });
  }

  /**
   * Antes usabas /logs/error-tecnico.
   * Ahora lo registramos como un log normal con ACCION=ERROR_TECNICO.
   */
  registrarErrorTecnico(error: any, origen?: string): Observable<any> {
    try {
      const desc =
        `[${origen || 'app'}] ` +
        (error?.message ? error.message : String(error)) +
        (error?.stack
          ? ` | stack: ${String(error.stack).slice(0, 500)}`
          : '');
      return this.crear('ERROR_TECNICO', desc);
    } catch {
      return of(null);
    }
  }
}
