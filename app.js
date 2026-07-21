/* =========================================================================
   VIZIAO BARBER — app.js
   Sistema de agendamiento 100% frontend (Vanilla JS + Supabase)
   =========================================================================
   Índice:
   1. Configuración (edita aquí tus credenciales)
   2. Datos de negocio (servicios y horario)
   3. Estado de la aplicación
   4. Referencias al DOM
   5. Utilidades (fechas, formato de precio, validaciones)
   6. Render: servicios
   7. Render: selector de día
   8. Render: selector de hora + consulta a Supabase
   9. Formulario: validación en vivo
   10. Envío de la reserva (Supabase — la notificación va por webhook)
   11. Modal de éxito / toast de error
   12. Inicialización
   ========================================================================= */


/* =========================================================================
   1. CONFIGURACIÓN — reemplaza estos valores por los de tu proyecto
   ========================================================================= */

// Credenciales de tu proyecto Supabase (Project Settings → API).
// La "anon key" es pública y segura de exponer en el frontend siempre que
// tengas Row Level Security (RLS) activado en la tabla 'citas'.
const SUPABASE_URL = 'https://ojtvopxshnwocwiebkor.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdHZvcHhzaG53b2N3aWVia29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNTIwNTAsImV4cCI6MjA5OTgyODA1MH0.HhsE6fgEsDzZ1hNHbI4j7LuP7tNTqjttOpO2QN_eTsc';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 
 
/* =========================================================================
   2. DATOS DE NEGOCIO — fácil de editar/ampliar
   ========================================================================= */
 
// Los servicios y el horario semanal ahora los administra el barbero desde
// /admin — se cargan de Supabase en cargarServicios()/cargarHorarioNegocio()
// (ver sección 13, INICIALIZACIÓN). Estos son solo los valores por defecto
// mientras esos fetch terminan.
let SERVICIOS = [];

// Reglas de horario del negocio. diasHabiles/horaInicio/horaFin se
// sobrescriben con lo que el barbero configuró en /admin (tabla
// horario_negocio); intervaloMin y diasAMostrar quedan fijos en el frontend.
const HORARIO = {
  diasHabiles: [1, 2, 3, 4, 5, 6], // 0 = domingo ... 6 = sábado (domingo cerrado)
  horaInicio: 10,                  // primer bloque: 10:00
  horaFin: 20,                     // último bloque de INICIO: 20:00 (termina 21:00)
  intervaloMin: 60,                // duración fija de cada cita (todos los servicios duran 60 min)
  diasAMostrar: 21,                // cuántos días futuros se listan en la tira de fechas
};

// Días puntuales bloqueados por el barbero (ver cargarDiasBloqueados()).
let diasBloqueadosSet = new Set();
 
const CODIGOS_PAISES = [
  { code: '+56', flag: '🇨🇱', name: 'CL' },
  { code: '+54', flag: '🇦🇷', name: 'AR' },
  { code: '+51', flag: '🇵🇪', name: 'PE' },
  { code: '+57', flag: '🇨🇴', name: 'CO' },
  { code: '+52', flag: '🇲🇽', name: 'MX' },
  { code: '+55', flag: '🇧🇷', name: 'BR' },
  { code: '+591', flag: '🇧🇴', name: 'BO' },
  { code: '+593', flag: '🇪🇨', name: 'EC' },
  { code: '+598', flag: '🇺🇾', name: 'UY' },
  { code: '+595', flag: '🇵🇾', name: 'PY' },
  { code: '+58', flag: '🇻🇪', name: 'VE' },
  { code: '+34', flag: '🇪🇸', name: 'ES' },
  { code: '+1', flag: '🇺🇸', name: 'US' }
];

// Datos de contacto y ubicación del local — reemplaza por los reales.
const NEGOCIO = {
  telefono: '+56 9 69001202',        // se muestra y arma el botón "Llamar" (tel:)
  telefonoWhatsapp: '56969001202',    // el mismo número, formato internacional SIN "+" ni espacios
  direccion: 'Santiago Díaz #1127, Punta Arenas, Magallanes', // se muestra y arma el mapa + "Cómo llegar"
};
 
/* =========================================================================
   3. ESTADO DE LA APLICACIÓN
   ========================================================================= */
 
