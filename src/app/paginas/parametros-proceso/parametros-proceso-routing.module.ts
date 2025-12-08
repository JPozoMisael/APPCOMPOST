import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ParametrosProcesoPage } from './parametros-proceso.page';

const routes: Routes = [
  {
    path: '',
    component: ParametrosProcesoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ParametrosProcesoPageRoutingModule {}
