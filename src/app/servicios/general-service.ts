import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class GeneralService {
  private readonly base = String(environment.apiBaseUrl || '').replace(/\/$/, '');

  constructor(private http: HttpClient) {}

  /** 'auth/login' -> 'http://localhost:3000/auth/login'. Si ya es http(s), se respeta tal cual. */
  private toApiUrl(path: string): string {
    if (!path) return this.base || '';
    if (/^https?:\/\//i.test(path)) return path; // ya es absoluta
    const p = path.replace(/^\//, '');           // quita leading slash
    return this.base ? `${this.base}/${p}` : `/${p}`;
  }

  get<T>(path: string, options?: { params?: any; headers?: HttpHeaders }): Observable<T> {
    return this.http.get<T>(this.toApiUrl(path), options);
  }

  post<T>(path: string, body: any, options?: { params?: any; headers?: HttpHeaders }): Observable<T> {
    return this.http.post<T>(this.toApiUrl(path), body, options);
  }

  put<T>(path: string, body: any, options?: { params?: any; headers?: HttpHeaders }): Observable<T> {
    return this.http.put<T>(this.toApiUrl(path), body, options);
  }
  patch<T>(path: string, body: any, options?: { params?: any; headers?: HttpHeaders }): Observable<T> {
    return this.http.patch<T>(this.toApiUrl(path), body, options);
  }

  delete<T>(path: string, options?: { params?: any; headers?: HttpHeaders }): Observable<T> {
    return this.http.delete<T>(this.toApiUrl(path), options);
  }

  getArchivo(path: string, params?: any): Observable<Blob> {
    return this.http.get(this.toApiUrl(path), { params, responseType: 'blob' });
  }
}
