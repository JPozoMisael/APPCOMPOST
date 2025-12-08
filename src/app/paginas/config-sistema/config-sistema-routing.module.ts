import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ConfigSistemaPage } from './config-sistema.page';

const routes: Routes = [
  {
    path: '',
    component: ConfigSistemaPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ConfigSistemaPageRoutingModule {}
