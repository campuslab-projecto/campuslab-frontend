import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard {
  name = 'Usuario';
  username = '';
  roles: string[] = [];
  scopes: string[] = [];
  audience = '';

  constructor(private msalService: MsalService) {
    const account =
      this.msalService.instance.getActiveAccount() ??
      this.msalService.instance.getAllAccounts()[0];

    if (account) {
      this.name = account.name || 'Usuario';
      this.username = account.username || '';

      const claims: any = account.idTokenClaims || {};

      this.roles = claims.roles || [];
      this.scopes = claims.scp ? String(claims.scp).split(' ') : [];
      this.audience = claims.aud || '';
    }
  }
}