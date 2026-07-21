/* =========================================================================
   VIZIAO BARBER — admin/admin.js
   Panel del barbero: login (Supabase Auth), resumen del día, citas,
   agendamiento manual, bloqueos, sobrecupos, servicios y horario semanal.
   =========================================================================
   Índice:
   1. Configuración
   2. Estado
   3. Referencias al DOM
   4. Utilidades
   5. Autenticación
   6. Navegación entre paneles
   7. Resumen del día
   8. Citas (listado + cancelación)
   9. Agendar cita manual
   10. Bloqueos de días
   11. Bloqueos de horarios
   12. Sobrecupos
   13. Servicios
   14. Horario semanal
   15. Carga inicial de datos + init
   ========================================================================= */


/* =========================================================================
   1. CONFIGURACIÓN
   ========================================================================= */

const SUPABASE_URL = 'https://ojtvopxshnwocwiebkor.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdHZvcHhzaG53b2N3aWVia29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNTIwNTAsImV4cCI6MjA5OTgyODA1MH0.HhsE6fgEsDzZ1hNHbI4j7LuP7tNTqjttOpO2QN_eTsc';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


/* =========================================================================
   2. ESTADO
   ========================================================================= */

const state = {
  session: null,
  servicios: [],   // TODOS los servicios (activos e inactivos) — para gestión
  horario: {
    diasHabiles: [1, 2, 3, 4, 5, 6],
    horaInicio: 10,
    horaFin: 20,
  },
};

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
  { code: '+1', flag: '🇺🇸', name: 'US' },
];

const NOMBRES_DIA = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

// Orden de los chips en la pestaña "Horario": lunes a domingo. Los índices
// siguen siendo los de Date.getDay() (0 = domingo) porque así se guardan
// en dias_habiles y así los usa formatearFechaCorta(); solo cambia el
// orden en que se dibujan los botones.
const ORDEN_DIAS_CHIP = [1, 2, 3, 4, 5, 6, 0];


/* =========================================================================
   3. REFERENCIAS AL DOM
   ========================================================================= */

const el = {
  loginScreen: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginError: document.getElementById('login-error'),
  btnLogin: document.getElementById('btn-login'),

  adminApp: document.getElementById('admin-app'),
  btnLogout: document.getElementById('btn-logout'),
  adminNav: document.getElementById('admin-nav'),

  resumenFecha: document.getElementById('resumen-fecha'),
  resumenTotal: document.getElementById('resumen-total'),
  resumenIngresos: document.getElementById('resumen-ingresos'),
  resumenProxima: document.getElementById('resumen-proxima'),
  resumenLista: document.getElementById('resumen-lista'),

  citasLista: document.getElementById('citas-lista'),

  formAgendar: document.getElementById('form-agendar'),
  agendarServicio: document.getElementById('agendar-servicio'),
  agendarFecha: document.getElementById('agendar-fecha'),
  agendarHora: document.getElementById('agendar-hora'),
  agendarNombre: document.getElementById('agendar-nombre'),
  agendarApellido: document.getElementById('agendar-apellido'),
  agendarCodigoPais: document.getElementById('agendar-codigo-pais'),
  agendarTelefono: document.getElementById('agendar-telefono'),
  agendarEmail: document.getElementById('agendar-email'),
  agendarObservaciones: document.getElementById('agendar-observaciones'),
  agendarError: document.getElementById('agendar-error'),
  btnAgendarManual: document.getElementById('btn-agendar-manual'),

  formBloqueoDia: document.getElementById('form-bloqueo-dia'),
  bloqueoDiaFecha: document.getElementById('bloqueo-dia-fecha'),
  bloqueoDiaMotivo: document.getElementById('bloqueo-dia-motivo'),
  listaBloqueosDias: document.getElementById('lista-bloqueos-dias'),

  formBloqueoHorario: document.getElementById('form-bloqueo-horario'),
  bloqueoHorarioFecha: document.getElementById('bloqueo-horario-fecha'),
  bloqueoHorarioHora: document.getElementById('bloqueo-horario-hora'),
  bloqueoHorarioMotivo: document.getElementById('bloqueo-horario-motivo'),
  listaBloqueosHorarios: document.getElementById('lista-bloqueos-horarios'),

  formSobrecupo: document.getElementById('form-sobrecupo'),
  sobrecupoFecha: document.getElementById('sobrecupo-fecha'),
  sobrecupoHora: document.getElementById('sobrecupo-hora'),
  sobrecupoCupos: document.getElementById('sobrecupo-cupos'),
  listaSobrecupos: document.getElementById('lista-sobrecupos'),

  formServicio: document.getElementById('form-servicio'),
  servicioNombre: document.getElementById('servicio-nombre'),
  servicioPrecio: document.getElementById('servicio-precio'),
  servicioDescripcion: document.getElementById('servicio-descripcion'),
  listaServicios: document.getElementById('lista-servicios'),

  editarServicioBackdrop: document.getElementById('editar-servicio-backdrop'),
  formEditarServicio: document.getElementById('form-editar-servicio'),
  editarServicioNombre: document.getElementById('editar-servicio-nombre'),
  editarServicioPrecio: document.getElementById('editar-servicio-precio'),
  editarServicioDescripcion: document.getElementById('editar-servicio-descripcion'),
  editarServicioError: document.getElementById('editar-servicio-error'),
  btnCancelarEditarServicio: document.getElementById('btn-cancelar-editar-servicio'),

  formHorario: document.getElementById('form-horario'),
  diasSemana: document.getElementById('dias-semana'),
  horarioInicio: document.getElementById('horario-inicio'),
  horarioFin: document.getElementById('horario-fin'),
  horarioError: document.getElementById('horario-error'),

  toast: document.getElementById('toast'),

  confirmBackdrop: document.getElementById('admin-confirm-backdrop'),
  confirmMensaje: document.getElementById('admin-confirm-mensaje'),
  btnConfirmAceptar: document.getElementById('admin-confirm-aceptar'),
  btnConfirmCancelar: document.getElementById('admin-confirm-cancelar'),
};


