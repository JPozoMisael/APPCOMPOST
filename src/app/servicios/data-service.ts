import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { SensorMuestra } from '../model/sensor-muestra';
import { Lectura } from '../model/lectura';
import { Alerta } from '../model/alerta';

import { LogsService } from './logs-service';
import { MqttService } from './mqtt-service';
import { AlertasService } from './alerta-service';

import { environment } from 'src/environments/environment';

export interface ResumenEstadisticas {
  temperaturaMax: number;
  temperaturaMin: number;
  temperaturaProm: number;
  humedadProm: number;
  nh3Max: number;
  ch4Max: number;
  activaciones: { ventilador: number; valvula: number; motor: number };
}

@Injectable({ providedIn: 'root' })
export class DataService {
  // ===== Estado en memoria =====
  private historico: SensorMuestra[] = [];
  private readonly MAX_HIST = 200;
  private readonly TOPIC = 'COM/C2025V1';

  private historicoSubject = new BehaviorSubject<SensorMuestra[]>([]);
  readonly historico$ = this.historicoSubject.asObservable();

  private resumenSubject = new BehaviorSubject<ResumenEstadisticas>({
    temperaturaMax: 0,
    temperaturaMin: 0,
    temperaturaProm: 0,
    humedadProm: 0,
    nh3Max: 0,
    ch4Max: 0,
    activaciones: { ventilador: 0, valvula: 0, motor: 0 },
  });
  readonly resumen$ = this.resumenSubject.asObservable();

  // (para pruebas locales)
  private readonly FORZAR_DISPOSITIVO_ID: number | null = 1;

  // Cooldown para no spamear alertas (1 min por tipo)
  private lastAlertAt: Record<string, number> = {};
  private readonly ALERT_COOLDOWN_MS = 60_000;

  constructor(
    private logsService: LogsService,
    private http: HttpClient,
    private mqtt: MqttService,
    private zone: NgZone,
    private alertasService: AlertasService,   // ✅ inyectamos normal
  ) {
    // Suscripción MQTT (tu servicio devuelve strings JSON)
    this.mqtt.observe(this.TOPIC).pipe(debounceTime(100)).subscribe({ // Ajusta el valor de debounceTime
      next: (raw: string) => {
        this.zone.run(() => {
          try {
            const payload: Lectura = JSON.parse(raw);
            const muestra: SensorMuestra = { tiempo: new Date(), data: payload };
            this.agregarLectura(muestra);
          } catch (e) {
            console.error('[MQTT] JSON inválido:', e);
          }
        });
      },
      error: (e) => console.error('[MQTT] error', e),
    });
  }

  // ===== API de estado =====
  getHistorico(): SensorMuestra[] {
    return this.historico;
  }

  limpiarHistorico(): void {
    this.historico = [];
    this.historicoSubject.next([...this.historico]);
    this.resumenSubject.next(this.calcularResumenEstadisticas());
  }

  agregarLectura(lectura: SensorMuestra): void {
    this.historico.push(lectura);
    if (this.historico.length > this.MAX_HIST) this.historico.shift();

    this.historicoSubject.next([...this.historico]);
    this.resumenSubject.next(this.calcularResumenEstadisticas());

    this.enviarLecturaBackend(lectura);
    this.validarCondicionesPeligrosas(lectura); // ahora solo registra en alertas
  }

  calcularResumenEstadisticas(): ResumenEstadisticas {
    const datos = this.historico;
    if (!datos.length) {
      return {
        temperaturaMax: 0,
        temperaturaMin: 0,
        temperaturaProm: 0,
        humedadProm: 0,
        nh3Max: 0,
        ch4Max: 0,
        activaciones: { ventilador: 0, valvula: 0, motor: 0 },
      };
    }

    const toNum = (v: any) => (typeof v === 'number' ? v : Number(v));
    const isNum = (v: any) => Number.isFinite(toNum(v));

    const temperaturas = datos
      .map((d) => toNum((d.data as any).temperatura))
      .filter(isNum);
    const humedades = datos
      .map((d) => toNum((d.data as any).humedadPromedio))
      .filter(isNum);
    const nh3 = datos.map((d) => toNum((d.data as any).NH3)).filter(isNum);
    const ch4 = datos.map((d) => toNum((d.data as any).CH4)).filter(isNum);

    const promedio = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const maxOr0 = (arr: number[]) => (arr.length ? Math.max(...arr) : 0);
    const minOr0 = (arr: number[]) => (arr.length ? Math.min(...arr) : 0);
    const onCount = (k: 'ventilador' | 'valvula' | 'motor') =>
      datos.filter((d) => this.normalizeOnOff((d.data as any)[k]) === 'ON').length;

    return {
      temperaturaMax: maxOr0(temperaturas),
      temperaturaMin: minOr0(temperaturas),
      temperaturaProm: promedio(temperaturas),
      humedadProm: promedio(humedades),
      nh3Max: maxOr0(nh3),
      ch4Max: maxOr0(ch4),
      activaciones: {
        ventilador: onCount('ventilador'),
        valvula: onCount('valvula'),
        motor: onCount('motor'),
      },
    };
  }

