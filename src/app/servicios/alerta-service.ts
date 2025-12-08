import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, timer } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { GeneralService } from './general-service';
import { Alerta } from '../model/alerta';

@Injectable({ providedIn: 'root' })
export class AlertasService {
  /** Store reactivo en memoria (bandeja) */
  private _store$ = new BehaviorSubject<Alerta[]>([]);
  /** Exposición del store para páginas/componentes */
  alertas$ = this._store$.asObservable();

  constructor(private general: GeneralService) {}

  // ========= LECTURA DESDE BACKEND =========
  /** Sincroniza la bandeja con GET /alertas */
  getAlertas(): Observable<Alerta[]> {
    return this.general.get<Alerta[]>('alertas').pipe(
      map(list => Array.isArray(list) ? list : []),
      tap(list => this._store$.next(list))
    );
  }

  /** Carga inicial/forzada */
  loadFromServer(): Observable<Alerta[]> {
    return this.getAlertas();
  }

  // ========= INSERCIÓN LOCAL (sin backend) =========
  /**
   * Inserta en la bandeja localmente (sincrónico).
   * Genera id temporal y normaliza fecha a ISO string si no llega.
   */
  pushLocal(a: Partial<Alerta> & { descripcion: string; tipo?: string; critico?: boolean; fecha?: string }): void {
    const nowIso = a.fecha ?? new Date().toISOString();
    const alerta: Alerta = {
      id: a.id ?? ('tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2)),
      tipo: a.tipo ?? (a.critico ? 'danger' : 'warning'),
      descripcion: a.descripcion,
      fecha: nowIso,
      critico: a.critico ?? (a.tipo === 'danger'),
      leida: a.leida ?? false,
    };
    this._store$.next([alerta, ...this._store$.value]);
  }

  // ========= CREACIÓN EN BACKEND (opcional) =========
  /** POST /alertas (si tu API lo soporta) + re-sync */
  crearEnServidor(a: Partial<Alerta>): Observable<any> {
    const body: Partial<Alerta> = {
      ...a,
      fecha: a.fecha ?? new Date().toISOString(),
      leida: a.leida ?? false,
      critico: a.critico ?? (a.tipo === 'danger'),
    };
    return this.general.post<any>('alertas', body).pipe(
      tap(() => this.loadFromServer().subscribe()),
      catchError(() => of(null))
    );
  }

  // ========= CONTADOR DE NO LEÍDAS =========
  /** Polling cada 10s al backend para badge (ajustable) */
  unreadCount$ = timer(0, 10000).pipe(
    switchMap(() => this.getAlertas()),
    map(list => list.filter(a => !a.leida).length),
    shareReplay(1)
  );

  // ========= MARCAR COMO LEÍDA =========
  /** PATCH /alertas/:id {leida:true} aceptando string|number; fallback local si falla */
  marcarComoLeida(id: string | number): Observable<any> {
    const idStr = String(id);
    return this.general.patch<any>(`alertas/${idStr}`, { leida: true }).pipe(
      catchError(() => {
        const list = this._store$.value.map(a =>
          String(a.id) === idStr ? { ...a, leida: true } : a
        );
        this._store$.next(list);
        return of(null);
      }),
      tap(() => this.loadFromServer().subscribe())
    );
  }
}
