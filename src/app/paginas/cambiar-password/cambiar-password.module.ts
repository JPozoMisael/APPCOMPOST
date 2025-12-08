import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { SharedModule } from 'src/app/shared/shared-module';
import { CambiarPasswordPageRoutingModule } from './cambiar-password-routing.module';

import { CambiarPasswordPage } from './cambiar-password.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReactiveFormsModule,
    SharedModule,
    CambiarPasswordPageRoutingModule
  ],
  declarations: [CambiarPasswordPage]
})
export class CambiarPasswordPageModule {}