  // ===== Networking: envía lecturas al backend =====
  private enviarLecturaBackend(lectura: SensorMuestra): void {
  if (!environment?.apiBaseUrl) return;

  const url = `${environment.apiBaseUrl}/sensor/lecturas`;
  const headers = new HttpHeaders({
    'x-api-key': environment.adminApiKey,
    'Content-Type': 'application/json',
  });

  const body: any = { sensorId: this.TOPIC, ...lectura.data };
  if (this.FORZAR_DISPOSITIVO_ID != null) {
    body.dispositivo_id = this.FORZAR_DISPOSITIVO_ID;
  }

  const inicio = performance.now(); // ⏱ medimos manualmente

  this.http.post(url, body, { headers }).subscribe({
    next: (resp) => {
      const ms = performance.now() - inicio;
      console.log(
        `✅ [DATA] POST /sensor/lecturas OK (${ms.toFixed(1)} ms)`,
        'resp=', resp
      );
    },
    error: (err) => {
      const ms = performance.now() - inicio;
      console.error(
        `❌ [DATA] POST /sensor/lecturas ERROR (${ms.toFixed(1)} ms)`,
        err
      );
    },
  });
}


  // ===== Alertas ➜ registradas en DB + bandeja, SIN toast =====
  private validarCondicionesPeligrosas(lectura: SensorMuestra): void {
    const umbrales = {
      NH3: 50,
      CH4: 40,
      temperaturaMax: 35,
      temperaturaMin: 10,
    };
    const d = lectura.data as any;

    const push = (key: string, danger: boolean, descripcion: string) => {
      const now = Date.now();
      const last = this.lastAlertAt[key] || 0;
      if (now - last < this.ALERT_COOLDOWN_MS) return; // cooldown por tipo
      this.lastAlertAt[key] = now;

      // Log en tabla de logs
      this.safeLog(`ALERTA_${key.toUpperCase()}`, descripcion);

      const alerta: Partial<Alerta> & { descripcion: string } = {
        descripcion,
        tipo: danger ? 'danger' : 'warning',
        critico: danger,
        fecha: new Date().toISOString(), // string ISO
        leida: false,
      };

      // 1) Actualizar bandeja local (badge, lista de alertas)
      this.alertasService.pushLocal(alerta);

      // 2) Persistir en backend (tabla alertas)
      this.alertasService.crearEnServidor(alerta).subscribe({
        next: () => {},
        error: (err) =>
          console.error('[ALERTAS] Error al guardar alerta en servidor:', err),
      });
    };

    if (this.isNumber(d.NH3) && d.NH3 > umbrales.NH3) {
      push('nh3', true, `Nivel de NH3 alto: ${d.NH3} ppm`);
    }
    if (this.isNumber(d.CH4) && d.CH4 > umbrales.CH4) {
      push('ch4', true, `Nivel de CH4 alto: ${d.CH4} ppm`);
    }
    if (this.isNumber(d.temperatura) && d.temperatura > umbrales.temperaturaMax) {
      push('tempMax', false, `Temperatura alta: ${d.temperatura} °C`);
    }
    if (this.isNumber(d.temperatura) && d.temperatura < umbrales.temperaturaMin) {
      push('tempMin', false, `Temperatura baja: ${d.temperatura} °C`);
    }
  }

  // ===== Helpers =====
  private normalizeOnOff(value: any): 'ON' | 'OFF' {
    if (typeof value === 'boolean') return value ? 'ON' : 'OFF';
    const s = String(value ?? '').trim().toLowerCase();
    if (['1', 'on', 'encendido', 'abierto', 'true', 'sí', 'si'].includes(s))
      return 'ON';
    if (['0', 'off', 'apagado', 'cerrado', 'false', 'no'].includes(s))
      return 'OFF';
    return 'OFF';
  }

  private isNumber(v: any): v is number {
    return typeof v === 'number' && Number.isFinite(v);
  }

  private safeLog(accion: string, descripcion: string): void {
    if (typeof (this.logsService as any).registrarLogSimple === 'function') {
      (this.logsService as any)
        .registrarLogSimple(accion, descripcion)
        .subscribe({ next: () => {}, error: () => {} });
    } else if (typeof (this.logsService as any).registrarLog === 'function') {
      (this.logsService as any)
        .registrarLog({ accion, descripcion })
        .subscribe({ next: () => {}, error: () => {} });
    }
  }
}