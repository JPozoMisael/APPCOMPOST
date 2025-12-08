import { TestBed } from '@angular/core/testing';

import { SensoresService } from './sensores-service';

describe('SensoresService', () => {
  let service: SensoresService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SensoresService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
