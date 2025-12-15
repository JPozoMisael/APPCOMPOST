import { TestBed } from '@angular/core/testing';

import { NotificacionesMovil } from './notificaciones-movil';

describe('NotificacionesMovil', () => {
  let service: NotificacionesMovil;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificacionesMovil);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
