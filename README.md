# CampusLab Frontend

Frontend Angular para CampusLab, plataforma de reserva de laboratorios y equipos académicos.

## Tecnologías

- Angular
- MSAL Angular
- Azure AD / Microsoft Entra ID
- HttpClient

## Funcionalidades EP1

- Login con Microsoft mediante MSAL.
- Logout con Microsoft.
- Rutas protegidas con `MsalGuard`.
- `MsalInterceptor` configurado para adjuntar `Authorization: Bearer <token>` en llamadas al BFF.
- Dashboard con lectura de usuario, roles, scopes y audience desde el access token.
- Vista `/bookings` que consume `GET /api/bookings` desde el BFF.

## Configuración Azure AD

Archivo principal: `src/app/auth-config.ts`

Variables configuradas:

- `clientId`: ID de la app frontend registrada en Azure AD.
- `authority`: tenant de Azure AD.
- `redirectUri`: `http://localhost:4200`.
- `scopes`: scope expuesto por la API/BFF.

## Ejecutar localmente

```bash
npm install
npm start
```

La aplicación queda disponible en:

```text
http://localhost:4200
```

## Rutas

- `/login`: inicio de sesión.
- `/dashboard`: vista protegida con información del usuario autenticado.
- `/bookings`: vista protegida que consume el endpoint de reservas.
