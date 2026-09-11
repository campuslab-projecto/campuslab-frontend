import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { BookingService } from '../../services/booking.service';
import { Booking } from '../../models/booking';

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bookings.html'
})
export class Bookings implements OnInit {
  bookings: Booking[] = [];
  loading = false;
  error = '';

  newBooking: Booking = {
    userEmail: 'estudiante@duocuc.cl',
    resourceId: 'LAB-REDES-01',
    status: 'SOLICITADA'
  };

  constructor(private bookingService: BookingService) {}

  ngOnInit(): void {
    this.loadBookings();
  }

 loadBookings(): void {
  console.log('1) Entró a loadBookings');

  this.loading = true;
  this.error = '';

  this.bookingService.getBookings().subscribe({
    next: data => {
      console.log('2) Reservas recibidas:', data);

      this.bookings = data;
      this.loading = false;

      console.log('3) Loading después de recibir datos:', this.loading);
    },
    error: err => {
      console.error('2) Error consultando reservas:', err);

      this.error = 'No fue posible cargar reservas.';
      this.loading = false;

      console.log('3) Loading después del error:', this.loading);
    }
  });
}

  createBooking(): void {
    this.error = '';

    this.bookingService.createBooking(this.newBooking).subscribe({
      next: () => {
        this.newBooking = {
          userEmail: 'estudiante@duocuc.cl',
          resourceId: 'LAB-REDES-01',
          status: 'SOLICITADA'
        };

        this.loadBookings();
      },
      error: err => {
        console.error('Error creando reserva', err);
        this.error = 'No fue posible crear la reserva.';
      }
    });
  }
}