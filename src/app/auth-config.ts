
import {
  Configuration,
  BrowserCacheLocation,
  LogLevel
} from '@azure/msal-browser';

// ==========================================
// ORIGEN ACTUAL DEL FRONTEND
// ==========================================

const currentOrigin = window.location.origin;

// ==========================================
// SELECCION AUTOMATICA DEL ENTORNO
// ==========================================

// Si CampusLab se ejecuta localmente,
// utilizamos el BFF de IntelliJ.
//
// Si está desplegado en AWS Amplify,
// utilizamos API Gateway.

const isLocalEnvironment =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

const LOCAL_API_URL =
  'http://localhost:8080/api/';

const PRODUCTION_API_URL =
  'https://ok83lxm1s3.execute-api.us-east-1.amazonaws.com/api/';

const API_URL = PRODUCTION_API_URL;

// ==========================================
// MICROSOFT ENTRA ID / MSAL
// ==========================================

export const msalConfig: Configuration = {
  auth: {
    clientId: '8902fa8d-4f71-4cd9-9a43-ddd5486e7327',

    authority:
      'https://login.microsoftonline.com/902cf874-0ee4-4917-b9cb-6b55af9993be',

    redirectUri: currentOrigin,

    postLogoutRedirectUri: currentOrigin
  },

  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage
  },

  system: {
    loggerOptions: {
      loggerCallback: (
        level,
        message,
        containsPii
      ) => {
        if (!containsPii) {
          console.log(message);
        }
      },

      logLevel: LogLevel.Info
    }
  }
};

// ==========================================
// RECURSOS PROTEGIDOS
// ==========================================

export const protectedResources = {
  api: {
    endpoint: API_URL,

    scopes: [
      'api://36ccc99d-6294-4333-a064-d62fa6237c7c/access_as_user'
    ]
  }
};

// ==========================================
// SOLICITUD DE LOGIN
// ==========================================

export const loginRequest = {
  scopes: protectedResources.api.scopes
};
