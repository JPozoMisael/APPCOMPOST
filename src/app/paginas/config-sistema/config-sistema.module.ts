import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { SharedModule } from 'src/app/shared/shared-module';

import { ConfigSistemaPageRoutingModule } from './config-sistema-routing.module';

import { ConfigSistemaPage } from './config-sistema.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    IonicModule,
    ConfigSistemaPageRoutingModule
  ],
  declarations: [ConfigSistemaPage]
})
export class ConfigSistemaPageModule {}
