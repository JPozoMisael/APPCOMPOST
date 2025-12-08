import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared-module';
import { IonicModule } from '@ionic/angular';

import { AdminUsuariosPageRoutingModule } from './admin-usuarios-routing.module';

import { AdminUsuariosPage } from './admin-usuarios.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    AdminUsuariosPageRoutingModule,
    SharedModule
  ],
  declarations: [AdminUsuariosPage]
})
export class AdminUsuariosPageModule {}
