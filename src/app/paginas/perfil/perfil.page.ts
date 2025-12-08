import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

import { AuthService, MeResponse, PerfilPayload } from 'src/app/servicios/auth-service';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: false,
})
export class PerfilPage implements OnInit {

  nombreUsuario = '';
  rolUsuario = '';
  correoUsuario = '';
  inicialesUsuario = '';

  sessionId = '';
  ultimoAcceso = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit() {
    this.cargarPerfil();
  }

  // ================= PERFIL =================

  private async cargarPerfil() {
    try {
      // Llama a GET /auth/me
      const me: MeResponse = await firstValueFrom(this.auth.getMe());

      this.nombreUsuario = me.nombre || this.auth.getNombreUsuario();
      this.correoUsuario = me.correo || localStorage.getItem('correo') || '';

      // rol viene como 'ADMINISTRADOR' | 'TECNICO' | 'USUARIO'
      // lo pasamos a minúsculas para mostrarlo bonito en la UI
      this.rolUsuario = (me.rol || 'USUARIO').toString().toLowerCase();

      this.inicialesUsuario = this.buildInitials(this.nombreUsuario);

      // Si en un futuro guardas más datos (sessionId, ultimoAcceso),
      // los llenas aquí.
      // this.sessionId = ...
      // this.ultimoAcceso = ...
    } catch (err) {
      console.error('[Perfil] error getMe:', err);

      // Fallback a lo que ya haya en localStorage
      this.nombreUsuario = this.auth.getNombreUsuario() || 'Usuario';
      this.rolUsuario = this.auth.getRol() || 'usuario';
      this.correoUsuario = localStorage.getItem('correo') || '';
      this.inicialesUsuario = this.buildInitials(this.nombreUsuario);
    }
  }

  private buildInitials(nombre: string): string {
    const partes = nombre.trim().split(/\s+/);
    if (!partes.length) return '?';
    const primeras = partes.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '');
    return primeras.join('');
  }

  // ================= ACCIONES UI =================

  /** Abre un alert para editar nombre/correo y luego llama a /auth/me (PUT). */
  async editarPerfil() {
    const alert = await this.alertCtrl.create({
      header: 'Editar datos personales',
      inputs: [
        {
          name: 'nombre',
          type: 'text',
          label: 'Nombre',
          value: this.nombreUsuario,
          attributes: { maxlength: 100 },
        },
        {
          name: 'correo',
          type: 'email',
          label: 'Correo',
          value: this.correoUsuario,
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (data) => {
            const nombre = (data?.nombre || '').trim();
            const correo = (data?.correo || '').trim();

            if (!nombre || !correo) {
              this.showToast('Nombre y correo son obligatorios.', 'danger');
              return false; // evita cerrar el alert
            }

            this.actualizarPerfil({ nombre, correo });
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  /** Navega a la página de cambiar contraseña */
  abrirCambiarPassword() {
    this.router.navigateByUrl('/cambiar-password');
  }

  // ================= LÓGICA PERFIL (API) =================

  private async actualizarPerfil(payload: PerfilPayload) {
    try {
      // PUT /auth/me (AuthService ya mapea nombre/email ↔ nombre/correo)
      const res = await firstValueFrom(this.auth.actualizarPerfil(payload));

      this.nombreUsuario = res.nombre;
      this.correoUsuario = res.correo;
      this.inicialesUsuario = this.buildInitials(this.nombreUsuario);

      await this.showToast('Perfil actualizado correctamente.', 'success');
    } catch (err: any) {
      console.error('[Perfil] error actualizarPerfil:', err);
      const msg =
        err?.error?.message || 'No se pudo actualizar el perfil. Intenta de nuevo.';
      await this.showToast(msg, 'danger');
    }
  }

  private async showToast(
    msg: string,
    color: 'success' | 'medium' | 'danger' = 'success',
    duration = 2500
  ) {
    const t = await this.toastCtrl.create({
      message: msg,
      color,
      duration,
    });
    await t.present();
  }
}
