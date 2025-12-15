import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MenuController } from '@ionic/angular';
import { NotificacionesMovilService } from './servicios/notificaciones-movil'; // Corregir el nombre de la importación
import { AuthService } from './servicios/auth-service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  showShell = false;
  esAdmin = false;
  esInvestigador = false;

  constructor(
    public authService: AuthService,
    private router: Router,
    private menuController: MenuController,
    private notificacionesMovilService: NotificacionesMovilService // Usar el mismo nombre
  ) {
    console.log('[AppComponent] constructor');

    // Definir rol cuando cambie
    this.authService.rol$.subscribe((rol) => {
      this.definirRol(rol);
    });
    this.definirRol(this.authService.getRol());

    // Mostrar / ocultar shell según ruta
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((ev) => {
        const url = ev.urlAfterRedirects || ev.url || '';
        console.log('[AppComponent] navegación a:', url);

        const esPublica =
          url.startsWith('/auth') ||
          url.startsWith('/registro') ||
          url.startsWith('/recuperar') ||
          url === '/' ||
          url === '';

        this.showShell = !esPublica && this.authService.isLoggedIn();
        this.menuController.enable(this.showShell, 'mainMenu');
      });
  }

  ngOnInit() {
    this.notificacionesMovilService.init();
  }

  private definirRol(rol: string) {
    const r = (rol || '').toLowerCase();
    this.esAdmin = r === 'admin' || r === 'administrador';
    this.esInvestigador = r === 'tecnico';
  }

  async logout() {
    try {
      await this.menuController.close('mainMenu');
    } catch {}
    this.authService.logout();
  }

  // === getters sencillos para usar en la plantilla ===
  get nombreUsuario(): string {
    return (this.authService.getUsuario()?.nombre || 'Usuario').trim();
  }

  get rolUsuario(): string {
    return (this.authService.getRol() || 'usuario').toString();
  }

  get iniciales(): string {
    const parts = this.nombreUsuario.split(/\s+/).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join('') || 'U';
  }
}