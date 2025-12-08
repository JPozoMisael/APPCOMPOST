export interface Sensor{
    id: string;
    nombre: string;
    tipo: string;
    ubicacion: string;
    activo: boolean;
    ultimaLectura?: string;
}