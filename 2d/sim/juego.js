// La partida de un nivel: crearPartida() la monta desde el mapa y paso() la avanza un paso fijo y
// devuelve lo que ha pasado (eventos) para que la web lo pinte y lo suene. Sin DOM: el test la juega.
import { J, T, DT } from './constantes.js';
import { NIVELES } from './niveles.js';
import { PASOS, unir } from './pasos.js';
import { leerMapa, celda, ponerCelda, AIRE, MACIZO, HUNDE, TALLO, PUERTA, PINCHO } from './mapa.js';
import { moverX, moverY, suelo, tocaPinchos, vista, solapan, libre, cx, cy } from './fisica.js';
import { crearJugador, actualizarJugador } from './jugador.js';
import { crearEnemigo, actualizarEnemigos, golpearEnemigo, cajaAtaque, cajaChoque, aturdir } from './enemigos.js';
import { crearJefe, actualizarJefe, golpearJefe, aturdirJefe } from './jefe.js';
import { nivelZona } from './zona_lab.js';
import { montarZona, interactuarZona, pasoZonaAntes, pasoZonaDespues, estadoZona, lugarBanco } from './zona.js';

export { NIVELES };

// Que sabe hacer el 18 al empezar cada nivel (lo que gano en los anteriores)
export function habInicial(id) {
  // la zona conectada del laboratorio ('lab', sim/zona_lab.js) empieza sin nada: el doble salto, el gancho y el
  // teletransporte se ganan en ella
  if (id === 'lab') return { gancho: false, daga: false, lanzar: false, tele: false, zorro: false, doble: false };
  return {
    gancho: id >= 5,
    daga: id >= 8,
    lanzar: id >= 8,
    tele: id >= 11,
    zorro: false,
    doble: true,
  };
}

function rng(E) {
  E.semilla = (E.semilla * 1664525 + 1013904223) >>> 0;
  return E.semilla / 4294967296;
}

// un suelo que se hunde tarda esto en volver (el dibujo lo usa para hacer caer la losa con su hierba)
export const HUNDE_VUELVE = 3.5;

export function crearPartida(id, o = {}) {
  // si el paso a su vecino es `continuo`, el nivel lleva pegado el trozo del otro (pasos.js)
  const u = unir(id === 'lab' ? nivelZona() : NIVELES.find((n) => n.id === id), NIVELES);
  const nivel = u.nivel;
  const m = leerMapa(nivel);
  const hechos = new Set(o.hechos || []);
  const hab = { ...habInicial(id), ...(o.hab || {}) };
  const E = {
    id, nivel, m, hab, hechos, t: 0, semilla: 12345 + (nivel.semilla ?? id) * 777,
    mundo: { m, solidos: [] },
    notas: [], items: [], controles: [], dosis: [], anclas: [], lanzadores: [], tornillos: [], objetos: [],
    enemigos: [], proyectiles: [], ondas: [], cristales: [], rejillas: [], zonas: [], flotantes: [], gigantes: [],
    hunde: new Map(), puertas: [], marcas: m.marcas, jefe: null, bus: null, persecucion: null, salida: null,
    estado: 'jugando', aviso: null, terminado: false, notasLeidas: new Set(o.notasLeidas || []),
    control: o.control || null, intro: !!nivel.intro && !o.control && !o.sinIntro,
  };
  E.vistaAncla = (x0, y0, x1, y1) => vista(E.mundo, x0, y0, x1, y1);
  E.peligroEn = (c) => tocaPinchos(c, m);

  let inicio = null;
  let nNota = 0;
  const zonaEsq = {};
  for (const c of m.cosas) {
    const xc = c.i * T + T / 2, pie = (c.j + 1) * T;
    switch (c.c) {
      case 'P': inicio = { x: xc, pie }; break;
      case 'S': E.salida = { x: c.i * T - 16, y: (c.j - 2) * T, w: 2 * T, h: 3 * T }; break;
      case 'N': E.notas.push({ n: nivel.notas[nNota++], x: xc, pie }); break;
      case 'C': E.controles.push({ x: xc, pie, activo: false }); break;
      case 'D': E.dosis.push({ x: xc, y: pie - 20, cogida: false }); break;
      case 'o': E.anclas.push({ x: () => xc, y: () => c.j * T + T / 2, fija: true }); break;
      case 't': E.lanzadores.push({ x: xc, y: (c.j + 1) * T, fase: (c.i * 0.37) % 1, t: 0, aviso: false }); break;
      case 'k': E.objetos.push({ x: xc - 10, y: pie - 16, w: 20, h: 16, x0: xc - 10, y0: pie - 16, vx: 0, vy: 0, llevado: false, volando: false, quieto: 0 }); break;
      case 'e': E.enemigos.push(crearEnemigo('soldado', xc, pie)); break;
      case 'a': E.enemigos.push(crearEnemigo('hormiga', xc, pie)); break;
      case 'z': E.enemigos.push(crearEnemigo('espora', xc, pie)); break;
      case 'Y': E.enemigos.push(crearEnemigo('tallo', xc, pie)); break;
      case 'G': E.items.push({ tipo: nivel.item, x: xc, pie, cogido: !!hab[nivel.item] }); break;
      case 'R': case 'Q': case '&': {
        // las puertas de los hacks: la rejilla (1), la compuerta del hospital (2) y la raiz del tocon del Linde (3)
        const s = { x: c.i * T + 6, y: (c.j - 2) * T, w: T - 12, h: 3 * T, activo: true, firme: true, rejilla: true };
        const r = { tipo: c.c === 'R' ? 1 : c.c === 'Q' ? 2 : 3, x: xc, pie, solido: s, abierta: false };
        if (hechos.has('hack' + r.tipo)) { r.abierta = true; s.activo = false; }
        E.rejillas.push(r); E.mundo.solidos.push(s);
        break;
      }
      case '[': zonaEsq.a = c; break;
      case ']': zonaEsq.b = c; break;
      case 'f': flotante(E, c.i, c.j, 2, 1, 'escombro'); break;
      case 'B': {
        E.jefePos = { x: xc, pie };
        break;
      }
    }
  }
  if (zonaEsq.a && zonaEsq.b) {
    E.zonas.push({ x: zonaEsq.a.i * T, y: zonaEsq.a.j * T, w: (zonaEsq.b.i - zonaEsq.a.i + 1) * T, h: (zonaEsq.b.j - zonaEsq.a.j + 1) * T });
  }
  for (const mk of m.marcas) {
    if (mk.tipo === 'flotante') flotante(E, mk.i, mk.j, mk.ancho, mk.alto, mk.forma);
  }
  // puertas del ruedo (abiertas hasta que empieza la pelea)
  for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) if (m.t[j * m.w + i] === PUERTA) { E.puertas.push({ i, j }); m.t[j * m.w + i] = AIRE; }
  if (E.jefePos) {
    const xs = E.puertas.map((p) => p.i * T);
    const x0 = Math.min(...xs) + T, x1 = Math.max(...xs);
    E.jefe = crearJefe(E.jefePos.x, E.jefePos.pie, x0, x1);
    E.ruedo = { x0, x1 };
    if (hechos.has('jefe')) { E.jefe.estado = 'vencido'; E.jefe.despierto = true; E.jefe.vida = 0; }
  }
  // los tallos ya cortados
  if (hechos.has('tallos')) quitarTallos(E, []);

  montarTrampa(E, hechos);
  montarBus(E, hechos);
  if (nivel.persecucion) {
    const mk = (c) => m.marcas.find((q) => q.c === c);
    const a = mk(nivel.persecucion.desde), b = mk(nivel.persecucion.hasta);
    // dir -1: persiguen hacia el oeste (la huida de la zona); fila: en la zona solo cuenta a esa altura
    E.persecucion = { x0: a.i * T, x1: b.i * T, vel: nivel.persecucion.vel, dir: nivel.persecucion.dir || 1, fila: nivel.zonaLab ? (a.j + 1) * T : null, activa: false, hecha: hechos.has('persecucion'), frente: 0, t: 0, golpe: 0 };
  }

  const sitio = E.control || inicio;
  E.inicio = inicio;
  E.p = crearJugador(sitio.x, sitio.pie);
  // por donde se entra y se sale (pasos.js): puertas, montacargas, conducto... o la calle seguida
  const pt = PASOS[id] || {};
  E.costura = u.costura || null; E.desplX = u.desplX || 0; E.comun = u.mundo || null;
  const hay = (tipo) => tipo && tipo !== 'continuo' && tipo !== 'borde';
  // el techo que hay encima de un sitio (para las escotillas y las trampillas)
  const techoSobre = (x, pie) => { const i = Math.floor(x / T); for (let j = Math.floor(pie / T) - 1; j >= 0; j--) if (m.t[j * m.w + i] === MACIZO) return (j + 1) * T; return null; };
  E.puertaEntrada = hay(pt.entrada) && inicio ? { tipo: pt.entrada, x: inicio.x, pie: inicio.pie, abre: 0, entrada: true, viene: pt.viene, desp: 0 } : null;
  E.puertaSalida = hay(pt.salida) && E.salida ? { tipo: pt.salida, x: E.salida.x + 32, pie: E.salida.y + E.salida.h, abre: 0, va: pt.va, desp: 0 } : null;
  if (E.puertaSalida && E.puertaSalida.tipo === 'escalera') E.puertaSalida.techo = techoSobre(E.puertaSalida.x, E.puertaSalida.pie) ?? E.puertaSalida.pie - 3 * T;
  if (E.puertaEntrada && E.puertaEntrada.tipo === 'trampilla') { const tt = techoSobre(inicio.x, inicio.pie); if (tt === null) E.puertaEntrada.tipo = 'cae'; else E.puertaEntrada.techo = tt; }
  // salir por el borde: sin pared a la derecha y sin puerta (la S no hace falta)
  if (pt.salida === 'borde') { E.borde = true; E.salida = null; m.abreDer = true; }
  if (o.llegada) {
    // llega andando por la calle desde el nivel de al lado: el mismo 18, en el mismo sitio, con su velocidad
    Object.assign(E.p, o.llegada);
  } else if (o.entrada && E.puertaEntrada && !E.control && !E.intro) {
    // llegando por una puerta: sale de ella andando; por el montacargas, la jaula llega por su hueco
    E.estado = 'entrando'; E.p.cara = 1;
    const pu = E.puertaEntrada, p = E.p;
    if (pu.tipo === 'ascensor') {
      pu.desp = pu.viene === 'abajo' ? RECORRIDO : -RECORRIDO;
      p.y += pu.desp; p.enJaula = true;
      E.cruce = { fase: 'llega', t: 0 };
    } else if (pu.tipo === 'escalera') {
      // asoma por una escotilla del suelo: empieza debajo, solo se ve lo que sale por encima del suelo
      p.y = pu.pie; p.recorte = { y1: pu.pie }; E.cruce = { fase: 'abre', t: 0 };
    } else if (pu.tipo === 'trampilla') {
      // cae por una trampilla del techo: empieza dentro del hueco, solo se ve por debajo del techo
      p.y = pu.techo - p.h; p.recorte = { y0: pu.techo }; E.cruce = { fase: 'abre', t: 0 };
    } else if (pu.tipo === 'cae') {
      p.y = pu.pie - 330; p.vy = 0; E.cruce = { fase: 'cae', t: 0 };
    } else { p.dentro = 1; E.cruce = { fase: 'abre', t: 0 }; }
  }
  if (E.control) for (const c of E.controles) if (Math.abs(c.x - E.control.x) < 4) c.activo = true;
  // la zona conectada: frascos de reserva, la luz al morir, motas, fragmento, esclusa, suelo falso, lo visto
  if (nivel.zonaLab) montarZona(E, o);
  return E;
}

