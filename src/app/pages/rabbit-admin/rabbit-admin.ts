
import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectorRef,
  OnInit
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import {
  HttpClient,
  HttpErrorResponse
} from '@angular/common/http';

import { finalize, Observable } from 'rxjs';
import { MsalService } from '@azure/msal-angular';
import { protectedResources } from '../../auth-config';

const API_URL =
  `${protectedResources.api.endpoint}rabbit`;

type ExchangeType = 'direct' | 'topic' | 'fanout';

interface OperationEntry {
  message: string;
  success: boolean;
  date: Date;
}

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

  // COLAS
  queueName = '';
  queueDurable = true;
  deleteQueueName = '';

  // EXCHANGES
  exchangeName = '';
  exchangeType: ExchangeType = 'direct';
  deleteExchangeName = '';

  // BINDINGS
  bindingQueueName = '';
  bindingExchangeName = '';
  bindingExchangeType: ExchangeType = 'direct';
  bindingRoutingKey = '';

  // HISTORIAL LOCAL DE ESTA SESION
  operations: OperationEntry[] = [];

  // RECURSOS PROTEGIDOS
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

  // ==========================================
  // 1. VERIFICAR ADMIN
  // ==========================================

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

          if (!payload) {
            throw new Error('Token inválido');
          }

          const normalized = payload
            .replace(/-/g, '+')
            .replace(/_/g, '/');

          const padded = normalized.padEnd(
            Math.ceil(normalized.length / 4) * 4,
            '='
          );

          const binary = atob(padded);

          const bytes = Uint8Array.from(
            binary,
            character => character.charCodeAt(0)
          );

          const claims = JSON.parse(
            new TextDecoder().decode(bytes)
          ) as Record<string, unknown>;

          const rolesClaim = claims['roles'];

          const roles: string[] =
            Array.isArray(rolesClaim)
              ? rolesClaim.map(
                  (role: unknown) => String(role)
                )
              : rolesClaim
                ? [String(rolesClaim)]
                : [];

          this.isAdmin = roles.some(role => {

            const clean = role
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

        } catch (err) {

          console.error(
            'Error verificando roles:',
            err
          );

          this.isAdmin = false;
          this.error =
            'No se pudieron verificar los roles.';
        }

        this.checkingRole = false;
        this.cdr.markForCheck();
      },

      error: err => {

        console.error(
          'Error obteniendo token:',
          err
        );

        this.isAdmin = false;
        this.error =
          'No fue posible verificar el rol ADMIN.';

        this.checkingRole = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ==========================================
  // 2. EJECUTAR OPERACIONES
  // ==========================================

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

        this.addOperation(
          successMessage,
          true
        );

        this.cdr.markForCheck();
      },

      error: (err: HttpErrorResponse) => {

        if (err.status === 403) {

          this.error =
            'Operación prohibida: no tienes permisos o el recurso está protegido.';

        } else if (err.status === 401) {

          this.error =
            'Tu sesión no fue autorizada. Vuelve a iniciar sesión.';

        } else if (err.status === 0) {

          this.error =
            'No fue posible conectar con RabbitMQ Admin.';

        } else {

          this.error =
            `No se pudo completar la operación (HTTP ${err.status}).`;
        }

        this.addOperation(
          this.error,
          false
        );

        this.cdr.markForCheck();
      }
    });
  }

  private addOperation(
    message: string,
    success: boolean
  ): void {

    this.operations = [
      {
        message,
        success,
        date: new Date()
      },
      ...this.operations
    ].slice(0, 8);
  }

  get successfulOperations(): number {

    return this.operations.filter(
      operation => operation.success
    ).length;
  }

  get failedOperations(): number {

    return this.operations.filter(
      operation => !operation.success
    ).length;
  }

  // ==========================================
  // 3. RECURSOS PROTEGIDOS
  // ==========================================

  private isProtectedQueue(
    name: string
  ): boolean {

    const clean = name.trim();

    return this.protectedQueues.includes(clean) ||
           clean.startsWith('q.cmd.') ||
           clean.startsWith('amq.');
  }

  private isProtectedExchange(
    name: string
  ): boolean {

    const clean = name.trim();

    return this.protectedExchanges.includes(clean) ||
           clean.startsWith('cmd.') ||
           clean.startsWith('amq.');
  }

  private showProtectedError(): void {

    this.success = '';

    this.error =
      'Este componente está protegido porque forma parte de la infraestructura de CampusLab.';

    this.addOperation(
      this.error,
      false
    );

    this.cdr.markForCheck();
  }

  // ==========================================
  // 4. CREAR COLA
  // ==========================================

  createQueue(): void {

    if (!this.isAdmin || this.loading) {
      return;
    }

    const name = this.queueName.trim();

    if (!name) {
      return;
    }

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

  // ==========================================
  // 5. ELIMINAR COLA
  // ==========================================

  deleteQueue(): void {

    if (!this.isAdmin || this.loading) {
      return;
    }

    const name = this.deleteQueueName.trim();

    if (!name) {
      return;
    }

    if (this.isProtectedQueue(name)) {
      this.showProtectedError();
      return;
    }

    const confirmed = window.confirm(
      `¿Estás seguro de eliminar la cola "${name}"?\n\n` +
      'Esta operación puede eliminar los mensajes almacenados.'
    );

    if (!confirmed) {
      return;
    }

    this.execute(
      this.http.delete(
        `${API_URL}/queues/${encodeURIComponent(name)}`,
        { responseType: 'text' }
      ),
      `Cola "${name}" eliminada correctamente.`
    );
  }

  // ==========================================
  // 6. CREAR EXCHANGE
  // ==========================================

  createExchange(): void {

    if (!this.isAdmin || this.loading) {
      return;
    }

    const name = this.exchangeName.trim();

    if (!name) {
      return;
    }

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

  // ==========================================
  // 7. ELIMINAR EXCHANGE
  // ==========================================

  deleteExchange(): void {

    if (!this.isAdmin || this.loading) {
      return;
    }

    const name = this.deleteExchangeName.trim();

    if (!name) {
      return;
    }

    if (this.isProtectedExchange(name)) {
      this.showProtectedError();
      return;
    }

    const confirmed = window.confirm(
      `¿Estás seguro de eliminar el exchange "${name}"?\n\n` +
      'Los bindings asociados pueden quedar eliminados.'
    );

    if (!confirmed) {
      return;
    }

    this.execute(
      this.http.delete(
        `${API_URL}/exchanges/${encodeURIComponent(name)}`,
        { responseType: 'text' }
      ),
      `Exchange "${name}" eliminado correctamente.`
    );
  }

  // ==========================================
  // 8. CREAR BINDING
  // ==========================================

  createBinding(): void {

    if (!this.isAdmin || this.loading) {
      return;
    }

    if (
      !this.bindingQueueName.trim() ||
      !this.bindingExchangeName.trim()
    ) {
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

  // ==========================================
  // 9. ELIMINAR BINDING
  // ==========================================

  deleteBinding(): void {

    if (!this.isAdmin || this.loading) {
      return;
    }

    if (
      !this.bindingQueueName.trim() ||
      !this.bindingExchangeName.trim()
    ) {
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

    if (!confirmed) {
      return;
    }

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

  // ==========================================
  // 10. DATOS DEL BINDING
  // ==========================================

  private bindingPayload() {

    return {
      queueName: this.bindingQueueName.trim(),
      exchangeName: this.bindingExchangeName.trim(),
      exchangeType: this.bindingExchangeType,
      routingKey: this.bindingRoutingKey.trim()
    };
  }
}
