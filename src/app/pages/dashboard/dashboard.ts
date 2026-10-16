import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MsalService } from '@azure/msal-angular';
import { protectedResources } from '../../auth-config';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit {

  name = 'Usuario';
  username = '';

  roles = signal<string[]>([]);
  scopes = signal<string[]>([]);
  audience = signal<string>('');

  constructor(
    private msalService: MsalService
  ) {}

  ngOnInit(): void {
    const account =
      this.msalService.instance.getActiveAccount() ??
      this.msalService.instance.getAllAccounts()[0];

    if (!account) {
      console.warn('No hay una cuenta activa en MSAL.');
      return;
    }

    this.name = account.name || 'Usuario';
    this.username = account.username || '';

    this.loadApiTokenInformation(account);
  }

  private loadApiTokenInformation(account: any): void {
    this.msalService.acquireTokenSilent({
      account,
      scopes: protectedResources.api.scopes
    }).subscribe({
      next: result => {
        const claims = this.decodeJwtPayload(result.accessToken);

        console.log(
          'Claims del Access Token CampusLab-API:',
          claims
        );

        const tokenRoles: string[] =
          Array.isArray(claims?.roles)
            ? claims.roles.map((role: any) => String(role))
            : claims?.roles
              ? [String(claims.roles)]
              : [];

        const tokenScopes: string[] =
          claims?.scp
            ? String(claims.scp)
                .split(' ')
                .filter(scope => scope.trim().length > 0)
            : (result.scopes || []).map(scope => {
                const parts = scope.split('/');
                return parts[parts.length - 1];
              });

        const tokenAudience =
          claims?.aud
            ? String(claims.aud)
            : '';

        this.roles.set(tokenRoles);
        this.scopes.set(tokenScopes);
        this.audience.set(tokenAudience);

        console.log('Roles mostrados:', this.roles());
        console.log('Scopes mostrados:', this.scopes());
        console.log('Audience mostrado:', this.audience());
      },

      error: error => {
        console.error(
          'No fue posible obtener el Access Token de CampusLab-API:',
          error
        );

        const idClaims: any =
          account.idTokenClaims || {};

        const fallbackRoles: string[] =
          Array.isArray(idClaims.roles)
            ? idClaims.roles.map((role: any) => String(role))
            : idClaims.roles
              ? [String(idClaims.roles)]
              : [];

        const fallbackScopes: string[] =
          idClaims.scp
            ? String(idClaims.scp)
                .split(' ')
                .filter((scope: string) => scope.trim().length > 0)
            : [];

        const fallbackAudience =
          idClaims.aud
            ? String(idClaims.aud)
            : '';

        this.roles.set(fallbackRoles);
        this.scopes.set(fallbackScopes);
        this.audience.set(fallbackAudience);

        console.log('Fallback - Roles:', this.roles());
        console.log('Fallback - Scopes:', this.scopes());
        console.log('Fallback - Audience:', this.audience());
      }
    });
  }

  private decodeJwtPayload(token: string): any {
    try {
      const parts = token.split('.');

      if (parts.length < 2) {
        console.error(
          'El Access Token no tiene formato JWT válido.'
        );
        return {};
      }

      const payload = parts[1];

      const normalizedPayload =
        payload
          .replace(/-/g, '+')
          .replace(/_/g, '/');

      const paddedPayload =
        normalizedPayload +
        '='.repeat(
          (4 - normalizedPayload.length % 4) % 4
        );

      const decodedPayload =
        decodeURIComponent(
          atob(paddedPayload)
            .split('')
            .map(character =>
              '%' +
              (
                '00' +
                character
                  .charCodeAt(0)
                  .toString(16)
              ).slice(-2)
            )
            .join('')
        );

      return JSON.parse(decodedPayload);

    } catch (error) {
      console.error(
        'Error decodificando Access Token:',
        error
      );
      return {};
    }
  }
}