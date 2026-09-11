import { Component, OnInit } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { AccountInfo } from '@azure/msal-browser';
import { loginRequest } from '../../auth-config';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {

  nombre = 'No informado';
  usuario = 'No informado';
  roles: string[] = [];
  scopes = 'Sin scopes visibles';
  audience = 'No disponible';

  constructor(private msalService: MsalService) {}

  ngOnInit(): void {
    let account: AccountInfo | null = this.msalService.instance.getActiveAccount();

    if (!account) {
      const accounts = this.msalService.instance.getAllAccounts();

      if (accounts.length > 0) {
        account = accounts[0];
        this.msalService.instance.setActiveAccount(account);
      }
    }

    if (!account) {
      return;
    }

    this.nombre = account.name ?? 'No informado';
    this.usuario = account.username ?? 'No informado';

    const idClaims: any = account.idTokenClaims;

    if (idClaims?.roles) {
      this.roles = idClaims.roles;
    }

    this.msalService.acquireTokenSilent({
      ...loginRequest,
      account
    }).subscribe({
      next: (result) => {
        const accessToken = result.accessToken;
        const claims = this.decodeJwt(accessToken);

        this.scopes = claims?.scp ?? 'Sin scopes visibles';
        this.audience = claims?.aud ?? 'No disponible';

        if (claims?.roles) {
          this.roles = claims.roles;
        }
      },
      error: (error) => {
        console.error('Error obteniendo access token', error);
      }
    });
  }

  private decodeJwt(token: string): any {
    try {
      const payload = token.split('.')[1];
      const decodedPayload = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodedPayload);
    } catch {
      return null;
    }
  }

  get rolesTexto(): string {
    return this.roles.length > 0 ? this.roles.join(', ') : 'Sin roles asignados';
  }
}