import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AlertController, ToastController } from '@ionic/angular';

import { UsuariosService } from 'src/app/servicios/usuarios-service';
import { Usuario, RolUsuario } from 'src/app/model/usuario';

@Component({
  selector: 'app-admin-usuarios',
  templateUrl: './admin-usuarios.page.html',
  styleUrls: ['./admin-usuarios.page.scss'],
  standalone: false,
})
export class AdminUsuariosPage implements OnInit {
  // lista original desde la API
  usuarios: Usuario[] = [];
  // lista que se muestra (aplicando búsqueda)
  usuariosFiltrados: Usuario[] = [];

  cargando = false;
  guardando = false;
  errorMsg: string | null = null;

  // usuario actualmente en edición (null = modo crear)
  editingUser: Usuario | null = null;

  // texto de búsqueda (searchbar)
  search = '';

  // (no lo usa el HTML actual, pero lo dejamos por si luego quieres usarlo)
  roles: { valor: RolUsuario; label: string }[] = [
    { valor: 'administrador', label: 'Administrador' },
    { valor: 'tecnico', label: 'Técnico' },
    { valor: 'estandar', label: 'Estandar' },
  ];

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    rol: ['estandar' as RolUsuario, [Validators.required]],
  });

  constructor(
    private fb: FormBuilder,
    private usuariosService: UsuariosService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  // ====== Cargar usuarios desde la API ======
  cargarUsuarios(): void {
    this.cargando = true;
    this.errorMsg = null;
    this.usuariosService.getUsuarios().subscribe({
      next: (lista) => {
        this.usuarios = lista;
        this.cargando = false;
        this.aplicarFiltro(); // actualiza usuariosFiltrados
      },
      error: (err) => {
        console.error(err);
        this.errorMsg = 'No se pudieron cargar los usuarios.';
        this.cargando = false;
        this.aplicarFiltro();
      },
    });
  }

  // ====== Crear / Editar ======

  editarUsuario(u: Usuario): void {
    this.editingUser = u;
    this.form.reset({
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
    });
  }

  cancelarEdicion(): void {
    this.editingUser = null;
    this.form.reset({
      nombre: '',
      email: '',
      rol: 'estandar',
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.form.value as {
      nombre: string;
      email: string;
      rol: RolUsuario;
    };

    this.guardando = true;

    // CREAR
    if (!this.editingUser) {
      this.usuariosService.agregarUsuario(payload).subscribe({
        next: async (nuevo) => {
          this.usuarios = [nuevo, ...this.usuarios];
          this.guardando = false;
          this.cancelarEdicion();
          this.aplicarFiltro();
          await this.showToast('Usuario creado correctamente.');
        },
        error: async (err) => {
          console.error(err);
          this.guardando = false;
          await this.showToast('No se pudo crear el usuario.', 'danger');
        },
      });
    }
    // EDITAR
    else {
      const id = this.editingUser.id;
      this.usuariosService.actualizarUsuario(id, payload).subscribe({
        next: async () => {
          this.usuarios = this.usuarios.map((u) =>
            u.id === id ? { ...u, ...payload } : u
          );
          this.guardando = false;
          this.cancelarEdicion();
          this.aplicarFiltro();
          await this.showToast('Usuario actualizado.');
        },
        error: async (err) => {
          console.error(err);
          this.guardando = false;
          await this.showToast('No se pudo actualizar el usuario.', 'danger');
        },
      });
    }
  }

  // ====== Búsqueda / filtro ======
  aplicarFiltro(): void {
    const q = this.search.trim().toLowerCase();

    if (!q) {
      this.usuariosFiltrados = [...this.usuarios];
      return;
    }

    this.usuariosFiltrados = this.usuarios.filter((u) => {
      const nombre = (u.nombre || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const rol = (u.rol || '').toLowerCase();
      return (
        nombre.includes(q) ||
        email.includes(q) ||
        rol.includes(q)
      );
    });
  }

  // ====== Eliminar ======
  async eliminarUsuario(u: Usuario): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar usuario',
      message: `¿Seguro que deseas eliminar a <strong>${u.nombre}</strong>?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => this.doEliminar(u),
        },
      ],
    });
    await alert.present();
  }

  private doEliminar(u: Usuario): void {
    this.usuariosService.eliminarUsuario(u.id).subscribe({
      next: async () => {
        this.usuarios = this.usuarios.filter((x) => x.id !== u.id);
        this.aplicarFiltro();
        await this.showToast('Usuario eliminado.');
      },
      error: async (err) => {
        console.error(err);
        await this.showToast('No se pudo eliminar el usuario.', 'danger');
      },
    });
  }

  // ====== Reset de contraseña ======
  async resetPassword(u: Usuario): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Resetear contraseña',
      message:
        'Puedes dejar vacío para que el sistema genere una contraseña temporal.',
      inputs: [
        {
          name: 'password',
          type: 'text',
          placeholder: 'Nueva contraseña (opcional)',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Aceptar',
          handler: (data) => {
            const pass = data?.password?.trim() || undefined;
            this.usuariosService.resetPassword(u.id, pass).subscribe({
              next: async (resp) => {
                const temp = resp?.tempPassword;
                await this.showToast(
                  temp
                    ? `Contraseña temporal: ${temp}`
                    : 'Contraseña reseteada.',
                  'medium',
                  6000
                );
              },
              error: async (err) => {
                console.error(err);
                await this.showToast(
                  'No se pudo resetear la contraseña.',
                  'danger'
                );
              },
            });
          },
        },
      ],
    });

    await alert.present();
  }

  // ====== Util ======
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
