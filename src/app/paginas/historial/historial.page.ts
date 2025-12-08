// src/app/paginas/historial/historial.page.ts
import { Component, OnInit } from '@angular/core';
import { FuzzyService, AccionAuto } from '../../servicios/fuzzy-service';
import { LogsService, LogRow } from '../../servicios/logs-service';
import { AlertasService } from '../../servicios/alerta-service';
import { DataService } from '../../servicios/data-service';

import { Lectura } from '../../model/lectura';
import { Alerta } from '../../model/alerta';

type TabHistorial = 'sensores' | 'acciones' | 'alertas' | 'logs';

interface ResumenVar {
  min: number;
  max: number;
  prom: number;
}

@Component({
  selector: 'app-historial',
  templateUrl: './historial.page.html',
  styleUrls: ['./historial.page.scss'],
  standalone: false,
})
export class HistorialPage implements OnInit {
  // === pestañas ===
  tab: TabHistorial = 'sensores';

  // filtros
  fechaISO: string = new Date().toISOString();
  variable: 'temperatura' | 'humedadPromedio' | 'NH3' | 'CH4' = 'temperatura';

  // lecturas crudas (todas las que llegan por MQTT en esta sesión)
  lecturas: any[] = [];
  // lecturas filtradas por la fecha elegida
  lecturasFiltradas: any[] = [];
  loadingLecturas = false;

  acciones: AccionAuto[] = [];
  loadingAcciones = false;

  alertas: Alerta[] = [];
  loadingAlertas = false;

  logs: LogRow[] = [];
  loadingLogs = false;

  constructor(
    private dataService: DataService,
    private fuzzyService: FuzzyService,
    private logsService: LogsService,
    private alertasService: AlertasService
  ) {}

  ngOnInit(): void {
    // 🔹 Historial en memoria (últimas N muestras MQTT)
    this.loadingLecturas = true;
    this.dataService.historico$.subscribe((muestras: any[]) => {
      this.lecturas =
        (muestras || []).map((m) => ({
          ...(m.data || {}),
          fecha: m.tiempo,
        })) ?? [];
      this.loadingLecturas = false;

      // aplicar filtro por fecha cada vez que llega nueva data
      this.aplicarFiltrosSensores();
    });

    this.cargarAcciones();
    this.cargarAlertas();
    this.cargarLogs();
  }

  // =================== GETTERS RESUMEN SUPERIOR ===================

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

  // =================== INTERACCIÓN TABS / FILTROS ===================

  onCambioFiltrosSensores(): void {
    this.aplicarFiltrosSensores();
  }

  onTabChange(ev: any): void {
    const value = ev?.detail?.value as TabHistorial;
    if (value) this.tab = value;
  }

  setVariable(
    v: 'temperatura' | 'humedadPromedio' | 'NH3' | 'CH4'
  ): void {
    this.variable = v;
    // no hace falta recalcular nada más; el getter usa this.variable
  }

  // ======== FILTRO Y RESUMEN A PARTIR DE LAS LECTURAS EN MEMORIA ========

  /** Aplica el filtro por fecha sobre las lecturas en memoria */
  private aplicarFiltrosSensores(): void {
    if (!this.lecturas || !this.lecturas.length) {
      this.lecturasFiltradas = [];
      return;
    }

    let fechaSel: Date | null = null;
    try {
      fechaSel = this.fechaISO ? new Date(this.fechaISO) : null;
    } catch {
      fechaSel = null;
    }

    if (!fechaSel || isNaN(fechaSel.getTime())) {
      // si la fecha no es válida, mostramos todo
      this.lecturasFiltradas = [...this.lecturas];
      return;
    }

    const ySel = fechaSel.getFullYear();
    const mSel = fechaSel.getMonth();
    const dSel = fechaSel.getDate();

    this.lecturasFiltradas = this.lecturas.filter((l) => {
      const f = this.getFechaLectura(l);
      if (!f) return false;
      const dt = new Date(f);
      if (isNaN(dt.getTime())) return false;
      return (
        dt.getFullYear() === ySel &&
        dt.getMonth() === mSel &&
        dt.getDate() === dSel
      );
    });
  }

  get resumenVariable(): ResumenVar {
    const base =
      this.lecturasFiltradas && this.lecturasFiltradas.length
        ? this.lecturasFiltradas
        : this.lecturas;

    if (!base || !base.length) {
      return { min: 0, max: 0, prom: 0 };
    }

    const vals = base
      .map((l: any) => Number(l?.[this.variable]))
      .filter((v) => Number.isFinite(v));

    if (!vals.length) return { min: 0, max: 0, prom: 0 };

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { min, max, prom };
  }

