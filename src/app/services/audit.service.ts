
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

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

  // MS Audit a traves de API Gateway y BFF
  private readonly apiUrl =
    'http://localhost:8080/api/audit';

  constructor(private http: HttpClient) {}

  // Obtener todos los eventos de auditoria
  getEvents(): Observable<AuditEvent[]> {
    return this.http.get<AuditEvent[]>(this.apiUrl);
  }

  // Filtrar eventos por reserva usando la consulta general
  getEventsByBookingId(
    bookingId: number
  ): Observable<AuditEvent[]> {
    return this.getEvents().pipe(
      map(events =>
        events.filter(event => event.bookingId === bookingId)
      )
    );
  }
}
