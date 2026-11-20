
import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectorRef,
  OnInit
} from '@angular/core';

import {
  HttpClient,
  HttpErrorResponse
} from '@angular/common/http';

import { MsalService } from '@azure/msal-angular';
import { finalize } from 'rxjs';
import { protectedResources } from '../../auth-config';

const API_URL = `${protectedResources.api.endpoint}kafka`;

type TopicFilter = 'all' | 'normal' | 'dlt';

interface KafkaPartition {
  partition: number;
  leader: number;
  replicas: number[];
  isr: number[];
}

interface KafkaTopicDetails {
  name: string;
  partitionCount: number;
  partitions: KafkaPartition[];
}

interface KafkaDltPartition {
  partition: number;
  beginningOffset: number;
  endOffset: number;
  estimatedRecords: number;
}

interface KafkaDltTopic {
  name: string;
  partitionCount: number;
  estimatedRecords: number;
  partitions: KafkaDltPartition[];
}

interface KafkaDltOffsets {
  topicCount: number;
  metric: string;
  totalEstimatedRecords: number;
  topics: KafkaDltTopic[];
}

@Component({
  selector: 'app-kafka-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kafka-admin.html',
  styleUrl: './kafka-admin.css'
})
export class KafkaAdmin implements OnInit {

  // ========================================
  // SEGURIDAD
  // ========================================

  checkingRole = true;
  isAdmin = false;

  // ========================================
  // TOPICOS
  // ========================================

  loading = false;
  topicsLoaded = false;
  error = '';
  topics: string[] = [];

  searchTerm = '';
  activeFilter: TopicFilter = 'all';

  // ========================================
  // DETALLES DEL TOPICO
  // ========================================

  selectedTopic = '';
  topicDetails: KafkaTopicDetails | null = null;
  loadingDetails = false;
  detailsError = '';

  // ========================================
  // GRUPOS DE CONSUMIDORES
  // ========================================

  consumerGroups: string[] = [];
  groupsLoaded = false;
  loadingGroups = false;
  groupsError = '';

  // ========================================
  // MONITOREO DLT
  // ========================================

  dltOffsets: KafkaDltOffsets | null = null;
  dltLoaded = false;
  loadingDlt = false;
  dltError = '';

  constructor(
    private msal: MsalService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.checkAdminRole();
  }

  // ========================================
  // VERIFICAR ROL ADMIN
  // ========================================