  get etiquetaVariable(): string {
    switch (this.variable) {
      case 'temperatura':
        return 'Temperatura (°C)';
      case 'humedadPromedio':
        return 'Humedad (%)';
      case 'NH3':
        return 'NH₃ (ppm)';
      case 'CH4':
        return 'CH₄ (ppm)';
      default:
        return this.variable;
    }
  }

  // Devuelve la fecha de una lectura (string o null)
  getFechaLectura(l: any): string | null {
    if (!l) return null;
    return (
      (l.fecha as string) ||
      (l.creado_en as string) ||
      (l.timestamp as string) ||
      null
    );
  }

  // ======== ACCIONES AUTOMÁTICAS (FUZZY) ========
  private cargarAcciones(): void {
    this.loadingAcciones = true;
    this.fuzzyService.list().subscribe({
      next: (lista) => {
        this.acciones = lista || [];
        this.loadingAcciones = false;
      },
      error: (err) => {
        console.error('[HISTORIAL] Error al cargar acciones fuzzy:', err);
        this.acciones = [];
        this.loadingAcciones = false;
      },
    });
  }

  // ======== ALERTAS ========
  private cargarAlertas(): void {
    this.loadingAlertas = true;
    this.alertasService.getAlertas().subscribe({
      next: (lista) => {
        this.alertas = lista || [];
        this.loadingAlertas = false;
      },
      error: (err) => {
        console.error('[HISTORIAL] Error al cargar alertas:', err);
        this.alertas = [];
        this.loadingAlertas = false;
      },
    });
  }

  marcarAlertaLeida(a: Alerta): void {
    if (!a?.id) return;
    this.alertasService.marcarComoLeida(a.id).subscribe({
      next: () => this.cargarAlertas(),
      error: () => this.cargarAlertas(),
    });
  }

  // ======== LOGS ========
  private cargarLogs(): void {
    this.loadingLogs = true;
    this.logsService.getLogs(50).subscribe({
      next: (rows) => {
        this.logs = rows || [];
        this.loadingLogs = false;
      },
      error: (err) => {
        console.error('[HISTORIAL] Error al cargar logs:', err);
        this.logs = [];
        this.loadingLogs = false;
      },
    });
  }

  // ================== DESCARGA CSV ==================

  private exportCsv(nombreArchivo: string, filas: string[][]): void {
    if (!filas.length) {
      alert('No hay datos para exportar.');
      return;
    }

    const csv = filas
      .map((row) =>
        row
          .map((cell) =>
            `"${(cell ?? '').replace(/"/g, '""')}"`
          )
          .join(';')
      )
      .join('\r\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  descargarSensoresCsv(): void {
    const base =
      this.lecturasFiltradas && this.lecturasFiltradas.length
        ? this.lecturasFiltradas
        : this.lecturas;

    const filas: string[][] = [
      ['Fecha', 'Temperatura (°C)', 'Humedad (%)', 'NH3 (ppm)', 'CH4 (ppm)'],
    ];

    base.forEach((l: any) => {
      const fecha = this.getFechaLectura(l) || '';
      filas.push([
        fecha,
        String(l.temperatura ?? ''),
        String(l.humedadPromedio ?? ''),
        String(l.NH3 ?? ''),
        String(l.CH4 ?? ''),
      ]);
    });

    this.exportCsv('lecturas_sensores.csv', filas);
  }

  descargarAccionesCsv(): void {
    const filas: string[][] = [['Fecha', 'Descripción', 'Estado']];

    (this.acciones || []).forEach((a) => {
      filas.push([
        a.fecha ? new Date(a.fecha).toISOString() : '',
        a.descripcion ?? '',
        a.estado ?? '',
      ]);
    });

    this.exportCsv('acciones_automaticas.csv', filas);
  }

  descargarAlertasCsv(): void {
    const filas: string[][] = [
      ['Fecha', 'Tipo', 'Descripción', 'Crítico', 'Leída'],
    ];

    (this.alertas || []).forEach((a) => {
      filas.push([
        a.fecha ? new Date(a.fecha).toISOString() : '',
        String(a.tipo ?? ''),
        String(a.descripcion ?? ''),
        a.critico ? 'sí' : 'no',
        a.leida ? 'sí' : 'no',
      ]);
    });

    this.exportCsv('alertas.csv', filas);
  }

  descargarLogsCsv(): void {
    const filas: string[][] = [['Fecha', 'Acción', 'Detalle']];

    (this.logs || []).forEach((l) => {
      filas.push([
        l.fecha ? new Date(l.fecha).toISOString() : '',
        l.accion ?? '',
        l.detalle ?? '',
      ]);
    });

    this.exportCsv('logs.csv', filas);
  }
}
