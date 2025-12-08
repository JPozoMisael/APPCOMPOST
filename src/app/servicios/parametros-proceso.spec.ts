import { TestBed } from '@angular/core/testing';

import { ParametrosProceso } from './parametros-proceso';

describe('ParametrosProceso', () => {
  let service: ParametrosProceso;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ParametrosProceso);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
