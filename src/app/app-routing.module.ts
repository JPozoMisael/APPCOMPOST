import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard } from './guard/auth.guard';
import { SelectivePreloadingStrategy } from './core/selective-preloading';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () =>
      import('./home/home.module').then((m) => m.HomePageModule),
  },
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./paginas/auth/auth.module').then((m) => m.AuthPageModule),
  },
  {
    path: 'registro',
    loadChildren: () =>
      import('./paginas/registro/registro.module').then(
        (m) => m.RegistroPageModule
      ),
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./paginas/dashboard/dashboard.module').then(
        (m) => m.DashboardPageModule
      ),
    canActivate: [authGuard],
    data: { roles: ['usuario', 'tecnico', 'administrador'] },
  },
  {
    path: 'monitoreo',
    loadChildren: () =>
      import('./paginas/monitoreo/monitoreo.module').then(
        (m) => m.MonitoreoPageModule
      ),
    canActivate: [authGuard],
    data: { roles: ['usuario', 'tecnico', 'administrador'] },
  },
  {
    path: 'graficas',
    loadChildren: () =>
      import('./paginas/graficas/graficas.module').then(
        (m) => m.GraficasPageModule
      ),
    canActivate: [authGuard],
    data: { roles: ['usuario', 'tecnico', 'administrador'] },
  },
  {
    path: 'perfil',
    loadChildren: () =>
      import('./paginas/perfil/perfil.module').then(
        (m) => m.PerfilPageModule
      ),
    canActivate: [authGuard],
    data: { roles: ['usuario', 'tecnico', 'administrador'] },
  },
  {
    path: 'notificaciones',
    loadChildren: () =>
      import('./paginas/notificaciones/notificaciones.module').then(
        (m) => m.NotificacionesPageModule
      ),
    canActivate: [authGuard],
    data: { roles: ['usuario', 'tecnico', 'administrador'] },
  },
  {
    path: 'admin-usuarios',
    loadChildren: () =>
      import('./paginas/admin-usuarios/admin-usuarios.module').then(
        (m) => m.AdminUsuariosPageModule
      ),
    canActivate: [authGuard],
    data: { roles: ['administrador'] },
  },
  {
    path: 'admin-auditoria',
    loadChildren: () =>
      import('./paginas/admin-auditoria/admin-auditoria.module').then(
        (m) => m.AdminAuditoriaPageModule
      ),
    canActivate: [authGuard],
    data: { roles: ['administrador'] },
  },
  {
    path: 'explorador-datos',
    loadChildren: () =>
      import('./paginas/explorador-datos/explorador-datos.module').then(
        (m) => m.ExploradorDatosPageModule
      ),
    canActivate: [authGuard],
    data: { roles: ['tecnico', 'administrador'] },
  },
  {
    path: 'parametros-proceso',
    loadChildren: () =>
      import('./paginas/parametros-proceso/parametros-proceso.module').then(
        (m) => m.ParametrosProcesoPageModule
      ),
    canActivate: [authGuard],
    data: { roles: ['tecnico', 'administrador'] },
  },
  {
    path: 'cambiar-password',
    loadChildren: () =>
      import('./paginas/cambiar-password/cambiar-password.module').then(
        (m) => m.CambiarPasswordPageModule
      ),
    canActivate: [authGuard],
    data: { roles: ['usuario', 'tecnico', 'administrador'] },
  },
  {
    path: 'config-sistema',
    loadChildren: () => import('./paginas/config-sistema/config-sistema.module').then( m => m.ConfigSistemaPageModule),
    canActivate: [authGuard],
    data: { roles: ['usuario', 'tecnico', 'administrador'] },
  },
  {
    path: 'historial',
    loadChildren: () => import('./paginas/historial/historial.module').then( m => m.HistorialPageModule),
    canActivate: [authGuard],
    data: { roles: ['usuario', 'tecnico', 'administrador'] },
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
