
import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';

import { adminGuard } from './guards/admin.guard';
import { auditGuard } from './guards/audit.guard';

export const routes: Routes = [

  // LOGIN
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login')
        .then(m => m.Login)
  },

  // DASHBOARD
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard')
        .then(m => m.Dashboard),
    canActivate: [MsalGuard]
  },

  // RESERVAS
  {
    path: 'bookings',
    loadComponent: () =>
      import('./pages/bookings/bookings')
        .then(m => m.Bookings),
    canActivate: [MsalGuard]
  },

  // RABBITMQ ADMIN
  {
    path: 'rabbit-admin',
    loadComponent: () =>
      import('./pages/rabbit-admin/rabbit-admin')
        .then(m => m.RabbitAdmin),
    canActivate: [MsalGuard, adminGuard]
  },

  // AUDITORÍA
  {
    path: 'audit',
    loadComponent: () =>
      import('./pages/audit/audit')
        .then(m => m.Audit),
    canActivate: [MsalGuard, auditGuard]
  },

  // REDIRECCIÓN INICIAL
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },

  // RUTA DESCONOCIDA
  {
    path: '**',
    redirectTo: 'dashboard'
  }

];