const state = {
  servicio: null,     // objeto de SERVICIOS seleccionado
  fecha: null,         // 'YYYY-MM-DD'
  hora: null,           // 'HH:00'
  turnstileToken: null, // token de Cloudflare Turnstile, lo llena onTurnstileSuccess
  enviando: false,
};
 
 
/* =========================================================================
   4. REFERENCIAS AL DOM
   ========================================================================= */
 
const el = {
  form: document.getElementById('booking-form'),
  serviciosContainer: document.getElementById('servicios-container'),
  dayStrip: document.getElementById('day-strip'),
  dayNavPrev: document.getElementById('day-nav-prev'),
  dayNavNext: document.getElementById('day-nav-next'),
  hoursGrid: document.getElementById('hours-grid'),
 
  nombre: document.getElementById('nombre'),
  apellido: document.getElementById('apellido'),
  codigoPais: document.getElementById('codigo-pais'),
  telefono: document.getElementById('telefono'),
  email: document.getElementById('email'),
  observaciones: document.getElementById('observaciones'),
 
  btnAgendar: document.getElementById('btn-agendar'),

  modalConfirmBackdrop: document.getElementById('modal-confirm-backdrop'),
  btnConfirmarCita: document.getElementById('btn-confirmar-cita'),
  btnCancelarCita: document.getElementById('btn-cancelar-cita'),
  confirmServicio: document.getElementById('confirm-servicio'),
  confirmFecha: document.getElementById('confirm-fecha'),
  confirmHora: document.getElementById('confirm-hora'),
  confirmNombre: document.getElementById('confirm-nombre'),
  confirmPrecio: document.getElementById('confirm-precio'),

  modalBackdrop: document.getElementById('modal-backdrop'),
  modalClose: document.getElementById('modal-close'),
  modalDone: document.getElementById('modal-done'),
  modalServicio: document.getElementById('modal-servicio'),
  modalFecha: document.getElementById('modal-fecha'),
  modalHora: document.getElementById('modal-hora'),
  modalNombre: document.getElementById('modal-nombre'),
  modalPrecio: document.getElementById('modal-precio'),
 
  toast: document.getElementById('toast'),
  footerYear: document.getElementById('footer-year'),

  contactoDireccion: document.getElementById('contacto-direccion'),
  contactoLlamar: document.getElementById('contacto-llamar'),
  contactoWhatsapp: document.getElementById('contacto-whatsapp'),
  contactoMapa: document.getElementById('contacto-mapa'),
  contactoComoLlegar: document.getElementById('contacto-como-llegar'),
};
 
 
/* =========================================================================
   5. UTILIDADES
   ========================================================================= */
 
/** Formatea un número como precio en pesos chilenos: 18000 -> "$18.000" */
function formatearPrecio(numero) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(numero);
}
 
/** Convierte un objeto Date a 'YYYY-MM-DD' usando la hora LOCAL (evita
 *  el corrimiento de un día que causa Date.toISOString() con zonas horarias). */
function toFechaISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
 
/** Genera los bloques de hora del día, ej: ['10:00', '11:00', ..., '20:00'] */
function generarBloquesHora() {
  const bloques = [];
  for (let h = HORARIO.horaInicio; h <= HORARIO.horaFin; h++) {
    bloques.push(`${String(h).padStart(2, '0')}:00`);
  }
  return bloques;
}
 
const NOMBRES_DIA = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const NOMBRES_MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
 
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 
/** Valida que el teléfono tenga solo dígitos y un largo razonable. */
function telefonoValido(valor) {
  return /^[0-9]{7,12}$/.test(valor.trim());
}
 
 
/* =========================================================================
   6. RENDER — SERVICIOS
   ========================================================================= */

/** Trae los servicios activos desde Supabase (los administra el barbero en
 *  /admin). Si falla, SERVICIOS queda vacío y renderServicios() no muestra
 *  nada — mejor eso que reservar con datos de precio/nombre desactualizados. */
async function cargarServicios() {
  const { data, error } = await supabaseClient
    .from('servicios')
    .select('id, nombre, precio, duracion_min, activo')
    .eq('activo', true)
    .order('orden');

  if (error) {
    console.error('Error al cargar servicios:', error);
    mostrarToast('No pudimos cargar los servicios. Recarga la página.');
    return;
  }

  SERVICIOS = data.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    precio: s.precio,
    duracionMin: s.duracion_min,
    activo: s.activo,
  }));
}

