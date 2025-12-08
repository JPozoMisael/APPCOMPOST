import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { ConfigSistemaService } from './config-sistema';

describe('ConfigSistemaService', () => {
  let service: ConfigSistemaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ConfigSistemaService],
    });
    service = TestBed.inject(ConfigSistemaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
