import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DashboardPageRoutingModule } from './dashboard-routing.module';
import { SharedModule } from 'src/app/shared/shared-module';
import { DashboardPage } from './dashboard.page';
import { EsquemaComposteraComponent } from 'src/app/component/esquema-compostera/esquema-compostera.component';
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DashboardPageRoutingModule,
    SharedModule
  ],
  declarations: [DashboardPage, EsquemaComposteraComponent]
})
export class DashboardPageModule {}
