
import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive
} from '@angular/router';

import { MsalService } from '@azure/msal-angular';
import { AccountInfo } from '@azure/msal-browser';

import { protectedResources } from './auth-config';

type CampusRole =
  | 'ESTUDIANTE'
  | 'TECNICO'
  | 'ADMIN'
  | 'AUDITOR';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  initialized = false;

  userName = '';
  userEmail = '';

  userRoles: CampusRole[] = [];

  constructor(
    private msalService: MsalService,
    private cdr: ChangeDetectorRef
  ) {}

  // =========================================
  // 1. INICIALIZAR MICROSOFT
  // =========================================

  async ngOnInit(): Promise<void> {

    try {

      await this.msalService.instance.initialize();

      const response =
        await this.msalService.instance.handleRedirectPromise();

      if (response?.account) {

        this.msalService.instance.setActiveAccount(
          response.account
        );

      } else {

        const accounts =
          this.msalService.instance.getAllAccounts();

        if (accounts.length > 0) {

          this.msalService.instance.setActiveAccount(
            accounts[0]
          );

        }
      }

      this.loadUserInformation();

    } catch (error) {

      console.error(
        'Error inicializando Microsoft:',
        error
      );

    } finally {

      this.initialized = true;
      this.cdr.markForCheck();

    }
  }

  // =========================================
  // 2. OBTENER INFORMACION DEL USUARIO
  // =========================================

  loadUserInformation(): void {

    const account: AccountInfo | null =
      this.msalService.instance.getActiveAccount() ??
      this.msalService.instance.getAllAccounts()[0] ??
      null;

    if (!account) {

      this.userName = '';
      this.userEmail = '';
      this.userRoles = [];

      this.cdr.markForCheck();

      return;
    }

    this.userName = account.name || 'Usuario';
    this.userEmail = account.username || '';

    // Solicitamos el Access Token de CampusLab-API
    this.msalService.acquireTokenSilent({

      account,

      scopes: protectedResources.api.scopes

    }).subscribe({

      next: (result) => {

        const claims =
          this.decodeJwtPayload(result.accessToken);

        // Los roles vienen en la claim "roles"
        const tokenRoles: string[] =
          Array.isArray(claims?.roles)
            ? claims.roles.map((role: unknown) => String(role))
            : claims?.roles
              ? [String(claims.roles)]
              : [];

        this.userRoles = [
          ...new Set(
            tokenRoles
              .map(role => this.normalizeRole(role))
              .filter((role): role is CampusRole => role !== null)
          )
        ];

        console.log(
          'Roles identificados:',
          this.userRoles
        );

        this.cdr.markForCheck();
      },

      error: (error) => {

        console.error(
          'No fue posible obtener los roles de CampusLab-API:',
          error
        );

        this.userRoles = [];

        this.cdr.markForCheck();
      }

    });
  }

  // =========================================
  // 3. NORMALIZAR NOMBRES DE ROLES
  // =========================================

  private normalizeRole(role: string): CampusRole | null {

    const normalized = role
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    switch (normalized) {

      case 'ESTUDIANTE':
        return 'ESTUDIANTE';

      case 'TECNICO':
        return 'TECNICO';

      case 'ADMIN':
      case 'ADMINISTRADOR':
        return 'ADMIN';

      case 'AUDITOR':
        return 'AUDITOR';

      default:
        return null;
    }
  }

  // =========================================
  // 4. LEER LOS ROLES DEL ACCESS TOKEN
  // =========================================

  private decodeJwtPayload(token: string): any {

    try {

      const parts = token.split('.');

      if (parts.length !== 3) {
        return {};
      }

      const payload = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const paddedPayload =
        payload + '='.repeat(
          (4 - payload.length % 4) % 4
        );

      const binary = atob(paddedPayload);

      const bytes = Uint8Array.from(
        binary,
        character => character.charCodeAt(0)
      );

      const json = new TextDecoder().decode(bytes);

      return JSON.parse(json);

    } catch (error) {

      console.error(
        'No fue posible leer las claims del token:',
        error
      );

      return {};
    }
  }

  // =========================================
  // 5. COMPROBAR SESION
  // =========================================

  isLoggedIn(): boolean {

    if (!this.initialized) {
      return false;
    }

    return this.msalService.instance
      .getAllAccounts().length > 0;
  }

  // =========================================
  // 6. COMPROBAR ROLES
  // =========================================

  hasRole(role: CampusRole): boolean {

    return this.userRoles.includes(role);
  }

  hasAnyRole(roles: CampusRole[]): boolean {

    return roles.some(role =>
      this.hasRole(role)
    );
  }

  // =========================================
  // 7. CERRAR SESION
  // =========================================

  logout(): void {

    this.msalService.logoutRedirect({

      postLogoutRedirectUri:
        window.location.origin + '/login'

    });
  }
}
