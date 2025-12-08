// src/app/model/usuario.ts
export type RolUsuario = 'administrador' | 'tecnico' | 'estandar';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: RolUsuario;
}
