
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

  searchTerm = '';

  events: AuditEvent[] = [];

  loading = false;

  errorMessage = '';

  constructor(
    private auditService: AuditService,
    private cdr: ChangeDetectorRef
  ) {}

  // ==========================================
  // 1. CARGAR EVENTOS AL ABRIR LA PANTALLA
  // ==========================================

  ngOnInit(): void {
    this.loadEvents();
  }

  // ==========================================
  // 2. CONSULTAR EVENTOS REALES DESDE EL BFF
  // ==========================================

  loadEvents(): void {

    if (this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.cdr.detectChanges();

    this.auditService.getEvents()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({

        next: (data) => {

          this.events = data;

          console.log(
            'Eventos de auditoría recibidos:',
            data
          );
        },

        error: (error) => {

          console.error(
            'Error al cargar auditoría:',
            error
          );

          this.errorMessage =
            'No fue posible cargar los eventos de auditoría.';
        }

      });
  }

  // ==========================================
  // 3. FILTRAR LOS EVENTOS
  // ==========================================

  get filteredEvents(): AuditEvent[] {

    const search =
      this.searchTerm.trim().toLowerCase();

    if (!search) {
      return this.events;
    }

    return this.events.filter(event =>

      event.eventId.toLowerCase().includes(search) ||

      event.eventType.toLowerCase().includes(search) ||

      String(event.bookingId).includes(search) ||

      event.status.toLowerCase().includes(search)

    );
  }
}
