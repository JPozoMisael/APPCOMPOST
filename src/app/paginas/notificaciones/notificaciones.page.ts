import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { PushNotifications, PushNotificationSchema } from '@capacitor/push-notifications';

interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: 'critica' | 'proceso' | 'informativa' | 'sistema' | 'accion_fuzzy';
  fecha: string;
  leida: boolean;
  alertaId?: number; // Agrega esta propiedad
  accionId?: number; // Agrega esta propiedad
}

@Component({
  selector: 'app-notificaciones',
  templateUrl: './notificaciones.page.html',
  styleUrls: ['./notificaciones.page.scss'],
  standalone: false,
})
export class NotificacionesPage implements OnInit {
  filtro: 'todas' | 'criticas' | 'proceso' | 'informativas' = 'todas';
  notificaciones: Notificacion[] = [];

  constructor(
    private navCtrl: NavController,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadNotificaciones();
    this.listenToPushNotifications();
  }

  async loadNotificaciones() {
    // Obtener las notificaciones del backend
    const url = `${environment.apiBaseUrl}/notificaciones`;
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });

    this.http.get<Notificacion[]>(url, { headers }).subscribe(
      (notificaciones) => {
        this.notificaciones = notificaciones;
      },
      (error) => {
        console.error('Error al cargar las notificaciones:', error);
      }
    );
  }

  listenToPushNotifications() {
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push received:', notification);
      // Agregar la notificación a la lista
      this.notificaciones.unshift({
        id: Math.random(), // Generar un ID único
        titulo: notification.title || 'Nueva notificación',
        mensaje: notification.body || 'Sin mensaje',
        tipo: (notification.data && notification.data.tipo) || 'informativa',
        fecha: 'Ahora mismo',
        leida: false,
        alertaId: notification.data && notification.data.alertaId,
        accionId: notification.data && notification.data.accionId
      });
    });
  }

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

  // Navegar a la página correspondiente al hacer clic en una notificación
  goToPage(notificacion: Notificacion) {
    if (notificacion.tipo === 'critica' || notificacion.tipo === 'proceso' || notificacion.tipo === 'informativa' || notificacion.tipo === 'sistema') {
      // Navegar a la página de detalles de la alerta
      this.navCtrl.navigateForward(`/dashboard`); // Reemplaza con la ruta correcta
    } else if (notificacion.tipo === 'accion_fuzzy') {
      // Navegar a la página de detalles de la acción difusa
      this.navCtrl.navigateForward(`/historial`); // Reemplaza con la ruta correcta
    }
  }
}