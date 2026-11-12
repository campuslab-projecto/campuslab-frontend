
import { CommonModule } from '@angular/common';
import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { finalize, Observable } from 'rxjs';
import { MsalService } from '@azure/msal-angular';

import { protectedResources } from '../../auth-config';

const API_URL =
  'https://ok83lxm1s3.execute-api.us-east-1.amazonaws.com/api/rabbit';

type ExchangeType = 'direct' | 'topic' | 'fanout';

@Component({
  selector: 'app-rabbit-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rabbit-admin.html',
  styleUrl: './rabbit-admin.css'
})
export class RabbitAdmin implements OnInit {

  loading = false;
  checkingRole = true;
  isAdmin = false;

  success = '';
  error = '';

  queueName = '';
  queueDurable = true;
  deleteQueueName = '';

  exchangeName = '';
  exchangeType: ExchangeType = 'direct';
  deleteExchangeName = '';

  bindingQueueName = '';
  bindingExchangeName = '';
  bindingExchangeType: ExchangeType = 'direct';
  bindingRoutingKey = '';

  private readonly protectedQueues = [
    'q.cmd.email',
    'q.cmd.prep',
    'q.cmd.voucher',
    'q.cmd.email.dlq',
    'q.cmd.prep.dlq',
    'q.cmd.voucher.dlq'
  ];

  private readonly protectedExchanges = [
    'cmd.direct',
    'cmd.topic',
    'cmd.dead.dlx'
  ];

  constructor(
    private http: HttpClient,
    private msal: MsalService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.checkAdminRole();
  }

  // ====================================
  // 1. COMPROBAR ROL ADMIN
  // ====================================

