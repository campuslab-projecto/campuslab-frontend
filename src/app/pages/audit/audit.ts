
import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
  AuditService,
  AuditEvent
} from '../../services/audit.service';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit.html',
  styleUrl: './audit.css'
})
export class Audit implements OnInit {

  // ==========================================
  // DATOS DE AUDITORIA
  // ==========================================

  events: AuditEvent[] = [];

  loading = false;
  eventsLoaded = false;
  errorMessage = '';

  lastUpdated: Date | null = null;

  // ==========================================
  // BUSQUEDA Y FILTROS
  // ==========================================

  searchTerm = '';
  selectedEventType = 'TODOS';
  selectedStatus = 'TODOS';

  // ==========================================
  // DETALLE DEL EVENTO
  // ==========================================

  selectedEvent: AuditEvent | null = null;

  constructor(
    private auditService: AuditService,
    private cdr: ChangeDetectorRef
  ) {}

  // ==========================================
  // 1. INICIALIZAR
  // ==========================================

  ngOnInit(): void {
    this.loadEvents();
  }

  // ==========================================
  // 2. CONSULTAR EVENTOS DESDE EL BFF
  // ==========================================

  loadEvents(): void {

    if (this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.cdr.markForCheck();

    this.auditService.getEvents()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: (data: AuditEvent[]) => {

          this.events = Array.isArray(data)
            ? [...data]
            : [];

          this.eventsLoaded = true;
          this.lastUpdated = new Date();

          // Cerrar el detalle anterior para evitar
          // mostrar datos que ya no correspondan
          // al listado actualizado.
          this.selectedEvent = null;

          this.cdr.markForCheck();
        },

        error: error => {

          console.error(
            'Error al cargar auditoría:',
            error
          );

          this.eventsLoaded = false;
          this.events = [];
          this.selectedEvent = null;

          this.errorMessage =
            'No fue posible cargar los eventos de auditoría. Comprueba la conexión e inténtalo nuevamente.';

          this.cdr.markForCheck();
        }
      });
  }

  // ==========================================
  // 3. CONTADORES REALES
  // ==========================================

  get totalEvents(): number {
    return this.events.length;
  }

  get createdEvents(): number {

    return this.events.filter(
      event =>
        this.normalizeText(event.eventType) ===
        'BOOKING_CREATED'
    ).length;
  }

  get statusChangedEvents(): number {

    return this.events.filter(
      event =>
        this.normalizeText(event.eventType) ===
        'BOOKING_STATUS_CHANGED'
    ).length;
  }

  get otherEvents(): number {

    return this.totalEvents -
      this.createdEvents -
      this.statusChangedEvents;
  }

  // ==========================================
  // 4. OPCIONES DE FILTROS
  // ==========================================

  get eventTypes(): string[] {

    return [
      ...new Set(
        this.events
          .map(event => String(event.eventType ?? ''))
          .filter(type => type.length > 0)
      )
    ].sort();
  }

  get eventStatuses(): string[] {

    return [
      ...new Set(
        this.events
          .map(event => String(event.status ?? ''))
          .filter(status => status.length > 0)
      )
    ].sort();
  }

  // ==========================================
  // 5. FILTRAR EVENTOS
  // ==========================================

  get filteredEvents(): AuditEvent[] {

    const search = this.searchTerm
      .trim()
      .toLowerCase();

    return this.events.filter(event => {

      const searchableValues = [
        event.eventId,
        event.eventType,
        event.bookingId,
        event.status,
        event.timestamp,
        event.receivedAt
      ];

      const matchesSearch =
        !search ||
        searchableValues.some(value =>
          String(value ?? '')
            .toLowerCase()
            .includes(search)
        );

      const matchesEventType =
        this.selectedEventType === 'TODOS' ||
        event.eventType === this.selectedEventType;

      const matchesStatus =
        this.selectedStatus === 'TODOS' ||
        event.status === this.selectedStatus;

      return (
        matchesSearch &&
        matchesEventType &&
        matchesStatus
      );
    });
  }

  get hasActiveFilters(): boolean {

    return (
      this.searchTerm.trim().length > 0 ||
      this.selectedEventType !== 'TODOS' ||
      this.selectedStatus !== 'TODOS'
    );
  }

  clearFilters(): void {

    this.searchTerm = '';
    this.selectedEventType = 'TODOS';
    this.selectedStatus = 'TODOS';

    this.cdr.markForCheck();
  }

  // ==========================================
  // 6. SELECCIONAR EVENTO
  // ==========================================

  selectEvent(event: AuditEvent): void {

    if (
      this.selectedEvent?.eventId === event.eventId &&
      this.selectedEvent === event
    ) {
      this.selectedEvent = null;
    } else {
      this.selectedEvent = event;
    }

    this.cdr.markForCheck();
  }

  closeEventDetails(): void {

    this.selectedEvent = null;
    this.cdr.markForCheck();
  }

  // ==========================================
  // 7. PRESENTACION
  // ==========================================

  formatEventType(type: string): string {

    switch (this.normalizeText(type)) {

      case 'BOOKING_CREATED':
        return 'Reserva creada';

      case 'BOOKING_STATUS_CHANGED':
        return 'Cambio de estado';

      default:
        return String(type || 'No disponible')
          .replace(/_/g, ' ');
    }
  }

  formatStatus(status: string): string {

    return String(status || 'Sin estado')
      .replace(/_/g, ' ');
  }

  getEventTypeClass(type: string): string {

    switch (this.normalizeText(type)) {

      case 'BOOKING_CREATED':
        return 'event-created';

      case 'BOOKING_STATUS_CHANGED':
        return 'event-changed';

      default:
        return 'event-other';
    }
  }

  getStatusClass(status: string): string {

    switch (this.normalizeText(status)) {

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

  private normalizeText(value: unknown): string {

    return String(value ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
  }

  // ==========================================
  // 8. OPTIMIZACION DE TABLA
  // ==========================================

  trackEvent(
    index: number,
    event: AuditEvent
  ): string {

    return `${String(event.eventId ?? '')}-${index}`;
  }
}