function renderServicios() {
  el.serviciosContainer.innerHTML = '';
  const activos = SERVICIOS.filter((s) => s.activo);
 
  activos.forEach((servicio) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'service-card';
    card.setAttribute('aria-pressed', 'false');
    card.innerHTML = `
      <div class="service-card__info">
        <span class="service-card__name">${servicio.nombre}</span>
        <span class="service-card__duration">${servicio.duracionMin} min</span>
      </div>
      <span class="service-card__price">${formatearPrecio(servicio.precio)}</span>
      <span class="service-card__radio" aria-hidden="true"></span>
    `;
    card.addEventListener('click', () => seleccionarServicio(servicio, card));
    el.serviciosContainer.appendChild(card);
  });
 
  // Si solo hay un servicio activo (caso actual), se autoselecciona para
  // agilizar el flujo en móvil.
  if (activos.length === 1) {
    const unicaTarjeta = el.serviciosContainer.querySelector('.service-card');
    seleccionarServicio(activos[0], unicaTarjeta);
  }
}
 
function seleccionarServicio(servicio, cardEl) {
  state.servicio = servicio;
 
  el.serviciosContainer.querySelectorAll('.service-card').forEach((c) => {
    c.setAttribute('aria-pressed', 'false');
  });
  cardEl.setAttribute('aria-pressed', 'true');
 
  actualizarResumen();
}
 
 
/* =========================================================================
   7. RENDER — SELECTOR DE DÍA
   ========================================================================= */

/** Trae el horario semanal configurado por el barbero en /admin y lo aplica
 *  sobre HORARIO. Si falla, se quedan los valores por defecto de arriba. */
async function cargarHorarioNegocio() {
  const { data, error } = await supabaseClient
    .from('horario_negocio')
    .select('dias_habiles, hora_inicio, hora_fin')
    .single();

  if (error) {
    console.error('Error al cargar el horario del negocio:', error);
    return;
  }

  HORARIO.diasHabiles = data.dias_habiles;
  HORARIO.horaInicio = data.hora_inicio;
  HORARIO.horaFin = data.hora_fin;
}

/** Trae los días puntuales que el barbero bloqueó (vacaciones, día libre,
 *  etc.) dentro del rango de fechas que se muestra en la tira de días. */
async function cargarDiasBloqueados() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(hoy.getDate() + HORARIO.diasAMostrar);

  const { data, error } = await supabaseClient
    .from('bloqueos_dias')
    .select('fecha')
    .gte('fecha', toFechaISO(hoy))
    .lt('fecha', toFechaISO(limite));

  if (error) {
    console.error('Error al cargar días bloqueados:', error);
    return;
  }

  diasBloqueadosSet = new Set(data.map((fila) => fila.fecha));
}

function renderDayStrip() {
  el.dayStrip.innerHTML = '';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hoyISO = toFechaISO(hoy);

  for (let i = 0; i < HORARIO.diasAMostrar; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + i);

    const fechaISO = toFechaISO(fecha);
    const esCerrado = !HORARIO.diasHabiles.includes(fecha.getDay()) || diasBloqueadosSet.has(fechaISO);
    const esHoy = fechaISO === hoyISO;
 
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'day-chip' + (esCerrado ? ' day-chip--closed' : '') + (esHoy ? ' day-chip--today' : '');
    chip.setAttribute('role', 'option');
    chip.setAttribute('aria-selected', 'false');
    chip.disabled = esCerrado;
    chip.dataset.fecha = fechaISO;
    chip.innerHTML = `
      <span class="day-chip__weekday">${esHoy ? 'HOY' : NOMBRES_DIA[fecha.getDay()]}</span>
      <span class="day-chip__num">${fecha.getDate()}</span>
      <span class="day-chip__month">${NOMBRES_MES[fecha.getMonth()]}</span>
    `;
 
    if (!esCerrado) {
      chip.addEventListener('click', () => seleccionarDia(fechaISO, chip));
    }
 
    el.dayStrip.appendChild(chip);
  }
 
  actualizarFlechasDia();
}

