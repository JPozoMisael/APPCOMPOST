import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { LogsService, LogRow } from 'src/app/servicios/logs-service';

// Extensión del modelo para la UI (campos opcionales que usamos en la vista)
type LogRowExt = LogRow & {
  tipo?: 'alerta' | 'sistema' | 'info' | string;
  origen?: string;
  usuario?: string;
  modulo?: string;
  resultado?: 'ok' | 'error' | string;
};

@Component({
  selector: 'app-admin-auditoria',
  templateUrl: './admin-auditoria.page.html',
  styleUrls: ['./admin-auditoria.page.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuditoriaPage implements OnInit, OnDestroy {
  // filtros del HTML
  rango: '24h' | '7d' | '30d' | 'all' = '24h';
  tipo: 'todos' | 'alertas' | 'sistema' = 'todos';
  search = '';

  // estado de datos
  cargando = false;
  errorMsg = '';

  // lista completa y lista filtrada
  logs: LogRowExt[] = [];
  logsFiltrados: LogRowExt[] = [];

  private subLogs?: Subscription;

  constructor(
    private logsService: LogsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarLogs();
  }

  ngOnDestroy() {
    this.subLogs?.unsubscribe();
  }

  // ===== KPIs para la cabecera =====
  get totalAlertas(): number {
    return this.logs.filter(
      (l) =>
        l.tipo === 'alerta' ||
        l.tipo === 'alertas' ||
        (l as any).nivel === 'alerta'
    ).length;
  }

  get totalSistema(): number {
    return this.logs.filter(
      (l) =>
        l.tipo === 'sistema' ||
        (l as any).categoria === 'sistema'
    ).length;
  }

  // ===== CARGA DE LOGS DESDE EL SERVICIO =====
  cargarLogs() {
    this.cargando = true;
    this.errorMsg = '';
    this.logs = [];
    this.logsFiltrados = [];
    this.cdr.markForCheck();

    this.subLogs?.unsubscribe();
    this.subLogs = this.logsService.getLogs().subscribe({
      next: (rows: LogRow[]) => {
        // Cast suave a nuestro tipo extendido para la UI
        this.logs = (rows || []) as LogRowExt[];
        this.aplicarFiltros();
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.error('[AdminAuditoria] error cargando logs', err);
        this.errorMsg =
          'No se pudieron cargar los registros de auditoría. Intenta nuevamente más tarde.';
        this.cargando = false;
        this.cdr.markForCheck();
      },
    });
  }

  // llamado desde (ionChange) y (ionInput) en el HTML
  onFiltroChange() {
    this.aplicarFiltros();
  }

  // ===== LÓGICA DE FILTRADO =====
  private aplicarFiltros() {
    let data = [...this.logs];
    const ahora = new Date();

    // filtro por rango de fecha
    if (this.rango !== 'all') {
      const limite = new Date(ahora);
      if (this.rango === '24h') limite.setDate(limite.getDate() - 1);
      if (this.rango === '7d') limite.setDate(limite.getDate() - 7);
      if (this.rango === '30d') limite.setDate(limite.getDate() - 30);

      data = data.filter((l) => {
        const f = new Date(l.fecha as any);
        return !isNaN(f.getTime()) && f >= limite;
      });
    }

    // filtro por tipo (alertas / sistema)
    if (this.tipo === 'alertas') {
      data = data.filter(
        (l) =>
          l.tipo === 'alerta' ||
          l.tipo === 'alertas' ||
          (l as any).nivel === 'alerta'
      );
    } else if (this.tipo === 'sistema') {
      data = data.filter(
        (l) =>
          l.tipo === 'sistema' ||
          (l as any).categoria === 'sistema'
      );
    }

    // filtro por texto (acción, detalle, usuario, módulo)
    if (this.search?.trim()) {
      const q = this.search.toLowerCase();
      data = data.filter((l) => {
        const accion = (l.accion || '').toLowerCase();
        const detalle = (l.detalle || '').toLowerCase();
        const usuario = (l.usuario || '').toLowerCase();
        const modulo = (l.modulo || '').toLowerCase();
        return (
          accion.includes(q) ||
          detalle.includes(q) ||
          usuario.includes(q) ||
          modulo.includes(q)
        );
      });
    }

    this.logsFiltrados = data;
    this.cdr.markForCheck();
  }

  // ===== FORMATEO DE FECHA PARA LA TABLA =====
  formatFecha(fecha: string | Date | undefined | null): string {
    if (!fecha) return '—';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return String(fecha);
    return d.toLocaleString(); // personaliza formato si quieres
  }

  // ===== EXPORTAR CSV =====
  exportCSV() {
    if (!this.logsFiltrados.length) return;

    const header = 'fecha,tipo,accion,usuario,modulo,resultado,detalle';
    const lines = this.logsFiltrados.map((l) => {
      const fecha = this.formatFecha(l.fecha).replace(/,/g, ' ');
      const tipo = (l.tipo || '').replace(/"/g, '""');
      const accion = (l.accion || '').replace(/"/g, '""');
      const usuario = (l.usuario || '').replace(/"/g, '""');
      const modulo = (l.modulo || '').replace(/"/g, '""');
      const resultado = (l.resultado || '').replace(/"/g, '""');
      const detalle = (l.detalle || '').replace(/"/g, '""');
      return `"${fecha}","${tipo}","${accion}","${usuario}","${modulo}","${resultado}","${detalle}"`;
    });

    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'auditoria_logs.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    window.URL.revokeObjectURL(url);
  }
}
