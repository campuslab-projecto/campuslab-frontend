
import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  HttpClient,
  HttpErrorResponse
} from '@angular/common/http';

import { MsalService } from '@azure/msal-angular';
import { AccountInfo } from '@azure/msal-browser';

import { protectedResources } from '../../auth-config';

// ==========================================
// DIRECCION DEL SERVICIO DE RESERVAS
// ==========================================

const BOOKINGS_URL =
  `${protectedResources.api.endpoint}bookings`;

type CampusRole =
  | 'ADMIN'
  | 'TECNICO'
  | 'ESTUDIANTE'
  | 'AUDITOR';

type BookingStatus =
  | 'SOLICITADA'
  | 'APROBADA'
  | 'EN_PREPARACION'
  | 'EN_USO'
  | 'DEVUELTA'
  | 'CANCELADA'
  | 'OTRO';

// ==========================================
// MODELOS DE RESERVAS
// ==========================================

interface BookingView {
  id: string;
  status: BookingStatus;
  originalStatus: string;
  resource: string;
  date: string;
}

interface StatusMetric {
  label: string;
  status: BookingStatus;
  count: number;
  percent: number;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit {

  // ==========================================
  // INFORMACION DEL USUARIO
  // ==========================================

  name = 'Usuario';
  username = '';

  roles: string[] = [];
  scopes: string[] = [];
  audience = '';

  loadingIdentity = true;

  // ==========================================
  // INFORMACION DE RESERVAS
  // ==========================================

  loadingBookings = false;
  bookingsLoaded = false;
  bookingsError = '';

  bookings: BookingView[] = [];
  lastUpdated: Date | null = null;

  constructor(
    private msalService: MsalService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  // ==========================================
  // 1. INICIALIZAR DASHBOARD
  // ==========================================

  ngOnInit(): void {

    const account =
      this.msalService.instance.getActiveAccount() ??
      this.msalService.instance.getAllAccounts()[0];

    if (!account) {

      console.warn(
        'No hay una cuenta activa en MSAL.'
      );

      this.loadingIdentity = false;
      this.cdr.markForCheck();

      return;
    }

    this.name = account.name || 'Usuario';
    this.username = account.username || '';

    this.loadApiTokenInformation(account);
  }

  // ==========================================
  // 2. OBTENER INFORMACION DEL TOKEN
  // ==========================================

  private loadApiTokenInformation(
    account: AccountInfo
  ): void {

    this.msalService.acquireTokenSilent({
      account,
      scopes: protectedResources.api.scopes
    }).subscribe({

      next: result => {

        const claims =
          this.decodeJwtPayload(result.accessToken);

        const rolesClaim = claims['roles'];
        const scopesClaim = claims['scp'];
        const audienceClaim = claims['aud'];

        const tokenRoles: string[] =
          Array.isArray(rolesClaim)
            ? rolesClaim.map(
                (role: unknown) => String(role)
              )
            : rolesClaim
              ? [String(rolesClaim)]
              : [];

        this.roles = [
          ...new Set(
            tokenRoles
              .map(role => this.normalizeRole(role))
              .filter(role => role.length > 0)
          )
        ];

        this.scopes =
          typeof scopesClaim === 'string'
            ? scopesClaim
                .split(' ')
                .filter(Boolean)
            : (result.scopes || []).map(scope => {

                const parts = scope.split('/');

                return parts[parts.length - 1];
              });

        this.audience =
          audienceClaim
            ? String(audienceClaim)
            : '';

        this.loadingIdentity = false;

        // Solo consultar listado global para
        // administradores y tecnicos.
        if (this.canManageBookings) {
          this.loadBookings();
        }

        this.cdr.markForCheck();
      },

      error: error => {

        console.error(
          'No fue posible obtener los roles de CampusLab:',
          error
        );

        this.roles = [];
        this.scopes = [];
        this.audience = '';

        this.loadingIdentity = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ==========================================
  // 3. DECODIFICAR ACCESS TOKEN
  // ==========================================

  private decodeJwtPayload(
    token: string
  ): Record<string, unknown> {

    try {

      const parts = token.split('.');

      if (parts.length !== 3) {
        return {};
      }

      const normalized = parts[1]
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

      return JSON.parse(
        new TextDecoder().decode(bytes)
      ) as Record<string, unknown>;

    } catch (error) {

      console.error(
        'Error al decodificar el Access Token:',
        error
      );

      return {};
    }
  }

  // ==========================================
  // 4. NORMALIZAR ROLES
  // ==========================================

  private normalizeRole(role: string): string {

    const normalized = role
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    if (normalized === 'ADMINISTRADOR') {
      return 'ADMIN';
    }

    if (normalized === 'OPERADOR') {
      return 'TECNICO';
    }

    return normalized;
  }

  hasRole(role: CampusRole): boolean {

    return this.roles.includes(role);
  }

  get canManageBookings(): boolean {

    return this.hasRole('ADMIN') ||
           this.hasRole('TECNICO');
  }

  get canViewAudit(): boolean {

    return this.hasRole('ADMIN') ||
           this.hasRole('AUDITOR');
  }

  get isStudentOnly(): boolean {

    return this.hasRole('ESTUDIANTE') &&
           !this.canManageBookings;
  }

  // ==========================================
  // 5. INFORMACION PARA EL DASHBOARD
  // ==========================================

  get primaryRole(): string {

    if (this.hasRole('ADMIN')) {
      return 'Administrador';
    }

    if (this.hasRole('TECNICO')) {
      return 'Técnico de laboratorio';
    }

    if (this.hasRole('AUDITOR')) {
      return 'Auditor';
    }

    if (this.hasRole('ESTUDIANTE')) {
      return 'Estudiante';
    }

    return 'Sin rol asignado';
  }

  get firstName(): string {

    return this.name.trim().split(/\s+/)[0] || 'Usuario';
  }

  get welcomeDescription(): string {

    if (this.hasRole('ADMIN')) {

      return 'Supervisa las reservas académicas y accede a las herramientas de administración.';
    }

    if (this.hasRole('TECNICO')) {

      return 'Consulta las solicitudes y coordina la preparación de los laboratorios.';
    }

    if (this.hasRole('AUDITOR')) {

      return 'Consulta la trazabilidad y los eventos registrados en CampusLab.';
    }

    if (this.hasRole('ESTUDIANTE')) {

      return 'Gestiona y revisa el estado de tus solicitudes de reserva.';
    }

    return 'Bienvenido a la plataforma académica CampusLab.';
  }

  // ==========================================
  // 6. CONSULTAR RESERVAS
  // ==========================================

  loadBookings(): void {

    if (
      !this.canManageBookings ||
      this.loadingBookings
    ) {
      return;
    }

    this.loadingBookings = true;
    this.bookingsError = '';

    this.cdr.markForCheck();

    this.http.get<unknown>(BOOKINGS_URL)
      .subscribe({

        next: (response: unknown) => {

          const items =
            this.extractBookings(response);

          if (items === null) {

            this.bookings = [];
            this.bookingsLoaded = false;

            this.bookingsError =
              'El servicio respondió, pero su formato de reservas no coincide con el esperado. Debemos revisar la respuesta del backend.';

          } else {

            this.bookings = items.map(
              (item, index) =>
                this.mapBooking(item, index)
            );

            this.bookingsLoaded = true;
            this.lastUpdated = new Date();
          }

          this.loadingBookings = false;
          this.cdr.markForCheck();
        },

        error: (err: HttpErrorResponse) => {

          this.bookingsError =
            this.getRequestError(err);

          this.loadingBookings = false;
          this.cdr.markForCheck();
        }
      });
  }

  // ==========================================
  // 7. EXTRAER LISTADO DE RESERVAS
  // ==========================================

  private extractBookings(
    response: unknown
  ): Record<string, unknown>[] | null {

    let items: unknown = response;

    if (!Array.isArray(items)) {

      if (!this.isRecord(response)) {
        return null;
      }

      items =
        response['content'] ??
        response['bookings'] ??
        response['items'] ??
        response['data'] ??
        response['reservations'];
    }

    if (!Array.isArray(items)) {
      return null;
    }

    if (!items.every(item => this.isRecord(item))) {
      return null;
    }

    return items as Record<string, unknown>[];
  }

  private isRecord(
    value: unknown
  ): value is Record<string, unknown> {

    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }

  // ==========================================
  // 8. ADAPTAR DATOS DE RESERVA
  // ==========================================

  private mapBooking(
    booking: Record<string, unknown>,
    index: number
  ): BookingView {

    const id =
      booking['id'] ??
      booking['bookingId'] ??
      booking['reservationId'] ??
      index + 1;

    const originalStatus = String(
      booking['status'] ??
      booking['estado'] ??
      'SIN_ESTADO'
    );

    const resource = String(
      booking['laboratoryName'] ??
      booking['labName'] ??
      booking['resourceName'] ??
      booking['laboratoryId'] ??
      booking['labId'] ??
      booking['resourceId'] ??
      'Recurso no especificado'
    );

    const date = String(
      booking['startTime'] ??
      booking['startDate'] ??
      booking['date'] ??
      booking['createdAt'] ??
      ''
    );

    return {
      id: String(id),
      status: this.normalizeStatus(originalStatus),
      originalStatus,
      resource,
      date
    };
  }

  // ==========================================
  // 9. NORMALIZAR ESTADOS DE RESERVA
  // ==========================================

  private normalizeStatus(
    value: string
  ): BookingStatus {

    const status = value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[\s-]+/g, '_');

    switch (status) {

      case 'SOLICITADA':
      case 'REQUESTED':
      case 'PENDING':
        return 'SOLICITADA';

      case 'APROBADA':
      case 'APPROVED':
        return 'APROBADA';

      case 'EN_PREPARACION':
      case 'IN_PREPARATION':
        return 'EN_PREPARACION';

      case 'EN_USO':
      case 'IN_USE':
        return 'EN_USO';

      case 'DEVUELTA':
      case 'RETURNED':
        return 'DEVUELTA';

      case 'CANCELADA':
      case 'CANCELLED':
      case 'CANCELED':
        return 'CANCELADA';

      default:
        return 'OTRO';
    }
  }

  // ==========================================
  // 10. INDICADORES DE RESERVAS
  // ==========================================

  get totalBookings(): number {

    return this.bookings.length;
  }

  get pendingBookings(): number {

    return this.countStatus('SOLICITADA');
  }

  get activeBookings(): number {

    return this.countStatus('EN_USO');
  }

  get completedBookings(): number {

    return this.countStatus('DEVUELTA');
  }

  get recentBookings(): BookingView[] {

    return this.bookings.slice(0, 6);
  }

  private countStatus(
    status: BookingStatus
  ): number {

    return this.bookings.filter(
      booking => booking.status === status
    ).length;
  }

  // ==========================================
  // 11. DISTRIBUCION DE ESTADOS
  // ==========================================

  get statusMetrics(): StatusMetric[] {

    const definitions: {
      status: BookingStatus;
      label: string;
      color: string;
    }[] = [
      {
        status: 'SOLICITADA',
        label: 'Solicitadas',
        color: '#f59e0b'
      },
      {
        status: 'APROBADA',
        label: 'Aprobadas',
        color: '#2563eb'
      },
      {
        status: 'EN_PREPARACION',
        label: 'En preparación',
        color: '#8b5cf6'
      },
      {
        status: 'EN_USO',
        label: 'En uso',
        color: '#06b6d4'
      },
      {
        status: 'DEVUELTA',
        label: 'Devueltas',
        color: '#16a34a'
      },
      {
        status: 'CANCELADA',
        label: 'Canceladas',
        color: '#ef4444'
      },
      {
        status: 'OTRO',
        label: 'Otros estados',
        color: '#94a3b8'
      }
    ];

    return definitions.map(definition => {

      const count =
        this.countStatus(definition.status);

      return {
        ...definition,
        count,
        percent: this.totalBookings > 0
          ? (count / this.totalBookings) * 100
          : 0
      };
    });
  }

  getStatusLabel(
    status: BookingStatus
  ): string {

    const labels: Record<BookingStatus, string> = {
      SOLICITADA: 'Solicitada',
      APROBADA: 'Aprobada',
      EN_PREPARACION: 'En preparación',
      EN_USO: 'En uso',
      DEVUELTA: 'Devuelta',
      CANCELADA: 'Cancelada',
      OTRO: 'Otro estado'
    };

    return labels[status];
  }

  // ==========================================
  // 12. FORMATEAR FECHAS
  // ==========================================

  formatBookingDate(value: string): string {

    if (!value) {
      return 'Fecha no disponible';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  // ==========================================
  // 13. OPTIMIZAR LISTADOS
  // ==========================================

  trackBooking(
    index: number,
    booking: BookingView
  ): string {

    return `${booking.id}-${index}`;
  }

  trackMetric(
    _index: number,
    metric: StatusMetric
  ): string {

    return metric.status;
  }

  // ==========================================
  // 14. MENSAJES DE ERROR
  // ==========================================

  private getRequestError(
    err: HttpErrorResponse
  ): string {

    if (err.status === 401) {

      return 'Tu sesión no está autorizada. Inicia sesión nuevamente.';
    }

    if (err.status === 403) {

      return 'Tu rol no permite consultar el listado de reservas.';
    }

    if (err.status === 404) {

      return 'No se encontró el endpoint de listado de reservas.';
    }

    if (err.status === 0) {

      return 'No fue posible conectar con el servicio de reservas.';
    }

    return `No se pudieron consultar las reservas (HTTP ${err.status}).`;
  }
}
