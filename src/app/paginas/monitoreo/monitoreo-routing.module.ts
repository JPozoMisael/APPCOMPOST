import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MonitoreoPage } from './monitoreo.page';

const routes: Routes = [
  {
    path: '',
    component: MonitoreoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MonitoreoPageRoutingModule {}
