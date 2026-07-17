// supabase/functions/notificar-telegram/index.ts
// -----------------------------------------------------------------------
// Se ejecuta en el servidor de Supabase, NUNCA en el navegador del cliente.
// La activa el Database Webhook configurado sobre la tabla 'citas'
// (evento INSERT) — ver README.md para la configuración paso a paso.
//
// El token del bot vive acá como secreto de la función (Deno.env), por lo
// que ya no aparece en ningún archivo del frontend.
// -----------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')!;

// Secreto compartido para verificar que la llamada realmente viene de tu
// Database Webhook y no de cualquiera que adivine la URL de la función.
// Debes configurar el mismo valor como header al crear el webhook (ver README).
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')!;

function formatearPrecio(numero: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(numero);
}

function formatearFecha(fechaStr: string): string {
  if (!fechaStr) return '—';
  // Si la fecha viene como "2026-07-17", la separamos por los guiones
  const partes = fechaStr.split('-');
  if (partes.length !== 3) return fechaStr; // Por si acaso no viene en formato esperado
  
  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

serve(async (req) => {
  // 1. Verificamos el secreto compartido antes de hacer cualquier otra cosa.
  const secretRecibido = req.headers.get('x-webhook-secret');
  if (secretRecibido !== WEBHOOK_SECRET) {
    return new Response('No autorizado', { status: 401 });
  }

  try {
    const body = await req.json();

    // Los Database Webhooks de Supabase envían la fila nueva dentro de
    // "record" junto con metadata (type, table, schema, old_record).
    const cita = body.record ?? body;

    const mensaje = [
      '🔔 *NUEVA CITA — VIZIAO BARBER* 🔔',
      '',
      `*Cliente:* ${cita.nombre} ${cita.apellido}`,
      `*Servicio:* ${cita.servicio_nombre}`,
      `*Fecha:* ${formatearFecha(cita.fecha)}`,
      `*Hora:* ${cita.hora}`,
      `*Teléfono:* ${cita.codigo_pais} ${cita.telefono}`,
      `*Email:* ${cita.email}`,
      cita.observaciones ? `*Observaciones:* ${cita.observaciones}` : null,
      `*Precio:* ${formatearPrecio(Number(cita.precio))}`,
    ].filter(Boolean).join('\n');

    const respuestaTelegram = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: mensaje,
          parse_mode: 'Markdown',
        }),
      },
    );

    if (!respuestaTelegram.ok) {
      const detalle = await respuestaTelegram.text();
      console.error('Telegram respondió con error:', detalle);
      return new Response(JSON.stringify({ ok: false, detalle }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error en notificar-telegram:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});