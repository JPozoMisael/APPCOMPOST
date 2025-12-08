import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared-module';
import { IonicModule } from '@ionic/angular';

import { ExploradorDatosPageRoutingModule } from './explorador-datos-routing.module';

import { ExploradorDatosPage } from './explorador-datos.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    ExploradorDatosPageRoutingModule
  ],
  declarations: [ExploradorDatosPage]
})
export class ExploradorDatosPageModule {}
