import {
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { DataService } from 'src/app/servicios/data-service';
import { SensorMuestra } from 'src/app/model/sensor-muestra';

import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';
Chart.register(...registerables);

type LinePoint = number | null;
type LineData = LinePoint[];
type LineChartData = ChartData<'line', LineData>;
type LineChartConfig = ChartConfiguration<'line', LineData>;
type LineChart = Chart<'line', LineData>;

@Component({
  selector: 'app-explorador-datos',
  templateUrl: './explorador-datos.page.html',
  styleUrls: ['./explorador-datos.page.scss'],
  standalone: false,
})
export class ExploradorDatosPage implements OnInit, OnDestroy {
  @ViewChild('explorerChart', { static: false })
  chartRef!: ElementRef<HTMLCanvasElement>;

  // filtros simples con ngModel
  rango: '24h' | '7d' | '30d' | 'custom' = '7d';
  fechaDesde = '';
  fechaHasta = '';

  mostrarTemp = true;
  mostrarHum = true;
  mostrarNH3 = false;
  mostrarCH4 = false;

  // datos crudos del DataService
  private historico: SensorMuestra[] = [];
  // datos filtrados visibles (para CSV / PDF)
  datosFiltrados: SensorMuestra[] = [];

  cargando = false;
  errorMsg: string | null = null;

  private subs: Subscription[] = [];
  private chart?: LineChart;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    // suscripción al histórico (como en dashboard)
    this.cargando = true;
    const s = this.dataService.historico$.subscribe({
      next: (hist) => {
        this.historico = Array.isArray(hist) ? [...hist] : [];
        this.aplicarFiltros();
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando histórico', err);
        this.errorMsg = 'No se pudieron cargar los datos históricos.';
        this.cargando = false;
      },
    });
    this.subs.push(s);
  }

  ionViewDidEnter() {
    // cuando la vista ya está montada, renderizamos el gráfico
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.chart?.destroy();
  }

  // ------------------- FILTROS -------------------

  onRangoChange() {
    if (this.rango !== 'custom') {
      // limpiar fechas personalizadas
      this.fechaDesde = '';
      this.fechaHasta = '';
    }
    this.aplicarFiltros();
  }

  onFechaChange() {
    if (this.rango === 'custom') {
      this.aplicarFiltros();
    }
  }

  onVariablesChange() {
    this.actualizarChart();
  }

  private aplicarFiltros() {
    if (!this.historico?.length) {
      this.datosFiltrados = [];
      this.actualizarChart();
      return;
    }

    let from: Date | null = null;
    let to: Date | null = null;
    const ahora = new Date();

    switch (this.rango) {
      case '24h': {
        from = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
        to = ahora;
        break;
      }
      case '7d': {
        from = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
        to = ahora;
        break;
      }
      case '30d': {
        from = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
        to = ahora;
        break;
      }
      case 'custom': {
        if (this.fechaDesde) {
          from = new Date(this.fechaDesde);
        }
        if (this.fechaHasta) {
          // sumar un día para incluir todo ese día
          const tmp = new Date(this.fechaHasta);
          tmp.setDate(tmp.getDate() + 1);
          to = tmp;
        }
        break;
      }
    }

    this.datosFiltrados = this.historico.filter((m) => {
      const t = new Date(m.tiempo as any);
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    });

    this.actualizarChart();
  }

  // ------------------- CHART -------------------

  private renderChart() {
    const canvas = this.chartRef?.nativeElement;
    if (!canvas) return;

    this.chart?.destroy();

    const data: LineChartData = {
      labels: [],
      datasets: [],
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
              maxTicksLimit: 10,
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
        } as any,
      },
    };

    this.chart = new Chart(canvas.getContext('2d')!, cfg);
    this.actualizarChart();
  }

  private actualizarChart() {
    if (!this.chart) return;

    const labels: string[] = [];
    const serieTemp: LineData = [];
    const serieHum: LineData = [];
    const serieNH3: LineData = [];
    const serieCH4: LineData = [];

    const num = (v: any): number | null => {
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return isFinite(n) ? n : null;
    };

    (this.datosFiltrados || []).forEach((m) => {
      const d = new Date(m.tiempo as any);
      labels.push(this.formatHoraFecha(d));

      const data: any = m.data || {};
      serieTemp.push(num(data.temperatura));
      serieHum.push(num(data.humedadPromedio));
      serieNH3.push(num(data.NH3));
      serieCH4.push(num(data.CH4));
    });

    const datasets: any[] = [];

    if (this.mostrarTemp) {
      datasets.push({
        label: 'Temperatura (°C)',
        data: serieTemp,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.12)',
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
      });
    }
    if (this.mostrarHum) {
      datasets.push({
        label: 'Humedad (%)',
        data: serieHum,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.12)',
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
      });
    }
    if (this.mostrarNH3) {
      datasets.push({
        label: 'NH₃ (%)',
        data: serieNH3,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.12)',
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
      });
    }
    if (this.mostrarCH4) {
      datasets.push({
        label: 'CH₄ (ppm)',
        data: serieCH4,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.12)',
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
      });
    }

    this.chart.data.labels = labels;
    this.chart.data.datasets = datasets;
    this.chart.update('none');
  }

  private formatHoraFecha(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  // ------------------- EXPORTAR CSV -------------------

  exportCSV() {
  if (!this.datosFiltrados.length) {
    alert('No hay datos en el rango seleccionado.');
    return;
  }

  // Tipamos explícitamente la fila de CSV
  type CSVRow = {
    fecha: string;
    temperatura: any;
    humedadPromedio: any;
    NH3: any;
    CH4: any;
  };

  const rows: CSVRow[] = this.datosFiltrados.map((m) => {
    const d = new Date(m.tiempo as any);
    const data: any = m.data || {};
    return {
      fecha: d.toISOString(),
      temperatura: data.temperatura ?? '',
      humedadPromedio: data.humedadPromedio ?? '',
      NH3: data.NH3 ?? '',
      CH4: data.CH4 ?? '',
    };
  });

  const headers = Object.keys(rows[0]) as (keyof CSVRow)[];
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const lines = [headers.join(',')].concat(
    rows.map((r) =>
      headers.map((h) => esc(r[h])).join(',')
    )
  );

  const csv = lines.join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const hoy = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `explorador_datos_${hoy}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

  // ------------------- "PDF" via imprimir -------------------

  exportPDF() {
    if (!this.datosFiltrados.length) {
      alert('No hay datos en el rango seleccionado.');
      return;
    }

    // Generamos un HTML simple con una tabla de resumen
    const filas = this.datosFiltrados
      .map((m) => {
        const d = new Date(m.tiempo as any);
        const data: any = m.data || {};
        return `
          <tr>
            <td>${d.toLocaleString()}</td>
            <td>${data.temperatura ?? ''}</td>
            <td>${data.humedadPromedio ?? ''}</td>
            <td>${data.NH3 ?? ''}</td>
            <td>${data.CH4 ?? ''}</td>
          </tr>
        `;
      })
      .join('');

    const html = `
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Informe de datos de compostaje</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          p { font-size: 12px; color: #4b5563; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 16px; }
          th, td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>Informe de datos de compostaje</h1>
        <p>Generado: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>Fecha/hora</th>
              <th>Temperatura (°C)</th>
              <th>Humedad (%)</th>
              <th>NH₃ (%)</th>
              <th>CH₄ (ppm)</th>
            </tr>
          </thead>
          <tbody>
            ${filas}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    // El usuario puede "Imprimir" y elegir "Guardar como PDF"
    win.print();
  }
}
