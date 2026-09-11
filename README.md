# campuslab-frontend

Frontend web del sistema CampusLab, desarrollado con Angular e integrado con Microsoft Azure AD mediante MSAL.

## Descripción

CampusLab es una plataforma para la reserva de laboratorios y equipos académicos.  
Este componente corresponde al frontend de la aplicación, encargado de permitir el inicio de sesión corporativo, proteger rutas según autenticación y consumir endpoints protegidos del backend.

El caso CampusLab exige login corporativo con Azure AD, frontend Angular con MSAL y autorización por rol para Admin, Operador/Técnico y Cliente/Estudiante. 

## Tecnologías utilizadas

- Angular
- TypeScript
- MSAL Angular
- Microsoft Azure AD
- HTML
- CSS
- GitHub

## Funcionalidades implementadas

- Login con Microsoft Azure AD.
- Cierre de sesión.
- Protección de rutas con `MsalGuard`.
- Interceptor HTTP con `MsalInterceptor`.
- Envío automático de `Bearer Token` hacia el backend.
- Dashboard para usuario autenticado.
- Vista de reservas protegida.
- Consumo del endpoint protegido `/api/bookings`.

## Rutas principales

| Ruta | Acceso | Descripción |
|---|---|---|
| `/login` | Público | Inicio de sesión con Microsoft |
| `/dashboard` | Autenticado | Panel principal del usuario |
| `/bookings` | Autenticado | Listado y creación de reservas |

## Configuración MSAL

El frontend utiliza MSAL para autenticarse contra Azure AD.

Configuración principal:

```typescript
clientId: '8902fa8d-4f71-4cd9-9a43-ddd5486e7327'
authority: 'https://login.microsoftonline.com/902cf874-0ee4-4917-b9cb-6b55af9993be'
redirectUri: 'http://localhost:4200'
```

Scope utilizado para consumir el backend:

```typescript
api://36ccc99d-6294-4333-a064-d62fa6237c7c/access_as_user
```

## Endpoint del backend

Para ejecución local con BFF en puerto 8080:

```typescript
http://localhost:8080/api/bookings
```

El token se adjunta automáticamente mediante `MsalInterceptor`.

## Instalación

```bash
npm install
```

## Ejecución local

```bash
ng serve
```

Luego abrir:

```text
http://localhost:4200
```

## Evidencia esperada

- Login Microsoft funcionando.
- Dashboard mostrando usuario autenticado.
- Ruta `/bookings` protegida.
- Llamada a `/api/bookings` con estado 200.
- Header `Authorization: Bearer <token>` presente en Network.
- Redirección a login si el usuario no está autenticado.

## Flujo de seguridad

```text
Usuario → Angular + MSAL → Azure AD → Access Token → BFF protegido
```

## Gestión del proyecto

Este repositorio se gestiona mediante GitHub Projects y metodología Kanban.

Flujo de trabajo:

```text
Issue → Rama feature → Commit → Pull Request → Revisión → Merge a main
```

No se trabaja directamente sobre `main`.
