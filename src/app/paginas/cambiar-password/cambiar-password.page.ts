import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { LoadingController, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/servicios/auth-service';

@Component({
  selector: 'app-cambiar-password',
  templateUrl: './cambiar-password.page.html',
  styleUrls: ['./cambiar-password.page.scss'],
  standalone: false,
})
export class CambiarPasswordPage {
  guardando = false;

  form = this.fb.group({
    actual: ['', [Validators.required]],
    nueva: ['', [Validators.required, Validators.minLength(8)]],
    confirmar: ['', [Validators.required]],
  });

  constructor(
    private fb: FormBuilder,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private auth: AuthService,
  ) {}

  // Helpers de template
  get f() {
    return this.form.controls;
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.showToast('Completa todos los campos.', 'danger');
      return;
    }

    const { actual, nueva, confirmar } = this.form.value;

    if (nueva !== confirmar) {
      await this.showToast('Las contraseñas nuevas no coinciden.', 'danger');
      return;
    }

    this.guardando = true;
    const loading = await this.loadingCtrl.create({
      message: 'Actualizando contraseña...',
    });
    await loading.present();

    try {
      // Llamada REAL a tu backend: POST /auth/change-password
      await firstValueFrom(
        this.auth.cambiarPassword({
          actual: actual!,   // contraseña actual
          nueva: nueva!,     // contraseña nueva
        })
      );

      await this.showToast('Contraseña actualizada correctamente.', 'success');
      this.form.reset();
    } catch (err: any) {
      console.error('[CambiarPassword] error:', err);
      const msg =
        err?.error?.message ||
        'No se pudo actualizar la contraseña. Intenta de nuevo.';
      await this.showToast(msg, 'danger');
    } finally {
      this.guardando = false;
      await loading.dismiss();
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
