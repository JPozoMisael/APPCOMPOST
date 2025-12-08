import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { SharedModule } from 'src/app/shared/shared-module';
import { MonitoreoPageRoutingModule } from './monitoreo-routing.module';

import { MonitoreoPage } from './monitoreo.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MonitoreoPageRoutingModule,
    SharedModule
  ],
  declarations: [MonitoreoPage]
})
export class MonitoreoPageModule {}
