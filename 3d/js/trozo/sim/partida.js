// La PARTIDA del primer trozo: el estado entero (reloj, mochila, vales, la economia de la Base, encargos, la obra del
// pozo, la mision, el aprecio de cada personaje) y lo que se puede HACER con el. Puro: el juego y la prueba sin
// navegador llaman a lo mismo. Cada accion devuelve { ok, msg } y deja en `eventos` lo que hay que avisar.
//
// La economia es la del documento de diseno: los vales no se crean al vender ni al cumplir encargos, pasan de una
// caja a otra (el 18, la Intendencia, el comercio). El precio de cada bien sigue a lo que queda en el almacen de la
// Base; el comercio compra con su caja; los encargos los paga quien los pide; y la obra recoge lo que sobra.
import { OBJETOS, RECETAS, RECURSOS, MOCHILA, LITERA, VALES_INICIO, OBRA_POZO, DIAS_RESERVA, DIA, HORA_INICIO, PERSONAS, POBLACION } from './datos.js';

const BIENES = Object.keys(OBJETOS).filter((k) => OBJETOS[k].ciudad);
const deseado = (id) => OBJETOS[id].ciudad.consumo * 24 * DIAS_RESERVA;

export function nuevaPartida() {
  const almacen = {};
  for (const id of BIENES) almacen[id] = deseado(id) * OBJETOS[id].ciudad.empieza;
  return {
    version: 1,
    t: HORA_INICIO,                       // minutos de juego desde el dia 1 a las 0:00
    vales: VALES_INICIO,
    mochila: {},
    baul: {},                             // el baul de la litera: sin limite, solo en el barracon
    equipo: { mochila: false },
    recetas: RECETAS.filter((r) => r.conocida).map((r) => r.id),
    banderas: {},                         // la historia: lo que ha pasado
    aprecio: Object.fromEntries(Object.keys(PERSONAS).map((k) => [k, 0])),
    // las cajas: la Intendencia, el comercio (Tobias y los demas puestos) y los vecinos; `emitido` = los vales nuevos
    ciudad: { almacen, intendencia: 800, comercio: 400, vecinos: 3000, poblacion: POBLACION, aguaExtra: 0, llegan: 0, emitido: 0 },
    encargos: [],                         // { id, item, cant, entregado, pago, quien, hasta, aceptado }
    siguienteEncargo: 1,
    obra: { id: OBRA_POZO.id, puesto: { piedra: 0, tablon: 0, cuerda: 0 }, vales: 0, empezada: null, terminada: null },
    recursos: {},                         // sitio -> { quedan, vuelve (t) }
    litera: false,                        // registrado en la Base: duerme en las literas y paga cada noche
    ultimoCobro: 0,                       // el dia en que se cobro la litera por ultima vez
    ultimaManana: 1,                      // el ultimo dia en que se hizo el reparto de la manana
    eventos: [],
    diario: [],
  };
}

