
import { CommonModule } from '@angular/common';

import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import {
  HttpClient,
  HttpErrorResponse
} from '@angular/common/http';

import { MsalService } from '@azure/msal-angular';
import { finalize, Observable } from 'rxjs';
import { protectedResources } from '../../auth-config';

const API_URL = `${protectedResources.api.endpoint}kafka`;

// ==========================================
// TIPOS
// ==========================================

type TopicFilter = 'all' | 'normal' | 'dlt';

type ManagementMode =
  | 'create'
  | 'config'
  | 'partitions'
  | 'delete';

type ManagementOperation =
  | 'create'
  | 'config'
  | 'partitions'
  | 'delete';

type KafkaEventType =
  | 'BOOKING_CREATED'
  | 'BOOKING_STATUS_CHANGED'
  | 'OCCUPANCY_STARTED'
  | 'OCCUPANCY_ENDED';

// ==========================================
// INTERFACES
// ==========================================

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

interface TopicConfigResponse {
  topic: string;
  config: Record<string, string>;
}

interface ManagementResult {
  title: string;
  topic: string;
  details: string[];
  verified: boolean;
}

interface ManagementExpected {
  partitions?: number;
  replication?: number;
  retentionMs?: number;
  cleanupPolicy?: string;
}

// ==========================================
// COMPONENTE
// ==========================================

@Component({
  selector: 'app-kafka-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kafka-admin.html',
  styleUrl: './kafka-admin.css'
})
export class KafkaAdmin implements OnInit {

  // ==========================================
  // SEGURIDAD
  // ==========================================

  checkingRole = true;
  isAdmin = false;

  // ==========================================
  // TOPICOS
  // ==========================================

  loading = false;
  topicsLoaded = false;
  error = '';

  topics: string[] = [];

  searchTerm = '';
  activeFilter: TopicFilter = 'all';

  // ==========================================
  // DETALLES DEL TOPICO
  // ==========================================

  selectedTopic = '';
  topicDetails: KafkaTopicDetails | null = null;

  loadingDetails = false;
  detailsError = '';

  // ==========================================
  // GRUPOS DE CONSUMIDORES
  // ==========================================

  consumerGroups: string[] = [];

  groupsLoaded = false;
  loadingGroups = false;
  groupsError = '';

  // ==========================================
  // MONITOREO DLT
  // ==========================================

  dltOffsets: KafkaDltOffsets | null = null;

  dltLoaded = false;
  loadingDlt = false;
  dltError = '';

  // ==========================================
  // ADMINISTRACION DE TOPICOS
  // ==========================================

  managementMode: ManagementMode = 'create';

  managementTopicName =
    'campuslab.demo.ep5.admin-test';

  managementPartitions = 3;
  managementReplicationFactor = 1;

  managementRetentionDays = 7;

  managementCleanupPolicy:
    'delete' | 'compact' = 'delete';

  managementConfirmation = '';

  managementBusy = false;
  managementConfigLoading = false;

  managementCurrentConfig:
    Record<string, string> | null = null;

  managementCurrentPartitions:
    number | null = null;

  managementError = '';
  managementSuccess = '';

  managementResult: ManagementResult | null = null;

  // ==========================================
  // PRODUCTOR KAFKA: VISTA PREVIA
  // ==========================================

  eventType: KafkaEventType = 'BOOKING_CREATED';

  eventBookingId = '';
  eventResourceId = '';

  showEventPreview = false;

  // ==========================================
  // CONSTRUCTOR
  // ==========================================

  constructor(
    private msal: MsalService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.checkAdminRole();
  }

  // ==========================================
  // ACTUALIZAR INTERFAZ
  // ==========================================

  private refreshView(): void {
    this.cdr.detectChanges();
  }

  // ==========================================
  // VERIFICAR ROL ADMIN
  // ==========================================

