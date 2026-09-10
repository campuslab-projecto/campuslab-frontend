import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { App } from './app';

export const routes: Routes = [
  { path: 'dashboard', component: App, canActivate: [MsalGuard] },
  { path: 'bookings', component: App, canActivate: [MsalGuard] },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];