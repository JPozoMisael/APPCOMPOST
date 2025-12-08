import { TestBed } from '@angular/core/testing';

import { HealhtService } from './healht-service';

describe('HealhtService', () => {
  let service: HealhtService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HealhtService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
