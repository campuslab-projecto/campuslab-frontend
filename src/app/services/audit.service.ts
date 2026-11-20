
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { protectedResources } from '../auth-config';

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

  // Auditoría mediante AWS API Gateway y el BFF
  private readonly apiUrl =
    `${protectedResources.api.endpoint}audit`;

  constructor(private http: HttpClient) {}

  // Obtener todos los eventos de auditoría
  getEvents(): Observable<AuditEvent[]> {
    return this.http.get<AuditEvent[]>(this.apiUrl);
  }

  // Filtrar eventos por reserva
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
