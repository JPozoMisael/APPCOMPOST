import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonitoreoPage } from './monitoreo.page';

describe('MonitoreoPage', () => {
  let component: MonitoreoPage;
  let fixture: ComponentFixture<MonitoreoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MonitoreoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
