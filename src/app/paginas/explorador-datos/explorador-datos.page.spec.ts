import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExploradorDatosPage } from './explorador-datos.page';

describe('ExploradorDatosPage', () => {
  let component: ExploradorDatosPage;
  let fixture: ComponentFixture<ExploradorDatosPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ExploradorDatosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