// ---------------- leer el estado ----------------
export const dia = (p) => Math.floor(p.t / DIA) + 1;
export const hora = (p) => (p.t % DIA) / 60;
export const reloj = (p) => {
  const m = Math.floor(p.t % DIA), h = Math.floor(m / 60);
  return `Día ${dia(p)} · ${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const enMochila = (p, id) => p.mochila[id] || 0;
export const carga = (p) => Object.entries(p.mochila).reduce((s, [id, n]) => s + (OBJETOS[id].unica ? 0 : n), 0);
export const capacidad = (p) => (p.equipo.mochila ? MOCHILA.conMochila : MOCHILA.base);
export const tiene = (p, id) => enMochila(p, id) > 0 || (id === 'mochila' && p.equipo.mochila);
export function precio(p, id) {
  const o = OBJETOS[id];
  if (!o.ciudad) return o.base;
  const k = Math.pow(deseado(id) / Math.max(1, p.ciudad.almacen[id]), 0.7);
  return Math.round(o.base * Math.min(3, Math.max(0.5, k)) * 10) / 10;
}
// lo que paga el comercio por una unidad (el 60 %) y lo que cobra (el precio entero, mas o menos segun el aprecio)
export const precioCompra = (p, id) => Math.round(precio(p, id) * 0.6 * (1 + p.aprecio.tobias * 0.0015) * 10) / 10;
export const precioVenta = (p, id) => Math.round(precio(p, id) * (1 - p.aprecio.tobias * 0.0015) * 10) / 10;
export function dondeEsta(p, quien) {
  let h = hora(p);
  for (const [a, b, sitio] of PERSONAS[quien].horario) {
    if ((h >= a && h < b) || (h + 24 >= a && h + 24 < b)) return sitio;
  }
  return null;
}
export const despierto = (p, quien) => {
  const s = dondeEsta(p, quien);
  return s !== null && !s.startsWith('casa_') && !s.startsWith('tienda_') && (s !== 'torre' || PERSONAS[quien].siempre);
};

// ---------------- avisar ----------------
function avisa(p, texto, tipo = 'info') { p.eventos.push({ tipo, texto }); }
function anota(p, texto) { p.diario.push({ t: p.t, texto }); avisa(p, texto, 'diario'); }
const nombre = (id, n) => (n === 1 ? OBJETOS[id].nombre.toLowerCase() : OBJETOS[id].plural || OBJETOS[id].nombre.toLowerCase());

// ---------------- la mochila ----------------
export function dar(p, id, n = 1) {
  if (id === 'mochila' && !p.equipo.mochila) { p.equipo.mochila = true; avisa(p, 'Mochila de tela: ahora caben ' + MOCHILA.conMochila); return n; }
  const cabe = OBJETOS[id].unica ? n : Math.min(n, capacidad(p) - carga(p));
  if (cabe <= 0) { avisa(p, 'La mochila está llena', 'aviso'); return 0; }
  p.mochila[id] = enMochila(p, id) + cabe;
  avisa(p, `+${cabe} ${nombre(id, cabe)}`, 'objeto');
  return cabe;
}
export function quitar(p, id, n = 1) {
  if (enMochila(p, id) < n) return false;
  p.mochila[id] -= n;
  if (!p.mochila[id]) delete p.mochila[id];
  return true;
}
function cobra(p, v) { p.vales = Math.round((p.vales + v) * 10) / 10; if (v) avisa(p, `${v > 0 ? '+' : ''}${v} vales`, 'vales'); }

// ---------------- recoger ----------------
// cuanto tarda una unidad en `sitio` (de tipo `tipo`) y si se puede
export function puedeRecoger(p, sitio, tipo) {
  const R = RECURSOS[tipo];
  if (R.necesita && !tiene(p, R.necesita)) return { ok: false, msg: `Hace falta un ${OBJETOS[R.necesita].nombre.toLowerCase()}` };
  const s = p.recursos[sitio];
  if (s && s.quedan <= 0) {
    if (p.t < s.vuelve) return { ok: false, msg: 'Aquí ya no queda nada; vuelve más tarde' };
    p.recursos[sitio] = null;
  }
  if (carga(p) >= capacidad(p)) return { ok: false, msg: 'La mochila está llena' };
  const conHerr = R.herramienta && tiene(p, R.herramienta);
  return { ok: true, seg: conHerr ? R.segHerr : R.seg, conHerr };
}
export function recogerUno(p, sitio, tipo) {
  const R = RECURSOS[tipo], v = puedeRecoger(p, sitio, tipo);
  if (!v.ok) return v;
  const s = (p.recursos[sitio] ||= { quedan: R.cantidad, vuelve: 0 });
  if (dar(p, R.da, 1) === 0) return { ok: false, msg: 'La mochila está llena' };
  s.quedan--;
  if (s.quedan <= 0) s.vuelve = p.t + R.vuelve;
  return { ok: true, quedan: s.quedan };
}
export const quedanEn = (p, sitio, tipo) => {
  const s = p.recursos[sitio];
  if (!s) return RECURSOS[tipo].cantidad;
  return s.quedan > 0 ? s.quedan : p.t >= s.vuelve ? RECURSOS[tipo].cantidad : 0;
};

// ---------------- fabricar ----------------
export function puedeFabricar(p, recetaId, mesa) {
  const r = RECETAS.find((x) => x.id === recetaId);
  if (!p.recetas.includes(recetaId)) return { ok: false, msg: 'No sabes hacerlo' };
  if (r.mesa !== mesa) return { ok: false, msg: r.mesa === 'carpinteria' ? 'Se hace en la carpintería' : 'Se hace en un banco de trabajo' };
  for (const [id, n] of Object.entries(r.pide)) if (enMochila(p, id) < n) return { ok: false, msg: `Faltan ${n - enMochila(p, id)} ${nombre(id, n - enMochila(p, id))}` };
  if (r.da === 'mochila' && p.equipo.mochila) return { ok: false, msg: 'Ya llevas una mochila' };
  return { ok: true, seg: r.seg };
}
export function fabricar(p, recetaId, mesa) {
  const v = puedeFabricar(p, recetaId, mesa);
  if (!v.ok) return v;
  const r = RECETAS.find((x) => x.id === recetaId);
  for (const [id, n] of Object.entries(r.pide)) quitar(p, id, n);
  dar(p, r.da, r.n);
  return { ok: true };
}
export function aprender(p, recetaId) {
  if (p.recetas.includes(recetaId)) return false;
  p.recetas.push(recetaId);
  const r = RECETAS.find((x) => x.id === recetaId);
  avisa(p, `Receta nueva: ${OBJETOS[r.da].nombre}`, 'receta');
  return true;
}

// ---------------- comerciar (Tobias) ----------------
export function vender(p, id, n = 1) {
  if (!OBJETOS[id].ciudad && !['hacha', 'pico', 'cubo', 'antorcha'].includes(id)) return { ok: false, msg: 'Eso no lo compra' };
  if (enMochila(p, id) < n) return { ok: false, msg: 'No llevas tanto' };
  const c = p.ciudad, alm = c.almacen;
  if (OBJETOS[id].ciudad && alm[id] + n > 2 * deseado(id)) return { ok: false, msg: 'Tobías: «De eso ya tengo de sobra»' };
  const paga = Math.round(precioCompra(p, id) * n * 10) / 10;
  if (c.comercio < paga) return { ok: false, msg: 'Tobías: «Hoy no me queda caja para eso»' };
  quitar(p, id, n);
  if (OBJETOS[id].ciudad) alm[id] += n;
  c.comercio -= paga;
  cobra(p, paga);
  return { ok: true, paga };
}
export function comprar(p, id, n = 1) {
  const c = p.ciudad, alm = c.almacen;
  if (OBJETOS[id].ciudad && alm[id] < n + 2) return { ok: false, msg: 'Tobías: «No me queda»' };
  if (OBJETOS[id].unica) return { ok: false, msg: 'Eso no se vende' };
  const cuesta = Math.round(precioVenta(p, id) * n * 10) / 10;
  if (p.vales < cuesta) return { ok: false, msg: 'No te llegan los vales' };
  if (id === 'mochila' && p.equipo.mochila) return { ok: false, msg: 'Ya llevas una' };
  if (id !== 'mochila' && carga(p) + n > capacidad(p)) return { ok: false, msg: 'No te cabe en la mochila' };
  cobra(p, -cuesta);
  c.comercio += cuesta;
  if (OBJETOS[id].ciudad) alm[id] -= n;
  dar(p, id, n);
  return { ok: true, cuesta };
}

// ---------------- encargos (el tablon de la Intendencia) ----------------
// cada manana, y cuando un bien baja de la mitad de lo deseado, la Intendencia pone un encargo si le llega la caja
// (los de vendas los pide Amparo). Pagan el 130 % del precio del dia en que se ponen.
function ponerEncargos(p) {
  const abiertos = p.encargos.filter((e) => !e.hecho && !e.caducado);
  if (abiertos.length >= 4) return;
  for (const id of BIENES) {
    if (abiertos.length >= 4) break;
    if (abiertos.some((e) => e.item === id)) continue;
    const falta = 0.5 * deseado(id) - p.ciudad.almacen[id];
    if (falta < 2) continue;
    const quien = id === 'vendas' || id === 'hierbas' ? 'amparo' : 'intendencia';
    const cant = Math.max(3, Math.min(id === 'agua' ? 20 : 12, Math.ceil(falta)));
    const pago = Math.round(precio(p, id) * 1.3 * 10) / 10;
    if (quien === 'intendencia' && p.ciudad.intendencia - 200 < cant * pago) continue;
    const e = { id: p.siguienteEncargo++, item: id, cant, entregado: 0, pago, quien, hasta: p.t + 2 * DIA, aceptado: false };
    p.encargos.push(e);
    abiertos.push(e);
  }
}
export const encargosAbiertos = (p) => p.encargos.filter((e) => !e.hecho && !e.caducado);
export function aceptar(p, idEncargo) {
  const e = p.encargos.find((x) => x.id === idEncargo);
  if (!e || e.hecho || e.caducado) return { ok: false, msg: 'Ese encargo ya no está' };
  if (!p.litera) return { ok: false, msg: 'Primero tienes que estar registrado en la Intendencia' };
  e.aceptado = true;
  avisa(p, `Encargo: ${e.cant} ${nombre(e.item, e.cant)}`, 'encargo');
  return { ok: true };
}
// entregar lo que se lleve de un encargo aceptado (en el tablon)
export function entregar(p, idEncargo) {
  const e = p.encargos.find((x) => x.id === idEncargo);
  if (!e || !e.aceptado || e.hecho || e.caducado) return { ok: false, msg: 'Ese encargo no está aceptado' };
  const n = Math.min(enMochila(p, e.item), e.cant - e.entregado);
  if (n <= 0) return { ok: false, msg: `No llevas ${nombre(e.item, 2)}` };
  const caja = e.quien === 'intendencia' ? 'intendencia' : 'comercio';
  const paga = Math.round(Math.min(n * e.pago, p.ciudad[caja]) * 10) / 10;
  quitar(p, e.item, n);
  p.ciudad.almacen[e.item] += n;
  p.ciudad[caja] -= paga;
  e.entregado += n;
  cobra(p, paga);
  if (e.entregado >= e.cant) {
    e.hecho = true;
    p.aprecio[e.quien === 'amparo' ? 'amparo' : 'elena'] += 5;
    avisa(p, 'Encargo cumplido', 'encargo');
  }
  return { ok: true, n, paga };
}

// ---------------- la obra del segundo pozo ----------------
export const obraPide = (p) => Object.fromEntries(Object.entries(OBRA_POZO.pide).map(([id, n]) => [id, n - p.obra.puesto[id]]));
export const obraLista = (p) => Object.values(obraPide(p)).every((n) => n <= 0) && p.obra.vales >= OBRA_POZO.vales;
export function aportar(p, id, n) {
  if (p.obra.empezada !== null) return { ok: false, msg: 'La obra ya está en marcha' };
  if (id === 'vales') {
    const v = Math.min(n, p.vales, OBRA_POZO.vales - p.obra.vales);
    if (v <= 0) return { ok: false, msg: p.vales <= 0 ? 'No tienes vales' : 'Ya no hacen falta vales' };
    cobra(p, -v);
    p.obra.vales += v;
    p.aprecio.elena += Math.round(v / 20);
  } else {
    const falta = obraPide(p)[id];
    const m = Math.min(n, enMochila(p, id), falta);
    if (falta <= 0) return { ok: false, msg: `Ya no hacen falta ${nombre(id, 2)}` };
    if (m <= 0) return { ok: false, msg: `No llevas ${nombre(id, 2)}` };
    quitar(p, id, m);
    p.obra.puesto[id] += m;
    p.aprecio.elena += m;
    avisa(p, `Aportas ${m} ${nombre(id, m)} al pozo`, 'obra');
  }
  completarObra(p);
  return { ok: true };
}
// con todo el material puesto, la Intendencia pone los vales que falten si le sobran (por encima de 400)
function completarObra(p) {
  const matOk = Object.values(obraPide(p)).every((n) => n <= 0);
  if (matOk && p.obra.vales < OBRA_POZO.vales) {
    const v = Math.min(OBRA_POZO.vales - p.obra.vales, Math.max(0, p.ciudad.intendencia - 400));
    if (v > 0) { p.ciudad.intendencia -= v; p.obra.vales += v; avisa(p, `La Intendencia pone ${Math.round(v)} vales para los jornales`, 'obra'); }
  }
  if (obraLista(p) && p.obra.empezada === null) empezarObra(p);
}
function empezarObra(p) {
  p.obra.empezada = p.t;
  anota(p, 'El segundo pozo tiene todo lo que pedía: empiezan a levantarlo.');
}

// ---------------- el baul de la litera ----------------
export function guardar(p, id, n) {
  const m = Math.min(n, enMochila(p, id));
  if (m <= 0 || OBJETOS[id].unica) return { ok: false, msg: 'No llevas eso' };
  quitar(p, id, m);
  p.baul[id] = (p.baul[id] || 0) + m;
  return { ok: true, n: m };
}
export function sacar(p, id, n) {
  const m = Math.min(n, p.baul[id] || 0, capacidad(p) - carga(p));
  if (m <= 0) return { ok: false, msg: (p.baul[id] || 0) ? 'No te cabe' : 'No hay' };
  p.baul[id] -= m;
  if (!p.baul[id]) delete p.baul[id];
  p.mochila[id] = enMochila(p, id) + m;
  return { ok: true, n: m };
}

// ---------------- la litera y dormir ----------------
export function registrar(p) {
  if (p.litera) return false;
  p.litera = true;
  p.ultimoCobro = dia(p);
  anota(p, 'Registrado en la Intendencia: tienes litera en el barracón, 5 vales por noche.');
  return true;
}
// dormir en la litera: de la noche (20:00 a 6:00) a las 6:00 del dia siguiente
export function puedeDormir(p) {
  if (!p.litera) return { ok: false, msg: 'No tienes litera' };
  const h = hora(p);
  if (h >= 6 && h < 20) return { ok: false, msg: 'Aún es de día' };
  return { ok: true };
}
export function dormir(p) {
  const v = puedeDormir(p);
  if (!v.ok) return v;
  const h = hora(p);
  const hasta = (h >= 20 ? dia(p) : dia(p) - 1) * DIA + 6 * 60;
  avanzar(p, hasta - p.t);
  avisa(p, 'Duermes hasta las 6:00', 'info');
  return { ok: true };
}

// ---------------- el paso del tiempo ----------------
// avanza `min` minutos de juego: la Base consume y produce, se cobra la litera, amanece (encargos, cajas), la obra
// se levanta y los encargos caducan. Se trocea en pasos de una hora como mucho.
export function avanzar(p, min) {
  while (min > 0) {
    const d = Math.min(60, min);
    pasoCiudad(p, d / 60);
    p.t += d;
    min -= d;
    // a las 22:00 se cobra la litera; si no llega, se queda debiendo (el aprecio de Elena baja)
    if (p.litera && hora(p) >= 22 && p.ultimoCobro < dia(p)) {
      p.ultimoCobro = dia(p);
      if (p.vales >= LITERA) { cobra(p, -LITERA); p.ciudad.intendencia += LITERA; }
      else { p.aprecio.elena -= 3; avisa(p, 'No te llega para la litera: Elena lo apunta', 'aviso'); }
    }
    if (hora(p) >= 6 && p.ultimaManana < dia(p)) manana(p);
    // la obra: con todo puesto, se levanta en unas horas
    if (p.obra.empezada !== null && p.obra.terminada === null && p.t - p.obra.empezada >= OBRA_POZO.horasObra * 60) {
      p.obra.terminada = p.t;
      p.ciudad.aguaExtra += OBRA_POZO.agua;
      p.ciudad.llegan += OBRA_POZO.llegan;
      p.ciudad.vecinos += p.obra.vales;              // los jornales: el dinero vuelve a los vecinos que la levantan
      anota(p, 'El segundo pozo está terminado: hay agua para más gente.');
      if (p.banderas.mision === 'pozo') p.banderas.pozoAvisar = true;
    }
    for (const e of p.encargos) if (!e.hecho && !e.caducado && p.t > e.hasta) { e.caducado = true; if (e.aceptado) avisa(p, 'Un encargo ha caducado', 'aviso'); }
  }
}
function pasoCiudad(p, horas) {
  const c = p.ciudad;
  for (const id of BIENES) {
    const b = OBJETOS[id].ciudad;
    const prod = (b.prod + (id === 'agua' ? c.aguaExtra : 0)) * horas, cons = b.consumo * (c.poblacion / POBLACION) * horas;
    c.almacen[id] = Math.max(0, c.almacen[id] + prod - cons);
  }
}
function manana(p) {
  p.ultimaManana = dia(p);
  const c = p.ciudad;
  // las cajas de la manana: los vales pasan de unas a otras, no se crean. Los vecinos pagan impuestos y alquileres
  // a la Intendencia y compran en el comercio; la Intendencia paga sueldos (guardias, limpieza) y el comercio paga a
  // los que producen. Cada pago, hasta donde llegue la caja que paga.
  const k = c.poblacion / POBLACION;
  const mover = (de, a, v) => { const m = Math.max(0, Math.min(v, c[de])); c[de] -= m; c[a] += m; };
  mover('vecinos', 'intendencia', 110 * k);
  mover('intendencia', 'vecinos', 70 * k);
  mover('vecinos', 'comercio', 80 * k);
  mover('comercio', 'vecinos', 50 * k);
  // la Intendencia pone en la obra la mitad de lo que le sobra por encima de 400
  if (p.obra.empezada === null) {
    const sobra = Math.max(0, c.intendencia - 400) * 0.5;
    const v = Math.min(sobra, OBRA_POZO.vales - p.obra.vales);
    if (v > 0) { c.intendencia -= v; p.obra.vales += v; }
    completarObra(p);
  }
  // los que llegan tras el pozo
  // (cada uno trae sus ahorros: los unicos vales nuevos de la partida)
  if (c.llegan > 0) {
    c.poblacion += c.llegan; c.vecinos += 10 * c.llegan; c.emitido += 10 * c.llegan;
    avisa(p, `Han entrado ${c.llegan} refugiados nuevos`, 'diario'); c.llegan = 0;
  }
  ponerEncargos(p);
}

// ---------------- guardar ----------------
export function aTexto(p) { return JSON.stringify({ ...p, eventos: [] }); }
export function deTexto(s) {
  const p = JSON.parse(s);
  if (!p || p.version !== 1) throw new Error('partida de otra version');
  p.eventos = [];
  return p;
}
export { BIENES, deseado };
// el primer reparto (dia 1) se hace al crear: asi hay encargos desde el principio
export function empezar() { const p = nuevaPartida(); ponerEncargos(p); return p; }
