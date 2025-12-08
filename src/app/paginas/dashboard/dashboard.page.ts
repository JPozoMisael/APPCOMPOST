import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from 'src/app/servicios/auth-service';
import { LogsService, LogRow } from 'src/app/servicios/logs-service';
import { HealthService, HealthStatus } from 'src/app/servicios/healht-service';
import { DataService, ResumenEstadisticas } from 'src/app/servicios/data-service';
import { SensorMuestra } from 'src/app/model/sensor-muestra';
import { MqttService } from 'src/app/servicios/mqtt-service';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';
Chart.register(...registerables);

// Tipos para la gráfica
type LinePoint = number | null;
type LineData = LinePoint[];
type LineChartData = ChartData<'line', LineData>;
type LineChartConfig = ChartConfiguration<'line', LineData>;
type LineChart = Chart<'line', LineData>;

// Plugin de líneas horizontales
const HLinePlugin: any = {
  id: 'hline',
  afterDraw(
    chart: any,
    _args: any,
    opts: { lines?: Array<{ y: number; color?: string; width?: number }> }
  ) {
    const { ctx, chartArea, scales } = chart;
    if (!opts?.lines?.length) return;
    const yScale = scales.y;
    opts.lines.forEach((ln) => {
      const y = yScale.getPixelForValue(ln.y);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.lineWidth = ln.width ?? 1;
      ctx.strokeStyle = ln.color ?? '#ef4444';
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.restore();
    });
  },
};

Chart.register(HLinePlugin);

type Grouped = { fecha: string; items: LogRow[] };