function flotante(E, i, j, w, h, forma) {
  const s = { x: i * T + (T - w * T) / 2 + (w % 2 ? 0 : T / 2), y: j * T, w: w * T, h: h * T, activo: true, firme: false, flota: true, forma, fase: (i * 0.71 + j * 0.37) % 6.28 };
  s.x = i * T;   // la marca es la esquina de arriba a la izquierda
  E.flotantes.push(s); E.mundo.solidos.push(s);
}

function montarTrampa(E, hechos) {
  const tr = E.nivel.trampa;
  if (!tr) return;
  const mk = (c) => E.m.marcas.find((q) => q.c === c);
  const v = mk(tr.disparo);
  // zona: la caja (casillas) donde salta la trampa; en la zona se entra en ella por los dos lados
  E.trampa = { x: v.i * T + T / 2, hecha: hechos.has('trampa'), zona: tr.zona ? tr.zona.map((q) => q * T) : null };
  for (const c of tr.tornillos || [tr.atras, tr.delante]) {
    const g = mk(c);
    const yFin = (g.j + 1) * T - g.alto * T;
    const s = { x: g.i * T + T / 2 - (g.ancho * T) / 2, y: E.trampa.hecha ? yFin : -g.alto * T - 200, w: g.ancho * T, h: g.alto * T, activo: E.trampa.hecha, firme: true, ancla: true, gigante: true };
    const gig = { s, yFin, vy: 0, estado: E.trampa.hecha ? 'puesto' : 'arriba', gancho: !!g.gancho };
    E.gigantes.push(gig); E.mundo.solidos.push(s);
    if (gig.gancho) {
      E.anclas.push({ x: () => s.x - 4, y: () => s.y + 12, get oculta() { return gig.estado !== 'puesto'; }, gigante: gig, subir: () => ({ x: s.x + 6, y: s.y }) });
      // con la lista de tornillos (la zona), cada cabeza lleva anilla tambien por el otro lado: se trepa desde los dos
      if (tr.tornillos) E.anclas.push({ x: () => s.x + s.w + 4, y: () => s.y + 12, get oculta() { return gig.estado !== 'puesto'; }, gigante: gig, subir: () => ({ x: s.x + s.w - 28, y: s.y }) });
      E.items.push({ tipo: 'linea', x: s.x - 18, pie: (g.j + 1) * T, cogido: !!E.hab.gancho, get oculto() { return gig.estado !== 'puesto'; }, gig });
    }
  }
}

