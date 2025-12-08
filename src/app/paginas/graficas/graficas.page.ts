import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Chart, registerables, ChartOptions, TooltipItem } from 'chart.js';
import { DataService } from 'src/app/servicios/data-service';
import { Lectura } from 'src/app/model/lectura';
import * as JSZip from 'jszip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

Chart.register(...registerables);

type Rango = '15m' | '1h' | '24h' | 'all';
type VariableClave = keyof Lectura & (
  'temperatura' | 'h1' | 'h2' | 'h3' | 'h4' | 'humedadPromedio' | 'CH4' | 'NH3'
);

interface VariableDef {
  key: VariableClave;
  label: string;
  unidad: string;
  grupo: 'temp' | 'hum' | 'gas';
}

@Component({
  selector: 'app-graficas',
  templateUrl: './graficas.page.html',
  styleUrls: ['./graficas.page.scss'],
  standalone: false,
})
export class GraficasPage implements OnInit, OnDestroy, AfterViewInit {

  /** Definición de variables disponibles para los chips */
  variables: VariableDef[] = [
    { key: 'temperatura',     label: 'Temperatura',      unidad: '°C',  grupo: 'temp' },
    { key: 'h1',              label: 'H1',               unidad: '°C',  grupo: 'temp' },
    { key: 'h2',              label: 'H2',               unidad: '°C',  grupo: 'temp' },
    { key: 'h3',              label: 'H3',               unidad: '°C',  grupo: 'temp' },
    { key: 'h4',              label: 'H4',               unidad: '°C',  grupo: 'temp' },
    { key: 'humedadPromedio', label: 'Humedad',          unidad: '%',   grupo: 'hum' },
    { key: 'CH4',             label: 'Metano (CH₄)',     unidad: 'ppm', grupo: 'gas' },
    { key: 'NH3',             label: 'Amoniaco (NH₃)',   unidad: 'ppm', grupo: 'gas' },
  ];

  /** Variable actualmente seleccionada en los chips */
  variableSeleccionada: VariableDef = this.variables[0];

  mensaje = '';
  suavizado = true;
  rangoSeleccionado: Rango = '1h';
  kpis: { min: number; max: number; promedio: number; actual: number } | null = null;

  private refreshTimer?: any;