/* =========================================================================
   4. UTILIDADES
   ========================================================================= */

function toFechaISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatearPrecio(numero) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(numero);
}

function formatearFechaCorta(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return `${NOMBRES_DIA[fecha.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** Genera los bloques de hora entre horaInicio y horaFin, ej: ['10:00', ..., '20:00']. */
function generarBloquesHora(horaInicio, horaFin) {
  const bloques = [];
  for (let h = horaInicio; h <= horaFin; h++) {
    bloques.push(`${String(h).padStart(2, '0')}:00`);
  }
  return bloques;
}

function telefonoValido(valor) {
  return /^[0-9]{7,12}$/.test(valor.trim());
}

/** Un bloque de hora ya pasó si la fecha es hoy y su hora de inicio ya
 *  llegó o quedó atrás — evita agendar/bloquear/dar sobrecupo en un
 *  horario que ya no existe. */
function horaYaPaso(fechaISO, hora) {
  if (fechaISO !== toFechaISO(new Date())) return false;
  return parseInt(hora, 10) <= new Date().getHours();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function emailValido(valor) {
  return EMAIL_REGEX.test(valor.trim());
}

let toastTimeout;
function mostrarToast(mensaje, tipo = 'error') {
  clearTimeout(toastTimeout);
  el.toast.textContent = mensaje;
  el.toast.classList.toggle('toast--exito', tipo === 'exito');
  el.toast.hidden = false;
  toastTimeout = setTimeout(() => { el.toast.hidden = true; }, 3800);
}

/** Reemplazo de window.confirm() con el modal propio del sitio (mismo
 *  markup que usa el sitio público para confirmar una reserva), para no
 *  depender del diálogo nativo del navegador. Se resuelve en true/false
 *  según el botón que presione el barbero. */
function confirmar(mensaje) {
  return new Promise((resolve) => {
    el.confirmMensaje.textContent = mensaje;
    el.confirmBackdrop.hidden = false;

    const limpiar = () => {
      el.confirmBackdrop.hidden = true;
      el.btnConfirmAceptar.removeEventListener('click', onAceptar);
      el.btnConfirmCancelar.removeEventListener('click', onCancelar);
    };
    const onAceptar = () => { limpiar(); resolve(true); };
    const onCancelar = () => { limpiar(); resolve(false); };

    el.btnConfirmAceptar.addEventListener('click', onAceptar);
    el.btnConfirmCancelar.addEventListener('click', onCancelar);
  });
}

/** Consulta disponibilidad (igual que el sitio público) para deshabilitar en
 *  el <select> de hora los bloques bloqueados o sin cupo al agendar manual. */
async function obtenerDisponibilidadHoras(fechaISO) {
  const [citasRes, bloqueosRes, sobrecuposRes] = await Promise.all([
    supabaseClient.from('citas').select('hora').eq('fecha', fechaISO).eq('estado', 'confirmada'),
    supabaseClient.from('bloqueos_horarios').select('hora').eq('fecha', fechaISO),
    supabaseClient.from('sobrecupos').select('hora, cupos_extra').eq('fecha', fechaISO),
  ]);

  const ocupadasPorHora = new Map();
  (citasRes.data ?? []).forEach((fila) => {
    ocupadasPorHora.set(fila.hora, (ocupadasPorHora.get(fila.hora) ?? 0) + 1);
  });

  const horasBloqueadas = new Set((bloqueosRes.data ?? []).map((fila) => fila.hora));

  const cuposExtraPorHora = new Map();
  (sobrecuposRes.data ?? []).forEach((fila) => cuposExtraPorHora.set(fila.hora, fila.cupos_extra));

  return { ocupadasPorHora, horasBloqueadas, cuposExtraPorHora };
}


/* =========================================================================
   5. AUTENTICACIÓN
   ========================================================================= */

function mostrarError(errorEl, mensaje) {
  errorEl.textContent = mensaje ?? '';
}

el.loginForm.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError(el.loginError, '');
  el.btnLogin.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: el.loginEmail.value.trim(),
      password: el.loginPassword.value,
    });

    if (error) {
      mostrarError(el.loginError, 'Email o contraseña incorrectos.');
      return;
    }

    el.loginPassword.value = '';
  } catch (err) {
    // Si falla la conexión (red, CORS, etc.) signInWithPassword puede
    // rechazar la promesa en vez de resolver con { error } — sin este
    // catch el botón quedaba deshabilitado para siempre y no se mostraba
    // ningún mensaje, como si el login "no hiciera nada".
    console.error('Error de conexión al iniciar sesión:', err);
    mostrarError(el.loginError, 'No pudimos conectar. Revisa tu conexión e intenta nuevamente.');
  } finally {
    el.btnLogin.disabled = false;
  }
});

el.btnLogout.addEventListener('click', () => supabaseClient.auth.signOut());

supabaseClient.auth.onAuthStateChange((evento, session) => {
  state.session = session;

  if (session) {
    el.loginScreen.hidden = true;
    el.adminApp.hidden = false;
    // Solo recargamos todo en un login real. Este callback también se
    // dispara con TOKEN_REFRESHED cada vez que Supabase renueva el JWT en
    // segundo plano — si no filtráramos por evento, cargarTodo() borraría
    // silenciosamente lo que el barbero esté escribiendo en los formularios.
    if (evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION') {
      cargarTodo();
    }
  } else {
    el.adminApp.hidden = true;
    el.loginScreen.hidden = false;
  }
});


/* =========================================================================
   6. NAVEGACIÓN ENTRE PANELES
   ========================================================================= */

function activarPanel(nombre) {
  document.querySelectorAll('.admin-panel').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== nombre;
  });
  el.adminNav.querySelectorAll('.admin-nav__item').forEach((btn) => {
    if (btn.dataset.panel === nombre) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });
}

el.adminNav.addEventListener('click', (evento) => {
  const btn = evento.target.closest('.admin-nav__item');
  if (btn) activarPanel(btn.dataset.panel);
});


/* =========================================================================
   7. RESUMEN DEL DÍA
   ========================================================================= */

function renderCitaCard(cita, { cancelable }) {
  const pasada = horaYaPaso(cita.fecha, cita.hora);

  const card = document.createElement('div');
  card.className = 'cita-card' + (pasada ? ' cita-card--pasada' : '');
  card.innerHTML = `
    <div class="cita-card__info">
      <span class="cita-card__nombre">${cita.nombre} ${cita.apellido}</span>
      <span class="cita-card__detalle">${formatearFechaCorta(cita.fecha)} · ${cita.servicio_nombre} · ${formatearPrecio(cita.precio)}</span>
      <span class="cita-card__detalle">${cita.codigo_pais} ${cita.telefono}</span>
      ${cita.observaciones ? `<span class="cita-card__detalle cita-card__detalle--obs">"${cita.observaciones}"</span>` : ''}
    </div>
    <span class="cita-card__hora">${cita.hora}</span>
  `;

  if (pasada) {
    // Cancelar algo que ya ocurrió no tiene sentido — se reemplaza el
    // botón por una etiqueta no interactiva.
    const tag = document.createElement('span');
    tag.className = 'cita-card__pasada-tag';
    tag.textContent = 'Pasada';
    card.appendChild(tag);
  } else if (cancelable) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-cita-cancelar';
    btn.textContent = 'Cancelar';
    btn.addEventListener('click', () => cancelarCita(cita.id, btn));
    card.appendChild(btn);
  }

  return card;
}

async function cancelarCita(id, btnEl) {
  const confirmado = await confirmar('¿Cancelar esta cita? El horario quedará disponible de nuevo.');
  if (!confirmado) return;

  btnEl.disabled = true;
  const { error } = await supabaseClient.from('citas').update({ estado: 'cancelada' }).eq('id', id);

  if (error) {
    console.error('Error al cancelar la cita:', error);
    mostrarToast('No pudimos cancelar la cita. Intenta nuevamente.');
    btnEl.disabled = false;
    return;
  }

  mostrarToast('Cita cancelada.', 'exito');
  renderResumen();
  renderCitas();
}

async function renderResumen() {
  const hoyISO = toFechaISO(new Date());
  el.resumenFecha.textContent = formatearFechaCorta(hoyISO);

  const { data, error } = await supabaseClient
    .from('citas')
    .select('*')
    .eq('fecha', hoyISO)
    .eq('estado', 'confirmada')
    .order('hora');

  if (error) {
    console.error('Error al cargar el resumen del día:', error);
    el.resumenLista.innerHTML = '<p class="admin-empty">No pudimos cargar las citas de hoy.</p>';
    return;
  }

  el.resumenTotal.textContent = data.length;
  el.resumenIngresos.textContent = formatearPrecio(data.reduce((sum, c) => sum + c.precio, 0));

  const horaActual = new Date().getHours();
  const proxima = data.find((c) => parseInt(c.hora, 10) >= horaActual);
  el.resumenProxima.textContent = proxima ? proxima.hora : '—';

  el.resumenLista.innerHTML = '';
  if (data.length === 0) {
    el.resumenLista.innerHTML = '<p class="admin-empty">No tienes citas agendadas hoy.</p>';
    return;
  }
  data.forEach((cita) => el.resumenLista.appendChild(renderCitaCard(cita, { cancelable: true })));
}


/* =========================================================================
   8. CITAS (listado completo + cancelación)
   ========================================================================= */

async function renderCitas() {
  const hoyISO = toFechaISO(new Date());

  const { data, error } = await supabaseClient
    .from('citas')
    .select('*')
    .gte('fecha', hoyISO)
    .eq('estado', 'confirmada')
    .order('fecha')
    .order('hora');

  if (error) {
    console.error('Error al cargar citas:', error);
    el.citasLista.innerHTML = '<p class="admin-empty">No pudimos cargar las citas.</p>';
    return;
  }

  el.citasLista.innerHTML = '';
  if (data.length === 0) {
    el.citasLista.innerHTML = '<p class="admin-empty">No hay citas agendadas.</p>';
    return;
  }
  data.forEach((cita) => el.citasLista.appendChild(renderCitaCard(cita, { cancelable: true })));
}


/* =========================================================================
   9. AGENDAR CITA MANUAL
   ========================================================================= */

function renderAgendarServicioSelect() {
  el.agendarServicio.innerHTML = state.servicios
    .filter((s) => s.activo)
    .map((s) => `<option value="${s.id}">${s.nombre} — ${formatearPrecio(s.precio)}</option>`)
    .join('');
}

function renderAgendarCodigoPais() {
  el.agendarCodigoPais.innerHTML = CODIGOS_PAISES
    .map((c) => `<option value="${c.code}">${c.flag} ${c.code}</option>`)
    .join('');
}

async function renderAgendarHoraSelect() {
  const fechaISO = el.agendarFecha.value;
  const bloques = generarBloquesHora(state.horario.horaInicio, state.horario.horaFin);

  if (!fechaISO) {
    el.agendarHora.innerHTML = bloques.map((h) => `<option value="${h}">${h}</option>`).join('');
    return;
  }

  const { ocupadasPorHora, horasBloqueadas, cuposExtraPorHora } = await obtenerDisponibilidadHoras(fechaISO);

  el.agendarHora.innerHTML = bloques.map((hora) => {
    const cupos = 1 + (cuposExtraPorHora.get(hora) ?? 0);
    const ocupadas = ocupadasPorHora.get(hora) ?? 0;
    const lleno = ocupadas >= cupos;
    const bloqueada = horasBloqueadas.has(hora);
    const pasada = horaYaPaso(fechaISO, hora);
    const deshabilitado = lleno || bloqueada || pasada;
    // "pasada" no lleva etiqueta: solo queda deshabilitada (gris/tachada,
    // como cualquier <option disabled>), sin texto extra — a diferencia de
    // "bloqueada"/"sin cupo" que sí necesitan explicar el motivo.
    const etiqueta = bloqueada ? `${hora} (bloqueada)` : lleno ? `${hora} (sin cupo)` : hora;
    return `<option value="${hora}" ${deshabilitado ? 'disabled' : ''}>${etiqueta}</option>`;
  }).join('');
}

el.agendarFecha.addEventListener('change', renderAgendarHoraSelect);

el.formAgendar.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError(el.agendarError, '');

  const servicio = state.servicios.find((s) => s.id === el.agendarServicio.value);
  const telefono = el.agendarTelefono.value.trim();
  const email = el.agendarEmail.value.trim();

  if (!servicio) return mostrarError(el.agendarError, 'Elige un servicio.');
  if (!el.agendarFecha.value) return mostrarError(el.agendarError, 'Elige una fecha.');
  if (!el.agendarHora.value) return mostrarError(el.agendarError, 'Elige una hora.');
  if (!el.agendarNombre.value.trim() || !el.agendarApellido.value.trim()) {
    return mostrarError(el.agendarError, 'Completa nombre y apellido.');
  }
  // Teléfono y email quedan opcionales al agendar manualmente — el barbero
  // suele tener solo el nombre de quien reservó por fuera del sitio. Si se
  // ingresan igual, se validan.
  if (telefono && !telefonoValido(telefono)) return mostrarError(el.agendarError, 'Ingresa un teléfono válido.');
  if (email && !emailValido(email)) return mostrarError(el.agendarError, 'Ingresa un email válido.');

  el.btnAgendarManual.disabled = true;

  const { error } = await supabaseClient.rpc('reservar_cita', {
    p_nombre: el.agendarNombre.value.trim(),
    p_apellido: el.agendarApellido.value.trim(),
    p_codigo_pais: el.agendarCodigoPais.value,
    p_telefono: telefono,
    p_email: email,
    p_observaciones: el.agendarObservaciones.value.trim() || null,
    p_servicio_id: servicio.id,
    p_servicio_nombre: servicio.nombre,
    p_precio: servicio.precio,
    p_fecha: el.agendarFecha.value,
    p_hora: el.agendarHora.value,
  });

  el.btnAgendarManual.disabled = false;

  if (error) {
    console.error('Error al agendar la cita:', error);
    const mensaje = error.code === 'VZ001' ? 'Ese día/hora está bloqueado.'
      : error.code === 'VZ002' ? 'Ese horario ya está lleno.'
      : 'No pudimos agendar la cita. Intenta nuevamente.';
    mostrarError(el.agendarError, mensaje);
    await renderAgendarHoraSelect();
    return;
  }

  mostrarToast('Cita agendada correctamente.', 'exito');
  el.formAgendar.reset();
  renderAgendarServicioSelect();
  renderAgendarCodigoPais();
  await renderAgendarHoraSelect();
  renderResumen();
  renderCitas();
});


/* =========================================================================
   10. BLOQUEOS DE DÍAS
   ========================================================================= */

async function renderBloqueosDias() {
  const hoyISO = toFechaISO(new Date());
  const { data, error } = await supabaseClient
    .from('bloqueos_dias')
    .select('*')
    .gte('fecha', hoyISO)
    .order('fecha');

  if (error) {
    console.error('Error al cargar días bloqueados:', error);
    el.listaBloqueosDias.innerHTML = '<p class="admin-empty">No pudimos cargar los bloqueos.</p>';
    return;
  }

  el.listaBloqueosDias.innerHTML = '';
  if (data.length === 0) {
    el.listaBloqueosDias.innerHTML = '<p class="admin-empty">No hay días bloqueados.</p>';
    return;
  }

  data.forEach((bloqueo) => {
    const row = document.createElement('div');
    row.className = 'admin-table__row';
    row.innerHTML = `
      <div class="admin-table__info">
        ${formatearFechaCorta(bloqueo.fecha)}
        ${bloqueo.motivo ? `<span class="admin-table__meta"> — ${bloqueo.motivo}</span>` : ''}
      </div>
    `;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-table-action btn-table-action--danger';
    btn.textContent = 'Quitar';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { error: delError } = await supabaseClient.from('bloqueos_dias').delete().eq('fecha', bloqueo.fecha);
      if (delError) {
        mostrarToast('No pudimos quitar el bloqueo.');
        btn.disabled = false;
        return;
      }
      renderBloqueosDias();
    });
    row.appendChild(btn);
    el.listaBloqueosDias.appendChild(row);
  });
}

el.formBloqueoDia.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (!el.bloqueoDiaFecha.value) return;

  const { error } = await supabaseClient.from('bloqueos_dias').insert({
    fecha: el.bloqueoDiaFecha.value,
    motivo: el.bloqueoDiaMotivo.value.trim() || null,
  });

  if (error) {
    mostrarToast(error.code === '23505' ? 'Ese día ya estaba bloqueado.' : 'No pudimos bloquear ese día.');
    return;
  }

  el.formBloqueoDia.reset();
  mostrarToast('Día bloqueado.', 'exito');
  renderBloqueosDias();
});


/* =========================================================================
   11. BLOQUEOS DE HORARIOS
   ========================================================================= */

function renderBloqueoHorarioHoraSelect() {
  const fechaISO = el.bloqueoHorarioFecha.value;
  const bloques = generarBloquesHora(state.horario.horaInicio, state.horario.horaFin);
  el.bloqueoHorarioHora.innerHTML = bloques.map((hora) => {
    const pasada = horaYaPaso(fechaISO, hora);
    return `<option value="${hora}" ${pasada ? 'disabled' : ''}>${hora}</option>`;
  }).join('');
}

el.bloqueoHorarioFecha.addEventListener('change', renderBloqueoHorarioHoraSelect);

async function renderBloqueosHorarios() {
  const hoyISO = toFechaISO(new Date());
  const { data, error } = await supabaseClient
    .from('bloqueos_horarios')
    .select('*')
    .gte('fecha', hoyISO)
    .order('fecha')
    .order('hora');

  if (error) {
    console.error('Error al cargar horas bloqueadas:', error);
    el.listaBloqueosHorarios.innerHTML = '<p class="admin-empty">No pudimos cargar los bloqueos.</p>';
    return;
  }

  el.listaBloqueosHorarios.innerHTML = '';
  if (data.length === 0) {
    el.listaBloqueosHorarios.innerHTML = '<p class="admin-empty">No hay horas bloqueadas.</p>';
    return;
  }

  data.forEach((bloqueo) => {
    const row = document.createElement('div');
    row.className = 'admin-table__row';
    row.innerHTML = `
      <div class="admin-table__info">
        ${formatearFechaCorta(bloqueo.fecha)} · ${bloqueo.hora}
        ${bloqueo.motivo ? `<span class="admin-table__meta"> — ${bloqueo.motivo}</span>` : ''}
      </div>
    `;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-table-action btn-table-action--danger';
    btn.textContent = 'Quitar';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { error: delError } = await supabaseClient
        .from('bloqueos_horarios')
        .delete()
        .eq('fecha', bloqueo.fecha)
        .eq('hora', bloqueo.hora);
      if (delError) {
        mostrarToast('No pudimos quitar el bloqueo.');
        btn.disabled = false;
        return;
      }
      renderBloqueosHorarios();
    });
    row.appendChild(btn);
    el.listaBloqueosHorarios.appendChild(row);
  });
}

el.formBloqueoHorario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (!el.bloqueoHorarioFecha.value || !el.bloqueoHorarioHora.value) return;

  const { error } = await supabaseClient.from('bloqueos_horarios').insert({
    fecha: el.bloqueoHorarioFecha.value,
    hora: el.bloqueoHorarioHora.value,
    motivo: el.bloqueoHorarioMotivo.value.trim() || null,
  });

  if (error) {
    mostrarToast(error.code === '23505' ? 'Esa hora ya estaba bloqueada.' : 'No pudimos bloquear esa hora.');
    return;
  }

  el.formBloqueoHorario.reset();
  mostrarToast('Hora bloqueada.', 'exito');
  renderBloqueosHorarios();
});


/* =========================================================================
   12. SOBRECUPOS
   ========================================================================= */

function renderSobrecupoHoraSelect() {
  const fechaISO = el.sobrecupoFecha.value;
  const bloques = generarBloquesHora(state.horario.horaInicio, state.horario.horaFin);
  el.sobrecupoHora.innerHTML = bloques.map((hora) => {
    const pasada = horaYaPaso(fechaISO, hora);
    return `<option value="${hora}" ${pasada ? 'disabled' : ''}>${hora}</option>`;
  }).join('');
}

el.sobrecupoFecha.addEventListener('change', renderSobrecupoHoraSelect);

async function renderSobrecupos() {
  const hoyISO = toFechaISO(new Date());
  const { data, error } = await supabaseClient
    .from('sobrecupos')
    .select('*')
    .gte('fecha', hoyISO)
    .order('fecha')
    .order('hora');

  if (error) {
    console.error('Error al cargar sobrecupos:', error);
    el.listaSobrecupos.innerHTML = '<p class="admin-empty">No pudimos cargar los sobrecupos.</p>';
    return;
  }

  el.listaSobrecupos.innerHTML = '';
  if (data.length === 0) {
    el.listaSobrecupos.innerHTML = '<p class="admin-empty">No hay sobrecupos configurados.</p>';
    return;
  }

  data.forEach((sobrecupo) => {
    const row = document.createElement('div');
    row.className = 'admin-table__row';
    row.innerHTML = `
      <div class="admin-table__info">
        ${formatearFechaCorta(sobrecupo.fecha)} · ${sobrecupo.hora}
        <span class="admin-table__meta"> — +${sobrecupo.cupos_extra} cupo${sobrecupo.cupos_extra === 1 ? '' : 's'}</span>
      </div>
    `;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-table-action btn-table-action--danger';
    btn.textContent = 'Quitar';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { error: delError } = await supabaseClient
        .from('sobrecupos')
        .delete()
        .eq('fecha', sobrecupo.fecha)
        .eq('hora', sobrecupo.hora);
      if (delError) {
        mostrarToast('No pudimos quitar el sobrecupo.');
        btn.disabled = false;
        return;
      }
      renderSobrecupos();
    });
    row.appendChild(btn);
    el.listaSobrecupos.appendChild(row);
  });
}

el.formSobrecupo.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const cupos = parseInt(el.sobrecupoCupos.value, 10);
  if (!el.sobrecupoFecha.value || !el.sobrecupoHora.value || !cupos || cupos < 1) return;

  // upsert: si ya existe un sobrecupo para ese fecha+hora, actualiza los cupos
  // extra en vez de fallar por la primary key (fecha, hora).
  const { error } = await supabaseClient
    .from('sobrecupos')
    .upsert({ fecha: el.sobrecupoFecha.value, hora: el.sobrecupoHora.value, cupos_extra: cupos }, { onConflict: 'fecha,hora' });

  if (error) {
    console.error('Error al guardar sobrecupo:', error);
    mostrarToast('No pudimos guardar el sobrecupo.');
    return;
  }

  el.formSobrecupo.reset();
  el.sobrecupoCupos.value = 1;
  mostrarToast('Sobrecupo guardado.', 'exito');
  renderSobrecupos();
});


/* =========================================================================
   13. SERVICIOS
   ========================================================================= */

async function cargarServicios() {
  const { data, error } = await supabaseClient.from('servicios').select('*').order('orden');
  if (error) {
    console.error('Error al cargar servicios:', error);
    mostrarToast('No pudimos cargar los servicios.');
    return;
  }
  state.servicios = data;
}

function renderServiciosList() {
  el.listaServicios.innerHTML = '';
  if (state.servicios.length === 0) {
    el.listaServicios.innerHTML = '<p class="admin-empty">No hay servicios creados.</p>';
    return;
  }

  state.servicios.forEach((servicio) => {
    const row = document.createElement('div');
    row.className = 'admin-table__row' + (servicio.activo ? '' : ' admin-table__row--inactivo');
    row.innerHTML = `
      <div class="admin-table__info">
        ${servicio.nombre}
        <span class="admin-table__meta"> — ${formatearPrecio(servicio.precio)} · 60 min ${servicio.activo ? '' : '· inactivo'}</span>
        ${servicio.descripcion ? `<span class="admin-table__descripcion">${servicio.descripcion}</span>` : ''}
      </div>
    `;

    const acciones = document.createElement('div');
    acciones.className = 'admin-table__actions';

    const btnEditar = document.createElement('button');
    btnEditar.type = 'button';
    btnEditar.className = 'btn-table-action';
    btnEditar.textContent = 'Editar';
    btnEditar.addEventListener('click', () => abrirEditarServicio(servicio));

    const btnToggle = document.createElement('button');
    btnToggle.type = 'button';
    btnToggle.className = 'btn-table-action';
    btnToggle.textContent = servicio.activo ? 'Desactivar' : 'Activar';
    btnToggle.addEventListener('click', async () => {
      btnToggle.disabled = true;
      const { error } = await supabaseClient.from('servicios').update({ activo: !servicio.activo }).eq('id', servicio.id);
      if (error) {
        mostrarToast('No pudimos actualizar el servicio.');
        btnToggle.disabled = false;
        return;
      }
      await cargarServicios();
      renderServiciosList();
      renderAgendarServicioSelect();
    });

    acciones.appendChild(btnEditar);
    acciones.appendChild(btnToggle);
    row.appendChild(acciones);
    el.listaServicios.appendChild(row);
  });
}

/* ---- Editar servicio (nombre, precio, descripción) ---- */

let servicioEditandoId = null;

function abrirEditarServicio(servicio) {
  servicioEditandoId = servicio.id;
  mostrarError(el.editarServicioError, '');
  el.editarServicioNombre.value = servicio.nombre;
  el.editarServicioPrecio.value = servicio.precio;
  el.editarServicioDescripcion.value = servicio.descripcion ?? '';
  el.editarServicioBackdrop.hidden = false;
}

function cerrarEditarServicio() {
  servicioEditandoId = null;
  el.editarServicioBackdrop.hidden = true;
}

el.btnCancelarEditarServicio.addEventListener('click', cerrarEditarServicio);

el.formEditarServicio.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError(el.editarServicioError, '');

  const nombre = el.editarServicioNombre.value.trim();
  const precio = parseInt(el.editarServicioPrecio.value, 10);
  const descripcion = el.editarServicioDescripcion.value.trim();

  if (!nombre) return mostrarError(el.editarServicioError, 'Ingresa un nombre.');
  if (!precio || precio < 1) return mostrarError(el.editarServicioError, 'Ingresa un precio válido.');

  const { error } = await supabaseClient
    .from('servicios')
    .update({ nombre, precio, descripcion: descripcion || null })
    .eq('id', servicioEditandoId);

  if (error) {
    console.error('Error al editar servicio:', error);
    mostrarError(el.editarServicioError, 'No pudimos guardar los cambios.');
    return;
  }

  cerrarEditarServicio();
  mostrarToast('Servicio actualizado.', 'exito');
  await cargarServicios();
  renderServiciosList();
  renderAgendarServicioSelect();
});

el.formServicio.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const nombre = el.servicioNombre.value.trim();
  const precio = parseInt(el.servicioPrecio.value, 10);
  const descripcion = el.servicioDescripcion.value.trim();
  if (!nombre || !precio || precio < 1) return;

  // duracion_min queda en el default de la tabla (60) — es fijo para todos
  // los servicios porque generarBloquesHora() asume citas de 1 hora.
  const { error } = await supabaseClient.from('servicios').insert({
    nombre,
    precio,
    descripcion: descripcion || null,
    activo: true,
    orden: state.servicios.length,
  });

  if (error) {
    console.error('Error al crear servicio:', error);
    mostrarToast('No pudimos crear el servicio.');
    return;
  }

  el.formServicio.reset();
  mostrarToast('Servicio agregado.', 'exito');
  await cargarServicios();
  renderServiciosList();
  renderAgendarServicioSelect();
});


/* =========================================================================
   14. HORARIO SEMANAL
   ========================================================================= */

async function cargarHorario() {
  const { data, error } = await supabaseClient
    .from('horario_negocio')
    .select('dias_habiles, hora_inicio, hora_fin')
    .single();

  if (error) {
    console.error('Error al cargar el horario del negocio:', error);
    return;
  }

  state.horario.diasHabiles = data.dias_habiles;
  state.horario.horaInicio = data.hora_inicio;
  state.horario.horaFin = data.hora_fin;
}

function renderDiasSemana() {
  el.diasSemana.innerHTML = '';
  ORDEN_DIAS_CHIP.forEach((dia) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dia-chip';
    btn.textContent = NOMBRES_DIA[dia];
    btn.dataset.dia = dia;
    btn.setAttribute('aria-pressed', state.horario.diasHabiles.includes(dia) ? 'true' : 'false');
    btn.addEventListener('click', () => {
      btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    });
    el.diasSemana.appendChild(btn);
  });
}

function renderHorarioSelects() {
  const opciones = Array.from({ length: 24 }, (_, h) => h);
  el.horarioInicio.innerHTML = opciones.map((h) => `<option value="${h}">${String(h).padStart(2, '0')}:00</option>`).join('');
  el.horarioFin.innerHTML = opciones.map((h) => `<option value="${h}">${String(h).padStart(2, '0')}:00</option>`).join('');
  el.horarioInicio.value = state.horario.horaInicio;
  el.horarioFin.value = state.horario.horaFin;
}

el.formHorario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError(el.horarioError, '');

  const dias = Array.from(el.diasSemana.querySelectorAll('.dia-chip[aria-pressed="true"]'))
    .map((btn) => parseInt(btn.dataset.dia, 10));
  const horaInicio = parseInt(el.horarioInicio.value, 10);
  const horaFin = parseInt(el.horarioFin.value, 10);

  if (dias.length === 0) return mostrarError(el.horarioError, 'Elige al menos un día hábil.');
  if (horaFin <= horaInicio) return mostrarError(el.horarioError, 'La hora de término debe ser mayor a la de inicio.');

  const { error } = await supabaseClient
    .from('horario_negocio')
    .update({ dias_habiles: dias, hora_inicio: horaInicio, hora_fin: horaFin, updated_at: new Date().toISOString() })
    .eq('id', true);

  if (error) {
    console.error('Error al guardar el horario:', error);
    mostrarError(el.horarioError, 'No pudimos guardar el horario.');
    return;
  }

  state.horario.diasHabiles = dias;
  state.horario.horaInicio = horaInicio;
  state.horario.horaFin = horaFin;

  mostrarToast('Horario actualizado.', 'exito');
  renderBloqueoHorarioHoraSelect();
  renderSobrecupoHoraSelect();
  renderAgendarHoraSelect();
});


/* =========================================================================
   15. CARGA INICIAL DE DATOS
   ========================================================================= */

async function cargarTodo() {
  const hoyISO = toFechaISO(new Date());
  el.agendarFecha.min = hoyISO;
  el.agendarFecha.value = hoyISO;
  el.bloqueoDiaFecha.min = hoyISO;
  el.bloqueoHorarioFecha.min = hoyISO;
  el.sobrecupoFecha.min = hoyISO;

  await Promise.all([cargarServicios(), cargarHorario()]);

  renderAgendarServicioSelect();
  renderAgendarCodigoPais();
  renderBloqueoHorarioHoraSelect();
  renderSobrecupoHoraSelect();
  renderDiasSemana();
  renderHorarioSelects();
  renderServiciosList();
  await renderAgendarHoraSelect();

  renderResumen();
  renderCitas();
  renderBloqueosDias();
  renderBloqueosHorarios();
  renderSobrecupos();
}
