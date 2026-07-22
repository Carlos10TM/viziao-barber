# Viziao Barber — Sistema de agendamiento

Sistema de reservas 100% frontend (Vanilla JS + Supabase), mobile-first, estilo urbano/trap.
Incluye panel de administración para el barbero en `/admin`.

```
viziao-barber/
├── index.html
├── styles.css
├── app.js
├── admin/
│   ├── index.html          ← Panel del barbero (login + gestión)
│   ├── admin.css
│   └── admin.js
├── supabase/
│   ├── migrations/
│   │   ├── 0001_panel_admin.sql   ← Tablas del panel admin + reservar_cita()
│   │   ├── 0002_servicios_descripcion.sql   ← Columna 'descripcion' en servicios
│   │   └── 0003_negocio.sql   ← Tabla 'negocio' (dirección y teléfono editables)
│   └── functions/
│       ├── crear-cita/
│       │   └── index.ts   ← Edge Function: verifica Turnstile e inserta la cita
│       └── notificar-telegram/
│           └── index.ts   ← Edge Function invocada por el webhook de Telegram
└── README.md
```

## 1. Cómo correrlo localmente

`app.js` y `admin/admin.js` se cargan como `type="module"`, por lo que **no
funcionan abriendo los HTML directamente con doble clic** (protocolo
`file://`). Sírvelos con cualquier servidor estático, por ejemplo:

```bash
# Con Python
python3 -m http.server 5500
```

Luego abre `http://localhost:5500` para el sitio público y
`http://localhost:5500/admin` para el panel del barbero.

## 2. Configurar Supabase

### 2.1 Crear el esquema

En un proyecto nuevo, ejecuta en el SQL Editor de Supabase, en este orden:

1. Habilita la extensión de UUIDs: `create extension if not exists "pgcrypto";`
2. Crea la tabla base `citas` (ver 2.2 más abajo).
3. Ejecuta el contenido completo de
   [`supabase/migrations/0001_panel_admin.sql`](supabase/migrations/0001_panel_admin.sql) —
   agrega la columna `estado`, las tablas del panel admin (`servicios`,
   `bloqueos_dias`, `bloqueos_horarios`, `sobrecupos`, `horario_negocio`) y la
   función `reservar_cita()`.
4. Ejecuta
   [`supabase/migrations/0002_servicios_descripcion.sql`](supabase/migrations/0002_servicios_descripcion.sql) —
   agrega la columna opcional `descripcion` a `servicios`.
5. Ejecuta
   [`supabase/migrations/0003_negocio.sql`](supabase/migrations/0003_negocio.sql) —
   crea la tabla `negocio` (dirección y teléfono), precargada con datos de
   ejemplo para editar desde `/admin`.