function montarBus(E, hechos) {
  const mk = E.m.marcas.find((q) => q.tipo === 'autobus');
  if (!mk) return;
  const w = mk.largo * T, h = mk.alto * T;
  const x0 = mk.i * T, xFin = x0 - mk.recorrido * T;
  const s = { x: hechos.has('bus') ? xFin : x0, y: (mk.j + 1) * T - h, w, h, activo: true, firme: true, ancla: true, bus: true, dx: 0 };
  const bus = {
    s, x0, xFin, libre: hechos.has('bus'), arrastrable: true, velArrastre: 70, sonido: 0,
    tirar(dir, dt, ev) {
      if (bus.libre || dir >= 0) return;
      s.dx = -bus.velArrastre * dt;
      s.x += s.dx;
      bus.sonido -= dt;
      if (bus.sonido <= 0) { bus.sonido = 0.35; ev.push({ t: 'bus_arrastra', x: s.x, y: s.y + s.h }); }
      if (s.x <= xFin) { s.x = xFin; bus.libre = true; E.hechos.add('bus'); ev.push({ t: 'bus_libre', x: s.x + s.w / 2, y: s.y }); }
    },
  };
  E.bus = bus; E.mundo.solidos.push(s);
  E.anclas.push({ x: () => s.x - 4, y: () => s.y + T * 1.2, obj: bus, get oculta() { return bus.libre; } });
}

function quitarTallos(E, ev) {
  const m = E.m;
  let hubo = false;
  for (let k = 0; k < m.t.length; k++) if (m.t[k] === TALLO) { m.t[k] = AIRE; hubo = true; }
  for (const en of E.enemigos) if (en.tipo === 'tallo') en.vivo = false;
  if (hubo) { E.hechos.add('tallos'); ev.push({ t: 'tallos_caen' }); }
}

// ------------------------------------------------------------------ dano al 18
export function danar(E, n, desdeX, ev, forzar = false) {
  const p = E.p;
  if (p.muerto || (!forzar && p.invul > 0)) return false;
  let vida = p.vida - n;
  // GDD: a punto de caer ante el escarabajo, despierta el zorro (el miedo)
  if (E.jefe && E.jefe.despierto && E.jefe.estado !== 'vencido' && !E.hab.zorro && vida <= 2) {
    E.hab.zorro = true; p.zorro = true; vida = J.vida; p.invul = 2.2;
    ev.push({ t: 'despierta_zorro', x: cx(p), y: cy(p) });
    p.vida = vida;
    return true;
  }
  p.vida = vida;
  if (p.racha) { p.racha = 0; ev.push({ t: 'racha_fin' }); }
  p.invul = J.invul; p.aturdido = J.golpeT;
  const d = Math.sign(cx(p) - desdeX) || -p.cara;
  p.vx = d * J.golpeVx; p.vy = -J.golpeVy * 0.6;
  p.cuerda = null; p.trepa = false; p.carga = 0; p.sunikel = 0; p.cura = 0; p.cargaD = 0; p.cargadoD = false; p.estocada = 0;
  if (p.lleva) { p.lleva.llevado = false; p.lleva.volando = true; p.lleva.vx = 0; p.lleva.vy = 0; p.lleva = null; }
  ev.push({ t: 'dano', x: cx(p), y: cy(p), vida: p.vida });
  if (p.vida <= 0) { p.vida = 0; p.muerto = true; E.estado = 'muerto'; E.tMuerte = 0; ev.push({ t: 'muere_18', x: cx(p), y: cy(p) }); }
  return true;
}

function peligro(E, ev) {
  // cristal roto o caida al vacio: dosis menos y de vuelta al ultimo sitio firme
  const p = E.p;
  ev.push({ t: 'peligro', x: cx(p), y: cy(p) });
  danar(E, 1, cx(p), ev, true);
  if (p.muerto) return;
  p.x = p.seguro.x; p.y = p.seguro.y; p.vx = 0; p.vy = 0; p.cuerda = null; p.trepa = false;
  p.aturdido = 0.3; p.invul = 1.0;
  ev.push({ t: 'vuelve', x: cx(p), y: cy(p) });
}

// ------------------------------------------------------------------ lo que se toca con E
function interactuar(E, ev) {
  const p = E.p;
  const pie = p.y + p.h;
  const cerca = (x, y, r = 44) => Math.abs(x - cx(p)) < r && Math.abs(y - pie) < 50;
  if (E.zl) { const z = interactuarZona(E, cerca, ev); if (z) return z; }
  for (const n of E.notas) if (cerca(n.x, n.pie)) return { tipo: 'nota', n, hacer: () => { p.leyendo = true; E.estado = 'nota'; E.notaAbierta = n.n; E.notasLeidas.add(n.n); ev.push({ t: 'nota', n: n.n }); } };
  for (const it of E.items) {
    if (it.cogido || it.oculto || it.tipo === 'tele' || it.tipo === 'doble') continue;
    if (cerca(it.x, it.pie, 50)) return { tipo: it.tipo, hacer: () => cogerItem(E, it, ev) };
  }
  for (const r of E.rejillas) {
    if (r.abierta) continue;
    if (r.tipo === 2 && E.jefe && E.jefe.estado !== 'vencido') continue;
    if (cerca(r.x, r.pie, 70)) return { tipo: 'hack' + r.tipo, hacer: () => { E.estado = 'hack'; E.hackAbierto = r; p.leyendo = true; ev.push({ t: 'hack', tipo: r.tipo }); } };
  }
  return null;
}

function cogerItem(E, it, ev) {
  const p = E.p;
  it.cogido = true;
  if (it.tipo === 'linea') {
    E.hab.gancho = true;
    const a = E.anclas.find((q) => q.gigante === it.gig);
    p.cuerda = { a, L: Math.max(J.ganchoMin, Math.hypot(a.x() - cx(p), a.y() - cy(p))) };
    ev.push({ t: 'habilidad', h: 'gancho' });
    ev.push({ t: 'engancha', x: a.x(), y: a.y() });
    return;
  }
  E.hab[it.tipo] = true;
  ev.push({ t: 'habilidad', h: it.tipo, x: it.x, y: it.pie });
}

export function cerrarNota(E) { E.p.leyendo = false; E.estado = 'jugando'; E.notaAbierta = null; }
export function finIntro(E) { E.intro = false; }
export function resolverHack(E, ok, ev = []) {
  const r = E.hackAbierto;
  E.p.leyendo = false; E.estado = 'jugando'; E.hackAbierto = null;
  if (!ok || !r) return ev;
  r.abierta = true; r.solido.activo = false;
  E.hechos.add('hack' + r.tipo);
  ev.push({ t: 'rejilla_abre', x: r.x, y: r.pie, tipo: r.tipo });
  return ev;
}
export function reaparecer(E) {
  // la zona conectada: en el ultimo frasco de reserva, con lo que se lleva (la luz que dejo al morir, lo visto...)
  if (E.zl) return crearPartida(E.id, { hab: E.hab, hechos: E.hechos, control: lugarBanco(E), notasLeidas: E.notasLeidas, sinIntro: true, zl: estadoZona(E) });
  return crearPartida(E.id, { hab: E.hab, hechos: E.hechos, control: E.control || E.inicio, notasLeidas: E.notasLeidas, sinIntro: true });
}