  // ==== Referencias a los canvas ====
  @ViewChild('lineCanvas') lineCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barCanvas') barCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gaugeCanvas') gaugeCanvasRef!: ElementRef<HTMLCanvasElement>;

  private charts: {
    line?: Chart;
    bar?: Chart;
    gauge?: Chart;
  } = {};

  private viewReady = false;
  private lastLabels: string[] = [];
  private lastValores: number[] = [];

  constructor(private dataService: DataService) {}

  ngOnInit() {
    this.actualizarDatos();
    // Auto-refresco cada 5 s
    this.refreshTimer = setInterval(() => this.actualizarDatos(), 5000);
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.crearOActualizarGraficas();
  }

  ngOnDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.destruirGraficas();
  }

  /* ==================== MANEJO DE VARIABLE ==================== */

  setVariable(key: VariableClave) {
    const encontrada = this.variables.find(v => v.key === key);
    if (!encontrada) { return; }
    this.variableSeleccionada = encontrada;
    this.actualizarDatos();
  }

  /** Unidad de la variable actual o de la que se pase */
  unidad(key?: VariableClave): string {
    const k = key ?? this.variableSeleccionada.key;
    const def = this.variables.find(v => v.key === k);
    return def?.unidad ?? '';
  }

  /** Nombre legible de rango de tiempo */
  nombreRango(r: Rango): string {
    switch (r) {
      case '15m': return 'Últimos 15 minutos';
      case '1h':  return 'Última hora';
      case '24h': return 'Últimas 24 horas';
      default:    return 'Todo el historial';
    }
  }

  /* ==================== FILTROS DE TIEMPO / SUAVIZADO ==================== */

  cambiarRango(val?: string | number | boolean) {
    const allowed: Rango[] = ['15m', '1h', '24h', 'all'];
    const str = String(val ?? this.rangoSeleccionado) as Rango;
    if (allowed.includes(str)) {
      this.rangoSeleccionado = str;
      this.actualizarDatos();
    }
  }

  toggleSuavizado(v: boolean) {
    this.suavizado = v;
    this.crearOActualizarGraficas();
  }

  /* ==================== HISTÓRICO, KPIs Y REFRESCO ==================== */

  private getHistoricoFiltrado(): { labels: string[]; valores: number[] } {
    const all = this.dataService.getHistorico?.() || [];
    if (!all.length) {
      return { labels: [], valores: [] };
    }

    const now = Date.now();
    const ms =
      this.rangoSeleccionado === '15m' ? 15 * 60_000 :
      this.rangoSeleccionado === '1h'  ? 60 * 60_000 :
      this.rangoSeleccionado === '24h' ? 24 * 60 * 60_000 : Infinity;

    const filtrados = all.filter((d: any) =>
      this.rangoSeleccionado === 'all'
        ? true
        : now - new Date(d.tiempo).getTime() <= ms
    );

    // Formato de etiqueta según rango
    const labels = filtrados.map((d: any) => {
      const fecha = new Date(d.tiempo);

      if (this.rangoSeleccionado === '15m') {
        // Detalle fino: incluye segundos
        return fecha.toLocaleTimeString('es-EC', {
          hour:   '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }

      // Resto de rangos: solo hora y minuto
      return fecha.toLocaleTimeString('es-EC', {
        hour:   '2-digit',
        minute: '2-digit'
      });
    });

    const key: keyof Lectura = this.variableSeleccionada.key;
    const valores = filtrados.map((d: any) =>
      Number(d.data[key] ?? 0)
    );

    return { labels, valores };
  }

  /** Recalcula datos + KPIs y actualiza las gráficas si la vista está lista */
  private actualizarDatos() {
    const { labels, valores } = this.getHistoricoFiltrado();
    this.lastLabels = labels;
    this.lastValores = valores;

    if (!valores.length) {
      this.mensaje = 'No hay datos disponibles para la variable seleccionada.';
      this.kpis = null;
      this.destruirGraficas();
      return;
    }

    this.mensaje = '';

    // KPIs
    const actual   = valores[valores.length - 1];
    const min      = Math.min(...valores);
    const max      = Math.max(...valores);
    const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
    this.kpis = { min, max, promedio, actual };

    if (this.viewReady) {
      this.crearOActualizarGraficas();
    }
  }

  /* ==================== CHART.JS: CREAR / ACTUALIZAR ==================== */

  private crearOActualizarGraficas() {
    if (!this.viewReady) return;
    if (!this.lastValores.length) return;

    this.destruirGraficas();

    const labels = this.lastLabels;
    const data   = this.lastValores;
    const actual = data[data.length - 1];

    // Colores base (puedes tunearlos luego)
    const colorLinea = 'rgb(54, 162, 235)';
    const colorBar   = 'rgb(255, 159, 64)';

    // === Línea ===
    const ctxLine = this.lineCanvasRef?.nativeElement?.getContext('2d');
    if (ctxLine) {
      this.charts.line = new Chart(ctxLine, {
        type: 'line',
        data: this.makeDataset(labels, data, colorLinea),
        options: this.lineBarOptions(true),
      });
    }

    // === Barras ===
    const ctxBar = this.barCanvasRef?.nativeElement?.getContext('2d');
    if (ctxBar) {
      this.charts.bar = new Chart(ctxBar, {
        type: 'bar',
        data: this.makeDataset(labels, data, colorBar),
        options: this.lineBarOptions(false),
      });
    }

    // === Gauge semicircular ===
    const ctxGauge = this.gaugeCanvasRef?.nativeElement?.getContext('2d');
    if (ctxGauge) {
      const gaugeData = this.makeGauge(actual);
      this.charts.gauge = new Chart(ctxGauge, {
        type: 'doughnut',
        data: gaugeData,
        options: this.gaugeOptions(actual),
      });
    }
  }

  private destruirGraficas() {
    if (this.charts.line) {
      this.charts.line.destroy();
      this.charts.line = undefined;
    }
    if (this.charts.bar) {
      this.charts.bar.destroy();
      this.charts.bar = undefined;
    }
    if (this.charts.gauge) {
      this.charts.gauge.destroy();
      this.charts.gauge = undefined;
    }
  }

  /* ==================== HELPERS DATASETS ==================== */

  makeDataset(labels: string[], data: number[], color: string) {
    return {
      labels,
      datasets: [
        {
          label: this.variableSeleccionada.label,
          data,
          borderColor: color,
          backgroundColor: 'rgba(54, 162, 235, 0.12)',
          fill: true,
          tension: this.suavizado ? 0.3 : 0,
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    };
  }

  makeGauge(valor: number) {
    const max = 100; // límite para el gauge (puedes parametrizarlo luego)
    const val = Math.min(Math.max(valor, 0), max);
    return {
      labels: ['Valor', 'Restante'],
      datasets: [
        {
          data: [val, max - val],
          backgroundColor: [this.gaugeColor(val), '#e0e0e0'],
          borderWidth: 0,
          cutout: '80%',
          circumference: 180,
          rotation: 270,
        },
      ],
    };
  }

  /* ==================== OPCIONES DE CHART ==================== */

  lineBarOptions(_isLine: boolean): ChartOptions<'line' | 'bar'> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<'line' | 'bar'>) => {
              const v = ctx.parsed.y as number;
              return `${this.variableSeleccionada.label}: ${v} ${this.unidad()}`;
            },
          },
        },
        decimation: { enabled: true, algorithm: 'lttb' },
      },
      scales: {
        x: { grid: { color: 'rgba(148,163,184,0.15)' } },
        y: { grid: { color: 'rgba(148,163,184,0.15)' } },
      },
      elements: {
        line: { tension: this.suavizado ? 0.3 : 0 },
        point: { radius: 0 },
      },
    };
  }

  gaugeOptions(valor: number): ChartOptions<'doughnut'> {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        title: {
          display: true,
          text: `${this.variableSeleccionada.label}: ${valor} ${this.unidad()}`,
          color: '#e5e7eb',
          font: { size: 14, weight: 'bold' },
        },
      },
    };
  }

  gaugeColor(v: number): string {
    if (v < 30) return '#4BC0C0';
    if (v < 60) return '#FFCE56';
    if (v < 85) return '#FF9F40';
    return '#FF6384';
  }

  /* ==================== EXPORTAR IMÁGENES / ZIP / PDF ==================== */

  descargarPNG(index: number) {
    const canvases = Array.from(
      document.querySelectorAll('.graficas-content canvas')
    ) as HTMLCanvasElement[];

    const canvas = canvases[index];
    if (!canvas) { return; }

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `grafica_${index + 1}_${this.variableSeleccionada.key}.png`;
    link.click();
  }

  async descargarGraficas() {
    await new Promise(r => setTimeout(r, 200));

    const canvases = Array.from(
      document.querySelectorAll('.graficas-content canvas')
    ) as HTMLCanvasElement[];

    if (!canvases.length) {
      alert('No se encontraron gráficas para exportar.');
      return;
    }

    const zip = new JSZip();
    canvases.forEach((c, i) => {
      const base64 = c.toDataURL('image/png').split(',')[1];
      zip.file(`grafica_${i + 1}.png`, base64, { base64: true });
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `graficas_${this.variableSeleccionada.key}.zip`;
    link.click();
  }

  async exportarPDF() {
    await new Promise(r => setTimeout(r, 200));

    const canvases = Array.from(
      document.querySelectorAll('.graficas-content canvas')
    ) as HTMLCanvasElement[];

    if (!canvases.length) {
      alert('No hay gráficas para exportar.');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let y = 15;

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 40, 60);
    doc.text('Informe de monitoreo de variables', 105, y, { align: 'center' });

    // Subtítulo
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Variable: ${this.variableSeleccionada.label} — Rango: ${this.nombreRango(this.rangoSeleccionado)}`,
      105,
      y,
      { align: 'center' }
    );
    y += 7;
    doc.text(
      `Fecha de generación: ${new Date().toLocaleString()}`,
      105,
      y,
      { align: 'center' }
    );

    // Gráficos
    const titulos = ['Tendencia', 'Comparación', 'Valor actual'];

    canvases.forEach((c, i) => {
      const img = c.toDataURL('image/png');
      const w = 170;
      const h = (c.height / c.width) * w;

      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(40, 40, 40);
      doc.text(titulos[i] || `Gráfica ${i + 1}`, 105, y, { align: 'center' });

      y += 5;
      doc.addImage(img, 'PNG', 20, y, w, h);
      y += h + 6;

      if (y > 250 && i < canvases.length - 1) {
        doc.addPage();
        y = 20;
      }
    });

    // Tabla de últimos valores
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 40, 60);
    doc.text('Últimos valores registrados', 105, y, { align: 'center' });

    const lecturas = this.dataService?.getHistorico?.() || [];
    const ultimos = lecturas.slice(-10).reverse();

    if (ultimos.length) {
      const body = ultimos.map((l: any, i: number) => [
        i + 1,
        new Date(l.tiempo).toLocaleString(),
        l.data[this.variableSeleccionada.key] ?? '—',
        `${l.data.temperatura ?? '—'} °C`,
        `${l.data.humedadPromedio ?? '—'} %`,
        `${l.data.CH4 ?? '—'} ppm`,
        `${l.data.NH3 ?? '—'} ppm`,
      ]);

      autoTable(doc, {
        startY: y + 6,
        head: [['#', 'Fecha', 'Valor', 'Temp', 'Humedad', 'CH₄', 'NH₃']],
        body,
        theme: 'striped',
        headStyles: { fillColor: [0, 120, 255], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9, textColor: 50 },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        margin: { left: 12, right: 12 },
      });
    }

    // Pie de página NUEVO (sin CULTIVENCOM; ahora genérico a tu plataforma)
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      'Plataforma IoT Compost – Reporte generado automáticamente',
      105,
      290,
      { align: 'center' }
    );

    doc.save(`informe_${this.variableSeleccionada.key}.pdf`);
  }
}
