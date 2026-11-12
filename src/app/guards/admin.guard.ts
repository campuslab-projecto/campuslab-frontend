
import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router
} from '@angular/router';

import { MsalService } from '@azure/msal-angular';
import { catchError, map, of } from 'rxjs';

import { protectedResources } from '../auth-config';

export const adminGuard: CanActivateFn = () => {

  const msal = inject(MsalService);
  const router = inject(Router);

  const account =
    msal.instance.getActiveAccount() ??
    msal.instance.getAllAccounts()[0];

  if (!account) {
    return router.createUrlTree(['/login']);
  }

  return msal.acquireTokenSilent({
    account,
    scopes: protectedResources.api.scopes
  }).pipe(

    map(result => {
      try {
        const payload = result.accessToken.split('.')[1];

        const normalized = payload
          .replace(/-/g, '+')
          .replace(/_/g, '/');

        const padded = normalized.padEnd(
          Math.ceil(normalized.length / 4) * 4,
          '='
        );

        const claims = JSON.parse(atob(padded));

        const roles: string[] = Array.isArray(claims.roles)
          ? claims.roles
          : [];

        const isAdmin = roles.some(role => {
          const clean = role
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toUpperCase();

          return clean === 'ADMIN' ||
                 clean === 'ADMINISTRADOR';
        });

        return isAdmin
          ? true
          : router.createUrlTree(['/dashboard']);

      } catch {
        return router.createUrlTree(['/dashboard']);
      }
    }),

    catchError(() =>
      of(router.createUrlTree(['/dashboard']))
    )
  );
};
