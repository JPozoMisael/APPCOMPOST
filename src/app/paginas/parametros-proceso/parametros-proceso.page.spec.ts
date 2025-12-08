import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ParametrosProcesoPage } from './parametros-proceso.page';

describe('ParametrosProcesoPage', () => {
  let component: ParametrosProcesoPage;
  let fixture: ComponentFixture<ParametrosProcesoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ParametrosProcesoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
