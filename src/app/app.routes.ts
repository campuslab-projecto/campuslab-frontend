
import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';

import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login').then(m => m.Login)
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [MsalGuard]
  },
  {
    path: 'bookings',
    loadComponent: () =>
      import('./pages/bookings/bookings').then(m => m.Bookings),
    canActivate: [MsalGuard]
  },
  {
    path: 'rabbit-admin',
    loadComponent: () =>
      import('./pages/rabbit-admin/rabbit-admin')
        .then(m => m.RabbitAdmin),
    canActivate: [MsalGuard, adminGuard]
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
