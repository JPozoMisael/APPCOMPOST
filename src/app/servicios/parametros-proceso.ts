// src/app/servicios/parametros-proceso.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GeneralService } from './general-service';

// La forma en que guardas los parámetros en backend
export interface ParametrosProceso {
  // Ambientales
  tempMin: number;
  tempMax: number;
  humMin: number;
  humMax: number;
  gasUmbral: number;

  // Control automático
  autoVentilador: boolean;
  ventMinOn: number;
  ventMinOff: number;
  autoVolteo: boolean;
  volteoHoras: number;

  // Datos y monitoreo
  muestreoSegundos: number;
  envioMinutos: number;
  bufferMax: number;

  // Alertas
  notificarCriticas: boolean;
  notificarInformativas: boolean;
  canalNotificacion: 'app' | 'email' | 'ambos';

  // Opcional: campo de auditoría del backend
  updated_at?: string;
}

@Injectable({ providedIn: 'root' })
export class ParametrosProcesoService {
  // Coincide con lo que montamos en app.js → app.use("/api/parametros", ...)
  private endpoint = 'parametros';

  constructor(private general: GeneralService) {}

  /** GET /api/parametros – Obtener parámetros actuales desde la API */
  obtenerParametros(): Observable<ParametrosProceso> {
    return this.general.get<ParametrosProceso>(this.endpoint);
  }

  /** PUT /api/parametros – Actualizar parámetros en la API */
  actualizarParametros(payload: ParametrosProceso): Observable<ParametrosProceso> {
    return this.general.put<ParametrosProceso>(this.endpoint, payload);
  }
}
