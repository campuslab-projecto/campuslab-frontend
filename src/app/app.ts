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

  async ngOnInit(): Promise<void> {
    // Esperar a que MSAL termine de inicializarse ANTES de usar el instance
    await this.msalService.instance.initialize();

    // Procesar el resultado del redirect del login
    await this.msalService.instance.handleRedirectPromise();

    const accounts = this.msalService.instance.getAllAccounts();
    if (accounts.length > 0) {
      this.msalService.instance.setActiveAccount(accounts[0]);
      this.isLoggedIn = true;
      this.userName = accounts[0].name || '';

      // Nota: los roles de autorización (App Roles de Azure) viajan en el
      // access token, no en el idToken. Para mostrarlos en la UI, léelos
      // desde el access token con acquireTokenSilent() donde corresponda
      // (por ejemplo, en un guard o servicio de autorización), no aquí.
    }
  }

  login(): void {
    this.msalService.loginRedirect();
  }

  logout(): void {
    this.msalService.logoutRedirect();
  }
}