interface AlertaRow {
  fecha: string;
  tipo: string;
  nivel: 'Advertencia' | 'Peligro' | 'Info';
}
const TOPIC_REST = 'REST/COM/C2025V1'; 

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class DashboardPage implements OnInit, OnDestroy {
  @ViewChild('compostChart', { static: false })
  compostChartRef!: ElementRef<HTMLCanvasElement>;

  // Usuario / cabecera
  rolUsuario = 'usuario';
  nombreUsuario = 'Invitado';
  fechaActual = '';

  // KPIs
  sensoresActivos = 0;
  alertasHoy = 0;
  ultimaConexion = '-';
  compostIndex = 0;
  healthOK = true;

  // Data
  logs: LogRow[] = [];
  health: HealthStatus[] = [];
  resumen: ResumenEstadisticas | undefined;

  // Estado
  cargando = false;
  errorMsg: string | null = null;
  private subs: Subscription[] = [];
  private chart?: LineChart;

  // --------- SERIES TIEMPO REAL ----------
  private readonly MAX_POINTS = 240;
  private lastUpdate = 0;
  private readonly FPS = 10;

  liveLabels: string[] = [];
  serieTemp: LineData = [];
  serieHum: LineData = [];
  serieNH3: LineData = [];
  serieCH4: LineData = [];

  // KPIs instantáneos
  tempActual: number | null = null;
  humedadActual: number | null = null;
  nh3Actual: number | null = null;
  ch4Actual: number | null = null;

  // Estados actuadores
  vent1Estado = 'OFF';
  vent2Estado = 'OFF';
  electrovalEstado = 'OFF';
  servo1Estado = 'cerrado';
  servo2Estado = 'cerrado';
  motorEstado = 'OFF';

  // Nivel de mezcla (aprox. según humedad)
  nivelMezcla = 60;

  // Flag mientras se envía el comando de mezcla
  mezclando = false;

  // Panel derecho / logs
  filterMode: 'all' | 'alerts' | 'system' = 'all';
  range: '24h' | '7d' | '30d' | 'all' = '24h';
  search = '';
  pageSize = 20;
  page = 1;
  visibleLogs: LogRow[] = [];
  canLoadMore = false;
  private allLogs: LogRow[] = [];
  private searchDebounce?: any;

  tab: 'todos' | 'alertas' = 'todos';
  rangoHoras = '24';
  searchTxt = '';

  groupedLogs: Grouped[] = [];
  feedShort: Array<{ accion: string; titulo: string; sub: string; hora: string }> = [];

  // Alertas para la tabla del dashboard
  alertas: AlertaRow[] = [];
  
  constructor(
    private auth: AuthService,
    private router: Router,
    private logsService: LogsService,
    private healthService: HealthService,
    private dataService: DataService,
    private cd: ChangeDetectorRef,
    private mqtt: MqttService,     
  ) {}

  ngOnInit(): void {
    this.rolUsuario = this.auth.getRol();
    this.nombreUsuario = this.auth.getNombreUsuario();
    this.fechaActual = this.formatFechaHumana(new Date());

    // Telemetría en tiempo real
    this.subs.push(
      this.dataService.historico$.subscribe((hist) => {
        if (!hist || hist.length === 0) return;
        const ultima = hist[hist.length - 1] as SensorMuestra;
        this.pushLivePoint(ultima);
      })
    );

    this.subs.push(this.dataService.resumen$.subscribe((r) => (this.resumen = r)));

    // Carga inicial (logs / health)
    this.cargarDatosNoRealtime();
  }

  ionViewDidEnter() {
    if (this.compostChartRef && !this.chart) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.chart?.destroy();
  }

  // ---------- UI simples ----------
  refrescarDatos(): void {
    this.cargarDatosNoRealtime();
  }

  // ---------- CARGA NO-RT ----------
  private cargarDatosNoRealtime(): void {
    this.cargando = true;
    this.errorMsg = null;

    const s1 = this.logsService.obtenerLogs<LogRow[]>({ limit: 500 }).subscribe({
      next: (logs) => {
        this.allLogs = Array.isArray(logs) ? this.sortDesc(logs) : [];
        this.logs = this.allLogs;
        this.calcularIndicadoresDesdeLogs(this.allLogs);
        this.page = 1;
        this.applyFilters();
        this.recomputeFeed();
        this.recomputeGrouped();
        this.cargando = false;
        this.cd.markForCheck();
      },
      error: (err: any) => {
        console.error(err);
        this.errorMsg = 'No se pudieron cargar los logs.';
        this.cargando = false;
        this.cd.markForCheck();
      },
    });

    const s2 = this.healthService.resumen().subscribe({
      next: (sts) => {
        this.health = sts || [];
        this.healthOK = !this.health.some((h) => (h.status || '').toUpperCase() === 'DOWN');
        this.cd.markForCheck();
      },
      error: () => {
        this.health = [
          { name: 'API', status: 'UNKNOWN' },
          { name: 'Base de datos', status: 'UNKNOWN' },
          { name: 'Broker MQTT', status: 'UNKNOWN' },
        ];
        this.healthOK = false;
        this.cd.markForCheck();
      },
    });

    this.subs.push(s1, s2);
  }

  private calcularIndicadoresDesdeLogs(logs: LogRow[]): void {
    const hoy = new Date().toDateString();

    this.sensoresActivos = logs.filter((l) =>
      (l.accion || '').toUpperCase().includes('SENSOR_ONLINE')
    ).length;

    this.alertasHoy = logs.filter(
      (l) =>
        (l.accion || '').toUpperCase().includes('ALERTA') &&
        new Date(l.fecha).toDateString() === hoy
    ).length;

    const sorted = this.sortDesc(logs);
    this.ultimaConexion = sorted[0]?.fecha
      ? this.formatFechaHumana(new Date(sorted[0].fecha))
      : '-';

    this.alertas = sorted
      .filter((l) => (l.accion || '').toUpperCase().includes('ALERTA'))
      .slice(0, 6)
      .map((l) => ({
        fecha: this.formatFechaHumana(new Date(l.fecha)),
        tipo: l.detalle || l.accion || 'Alerta',
        nivel: (l.detalle || '').toLowerCase().includes('alta') ? 'Peligro' : 'Advertencia',
      }));
  }

  // ---------- LIVE POINT con throttle ----------
  private pushLivePoint(m: SensorMuestra): void {
    const now = performance.now();
    if (now - this.lastUpdate < 1000 / this.FPS) return;
    this.lastUpdate = now;

    const d: any = m.data || {};

    const num = (v: any): number | null => {
      if (typeof v === 'number' && isFinite(v)) return v;
      const n = Number(v);
      return isFinite(n) ? n : null;
    };

    const t = num(d.temperatura);
    const h = num(d.humedadPromedio);
    const nh3 = num(d.NH3);
    const ch4 = num(d.CH4);

    if (t !== null) this.tempActual = t;
    if (h !== null) this.humedadActual = h;
    if (nh3 !== null) this.nh3Actual = nh3;
    if (ch4 !== null) this.ch4Actual = ch4;

    let activos = 0;  
    if (t !== null) activos++;
    if (h !== null) activos++;
    if (nh3 !== null) activos++;
    if (ch4 !== null) activos++;
    this.sensoresActivos = activos;

    if (this.humedadActual !== null) {
      const hNorm = Math.max(0, Math.min(100, this.humedadActual));
      this.nivelMezcla = Math.round(hNorm);
    }

    this.vent1Estado = String(d.ventilador1 ?? 'OFF');
    this.vent2Estado = String(d.ventilador2 ?? 'OFF');
    this.electrovalEstado = String(d.electroval ?? d.electrovalvula ?? 'OFF');
    this.servo1Estado = String(d.servo1 ?? 'cerrado');
    this.servo2Estado = String(d.servo2 ?? 'cerrado');
    this.motorEstado = String(d.motor ?? 'OFF');

    const label = this.labelCorto(new Date(m.tiempo as any));
    this.liveLabels.push(label);
    this.serieTemp.push(t);
    this.serieHum.push(h);
    this.serieNH3.push(nh3);
    this.serieCH4.push(ch4);

    const trim = <T>(arr: T[]) => {
      while (arr.length > this.MAX_POINTS) arr.shift();
    };

    trim(this.liveLabels);
    trim(this.serieTemp);
    trim(this.serieHum);
    trim(this.serieNH3);
    trim(this.serieCH4);

    if (!this.chart) {
      this.renderChart();
    } else {
      this.chart.data.labels = [...this.liveLabels];
      (this.chart.data.datasets[0].data as LineData) = [...this.serieTemp];
      (this.chart.data.datasets[1].data as LineData) = [...this.serieHum];
      (this.chart.data.datasets[2].data as LineData) = [...this.serieNH3];
      (this.chart.data.datasets[3].data as LineData) = [...this.serieCH4];
      this.chart.update('none');
    }

    this.cd.markForCheck();
  }

  private labelCorto(d: Date): string {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  // ---------- Chart.js multi-serie ----------
  private renderChart(): void {
    const canvas = this.compostChartRef?.nativeElement;
    if (!canvas) return;

    this.chart?.destroy();

    const data: LineChartData = {
      labels: [...this.liveLabels],
      datasets: [
        {
          label: 'Temperatura (°C)',
          data: [...this.serieTemp],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.12)',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 0,
        },
        {
          label: 'Humedad prom.',
          data: [...this.serieHum],
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.12)',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 0,
        },
        {
          label: 'NH₃ (%)',
          data: [...this.serieNH3],
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.12)',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 0,
        },
        {
          label: 'CH₄ (ppm)',
          data: [...this.serieCH4],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.12)',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 0,
        },
      ],
    };

    const cfg: LineChartConfig = {
      type: 'line',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            grid: { color: 'rgba(148,163,184,0.18)' },
            ticks: {
              color: '#6b7280',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
            },
          },
          y: {
            grid: { color: 'rgba(148,163,184,0.12)' },
            ticks: { color: '#6b7280' },
          },
        },
        plugins: {
          legend: {
            display: true,
            labels: { color: '#4b5563', usePointStyle: true },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#111827',
            titleColor: '#f9fafb',
            bodyColor: '#e5e7eb',
            borderColor: '#1f2937',
            borderWidth: 1,
          },
          hline: {
            lines: [{ y: 800, color: '#ef4444', width: 1 }],
          },
        } as any,
      },
    };

    this.chart = new Chart(canvas.getContext('2d')!, cfg);
  }

  // ---------- Utilidades / logs ----------
  private sortDesc(arr: LogRow[]): LogRow[] {
    return [...arr].sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));
  }

  private formatFechaHumana(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  applyFilters(): void {
    const now = new Date();
    const from = this.computeFromDate(now, this.range);

    const filtered = this.allLogs.filter((l) => {
      const d = new Date(l.fecha);
      if (from && d < from) return false;

      const up = (l.accion || '').toUpperCase();
      if (this.filterMode === 'alerts' && !up.includes('ALERTA')) return false;
      if (this.filterMode === 'system' && up.includes('ALERTA')) return false;

      if (this.search?.trim()) {
        const q = this.search.trim().toLowerCase();
        const hay =
          (l.accion || '').toLowerCase().includes(q) ||
          (l.detalle || '').toLowerCase().includes(q);
        if (!hay) return false;
      }

      return true;
    });

    const total = filtered.length;
    const end = this.page * this.pageSize;
    this.visibleLogs = filtered.slice(0, end);
    this.canLoadMore = end < total;
  }

  private computeFromDate(now: Date, r: string): Date | null {
    const d = new Date(now);
    if (r === '24h') {
      d.setDate(now.getDate() - 1);
      return d;
    }
    if (r === '7d') {
      d.setDate(now.getDate() - 7);
      return d;
    }
    if (r === '30d') {
      d.setDate(now.getDate() - 30);
      return d;
    }
    return null;
  }

  private recomputeFeed(): void {
    const arr = (this.logs || [])
      .slice(0, 12)
      .map((l) => {
        const d = new Date(l.fecha);
        const hora = `${String(d.getHours()).padStart(2, '0')}:${String(
          d.getMinutes()
        ).padStart(2, '0')}`;
        return { ...l, titulo: l.accion, sub: l.detalle || '—', hora };
      });

    this.feedShort = arr.slice(0, 4);
  }

  private recomputeGrouped(): void {
    const limiteMs = (+this.rangoHoras || 24) * 3600 * 1000;
    const desde = Date.now() - limiteMs;

    const src = (this.logs || [])
      .filter((l) => +new Date(l.fecha) >= desde)
      .filter((l) => (this.tab === 'alertas' ? this.isAlerta(l.accion) : true))
      .filter((l) =>
        !this.searchTxt
          ? true
          : (l.accion || '').toLowerCase().includes(this.searchTxt.toLowerCase()) ||
            (l.detalle || '').toLowerCase().includes(this.searchTxt.toLowerCase())
      );

    const byDate = new Map<string, LogRow[]>();
    src.forEach((l) => {
      const d = new Date(l.fecha);
      const key = d.toLocaleDateString();
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(l);
    });

    const groups = Array.from(byDate.entries())
      .map(([fecha, items]) => ({
        fecha,
        items: items.sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha)),
      }))
      .sort((a, b) => +new Date(b.items[0].fecha) - +new Date(a.items[0].fecha));

    this.groupedLogs = groups;
    this.cd.markForCheck();
  }

  isAlerta(a: string | undefined): boolean {
    return (a || '').toUpperCase().includes('ALERTA');
  }

  private publishSafe(
  topic: string,
  payload: string,
  opts?: { qos?: 0 | 1 | 2; retain?: boolean }
) {
  if (!this.mqtt || typeof this.mqtt.isConnected !== 'function' || !this.mqtt.isConnected()) {
    console.warn('[MQTT] Ignorado: cliente no conectado. topic=', topic);
    return;
  }
  try {
    this.mqtt.publish(topic, payload, opts);
  } catch (e) {
    console.error('[MQTT] Error al publicar desde dashboard:', e);
  }
}

  exportCSV(): void {
    if (!this.groupedLogs?.length) return;

    const flat: LogRow[] = this.groupedLogs.reduce<LogRow[]>((acc, g: Grouped) => {
      return acc.concat(g.items);
    }, []);

    if (!flat.length) return;

    const rows = flat.map((l: LogRow) => ({
      fecha: new Date(l.fecha).toISOString(),
      accion: l.accion ?? '',
      detalle: l.detalle ?? '',
    }));

    const csv = this.toCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eventos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private toCSV(arr: any[]): string {
    const headers = Object.keys(arr[0]);
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.join(',')].concat(
      arr.map((r) => headers.map((h) => esc(r[h])).join(','))
    );
    return lines.join('\r\n');
  }

 
  onMezclarMaterial(): void {
  if (this.mezclando) return;
  this.mezclando = true;

  // 1) Comando de encendido (pulso de mezcla)
  const comandoOn = {
    motor: 'ON',
    origen: 'dashboard',
    tipo: 'MEZCLA_PULSO',
  };

  // Feedback inmediato en UI
  this.motorEstado = 'ON';
  this.cd.markForCheck();

  console.log('[Dashboard] Mezclar material → ON', comandoOn);
  this.publishSafe(TOPIC_REST, JSON.stringify(comandoOn), { qos: 1 });

  // 2) Log de auditoría
  this.logsService
    .registrarLogDetallado(
      'ACCION_MEZCLA',
      this.nombreUsuario,
      'Mezclar material desde dashboard'
    )
    .subscribe({
      next: () => {},
      error: (err: any) => {
        console.error('[Dashboard] Error registrando log mezcla', err);
      },
    });

  // 3) Al cabo de unos segundos, mandamos OFF (pulso corto)
  const PULSO_MS = 3000; // ajusta el tiempo de mezcla a tu gusto

  setTimeout(() => {
    const comandoOff = {
      motor: 'OFF',
      origen: 'dashboard',
      tipo: 'MEZCLA_PULSO_FIN',
    };

    console.log('[Dashboard] Mezclar material → OFF', comandoOff);
    this.publishSafe(TOPIC_REST, JSON.stringify(comandoOff), { qos: 1 });

    // Si no llega telemetría, al menos reflejamos visualmente OFF
    this.motorEstado = 'OFF';
    this.mezclando = false;
    this.cd.markForCheck();
  }, PULSO_MS);
}

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/auth', { replaceUrl: true });
  }
}
