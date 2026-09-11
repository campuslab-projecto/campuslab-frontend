import { Configuration, BrowserCacheLocation, LogLevel } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: '8902fa8d-4f71-4cd9-9a43-ddd5486e7327',
    authority: 'https://login.microsoftonline.com/902cf874-0ee4-4917-b9cb-6b55af9993be',
    redirectUri: 'http://localhost:4200',
    postLogoutRedirectUri: 'http://localhost:4200'
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (!containsPii) console.log(message);
      },
      logLevel: LogLevel.Info
    }
  }
};

export const protectedResources = {
  api: {
    endpoint: 'http://localhost:8080/api/',
    scopes: ['api://36ccc99d-6294-4333-a064-d62fa6237c7c/access_as_user']
  }
};

export const loginRequest = {
  scopes: protectedResources.api.scopes
};