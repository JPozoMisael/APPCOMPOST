import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ExploradorDatosPage } from './explorador-datos.page';

const routes: Routes = [
  {
    path: '',
    component: ExploradorDatosPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ExploradorDatosPageRoutingModule {}
