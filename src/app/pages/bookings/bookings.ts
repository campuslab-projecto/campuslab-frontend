
import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { MsalService } from '@azure/msal-angular';

import { BookingService } from '../../services/booking.service';
import { Booking } from '../../models/booking';
import { protectedResources } from '../../auth-config';

type CampusRole =
  | 'ESTUDIANTE'
  | 'TECNICO'
  | 'ADMIN'
  | 'AUDITOR';

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bookings.html',
  styleUrl: './bookings.css'
})
export class Bookings implements OnInit {

  // ==========================================
  // DATOS DE RESERVAS
  // ==========================================

  bookings: Booking[] = [];

  loading = false;
  saving = false;
  rolesLoaded = false;

  updatingId: number | null = null;

  error = '';
  success = '';
  roleError = '';

  userEmail = '';
  userRoles: CampusRole[] = [];

  // ==========================================
  // BUSQUEDA Y FILTROS
  // ==========================================

  searchTerm = '';
  selectedStatus = 'TODOS';

  readonly statusOptions = [
    { value: 'TODOS', label: 'Todos los estados' },
    { value: 'SOLICITADA', label: 'Solicitadas' },
    { value: 'APROBADA', label: 'Aprobadas' },
    { value: 'EN_PREPARACION', label: 'En preparación' },
    { value: 'EN_USO', label: 'En uso' },
    { value: 'DEVUELTA', label: 'Devueltas' },
    { value: 'CANCELADA', label: 'Canceladas' }
  ];

  // ==========================================
  // FORMULARIO
  // ==========================================

  newBooking: Booking = {
    userEmail: '',
    resourceId: 'LAB-REDES-01',
    status: 'SOLICITADA'
  };

  constructor(
    private bookingService: BookingService,
    private msalService: MsalService,
    private cdr: ChangeDetectorRef
  ) {}

  // ==========================================
  // 1. INICIALIZAR
  // ==========================================

  ngOnInit(): void {
    this.loadUserRoles();
  }

  // ==========================================
  // 2. ROLES MICROSOFT
  // ==========================================

  loadUserRoles(): void {

    this.rolesLoaded = false;
    this.roleError = '';

    const account =
      this.msalService.instance.getActiveAccount() ??
      this.msalService.instance.getAllAccounts()[0];

    if (!account) {

      this.roleError = 'No hay una sesión activa.';
      this.rolesLoaded = true;
      this.cdr.markForCheck();

      return;
    }

    this.userEmail = account.username || '';
    this.newBooking.userEmail = this.userEmail;

    this.msalService.acquireTokenSilent({
      account,
      scopes: protectedResources.api.scopes
    }).subscribe({

      next: result => {

        const claims = this.decodeJwt(result.accessToken);
        const rolesClaim = claims['roles'];

        const roles: string[] =
          Array.isArray(rolesClaim)
            ? rolesClaim.map(
                (role: unknown) => String(role)
              )
            : rolesClaim
              ? [String(rolesClaim)]
              : [];

        this.userRoles = [
          ...new Set(
            roles
              .map(role => this.normalizeRole(role))
              .filter(
                (role): role is CampusRole =>
                  role !== null
              )
          )
        ];

        this.rolesLoaded = true;

        if (this.userRoles.length === 0) {

          this.roleError =
            'Tu cuenta no tiene un rol reconocido para CampusLab.';

        } else if (
          this.canManageBookings ||
          this.isStudentOnly
        ) {

          this.loadBookings();
        }

        this.cdr.markForCheck();
      },

      error: err => {

        console.error(
          'Error verificando roles de reservas:',
          err
        );

        this.userRoles = [];
        this.rolesLoaded = true;

        this.roleError =
          'No fue posible verificar los permisos del usuario.';

        this.cdr.markForCheck();
      }
    });
  }

  private normalizeRole(
    role: string
  ): CampusRole | null {

    const normalized = role
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    switch (normalized) {

      case 'ESTUDIANTE':
        return 'ESTUDIANTE';

      case 'TECNICO':
      case 'OPERADOR':
        return 'TECNICO';

      case 'ADMIN':
      case 'ADMINISTRADOR':
        return 'ADMIN';

      case 'AUDITOR':
        return 'AUDITOR';

      default:
        return null;
    }
  }

