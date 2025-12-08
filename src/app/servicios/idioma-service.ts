import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class IdiomaService {
  private idiomaActual = new BehaviorSubject<string>('es');
  idioma$ = this.idiomaActual.asObservable();
  constructor(private translate: TranslateService) { 
    const idiomaGuardado = localStorage.getItem('idioma') || 'es';
    this.translate.setDefaultLang('es');
    this.translate.use(idiomaGuardado);
    this.idiomaActual.next(idiomaGuardado);
  }

  cambiarIdioma(idioma: string){
    this.translate.use(idioma);
    localStorage.setItem('idioma', idioma);
    this.idiomaActual.next(idioma);
  }

  obtenerIdiomaActual(): string {
    return this.idiomaActual.value;
  }

}
