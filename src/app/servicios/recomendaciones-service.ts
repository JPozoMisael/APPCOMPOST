import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class RecomendacionesService {
private baseUrl = 'http://localhost:3000/api/fuzzy';
  constructor(private http: HttpClient) { }


    getRecomendaciones(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}`);
  }

  aplicarAccion(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/aplicar/${id}`, {});
  }
}