  private checkAdminRole(): void {

    const account =
      this.msal.instance.getActiveAccount() ??
      this.msal.instance.getAllAccounts()[0];

    if (!account) {
      this.error = 'No hay una sesión activa.';
      this.checkingRole = false;
      this.cdr.markForCheck();
      return;
    }

    this.msal.acquireTokenSilent({
      account,
      scopes: protectedResources.api.scopes
    }).subscribe({

      next: result => {

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

          this.isAdmin = roles.some(role => {

            const clean = String(role)
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim()
              .toUpperCase();

            return clean === 'ADMIN' ||
                   clean === 'ADMINISTRADOR';
          });

          if (!this.isAdmin) {
            this.error =
              'Acceso restringido. Se requiere el rol ADMIN.';
          }

        } catch {
          this.error = 'No se pudieron verificar los roles.';
        }

        this.checkingRole = false;
        this.cdr.markForCheck();
      },

      error: () => {
        this.error = 'No fue posible verificar el rol ADMIN.';
        this.checkingRole = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ====================================
  // 2. EJECUTAR PETICIONES HTTP
  // ====================================

  private execute(
    request: Observable<string>,
    successMessage: string
  ): void {

    if (!this.isAdmin || this.loading) {
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';
    this.cdr.markForCheck();

    request.pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({

      next: () => {
        this.success = successMessage;
        this.cdr.markForCheck();
      },

      error: (err: HttpErrorResponse) => {

        if (err.status === 403) {
          this.error =
            'Operación prohibida: no tienes permisos o el recurso está protegido.';
        } else if (err.status === 401) {
          this.error =
            'Tu sesión no fue autorizada. Vuelve a iniciar sesión.';
        } else {
          this.error =
            `No se pudo completar la operación (HTTP ${err.status}).`;
        }

        this.cdr.markForCheck();
      }
    });
  }

  // ====================================
  // 3. VALIDACIONES DE SEGURIDAD
  // ====================================

  private isProtectedQueue(name: string): boolean {

    const clean = name.trim();

    return this.protectedQueues.includes(clean) ||
           clean.startsWith('q.cmd.') ||
           clean.startsWith('amq.');
  }

  private isProtectedExchange(name: string): boolean {

    const clean = name.trim();

    return this.protectedExchanges.includes(clean) ||
           clean.startsWith('cmd.') ||
           clean.startsWith('amq.');
  }

  private showProtectedError(): void {
    this.success = '';
    this.error =
      'Este componente está protegido porque forma parte de la infraestructura de CampusLab.';
    this.cdr.markForCheck();
  }

  // ====================================
  // 4. CREAR COLA
  // ====================================

  createQueue(): void {

    const name = this.queueName.trim();

    if (!name) return;

    if (this.isProtectedQueue(name)) {
      this.showProtectedError();
      return;
    }

    this.execute(
      this.http.post(
        `${API_URL}/queues`,
        {
          name,
          durable: this.queueDurable
        },
        { responseType: 'text' }
      ),
      `Cola "${name}" creada correctamente.`
    );
  }

  // ====================================
  // 5. ELIMINAR COLA
  // ====================================

  deleteQueue(): void {

    const name = this.deleteQueueName.trim();

    if (!name) return;

    if (this.isProtectedQueue(name)) {
      this.showProtectedError();
      return;
    }

    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar la cola "${name}"?\n\n` +
      'Esta operación puede eliminar los mensajes almacenados en ella.'
    );

    if (!confirmed) return;

    this.execute(
      this.http.delete(
        `${API_URL}/queues/${encodeURIComponent(name)}`,
        { responseType: 'text' }
      ),
      `Cola "${name}" eliminada correctamente.`
    );
  }

  // ====================================
  // 6. CREAR EXCHANGE
  // ====================================

  createExchange(): void {

    const name = this.exchangeName.trim();

    if (!name) return;

    if (this.isProtectedExchange(name)) {
      this.showProtectedError();
      return;
    }

    this.execute(
      this.http.post(
        `${API_URL}/exchanges`,
        {
          name,
          type: this.exchangeType
        },
        { responseType: 'text' }
      ),
      `Exchange "${name}" creado correctamente.`
    );
  }

  // ====================================
  // 7. ELIMINAR EXCHANGE
  // ====================================

  deleteExchange(): void {

    const name = this.deleteExchangeName.trim();

    if (!name) return;

    if (this.isProtectedExchange(name)) {
      this.showProtectedError();
      return;
    }

    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar el exchange "${name}"?\n\n` +
      'Los bindings asociados pueden quedar eliminados.'
    );

    if (!confirmed) return;

    this.execute(
      this.http.delete(
        `${API_URL}/exchanges/${encodeURIComponent(name)}`,
        { responseType: 'text' }
      ),
      `Exchange "${name}" eliminado correctamente.`
    );
  }

  // ====================================
  // 8. CREAR BINDING
  // ====================================

  createBinding(): void {

    if (!this.bindingQueueName.trim() ||
        !this.bindingExchangeName.trim()) {
      return;
    }

    if (
      this.isProtectedQueue(this.bindingQueueName) ||
      this.isProtectedExchange(this.bindingExchangeName)
    ) {
      this.showProtectedError();
      return;
    }

    this.execute(
      this.http.post(
        `${API_URL}/bindings`,
        this.bindingPayload(),
        { responseType: 'text' }
      ),
      'Binding creado correctamente.'
    );
  }

  // ====================================
  // 9. ELIMINAR BINDING
  // ====================================

  deleteBinding(): void {

    if (!this.bindingQueueName.trim() ||
        !this.bindingExchangeName.trim()) {
      return;
    }

    if (
      this.isProtectedQueue(this.bindingQueueName) ||
      this.isProtectedExchange(this.bindingExchangeName)
    ) {
      this.showProtectedError();
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar el binding entre "${this.bindingExchangeName}" ` +
      `y "${this.bindingQueueName}"?`
    );

    if (!confirmed) return;

    this.execute(
      this.http.request(
        'DELETE',
        `${API_URL}/bindings`,
        {
          body: this.bindingPayload(),
          responseType: 'text'
        }
      ),
      'Binding eliminado correctamente.'
    );
  }

  // ====================================
  // 10. DATOS DEL BINDING
  // ====================================

  private bindingPayload() {

    return {
      queueName: this.bindingQueueName.trim(),
      exchangeName: this.bindingExchangeName.trim(),
      exchangeType: this.bindingExchangeType,
      routingKey: this.bindingRoutingKey.trim()
    };
  }
}
