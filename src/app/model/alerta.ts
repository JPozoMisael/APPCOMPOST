export interface Alerta {
  id: string;
  tipo: string;        
  descripcion: string;
  fecha: string;
  critico: boolean;
  leida: boolean
}