function renderCodigosPais() {
  el.codigoPais.innerHTML = ''; // Limpiamos por si acaso

  CODIGOS_PAISES.forEach((pais) => {
    const option = document.createElement('option');
    option.value = pais.code;
    option.textContent = `${pais.flag} ${pais.code}`;
    
    // Dejar a Chile seleccionado por defecto de forma automática
    if (pais.code === '+56') {
      option.selected = true;
    }
    
    el.codigoPais.appendChild(option);
  });
}
 
/** Desliza la tira de días hacia la izquierda (-1) o derecha (1), una
 *  "página" de aprox. 3 chips de ancho. Lo usan las flechas prev/next. */
function desplazarDias(direccion) {
  const ANCHO_CHIP_APROX = 70; // 60px de chip + 10px de gap
  el.dayStrip.scrollBy({ left: direccion * ANCHO_CHIP_APROX * 3, behavior: 'smooth' });
}
 
/** Atenúa/deshabilita cada flecha cuando ya no queda más para deslizar
 *  en esa dirección. */
function actualizarFlechasDia() {
  const maxScroll = el.dayStrip.scrollWidth - el.dayStrip.clientWidth;
  el.dayNavPrev.disabled = el.dayStrip.scrollLeft <= 4;
  el.dayNavNext.disabled = el.dayStrip.scrollLeft >= maxScroll - 4;
}
 
el.dayNavPrev.addEventListener('click', () => desplazarDias(-1));
el.dayNavNext.addEventListener('click', () => desplazarDias(1));
el.dayStrip.addEventListener('scroll', actualizarFlechasDia);
window.addEventListener('resize', actualizarFlechasDia);
 
async function seleccionarDia(fechaISO, chipEl) {
  state.fecha = fechaISO;
  state.hora = null; // al cambiar de día, se pierde la hora elegida
 
  el.dayStrip.querySelectorAll('.day-chip').forEach((c) => c.setAttribute('aria-selected', 'false'));
  chipEl.setAttribute('aria-selected', 'true');
 
  actualizarResumen();
  await renderHoursGrid(fechaISO);
}
 
 
/* =========================================================================
   8. RENDER — SELECTOR DE HORA (consulta horas ocupadas en Supabase)
   ========================================================================= */
 
/** Consulta en Supabase la disponibilidad de cada bloque de hora para una fecha:
 *  cuántas citas activas ya lo ocupan, si el barbero lo bloqueó puntualmente y
 *  cuántos cupos extra (sobrecupo) tiene autorizados. */
async function obtenerDisponibilidadHoras(fechaISO) {
  // Sin filtro por 'estado': anon solo tiene grant de select sobre
  // (fecha, hora) en citas — la policy RLS ya restringe las filas visibles
  // a estado='confirmada' del lado del servidor, así que filtrar también
  // por esa columna aquí rompería con un 401 (permiso de columna).
  const [citasRes, bloqueosRes, sobrecuposRes] = await Promise.all([
    supabaseClient.from('citas').select('hora').eq('fecha', fechaISO),
    supabaseClient.from('bloqueos_horarios').select('hora').eq('fecha', fechaISO),
    supabaseClient.from('sobrecupos').select('hora, cupos_extra').eq('fecha', fechaISO),
  ]);

  if (citasRes.error || bloqueosRes.error || sobrecuposRes.error) {
    console.error('Error al consultar disponibilidad:', citasRes.error || bloqueosRes.error || sobrecuposRes.error);
    mostrarToast('No pudimos cargar los horarios. Revisa tu conexión.');
    return { ocupadasPorHora: new Map(), horasBloqueadas: new Set(), cuposExtraPorHora: new Map() };
  }

  const ocupadasPorHora = new Map();
  citasRes.data.forEach((fila) => {
    ocupadasPorHora.set(fila.hora, (ocupadasPorHora.get(fila.hora) ?? 0) + 1);
  });

  const horasBloqueadas = new Set(bloqueosRes.data.map((fila) => fila.hora));

  const cuposExtraPorHora = new Map();
  sobrecuposRes.data.forEach((fila) => cuposExtraPorHora.set(fila.hora, fila.cupos_extra));

  return { ocupadasPorHora, horasBloqueadas, cuposExtraPorHora };
}

