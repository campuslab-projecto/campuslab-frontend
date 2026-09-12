import { Component } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { protectedResources } from '../../auth-config';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html'
})
export class Login {
  constructor(private msalService: MsalService) {}

  login(): void {
    this.msalService.loginRedirect({
      scopes: protectedResources.api.scopes
    });
  }
}
