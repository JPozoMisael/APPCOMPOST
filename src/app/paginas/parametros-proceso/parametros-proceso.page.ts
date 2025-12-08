// src/app/paginas/parametros-proceso/parametros-proceso.page.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

import {
  ParametrosProcesoService,
  ParametrosProceso,
} from 'src/app/servicios/parametros-proceso';
import { LogsService } from 'src/app/servicios/logs-service';
import { AuthService } from 'src/app/servicios/auth-service';

@Component({
  selector: 'app-parametros-proceso',
  templateUrl: './parametros-proceso.page.html',
  styleUrls: ['./parametros-proceso.page.scss'],
  standalone: false,
})
export class ParametrosProcesoPage implements OnInit {
  form = this.fb.group({
    // Ambientales
    tempMin: [50, [Validators.required]],
    tempMax: [65, [Validators.required]],
    humMin: [40, [Validators.required]],
    humMax: [70, [Validators.required]],
    gasUmbral: [800, [Validators.required]],

    // Control automático
    autoVentilador: [true],
    ventMinOn: [30, [Validators.required]],
    ventMinOff: [120, [Validators.required]],
    autoVolteo: [true],
    volteoHoras: [24, [Validators.required]],

    // Datos y monitoreo
    muestreoSegundos: [60, [Validators.required]],
    envioMinutos: [5, [Validators.required]],
    bufferMax: [200, [Validators.required]],

    // Alertas
    notificarCriticas: [true],
    notificarInformativas: [false],
    canalNotificacion: ['app', [Validators.required]],
  });

  guardando = false;
  cargando = false;
  ultimaActualizacion: Date | null = null;

  constructor(
    private fb: FormBuilder,
    private toastCtrl: ToastController,
    private parametrosService: ParametrosProcesoService,
    private logsService: LogsService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    console.log('[ParametrosProceso] ngOnInit'); // 👀
    this.cargarDesdeApi();
  }

  /** Nombre del usuario actual (para logs) */
  private getNombreUsuario(): string {
    const nombre = this.auth.getNombreUsuario() || 'Usuario no identificado';
    console.log('[ParametrosProceso] Usuario actual:', nombre); // 👀
    return nombre;
  }

  /** Carga inicial de parámetros desde el backend */
  private async cargarDesdeApi(): Promise<void> {
    this.cargando = true;
    try {
      console.log('[ParametrosProceso] Cargando parámetros desde API...'); // 👀

      const data = await firstValueFrom(
        this.parametrosService.obtenerParametros()
      );

      console.log('[ParametrosProceso] Datos recibidos de la API:', data); // 👀

      // Rellenamos el formulario, dejando defaults si algo viene nulo
      this.form.patchValue({
        tempMin: data.tempMin ?? 50,
        tempMax: data.tempMax ?? 65,
        humMin: data.humMin ?? 40,
        humMax: data.humMax ?? 70,
        gasUmbral: data.gasUmbral ?? 800,
        autoVentilador:
          typeof data.autoVentilador === 'boolean'
            ? data.autoVentilador
            : true,
        ventMinOn: data.ventMinOn ?? 30,
        ventMinOff: data.ventMinOff ?? 120,
        autoVolteo:
          typeof data.autoVolteo === 'boolean' ? data.autoVolteo : true,
        volteoHoras: data.volteoHoras ?? 24,
        muestreoSegundos: data.muestreoSegundos ?? 60,
        envioMinutos: data.envioMinutos ?? 5,
        bufferMax: data.bufferMax ?? 200,
        notificarCriticas:
          typeof data.notificarCriticas === 'boolean'
            ? data.notificarCriticas
            : true,
        notificarInformativas:
          typeof data.notificarInformativas === 'boolean'
            ? data.notificarInformativas
            : false,
        canalNotificacion: (data.canalNotificacion as any) ?? 'app',
      });

      console.log(
        '[ParametrosProceso] Formulario después de patchValue:',
        this.form.value
      ); // 👀

      if (data.updated_at) {
        this.ultimaActualizacion = new Date(data.updated_at);
      } else {
        this.ultimaActualizacion = new Date();
      }
    } catch (err) {
      console.error('[ParametrosProceso] Error al cargar', err);
      await this.showToast(
        'No se pudieron cargar los parámetros actuales.',
        'danger'
      );
    } finally {
      this.cargando = false;
      console.log('[ParametrosProceso] Carga finalizada'); // 👀
    }
  }

  /** Guardar cambios en la API */
  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      console.warn('[ParametrosProceso] Formulario inválido:', this.form.value); // 👀
      return;
    }

    this.guardando = true;
    const payload = this.form.value as ParametrosProceso;
    const usuario = this.getNombreUsuario();

    console.log('[ParametrosProceso] Payload a enviar al backend:', payload); // 👀

    try {
      const resp = await firstValueFrom(
        this.parametrosService.actualizarParametros(payload)
      );

      console.log('[ParametrosProceso] Respuesta de actualizarParametros:', resp); // 👀

      this.guardando = false;

      // Si el backend devuelve updated_at, lo usamos
      this.ultimaActualizacion = resp.updated_at
        ? new Date(resp.updated_at)
        : new Date();

      await this.showToast('Parámetros actualizados correctamente.');

      // 🔍 Registrar en auditoría que se cambiaron los parámetros
      this.logsService
        .registrarCambioParametros(usuario, payload)
        .subscribe({
          next: () =>
            console.log(
              '[ParametrosProceso] Log de cambio de parámetros registrado'
            ), // 👀
          error: (e) =>
            console.error('[ParametrosProceso] Error registrando log:', e),
        });
    } catch (err) {
      console.error('[ParametrosProceso] Error al guardar', err);
      this.guardando = false;
      await this.showToast(
        'No se pudieron guardar los parámetros. Intenta nuevamente.',
        'danger'
      );

      // Opcional: log técnico de error
      this.logsService
        .registrarErrorTecnico(err, 'PARAMETROS_PROCESO_GUARDAR')
        .subscribe({
          error: (e) =>
            console.error(
              '[ParametrosProceso] Error registrando log técnico:',
              e
            ),
        });
    }
  }

  /** Volver a los valores sugeridos por defecto */
  restablecerValores(): void {
    console.log('[ParametrosProceso] Restableciendo valores por defecto'); // 👀

    this.form.reset({
      tempMin: 50,
      tempMax: 65,
      humMin: 40,
      humMax: 70,
      gasUmbral: 800,
      autoVentilador: true,
      ventMinOn: 30,
      ventMinOff: 120,
      autoVolteo: true,
      volteoHoras: 24,
      muestreoSegundos: 60,
      envioMinutos: 5,
      bufferMax: 200,
      notificarCriticas: true,
      notificarInformativas: false,
      canalNotificacion: 'app',
    });

    const usuario = this.getNombreUsuario();

    // 📝 Log de restablecimiento
    this.logsService
      .registrarRestablecerParametros(usuario)
      .subscribe({
        next: () =>
          console.log(
            '[ParametrosProceso] Log de restablecer parámetros registrado'
          ), // 👀
        error: (e) =>
          console.error('[ParametrosProceso] Error registrando log:', e),
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
