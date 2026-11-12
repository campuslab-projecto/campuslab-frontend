
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';

import {
  provideHttpClient,
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS
} from '@angular/common/http';

import {
  IPublicClientApplication,
  PublicClientApplication,
  InteractionType
} from '@azure/msal-browser';

import {
  MsalGuard,
  MsalInterceptor,
  MsalBroadcastService,
  MsalInterceptorConfiguration,
  MsalModule,
  MsalService,
  MSAL_GUARD_CONFIG,
  MSAL_INSTANCE,
  MSAL_INTERCEPTOR_CONFIG,
  MsalGuardConfiguration
} from '@azure/msal-angular';

import { routes } from './app.routes';

import {
  msalConfig,
  protectedResources,
  loginRequest
} from './auth-config';


// Crear la instancia de Microsoft MSAL
export function MSALInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication(msalConfig);
}


// Configurar la protección de las rutas Angular
export function MSALGuardConfigFactory(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: loginRequest,
    loginFailedRoute: '/login'
  };
}


// Configurar el interceptor que agrega el token JWT
export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {

  const protectedResourceMap = new Map<string, Array<string>>();

  // Endpoint exacto de reservas
  protectedResourceMap.set(
    `${protectedResources.api.endpoint}bookings`,
    protectedResources.api.scopes
  );

  // Todas las subrutas de CampusLab:
  // /api/bookings/1/status, /api/rabbit/queues, etc.
  protectedResourceMap.set(
    `${protectedResources.api.endpoint}*`,
    protectedResources.api.scopes
  );

  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap
  };
}


// Configuración principal de Angular
export const appConfig: ApplicationConfig = {
  providers: [

    provideRouter(routes),

    provideHttpClient(withInterceptorsFromDi()),

    importProvidersFrom(MsalModule),

    {
      provide: MSAL_INSTANCE,
      useFactory: MSALInstanceFactory
    },

    {
      provide: MSAL_GUARD_CONFIG,
      useFactory: MSALGuardConfigFactory
    },

    {
      provide: MSAL_INTERCEPTOR_CONFIG,
      useFactory: MSALInterceptorConfigFactory
    },

    {
      provide: HTTP_INTERCEPTORS,
      useClass: MsalInterceptor,
      multi: true
    },

    MsalService,
    MsalGuard,
    MsalBroadcastService
  ]
};
