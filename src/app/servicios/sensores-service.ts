import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Lectura } from '../model/lectura';
import { GeneralService } from './general-service';
@Injectable({
  providedIn: 'root'
})
export class SensoresService {
  
  constructor(private generalService: GeneralService) { }

  getLecturasActuales(): Observable<Lectura[]> {
  return this.generalService.get<Lectura[]>('sensor/listar');
}

getHistorial(params: {fecha: string; variable:string}): Observable<Lectura[]> {
  return this.generalService.get<Lectura[]>('sensor/historial', { params });
}


  addDispositivo(data:any): Observable<any>{
    return this.generalService.post('dispositivos', data);
  }

  deleteDispositivo(id:string): Observable<any>{
    return this.generalService.delete(`dispositivos/${id}`);
  }
  getSensores(): Observable<any[]> {
  return this.generalService.get<any[]>('dispositivos');
}
eliminarSensor(id: string): Observable<any> {
  return this.generalService.delete(`dispositivos/${id}`);
}


}
