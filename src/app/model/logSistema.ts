export interface LogSistema {
    fecha: string;
    tipo: 'info' | 'error' | 'advertencia' | 'administracion';
    descripcion: string;
    usuario: string;
}