// ------------------------------------------------------------------ cruzar una puerta
// Entrando: la puerta se abre, el 18 sale de dentro andando (de la oscuridad del umbral, `p.dentro` 1 -> 0)
// y sigue unos pasos hasta quedar fuera. Saliendo: anda hasta el centro de la puerta (abierta), se mete
// andando (`p.dentro` 0 -> 1), la puerta se cierra detras y solo entonces se pasa al sitio siguiente.
const ANDA = { izq: false, der: true, arriba: false, abajo: false, salto: false, ataque: false, accion: false, lanzar: false, zorro: false };
const ATRAS = { ...ANDA, der: false, izq: true };
const T_UMBRAL = 0.55, T_PUERTA = 0.35;
const RECORRIDO = 170, V_JAULA = 190, V_TREPA = 80;          // el montacargas: lo que recorre la jaula a la vista y su velocidad (u/s)

function poseCruce(p, pose, dt) {
  if (p.pose !== pose) { p.pose = pose; p.tPose = 0; } else p.tPose += dt;
}

function andarQuieto(p, dt) {
  if (p.pose !== 'reposo') { p.pose = 'reposo'; p.tPose = 0; } else p.tPose += dt;
}

function andarEnSitio(p, dt) {
  if (p.pose !== 'correr') { p.pose = 'correr'; p.tPose = 0; } else p.tPose += dt;
}

function cruzar(E, ev, dt) {
  const p = E.p, c = E.cruce;
  c.t += dt;
  const NADA = { ...ANDA, der: false };
  if (E.estado === 'entrando') {
    const pu = E.puertaEntrada;
    if (c.fase === 'llega') {
      // la jaula del montacargas llega por su hueco con el 18 dentro, frena y se para
      const antes = pu.desp;
      const v = Math.min(V_JAULA, 40 + Math.abs(pu.desp) * 2.4) * dt;
      pu.desp = Math.abs(pu.desp) <= v ? 0 : pu.desp - Math.sign(pu.desp) * v;
      p.y += pu.desp - antes; p.vx = 0; p.vy = 0; andarQuieto(p, dt);
      if (pu.desp === 0) { p.enJaula = false; c.fase = 'abre'; c.t = 0; ev.push({ t: 'jaula_para', x: pu.x, y: pu.pie }); }
      return;
    }
    if (c.fase === 'abre' && (pu.tipo === 'escalera' || pu.tipo === 'trampilla')) {
      if (pu.abre === 0) ev.push({ t: 'puerta_abre', x: pu.x, y: pu.pie, tipo: pu.tipo });
      pu.abre = Math.min(1, pu.abre + dt / 0.3);
      if (pu.abre >= 1) { c.fase = pu.tipo === 'escalera' ? 'trepa' : 'cae'; c.t = 0; }
      return;
    }
    if (c.fase === 'trepa') {
      // subiendo por la escalerilla hasta poner los pies en el suelo
      p.x = pu.x - p.w / 2; p.vx = 0; p.vy = 0;
      p.y = Math.max(pu.pie - p.h, p.y - V_TREPA * dt);
      poseCruce(p, 'trepar', dt);
      if (p.y <= pu.pie - p.h) { p.recorte = null; p.enSuelo = true; c.fase = 'anda'; c.t = 0; }
      return;
    }
    if (c.fase === 'cae') {
      // cayendo (de la trampilla del techo o del cielo) hasta tocar el suelo
      p.vy = Math.min(1100, p.vy + 1700 * dt); p.y += p.vy * dt; p.vx = 0;
      poseCruce(p, 'caer', dt);
      if (p.y + p.h >= pu.pie) {
        p.y = pu.pie - p.h; ev.push({ t: 'aterriza', x: cx(p), y: pu.pie, fuerte: p.vy > 760 });
        p.vy = 0; p.enSuelo = true; p.recorte = null; c.fase = 'posa'; c.t = 0;
      }
      return;
    }
    if (c.fase === 'posa') { poseCruce(p, 'aterriza', dt); if (c.t > 0.22) { E.estado = 'jugando'; E.cruce = null; } return; }
    if (c.fase === 'abre' && pu.tipo === 'ascensor') {
      if (pu.abre === 0) ev.push({ t: 'puerta_abre', x: pu.x, y: pu.pie, tipo: pu.tipo });
      pu.abre = Math.min(1, pu.abre + dt / T_PUERTA);
      if (pu.abre >= 1) { c.fase = 'anda'; c.t = 0; }
      return;
    }
    if (c.fase === 'abre') {
      if (pu.abre === 0) ev.push({ t: 'puerta_abre', x: pu.x, y: pu.pie, tipo: pu.tipo });
      pu.abre = Math.min(1, pu.abre + dt / T_PUERTA);
      actualizarJugador(p, NADA, NADA, E, ev, dt);
      if (pu.abre >= 1) { c.fase = 'sale'; c.t = 0; }
    } else if (c.fase === 'sale') {
      p.dentro = Math.max(0, p.dentro - dt / T_UMBRAL);
      andarEnSitio(p, dt);
      if (p.dentro <= 0) { c.fase = 'anda'; c.t = 0; }
    } else {
      // ya fuera: unos pasos mas hasta dejar la puerta atras, y a jugar
      actualizarJugador(p, ANDA, NADA, E, ev, dt);
      if (cx(p) > pu.x + 40 || c.t > 0.8) { E.estado = 'jugando'; E.cruce = null; }
    }
    return;
  }
  const pu = E.puertaSalida;
  if (c.fase === 'acerca') {
    if (pu.tipo !== 'trampilla' && pu.tipo !== 'escalera') pu.abre = Math.min(1, pu.abre + dt / T_PUERTA);
    const dx = pu.x - cx(p);
    if ((Math.abs(dx) < 5 && p.enSuelo) || c.t > 2.5) { c.fase = pu.tipo === 'escalera' ? 'trepa' : pu.tipo === 'trampilla' ? 'abreT' : 'entra'; c.t = 0; p.vx = 0; }
    else actualizarJugador(p, Math.abs(dx) < 5 ? NADA : dx > 0 ? ANDA : ATRAS, NADA, E, ev, dt);
  } else if (c.fase === 'trepa') {
    // la escalerilla: trepa y se mete por la escotilla del techo
    if (pu.abre === 0) ev.push({ t: 'puerta_abre', x: pu.x, y: pu.techo, tipo: pu.tipo });
    pu.abre = Math.min(1, pu.abre + dt / 0.3);
    p.x = pu.x - p.w / 2; p.vx = 0; p.vy = 0; p.recorte = { y0: pu.techo };
    p.y -= V_TREPA * dt; poseCruce(p, 'trepar', dt);
    if (p.y + p.h < pu.techo - 2) { E.estado = 'fin'; ev.push({ t: 'salida' }); }
  } else if (c.fase === 'abreT') {
    // la trampilla se abre bajo sus pies
    if (pu.abre === 0) ev.push({ t: 'puerta_abre', x: pu.x, y: pu.pie, tipo: pu.tipo });
    p.x += (pu.x - cx(p)) * Math.min(1, dt * 12); andarQuieto(p, dt);
    pu.abre = Math.min(1, pu.abre + dt / 0.22);
    if (pu.abre >= 1) { c.fase = 'caeT'; c.t = 0; p.vy = 0; p.recorte = { y1: pu.pie }; }
  } else if (c.fase === 'caeT') {
    // y cae por ella
    p.vy = Math.min(1100, p.vy + 1700 * dt); p.y += p.vy * dt; poseCruce(p, 'caer', dt);
    if (p.y > pu.pie + 6) { E.estado = 'fin'; ev.push({ t: 'salida' }); }
  } else if (c.fase === 'entra' && pu.tipo === 'ascensor') {
    // en la jaula: se para en medio y se cierra la reja (ya por delante de el)
    p.enJaula = true;
    p.x += (pu.x - cx(p)) * Math.min(1, dt * 12); andarQuieto(p, dt);
    pu.abre = Math.max(0, pu.abre - dt / T_PUERTA);
    if (pu.abre <= 0) { c.fase = 'viaja'; c.t = 0; p.enJaula = true; ev.push({ t: 'puerta_cierra', x: pu.x, y: pu.pie, tipo: pu.tipo }); ev.push({ t: 'jaula_arranca', x: pu.x, y: pu.pie }); }
  } else if (c.fase === 'viaja') {
    // y se va por el hueco, arriba o abajo, acelerando
    const v = Math.min(V_JAULA, 30 + c.t * 260) * dt * (pu.va === 'sube' ? -1 : 1);
    pu.desp += v; p.y += v; andarQuieto(p, dt);
    if (Math.abs(pu.desp) >= RECORRIDO) { E.estado = 'fin'; ev.push({ t: 'salida' }); }
  } else if (c.fase === 'entra') {
    p.x += (pu.x - cx(p)) * Math.min(1, dt * 12);
    p.dentro = Math.min(1, (p.dentro || 0) + dt / T_UMBRAL);
    andarEnSitio(p, dt);
    if (p.dentro >= 1) { c.fase = 'cierra'; c.t = 0; ev.push({ t: 'puerta_cierra', x: pu.x, y: pu.pie, tipo: pu.tipo }); }
  } else {
    pu.abre = Math.max(0, pu.abre - dt / T_PUERTA);
    if (pu.abre <= 0) { E.estado = 'fin'; ev.push({ t: 'salida' }); }
  }
}

