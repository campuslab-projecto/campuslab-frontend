
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { protectedResources } from '../auth-config';

export interface ReportKpis {
  totalEventos: number;
  reservasDistintas: number;
  eventosReservas: number;
  eventosOcupacion: number;
  recursosDistintos: number;
}

export interface TopResource {
  resourceId: string;
  totalReservas: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {

  private readonly apiUrl =
    `${protectedResources.api.endpoint}report`;

  constructor(
    private http: HttpClient
  ) {}

  getKpis(): Observable<ReportKpis> {
    return this.http.get<ReportKpis>(
      `${this.apiUrl}/kpis`
    );
  }

  getTopResources(): Observable<TopResource[]> {
    return this.http.get<TopResource[]>(
      `${this.apiUrl}/top-resources`
    );
  }
}