  private decodeJwt(
    token: string
  ): Record<string, unknown> {

    try {

      const parts = token.split('.');

      if (parts.length !== 3) {
        return {};
      }

      const payload = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const padded =
        payload +
        '='.repeat(
          (4 - payload.length % 4) % 4
        );

      const bytes = Uint8Array.from(
        atob(padded),
        char => char.charCodeAt(0)
      );

      return JSON.parse(
        new TextDecoder().decode(bytes)
      ) as Record<string, unknown>;

    } catch (err) {

      console.error(
        'Error leyendo claims:',
        err
      );

      return {};
    }
  }

  // ==========================================
  // 3. PERMISOS
  // ==========================================

  hasRole(role: CampusRole): boolean {
    return this.userRoles.includes(role);
  }

  get canManageBookings(): boolean {

    return this.rolesLoaded &&
      (
        this.hasRole('TECNICO') ||
        this.hasRole('ADMIN')
      );
  }

  get canCreateBooking(): boolean {

    return this.rolesLoaded &&
      (
        this.hasRole('ESTUDIANTE') ||
        this.hasRole('TECNICO')
      );
  }

  get isStudentOnly(): boolean {

    return this.hasRole('ESTUDIANTE') &&
      !this.hasRole('TECNICO') &&
      !this.hasRole('ADMIN');
  }

  get primaryRole(): string {

    if (this.hasRole('ADMIN')) {
      return 'Administrador';
    }

    if (this.hasRole('TECNICO')) {
      return 'Técnico de laboratorio';
    }

    if (this.hasRole('ESTUDIANTE')) {
      return 'Estudiante';
    }

    if (this.hasRole('AUDITOR')) {
      return 'Auditor';
    }

    return 'Sin rol asignado';
  }

  // ==========================================
  // 4. RESERVAS SEGUN EL ROL
  // ==========================================

  get visibleBookings(): Booking[] {

    if (
      !this.rolesLoaded ||
      this.userRoles.length === 0
    ) {
      return [];
    }

    if (this.isStudentOnly) {

      return this.bookings.filter(
        booking =>
          booking.userEmail?.trim().toLowerCase() ===
          this.userEmail.trim().toLowerCase()
      );
    }

    if (this.canManageBookings) {
      return this.bookings;
    }

    return [];
  }

  // ==========================================
  // 5. BUSCAR Y FILTRAR
  // ==========================================

