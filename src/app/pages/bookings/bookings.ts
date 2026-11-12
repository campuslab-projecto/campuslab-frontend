
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

type CampusRole = 'ESTUDIANTE' | 'TECNICO' | 'ADMIN' | 'AUDITOR';

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bookings.html',
  styleUrl: './bookings.css'
})
export class Bookings implements OnInit {

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

  ngOnInit(): void {
    this.loadUserRoles();
    this.loadBookings();
  }

  // =====================================
  // 1. OBTENER LOS ROLES DESDE MICROSOFT
  // =====================================

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

        const roles: string[] = Array.isArray(claims?.roles)
          ? claims.roles.map((role: unknown) => String(role))
          : claims?.roles
            ? [String(claims.roles)]
            : [];

        this.userRoles = [
          ...new Set(
            roles
              .map(role => this.normalizeRole(role))
              .filter(
                (role): role is CampusRole => role !== null
              )
          )
        ];

        this.rolesLoaded = true;

        console.log('Roles en reservas:', this.userRoles);

        if (this.userRoles.length === 0) {
          this.roleError =
            'Tu cuenta no tiene un rol reconocido para CampusLab.';
        }

        this.cdr.markForCheck();
      },

      error: err => {

        console.error('Error obteniendo los roles:', err);

        this.userRoles = [];
        this.rolesLoaded = true;
        this.roleError =
          'No fue posible verificar los permisos del usuario.';

        this.cdr.markForCheck();
      }
    });
  }

  private normalizeRole(role: string): CampusRole | null {

    const normalized = role
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    switch (normalized) {
      case 'ESTUDIANTE':
        return 'ESTUDIANTE';

      case 'TECNICO':
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

  private decodeJwt(token: string): any {

    try {
      const parts = token.split('.');

      if (parts.length !== 3) {
        return {};
      }

      const payload = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const padded =
        payload + '='.repeat(
          (4 - payload.length % 4) % 4
        );

      const bytes = Uint8Array.from(
        atob(padded),
        char => char.charCodeAt(0)
      );

      return JSON.parse(
        new TextDecoder().decode(bytes)
      );

    } catch (err) {
      console.error('Error leyendo claims:', err);
      return {};
    }
  }

  // =====================================
  // 2. PERMISOS POR ROL
  // =====================================

  hasRole(role: CampusRole): boolean {
    return this.userRoles.includes(role);
  }

  get canManageBookings(): boolean {
    return this.rolesLoaded &&
      (this.hasRole('TECNICO') || this.hasRole('ADMIN'));
  }

  get canCreateBooking(): boolean {
    return this.rolesLoaded &&
      (this.hasRole('ESTUDIANTE') || this.hasRole('TECNICO'));
  }

  get isStudentOnly(): boolean {
    return this.hasRole('ESTUDIANTE') &&
      !this.hasRole('TECNICO') &&
      !this.hasRole('ADMIN');
  }

  // El estudiante visualiza solo sus reservas.
  // Este filtro es visual: también debe aplicarse en backend.
  get visibleBookings(): Booking[] {

    if (!this.rolesLoaded || this.userRoles.length === 0) {
      return [];
    }

    if (this.isStudentOnly) {

      return this.bookings.filter(booking =>
        booking.userEmail?.trim().toLowerCase() ===
        this.userEmail.trim().toLowerCase()
      );
    }

    if (this.canManageBookings) {
      return this.bookings;
    }

    return [];
  }

  // =====================================
  // 3. LISTAR Y ACTUALIZAR RESERVAS
  // =====================================

  loadBookings(): void {

    if (this.loading) {
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
          console.error('Error listando reservas:', err);
          this.error = 'No fue posible cargar las reservas.';
          this.cdr.markForCheck();
        }
      });
  }

  // =====================================
  // 4. CREAR RESERVA
  // =====================================

  createBooking(): void {

    if (!this.canCreateBooking || this.saving) {
      return;
    }

    const email = this.isStudentOnly
      ? this.userEmail
      : this.newBooking.userEmail.trim();

    const resourceId = this.newBooking.resourceId.trim();

    if (!email || !resourceId) {
      this.error = 'Completa los datos de la reserva.';
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

    this.bookingService.createBooking(bookingToCreate)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: createdBooking => {

          this.success = 'Reserva creada correctamente.';

          if (createdBooking?.id != null) {
            this.bookings = [
              ...this.bookings.filter(
                item => item.id !== createdBooking.id
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
          console.error('Error creando reserva:', err);
          this.error = 'No fue posible crear la reserva.';
          this.cdr.markForCheck();
        }
      });
  }

  // =====================================
  // 5. CAMBIAR ESTADO: TÉCNICO O ADMIN
  // =====================================

  changeStatus(booking: Booking, newStatus: string): void {

    if (
      !this.canManageBookings ||
      booking.id == null ||
      this.updatingId !== null ||
      !this.getAvailableStatuses(booking.status).includes(newStatus)
    ) {
      return;
    }

    const bookingId = booking.id;

    this.updatingId = bookingId;
    this.error = '';
    this.success = '';

    this.cdr.markForCheck();

    this.bookingService.updateStatus(bookingId, newStatus)
      .pipe(
        finalize(() => {
          this.updatingId = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: updatedBooking => {

          this.bookings = this.bookings.map(item =>
            item.id === bookingId
              ? {
                  ...item,
                  ...updatedBooking,
                  status: updatedBooking?.status ?? newStatus
                }
              : item
          );

          this.success =
            `Reserva #${bookingId} actualizada a ${newStatus}.`;

          this.cdr.markForCheck();
        },

        error: err => {
          console.error('Error cambiando estado:', err);
          this.error = 'No fue posible actualizar la reserva.';
          this.cdr.markForCheck();
        }
      });
  }

  // =====================================
  // 6. ESTADOS DISPONIBLES
  // =====================================

  getAvailableStatuses(status: string): string[] {

    if (!this.canManageBookings) {
      return [];
    }

    switch (status) {
      case 'SOLICITADA':
        return ['APROBADA', 'CANCELADA'];

      case 'APROBADA':
        return ['EN_PREPARACION', 'CANCELADA'];

      case 'EN_PREPARACION':
        return ['EN_USO', 'CANCELADA'];

      case 'EN_USO':
        return ['DEVUELTA'];

      default:
        return [];
    }
  }

  formatStatus(status: string): string {
    return status.replace(/_/g, ' ');
  }
}
