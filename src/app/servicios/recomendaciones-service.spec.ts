import { TestBed } from '@angular/core/testing';

import { RecomendacionesService } from './recomendaciones-service';

describe('RecomendacionesService', () => {
  let service: RecomendacionesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RecomendacionesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