  private checkAdminRole(): void {

    const account =
      this.msal.instance.getActiveAccount() ??
      this.msal.instance.getAllAccounts()[0];

    if (!account) {
      this.error = 'No hay una sesión activa.';
      this.checkingRole = false;
      this.cdr.markForCheck();
      return;
    }

    this.msal.acquireTokenSilent({
      account,
      scopes: protectedResources.api.scopes
    }).subscribe({

      next: result => {

        try {
          const payload = result.accessToken.split('.')[1];

          if (!payload) {
            throw new Error('Token no válido');
          }

          const normalized = payload
            .replace(/-/g, '+')
            .replace(/_/g, '/');

          const padded = normalized.padEnd(
            Math.ceil(normalized.length / 4) * 4,
            '='
          );

          const bytes = Uint8Array.from(
            atob(padded),
            char => char.charCodeAt(0)
          );

          const claims = JSON.parse(
            new TextDecoder().decode(bytes)
          ) as Record<string, unknown>;

          const rolesClaim = claims['roles'];

          const roles: string[] = Array.isArray(rolesClaim)
            ? rolesClaim.map(
                (role: unknown) => String(role)
              )
            : rolesClaim
              ? [String(rolesClaim)]
              : [];

          this.isAdmin = roles.some(role => {

            const clean = role
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim()
              .toUpperCase();

            return clean === 'ADMIN' ||
                   clean === 'ADMINISTRADOR';
          });

          if (!this.isAdmin) {
            this.error =
              'Acceso restringido. Se requiere el rol ADMIN.';
          }

        } catch (err) {

          console.error('Error verificando roles:', err);
          this.isAdmin = false;
          this.error = 'No se pudieron verificar los roles.';
        }

        this.checkingRole = false;
        this.cdr.markForCheck();
      },

      error: err => {

        console.error('Error verificando ADMIN:', err);

        this.isAdmin = false;
        this.error =
          'No fue posible verificar el rol ADMIN.';

        this.checkingRole = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ========================================
  // ESTADISTICAS DE TOPICOS
  // ========================================

  get normalTopicsCount(): number {
    return this.topics.filter(
      topic => !this.isDlt(topic)
    ).length;
  }

  get dltTopicsCount(): number {
    return this.topics.filter(
      topic => this.isDlt(topic)
    ).length;
  }

  get filteredTopics(): string[] {

    const search = this.searchTerm
      .trim()
      .toLowerCase();

    return this.topics.filter(topic => {

      const matchesSearch =
        topic.toLowerCase().includes(search);

      const matchesFilter =
        this.activeFilter === 'all' ||
        (
          this.activeFilter === 'dlt' &&
          this.isDlt(topic)
        ) ||
        (
          this.activeFilter === 'normal' &&
          !this.isDlt(topic)
        );

      return matchesSearch && matchesFilter;
    });
  }

  isDlt(topic: string): boolean {
    return topic.toUpperCase().endsWith('.DLT');
  }

  setFilter(filter: TopicFilter): void {
    this.activeFilter = filter;
    this.cdr.markForCheck();
  }

  updateSearch(value: string): void {
    this.searchTerm = value;
    this.cdr.markForCheck();
  }

  trackTopic(_index: number, topic: string): string {
    return topic;
  }

  // ========================================
  // CONSULTAR TOPICOS
  // ========================================

  loadTopics(): void {

    if (
      !this.isAdmin ||
      this.loading ||
      this.loadingDetails
    ) {
      return;
    }

    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    this.http.get<string[]>(`${API_URL}/topics`)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: topics => {

          this.topics = Array.isArray(topics)
            ? [...topics]
            : [];

          this.topicsLoaded = true;

          if (
            this.selectedTopic &&
            !this.topics.includes(this.selectedTopic)
          ) {
            this.selectedTopic = '';
            this.topicDetails = null;
            this.detailsError = '';
          }

          this.cdr.markForCheck();
        },

        error: (err: HttpErrorResponse) => {

          this.error = this.getErrorMessage(err);
          this.cdr.markForCheck();
        }
      });
  }

  // ========================================
  // DETALLE DEL TOPICO
  // ========================================

  loadTopicDetails(topicName: string): void {

    if (!this.isAdmin || this.loadingDetails) {
      return;
    }

    this.selectedTopic = topicName;
    this.topicDetails = null;
    this.detailsError = '';
    this.loadingDetails = true;

    this.cdr.markForCheck();

    const url =
      `${API_URL}/topics/${encodeURIComponent(topicName)}`;

    this.http.get<KafkaTopicDetails>(url)
      .pipe(
        finalize(() => {
          this.loadingDetails = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: details => {
          this.topicDetails = details;
          this.cdr.markForCheck();
        },

        error: (err: HttpErrorResponse) => {
          this.detailsError = this.getErrorMessage(err);
          this.cdr.markForCheck();
        }
      });
  }

  closeTopicDetails(): void {
    this.selectedTopic = '';
    this.topicDetails = null;
    this.detailsError = '';
  }

  // ========================================
  // GRUPOS DE CONSUMIDORES
  // ========================================

  loadConsumerGroups(): void {

    if (!this.isAdmin || this.loadingGroups) {
      return;
    }

    this.loadingGroups = true;
    this.groupsError = '';
    this.cdr.markForCheck();

    this.http.get<string[]>(`${API_URL}/groups`)
      .pipe(
        finalize(() => {
          this.loadingGroups = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: groups => {

          this.consumerGroups = Array.isArray(groups)
            ? [...groups]
            : [];

          this.groupsLoaded = true;
          this.cdr.markForCheck();
        },

        error: (err: HttpErrorResponse) => {

          this.groupsError = this.getErrorMessage(err);
          this.cdr.markForCheck();
        }
      });
  }

  getConsumerGroupDescription(group: string): string {

    const normalized = group.toLowerCase();

    if (normalized.includes('audit')) {
      return 'Grupo asociado al microservicio de Auditoría.';
    }

    if (normalized.includes('report')) {
      return 'Grupo asociado al microservicio de Reportes.';
    }

    return 'Grupo registrado en Apache Kafka.';
  }

  trackGroup(_index: number, group: string): string {
    return group;
  }

  // ========================================
  // OFFSETS DE DEAD LETTER TOPICS
  // ========================================

  loadDltOffsets(): void {

    if (
      !this.isAdmin ||
      this.checkingRole ||
      this.loadingDlt
    ) {
      return;
    }

    this.loadingDlt = true;
    this.dltError = '';
    this.cdr.markForCheck();

    this.http.get<KafkaDltOffsets>(
      `${API_URL}/dlt/offsets`
    )
      .pipe(
        finalize(() => {
          this.loadingDlt = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({

        next: result => {

          this.dltOffsets = result;
          this.dltLoaded = true;
          this.cdr.markForCheck();
        },

        error: (err: HttpErrorResponse) => {

          this.dltError = this.getErrorMessage(err);
          this.cdr.markForCheck();
        }
      });
  }

  trackDltTopic(
    _index: number,
    topic: KafkaDltTopic
  ): string {
    return topic.name;
  }

  trackDltPartition(
    _index: number,
    partition: KafkaDltPartition
  ): number {
    return partition.partition;
  }

  // ========================================
  // MENSAJES DE ERROR
  // ========================================

  private getErrorMessage(
    err: HttpErrorResponse
  ): string {

    if (err.status === 401) {
      return 'Tu sesión no está autorizada. Vuelve a iniciar sesión.';
    }

    if (err.status === 403) {
      return 'Acceso denegado. Se requiere el rol ADMIN.';
    }

    if (err.status === 404) {
      return 'No se encontró el recurso solicitado en Kafka Admin.';
    }

    if (err.status === 0) {
      return 'No fue posible conectar con el servidor.';
    }

    return `Error al consultar Kafka (HTTP ${err.status}).`;
  }
}
