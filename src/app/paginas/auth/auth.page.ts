import { Component, NgZone, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/servicios/auth-service';
import { IdiomaService } from 'src/app/servicios/idioma-service';
import { LogsService } from 'src/app/servicios/logs-service';
import { NotificacionesMovilService } from 'src/app/servicios/notificaciones-movil';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  standalone: false,
})
export class AuthPage implements OnInit {
  credentials = { email: '', password: '' };
  verPassword = false;
  cargando = false;
  errorMsg: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private idiomaService: IdiomaService,
    private logsService: LogsService,
    private ngZone: NgZone,
    private notificacionesMovilService: NotificacionesMovilService // Inyectar el servicio
  ) {
    console.log('[AuthPage] constructor');
  }

  ngOnInit(): void {
    console.log('[AuthPage] ngOnInit');
    this.idiomaService.idioma$.subscribe((idioma) => {
      console.log(`[AuthPage] Idioma actualizado en auth: ${idioma}`);
    });

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    console.log('[AuthPage] queryParam returnUrl =', returnUrl);
  }

  async onSubmit(ev?: Event): Promise<void> {
    console.log('[AuthPage] onSubmit() disparado');
    ev?.preventDefault();
    ev?.stopPropagation?.();

    if (this.cargando) {
      console.log('[AuthPage] onSubmit abortado: ya está cargando');
      return; // evita doble-submit
    }

    this.errorMsg = null;
    this.cargando = true;

    console.log('[AuthPage] credenciales a enviar:', {
      email: String(this.credentials.email || '').trim(),
      // nunca logueamos password por seguridad
    });

    try {
      console.log('[AuthPage] llamando a authService.login...');
      const resp = await firstValueFrom(
        this.authService.login({
          email: String(this.credentials.email || '').trim(),
          password: this.credentials.password,
        })
      );
      console.log('[AuthPage] respuesta de login:', resp);

      const usuario = resp?.usuario;
      const email = usuario?.email ?? this.credentials.email ?? 'desconocido';
      const usuarioId =
        typeof usuario?.id === 'number' ? usuario.id : undefined;

      console.log('[AuthPage] usuario autenticado:', { email, usuarioId });

      this.logsService
        .registrarLog(
          `LOGIN | ${email} | OK${usuarioId ? ` (id:${usuarioId})` : ''}`
        )
        .subscribe({
          next: () => console.log('[AuthPage] Log de LOGIN registrado'),
          error: (e) =>
            console.warn('[AuthPage] Error registrando log de LOGIN', e),
        });

      // ========= FIX DEL BUCLE /auth =========
      let returnUrl =
        this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';

      console.log('[AuthPage] returnUrl original =', returnUrl);

      // Si el returnUrl apunta al propio /auth (con o sin query), lo ignoramos
      if (!returnUrl || returnUrl.startsWith('/auth')) {
        console.log(
          '[AuthPage] returnUrl apunta a /auth, usando /dashboard por defecto'
        );
        returnUrl = '/dashboard';
      }
      // =======================================

      console.log('[AuthPage] Navegando a returnUrl =', returnUrl);

      await new Promise(requestAnimationFrame);
      this.ngZone.run(() => {
        console.log('[AuthPage] ngZone.run -> router.navigateByUrl');
        this.router.navigateByUrl(returnUrl, { replaceUrl: true });
      });

      // Inicializar el servicio de notificaciones después del login
      this.notificacionesMovilService.init();

    } catch (err: any) {
      console.error('[AuthPage] Error en login', err);
      this.logsService
        .registrarErrorTecnico(err, 'LoginPage.onSubmit')
        ?.subscribe?.({
          next: () => console.log('[AuthPage] Error técnico registrado'),
          error: () =>
            console.warn(
              '[AuthPage] No se pudo registrar error técnico'
            ),
        });

      this.errorMsg = err?.error?.message || 'Credenciales inválidas';
      console.log('[AuthPage] errorMsg seteado a:', this.errorMsg);
    } finally {
      this.cargando = false;
      console.log('[AuthPage] onSubmit() finalizado. cargando = false');
    }
  }

  togglePassword(): void {
    this.verPassword = !this.verPassword;
    console.log(
      '[AuthPage] togglePassword -> verPassword =',
      this.verPassword
    );
  }

  irARegistro(): void {
    console.log('[AuthPage] irARegistro()');
    this.router.navigate(['/registro']);
  }

  recuperarClave(): void {
    console.log('[AuthPage] recuperarClave()');
    const emailPrompt = prompt('Ingresa tu correo para recuperar la contraseña');

    if (!emailPrompt) {
      console.log('[AuthPage] recuperarClave cancelado (sin email)');
      return;
    }

    const email = String(emailPrompt).trim();
    if (!email) {
      console.log('[AuthPage] recuperarClave: email vacío tras trim');
      alert('Debes ingresar un correo válido.');
      return;
    }

    console.log('[AuthPage] recoverPassword para:', email);
    this.authService.recoverPassword(email).subscribe({
      next: (resp) => {
        console.log('[AuthPage] recoverPassword OK', resp);
        const temp = resp?.tempPassword;

        if (temp) {
          alert(
            'Se ha generado una contraseña temporal.\n\n' +
            `Contraseña temporal: ${temp}\n\n` +
            'Inicia sesión con esta contraseña y luego cámbiala desde tu perfil.'
          );
        } else {
          alert(
            'Se generó una contraseña temporal. Intenta iniciar sesión y luego cambia la contraseña desde tu perfil.'
          );
        }
      },
      error: (e) => {
        console.error('[AuthPage] recoverPassword ERROR', e);
        const msg =
          e?.error?.message ||
          'No se pudo procesar la recuperación de contraseña.';
        alert(msg);
      },
    });
  }
}