  private checkAdminRole(): void {

    const account =
      this.msal.instance.getActiveAccount() ??
      this.msal.instance.getAllAccounts()[0];

    if (!account) {

      this.error = 'No hay una sesión activa.';
      this.checkingRole = false;

      this.refreshView();
      return;
    }

    this.msal.acquireTokenSilent({
      account,
      scopes: protectedResources.api.scopes
    }).subscribe({

      next: result => {

        try {

          const payload =
            result.accessToken.split('.')[1];

          if (!payload) {
            throw new Error('JWT inválido');
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

          const claim = claims['roles'];

          const roles: string[] =
            Array.isArray(claim)
              ? claim.map(String)
              : claim
                ? [String(claim)]
                : [];

          this.isAdmin = roles.some(role => {

            const clean = role
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .trim()
              .toUpperCase();

            return (
              clean === 'ADMIN' ||
              clean === 'ADMINISTRADOR'
            );
          });

          if (!this.isAdmin) {
            this.error =
              'Acceso restringido. Se requiere el rol ADMIN.';
          }

        } catch (err) {

          console.error(
            'Error verificando roles:',
            err
          );

          this.isAdmin = false;

          this.error =
            'No se pudieron verificar los roles.';
        }

        this.checkingRole = false;
        this.refreshView();
      },

      error: err => {

        console.error(
          'Error verificando ADMIN:',
          err
        );

        this.isAdmin = false;
        this.checkingRole = false;

        this.error =
          'No fue posible verificar el rol ADMIN.';

        this.refreshView();
      }
    });
  }

  // ==========================================
  // ESTADISTICAS DE TOPICOS
  // ==========================================

  isDlt(topic: string): boolean {
    return topic.toUpperCase().endsWith('.DLT');
  }

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
          this.activeFilter === 'normal' &&
          !this.isDlt(topic)
        ) ||
        (
          this.activeFilter === 'dlt' &&
          this.isDlt(topic)
        );

