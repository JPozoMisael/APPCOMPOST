import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/servicios/auth-service';
const ROLES = ['ADMINISTRADOR', 'TECNICO', 'ESTANDAR'] as const;
type RolAPI = typeof ROLES[number];

function normalizarRol(input: string | null | undefined): RolAPI {
  const v = String(input || '').trim().toUpperCase();

  return (ROLES as readonly string[]).includes(v) ? (v as RolAPI) : 'ESTANDAR';
}

@Component({
  selector: 'app-registro',
  templateUrl: './registro.page.html',
  styleUrls: ['./registro.page.scss'],
  standalone: false,
})
export class RegistroPage implements OnInit {
  datosRegistro = {
    nombre: '',
    email: '',
    password: '',
    repetirPassword: '',
    rol: 'ESTANDAR', 
  };
  rolesDisponibles: RolAPI[] = ['ADMINISTRADOR', 'TECNICO', 'ESTANDAR'];

  verPassword = false;
  verRepetir = false;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
  }
  registrar() {
    const { nombre, email, password, repetirPassword } = this.datosRegistro;
    const rol: RolAPI = normalizarRol(this.datosRegistro.rol);

    if (!nombre || !email || !password || !repetirPassword || !rol) {
      alert('Completa todos los campos');
      return;
    }

    if (password !== repetirPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    console.log('Datos enviados al registrar:', { nombre, email, password, rol });

    this.authService.register({ nombre, email, password, rol }).subscribe({
      next: () => {
        alert('Registro exitoso. Ahora puedes iniciar sesión.');
        this.router.navigate(['/auth']);
      },
      error: (error) => {
        console.log('Error en el registro', error);
        alert('Error en el registro');
      },
    });
  }

  togglePassword(type: 'password' | 'repetir') {
    if (type === 'password') {
      this.verPassword = !this.verPassword;
    } else {
      this.verRepetir = !this.verRepetir;
    }
  }
}