Con la [CLI de Supabase](https://supabase.com/docs/guides/cli) enlazada al
proyecto (`supabase link --project-ref TU-PROYECTO`), los pasos 3 a 5 se
hacen con:

```bash
supabase db query --linked --file supabase/migrations/0001_panel_admin.sql
supabase db query --linked --file supabase/migrations/0002_servicios_descripcion.sql
supabase db query --linked --file supabase/migrations/0003_negocio.sql
```

### 2.2 Tabla base `citas`

```sql
create table citas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  apellido        text not null,
  codigo_pais     text not null,
  telefono        text not null,
  email           text not null,
  observaciones   text,
  servicio_id     text not null,
  servicio_nombre text not null,
  precio          integer not null,
  fecha           date not null,
  hora            text not null,
  created_at      timestamptz not null default now()
);
```

La migración `0001_panel_admin.sql` le agrega después la columna `estado`
(`confirmada`/`cancelada`) y elimina el antiguo `unique(fecha, hora)`: con
sobrecupos, más de una cita puede compartir bloque, así que el control de
concurrencia pasa a vivir en `reservar_cita()` (usa
`pg_advisory_xact_lock` para seguir siendo segura ante dos reservas
simultáneas).

### 2.3 Seguridad a nivel de fila (RLS)

La tabla `citas` **ya no acepta insert directo desde el navegador**. Todo el
modelo de permisos (qué puede leer/escribir `anon` vs. `authenticated`) está
definido en `supabase/migrations/0001_panel_admin.sql` — revisa ese archivo
para el detalle completo de policies y grants.

En resumen:
- **`anon`** (visitantes del sitio público) solo puede leer `fecha`/`hora` de
  citas confirmadas, y reservar a través de la Edge Function `crear-cita`
  (que usa `service_role`, nunca inserta directo desde el cliente).
- **`authenticated`** (el barbero logueado en `/admin`) puede leer y
  gestionar todo: citas, servicios, bloqueos, sobrecupos y el horario.

### 2.4 Conectar tu proyecto

Tanto en `app.js` como en `admin/admin.js`, edita:

```js
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU-ANON-KEY-PUBLICA';
```

Ambos valores están en **Project Settings → API** dentro de tu dashboard de
Supabase.

## 3. Verificación anti-bots (Cloudflare Turnstile)

El formulario público no inserta directo en la base de datos: llama a la
Edge Function `crear-cita`, que primero verifica un token de
[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) contra
la API de Cloudflare (server-to-server) y solo si es válido reserva la cita
vía `reservar_cita()`.

### 3.1 Crear el widget en Cloudflare

1. En el [dashboard de Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile),
   crea un nuevo sitio apuntando a tu dominio.
2. Copia el **Site Key** (pública, va en `index.html`) y el **Secret Key**
   (privada, va como secreto de la Edge Function — nunca al frontend).

### 3.2 Configurar el Site Key en el frontend

En `index.html`, dentro del `div.turnstile-wrapper`, reemplaza
`data-sitekey` por tu Site Key.

### 3.3 Desplegar `crear-cita`

```bash
supabase secrets set TURNSTILE_SECRET_KEY=tu-secret-key

supabase functions deploy crear-cita
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase
automáticamente en toda Edge Function — no hace falta configurarlos a mano.

## 4. Notificación por Telegram (webhook seguro)

`app.js` **no contiene ningún token de Telegram**. En vez de que el
navegador del cliente llame directamente a la API de Telegram, el flujo es:

```
Cliente → app.js → Edge Function 'crear-cita' → reservar_cita() → INSERT en 'citas'
                                                                        │
                                                                        ▼
                                          Database Webhook (se dispara solo en el servidor)
                                                                        │
                                                                        ▼
                                        Edge Function 'notificar-telegram' (guarda el token)
                                                                        │
                                                                        ▼
                                                                  Bot de Telegram → Barbero
```

El token del bot nunca sale del servidor. Así se configura:

### 4.1 Crear el bot de Telegram

1. Habla con [@BotFather](https://t.me/BotFather) y crea un bot con
   `/newbot`. Te entregará el `TELEGRAM_BOT_TOKEN`.
2. Envíale cualquier mensaje a tu bot recién creado.
3. Visita `https://api.telegram.org/bot<TU_TOKEN>/getUpdates` y busca
   `"chat":{"id": ...}` — ese número es tu `TELEGRAM_CHAT_ID`.

### 4.2 Desplegar la Edge Function

```bash
supabase secrets set \
  TELEGRAM_BOT_TOKEN=xxxxxxxx \
  TELEGRAM_CHAT_ID=xxxxxxxx \
  WEBHOOK_SECRET=$(openssl rand -hex 24)

# --no-verify-jwt porque quien llama es el webhook de la BD, no un usuario
# autenticado con un JWT de Supabase Auth.
supabase functions deploy notificar-telegram --no-verify-jwt
```

Guarda el valor que generaste para `WEBHOOK_SECRET`; lo necesitas en el
siguiente paso.

### 4.3 Crear el Database Webhook

En el dashboard de Supabase: **Database → Webhooks → Create a new hook**.

| Campo | Valor |
|---|---|
| Name | `notificar-nueva-cita` |
| Table | `citas` |
| Events | ☑ Insert (solo esta) |
| Type | Supabase Edge Functions |
| Edge Function | `notificar-telegram` |
| HTTP Headers | `x-webhook-secret: <el WEBHOOK_SECRET que generaste>` |

### 4.4 Probarlo

Agenda una cita de prueba desde la web y revisa los logs en
**Edge Functions → notificar-telegram → Logs** si el mensaje no llega al
chat.

## 5. Panel de administración (`/admin`)

El barbero gestiona todo el negocio desde `/admin`, sin tocar código:

- **Resumen**: citas de hoy, ingresos estimados del día y próxima cita.
- **Citas**: listado de próximas citas confirmadas, con opción de cancelar.
- **Agendar**: crea una cita manualmente (ej. alguien que reservó por
  teléfono) — usa la misma función `reservar_cita()` que el sitio público,
  así que respeta bloqueos y cupos. En la misma pestaña, más abajo, están
  los **sobrecupos** (autorizar más de una cita en un mismo bloque de hora).
- **Bloquear días**: cierra un día completo (vacaciones, día libre, etc.).
- **Bloquear horas**: cierra un bloque de hora puntual sin cerrar todo el día.
- **Servicios**: agrega, edita (nombre, precio y una descripción opcional) o
  desactiva servicios. La descripción, si existe, se muestra también en el
  sitio público bajo el nombre del servicio. La duración queda fija en 60
  minutos para todos — es una regla del sistema (`generarBloquesHora()`
  asume citas de 1 hora), no un campo editable.
- **Horario**: define qué días de la semana atiendes y el rango de horas.
- **Ubicación y contacto**: dirección (calle, número y comuna, por separado
  para que el mapa la ubique bien) y teléfono. Se reflejan en el sitio
  público (mapa, "Cómo llegar", botones de llamar y WhatsApp).

### 5.1 Crear el usuario del barbero

El panel usa **Supabase Auth (email + contraseña)**, con un único usuario
para el barbero. Créalo desde el dashboard — **no se puede crear por
código, es un paso manual**:

1. Ve a **Authentication → Users → Add user** en tu proyecto Supabase.
2. Ingresa el email y una contraseña del barbero.
3. Deja **"Auto Confirm User"** activado (o confirma el email manualmente)
   para que pueda iniciar sesión de inmediato.

Con eso, el barbero ya puede entrar en `/admin` con ese email y contraseña.

## 6. Personalizar el diseño

Todos los colores, tipografías y radios de borde están centralizados como
variables CSS al inicio de `styles.css` (`:root { ... }`), y `admin/admin.css`
reutiliza esas mismas variables. Por ejemplo:

```css
--color-purple: #B026FF;
--color-gold:   #FFC400;
```

## 7. Próximos pasos sugeridos

- Recordatorio automático por Telegram o email el día antes de la cita.
- Reportes/estadísticas históricas (no solo el resumen del día actual).
- Soporte para servicios de duración distinta a 60 minutos (requiere
  ajustar `generarBloquesHora()` en `app.js` para usar `duracionMin` por
  servicio en vez de un valor fijo).
