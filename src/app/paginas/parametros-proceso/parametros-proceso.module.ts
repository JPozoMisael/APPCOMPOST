import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { SharedModule } from 'src/app/shared/shared-module';
import { ParametrosProcesoPageRoutingModule } from './parametros-proceso-routing.module';

import { ParametrosProcesoPage } from './parametros-proceso.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReactiveFormsModule,
    SharedModule,
    ParametrosProcesoPageRoutingModule
  ],
  declarations: [ParametrosProcesoPage]
})
export class ParametrosProcesoPageModule {}