async function renderHoursGrid(fechaISO) {
  el.hoursGrid.setAttribute('aria-busy', 'true');
  el.hoursGrid.innerHTML = '<p class="hours-grid__empty">Cargando horarios...</p>';

  const [{ ocupadasPorHora, horasBloqueadas, cuposExtraPorHora }] = await Promise.all([
    obtenerDisponibilidadHoras(fechaISO),
    new Promise((r) => setTimeout(r, 150)), // pequeño respiro visual de carga
  ]);

  el.hoursGrid.innerHTML = '';

  const bloques = generarBloquesHora();
  const hoyISO = toFechaISO(new Date());
  const esHoy = fechaISO === hoyISO;
  const horaActual = new Date().getHours();

  let quedanDisponibles = false;

  bloques.forEach((hora) => {
    const horaNum = parseInt(hora, 10);
    const cupos = 1 + (cuposExtraPorHora.get(hora) ?? 0);
    const ocupadas = ocupadasPorHora.get(hora) ?? 0;
    const bloqueada = horasBloqueadas.has(hora);
    // Si el día seleccionado es hoy, también se bloquean los bloques que ya pasaron.
    const yaPaso = esHoy && horaNum <= horaActual;
    const disponible = !bloqueada && !yaPaso && ocupadas < cupos;

    if (disponible) quedanDisponibles = true;
 
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hour-chip' + (disponible ? '' : ' hour-chip--disabled');
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', 'false');
    btn.textContent = hora;
    btn.disabled = !disponible;
 
    if (disponible) {
      btn.addEventListener('click', () => seleccionarHora(hora, btn));
    }
 
    el.hoursGrid.appendChild(btn);
  });
 
  if (!quedanDisponibles) {
    const aviso = document.createElement('p');
    aviso.className = 'hours-grid__empty';
    aviso.textContent = 'No quedan horas disponibles este día. Prueba con otra fecha';
    el.hoursGrid.appendChild(aviso);
  }
 
  el.hoursGrid.setAttribute('aria-busy', 'false');
}
 
function seleccionarHora(hora, btnEl) {
  state.hora = hora;
 
  el.hoursGrid.querySelectorAll('.hour-chip').forEach((b) => b.setAttribute('aria-selected', 'false'));
  btnEl.setAttribute('aria-selected', 'true');
 
  actualizarResumen();
}
 
 
/* =========================================================================
   9. FORMULARIO — validación en vivo
   ========================================================================= */
 
function marcarCampo(inputEl, errorId, esValido, mensaje) {
  const field = inputEl.closest('.field');
  const errorEl = document.getElementById(errorId);
 
  if (esValido) {
    field.classList.remove('field--error');
    errorEl.textContent = '';
  } else {
    field.classList.add('field--error');
    errorEl.textContent = mensaje;
  }
  return esValido;
}
 
// Un validador por campo obligatorio de texto. Cada uno sabe cómo revisarse
// a sí mismo y, si mostrarError es true, pinta el mensaje bajo el campo.
const VALIDADORES_CAMPO = {
  nombre: (mostrarError) => {
    const valido = el.nombre.value.trim().length >= 2;
    return mostrarError ? marcarCampo(el.nombre, 'nombre-error', valido, 'Ingresa tu nombre.') : valido;
  },
  apellido: (mostrarError) => {
    const valido = el.apellido.value.trim().length >= 2;
    return mostrarError ? marcarCampo(el.apellido, 'apellido-error', valido, 'Ingresa tu apellido.') : valido;
  },
  telefono: (mostrarError) => {
    const valido = telefonoValido(el.telefono.value);
    return mostrarError ? marcarCampo(el.telefono, 'telefono-error', valido, 'Ingresa un número de teléfono válido.') : valido;
  },
  email: (mostrarError) => {
    const valido = EMAIL_REGEX.test(el.email.value.trim());
    return mostrarError ? marcarCampo(el.email, 'email-error', valido, 'Ingresa un email válido.') : valido;
  },
};
 
/** Valida todos los campos y el estado de selección (servicio/fecha/hora).
 *  Devuelve true si todo está listo para enviar. */
