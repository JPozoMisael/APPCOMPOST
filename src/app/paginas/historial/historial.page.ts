// src/app/paginas/historial/historial.page.ts
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

import { FuzzyService, AccionAuto } from '../../servicios/fuzzy-service';
import { LogsService, LogRow } from '../../servicios/logs-service';
import { AlertasService } from '../../servicios/alerta-service';
import { DataService } from '../../servicios/data-service';
import { Alerta } from '../../model/alerta';

type TabHistorial = 'sensores' | 'acciones' | 'alertas' | 'logs';

interface ResumenVar {
  min: number;
  max: number;
  prom: number;
}

interface LecturaUI {
  id?: string | number;
  fecha?: string | null;
  timestamp?: string | null;
  creado_en?: string | null;
  fechaView?: Date | null;

  temperatura?: number | null;
  humedadPromedio?: number | null;
  NH3?: number | null;
  CH4?: number | null;

  // si necesitas conservar campos extra sin romper tipado:
  raw?: Record<string, unknown>;
}

@Component({
  selector: 'app-historial',
  templateUrl: './historial.page.html',
  styleUrls: ['./historial.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistorialPage implements OnInit, OnDestroy {
  tab: TabHistorial = 'sensores';

  // filtros sensores
  fechaISO: string = new Date().toISOString();
  variable: 'temperatura' | 'humedadPromedio' | 'NH3' | 'CH4' = 'temperatura';

  lecturas: LecturaUI[] = [];
  lecturasFiltradas: LecturaUI[] = [];
  loadingLecturas = false;

  acciones: AccionAuto[] = [];
  loadingAcciones = false;
  private accionesCargadas = false;

  // (opcional) si en tu HTML dejaste "Cargar más"
  accionesHayMas = false;

  alertas: Alerta[] = [];
  loadingAlertas = false;

  logs: LogRow[] = [];
  loadingLogs = false;

  resumenCache: ResumenVar = { min: 0, max: 0, prom: 0 };
  etiquetaCache = 'Temperatura (°C)';

  private destroy$ = new Subject<void>();

  constructor(
    private dataService: DataService,
    private fuzzyService: FuzzyService,
    private logsService: LogsService,
    private alertasService: AlertasService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadingLecturas = true;

    this.dataService.historico$
      .pipe(debounceTime(150), takeUntil(this.destroy$))
      .subscribe((muestras: any[]) => {
        const lecturasTransformadas: LecturaUI[] = (muestras || []).map((m: any) => {
          const data = (m?.data || {}) as Record<string, unknown>;

          const fecha =
            (m?.tiempo as string) ||
            (data['fecha'] as string) ||
            (data['creado_en'] as string) ||
            (data['timestamp'] as string) ||
            null;

          const lectura: LecturaUI = {
            raw: data,
            fecha,
            creado_en: (data['creado_en'] as string) ?? null,
            timestamp: (data['timestamp'] as string) ?? null,
            fechaView: fecha ? new Date(fecha) : null,

            temperatura: this.toNum(data['temperatura']),
            humedadPromedio: this.toNum(data['humedadPromedio']),
            NH3: this.toNum(data['NH3']),
            CH4: this.toNum(data['CH4']),
          };

          const maybeId = data['id'];
          if (maybeId !== undefined) lectura.id = maybeId as any;

          return lectura;
        });

        this.lecturas = lecturasTransformadas;
        this.loadingLecturas = false;

        if (this.tab === 'sensores') {
          this.recalcularSensores();
        }

        this.cdr.markForCheck();
      });

    // No cargamos acciones aquí (evita congelamiento)
    this.cargarAlertas();
    this.cargarLogs();

    this.actualizarEtiqueta();
    this.recalcularSensores();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =================== RESUMEN SUPERIOR ===================
  get totalLecturas(): number {
    return this.lecturas?.length || 0;
  }
  get totalAcciones(): number {
    return this.acciones?.length || 0;
  }
  get totalAlertas(): number {
    return this.alertas?.length || 0;
  }
  get totalLogs(): number {
    return this.logs?.length || 0;
  }

  // =================== TABS / FILTROS ===================
  onFechaCancelada(): void {
    // opcional
  }

  onFechaConfirmada(): void {
    this.onCambioFiltrosSensores();
  }

  onCambioFiltrosSensores(): void {
    this.recalcularSensores();
    this.cdr.markForCheck();
  }

  onTabChange(ev: any): void {
    const value = ev?.detail?.value as TabHistorial;
    if (!value) return;

    this.tab = value;

    if (this.tab === 'sensores') {
      this.recalcularSensores();
    }

    if (this.tab === 'acciones' && !this.accionesCargadas) {
      this.cargarAcciones();
    }

    this.cdr.markForCheck();
  }

  setVariable(v: 'temperatura' | 'humedadPromedio' | 'NH3' | 'CH4'): void {
    this.variable = v;
    this.actualizarEtiqueta();
    this.calcularResumen();
    this.cdr.markForCheck();
  }

  // ================== SENSORES: FILTRO + RESUMEN ==================
  private recalcularSensores(): void {
    this.aplicarFiltrosSensores();
    this.calcularResumen();
  }

  private aplicarFiltrosSensores(): void {
    if (!this.lecturas?.length) {
      this.lecturasFiltradas = [];
      return;
    }

    const fechaSel = this.fechaISO ? new Date(this.fechaISO) : null;
    if (!fechaSel || isNaN(fechaSel.getTime())) {
      this.lecturasFiltradas = [...this.lecturas];
      return;
    }

    const ySel = fechaSel.getFullYear();
    const mSel = fechaSel.getMonth();
    const dSel = fechaSel.getDate();

    this.lecturasFiltradas = this.lecturas.filter((l) => {
      const dt = l.fechaView instanceof Date ? l.fechaView : null;
      if (!dt || isNaN(dt.getTime())) return false;

      return (
        dt.getFullYear() === ySel &&
        dt.getMonth() === mSel &&
        dt.getDate() === dSel
      );
    });
  }

  private calcularResumen(): void {
    const base = this.lecturasFiltradas?.length ? this.lecturasFiltradas : this.lecturas;

    if (!base?.length) {
      this.resumenCache = { min: 0, max: 0, prom: 0 };
      return;
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let sum = 0;
    let n = 0;

    for (const l of base) {
      const v = this.getVarValue(l, this.variable);
      if (!Number.isFinite(v)) continue;

      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
      n++;
    }

    this.resumenCache = n
      ? { min, max, prom: sum / n }
      : { min: 0, max: 0, prom: 0 };
  }

  private actualizarEtiqueta(): void {
    switch (this.variable) {
      case 'temperatura':
        this.etiquetaCache = 'Temperatura (°C)';
        break;
      case 'humedadPromedio':
        this.etiquetaCache = 'Humedad (%)';
        break;
      case 'NH3':
        this.etiquetaCache = 'NH₃ (ppm)';
        break;
      case 'CH4':
        this.etiquetaCache = 'CH₄ (ppm)';
        break;
      default:
        this.etiquetaCache = String(this.variable);
    }
  }

  private getVarValue(l: LecturaUI, v: 'temperatura'|'humedadPromedio'|'NH3'|'CH4'): number {
    switch (v) {
      case 'temperatura': return Number(l.temperatura);
      case 'humedadPromedio': return Number(l.humedadPromedio);
      case 'NH3': return Number(l.NH3);
      case 'CH4': return Number(l.CH4);
    }
  }

  // ======== ACCIONES ========
  private cargarAcciones(): void {
    this.loadingAcciones = true;

    // Si tu servicio soporta paginación:
    // this.fuzzyService.list({ limit: 200, offset: 0 })
    // Si no, usa solo this.fuzzyService.list()
    (this.fuzzyService as any)
      .list({ limit: 200, offset: 0 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista: AccionAuto[]) => {
          this.acciones = lista || [];
          this.loadingAcciones = false;
          this.accionesCargadas = true;

          // si backend pagina y devuelve 200, podrías habilitar "cargar más"
          this.accionesHayMas = (this.acciones?.length || 0) >= 200;

          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('[HISTORIAL] Error al cargar acciones fuzzy:', err);
          this.acciones = [];
          this.loadingAcciones = false;
          this.accionesCargadas = true;
          this.accionesHayMas = false;
          this.cdr.markForCheck();
        },
      });
  }

  // Si en tu HTML quedó el botón "Cargar más", luego lo implementamos con offset real.
  cargarAccionesPage(): void {
    this.cargarAcciones();
  }

  // ======== ALERTAS ========
  private cargarAlertas(): void {
    this.loadingAlertas = true;
    this.alertasService
      .getAlertas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista: Alerta[]) => {
          this.alertas = lista || [];
          this.loadingAlertas = false;
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('[HISTORIAL] Error al cargar alertas:', err);
          this.alertas = [];
          this.loadingAlertas = false;
          this.cdr.markForCheck();
        },
      });
  }

  marcarAlertaLeida(a: Alerta): void {
    if (!a?.id) return;
    this.alertasService
      .marcarComoLeida(a.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.cargarAlertas(),
        error: () => this.cargarAlertas(),
      });
  }

  // ======== LOGS ========
  private cargarLogs(): void {
    this.loadingLogs = true;
    this.logsService
      .getLogs(50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows: LogRow[]) => {
          this.logs = rows || [];
          this.loadingLogs = false;
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('[HISTORIAL] Error al cargar logs:', err);
          this.logs = [];
          this.loadingLogs = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ================== TRACKBYS ==================
  trackByLectura = (i: number, l: LecturaUI) => (l?.id as any) ?? l?.fecha ?? l?.timestamp ?? i;
  trackByAccion = (i: number, a: any) => a?.id ?? a?.fecha ?? i;
  trackByAlerta = (i: number, a: any) => a?.id ?? a?.fecha ?? i;
  trackByLog = (i: number, l: any) => l?.id ?? l?.fecha ?? i;

  // ================== CSV ==================
  private exportCsv(nombreArchivo: string, filas: string[][]): void {
    if (!filas?.length) {
      alert('No hay datos para exportar.');
      return;
    }

    const csv = filas
      .map((row) => row.map((cell) => `"${(cell ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  descargarSensoresCsv(): void {
    const base = this.lecturasFiltradas?.length ? this.lecturasFiltradas : this.lecturas;

    const filas: string[][] = [
      ['Fecha', 'Temperatura (°C)', 'Humedad (%)', 'NH3 (ppm)', 'CH4 (ppm)'],
    ];

    base.forEach((l) => {
      const fecha =
        l?.fecha ||
        (l?.fechaView instanceof Date ? l.fechaView.toISOString() : '') ||
        '';
      filas.push([
        fecha,
        String(l?.temperatura ?? ''),
        String(l?.humedadPromedio ?? ''),
        String(l?.NH3 ?? ''),
        String(l?.CH4 ?? ''),
      ]);
    });

    const fechaTag = this.fechaISO ? new Date(this.fechaISO).toISOString().slice(0, 10) : 'sin-fecha';
    this.exportCsv(`historial_sensores_${fechaTag}.csv`, filas);
  }

  descargarAccionesCsv(): void {
    const filas: string[][] = [['Fecha', 'Descripción', 'Estado']];
    (this.acciones || []).forEach((a: any) => {
      filas.push([
        a?.fecha ? new Date(a.fecha).toISOString() : '',
        String(a?.descripcion ?? ''),
        String(a?.estado ?? ''),
      ]);
    });
    this.exportCsv('historial_acciones_automaticas.csv', filas);
  }

  descargarAlertasCsv(): void {
    const filas: string[][] = [['Fecha', 'Tipo', 'Descripción', 'Crítico', 'Leída']];
    (this.alertas || []).forEach((a: any) => {
      filas.push([
        a?.fecha ? new Date(a.fecha).toISOString() : '',
        String(a?.tipo ?? ''),
        String(a?.descripcion ?? ''),
        a?.critico ? 'sí' : 'no',
        a?.leida ? 'sí' : 'no',
      ]);
    });
    this.exportCsv('historial_alertas.csv', filas);
  }

  descargarLogsCsv(): void {
    const filas: string[][] = [['Fecha', 'Acción', 'Detalle']];
    (this.logs || []).forEach((l: any) => {
      filas.push([
        l?.fecha ? new Date(l.fecha).toISOString() : '',
        String(l?.accion ?? ''),
        String(l?.detalle ?? ''),
      ]);
    });
    this.exportCsv('historial_logs.csv', filas);
  }

  // ================== PDF (jsPDF) ==================
  private async exportPdf(nombreArchivo: string, titulo: string, filas: string[][]): Promise<void> {
    if (!filas?.length) {
      alert('No hay datos para exportar.');
      return;
    }

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const margin = 40;
    let y = 50;

    doc.setFontSize(14);
    doc.text(titulo, margin, y);

    y += 16;
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleString()}`, margin, y);

    y += 20;
    doc.setFontSize(9);

    const maxLinesPerPage = 55;
    let lineCount = 0;

    // encabezado
    const headers = filas[0] || [];
    doc.text(headers.join(' | '), margin, y);
    y += 14;
    lineCount += 2;

    for (let i = 1; i < filas.length; i++) {
      const row = filas[i] || [];
      const line = row.join(' | ');
      const safeLine = line.length > 180 ? line.slice(0, 180) + '…' : line;

      if (lineCount >= maxLinesPerPage) {
        doc.addPage();
        y = 50;
        lineCount = 0;
      }

      doc.text(safeLine, margin, y);
      y += 12;
      lineCount++;
    }

    doc.save(nombreArchivo);
  }

  async descargarSensoresPdf(): Promise<void> {
    const base = this.lecturasFiltradas?.length ? this.lecturasFiltradas : this.lecturas;

    const filas: string[][] = [['Fecha', 'Temperatura', 'Humedad', 'NH3', 'CH4']];
    base.forEach((l) => {
      const fecha =
        l?.fecha ||
        (l?.fechaView instanceof Date ? l.fechaView.toISOString() : '') ||
        '';
      filas.push([
        fecha,
        String(l?.temperatura ?? ''),
        String(l?.humedadPromedio ?? ''),
        String(l?.NH3 ?? ''),
        String(l?.CH4 ?? ''),
      ]);
    });

    const fechaTag = this.fechaISO ? new Date(this.fechaISO).toISOString().slice(0, 10) : 'sin-fecha';
    await this.exportPdf(`historial_sensores_${fechaTag}.pdf`, 'Historial - Sensores', filas);
  }

  async descargarAccionesPdf(): Promise<void> {
    const filas: string[][] = [['Fecha', 'Descripción', 'Estado']];
    (this.acciones || []).forEach((a: any) => {
      filas.push([
        a?.fecha ? new Date(a.fecha).toISOString() : '',
        String(a?.descripcion ?? ''),
        String(a?.estado ?? ''),
      ]);
    });

    await this.exportPdf('historial_acciones_automaticas.pdf', 'Historial - Acciones automáticas', filas);
  }

  async descargarAlertasPdf(): Promise<void> {
    const filas: string[][] = [['Fecha', 'Tipo', 'Descripción', 'Crítico', 'Leída']];
    (this.alertas || []).forEach((a: any) => {
      filas.push([
        a?.fecha ? new Date(a.fecha).toISOString() : '',
        String(a?.tipo ?? ''),
        String(a?.descripcion ?? ''),
        a?.critico ? 'sí' : 'no',
        a?.leida ? 'sí' : 'no',
      ]);
    });

    await this.exportPdf('historial_alertas.pdf', 'Historial - Alertas', filas);
  }

  async descargarLogsPdf(): Promise<void> {
    const filas: string[][] = [['Fecha', 'Acción', 'Detalle']];
    (this.logs || []).forEach((l: any) => {
      filas.push([
        l?.fecha ? new Date(l.fecha).toISOString() : '',
        String(l?.accion ?? ''),
        String(l?.detalle ?? ''),
      ]);
    });

    await this.exportPdf('historial_logs.pdf', 'Historial - Logs', filas);
  }

  // ================== HELPERS ==================
  private toNum(v: unknown): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
