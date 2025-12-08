import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { SharedModule } from 'src/app/shared/shared-module'; 
import { AdminAuditoriaPageRoutingModule } from './admin-auditoria-routing.module';

import { AdminAuditoriaPage } from './admin-auditoria.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    AdminAuditoriaPageRoutingModule
  ],
  declarations: [AdminAuditoriaPage]
})
export class AdminAuditoriaPageModule {}
