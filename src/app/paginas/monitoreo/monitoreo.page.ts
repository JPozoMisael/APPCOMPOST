import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { RecomendacionesService } from 'src/app/servicios/recomendaciones-service';
import { MqttService } from 'src/app/servicios/mqtt-service';

type Modo = 'manual' | 'auto';

interface AccionAuto {
  id: number;
  descripcion: string;
  estado: 'pendiente' | 'aplicada' | string;
  fecha: string | Date;
}

interface Actuador {
  nombre: string;
  icono: string;
  key: string;
  canal?: number | string;
  model: () => boolean;
  toggle: (value: boolean) => void;
}

// Topics MQTT (igual que en tu proyecto anterior)
const TOPIC_ESTADO = 'COM/C2025V1';       // telemetría de actuadores (ESP32 -> app)
const TOPIC_REST   = 'REST/COM/C2025V1';  // comandos manuales (app -> ESP32)
const TOPIC_MODO   = 'AUTO/COM/C2025V1';  // modo AUTO/MANUAL (retained)

@Component({
  selector: 'app-monitoreo',
  templateUrl: './monitoreo.page.html',
  styleUrls: ['./monitoreo.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class MonitoreoPage implements OnInit, OnDestroy {

  // ===== Estado UI =====
  acciones: AccionAuto[] = [];

  ventilador1 = false;
  ventilador2 = false;
  servo1 = false;         // true = abierto
  servo2 = false;         // true = abierto
  electrovalvula = false;
  motor = false;

  modo: Modo = 'manual';

  actuadores: Actuador[] = [];
  private subs: Subscription[] = [];

  get isManual(): boolean { return this.modo === 'manual'; }

  constructor(
    private mqtt: MqttService,
    private recomendacionService: RecomendacionesService,
    private cdr: ChangeDetectorRef,
  ) {}

  // ================= Lifecycle =================
  ngOnInit(): void {
    // Suscribirse a topics MQTT
    this.suscribirTopicos();

    // Cargar acciones automáticas (lógica difusa)
    this.obtenerAcciones();

    // Construir la lista de actuadores
    this.construirActuadores();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  // =============== Suscripciones MQTT =================
  private suscribirTopicos(): void {
    // ESTADO — telemetría del ESP32
    const s1 = this.mqtt.observe(TOPIC_ESTADO).subscribe({
      next: (raw: string) => {
        try {
          const data = JSON.parse(raw) as any;

          this.ventilador1 = this.normalize(data.ventilador1);
          this.ventilador2 = this.normalize(data.ventilador2);
          this.servo1      = this.normalizeOpenClose(data.servo1);
          this.servo2      = this.normalizeOpenClose(data.servo2);
          this.electrovalvula =
            this.normalize(data.electroval) || this.normalize(data.valvula);
          this.motor       = this.normalize(data.motor);

          this.cdr.markForCheck();
        } catch (e) {
          console.error('[MQTT] JSON inválido en estado:', e);
        }
      },
      error: (e) => console.error('[MQTT] error suscripción estado:', e),
    });

    // MODO — cadena 'AUTO' / 'MANUAL' (retained)
    const s2 = this.mqtt.observe(TOPIC_MODO).subscribe({
      next: (payload: string) => {
        const p = (payload || '').toUpperCase();
        const nuevo: Modo = p === 'AUTO' ? 'auto' : 'manual';
        if (nuevo !== this.modo) {
          this.modo = nuevo;
          this.cdr.markForCheck();
        }
      },
      error: (e) => console.error('[MQTT] error suscripción modo:', e),
    });

    this.subs.push(s1, s2);
  }

  // ==================== UI helpers ====================
  refrescar(): void {
    this.obtenerAcciones();
  }

  private normalize(v: unknown): boolean {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return s === 'on' || s === 'true' || s === '1' || s === 'activo' || s === 'encendido';
    }
    return false;
  }

  private normalizeOpenClose(v: unknown): boolean {
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === 'abierto' || s === 'open' || s === 'on') return true;
      if (s === 'cerrado' || s === 'close' || s === 'off') return false;
    }
    return this.normalize(v);
  }

  // ================== Actuadores (una vez) ==================
  private construirActuadores(): void {
    this.actuadores = [
      {
        nombre: 'Ventilador 1',
        icono: 'flash-outline',
        key: 'ventilador1',
        canal: 1,
        model: () => this.ventilador1,
        toggle: (v: boolean) => this.toggleManual('ventilador1', v, v ? 'ON' : 'OFF'),
      },
      {
        nombre: 'Ventilador 2',
        icono: 'flash-outline',
        key: 'ventilador2',
        canal: 2,
        model: () => this.ventilador2,
        toggle: (v: boolean) => this.toggleManual('ventilador2', v, v ? 'ON' : 'OFF'),
      },
      {
        nombre: 'Servo 1',
        icono: 'hardware-chip-outline',
        key: 'servo1',
        canal: 3,
        model: () => this.servo1,
        toggle: (v: boolean) => this.toggleManual('servo1', v, v ? 'abierto' : 'cerrado'),
      },
      {
        nombre: 'Servo 2',
        icono: 'hardware-chip-outline',
        key: 'servo2',
        canal: 4,
        model: () => this.servo2,
        toggle: (v: boolean) => this.toggleManual('servo2', v, v ? 'abierto' : 'cerrado'),
      },
      {
        nombre: 'Electroválvula',
        icono: 'water-outline',
        key: 'electroval',
        canal: 5,
        model: () => this.electrovalvula,
        toggle: (v: boolean) => this.toggleManual('electroval', v, v ? 'ON' : 'OFF'),
      },
      {
        nombre: 'Motor',
        icono: 'settings-outline',
        key: 'motor',
        canal: 6,
        model: () => this.motor,
        toggle: (v: boolean) => this.toggleManual('motor', v, v ? 'ON' : 'OFF'),
      },
    ];
  }

  // ================== Publicación segura ==================
  private publishSafe(
    topic: string,
    payload: string,
    opts?: { qos?: 0|1|2; retain?: boolean }
  ) {
    if (!this.mqtt.isConnected()) {
      console.warn('[MQTT] Ignorado: cliente no conectado. topic=', topic);
      return;
    }
    try {
      this.mqtt.publish(topic, payload, opts);
    } catch (e) {
      console.error('[MQTT] Error al publicar:', e);
    }
  }

  private toggleManual(actKey: string, local: boolean, valor: string | number) {
    if (!this.isManual) return;
    (this as any)[actKey] = local;
    this.cdr.markForCheck();
    this.publishSafe(TOPIC_REST, JSON.stringify({ [actKey]: valor }), { qos: 1 });
  }

  enviarControl(actuador: string, valor: string | number): void {
    if (!this.isManual) {
      console.warn('Comando bloqueado (modo AUTO)');
      return;
    }
    this.publishSafe(TOPIC_REST, JSON.stringify({ [actuador]: valor }), { qos: 1 });
  }

  cambiarModo(event: any): void {
    const nuevo: Modo = event?.detail?.checked ? 'auto' : 'manual';
    if (nuevo === this.modo) return;

    this.modo = nuevo;
    const payload = this.modo === 'auto' ? 'AUTO' : 'MANUAL';

    this.publishSafe(TOPIC_MODO, payload, { qos: 1, retain: true });
    this.cdr.markForCheck();
  }

  todo(v: boolean): void {
    if (!this.isManual) return;

    // Confirmación para evitar errores
    const texto = v ? 'encender TODOS los actuadores' : 'apagar TODOS los actuadores';
    if (!confirm(`¿Seguro que quieres ${texto}?`)) return;

    this.ventilador1 = v;
    this.ventilador2 = v;
    this.servo1 = v;
    this.servo2 = v;
    this.electrovalvula = v;
    this.motor = v;
    this.cdr.markForCheck();

    const batch = {
      ventilador1: v ? 'ON' : 'OFF',
      ventilador2: v ? 'ON' : 'OFF',
      servo1:      v ? 'abierto' : 'cerrado',
      servo2:      v ? 'abierto' : 'cerrado',
      electroval:  v ? 'ON' : 'OFF',
      motor:       v ? 'ON' : 'OFF',
    };
    this.publishSafe(TOPIC_REST, JSON.stringify(batch), { qos: 1 });
  }

  // =============== Fuzzy actions (REST) ===============
  obtenerAcciones(): void {
    const s = this.recomendacionService.getRecomendaciones().subscribe({
      next: (data) => {
        const arr = Array.isArray(data) ? data : (data ? [data] : []);
        this.acciones = arr as AccionAuto[];
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error al cargar acciones fuzzy:', err),
    });
    this.subs.push(s);
  }

  aplicarAccion(id: number): void {
    const s = this.recomendacionService.aplicarAccion(id).subscribe({
      next: () => this.obtenerAcciones(),
      error: (err) => console.error('Error al aplicar acción fuzzy:', err),
    });
    this.subs.push(s);
  }

  // =============== TrackBy (perf) ===============
  trackByAccion = (_: number, a: AccionAuto) => a?.id ?? _;
  trackByAct     = (_: number, a: Actuador)  => a?.key ?? _;

  // =============== Estado de conexión MQTT (para UI) ===============
  get isMqttOK(): boolean {
    try {
      return this.mqtt?.isConnected?.() ?? false;
    } catch {
      return false;
    }
  }
}
