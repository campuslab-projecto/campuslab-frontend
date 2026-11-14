
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuditEvent {
  id: number;
  eventId: string;
  eventType: string;
  bookingId: number;
  status: string;
  timestamp: string;
  receivedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuditService {

  // BFF local para pruebas de Auditoría.
  private readonly apiUrl =
    'http://localhost:8080/api/audit';

  constructor(private http: HttpClient) {}

  // Obtener todos los eventos de Auditoría.
  getEvents(): Observable<AuditEvent[]> {
    return this.http.get<AuditEvent[]>(this.apiUrl);
  }

  // Obtener eventos de una reserva específica.
  getEventsByBookingId(
    bookingId: number
  ): Observable<AuditEvent[]> {

    return this.http.get<AuditEvent[]>(
      `${this.apiUrl}/bookings/${bookingId}`
    );
  }
}
