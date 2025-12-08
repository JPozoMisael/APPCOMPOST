import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly apiBase = String(environment.apiBaseUrl || '').replace(/\/$/, '');
  private readonly apiBaseOrigin: string | null = this.apiBase.startsWith('http')
    ? new URL(this.apiBase).origin
    : null;
  private readonly apiBasePath: string = this.apiBase.startsWith('http')
    ? new URL(this.apiBase).pathname
    : (this.apiBase || '');

  constructor(private router: Router) {}

  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private isLocalAsset(url: string): boolean {
    return url.startsWith('/assets/') || url.startsWith('assets/')
      || url.endsWith('.svg') || url.endsWith('.png')
      || url.endsWith('.jpg') || url.endsWith('.json');
  }

  private toPathname(url: string): string {
    try {
      return /^https?:\/\//i.test(url) ? new URL(url).pathname : url;
    } catch {
      return url;
    }
  }

  private isApiUrl(url: string): boolean {
    if (!url || this.isLocalAsset(url)) return false;

    const isAbsolute = /^https?:\/\//i.test(url);

    if (!isAbsolute) {
      // relativa → trátala como API (útil con proxy '/api')
      return true;
    }

    if (this.apiBaseOrigin) {
      try {
        const req = new URL(url);
        return req.origin === this.apiBaseOrigin && req.pathname.startsWith(this.apiBasePath || '/');
      } catch {
        return false;
      }
    }

    // apiBase relativo + URL absoluta (CDN, etc.) → no es API
    return false;
  }

  private isAuthEndpoint(url: string): boolean {
    const u = this.toPathname(url);
    return u.includes('/auth/auth') || u.includes('/auth/register') || u.includes('/auth/recover');
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let outgoing = req;

    const token = this.getToken();
    const fromApi = this.isApiUrl(req.url);
    const isAuth = this.isAuthEndpoint(req.url);

    if (token && fromApi && !isAuth && !req.headers.has('Authorization')) {
      outgoing = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }

    return next.handle(outgoing).pipe(
      catchError((err: HttpErrorResponse) => {
        if ((err.status === 401 || err.status === 403) && fromApi && !isAuth) {
          localStorage.removeItem('token');
          const returnUrl = encodeURIComponent(location.pathname + location.search);
          this.router.navigateByUrl(`/auth?returnUrl=${returnUrl}`);
        }
        return throwError(() => err);
      })
    );
  }
}
