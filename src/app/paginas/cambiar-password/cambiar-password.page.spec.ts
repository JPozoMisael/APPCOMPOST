import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CambiarPasswordPage } from './cambiar-password.page';

describe('CambiarPasswordPage', () => {
  let component: CambiarPasswordPage;
  let fixture: ComponentFixture<CambiarPasswordPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CambiarPasswordPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
