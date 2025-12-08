import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { GeneralService } from './general-service';

export type EstadoAccion = 'pendiente' | 'aplicada' | string;

export interface AccionAuto {
  id: number;
  descripcion: string;
  estado: EstadoAccion;
  fecha: string | Date;
  // agrega aquí otros campos si tu API los devuelve (p.ej. autor, dispositivo_id, etc.)
}

@Injectable({ providedIn: 'root' })
export class FuzzyService {
  // Base de rutas (GeneralService ya antepone /api según tu environment)
  private readonly base = 'fuzzy';           // -> /api/fuzzy
  private readonly healthPath = 'fuzzy/health'; // -> /api/fuzzy/health (público recomendado)

  // para cachear el listado y poder refrescar manualmente
  private refresh$ = new BehaviorSubject<void>(undefined);

  constructor(private http: GeneralService) {}

  // Health del módulo (ping simple)
  health(): Observable<{ ok: boolean; [k: string]: any }> {
    return this.http.get<any>(this.healthPath).pipe(
      catchError(() => of({ ok: false }))
    );
  }

  
  // Listado de acciones (cacheado)
  list(): Observable<AccionAuto[]> {
    return this.refresh$.pipe(
      switchMap(() =>
        this.http.get<AccionAuto[]>(this.base).pipe(
          map(arr => (Array.isArray(arr) ? arr : [])),
          shareReplay(1)
        )
      )
    );
  }

  // Forzar recarga del listado (invalidar cache)
  refresh(): void {
    this.refresh$.next();
  }

  // Obtener una acción por ID
  getById(id: number): Observable<AccionAuto> {
    return this.http.get<AccionAuto>(`${this.base}/${id}`);
  }

  // Crear nueva acción (admin/técnico)
  // payload mínimo: { descripcion, estado?, fecha? }
  create(payload: Partial<AccionAuto> & { descripcion: string }): Observable<AccionAuto> {
    return this.http.post<AccionAuto>(this.base, payload).pipe(
      // tras crear, refresca el cache de list()
      map(res => {
        this.refresh();
        return res;
      })
    );
  }

  // Aplicar acción (admin/técnico)
  // backend: POST /api/fuzzy/aplicar/:id
  apply(id: number): Observable<{ ok: boolean; [k: string]: any }> {
    return this.http.post<{ ok: boolean; [k: string]: any }>(`${this.base}/aplicar/${id}`, {}).pipe(
      map(res => {
        this.refresh(); // refresca el listado para reflejar estado 'aplicada'
        return res;
      })
    );
  }

  
  // Última acción por fecha (o null)

  last(): Observable<AccionAuto | null> {
    return this.list().pipe(
      map(lista => {
        if (!lista?.length) return null;
        // ordena por fecha descendente
        const sorted = [...lista].sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));
        return sorted[0] ?? null;
      })
    );
  }
}