// ------------------------------------------------------------------ el paso
const SIN = { izq: false, der: false, arriba: false, abajo: false, salto: false, ataque: false, accion: false, lanzar: false, zorro: false };

export function paso(E, inp = SIN, ed = SIN, dt = DT) {
  const ev = [];
  E.t += dt;
  const p = E.p;
  if (E.intro) return ev;
  if (E.zl && pasoZonaAntes(E, inp, ed, ev, dt)) return ev;     // descansando en un frasco de reserva
  if (E.estado === 'entrando' || E.estado === 'saliendo') { cruzar(E, ev, dt); return ev; }
  if (E.estado === 'muerto') { E.tMuerte += dt; actualizarJugador(p, SIN, SIN, E, ev, dt); return ev; }
  if (E.estado === 'nota' || E.estado === 'hack' || E.estado === 'fin') { p.vx = 0; actualizarJugador(p, SIN, SIN, E, ev, dt); return ev; }

  // E: primero lo que se toca (nota, objeto, rejilla), si no el gancho
  const inter = interactuar(E, ev);
  E.aviso = inter ? { tipo: inter.tipo } : null;
  if (ed.accion && inter) { inter.hacer(); ed = { ...ed, accion: false }; }
  if (E.estado !== 'jugando') return ev;

  for (const s of E.mundo.solidos) s.dx = 0;
  actualizarJugador(p, inp, ed, E, ev, dt);
  if (p.y > E.m.alto + 40 || tocaPinchos(p, E.m)) peligro(E, ev);

  // ---- suelos que se hunden
  const s = p.enSuelo && p.sobre;
  if (s && s.tile === HUNDE) {
    for (let i = Math.floor(p.x / T); i <= Math.floor((p.x + p.w - 0.01) / T); i++) {
      const k = s.j * E.m.w + i;
      if (E.m.t[k] === HUNDE && !E.hunde.has(k)) { E.hunde.set(k, { t: 0.45, cae: false, i, j: s.j }); ev.push({ t: 'cruje', x: i * T + T / 2, y: s.j * T }); }
    }
  }
  for (const [k, h] of E.hunde) {
    h.t -= dt;
    if (!h.cae && h.t <= 0) { h.cae = true; h.t = HUNDE_VUELVE; E.m.t[k] = AIRE; ev.push({ t: 'hunde', x: h.i * T + T / 2, y: h.j * T }); }
    else if (h.cae && h.t <= 0) {
      const c = { x: h.i * T, y: h.j * T, w: T, h: T };
      if (!solapan(c, p)) { E.m.t[k] = HUNDE; E.hunde.delete(k); }
    }
  }

  // ---- tornillos que caen del techo
  const tor = E.nivel.tornillos;
  if (tor) for (const l of E.lanzadores) {
    const lejos = Math.abs(l.x - cx(p)) > tor.radio * T || (E.zl && Math.abs(l.y - p.y) > 12 * T);
    if (lejos && !l.aviso) continue;
    l.t += dt;
    const ciclo = tor.periodo * (0.8 + l.fase * 0.5);
    if (!l.aviso && l.t > ciclo) { l.aviso = true; l.t = 0; ev.push({ t: 'aviso_tornillo', x: l.x, y: l.y }); }
    if (l.aviso && l.t > tor.aviso) { l.aviso = false; l.t = 0; soltarTornillo(E, l.x, l.y); }
  }
  // ---- la huida: los tornillos persiguen
  const pe = E.persecucion;
  if (pe && !pe.hecha) {
    const d = pe.dir, enFila = pe.fila === null || Math.abs(p.y + p.h - pe.fila) < 10 * T;
    if (!pe.activa && enFila && (cx(p) - pe.x0) * d > 0) { pe.activa = true; pe.frente = pe.x0 - d * 7 * T; ev.push({ t: 'persecucion' }); }
    // si se da media vuelta o se sale de su altura, se para (y vuelve a empezar al entrar otra vez)
    if (pe.activa && (!enFila || (cx(p) - pe.x0) * d < -8 * T)) pe.activa = false;
    if (pe.activa) {
      pe.frente += d * pe.vel * dt;
      pe.t -= dt; pe.golpe -= dt;
      if (pe.t <= 0) {
        pe.t = 0.12;
        const x = pe.frente - d * rng(E) * 5 * T;
        soltarTornillo(E, x, techoSobre(E, x, p.y));
        ev.push({ t: 'derrumbe', x });
      }
      if ((pe.frente - cx(p)) * d > 0 && pe.golpe <= 0) { pe.golpe = 0.55; soltarTornillo(E, cx(p) + p.vx * 0.25, techoSobre(E, cx(p), p.y)); }
      if ((cx(p) - pe.x1) * d > 0) { pe.activa = false; pe.hecha = true; E.hechos.add('persecucion'); ev.push({ t: 'fin_persecucion' }); }
    }
  }
  for (const b of E.tornillos) {
    if (b.estado === 'cae') {
      b.vy = Math.min(b.vy + 1900 * dt, 1100);
      if (moverY(b, E.mundo, b.vy * dt) > 0 || b.y > E.m.alto) { b.estado = 'suelo'; b.t = 0; ev.push({ t: 'tornillo_golpe', x: b.x + b.w / 2, y: b.y + b.h }); }
      else if (solapan(b, p)) { danar(E, 1, b.x + b.w / 2, ev); b.estado = 'suelo'; b.t = 0; ev.push({ t: 'tornillo_golpe', x: b.x + b.w / 2, y: b.y + b.h }); }
    } else { b.t += dt; }
  }
  E.tornillos = E.tornillos.filter((b) => b.estado === 'cae' || b.t < 0.9);

  // ---- trampa de los tornillos gigantes
  const zt = E.trampa && E.trampa.zona;
  if (E.trampa && !E.trampa.hecha && (zt ? cx(p) > zt[0] && cx(p) < zt[1] && cy(p) > zt[2] && cy(p) < zt[3] : cx(p) > E.trampa.x)) {
    E.trampa.hecha = true; E.hechos.add('trampa');
    for (const g of E.gigantes) { g.estado = 'cae'; g.s.y = g.yFin - 20 * T; }
    ev.push({ t: 'trampa' });
  }
  for (const g of E.gigantes) {
    if (g.estado !== 'cae') continue;
    g.vy += 2600 * dt; g.s.y += g.vy * dt;
    if (g.s.y >= g.yFin) {
      g.s.y = g.yFin; g.estado = 'puesto'; g.s.activo = true;
      ev.push({ t: 'gigante_cae', x: g.s.x + g.s.w / 2, y: g.yFin + g.s.h });
      if (solapan(g.s, p)) p.x = cx(p) < E.trampa.x ? g.s.x + g.s.w + 1 : g.s.x - p.w - 1;
    }
  }

  // ---- escombros que flotan (solo se mecen al pintarlos; la colision no se mueve)

  // ---- objetos que se lanzan
  for (const o of E.objetos) {
    if (o.llevado) { o.x = cx(p) - o.w / 2; o.y = p.y - o.h - 2; continue; }
    if (o.volando) {
      o.vy = Math.min(o.vy + J.lanzarGrav * dt, 900);
      const bx = moverX(o, E.mundo, o.vx * dt), by = moverY(o, E.mundo, o.vy * dt);
      let pego = false;
      for (const en of E.enemigos) if (en.vivo && solapan(o, en)) { golpearEnemigo(E, en, 2, Math.sign(o.vx) || 1, ev); pego = true; break; }
      if (!pego && E.jefe && E.jefe.despierto && solapan(o, E.jefe)) { golpearJefe(E, E.jefe, 1, Math.sign(o.vx) || 1, ev); pego = true; }
      if (pego) { o.volando = false; devolver(o); ev.push({ t: 'objeto_rompe', x: o.x, y: o.y }); continue; }
      if (bx) o.vx *= -0.3;
      if (by > 0) { o.vy = 0; o.vx *= 0.5; if (Math.abs(o.vx) < 20) { o.volando = false; o.quieto = 0; ev.push({ t: 'objeto_cae', x: o.x, y: o.y }); } }
      if (by < 0) o.vy = 0;
      if (o.y > E.m.alto) devolver(o);
    } else {
      // reposa; si lleva mucho lejos de su sitio, vuelve (asi ningun puzzle se queda sin piedras)
      o.quieto += dt;
      if (o.quieto > 6 && (Math.abs(o.x - o.x0) > 4 || Math.abs(o.y - o.y0) > 4)) devolver(o);
      if (!suelo(o, E.mundo)) { o.vy = Math.min(o.vy + 1500 * dt, 900); if (moverY(o, E.mundo, o.vy * dt)) o.vy = 0; }
    }
  }

  // ---- enemigos y jefe
  actualizarEnemigos(E, dt, ev);
  if (E.jefe) {
    const j = E.jefe;
    if (!j.despierto && E.ruedo && cx(p) > E.ruedo.x0 + 2 * T && cx(p) < E.ruedo.x1 - 2 * T) {
      j.despierto = true;
      for (const q of E.puertas) ponerCelda(E.m, q.i, q.j, MACIZO);
      ev.push({ t: 'ruedo_cierra' });
    }
    actualizarJefe(E, j, dt, ev);
  }
  for (const q of E.proyectiles) {
    q.x += q.vx * dt; q.y += q.vy * dt; q.vida -= dt;
    if (celda(E.m, Math.floor((q.x + q.w / 2) / T), Math.floor((q.y + q.h / 2) / T)) === MACIZO) q.vida = 0;
    if (q.vida <= 0) continue;
    if (q.amigo) {
      // devuelto por el 18: ahora hace dano a los enemigos (y rompe postura)
      for (const en of E.enemigos) {
        if (!en.vivo || en.estado === 'huye' || !solapan(q, en)) continue;
        golpearEnemigo(E, en, q.dano, Math.sign(q.vx) || 1, ev, 0, 1, 2);
        q.vida = 0;
        ev.push({ t: 'impacto', x: q.x + q.w / 2, y: q.y + q.h / 2, dir: 'lado', cara: Math.sign(q.vx) || 1, fuerte: true, mata: !en.vivo, racha: p.racha, combo: 0 });
        break;
      }
      const jf = E.jefe;
      if (q.vida > 0 && jf && jf.despierto && jf.estado !== 'vencido' && solapan(q, jf)) { golpearJefe(E, jf, q.dano, Math.sign(q.vx) || 1, ev, 2); q.vida = 0; }
    } else if (solapan(q, p)) { danar(E, q.dano, q.x, ev); q.vida = 0; }
  }
  E.proyectiles = E.proyectiles.filter((q) => q.vida > 0);
  for (const o of E.ondas) {
    o.x += o.vx * dt; o.vida -= dt;
    if (E.ruedo && (o.x < E.ruedo.x0 || o.x + o.w > E.ruedo.x1)) o.vida = 0;
    if (o.vida > 0 && solapan(o, p)) danar(E, 1, o.x, ev);
  }
  E.ondas = E.ondas.filter((o) => o.vida > 0);
  for (const c of E.cristales) {
    if (c.aviso > 0) { c.aviso -= dt; if (c.aviso <= 0) ev.push({ t: 'cristal_sale', x: c.x + c.w / 2, y: c.y + c.h }); continue; }
    c.vida -= dt;
    if (solapan(c, p)) danar(E, 1, c.x + c.w / 2, ev);
  }
  E.cristales = E.cristales.filter((c) => c.aviso > 0 || c.vida > 0);

  // ---- los golpes del 18
  golpes(E, ev);
  if (E.jefe && E.jefe.estado === 'vencido' && !E.hechos.has('jefe')) {
    E.hechos.add('jefe');
    for (const q of E.puertas) ponerCelda(E.m, q.i, q.j, AIRE);
    ev.push({ t: 'ruedo_abre' });
  }

  // ---- contacto con enemigos
  if (p.invul <= 0 && !p.muerto) {
    for (const en of E.enemigos) {
      if (!en.vivo || en.estado === 'huye' || en.estado === 'aturdido' || en.tipo === 'tallo') continue;
      const g = cajaAtaque(en);
      if (solapan(en, p) || (g && solapan(g, p))) { danar(E, en.dano, cx(en), ev); break; }
    }
    const j = E.jefe;
    if (j && j.despierto && j.estado !== 'vencido' && p.invul <= 0) {
      for (const h of j.hits || []) if (solapan(h, p)) { danar(E, 1, cx(j), ev); break; }
      const cuerpo = { x: j.x + 10, y: j.y + 14, w: j.w - 20, h: j.h - 14 };
      if (p.invul <= 0 && j.estado !== 'aturdido' && solapan(cuerpo, p)) danar(E, 1, cx(j), ev);
    }
  }
  if (E.enemigos.some((en) => en.tipo === 'tallo') && !E.hechos.has('tallos') && E.enemigos.filter((en) => en.tipo === 'tallo').every((en) => !en.vivo)) quitarTallos(E, ev);

  // ---- recoger: dosis, puntos de control, la anomalia
  for (const d of E.dosis) {
    if (d.cogida || Math.abs(d.x - cx(p)) > 22 || Math.abs(d.y - cy(p)) > 34) continue;
    d.cogida = true; p.vida = Math.min(p.vidaMax || J.vida, p.vida + 2); ev.push({ t: 'dosis', x: d.x, y: d.y, vida: p.vida });
  }
  for (const c of E.controles) {
    if (Math.abs(c.x - cx(p)) > 24 || Math.abs(c.pie - (p.y + p.h)) > 20) continue;
    if (!c.activo || p.vida < J.vida) {
      if (!c.activo) ev.push({ t: 'control', x: c.x, y: c.pie });
      else ev.push({ t: 'cura', x: c.x, y: c.pie });
      for (const o of E.controles) o.activo = false;
      c.activo = true; E.control = { x: c.x, pie: c.pie }; p.vida = J.vida;
    }
  }
  for (const it of E.items) {
    if ((it.tipo !== 'tele' && it.tipo !== 'doble') || it.cogido) continue;
    if (Math.abs(it.x - cx(p)) < 30 && Math.abs(it.pie - 16 - cy(p)) < 40) cogerItem(E, it, ev);
  }

  if (E.zl) pasoZonaDespues(E, ev, dt);

  // ---- salida
  // por el borde del mapa (la azotea del 8): pasado el borde, al nivel siguiente
  if (E.borde && cx(p) > E.m.ancho + 12 && !E.terminado) { E.terminado = true; E.estado = 'fin'; ev.push({ t: 'salida' }); }
  // la calle seguida: pasado el borde, se sigue en el nivel de al lado (main.js lo cambia sin corte)
  if (E.costura && cx(p) > E.costura.x && !E.terminado) { E.terminado = true; E.estado = 'fin'; ev.push({ t: 'salida', continuo: true }); }
  if (E.salida && solapan(E.salida, p) && !E.terminado) {
    E.terminado = true;
    if (E.puertaSalida) { E.estado = 'saliendo'; E.cruce = { fase: 'acerca', t: 0 }; }
    else { E.estado = 'fin'; ev.push({ t: 'salida' }); }
  }
  // la puerta de salida se abre al acercarse; la de entrada, una vez fuera el 18, queda cerrada
  const ps = E.puertaSalida;
  if (ps && ps.tipo !== 'trampilla' && ps.tipo !== 'escalera') {
    const cerca = Math.abs(cx(p) - ps.x) < 96 && Math.abs(p.y + p.h - ps.pie) < 80;
    const antes = ps.abre;
    ps.abre = Math.max(0, Math.min(1, ps.abre + (cerca ? 1 : -1) * dt / 0.4));
    if (antes === 0 && ps.abre > 0) ev.push({ t: 'puerta_abre', x: ps.x, y: ps.pie, tipo: ps.tipo });
    if (antes > 0 && ps.abre === 0) ev.push({ t: 'puerta_cierra', x: ps.x, y: ps.pie, tipo: ps.tipo });
  }
  const pEnt = E.puertaEntrada;
  if (pEnt && pEnt.abre > 0) { pEnt.abre = Math.max(0, pEnt.abre - dt / 0.45); if (pEnt.abre === 0) ev.push({ t: 'puerta_cierra', x: pEnt.x, y: pEnt.pie, tipo: pEnt.tipo }); }
  return ev;
}

