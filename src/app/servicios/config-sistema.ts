import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface ConfigSistema {
  tema: 'auto' | 'claro' | 'oscuro';
  tamFuente: 'normal' | 'grande';
  reducirAnimaciones: boolean;

  email: boolean;
  push: boolean;
  sms: boolean;

  alertasCriticas: boolean;
  alertasProceso: boolean;
  alertasInformativas: boolean;

  resumenFrecuencia: 'diario' | 'semanal' | 'mensual';

  updated_at?: string;
}

const STORAGE_KEY = 'config_sistema_iot_compost';

@Injectable({ providedIn: 'root' })
export class ConfigSistemaService {

  constructor() {}

  // Valores por defecto si no hay nada guardado
  private getDefaults(): ConfigSistema {
    return {
      tema: 'auto',
      tamFuente: 'normal',
      reducirAnimaciones: false,

      email: true,
      push: true,
      sms: false,

      alertasCriticas: true,
      alertasProceso: true,
      alertasInformativas: true,

      resumenFrecuencia: 'semanal',
      updated_at: undefined,
    };
  }

  /** Obtiene la configuración desde localStorage */
  obtenerConfig(): Observable<ConfigSistema> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return of(this.getDefaults());
      }

      const parsed = JSON.parse(raw) as ConfigSistema;
      // Mezclamos con defaults por si falta algún campo
      const cfg: ConfigSistema = {
        ...this.getDefaults(),
        ...parsed,
      };
      return of(cfg);
    } catch {
      // Si algo falla, devolvemos defaults
      return of(this.getDefaults());
    }
  }

  /** Guarda la configuración en localStorage */
  actualizarConfig(
    payload: ConfigSistema,
    _usuario: string
  ): Observable<ConfigSistema> {
    const now = new Date().toISOString();
    const cfg: ConfigSistema = {
      ...this.getDefaults(),
      ...payload,
      updated_at: now,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch {
      // Si localStorage falla, simplemente devolvemos el objeto igual
    }

    return of(cfg);
  }
}
