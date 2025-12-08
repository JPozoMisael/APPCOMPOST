import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { SharedModule } from 'src/app/shared/shared-module';
import { GraficasPageRoutingModule } from './graficas-routing.module';

import { GraficasPage } from './graficas.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GraficasPageRoutingModule,
    SharedModule
  ],
  declarations: [GraficasPage]
})
export class GraficasPageModule {}
