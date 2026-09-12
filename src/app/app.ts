import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  initialized = false;

  constructor(private msalService: MsalService) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.msalService.instance.initialize();

      const response = await this.msalService.instance.handleRedirectPromise();

      if (response?.account) {
        this.msalService.instance.setActiveAccount(response.account);
      } else {
        const accounts = this.msalService.instance.getAllAccounts();

        if (accounts.length > 0) {
          this.msalService.instance.setActiveAccount(accounts[0]);
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error inicializando MSAL', error);
      this.initialized = true;
    }
  }

  isLoggedIn(): boolean {
    if (!this.initialized) {
      return false;
    }

    return this.msalService.instance.getAllAccounts().length > 0;
  }

  logout(): void {
    this.msalService.logoutRedirect({
      postLogoutRedirectUri: 'http://localhost:4200/login'
    });
  }
}