function validarFormulario({ mostrarErrores } = { mostrarErrores: true }) {
  const todoValido = Object.values(VALIDADORES_CAMPO)
    .map((validar) => validar(mostrarErrores))
    .every(Boolean);
 
  const seleccionCompleta = Boolean(state.servicio && state.fecha && state.hora && state.turnstileToken);
 
  return todoValido && seleccionCompleta;
}
 
/** Devuelve, en palabras, qué pasos previos (servicio/día/hora) faltan por
 *  elegir. Se usa para el mensaje de aviso si intentan enviar sin completarlos. */
function pasosFaltantes() {
  const faltan = [];
  if (!state.servicio) faltan.push('un servicio');
  if (!state.fecha) faltan.push('un día');
  if (!state.hora) faltan.push('una hora');
  if (!state.turnstileToken) faltan.push('la verificación de seguridad');
  return faltan;
}
 
/** Habilita/deshabilita el botón "Agendar cita" según el estado del formulario. */
function actualizarResumen() {
  const listo = validarFormulario({ mostrarErrores: false });
  el.btnAgendar.disabled = !listo || state.enviando;
}
 
function formatearFechaLegible(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return `${d} ${NOMBRES_MES[fecha.getMonth()]}`;
}
 
// Validación en vivo por campo:
// - Al salir del campo (blur), se marca como "tocado" y se muestra el
//   mensaje de error si corresponde — así el cliente sabe de inmediato qué
//   le falta, sin tener que adivinar por qué el botón sigue apagado.
// - Mientras escribe (input) en un campo ya tocado, el mensaje se
//   actualiza/limpia en vivo apenas el valor vuelve a ser válido.
const camposConValidador = [
  ['nombre', el.nombre],
  ['apellido', el.apellido],
  ['telefono', el.telefono],
  ['email', el.email],
];

camposConValidador.forEach(([nombreCampo, inputEl]) => {
  // Al salir del campo (blur) valida y muestra error si falta algo
  inputEl.addEventListener('blur', () => {
    VALIDADORES_CAMPO[nombreCampo](true);
    actualizarResumen();
  });

  // Escucha en tiempo real mientras escribe o autocompleta,
  // habilitando el botón de inmediato sin esperar a mover la pantalla
  inputEl.addEventListener('input', () => {
    VALIDADORES_CAMPO[nombreCampo](true);
    actualizarResumen();
  });
});

// Escuchador extra para el código de país por si lo cambian
el.codigoPais.addEventListener('change', actualizarResumen);

/* =========================================================================
   9.1 CLOUDFLARE TURNSTILE
   ========================================================================= */

// Estas funciones las invoca el widget de Turnstile directamente por nombre
// (ver los atributos data-callback/data-expired-callback/data-error-callback
// en el <div class="cf-turnstile"> del HTML). Como app.js es un módulo, sus
// funciones NO son globales por defecto — hay que colgarlas de "window" a
// mano para que Turnstile las encuentre.
window.onTurnstileSuccess = (token) => {
  state.turnstileToken = token;
  actualizarResumen();
};

window.onTurnstileExpired = () => {
  state.turnstileToken = null;
  actualizarResumen();
};

window.onTurnstileError = () => {
  state.turnstileToken = null;
  actualizarResumen();
  mostrarToast('No pudimos verificar que eres humano. Intenta de nuevo.');
};

 
 
/* =========================================================================
   10. ENVÍO DE LA RESERVA
   ========================================================================= */
 
/** Arma el objeto que se guarda en la tabla 'citas'. El Database Webhook
 *  reenvía esta misma fila (como "record") a la Edge Function que notifica
 *  por Telegram, así que los nombres de columna deben calzar con el
 *  esquema SQL del README. */
function construirPayload() {
  return {
    nombre: el.nombre.value.trim(),
    apellido: el.apellido.value.trim(),
    codigo_pais: el.codigoPais.value,
    telefono: el.telefono.value.trim(),
    email: el.email.value.trim(),
    observaciones: el.observaciones.value.trim() || null,
    servicio_id: state.servicio.id,
    servicio_nombre: state.servicio.nombre,
    precio: state.servicio.precio,
    fecha: state.fecha,
    hora: state.hora,
  };
}
 
