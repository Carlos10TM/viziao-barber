// supabase/functions/crear-cita/index.ts
// -----------------------------------------------------------------------
// Reemplaza el insert directo desde el navegador. Flujo:
//   1. Recibe los datos de la cita + el token de Cloudflare Turnstile.
//   2. Verifica el token contra la API de Cloudflare (server-to-server,
//      usando el secret real — esto es lo que un bot no puede falsificar).
//   3. Si es válido, inserta usando el service_role key (el único rol con
//      permiso de insert ahora que se lo sacamos al anon en la tabla).
//
// La tabla 'citas' YA NO permite insert público — ver el SQL en el README.
// Por eso este insert usa el service_role, no la conexión del cliente.
// -----------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase automáticamente
// en toda Edge Function — no hace falta configurarlas a mano como secreto.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TURNSTILE_SECRET_KEY = Deno.env.get('TURNSTILE_SECRET_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Columnas que realmente esperamos recibir para una cita — evita que
// alguien mande campos extra/arbitrarios en el body y terminen en la tabla.
const CAMPOS_CITA = [
  'nombre', 'apellido', 'codigo_pais', 'telefono', 'email', 'observaciones',
  'servicio_id', 'servicio_nombre', 'precio', 'fecha', 'hora',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function responder(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return responder({ ok: false, code: 'BAD_REQUEST', message: 'Body inválido.' }, 400);
  }

  const { turnstileToken, ...resto } = body as { turnstileToken?: string; [k: string]: unknown };

  if (!turnstileToken) {
    return responder({ ok: false, code: 'TURNSTILE_INVALID', message: 'Falta la verificación de seguridad.' }, 200);
  }

  // 1. Verificar el token con Cloudflare — esta llamada solo puede hacerla
  //    el servidor, porque necesita el secret real (nunca va al frontend).
  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: TURNSTILE_SECRET_KEY, response: turnstileToken }),
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      console.warn('Turnstile rechazado:', verifyData['error-codes']);
      return responder({ ok: false, code: 'TURNSTILE_INVALID', message: 'No pudimos verificar que eres humano.' }, 200);
    }
  } catch (err) {
    console.error('Error verificando Turnstile:', err);
    return responder({ ok: false, code: 'TURNSTILE_INVALID', message: 'No pudimos verificar que eres humano.' }, 200);
  }

  // 2. Armar la cita solo con las columnas esperadas (nada de lo que venga
  //    de más en el body termina en la tabla).
  const cita: Record<string, unknown> = {};
  for (const campo of CAMPOS_CITA) {
    if (campo in resto) cita[campo] = resto[campo];
  }

  // 3. Insertar con el service_role — el único que puede escribir en 'citas'.
  const { data, error } = await supabaseAdmin.from('citas').insert([cita]).select();

  if (error) {
    console.error('Error al insertar la cita:', error);
    return responder({ ok: false, code: error.code, message: error.message }, 200);
  }

  return responder({ ok: true, data });
});