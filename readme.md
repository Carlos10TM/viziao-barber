# Viziao Barber — Sistema de agendamiento

Sistema de reservas 100% frontend (Vanilla JS + Supabase), mobile-first, estilo urbano/trap.

```
viziao-barber/
├── index.html
├── styles.css
├── app.js
├── supabase/
│   └── functions/
│       └── notificar-telegram/
│           └── index.ts       ← Edge Function (Deno) invocada por el webhook
└── README.md
```

## 1. Cómo correrlo localmente

`app.js` se carga como `type="module"`, por lo que **no funciona abriendo el
`index.html` directamente con doble clic** (protocolo `file://`). Sírvelo con
cualquier servidor estático, por ejemplo:

```bash
# Con Python
python3 -m http.server 5500

# O con la extensión "Live Server" de VS Code
```

Luego abre `http://localhost:5500`.

## 2. Configurar Supabase

### 2.1 Crear la tabla `citas`

En el SQL Editor de tu proyecto Supabase, ejecuta:

```sql
create extension if not exists "pgcrypto";

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
  created_at      timestamptz not null default now(),

  -- Evita que dos personas reserven el mismo bloque (protección a nivel de BD
  -- contra condiciones de carrera, además de la validación en el frontend).
  unique (fecha, hora)
);
```

### 2.2 Activar seguridad a nivel de fila (RLS)

Por defecto Supabase bloquea todo. Necesitas permitir que cualquier visitante
**inserte** una cita, y que pueda **leer únicamente las columnas `fecha` y
`hora`** (para saber qué horarios están ocupados) — nunca los datos
personales de otros clientes:

```sql
alter table citas enable row level security;

-- Cualquiera puede crear una cita
create policy "insertar_citas_publico"
  on citas for insert
  to anon
  with check (true);

-- Cualquiera puede leer filas (para ver disponibilidad)...
create policy "leer_citas_publico"
  on citas for select
  to anon
  using (true);

-- ...pero solo se le otorga acceso a las columnas fecha/hora, nunca a
-- nombre, teléfono, email u observaciones de otros clientes.
revoke select on citas from anon;
grant select (fecha, hora) on citas to anon;
grant insert on citas to anon;
```

### 2.3 Conectar tu proyecto

En `app.js`, edita:

```js
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU-ANON-KEY-PUBLICA';
```

Ambos valores están en **Project Settings → API** dentro de tu dashboard de
Supabase.

## 3. Notificación por Telegram (webhook seguro)

`app.js` **ya no contiene ningún token de Telegram**. En vez de que el
navegador del cliente llame directamente a la API de Telegram, el flujo es:

```
Cliente → app.js → INSERT en tabla 'citas' (Supabase)
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

### 3.1 Crear el bot de Telegram

1. Habla con [@BotFather](https://t.me/BotFather) y crea un bot con
   `/newbot`. Te entregará el `TELEGRAM_BOT_TOKEN`.
2. Envíale cualquier mensaje a tu bot recién creado.
3. Visita `https://api.telegram.org/bot<TU_TOKEN>/getUpdates` y busca
   `"chat":{"id": ...}` — ese número es tu `TELEGRAM_CHAT_ID`.

### 3.2 Desplegar la Edge Function

El código está en `supabase/functions/notificar-telegram/index.ts`. Con la
[CLI de Supabase](https://supabase.com/docs/guides/cli) instalada:

```bash
supabase login
supabase link --project-ref TU-PROYECTO

# Guarda los secretos en el servidor (nunca en el código ni en git)
supabase secrets set \
  TELEGRAM_BOT_TOKEN=xxxxxxxx \
  TELEGRAM_CHAT_ID=xxxxxxxx \
  WEBHOOK_SECRET=$(openssl rand -hex 24)

# Despliega. --no-verify-jwt porque quien llama es el webhook de la BD,
# no un usuario autenticado con un JWT de Supabase Auth.
supabase functions deploy notificar-telegram --no-verify-jwt
```

Guarda el valor que generaste para `WEBHOOK_SECRET`; lo necesitas en el
siguiente paso.

### 3.3 Crear el Database Webhook

En el dashboard de Supabase: **Database → Webhooks → Create a new hook**.

| Campo | Valor |
|---|---|
| Name | `notificar-nueva-cita` |
| Table | `citas` |
| Events | ☑ Insert (solo esta) |
| Type | Supabase Edge Functions |
| Edge Function | `notificar-telegram` |
| HTTP Headers | `x-webhook-secret: <el WEBHOOK_SECRET que generaste>` |

Con esto, cada vez que `app.js` inserta una fila en `citas`, Postgres llama
automáticamente a la Edge Function, que valida el header secreto y envía el
mensaje de Telegram — sin que el frontend sepa que Telegram existe.

### 3.4 Probarlo

Agenda una cita de prueba desde la web y revisa los logs en
**Edge Functions → notificar-telegram → Logs** si el mensaje no llega al
chat.

## 4. Agregar más servicios

En `app.js`, dentro del arreglo `SERVICIOS`, copia un objeto y ajusta sus
valores:

```js
const SERVICIOS = [
  { id: 'corte-cabello', nombre: 'Corte de cabello', precio: 18000, duracionMin: 60, activo: true },
  { id: 'corte-barba',   nombre: 'Corte + Barba',     precio: 25000, duracionMin: 60, activo: true },
];
```

El resto de la interfaz (tarjetas de servicio, resumen, ticket de
confirmación) se actualiza solo. Nota: la lógica de horarios actual asume
citas de 1 hora fija para todos los servicios; si en el futuro agregas un
servicio de otra duración, habrá que ajustar `generarBloquesHora()` en
`app.js` para que use `duracionMin` por servicio en vez del valor fijo de
`HORARIO.intervaloMin`.

## 5. Personalizar el diseño

Todos los colores, tipografías y radios de borde están centralizados como
variables CSS al inicio de `styles.css` (`:root { ... }`), por ejemplo:

```css
--color-purple: #B026FF;
--color-gold:   #FFC400;
```

## 6. Próximos pasos sugeridos

- Panel de administración simple para que el barbero vea/cancele citas.
- Columna `estado` (`confirmada` / `cancelada`) en vez de borrar filas.
- Recordatorio automático por Telegram o email el día antes de la cita.