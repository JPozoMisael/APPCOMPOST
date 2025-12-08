import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface MqttMsg {
  topic: string;
  payload: string;
}

@Injectable({ providedIn: 'root' })
export class MqttService {
  private client: any = null;
  private connected$ = new BehaviorSubject<boolean>(false);
  private bus$ = new Subject<MqttMsg>();

  constructor(private zone: NgZone) {
    console.log('🟣 [MQTT] Construyendo MqttService…');

    // 👇 tomamos mqtt desde window para evitar ReferenceError
    const w = window as any;
    console.log('🟣 [MQTT] typeof window.mqtt =', typeof w.mqtt);
    console.log('🟣 [MQTT] window.mqtt =', w.mqtt);

    const mqttLib = w.mqtt;

    if (!mqttLib) {
      console.error(
        '❌ [MQTT] Librería MQTT no está cargada. Revisa que en src/index.html exista:\n' +
        '<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>'
      );
      // No lanzamos error para no romper login/demás servicios
      return;
    }

    const options: any = {
      clean: true,
      reconnectPeriod: 2000,
      keepalive: 60,
      connectTimeout: 30_000,
    };

    console.log('🟣 [MQTT] Intentando conectar con broker…', {
      url: 'wss://broker.emqx.io:8084/mqtt',
      options,
    });

    // usamos la librería obtenida
    this.client = mqttLib.connect('wss://broker.emqx.io:8084/mqtt', options);

    if (!this.client) {
      console.error('❌ [MQTT] mqttLib.connect devolvió null/undefined');
      return;
    }

    this.client.on('connect', () =>
      this.zone.run(() => {
        console.log('✅ [MQTT] Conectado al broker');
        this.connected$.next(true);
      })
    );

    this.client.on('close', () =>
      this.zone.run(() => {
        console.warn('⚠️ [MQTT] Conexión cerrada');
        this.connected$.next(false);
      })
    );

    this.client.on('reconnect', () =>
      this.zone.run(() => {
        console.log('🔄 [MQTT] Reintentando conexión…');
      })
    );

    this.client.on('error', (err: any) =>
      this.zone.run(() => {
        console.error('❌ [MQTT] Error en cliente MQTT:', err);
      })
    );

    this.client.on('message', (topic: string, payload: any) => {
      let text: string;

      if (typeof payload === 'string') {
        text = payload;
      } else if (payload instanceof Uint8Array) {
        text = new TextDecoder().decode(payload);
      } else {
        text = String(payload);
      }

      console.log('📥 [MQTT] Mensaje recibido:', { topic, text });

      this.zone.run(() => this.bus$.next({ topic, payload: text }));
    });
  }

  // ===== Estado de conexión =====
  isConnected$(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  isConnected(): boolean {
    const ok = !!this.client && !!this.client.connected;
    console.log('🟣 [MQTT] isConnected() =', ok);
    return ok;
  }

  // ===== Suscribirse a un topic =====
  observe(topic: string): Observable<string> {
    console.log('🟣 [MQTT] observe() llamado para topic =', topic);

    if (!this.client) {
      console.warn('[MQTT] Cliente no creado, observe() ignorado');
      return new Observable<string>(); // observable vacío para no romper
    }

    this.client.subscribe(topic, { qos: 1 }, (err: any, granted?: any) => {
      if (err) {
        console.error('❌ [MQTT] Error al suscribirse a', topic, err);
      } else {
        console.log('📡 [MQTT] Suscrito a', topic, 'granted =', granted);
      }
    });

    return this.bus$.pipe(
      filter((m) => m.topic === topic),
      map((m) => m.payload)
    );
  }

  // ===== Publicar mensajes =====
  publish(
    topic: string,
    body: string | Record<string, unknown>,
    opts?: { qos?: 0 | 1 | 2; retain?: boolean }
  ): void {
    console.log('🟣 [MQTT] publish() llamado', { topic, body, opts });

    if (!this.client || !this.client.connected) {
      console.warn('[MQTT] Ignorado: cliente no conectado. topic =', topic);
      return;
    }

    const payload = typeof body === 'string' ? body : JSON.stringify(body);

    this.client.publish(
      topic,
      payload,
      opts ?? { qos: 1 },
      (err?: Error) => {
        if (err) {
          console.error('❌ [MQTT] Error publish:', err);
        } else {
          console.log('📤 [MQTT] Publish OK ->', topic, payload);
        }
      }
    );
  }
}