      return (
        matchesSearch &&
        matchesFilter
      );
    });
  }

  setFilter(filter: TopicFilter): void {

    this.activeFilter = filter;
    this.refreshView();
  }

  updateSearch(value: string): void {

    this.searchTerm = value;
    this.refreshView();
  }

  trackTopic(
    _index: number,
    topic: string
  ): string {
    return topic;
  }

  // ==========================================
  // LISTAR TOPICOS
  // ==========================================

  loadTopics(): void {

    if (
      !this.isAdmin ||
      this.loading
    ) {
      return;
    }

    this.loading = true;
    this.error = '';

    this.refreshView();

    this.http.get<string[]>(
      `${API_URL}/topics`
    )
    .pipe(
      finalize(() => {

        this.loading = false;
        this.refreshView();
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
          this.closeTopicDetails();
        }

        this.refreshView();
      },

      error: (err: HttpErrorResponse) => {

        this.error = this.getErrorMessage(err);
        this.refreshView();
      }
    });
  }

  // ==========================================
  // DETALLE DEL TOPICO
  // ==========================================

  loadTopicDetails(name: string): void {

    if (
      !this.isAdmin ||
      this.loadingDetails
    ) {
      return;
    }

    this.selectedTopic = name;

    this.topicDetails = null;
    this.detailsError = '';

    this.loadingDetails = true;
    this.refreshView();

    this.http.get<KafkaTopicDetails>(
      `${API_URL}/topics/${encodeURIComponent(name)}`
    )
    .pipe(
      finalize(() => {

        this.loadingDetails = false;
        this.refreshView();
      })
    )
    .subscribe({

      next: details => {

        if (this.selectedTopic === name) {
          this.topicDetails = details;
        }

        this.refreshView();
      },

      error: (err: HttpErrorResponse) => {

        if (this.selectedTopic === name) {
          this.detailsError =
            this.getErrorMessage(err);
        }

        this.refreshView();
      }
    });
  }

  closeTopicDetails(): void {

    this.selectedTopic = '';
    this.topicDetails = null;
    this.detailsError = '';

    this.refreshView();
  }

  // ==========================================
  // GRUPOS DE CONSUMIDORES
  // ==========================================

  loadConsumerGroups(): void {

    if (
      !this.isAdmin ||
      this.loadingGroups
    ) {
      return;
    }

    this.loadingGroups = true;
    this.groupsError = '';

    this.refreshView();

    this.http.get<string[]>(
      `${API_URL}/groups`
    )
    .pipe(
      finalize(() => {

        this.loadingGroups = false;
        this.refreshView();
      })
    )
    .subscribe({

      next: groups => {

        this.consumerGroups =
          Array.isArray(groups)
            ? [...groups]
            : [];

        this.groupsLoaded = true;

        this.refreshView();
      },

      error: (err: HttpErrorResponse) => {

        this.groupsError =
          this.getErrorMessage(err);

        this.refreshView();
      }
    });
  }

  getConsumerGroupDescription(
    group: string
  ): string {

    const normalized =
      group.toLowerCase();

    if (normalized.includes('audit')) {

      return 'Grupo asociado al microservicio de Auditoría.';
    }

    if (normalized.includes('report')) {

      return 'Grupo asociado al microservicio de Reportes.';
    }

    return 'Grupo registrado en Apache Kafka.';
  }

  trackGroup(
    _index: number,
    group: string
  ): string {
    return group;
  }

  // ==========================================
  // MONITOREO DLT
  // ==========================================

  loadDltOffsets(): void {

    if (
      !this.isAdmin ||
      this.loadingDlt
    ) {
      return;
    }

    this.loadingDlt = true;
    this.dltError = '';

    this.refreshView();

    this.http.get<KafkaDltOffsets>(
      `${API_URL}/dlt/offsets`
    )
    .pipe(
      finalize(() => {

        this.loadingDlt = false;
        this.refreshView();
      })
    )
    .subscribe({

      next: result => {

        this.dltOffsets = result;
        this.dltLoaded = true;

        this.refreshView();
      },

      error: (err: HttpErrorResponse) => {

        this.dltError =
          this.getErrorMessage(err);

        this.refreshView();
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

  // ==========================================
  // VALIDACIONES ADMINISTRATIVAS
  // ==========================================

  isDemoTopic(name: string): boolean {

    return /^campuslab\.demo\.[a-z0-9._-]{3,100}$/
      .test(name);
  }

  get validDemoTopic(): boolean {

    return this.isDemoTopic(
      this.managementTopicName.trim()
    );
  }

  get canManageTopic(): boolean {

    return (
      this.isAdmin &&
      this.validDemoTopic &&
      !this.managementBusy &&
      !this.managementConfigLoading
    );
  }

  get canCreateTopic(): boolean {

    return (
      this.canManageTopic &&
      Number.isInteger(this.managementPartitions) &&
      this.managementPartitions >= 1 &&
      this.managementPartitions <= 6 &&
      this.managementReplicationFactor === 1
    );
  }

  get canUpdateConfig(): boolean {

    return (
      this.canManageTopic &&
      Number.isInteger(this.managementRetentionDays) &&
      this.managementRetentionDays >= 1 &&
      this.managementRetentionDays <= 30
    );
  }

  get canIncreasePartitions(): boolean {

    return (
      this.canManageTopic &&
      this.managementCurrentPartitions !== null &&
      Number.isInteger(this.managementPartitions) &&
      this.managementPartitions >
        this.managementCurrentPartitions &&
      this.managementPartitions <= 6
    );
  }

  get canDeleteTopic(): boolean {

    return (
      this.canManageTopic &&
      this.managementConfirmation ===
        this.managementTopicName.trim()
    );
  }

  // ==========================================
  // CAMBIAR MODO DE ADMINISTRACION
  // ==========================================

  changeManagementMode(
    value: ManagementMode
  ): void {

    if (this.managementBusy) {
      return;
    }

    this.managementMode = value;

    this.clearManagementMessages();

    this.managementConfirmation = '';

    this.refreshView();
  }

  changeManagementName(
    value: string
  ): void {

    if (this.managementBusy) {
      return;
    }

    this.managementTopicName = value;

    this.managementCurrentConfig = null;
    this.managementCurrentPartitions = null;

    this.managementConfirmation = '';

    this.clearManagementMessages();
    this.refreshView();
  }

  changeManagementPartitions(
    value: string
  ): void {

    if (this.managementBusy) {
      return;
    }

    this.managementPartitions =
      value.trim() === ''
        ? NaN
        : Number(value);

    this.refreshView();
  }

  changeManagementRetention(
    value: string
  ): void {

    if (this.managementBusy) {
      return;
    }

    this.managementRetentionDays =
      value.trim() === ''
        ? NaN
        : Number(value);

    this.refreshView();
  }

  changeManagementCleanup(
    value: string
  ): void {

    if (this.managementBusy) {
      return;
    }

    if (
      value === 'delete' ||
      value === 'compact'
    ) {
      this.managementCleanupPolicy = value;
    }

    this.refreshView();
  }

  changeManagementConfirmation(
    value: string
  ): void {

    this.managementConfirmation = value;
    this.refreshView();
  }

  // ==========================================
  // LIMPIAR MENSAJES ADMINISTRATIVOS
  // ==========================================

  private clearManagementMessages(): void {

    this.managementError = '';
    this.managementSuccess = '';
    this.managementResult = null;
  }

  // ==========================================
  // SELECCIONAR TOPICO DESDE LISTADO
  // ==========================================

  selectManagedTopic(
    topic: string
  ): void {

    if (
      !this.isDemoTopic(topic) ||
      this.managementBusy
    ) {
      return;
    }

    this.changeManagementName(topic);
    this.changeManagementMode('config');

    this.loadManagementConfig();
    this.loadManagementPartitionCount();
  }

  // ==========================================
  // CONSULTAR CONFIGURACION ACTUAL
  // ==========================================

  loadManagementConfig(): void {

    if (!this.canManageTopic) {
      return;
    }

    const name =
      this.managementTopicName.trim();

    this.managementConfigLoading = true;
    this.managementCurrentConfig = null;

    this.managementError = '';

    this.refreshView();

    this.http.get<TopicConfigResponse>(
      `${API_URL}/topics/${encodeURIComponent(name)}/config`
    )
    .pipe(
      finalize(() => {

        this.managementConfigLoading = false;
        this.refreshView();
      })
    )
    .subscribe({

      next: response => {

        if (
          name !== this.managementTopicName.trim()
        ) {
          return;
        }

        this.managementCurrentConfig =
          response.config ?? {};

        const rawRetention =
          this.managementCurrentConfig['retention.ms'];

        const ms = Number(rawRetention);

        if (
          rawRetention !== undefined &&
          Number.isInteger(ms) &&
          ms >= 86400000 &&
          ms <= 2592000000 &&
          ms % 86400000 === 0
        ) {
          this.managementRetentionDays =
            ms / 86400000;
        }

        const policy =
          this.managementCurrentConfig['cleanup.policy'];

        if (
          policy === 'delete' ||
          policy === 'compact'
        ) {
          this.managementCleanupPolicy =
            policy;
        }

        this.refreshView();
      },

      error: (err: HttpErrorResponse) => {

        if (
          name === this.managementTopicName.trim()
        ) {
          this.managementError =
            this.getErrorMessage(err);
        }

        this.refreshView();
      }
    });
  }

  // ==========================================
  // CONSULTAR PARTICIONES ACTUALES
  // ==========================================

  loadManagementPartitionCount(): void {

    if (
      !this.isAdmin ||
      !this.validDemoTopic
    ) {
      return;
    }

    const name =
      this.managementTopicName.trim();

    this.managementCurrentPartitions = null;

    this.refreshView();

    this.http.get<KafkaTopicDetails>(
      `${API_URL}/topics/${encodeURIComponent(name)}`
    )
    .subscribe({

      next: details => {

        if (
          name === this.managementTopicName.trim()
        ) {
          this.managementCurrentPartitions =
            details.partitionCount;
        }

        this.refreshView();
      },

      error: (err: HttpErrorResponse) => {

        if (
          name === this.managementTopicName.trim()
        ) {
          this.managementError =
            this.getErrorMessage(err);
        }

        this.refreshView();
      }
    });
  }

  // ==========================================
  // CREAR TOPICO
  // ==========================================

  createManagedTopic(): void {

    if (!this.canCreateTopic) {
      return;
    }

    const name =
      this.managementTopicName.trim();

    const partitions =
      this.managementPartitions;

    const replication =
      this.managementReplicationFactor;

    this.runManagementRequest(
      this.http.post(`${API_URL}/topics`, {
        name,
        partitions,
        replicationFactor: replication
      }),
      {
        title: 'Tópico creado correctamente',
        topic: name,
        details: [
          `Particiones: ${partitions}`,
          `Factor de replicación: ${replication}`
        ],
        verified: false
      },
      'create',
      {
        partitions,
        replication
      }
    );
  }

  // ==========================================
  // MODIFICAR CONFIGURACION
  // ==========================================

  updateManagedConfig(): void {

    if (!this.canUpdateConfig) {
      return;
    }

    const name =
      this.managementTopicName.trim();

    const oldRetention =
      this.managementCurrentConfig?.['retention.ms'];

    const oldPolicy =
      this.managementCurrentConfig?.['cleanup.policy'];

    const newDays =
      this.managementRetentionDays;

    const newPolicy =
      this.managementCleanupPolicy;

    const oldDaysText =
      oldRetention !== undefined &&
      Number.isFinite(Number(oldRetention))
        ? `${Number(oldRetention) / 86400000} días`
        : 'No consultado';

    this.runManagementRequest(
      this.http.put(
        `${API_URL}/topics/${encodeURIComponent(name)}/config`,
        {
          retentionMs: newDays * 86400000,
          cleanupPolicy: newPolicy
        }
      ),
      {
        title: 'Configuración actualizada correctamente',
        topic: name,
        details: [
          `Retención anterior: ${oldDaysText}`,
          `Nueva retención: ${newDays} días`,
          `Política anterior: ${oldPolicy ?? 'No consultada'}`,
          `Nueva política: ${newPolicy}`
        ],
        verified: false
      },
      'config',
      {
        retentionMs: newDays * 86400000,
        cleanupPolicy: newPolicy
      }
    );
  }

  // ==========================================
  // AUMENTAR PARTICIONES
  // ==========================================

  increaseManagedPartitions(): void {

    if (!this.canIncreasePartitions) {
      return;
    }

    const name =
      this.managementTopicName.trim();

    const previous =
      this.managementCurrentPartitions;

    const next =
      this.managementPartitions;

    this.runManagementRequest(
      this.http.patch(
        `${API_URL}/topics/${encodeURIComponent(name)}/partitions`,
        {
          partitions: next
        }
      ),
      {
        title: 'Particiones actualizadas correctamente',
        topic: name,
        details: [
          `Particiones anteriores: ${previous}`,
          `Particiones nuevas: ${next}`
        ],
        verified: false
      },
      'partitions',
      {
        partitions: next
      }
    );
  }

  // ==========================================
  // ELIMINAR TOPICO
  // ==========================================

  deleteManagedTopic(): void {

    if (!this.canDeleteTopic) {
      return;
    }

    const name =
      this.managementTopicName.trim();

    this.runManagementRequest(
      this.http.delete(
        `${API_URL}/topics/${encodeURIComponent(name)}` +
        `?confirm=${encodeURIComponent(name)}`
      ),
      {
        title: 'Eliminación aceptada por Kafka Admin',
        topic: name,
        details: [
          'Solicitud de eliminación procesada.'
        ],
        verified: false
      },
      'delete',
      {}
    );
  }

  // ==========================================
  // EJECUTAR SOLICITUD ADMINISTRATIVA
  // ==========================================

  private runManagementRequest(
    request: Observable<unknown>,
    result: ManagementResult,
    operation: ManagementOperation,
    expected: ManagementExpected
  ): void {

    // Bloqueamos temporalmente el formulario.

    this.managementBusy = true;

    this.clearManagementMessages();

    this.refreshView();

    request.subscribe({

      next: () => {

        // IMPORTANTE:
        // El backend ya confirmó la escritura.
        // Dejamos de mostrar "Procesando..."
        // y enseñamos el resultado inmediatamente.

        this.managementBusy = false;

        this.managementResult = {
          ...result,
          verified: false,
          details: [
            ...result.details,
            'Solicitud aceptada por Kafka Admin.',
            'Verificando el estado final del tópico...'
          ]
        };

        this.managementSuccess =
          result.title;

        this.managementConfirmation = '';

        // Forzamos la actualización visual.

        this.refreshView();

        // Ahora verificamos con una consulta GET.
        // El mensaje inicial ya debe estar visible.

        this.verifyManagementResult(
          result,
          operation,
          expected
        );
      },

      error: (err: HttpErrorResponse) => {

        this.managementBusy = false;

        this.managementResult = null;
        this.managementSuccess = '';

        this.managementError =
          this.getErrorMessage(err);

        this.refreshView();
      }
    });
  }

  // ==========================================
  // VERIFICAR RESULTADO EN KAFKA
  // ==========================================

  private verifyManagementResult(
    result: ManagementResult,
    operation: ManagementOperation,
    expected: ManagementExpected
  ): void {

    const name = result.topic;

    let verification: Observable<unknown>;

    // Elegimos la consulta de verificación
    // según la operación realizada.

    if (operation === 'config') {

      verification = this.http.get<TopicConfigResponse>(
        `${API_URL}/topics/${encodeURIComponent(name)}/config`
      );

    } else if (operation === 'delete') {

      verification = this.http.get<string[]>(
        `${API_URL}/topics`
      );

    } else {

      verification = this.http.get<KafkaTopicDetails>(
        `${API_URL}/topics/${encodeURIComponent(name)}`
      );
    }

    verification.subscribe({

      next: response => {

        let verified = false;

        // ======================================
        // VERIFICAR CONFIGURACION
        // ======================================

        if (operation === 'config') {

          const data =
            response as TopicConfigResponse;

          const config =
            data.config ?? {};

          verified =
            config['retention.ms'] ===
              String(expected.retentionMs) &&
            config['cleanup.policy'] ===
              expected.cleanupPolicy;

          if (
            name === this.managementTopicName.trim()
          ) {
            this.managementCurrentConfig =
              config;
          }

        // ======================================
        // VERIFICAR ELIMINACION
        // ======================================

        } else if (operation === 'delete') {

          const topics =
            response as string[];

          verified =
            Array.isArray(topics) &&
            !topics.includes(name);

          if (verified) {

            this.managementCurrentConfig = null;
            this.managementCurrentPartitions = null;

            if (this.selectedTopic === name) {
              this.closeTopicDetails();
            }
          }

        // ======================================
        // VERIFICAR CREACION O PARTICIONES
        // ======================================

        } else {

          const details =
            response as KafkaTopicDetails;

          verified =
            details.name === name &&
            details.partitionCount ===
              expected.partitions;

          if (operation === 'create') {

            const actualReplication =
              details.partitions[0]?.replicas.length;

            verified =
              verified &&
              actualReplication ===
                expected.replication;
          }

          if (
            name === this.managementTopicName.trim()
          ) {
            this.managementCurrentPartitions =
              details.partitionCount;
          }

          if (this.selectedTopic === name) {
            this.topicDetails = details;
          }
        }

        // ======================================
        // MOSTRAR RESULTADO VERIFICADO
        // ======================================

        if (verified) {

          this.managementResult = {
            ...result,

            title:
              operation === 'delete'
                ? 'Tópico eliminado correctamente'
                : result.title,

            verified: true,

            details: [
              ...result.details,
              'Resultado confirmado mediante una nueva consulta a Kafka.'
            ]
          };

        } else {

          this.managementResult = {
            ...result,

            title:
              'Operación aceptada; verificación pendiente',

            verified: false,

            details: [
              ...result.details,
              'La consulta posterior no confirmó todavía todos los valores.',
              'Comprueba el tópico antes de repetir la operación.'
            ]
          };
        }

        this.managementSuccess =
          this.managementResult.title;

        // Nos aseguramos de que no quede
        // bloqueado el formulario.

        this.managementBusy = false;

        this.refreshView();

        // Actualizamos el listado de tópicos
        // después de mostrar la confirmación.

        this.loadTopics();
      },

      error: (err: HttpErrorResponse) => {

        // La operación original fue aceptada.
        // Por tanto, no afirmamos que haya fallado
        // solo porque no pudimos verificarla.

        this.managementBusy = false;

        this.managementResult = {
          ...result,

          title:
            'Operación aceptada; verificación pendiente',

          verified: false,

          details: [
            ...result.details,
            'Kafka Admin aceptó la operación.',
            'No fue posible completar la verificación posterior.',
            'Revisa Kafka antes de repetir la solicitud.'
          ]
        };

        this.managementSuccess =
          this.managementResult.title;

        console.warn(
          'No se pudo verificar la operación Kafka:',
          err
        );

        this.refreshView();
      }
    });
  }

  // ==========================================
  // EVENTOS: TOPICO DE DESTINO
  // ==========================================

  get eventTopic(): string {

    return this.eventType.startsWith('BOOKING')
      ? 'campuslab.booking.events'
      : 'campuslab.occupancy.events';
  }

  // ==========================================
  // VISTA PREVIA DEL EVENTO
  // ==========================================

  get eventPreviewJson(): string {

    return JSON.stringify(
      {
        eventType: this.eventType,
        bookingId: this.eventBookingId.trim(),
        resourceId: this.eventResourceId.trim()
      },
      null,
      2
    );
  }

  get canPreviewEvent(): boolean {

    return (
      this.isAdmin &&
      this.eventBookingId.trim().length > 0 &&
      this.eventResourceId.trim().length > 0
    );
  }

  changeEventType(value: string): void {

    if (
      value === 'BOOKING_CREATED' ||
      value === 'BOOKING_STATUS_CHANGED' ||
      value === 'OCCUPANCY_STARTED' ||
      value === 'OCCUPANCY_ENDED'
    ) {

      this.eventType =
        value as KafkaEventType;

      this.showEventPreview = false;
      this.refreshView();
    }
  }

  changeEventBookingId(value: string): void {

    this.eventBookingId = value;
    this.showEventPreview = false;

    this.refreshView();
  }

  changeEventResourceId(value: string): void {

    this.eventResourceId = value;
    this.showEventPreview = false;

    this.refreshView();
  }

  previewKafkaEvent(): void {

    if (!this.canPreviewEvent) {
      return;
    }

    this.showEventPreview = true;
    this.refreshView();
  }

  // ==========================================
  // MENSAJES DE ERROR HTTP
  // ==========================================

  private getErrorMessage(
    err: HttpErrorResponse
  ): string {

    if (err.status === 401) {

      return 'Sesión no autorizada. Inicia sesión nuevamente.';
    }

    if (err.status === 403) {

      return 'Acceso denegado. Revisa el rol ADMIN y la clave administrativa.';
    }

    if (err.status === 400) {

      return 'Datos inválidos. Revisa los valores ingresados.';
    }

    if (err.status === 404) {

      return 'No se encontró el recurso solicitado.';
    }

    if (err.status === 409) {

      return 'Conflicto: el tópico ya existe o el cambio no está permitido.';
    }

    if (
      err.status === 502 ||
      err.status === 503
    ) {

      return 'El servicio Kafka Admin no está disponible o no está configurado.';
    }

    if (err.status === 0) {

      return 'No fue posible conectar con el servidor.';
    }

    return `Error HTTP ${err.status}: ${err.message}`;
  }
}
