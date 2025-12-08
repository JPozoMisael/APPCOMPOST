import { Injectable } from '@angular/core';

import { FiltroReporte } from '../model/reporte';

@Injectable({
  providedIn: 'root'
})
export class ReportesService {
  private reportes: FiltroReporte[] = [
    { titulo: 'Temperatura', descripcion: 'Promedio diario', fecha: '2025-06-01', variable: 'temperatura' },
    { titulo: 'Humedad', descripcion: 'Reporte semanal', fecha: '2025-06-01', variable: 'humedadPromedio' },
  ];

  getReportes(): FiltroReporte[] {
    return this.reportes;
  }

    
}
