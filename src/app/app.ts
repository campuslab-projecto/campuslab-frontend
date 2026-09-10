import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  isLoggedIn = false;
  userName = '';
  roles: string[] = [];

  constructor(private msalService: MsalService) {}

  ngOnInit(): void {
    this.msalService.instance.handleRedirectPromise().then(() => {
      const accounts = this.msalService.instance.getAllAccounts();
      if (accounts.length > 0) {
        this.msalService.instance.setActiveAccount(accounts[0]);
        this.isLoggedIn = true;
        this.userName = accounts[0].name || '';
        const claims = accounts[0].idTokenClaims as { roles?: string[] };
        this.roles = claims?.roles || [];
      }
    });
  }

  login(): void {
    this.msalService.loginRedirect();
  }

  logout(): void {
    this.msalService.logoutRedirect();
  }
}