  get filteredBookings(): Booking[] {

    const term = this.searchTerm
      .trim()
      .toLowerCase();

    return this.visibleBookings.filter(booking => {

      const matchesSearch =
        !term ||
        String(booking.id ?? '')
          .toLowerCase()
          .includes(term) ||
        String(booking.userEmail ?? '')
          .toLowerCase()
          .includes(term) ||
        String(booking.resourceId ?? '')
          .toLowerCase()
          .includes(term);

      const matchesStatus =
        this.selectedStatus === 'TODOS' ||
        booking.status === this.selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'TODOS';
  }

  get hasActiveFilters(): boolean {

    return (
      this.searchTerm.trim().length > 0 ||
      this.selectedStatus !== 'TODOS'
    );
  }

  // ==========================================
  // 6. INDICADORES REALES
  // ==========================================

  get totalBookings(): number {
    return this.visibleBookings.length;
  }

  get requestedBookings(): number {
    return this.countStatus('SOLICITADA');
  }

  get approvedBookings(): number {
    return this.countStatus('APROBADA');
  }

  get preparingBookings(): number {
    return this.countStatus('EN_PREPARACION');
  }

  get inUseBookings(): number {
    return this.countStatus('EN_USO');
  }

  private countStatus(status: string): number {

    return this.visibleBookings.filter(
      booking => booking.status === status
    ).length;
  }

  // ==========================================
  // 7. CONSULTAR RESERVAS
  // ==========================================

  loadBookings(): void {

    if (
      this.loading ||
      !this.rolesLoaded ||
      (
        !this.canManageBookings &&
        !this.isStudentOnly
      )
    ) {
      return;
    }

    this.loading = true;
    this.error = '';

    this.cdr.markForCheck();

    this.bookingService.getBookings()
      .pipe(
        finalize(() => {

          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: data => {

          this.bookings = [...data];
          this.cdr.markForCheck();
        },

        error: err => {

          console.error(
            'Error listando reservas:',
            err
          );

          this.error =
            'No fue posible cargar las reservas.';

          this.cdr.markForCheck();
        }
      });
  }

  // ==========================================
  // 8. CREAR RESERVA
  // ==========================================

  createBooking(): void {

    if (
      !this.canCreateBooking ||
      this.saving
    ) {
      return;
    }

    const email = this.isStudentOnly
      ? this.userEmail
      : this.newBooking.userEmail.trim();

    const resourceId =
      this.newBooking.resourceId.trim();

    if (!email || !resourceId) {

      this.error =
        'Completa los datos de la reserva.';

      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.error = '';
    this.success = '';

    const bookingToCreate: Booking = {
      userEmail: email,
      resourceId,
      status: 'SOLICITADA'
    };

    this.cdr.markForCheck();

    this.bookingService
      .createBooking(bookingToCreate)
      .pipe(
        finalize(() => {

          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: createdBooking => {

          this.success =
            'Reserva creada correctamente.';

          if (createdBooking?.id != null) {

            this.bookings = [
              ...this.bookings.filter(
                item =>
                  item.id !== createdBooking.id
              ),
              createdBooking
            ];

          } else {

            this.loadBookings();
          }

          this.newBooking = {
            userEmail: this.userEmail,
            resourceId: 'LAB-REDES-01',
            status: 'SOLICITADA'
          };

          this.cdr.markForCheck();
        },

        error: err => {

          console.error(
            'Error creando reserva:',
            err
          );

          this.error =
            'No fue posible crear la reserva.';

          this.cdr.markForCheck();
        }
      });
  }

  // ==========================================
  // 9. CAMBIAR ESTADO
  // ==========================================

  changeStatus(
    booking: Booking,
    newStatus: string
  ): void {

    if (
      !this.canManageBookings ||
      booking.id == null ||
      this.updatingId !== null ||
      !this.getAvailableStatuses(
        booking.status
      ).includes(newStatus)
    ) {
      return;
    }

    const bookingId = booking.id;

    this.updatingId = bookingId;
    this.error = '';
    this.success = '';

    this.cdr.markForCheck();

    this.bookingService
      .updateStatus(bookingId, newStatus)
      .pipe(
        finalize(() => {

          this.updatingId = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: updatedBooking => {

          this.bookings = this.bookings.map(
            item =>
              item.id === bookingId
                ? {
                    ...item,
                    ...updatedBooking,
                    status:
                      updatedBooking?.status ??
                      newStatus
                  }
                : item
          );

          this.success =
            `Reserva #${bookingId} actualizada a ${this.formatStatus(newStatus)}.`;

          this.cdr.markForCheck();
        },

        error: err => {

          console.error(
            'Error cambiando estado:',
            err
          );

          this.error =
            'No fue posible actualizar la reserva.';

          this.cdr.markForCheck();
        }
      });
  }

  // ==========================================
  // 10. TRANSICIONES PERMITIDAS
  // ==========================================

  getAvailableStatuses(
    status: string
  ): string[] {

    if (!this.canManageBookings) {
      return [];
    }

    switch (status) {

      case 'SOLICITADA':
        return [
          'APROBADA',
          'CANCELADA'
        ];

      case 'APROBADA':
        return [
          'EN_PREPARACION',
          'CANCELADA'
        ];

      case 'EN_PREPARACION':
        return [
          'EN_USO',
          'CANCELADA'
        ];

      case 'EN_USO':
        return ['DEVUELTA'];

      default:
        return [];
    }
  }

  // ==========================================
  // 11. PRESENTACION
  // ==========================================

  formatStatus(status: string): string {

    return String(status || '')
      .replace(/_/g, ' ');
  }

  getStatusClass(status: string): string {

    switch (status) {

      case 'SOLICITADA':
        return 'status-requested';

      case 'APROBADA':
        return 'status-approved';

      case 'EN_PREPARACION':
        return 'status-preparing';

      case 'EN_USO':
        return 'status-in-use';

      case 'DEVUELTA':
        return 'status-returned';

      case 'CANCELADA':
        return 'status-cancelled';

      default:
        return 'status-default';
    }
  }

  getActionLabel(status: string): string {

    switch (status) {

      case 'APROBADA':
        return 'Aprobar';

      case 'EN_PREPARACION':
        return 'Preparar';

      case 'EN_USO':
        return 'Iniciar uso';

      case 'DEVUELTA':
        return 'Devolver';

      case 'CANCELADA':
        return 'Cancelar';

      default:
        return this.formatStatus(status);
    }
  }

  trackBooking(
    index: number,
    booking: Booking
  ): number | string {

    return booking.id ?? `row-${index}`;
  }
}
