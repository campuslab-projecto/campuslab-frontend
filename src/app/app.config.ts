
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


// ==========================================
// 1. CREAR INSTANCIA DE MICROSOFT MSAL
// ==========================================

export function MSALInstanceFactory(): IPublicClientApplication {

  return new PublicClientApplication(msalConfig);

}


// ==========================================
// 2. PROTEGER LAS RUTAS DE ANGULAR
// ==========================================

export function MSALGuardConfigFactory(): MsalGuardConfiguration {

  return {
    interactionType: InteractionType.Redirect,
    authRequest: loginRequest,
    loginFailedRoute: '/login'
  };

}


// ==========================================
// 3. CONFIGURAR INTERCEPTOR JWT
// ==========================================

export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {

  const protectedResourceMap = new Map<string, Array<string>>();

  // ------------------------------------------
  // RESERVAS EN AWS
  // ------------------------------------------

  protectedResourceMap.set(
    `${protectedResources.api.endpoint}bookings`,
    protectedResources.api.scopes
  );


  // ------------------------------------------
  // TODAS LAS SUBRUTAS DEL BFF EN AWS
  // Reservas, RabbitMQ, etc.
  // ------------------------------------------

  protectedResourceMap.set(
    `${protectedResources.api.endpoint}*`,
    protectedResources.api.scopes
  );


  // ------------------------------------------
  // AUDITORIA EN EL BFF LOCAL
  // http://localhost:8080/api/audit
  // ------------------------------------------

  protectedResourceMap.set(
    'http://localhost:8080/api/audit*',
    protectedResources.api.scopes
  );


  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap
  };

}


// ==========================================
// 4. CONFIGURACION PRINCIPAL DE ANGULAR
// ==========================================

export const appConfig: ApplicationConfig = {

  providers: [

    // Rutas de Angular
    provideRouter(routes),

    // Cliente HTTP con interceptores
    provideHttpClient(withInterceptorsFromDi()),

    // Modulo de Microsoft MSAL
    importProvidersFrom(MsalModule),

    // Instancia MSAL
    {
      provide: MSAL_INSTANCE,
      useFactory: MSALInstanceFactory
    },

    // Configuracion de rutas protegidas
    {
      provide: MSAL_GUARD_CONFIG,
      useFactory: MSALGuardConfigFactory
    },

    // Configuracion del interceptor JWT
    {
      provide: MSAL_INTERCEPTOR_CONFIG,
      useFactory: MSALInterceptorConfigFactory
    },

    // Registrar interceptor MSAL
    {
      provide: HTTP_INTERCEPTORS,
      useClass: MsalInterceptor,
      multi: true
    },

    // Servicios MSAL
    MsalService,
    MsalGuard,
    MsalBroadcastService

  ]

};
