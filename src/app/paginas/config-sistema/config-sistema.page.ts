import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/servicios/auth-service';
import { ConfigSistemaService, ConfigSistema } from 'src/app/servicios/config-sistema';

@Component({
  selector: 'app-config-sistema',
  templateUrl: './config-sistema.page.html',
  styleUrls: ['./config-sistema.page.scss'],
  standalone: false,
})
export class ConfigSistemaPage implements OnInit {
  form = this.fb.group({
    // Apariencia
    tema: ['auto', [Validators.required]],         // auto | claro | oscuro
    tamFuente: ['normal', [Validators.required]],  // normal | grande
    reducirAnimaciones: [false],

    // Canales de notificación
    email: [true],
    push: [true],
    sms: [false],

    // Tipos de alertas
    alertasCriticas: [true],
    alertasProceso: [true],
    alertasInformativas: [true],

    // Resúmenes
    resumenFrecuencia: ['semanal', [Validators.required]], // diario | semanal | mensual
  });

  cargando = false;
  guardando = false;
  ultimaActualizacion: Date | null = null;

  constructor(
    private fb: FormBuilder,
    private toastCtrl: ToastController,
    private auth: AuthService,
    private configService: ConfigSistemaService,
  ) {}

  ngOnInit(): void {
    this.cargarDesdeApi();
  }

  private async cargarDesdeApi(): Promise<void> {
    this.cargando = true;
    try {
      const data = await firstValueFrom(this.configService.obtenerConfig());

      this.form.patchValue({
        tema: data.tema ?? 'auto',
        tamFuente: data.tamFuente ?? 'normal',
        reducirAnimaciones:
          typeof data.reducirAnimaciones === 'boolean'
            ? data.reducirAnimaciones
            : false,

        email: typeof data.email === 'boolean' ? data.email : true,
        push: typeof data.push === 'boolean' ? data.push : true,
        sms: typeof data.sms === 'boolean' ? data.sms : false,

        alertasCriticas:
          typeof data.alertasCriticas === 'boolean'
            ? data.alertasCriticas
            : true,
        alertasProceso:
          typeof data.alertasProceso === 'boolean'
            ? data.alertasProceso
            : true,
        alertasInformativas:
          typeof data.alertasInformativas === 'boolean'
            ? data.alertasInformativas
            : true,

        resumenFrecuencia: data.resumenFrecuencia ?? 'semanal',
      });

      if (data.updated_at) {
        this.ultimaActualizacion = new Date(data.updated_at);
      } else {
        this.ultimaActualizacion = new Date();
      }
    } catch (err) {
      console.error('[ConfigSistema] Error al cargar', err);
      await this.showToast(
        'No se pudo cargar la configuración del sistema.',
        'danger'
      );
    } finally {
      this.cargando = false;
    }
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando = true;
    const payload = this.form.value as ConfigSistema;
    const usuario = this.auth.getNombreUsuario() || 'Usuario';

    try {
      const resp = await firstValueFrom(
        this.configService.actualizarConfig(payload, usuario)
      );

      this.guardando = false;

      this.ultimaActualizacion = resp.updated_at
        ? new Date(resp.updated_at)
        : new Date();

      await this.showToast('Configuración guardada correctamente.');
    } catch (err) {
      console.error('[ConfigSistema] Error al guardar', err);
      this.guardando = false;
      await this.showToast(
        'No se pudo guardar la configuración. Intenta nuevamente.',
        'danger'
      );
    }
  }

  restablecerValores(): void {
    this.form.reset({
      tema: 'auto',
      tamFuente: 'normal',
      reducirAnimaciones: false,

      email: true,
      push: true,
      sms: false,

      alertasCriticas: true,
      alertasProceso: true,
      alertasInformativas: true,

      resumenFrecuencia: 'semanal',
    });
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
