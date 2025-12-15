import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, timer } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { GeneralService } from './general-service';

export type EstadoAccion = 'pendiente' | 'aplicada' | string;

export interface AccionAuto {
  id: number;
  descripcion: string;
  estado: EstadoAccion;
  fecha: string | Date;
}

@Injectable({ providedIn: 'root' })
export class FuzzyService {
  private readonly base = 'fuzzy';
  private readonly healthPath = 'fuzzy/health';
  private readonly lastActionPath = `${this.base}/last`;

  /** Store reactivo en memoria */
  private _store$ = new BehaviorSubject<AccionAuto[]>([]);
  acciones$ = this._store$.asObservable();

  // para cachear el listado y poder refrescar manualmente
  private refresh$ = new BehaviorSubject<void>(undefined);

  private lastActionCache: AccionAuto | null = null;
  private lastActionCacheValid = false;

  constructor(private http: GeneralService) {}

  health(): Observable<{ ok: boolean; [k: string]: any }> {
    return this.http.get<any>(this.healthPath).pipe(
      catchError(() => of({ ok: false }))
    );
  }

  /** Sincroniza store desde backend */
  list(): Observable<AccionAuto[]> {
    return this.refresh$.pipe(
      switchMap(() =>
        this.http.get<AccionAuto[]>(this.base).pipe(
          map(arr => (Array.isArray(arr) ? arr : [])),
          tap(list => this._store$.next(list)),
          catchError(() => {
            this._store$.next([]);
            return of([]);
          }),
          shareReplay(1)
        )
      )
    );
  }

  /** Carga inicial/forzada */
  loadFromServer(): Observable<AccionAuto[]> {
    return this.list();
  }

  /** Forzar recarga */
  refresh(): void {
    this.refresh$.next();
    this.invalidateLastActionCache();
  }

  getById(id: number): Observable<AccionAuto> {
    return this.http.get<AccionAuto>(`${this.base}/${id}`);
  }

  create(payload: Partial<AccionAuto> & { descripcion: string }): Observable<AccionAuto> {
    return this.http.post<AccionAuto>(this.base, payload).pipe(
      tap(() => this.refresh()),
      catchError(() => of(payload as any))
    );
  }

  apply(id: number): Observable<{ ok: boolean; [k: string]: any }> {
    return this.http.post<{ ok: boolean; [k: string]: any }>(`${this.base}/aplicar/${id}`, {}).pipe(
      tap(() => this.refresh()),
      catchError(() => of({ ok: false }))
    );
  }

  /** Polling: acciones nuevas cada 10s (ajusta) */
  accionesCount$ = timer(0, 10000).pipe(
    switchMap(() => this.list()),
    map(list => list.length),
    shareReplay(1)
  );

  last(): Observable<AccionAuto | null> {
    if (this.lastActionCacheValid) return of(this.lastActionCache);

    return this.http.get<AccionAuto | null>(this.lastActionPath).pipe(
      tap(action => {
        this.lastActionCache = action;
        this.lastActionCacheValid = true;
      }),
      catchError(() => {
        return this.list().pipe(
          map(lista => {
            if (!lista?.length) return null;
            const sorted = [...lista].sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));
            this.lastActionCache = sorted[0] ?? null;
            this.lastActionCacheValid = true;
            return this.lastActionCache;
          })
        );
      })
    );
  }

  private invalidateLastActionCache(): void {
    this.lastActionCacheValid = false;
    this.lastActionCache = null;
  }
}
