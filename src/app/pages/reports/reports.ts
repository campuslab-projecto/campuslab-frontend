
import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { forkJoin, finalize } from 'rxjs';

import {
  ReportService,
  ReportKpis,
  TopResource
} from '../../services/report.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css'
})
export class Reports implements OnInit {

  loading = false;
  loaded = false;
  error = '';

  kpis: ReportKpis | null = null;
  topResources: TopResource[] = [];

  lastUpdated: Date | null = null;

  constructor(
    private reportService: ReportService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {

    if (this.loading) {
      return;
    }

    this.loading = true;
    this.loaded = false;
    this.error = '';

    this.cdr.markForCheck();

    forkJoin({
      kpis: this.reportService.getKpis(),
      resources: this.reportService.getTopResources()
    })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: result => {

          this.kpis = result.kpis;

          this.topResources = Array.isArray(
            result.resources
          ) ? result.resources : [];

          this.loaded = true;
          this.lastUpdated = new Date();

          this.cdr.markForCheck();
        },

        error: err => {

          console.error(
            'Error consultando Reportería:',
            err
          );

          this.kpis = null;
          this.topResources = [];

          if (err.status === 401) {
            this.error =
              'La sesión no fue autorizada.';
          } else if (err.status === 403) {
            this.error =
              'No tienes permisos para consultar Reportería.';
          } else if (err.status === 404) {
            this.error =
              'No se encontró el endpoint de Reportería en el BFF.';
          } else if (err.status === 0) {
            this.error =
              'No fue posible conectar con Reportería.';
          } else {
            this.error =
              `No se pudieron cargar los indicadores (HTTP ${err.status}).`;
          }

          this.cdr.markForCheck();
        }
      });
  }

  trackResource(
    _index: number,
    resource: TopResource
  ): string {
    return resource.resourceId;
  }
}
