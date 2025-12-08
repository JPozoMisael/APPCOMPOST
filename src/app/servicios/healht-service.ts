import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, BehaviorSubject } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { GeneralService } from './general-service';

export type HealthState = 'UP' | 'DOWN' | 'UNKNOWN';
export interface HealthStatus {
  name: string;
  status: HealthState;
  info?: any;
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  constructor(private http: GeneralService) {}

  /**
   * Ajusta estos paths a cómo construye URLs tu GeneralService.
   * - Si GeneralService ya antepone '/api', usa 'health'.
   * - Si NO, usa 'api/health'.
   */
  private endpoints = {
    api:  'health',        // <- GeneralService.get('health') → /api/health
    db:   null as string | null,   // p.ej. 'health/db' si la expones
    mqtt: null as string | null,   // p.ej. 'health/mqtt' si la expones
  };

  /** Emisor para invalidar cache cuando se requiera (refresh manual). */
  private refresh$ = new BehaviorSubject<void>(undefined);

  /** Expuesto: resumen cacheado; llamar refresh() para recargar. */
  resumen(): Observable<HealthStatus[]> {
    return this.refresh$.pipe(
      switchMap(() => this.buildResumenOnce()),
      // cachea el último valor para múltiples suscriptores
      shareReplay(1)
    );
  }

  /** Fuerza recarga (invalida cache). */
  refresh(): void {
    this.refresh$.next();
  }

  // ------------ Privado ------------

  /** Llama solo una vez a cada endpoint habilitado (sin cache). */
  private buildResumenOnce(): Observable<HealthStatus[]> {
    const calls: Observable<HealthStatus>[] = [];

    if (this.endpoints.api)  calls.push(this.ping(this.endpoints.api, 'API'));
    if (this.endpoints.db)   calls.push(this.ping(this.endpoints.db, 'Base de datos'));
    if (this.endpoints.mqtt) calls.push(this.ping(this.endpoints.mqtt, 'Broker MQTT'));

    if (!calls.length) {
      return of<HealthStatus[]>([
        { name: 'API', status: 'UNKNOWN' },
        { name: 'Base de datos', status: 'UNKNOWN' },
        { name: 'Broker MQTT', status: 'UNKNOWN' },
      ]);
    }
    return forkJoin(calls);
  }

  /** Ping genérico a un endpoint de salud. Marca UP si responde 2xx; DOWN si falla. */
  private ping(path: string, name: string): Observable<HealthStatus> {
    return this.http.get<any>(path).pipe(
      map((info) => {
        // Si tu backend devuelve { ok, services, ts } puedes incluirlo en info:
        return { name, status: 'UP' as const, info };
      }),
      catchError((err) => of({ name, status: 'DOWN' as const, info: { error: String(err) } }))
    );
  }
}
