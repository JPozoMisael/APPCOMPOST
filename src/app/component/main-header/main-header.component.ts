import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController } from '@ionic/angular';
import { AuthService } from 'src/app/servicios/auth-service';

interface NotificacionHeader {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: 'critica' | 'proceso' | 'informativa' | 'sistema';
  fecha: string;   // puedes cambiarlo luego a Date
  leida: boolean;
}

@Component({
  selector: 'app-main-header',
  templateUrl: './main-header.component.html',
  styleUrls: ['./main-header.component.scss'],
  standalone: false,
})
export class MainHeaderComponent implements OnInit {
  @Input() titulo = '';

  nombreUsuario = '';
  inicialesUsuario = '';

  // popover usuario
  popoverOpen = false;
  popoverEvent: any = null;

  // popover notificaciones
  notifPopoverOpen = false;
  notifPopoverEvent: any = null;

  notificaciones: NotificacionHeader[] = [];

  constructor(
    private auth: AuthService,
    private router: Router,
    private menuCtrl: MenuController,
  ) {}

  ngOnInit() {
    this.nombreUsuario = this.auth.getNombreUsuario() || 'Invitado';
    this.inicialesUsuario = this.buildInitials(this.nombreUsuario);

    // De momento mock; luego puedes remplazar con un servicio HTTP
    this.cargarNotificacionesMock();
  }

  get unreadCount(): number {
    return this.notificaciones.filter(n => !n.leida).length;
  }

  private buildInitials(nombre: string): string {
    const partes = nombre.trim().split(/\s+/);
    if (!partes.length) {
      return '?';
    }
    const primeras = partes.slice(0, 2).map((p) => p[0].toUpperCase());
    return primeras.join('');
  }

  // ----- MENÚ LATERAL -----
  async toggleMenu() {
    await this.menuCtrl.toggle('mainMenu');
  }

  // ----- MENÚ USUARIO -----
  openUserMenu(ev: Event) {
    this.popoverEvent = ev;
    this.popoverOpen = true;
  }

  irPerfil() {
    this.popoverOpen = false;
    this.router.navigateByUrl('/perfil');
  }

  cambiarPassword() {
    this.popoverOpen = false;
    this.router.navigateByUrl('/cambiar-password');
  }

  configNotificaciones() {
    this.popoverOpen = false;
    this.router.navigateByUrl('/notificaciones');
  }

  async logout() {
    this.popoverOpen = false;
    await this.menuCtrl.close('mainMenu').catch(() => {});
    this.auth.logout();
    this.router.navigateByUrl('/auth', {
      replaceUrl: true,
    });
  }

  // ----- NOTIFICACIONES (POPOVER) -----
  openNotifMenu(ev: Event) {
    this.notifPopoverEvent = ev;
    this.notifPopoverOpen = true;
  }

  private cargarNotificacionesMock() {
    this.notificaciones = [
      {
        id: 1,
        tipo: 'critica',
        titulo: 'Temperatura fuera de rango',
        mensaje: 'El módulo 1 superó el umbral de 65 °C.',
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
        titulo: 'Resumen diario disponible',
        mensaje: 'Tu reporte de lecturas del día ya está listo.',
        fecha: 'Ayer',
        leida: true,
      },
    ];
  }

  irNotificacion(n: NotificacionHeader) {
    n.leida = true;
    this.notifPopoverOpen = false;
    // Por ahora, simplemente te llevo a la página de notificaciones
    this.router.navigateByUrl('/notificaciones');
  }

  irPaginaNotificaciones() {
    this.notifPopoverOpen = false;
    this.router.navigateByUrl('/notificaciones');
  }
}
