import { Component } from '@angular/core';

interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: 'critica' | 'proceso' | 'informativa' | 'sistema';
  fecha: string;
  leida: boolean;
}

@Component({
  selector: 'app-notificaciones',
  templateUrl: './notificaciones.page.html',
  styleUrls: ['./notificaciones.page.scss'],
  standalone: false,
})
export class NotificacionesPage {
  filtro: 'todas' | 'criticas' | 'proceso' | 'informativas' = 'todas';

  notificaciones: Notificacion[] = [
    {
      id: 1,
      tipo: 'critica',
      titulo: 'Temperatura fuera de rango',
      mensaje: 'El módulo 1 superó el umbral configurado para temperatura.',
      fecha: 'Hace 5 min',
      leida: false,
    },
    {
      id: 2,
      tipo: 'proceso',
      titulo: 'Recordatorio de volteo',
      mensaje: 'Han pasado 24 h desde el último volteo del módulo 2.',
      fecha: 'Hace 1 h',
      leida: false,
    },
    {
      id: 3,
      tipo: 'informativa',
      titulo: 'Resumen diario generado',
      mensaje: 'Ya está disponible el reporte con las lecturas del día.',
      fecha: 'Ayer',
      leida: true,
    },
  ];

  get notificacionesFiltradas(): Notificacion[] {
    switch (this.filtro) {
      case 'criticas':
        return this.notificaciones.filter((n) => n.tipo === 'critica');
      case 'proceso':
        return this.notificaciones.filter((n) => n.tipo === 'proceso');
      case 'informativas':
        return this.notificaciones.filter((n) => n.tipo === 'informativa');
      default:
        return this.notificaciones;
    }
  }

  marcarTodasComoLeidas() {
    this.notificaciones = this.notificaciones.map((n) => ({
      ...n,
      leida: true,
    }));
  }
  get hayNoLeidas(): boolean {
  return this.notificaciones.some((n) => !n.leida);
}

}