function techoSobre(E, x, y) {
  const i = Math.floor(x / T);
  for (let j = Math.floor(y / T); j >= 0; j--) if (celda(E.m, i, j) === MACIZO) return (j + 1) * T;
  return Math.max(0, y - 10 * T);
}

function soltarTornillo(E, x, y) {
  E.tornillos.push({ x: x - 7, y, w: 14, h: 24, vy: 0, estado: 'cae', t: 0, giro: (x * 0.1) % 6.28 });
}

function devolver(o) { o.x = o.x0; o.y = o.y0; o.vx = 0; o.vy = 0; o.volando = false; o.quieto = 0; }

function golpes(E, ev) {
  const p = E.p;
  let caja = null, dano = p.zorro ? J.zarpaDano : 1, dir = p.ataqueDir;
  if (p.sunikel > 0) { caja = { x: p.x - 18, y: p.y - 4, w: p.w + 36, h: p.h + 8 }; dano = J.sunikelDano; dir = 'sunikel'; }
  else if (p.estocada > 0) { caja = { x: p.cara > 0 ? p.x : p.x - 46, y: p.y + 6, w: p.w + 46, h: p.h - 12 }; dano = J.estocadaDano; dir = 'estocada'; }
  // (el remate se prepara: mientras `ataque` pasa de `ataqueT` aun no corta)
  else if (p.ataque > J.ataqueT - J.ataqueActivo && p.ataque <= J.ataqueT + 1e-9) {
    const A = J.alcance + (p.zorro ? 10 : 0) + (p.remata ? J.remataAlcance : 0);
    if (dir === 'arriba') caja = { x: p.x - 20, y: p.y - A + 8, w: p.w + 40, h: A };
    else if (dir === 'abajo') caja = { x: p.x - 18, y: p.y + p.h - 6, w: p.w + 36, h: A - 6 };
    else caja = { x: p.cara > 0 ? p.x + p.w - 6 : p.x - A + 6, y: p.y + 2, w: A, h: p.h - 6 };
  }
  if (!caja) return;
  let pego = false;
  const embiste = dir === 'sunikel' || dir === 'estocada';
  const fuerte = p.remata || embiste;
  // postura: cuanto aguante gasta este golpe
  const postura = dir === 'estocada' ? 3 : p.remata || dir === 'sunikel' ? 2 : 1;
  const esencia = (n) => { p.esencia = Math.min(J.esenciaMax, p.esencia + n); };
  // cada acierto: el punto de contacto (para el corte y la estrella), si remata o mata, y la racha
  const impacto = (o, mata) => {
    p.racha++; p.tRacha = 0;
    const ix = Math.max(caja.x, Math.min(caja.x + caja.w, cx(o))), iy = Math.max(caja.y, Math.min(caja.y + caja.h, cy(o)));
    // `en`: a quien (el dibujo lo aplasta y lo hace temblar en el paron); `tipo` y `embiste`: cuanto pesa el golpe
    ev.push({ t: 'impacto', x: (ix + cx(o)) / 2, y: (iy + cy(o)) / 2, dir: embiste ? 'lado' : dir, cara: p.cara, fuerte, mata, embiste, tipo: o.tipo, en: o, racha: p.racha, combo: p.combo });
  };
  // DESVIO de proyectiles: el tajo los devuelve, mas rapidos, contra los enemigos
  for (const q of E.proyectiles) {
    if (q.amigo || q.vida <= 0 || !solapan(caja, q)) continue;
    const v = Math.hypot(q.vx, q.vy) * J.devueltoVel;
    if (dir === 'lado' || embiste) { q.vx = p.cara * v; q.vy = -v * 0.08; }
    else if (dir === 'arriba') { q.vx *= 0.3; q.vy = -v; }
    else { q.vx *= 0.3; q.vy = v; }
    q.amigo = true; q.vida = 3; q.dano = J.devueltoDano;
    esencia(2);
    ev.push({ t: 'desvio', x: q.x + q.w / 2, y: q.y + q.h / 2, cara: p.cara });
    pego = true;
  }
  // CHOQUE: el tajo coincide con el golpe de un enemigo -> se para y el enemigo queda aturdido
  let choco = false;
  const centro = (a, b) => ({ x: (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2, y: (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2 });
  for (const en of E.enemigos) {
    const g = cajaChoque(en);
    if (!g || !solapan(caja, g) || p.golpeados.has(en)) continue;
    p.golpeados.add(en); choco = true;
    aturdir(en, ev);
    en.vx = Math.sign(cx(en) - cx(p)) * 220;
    ev.push({ t: 'choque', ...centro(caja, g), cara: p.cara });
  }
  const jj = E.jefe;
  if (jj && jj.despierto && jj.estado !== 'vencido' && !p.golpeados.has('choqueJefe')) {
    // su espadazo en curso o el final de la preparacion (la espada ya arriba)
    const prev = jj.estado === 'tajo' && !jj.dio && jj.t > 0.36 ? { x: jj.cara > 0 ? jj.x + jj.w - 10 : jj.x - 150, y: jj.y + 10, w: 160, h: 86 } : null;
    const h = (jj.hits || []).find((h2) => solapan(caja, h2)) || (prev && solapan(caja, prev) ? prev : null);
    if (h) {
      // el espadazo se corta: vuelve a guardia (y con las zarpas pierde postura)
      if (jj.estado === 'tajo') { jj.estado = 'espera'; jj.t = 0; jj.dio = false; jj.vx = 0; }
      p.golpeados.add('choqueJefe'); choco = true;
      ev.push({ t: 'choque', ...centro(caja, h), cara: p.cara, jefe: true });
      // con la daga el escarabajo no se raya, pero su golpe se para; con las zarpas ademas pierde postura
      if (E.hab.zorro) { jj.aguante -= 4; if (jj.aguante <= 0) aturdirJefe(jj, ev); }
      jj.hits = [];
    }
  }
  if (choco) {
    esencia(2);
    p.invul = Math.max(p.invul, 0.3);
    // (hasta el 2026-10-18 el choque empujaba a la velocidad del tajo normal: `desvioEmpuje` no se usaba)
    if (!embiste) { p.retroceso = J.desvioT; p.retrocesoDir = -p.cara; p.retrocesoV = J.desvioEmpuje; }
    pego = true;
  }
  for (const en of E.enemigos) {
    if (!en.vivo || p.golpeados.has(en) || !solapan(caja, en)) continue;
    p.golpeados.add(en);
    const huia = en.estado === 'huye';
    golpearEnemigo(E, en, dano, Math.sign(cx(en) - cx(p)) || p.cara, ev, dir === 'arriba' ? -1 : dir === 'abajo' ? 1 : 0, fuerte ? J.remataEmpuje : 1, postura);
    if (!huia) esencia(1);
    impacto(en, !en.vivo || en.estado === 'huye');
    pego = true;
  }
  const j = E.jefe;
  let rebota = false;
  if (j && j.despierto && j.estado !== 'vencido' && !p.golpeados.has(j) && solapan(caja, j)) {
    p.golpeados.add(j);
    if (golpearJefe(E, j, dano, Math.sign(cx(j) - cx(p)) || p.cara, ev, postura)) { esencia(1); impacto(j, j.estado === 'vencido'); }
    else rebota = !E.hab.zorro;           // la daga contra el cristal: no le hace nada y el 18 sale despedido
    pego = true;
  }
  // acertar acorta la espera hasta el siguiente tajo: el combo fluye si se pega (el remate no: su espera
  // larga es el respiro del combo)
  if (pego && !embiste && !(p.remata && dir === 'lado')) p.ataqueCd = Math.min(p.ataqueCd, J.ataqueCdGolpe);
  // el cristal roto tambien rebota hacia arriba (pogo)
  if (dir === 'abajo' && !pego) {
    const i0 = Math.floor(caja.x / T), i1 = Math.floor((caja.x + caja.w) / T), j0 = Math.floor(caja.y / T), j1 = Math.floor((caja.y + caja.h) / T);
    for (let jy = j0; jy <= j1 && !pego; jy++) for (let ii = i0; ii <= i1; ii++) if (celda(E.m, ii, jy) === PINCHO && !p.golpeados.has('p' + ii + ',' + jy)) { p.golpeados.add('p' + ii + ',' + jy); pego = true; ev.push({ t: 'chispa', x: ii * T + 16, y: jy * T + 10 }); break; }
  }
  if (pego && !embiste) {
    if (dir === 'abajo') { p.vy = -J.pogo; p.doble = true; p.aereos = 0; p.saltando = false; p.tPogo = 0.14; ev.push({ t: 'pogo', x: cx(p), y: p.y + p.h + 10 }); }
    else if (dir === 'lado' && !choco) {
      p.retroceso = rebota ? J.rebotaT : J.retrocesoT; p.retrocesoDir = -p.cara; p.retrocesoV = rebota ? J.rebotaVel : J.retroceso;
      p.embate = 0;
    }
  }
}

export { libre, cx, cy, T };
