
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Booking } from '../models/booking';

@Injectable({
  providedIn: 'root'
})
export class BookingService {

  private readonly apiUrl =
    'https://ok83lxm1s3.execute-api.us-east-1.amazonaws.com/api/bookings';

  constructor(private http: HttpClient) {}

  // Obtener todas las reservas
  getBookings(): Observable<Booking[]> {
    return this.http.get<Booking[]>(this.apiUrl);
  }

  // Crear una nueva reserva
  createBooking(booking: Booking): Observable<Booking> {
    return this.http.post<Booking>(this.apiUrl, booking);
  }

  // Cambiar el estado de una reserva existente
  updateStatus(
    id: number,
    status: Booking['status']
  ): Observable<Booking> {

    return this.http.put<Booking>(
      `${this.apiUrl}/${id}/status`,
      { status }
    );
  }
}