/** Crea la cita a través de la Edge Function 'crear-cita', que verifica el
 *  token de Turnstile del lado del servidor y recién ahí inserta (la tabla
 *  'citas' ya no acepta insert directo desde el navegador — ver README).
 *  Devuelve { error } con la misma forma que usaba el insert directo, para
 *  no tener que tocar la lógica de confirmarYEnviar(). */
async function insertarCita(payload) {
  const { data, error } = await supabaseClient.functions.invoke('crear-cita', {
    body: { ...payload, turnstileToken: state.turnstileToken },
  });

  if (error) {
    // Falla de red/infraestructura llamando a la función (no de la cita en sí).
    return { error: { message: error.message } };
  }

  if (!data.ok) {
    // Falla "de negocio": token inválido, día/hora bloqueados (VZ001), cupo
    // lleno (VZ002), etc. — ver reservar_cita() en supabase/migrations.
    return { error: { code: data.code, message: data.message } };
  }

  return { error: null };
}
 
function setEnviando(enviando) {
  state.enviando = enviando;
  el.btnConfirmarCita.disabled = enviando;
  el.btnConfirmarCita.classList.toggle('is-loading', enviando);
  el.btnCancelarCita.disabled = enviando;
}

/** Pisa el submit nativo del form (por si Enter dispara submit en algún
 *  campo) — el envío real lo dispara el botón "Confirmar cita" del modal. */
el.form.addEventListener('submit', (evento) => evento.preventDefault());

/** Abre el modal de confirmación con el resumen de la cita, siempre que el
 *  formulario esté completo. Lo dispara el botón estático "Agendar cita". */
function abrirModalConfirmacion() {
  if (!validarFormulario({ mostrarErrores: true })) {
    const faltan = pasosFaltantes();
    mostrarToast(
      faltan.length
        ? `Te falta elegir ${faltan.join(' y ')} para tu cita.`
        : 'Revisa los campos marcados en rojo.'
    );
    return;
  }

  const payload = construirPayload();
  el.confirmServicio.textContent = payload.servicio_nombre;
  el.confirmFecha.textContent = formatearFechaLegible(payload.fecha);
  el.confirmHora.textContent = payload.hora;
  el.confirmNombre.textContent = `${payload.nombre} ${payload.apellido}`;
  el.confirmPrecio.textContent = formatearPrecio(payload.precio);

  el.modalConfirmBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
}

function cerrarModalConfirmacion() {
  el.modalConfirmBackdrop.hidden = true;
  document.body.style.overflow = '';
}

/** Envía la reserva a Supabase. Lo dispara "Confirmar cita" dentro del modal. */
async function confirmarYEnviar() {
  setEnviando(true);
  const payload = construirPayload();

  // Solo insertamos en Supabase. El Database Webhook configurado sobre la
  // tabla 'citas' se encarga, del lado del servidor, de avisarle al barbero
  // por Telegram — el frontend ya no necesita saber que Telegram existe.
  const { error } = await insertarCita(payload);

  setEnviando(false);

  if (error) {
    console.error('Error al insertar la cita:', error);
    // VZ001: el barbero bloqueó ese día/hora justo antes que confirmaras.
    // VZ002: alguien más tomó el último cupo de ese bloque justo antes que tú.
    // TURNSTILE_INVALID lo devuelve la Edge Function si el token no pasó
    // la verificación con Cloudflare (o expiró mientras completabas el form).
    let mensaje = 'No pudimos guardar tu cita. Intenta nuevamente.';
    if (error.code === 'VZ001') mensaje = 'Ese horario ya no está disponible. Elige otro, por favor.';
    if (error.code === 'VZ002') mensaje = 'Justo se ocupó esa hora. Elige otra, por favor.';
    if (error.code === 'TURNSTILE_INVALID') mensaje = 'No pudimos verificar que eres humano. Intenta de nuevo.';

    cerrarModalConfirmacion();
    mostrarToast(mensaje);

    if (error.code === 'VZ001' || error.code === 'VZ002') {
      state.hora = null; // esa hora ya no está disponible, hay que elegir otra
      await renderHoursGrid(payload.fecha);
    }
    if (error.code === 'TURNSTILE_INVALID') {
      state.turnstileToken = null;
      if (window.turnstile) window.turnstile.reset(); // pide un token nuevo
    }
    actualizarResumen(); // refleja lo anterior y re-deshabilita el botón si corresponde
    return;
  }

  cerrarModalConfirmacion();
  mostrarModalExito(payload);
  reiniciarFormulario();

  // Refresca el grid de horas para que el bloque recién tomado quede bloqueado
  // si el cliente decide agendar otra hora.
  await renderHoursGrid(payload.fecha);
}

