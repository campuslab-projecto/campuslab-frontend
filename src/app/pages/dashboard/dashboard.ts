import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  name = 'No disponible';
  username = 'No disponible';
  roles: string[] = [];
  scopes: string[] = [];
  audience = 'No disponible';

  constructor(private msalService: MsalService) {}

  ngOnInit(): void {
    const account =
      this.msalService.instance.getActiveAccount() ??
      this.msalService.instance.getAllAccounts()[0];

    if (!account) {
      return;
    }

    this.name = account.name ?? 'No disponible';
    this.username = account.username ?? 'No disponible';

    const claims: any = account.idTokenClaims ?? {};

    this.roles = Array.isArray(claims.roles) && claims.roles.length > 0
  ? claims.roles
  : ['ESTUDIANTE'];

    if (typeof claims.scp === 'string') {
      this.scopes = claims.scp.split(' ');
    } else {
      this.scopes = [];
    }

    if (Array.isArray(claims.aud)) {
      this.audience = claims.aud.join(', ');
    } else {
      this.audience = claims.aud ?? 'No disponible';
    }
  }
}