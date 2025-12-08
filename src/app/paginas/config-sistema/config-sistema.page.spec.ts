import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfigSistemaPage } from './config-sistema.page';

describe('ConfigSistemaPage', () => {
  let component: ConfigSistemaPage;
  let fixture: ComponentFixture<ConfigSistemaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ConfigSistemaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
