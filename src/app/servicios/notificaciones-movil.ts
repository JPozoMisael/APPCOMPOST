import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications, PushNotificationSchema, PushNotificationActionPerformed, PushNotificationToken } from '@capacitor/push-notifications';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { pairwise } from 'rxjs/operators';

import { AlertasService } from './alerta-service';
import { FuzzyService, AccionAuto } from './fuzzy-service';
import { Alerta } from '../model/alerta';

@Injectable({ providedIn: 'root' })
export class NotificacionesMovilService {
  private iniciado = false;
  private permisosOk = false;

  // anti-duplicados por polling/refresh
  private alertasNotificadas = new Set<string>();
  private accionesNotificadas = new Set<string>();

  constructor(
    private platform: Platform,
    private alertasService: AlertasService,
    private fuzzyService: FuzzyService,
    private http: HttpClient // Inyecta HttpClient
  ) {}

  /** Llamar UNA vez (app.component o después del login) */
  async init(): Promise<void> {
    if (this.iniciado) return;
    this.iniciado = true;

    // Solo móvil nativo (APK/IPA)
    if (!this.platform.is('hybrid')) return;

    const perm = await LocalNotifications.requestPermissions();
    this.permisosOk = perm.display === 'granted';
    if (!this.permisosOk) return;

    // Solicitar permisos para Push Notifications
    const pushPerm = await PushNotifications.requestPermissions();
    if (pushPerm.receive === 'granted') {
      // Registrar el dispositivo para recibir notificaciones push
      PushNotifications.register();
    }

    // Escuchar eventos de Push Notifications
    PushNotifications.addListener('registration', (token: PushNotificationToken) => {
      console.log('Registration token:', token.value);
      // Guardar el token en el backend
      this.guardarTokenEnBackend(token.value);
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on registration:', error.error);
    });

    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push received:', notification);
      }
    );

    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: PushNotificationActionPerformed) => {
        console.log('Push action performed:', action.actionId, action.inputValue);
      }
    );

    // ALERTAS: cuando cambia el store, detectar nuevas y notificar
    this.alertasService.alertas$
      .pipe(pairwise())
      .subscribe(async ([prev, next]) => {
        await this.notificarAlertasNuevas(prev || [], next || []);
      });

    // ACCIONES: cuando cambia el store, detectar nuevas y notificar
    this.fuzzyService.acciones$
      .pipe(pairwise())
      .subscribe(async ([prev, next]) => {
        await this.notificarAccionesNuevas(prev || [], next || []);
      });

    // primera carga (para llenar stores)
    this.alertasService.loadFromServer().subscribe();
    this.fuzzyService.loadFromServer().subscribe();
  }

  // ===================== ALERTAS =====================

  private async notificarAlertasNuevas(prev: Alerta[], next: Alerta[]): Promise<void> {
    if (!this.permisosOk) return;

    const prevIds = new Set(prev.map(a => String(a.id)));
    const nuevas = next.filter(a => !prevIds.has(String(a.id)));

    for (const a of nuevas) {
      const idStr = String(a.id);
      if (this.alertasNotificadas.has(idStr)) continue;
      this.alertasNotificadas.add(idStr);

      // regla para evitar spam: solo si NO está leída
      if (a.leida) continue;

      const critico = !!(a as any).critico;
      const title = critico ? '⚠️ Alerta crítica' : 'Alerta';
      const body = String((a as any).descripcion ?? 'Sin detalle');

      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.hashToId('alerta-' + idStr),
            title,
            body,
            extra: { tipo: 'alerta', alertaId: a.id, critico },
          },
        ],
      });
    }
  }

  // ===================== ACCIONES FUZZY =====================

  private async notificarAccionesNuevas(prev: AccionAuto[], next: AccionAuto[]): Promise<void> {
    if (!this.permisosOk) return;

    const prevIds = new Set(prev.map(a => String(a.id)));
    const nuevas = next.filter(a => !prevIds.has(String(a.id)));

    for (const ac of nuevas) {
      const idStr = String(ac.id);
      if (this.accionesNotificadas.has(idStr)) continue;
      this.accionesNotificadas.add(idStr);

      const title = ' Acción automática';
      const body = String(ac.descripcion ?? 'Acción ejecutada');

      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.hashToId('accion-' + idStr),
            title,
            body,
            extra: { tipo: 'accion', accionId: ac.id, estado: ac.estado },
          },
        ],
      });
    }
  }

  // ===================== HELPERS =====================

  private hashToId(s: string): number {
    // LocalNotifications requiere id numérico
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // ===================== GUARDAR TOKEN EN BACKEND =====================

  private guardarTokenEnBackend(token: string): void {
    const url = `${environment.apiBaseUrl}/alertas/dispositivos/tokens`; // Reemplaza con la URL de tu backend
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}` // Incluye el token JWT
    });

    this.http.post(url, { token }, { headers }).subscribe(
      (response) => {
        console.log('Token guardado en el backend:', response);
      },
      (error) => {
        console.error('Error al guardar el token en el backend:', error);
      }
    );
  }
}