el.btnAgendar.addEventListener('click', abrirModalConfirmacion);
el.btnConfirmarCita.addEventListener('click', confirmarYEnviar);
el.btnCancelarCita.addEventListener('click', cerrarModalConfirmacion);
el.modalConfirmBackdrop.addEventListener('click', (e) => {
  if (e.target === el.modalConfirmBackdrop) cerrarModalConfirmacion();
});
 
 
/* =========================================================================
   11. MODAL DE ÉXITO / TOAST DE ERROR
   ========================================================================= */
 
function mostrarModalExito(payload) {
  el.modalServicio.textContent = payload.servicio_nombre;
  el.modalFecha.textContent = formatearFechaLegible(payload.fecha);
  el.modalHora.textContent = payload.hora;
  el.modalNombre.textContent = `${payload.nombre} ${payload.apellido}`;
  el.modalPrecio.textContent = formatearPrecio(payload.precio);
 
  el.modalBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  el.modalClose.focus();
}
 
function cerrarModal() {
  el.modalBackdrop.hidden = true;
  document.body.style.overflow = '';
  el.btnAgendar.focus();
}

el.modalClose.addEventListener('click', cerrarModal);
el.modalDone.addEventListener('click', cerrarModal);
el.modalBackdrop.addEventListener('click', (e) => {
  if (e.target === el.modalBackdrop) cerrarModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!el.modalConfirmBackdrop.hidden) cerrarModalConfirmacion();
  else if (!el.modalBackdrop.hidden) cerrarModal();
});
 
let toastTimeout;
function mostrarToast(mensaje) {
  clearTimeout(toastTimeout);
  el.toast.textContent = mensaje;
  el.toast.hidden = false;
  toastTimeout = setTimeout(() => { el.toast.hidden = true; }, 3800);
}
 
function reiniciarFormulario() {
  el.form.reset();
  state.fecha = null;
  state.hora = null;
  state.turnstileToken = null; // cada reserva nueva necesita su propia verificación
  // El servicio se mantiene seleccionado (solo hay uno activo hoy).
 
  el.dayStrip.querySelectorAll('.day-chip').forEach((c) => c.setAttribute('aria-selected', 'false'));
  el.hoursGrid.innerHTML = '<p class="hours-grid__empty">Selecciona un día para ver los horarios disponibles.</p>';
  if (window.turnstile) window.turnstile.reset();
 
  actualizarResumen();
}
 
 
/* =========================================================================
   12. CONTACTO Y UBICACIÓN
   ========================================================================= */

/** Puebla la sección de contacto/ubicación (botones de llamar/WhatsApp,
 *  mapa embebido y "Cómo llegar") a partir de la config NEGOCIO. */
function renderContacto() {
  el.contactoDireccion.textContent = NEGOCIO.direccion;

  const telefonoLimpio = NEGOCIO.telefono.replace(/\s+/g, '');
  el.contactoLlamar.href = `tel:${telefonoLimpio}`;
  el.contactoWhatsapp.href = `https://wa.me/${NEGOCIO.telefonoWhatsapp}`;

  const direccionCodificada = encodeURIComponent(NEGOCIO.direccion);
  el.contactoMapa.src = `https://www.google.com/maps?q=${direccionCodificada}&output=embed`;
  el.contactoComoLlegar.href = `https://www.google.com/maps/dir/?api=1&destination=${direccionCodificada}`;
}


/* =========================================================================
   13. INICIALIZACIÓN
   ========================================================================= */
 
async function init() {
  el.footerYear.textContent = new Date().getFullYear();
  renderCodigosPais();
  renderContacto();

  // Datos que administra el barbero desde /admin — se cargan antes de
  // renderizar servicios y días porque esas vistas dependen de ellos.
  await Promise.all([cargarServicios(), cargarHorarioNegocio(), cargarDiasBloqueados()]);

  renderServicios();
  renderDayStrip();

  actualizarResumen();
}

init();