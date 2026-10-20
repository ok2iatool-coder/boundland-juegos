// El decorado de cada nivel, a tinta. Cada marca del mapa tiene una parte FIJA (se pinta una vez en el
// trozo de terreno) y, si hace falta, una parte VIVA (luces que parpadean, polvo que cae) y una luz.
import { T } from '../sim/constantes.js';
import { MACIZO } from '../sim/mapa.js';
import { TINTA, GROSOR, caja, linea, circulo, temblar, trazar, trazarSuave, tinta, hash, azar, rgba, mezclar } from './tinta.js';
import { COLOR } from './paletas.js';
import { ASSETS, lienzoDe, dibujarFrasco } from '../assets/catalogo.js';
import { cadena } from '../assets/pintura.js';
import { dibujarCoche } from './coche.js';
import { componerVista, HUECO } from './ventanas.js';
// en la ciudad (7 y 8) las farolas, los semaforos y los coches los pinta el hilo de la ciudad (ciudad/obrero.js)
import { PINTADAS as CIUDAD_PINTA, FAROLA } from '../ciudad/nivel.js';

export const POR_ID = Object.fromEntries(ASSETS.map((a) => [a.id, a]));
const cacheAsset = new Map();
const MARGEN = 6;
const escalaDe = (c) => { const m = c.getTransform(); return Math.round(Math.min(6, Math.max(1, Math.hypot(m.a, m.b))) * 4) / 4; };

// Variantes que no estan en el catalogo tal cual: un frasco con SU numero y su estado
function assetVariante(id, o = {}) {
  if (id === 'frasco') {
    const est = o.estado || 'entero';
    return { id: `frasco:${o.n}:${est}:${o.sujeto || 0}`, w: 72, h: 134, ancla: 'suelo', dibujar: (c) => dibujarFrasco(c, { n: o.n, roto: est === 'roto', abierto: est === 'abierto', brillar: est === 'brilla', sem: (o.n || 1) * 7, sujeto: o.sujeto || 0 }) };
  }
  return POR_ID[id];
}

export function lienzoAsset(c, id, o) {
  const a = assetVariante(id, o);
  if (!a) return null;
  const k = escalaDe(c) * (o && o.escala ? o.escala : 1);
  const clave = a.id + '@' + k.toFixed(2);
  let cv = cacheAsset.get(clave);
  if (!cv) { cv = lienzoDe(a, k, MARGEN); cacheAsset.set(clave, cv); }
  return { a, cv };
}

// Pinta un asset anclado en (x, y): suelo = abajo al centro, techo = arriba al centro (en techoY), pared y
// libre = centro. o: escala, dx, dy, rot (alrededor del ancla), n/estado para frascos.
export function dibujarAsset(c, id, x, y, ancla, techoY, o = {}) {
  const r = lienzoAsset(c, id, o);
  if (!r) return;
  const { a, cv } = r;
  const e = o.escala || 1, w = a.w * e, h = a.h * e, M = MARGEN * e;
  x += o.dx || 0; y += o.dy || 0;
  const an = ancla || a.ancla;
  let ax = x, ay;
  if (an === 'suelo') ay = y; else if (an === 'techo') ay = techoY; else ay = y - T / 2;
  c.save();
  c.translate(ax, ay);
  if (o.rot) c.rotate(o.rot);
  if (o.flip) c.scale(-1, 1);
  const y0 = an === 'suelo' ? -h : an === 'techo' ? 0 : -h / 2;
  c.drawImage(cv, -w / 2 - M, y0 - M, w + M * 2, h + M * 2);
  c.restore();
}

// Las marcas de asset que se mueven o van por encima del terreno se pintan cada fotograma
const esVivo = (mk) => mk.tipo === 'asset' && (mk.capa || mk.balanceo || mk.flota);

function opcionesMarca(mk, E) {
  const o = { escala: mk.escala, dx: mk.dx, dy: mk.dy, flip: mk.flip };
  if (mk.id === 'frasco') {
    // numerados en el orden del mapa; algunos rotos, el 17 abierto desde dentro (GDD)
    const lista = E.marcas.filter((q) => q.id === 'frasco');
    let n = lista.indexOf(mk) + 5;
    if (n >= 18) n++;                    // el 18 esta en su peana
    o.n = n;
    o.estado = hash(n, 5) < 0.4 ? 'roto' : 'entero';
    // en la mitad de los enteros hay alguien dentro (de tres clases)
    if (o.estado === 'entero' && hash(n, 11) < 0.55) o.sujeto = 1 + Math.floor(hash(n, 13) * 3);
  }
  return o;
}

function pintarMarcaAsset(c, mk, E, t) {
  if (mk.id === 'farol_laton') return;      // cuelga y se balancea: lo pinta focos.js
  const x = mk.i * T + T / 2, y = (mk.j + 1) * T;
  const a = mk.id === 'frasco' ? { ancla: 'suelo' } : POR_ID[mk.id];
  if (!a) return;
  const an = mk.ancla || a.ancla;
  const o = opcionesMarca(mk, E);
  if (t !== undefined && mk.balanceo) o.rot = Math.sin(t * 0.9 + mk.i * 0.7) * mk.balanceo;
  if (t !== undefined && mk.flota) { o.dy = (o.dy || 0) + Math.sin(t * 0.8 + mk.i) * 6; o.rot = Math.sin(t * 0.4 + mk.j) * 0.25; }
  const ty = an === 'techo' ? techo(E, mk.i, mk.j) : 0;
  if (an === 'techo' && mk.largo) {
    // cuelga de una cadena mas larga: todo gira alrededor del punto del techo
    c.save(); c.translate(x, ty); if (o.rot) c.rotate(o.rot);
    cadena(c, 0, 0, 0, mk.largo + 4, 8, 2, mk.i);
    dibujarAsset(c, mk.id, 0, 0, 'techo', mk.largo, { ...o, rot: 0 });
    c.restore();
    return;
  }
  dibujarAsset(c, mk.id, x, y, an, ty, o);
}

const techo = (E, i, j) => { for (let jj = j; jj >= 0; jj--) if (E.m.t[jj * E.m.w + i] === MACIZO) return (jj + 1) * T; return 0; };

// El decorado viejo del laboratorio pasa a sus assets pintados
const COMO_ASSET = {
  estanteria: (c, x, y) => dibujarAsset(c, 'estanteria_frascos', x, y, 'suelo'),
  carrito: (c, x, y) => dibujarAsset(c, 'carrito_instrumental', x, y, 'suelo'),
  cartel_bio: (c, x, y) => dibujarAsset(c, 'cartel_biologico', x, y - 60, 'pared'),
  pizarra: (c, x, y) => dibujarAsset(c, 'pizarra', x, y - 70, 'pared'),
  frascos_rotos: (c, x, y) => dibujarAsset(c, 'cristales_rotos', x, y, 'suelo'),
};

export function dibujarDecoradoFijo(c, mk, E, z, enVivo = false) {
  if (mk.colgada && !enVivo) return;          // (va con su plataforma: dibujarDecoradoVivo)
  const x = mk.i * T + T / 2, y = (mk.j + 1) * T;
  if (E.nivel.zona === 'lab' && COMO_ASSET[mk.tipo]) { COMO_ASSET[mk.tipo](c, x, y); return; }
  if (E.nivel.zona === 'ciudad' && CIUDAD_PINTA.has(mk.tipo)) return;
  const f = FIJO[mk.tipo];
  if (f) f(c, x, y, mk, E, z);
}

export function dibujarDecoradoVivo(c, mk, E, z, t) {
  const x = mk.i * T + T / 2, y = (mk.j + 1) * T;
  // lo que esta sobre una plataforma que cuelga se mece con ella (antes se horneaba quieto y parecia flotar)
  if (mk.colgada) { const q = mk.colgada; c.save(); c.translate(q.dx || 0, q.dyT || 0); dibujarDecoradoFijo(c, mk, E, z, true); const f = VIVO[mk.tipo]; if (f) f(c, x, y, mk, E, z, t); c.restore(); return; }
  const f = VIVO[mk.tipo];
  if (f) f(c, x, y, mk, E, z, t);
}

// Fuentes de luz del decorado: {x, y, r, color, fuerza(t)}
export function lucesDe(E, z) {
  const L = [];
  for (const mk of E.marcas) {
    const x = mk.i * T + T / 2, y = (mk.j + 1) * T;
    const n0 = L.length;
    luzDe(L, mk, x, y, E, z);
    for (let k = n0; k < L.length; k++) L[k].marca = mk;   // los focos colgados (focos.js) mueven su luz
  }
  return L;
}

// el centro de una ventana: 104 u sobre su casilla, pero sin meterse en el techo (en la casa de Varga las
// habitaciones miden 4 casillas y la ventana se dibujaba dentro del forjado; su luz salia por debajo de el)
function ventanaCy(E, mk, y) { return Math.max(techo(E, mk.i, mk.j) + 50, y - 104); }

function luzDe(L, mk, x, y, E, z) {
  {
    if (mk.tipo === 'fluorescente') {
      const k = mk.i * 7 + mk.j;
      L.push({ x, y: y - 6, r: mk.calida ? 380 : 300, color: mk.calida ? '#ffd28e' : z.luz, cono: true, calida: !!mk.calida, fuerza: (t) => parpadeo(t, k) * 0.95 });
    } else if (mk.tipo === 'lampara_casa') L.push({ x, y: y + 4, r: 230, color: '#ffe2b0', cono: true, spr: { id: 'casa', dy: -6, ganancia: 1.1 }, fuerza: (t) => 0.8 + Math.sin(t * 2 + mk.i) * 0.04 });
    else if (mk.tipo === 'luz_emergencia') L.push({ x, y: techo(E, mk.i, mk.j) + 12, r: 170, color: '#ff6a5a', spr: { id: 'emergencia', ganancia: 1.2 }, fuerza: (t) => 0.32 + 0.12 * Math.max(0, Math.sin(t * 1.6 + mk.i)) });
    else if (mk.tipo === 'farola' && E.nivel.zona === 'ciudad') L.push({ x: x + FAROLA.dx, y: y - FAROLA.alto + 14, r: 260, color: '#f4ead2', cono: true, spr: { id: 'farola', dx: 0, dy: -7.5, ganancia: 0.9 }, fuerza: farolaFuerza(mk, z) });
    else if (mk.tipo === 'farola') L.push({ x: x + 22, y: y - 132, r: 200, color: '#f4ead2', cono: true, spr: { id: 'farola', dx: 2, dy: -7.5, ganancia: 0.9 }, fuerza: farolaFuerza(mk, z) });
    else if (mk.tipo === 'frasco18') L.push({ x: x + 70, y: y - 40, r: 160, color: '#fff2dd', fuerza: () => 0.45 });
    else if (mk.tipo === 'ventana') L.push({ x, y: ventanaCy(E, mk, y) + 44, r: 210, color: E.nivel.zona === 'hospital' ? '#9fb0c8' : '#e9e4d8', spr: { id: 'ventana', dy: -44, ganancia: 0.8 }, fuerza: () => 0.55 });
    else if (mk.tipo === 'asset' && mk.id === 'farol_laton') L.push({ x, y: techo(E, mk.i, mk.j) + 60, r: 190, color: '#ffcf8a', spr: { id: 'farol', dy: -2, ganancia: 1.5 }, fuerza: (t) => 0.75 + Math.sin(t * 3 + mk.i) * 0.05 });
    else if (mk.tipo === 'asset' && mk.id === 'tanque_vertical') L.push({ x, y: y - 80, r: 60, color: '#ffcf8a', spr: { id: 'piloto', dy: -6, ganancia: 3 }, fuerza: () => 0.15 });
    else if (mk.tipo === 'rejilla_salida') L.push({ x, y: y - 10, r: 120, color: '#cfe0f0', spr: { id: 'rejilla', dx: 15, dy: -16, ganancia: 2.2 }, fuerza: () => 0.3 });
  }
  return L;
}

// farolas: de dia (zona clara) solo alguna parpadea; en penumbra (ciudad y plaza, como los niveles de antes) casi
// todas encendidas, una de cada cuatro rota y una de cada tres que tiembla
function farolaFuerza(mk, z) {
  if (z.oscuro < 0.5) return (t) => (mk.i % 3 === 0 ? parpadeo(t, mk.i) * 0.6 : 0.0);
  return (t) => (mk.i % 4 === 1 ? 0 : mk.i % 3 === 0 ? parpadeo(t, mk.i) * 0.6 : 0.6);
}

export function parpadeo(t, k) {
  // fluorescente viejo: casi siempre encendido, a veces tiembla y se corta
  const ciclo = (t * 0.37 + k * 0.173) % 1;
  if (ciclo > 0.92) return hash(Math.floor(t * 24), k) < 0.45 ? 0.08 : 0.85;
  return 0.92 + Math.sin(t * 50 + k) * 0.02;
}

// ---------------------------------------------------------------- fijo
const FIJO = {
  asset(c, x, y, mk, E) {
    if (!esVivo(mk)) pintarMarcaAsset(c, mk, E);
  },
  frasco18(c, x, y, mk, E, z) {
    // estanteria alta con frascos de muestras; el del 18 se dibuja como actor
    const x0 = x - 16, w = 120;
    for (let k = 0; k < 3; k++) {
      const yy = y - 6 - k * 70;
      if (k > 0) caja(c, x0, yy, w, 6, '#2d3845', 30 + k);
      for (let q = 0; q < 4; q++) {
        if (k === 0) continue;
        const fx = x0 + 12 + q * 28, h = 26 + hash(q, k) * 18;
        frascoPeq(c, fx, yy, 9, h, hash(q, k + 9) < 0.5);
      }
    }
    linea(c, x0 + 4, y - 150, x0 + 4, y, GROSOR * 0.8); linea(c, x0 + w - 4, y - 150, x0 + w - 4, y, GROSOR * 0.8);
  },
  // los focos colgados (fluorescente, lampara de la casa, farol) los pinta focos.js: se balancean
  estanteria(c, x, y, mk, E, z) {
    const w = 110, h = 170, x0 = x - w / 2;
    caja(c, x0, y - h, w, h, mezclar(z.medio, '#000000', 0.2), mk.i * 3, 1);
    for (let k = 1; k < 4; k++) {
      const yy = y - k * 44;
      linea(c, x0, yy, x0 + w, yy, GROSOR * 0.9);
      const r = azar(mk.i * 100 + k);
      for (let q = 0; q < 4; q++) {
        const fx = x0 + 14 + q * 26 + r() * 6;
        if (r() < 0.3) { caja(c, fx - 8, yy - 18, 18, 18, '#2a3138', q + k); continue; }
        frascoPeq(c, fx, yy, 7 + r() * 3, 16 + r() * 18, r() < 0.4);
      }
    }
  },
  carrito(c, x, y, mk, E, z) {
    caja(c, x - 34, y - 46, 68, 7, '#4b5663', mk.i);
    caja(c, x - 30, y - 22, 60, 5, '#3c4652', mk.i + 1);
    linea(c, x - 30, y - 40, x - 30, y - 7); linea(c, x + 30, y - 40, x + 30, y - 7);
    circulo(c, x - 24, y - 5, 5, '#222'); circulo(c, x + 24, y - 5, 5, '#222');
    frascoPeq(c, x - 12, y - 46, 6, 16, false); frascoPeq(c, x + 6, y - 46, 8, 12, true);
    caja(c, x + 14, y - 58, 12, 12, '#59636e', 3);
  },
  cartel_bio(c, x, y, mk, E, z) {
    const cy = y - 90;
    caja(c, x - 26, cy - 34, 52, 64, '#c9c3a8', mk.i);
    c.save(); c.globalAlpha = 0.8;
    trazar(c, [[x, cy - 22], [x + 20, cy + 14], [x - 20, cy + 14]]);
    c.fillStyle = '#d8b440'; c.fill(); tinta(c, 1.6);
    c.fillStyle = TINTA; c.font = 'bold 9px Georgia'; c.textAlign = 'center'; c.fillText('BIO', x, cy + 9);
    c.font = '6px Georgia'; c.fillText('PROJECT ASH', x, cy + 24);
    c.restore();
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 8, cy - 34, 18, 22);
  },
  grieta(c, x, y, mk, E, z) {
    const yt = techo(E, mk.i, mk.j);
    const r = azar(mk.i * 13 + 1);
    c.strokeStyle = TINTA; c.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      let xx = x + (r() - 0.5) * 30, yy = yt;
      c.beginPath(); c.moveTo(xx, yy - 6);
      for (let q = 0; q < 4; q++) { xx += (r() - 0.5) * 26; yy += 4 + r() * 8; c.lineTo(xx, yy); }
      c.stroke();
    }
  },
  rastro_laton(c, x, y, mk, E, z) {
    // GDD: rastros de laton y patas en el techo anuncian a los Entomorficos antes de verlos
    const yt = techo(E, mk.i, mk.j);
    const r = azar(mk.i * 5 + 3);
    c.strokeStyle = rgba(COLOR.laton, 0.55); c.lineWidth = 1.6;
    for (let k = 0; k < 9; k++) {
      const xx = x - 60 + k * 14 + r() * 4;
      c.beginPath(); c.moveTo(xx, yt + 2); c.lineTo(xx + 5, yt + 7 + r() * 4); c.stroke();
      c.beginPath(); c.moveTo(xx + 6, yt + 2); c.lineTo(xx + 2, yt + 8 + r() * 4); c.stroke();
    }
    c.strokeStyle = rgba(COLOR.laton, 0.35); c.lineWidth = 3;
    c.beginPath(); c.moveTo(x - 70, yt + 12); c.bezierCurveTo(x - 20, yt + 20, x + 10, yt + 6, x + 70, yt + 14); c.stroke();
  },
  frascos_rotos(c, x, y, mk, E, z) {
    const r = azar(mk.i * 3);
    for (let k = 0; k < 5; k++) {
      const xx = x - 30 + k * 14 + r() * 6, h = 4 + r() * 8;
      trazar(c, [[xx - 6, y], [xx - 2, y - h], [xx + 3, y - h * 0.4], [xx + 7, y]]);
      c.fillStyle = 'rgba(160,200,210,.5)'; c.fill(); tinta(c, 1.4);
    }
    c.fillStyle = 'rgba(140,190,200,.25)'; c.beginPath(); c.ellipse(x, y - 1, 40, 3, 0, 0, 7); c.fill();
  },
  pizarra(c, x, y, mk, E, z) {
    const cy = y - 110;
    caja(c, x - 60, cy - 36, 120, 72, '#1f2a25', mk.i);
    c.save(); c.strokeStyle = 'rgba(220,230,225,.5)'; c.lineWidth = 1; c.font = '9px "Ink Free", "Segoe Print", cursive'; c.fillStyle = 'rgba(220,230,225,.55)';
    c.fillText('N(18) = 0.97 · e^(-t/τ)', x - 52, cy - 16); c.fillText('Zone exp. 412 h', x - 52, cy);
    c.beginPath(); c.arc(x + 34, cy + 14, 12, 0, 7); c.stroke();
    c.fillText('18 ✓  17 ?', x - 52, cy + 18);
    c.restore();
  },
  frasco(c, x, y, mk, E, z) {
    // los dieciocho frascos numerados; el numero sale del orden en el mapa
    const n = E.marcas.filter((q) => q.tipo === 'frasco' && (q.i < mk.i || (q.i === mk.i && q.j < mk.j))).length + 1;
    const h = 92, w = 34;
    caja(c, x - w / 2 - 4, y - 10, w + 8, 10, '#3a4552', n);
    const roto = n <= 16, abierto17 = n === 17, nuestro = n === 18;
    c.save();
    if (roto) {
      const r = azar(n * 17);
      const pts = [[x - w / 2, y - 10], [x - w / 2, y - 30 - r() * 40], [x - 6, y - 40 - r() * 30], [x + 4, y - 20 - r() * 40], [x + w / 2, y - 36 - r() * 30], [x + w / 2, y - 10]];
      trazar(c, pts); c.fillStyle = 'rgba(120,160,170,.18)'; c.fill(); tinta(c, 1.6);
      if (r() < 0.6) { c.fillStyle = 'rgba(30,40,45,.7)'; c.beginPath(); c.ellipse(x, y - 13, 12, 3, 0, 0, 7); c.fill(); }
    } else {
      caja(c, x - w / 2, y - 10 - h, w, h, abierto17 ? 'rgba(170,205,215,.10)' : 'rgba(255,240,220,.08)', n, 0.8, 1.8);
      caja(c, x - w / 2 - 3, y - 18 - h, w + 6, 10, '#4a5563', n + 1);
      // puerta abierta del frasco
      c.save(); c.translate(x + w / 2, y - 10 - h * 0.85);
      c.rotate(abierto17 ? 0.9 : 0.5);
      caja(c, 0, 0, 4, h * 0.7, 'rgba(170,205,215,.15)', n + 2, 0.5, 1.6);
      c.restore();
      if (abierto17) {
        // abierto DESDE DENTRO: el cristal salto hacia fuera y esta limpio
        c.strokeStyle = 'rgba(220,240,250,.5)'; c.lineWidth = 1;
        for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(x + w / 2 + 6, y - 50 + k * 6); c.lineTo(x + w / 2 + 14 + k * 3, y - 46 + k * 5); c.stroke(); }
      }
    }
    c.restore();
    c.fillStyle = nuestro ? '#e9e2d0' : 'rgba(200,210,220,.7)'; c.font = 'bold 10px Georgia'; c.textAlign = 'center';
    c.fillText(String(n), x, y - 1);
  },
  adn(c, x, y, mk, E, z) {
    // la escalera de ADN: dos cintas en helice alrededor de la cuerda
    let y0 = y, y1 = y;
    for (let jj = mk.j; jj >= 0 && E.m.t[jj * E.m.w + mk.i] === 4; jj--) y0 = jj * T;
    for (let jj = mk.j; jj < E.m.h && E.m.t[jj * E.m.w + mk.i] === 4; jj++) y1 = (jj + 1) * T;
    for (const fase of [0, Math.PI]) {
      c.beginPath();
      for (let yy = y0; yy <= y1; yy += 4) {
        const xx = x + Math.sin(yy / 22 + fase) * 14;
        if (yy === y0) c.moveTo(xx, yy); else c.lineTo(xx, yy);
      }
      c.lineWidth = 4; c.strokeStyle = TINTA; c.stroke();
      c.lineWidth = 1.8; c.strokeStyle = fase ? rgba(COLOR.varga, 0.8) : 'rgba(220,230,240,.7)'; c.stroke();
    }
    c.strokeStyle = TINTA; c.lineWidth = 1.6;
    for (let yy = y0 + 8; yy < y1; yy += 16) {
      const a = Math.sin(yy / 22) * 14;
      c.beginPath(); c.moveTo(x + a, yy); c.lineTo(x - a, yy); c.stroke();
    }
  },
  // ---------------- ciudad
  coche(c, x, y, mk, E, z) {
    // turismo abandonado a escala real (dibujo/coche.js); a veces volcado sobre el techo
    const r = azar(mk.i * 11);
    const vuelto = r() < 0.3;
    const plaza = E.nivel.zona === 'plaza';
    c.save(); c.translate(x, y + 3); c.rotate((r() - 0.5) * 0.05);
    dibujarCoche(c, { semilla: mk.i * 7 + mk.j, vuelto, verde: plaza ? '#3f5a54' : '#4e5038', verdeClaro: plaza ? '#7ea69b' : '#7d7f58' });
    c.restore();
  },
  senal(c, x, y, mk, E, z) {
    c.save(); c.translate(x, y); c.rotate(-0.35);
    linea(c, 0, 0, 0, -110, GROSOR * 1.2);
    caja(c, -24, -132, 48, 30, '#8c8c80', mk.i);
    c.fillStyle = TINTA; c.font = 'bold 9px Georgia'; c.textAlign = 'center'; c.fillText('ZONE', 0, -118); c.font = '7px Georgia'; c.fillText('NO ENTRY', 0, -108);
    c.restore();
  },
  farola(c, x, y, mk, E, z) {
    linea(c, x, y, x + 2, y - 140, GROSOR * 1.4);
    c.beginPath(); c.moveTo(x + 2, y - 140); c.quadraticCurveTo(x + 6, y - 150, x + 24, y - 146); tinta(c, GROSOR * 1.2);
    caja(c, x + 14, y - 148, 20, 8, '#3d3b37', mk.i);
    caja(c, x - 7, y - 10, 14, 10, '#3d3b37', mk.i + 1);
  },
  nido_chapa(c, x, y, mk, E, z) {
    // nido de los insectos hecho con chapa, tornillos y cristal de la ciudad
    const cy = y - 60, r = azar(mk.i * 9 + mk.j);
    for (let k = 0; k < 9; k++) {
      const a = r() * Math.PI * 2, d = r() * 26;
      const px = x + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.7;
      c.save(); c.translate(px, py); c.rotate(r() * 6);
      caja(c, -14, -8, 28, 16, k % 3 === 0 ? COLOR.oxido : k % 3 === 1 ? COLOR.laton : mezclar(COLOR.laton, '#000000', 0.4), k, 1, 1.6);
      c.fillStyle = TINTA; c.beginPath(); c.arc(-9, -3, 1.6, 0, 7); c.arc(9, 3, 1.6, 0, 7); c.fill();
      c.restore();
    }
    c.save(); c.globalAlpha = 0.7; trazar(c, [[x - 8, cy - 4], [x + 2, cy - 20], [x + 10, cy + 2]]); c.fillStyle = COLOR.cristalVerde; c.fill(); tinta(c, 1.4); c.restore();
    c.fillStyle = TINTA; c.beginPath(); c.ellipse(x, cy + 4, 9, 6, 0, 0, 7); c.fill();
  },
  soldado_caido(c, x, y, mk, E, z) {
    // un soldado de Boltbound caido; la daga es el objeto que se coge
    c.save(); c.translate(x - 10, y);
    const cuerpo = [[-30, -2], [-26, -16], [-6, -20], [16, -18], [30, -10], [34, -2]];
    trazar(c, temblar(cuerpo, 8, 1, 4)); c.fillStyle = '#4a4c44'; c.fill(); tinta(c);
    circulo(c, -32, -10, 9, '#3a3c36');
    c.fillStyle = '#2c2d29'; c.beginPath(); c.ellipse(-34, -16, 11, 5, -0.3, 0, 7); c.fill(); tinta(c, 1.6);
    // tallos secos (ya no vive)
    c.strokeStyle = '#3a2a1e'; c.lineWidth = 2.2;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-4 + k * 8, -18); c.quadraticCurveTo(-8 + k * 9, -34, -2 + k * 10, -40 - k * 4); c.stroke(); }
    c.restore();
  },
  rejilla_salida(c, x, y, mk, E, z) {
    caja(c, x - 8, y - 46, 46, 40, '#2a2f35', 4);
    for (let k = 0; k < 5; k++) linea(c, x - 4 + k * 9, y - 44, x - 4 + k * 9, y - 8, 1.6);
  },
  orden_militar(c, x, y, mk, E, z) { papel(c, x, y - 96, 34, 44, mk.i, 'BOLTBOUND', 'GARRISON ORDER'); },
  aviso_evacuacion(c, x, y, mk, E, z) { papel(c, x, y - 96, 34, 44, mk.i, 'EVACUATE', '— — —'); },
  cartel_ceniza(c, x, y, mk, E, z) {
    // GDD: un cartel del Proyecto Ceniza medio arrancado
    const cx = x, cy = y - 110;
    trazar(c, temblar([[cx - 40, cy - 50], [cx + 40, cy - 50], [cx + 40, cy + 6], [cx + 12, cy + 18], [cx - 6, cy + 48], [cx - 40, cy + 50]], 10, 1.4, 6));
    c.fillStyle = '#b9b19a'; c.fill(); tinta(c);
    c.fillStyle = TINTA; c.textAlign = 'center';
    c.font = 'bold 13px Georgia'; c.fillText('PROJECT', cx, cy - 28); c.fillText('ASH', cx, cy - 12);
    c.font = '7px Georgia'; c.fillText('A SOLDIER FOR THE ZONE', cx - 2, cy + 2);
    circulo(c, cx - 14, cy + 26, 10, 'rgba(0,0,0,.08)', 1.4);
  },
  edificio() {},
  // ---------------- casa
  ventana(c, x, y, mk, E, z) {
    // solo el cerco de la pared, con el hueco VACIO: la ciudad del otro lado, el cristal y los cuarterones van con
    // parallax cada fotograma (dibujarVentanas, abajo; dibujo/ventanas.js)
    const { w, h } = HUECO, cy = ventanaCy(E, mk, y);
    caja(c, x - w / 2 - 6, cy - h / 2 - 6, w + 12, h + 12, mezclar(z.masaClara, '#000000', 0.1), mk.i);
    c.save(); c.globalCompositeOperation = 'destination-out'; c.fillRect(x - w / 2, cy - h / 2, w, h); c.restore();
  },
  mueble(c, x, y, mk, E, z) {
    caja(c, x - 40, y - 64, 80, 64, '#3a2d20', mk.i);
    for (let k = 0; k < 3; k++) { linea(c, x - 36, y - 60 + k * 20, x + 36, y - 60 + k * 20, 1.4); c.fillStyle = TINTA; c.fillRect(x - 3, y - 52 + k * 20, 6, 2); }
    frascoPeq(c, x - 20, y - 64, 6, 14, false);
  },
  cuadro(c, x, y, mk, E, z) {
    const cy = y - 100;
    c.save(); c.translate(x, cy); c.rotate((hash(mk.i) - 0.5) * 0.2);
    caja(c, -22, -18, 44, 36, '#c8bfa8', mk.i);
    c.strokeStyle = 'rgba(40,40,40,.6)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-16, 10); c.lineTo(-4, -4); c.lineTo(4, 4); c.lineTo(16, -10); c.stroke();
    c.restore();
  },
  mesa_dibujo(c, x, y, mk, E, z) {
    // la mesa de Varga: papeles con dibujos a lapiz del 18, borde azul palido
    caja(c, x - 46, y - 40, 92, 6, '#4a3b2b', mk.i);
    linea(c, x - 40, y - 34, x - 40, y); linea(c, x + 40, y - 34, x + 40, y);
    const r = azar(mk.i * 3);
    for (let k = 0; k < 4; k++) {
      c.save(); c.translate(x - 30 + k * 18, y - 42); c.rotate((r() - 0.5) * 0.5);
      c.fillStyle = '#e4dcc6'; c.fillRect(-9, -3, 18, 4);
      c.fillStyle = rgba(COLOR.varga, 0.9); c.fillRect(-9, -3, 18, 1);
      c.restore();
    }
    // lapiz
    linea(c, x + 18, y - 44, x + 36, y - 48, 2.2, '#2a2a2a');
    // hoja en la pared con el 18 dibujado
    papel(c, x, y - 120, 40, 50, mk.i + 3, '', '');
    c.save(); c.strokeStyle = 'rgba(70,70,70,.7)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x - 6, y - 100); c.lineTo(x, y - 136); c.lineTo(x + 8, y - 112); c.stroke();
    c.beginPath(); c.arc(x + 1, y - 112, 5, 0, 7); c.stroke();
    c.restore();
  },
  // ---------------- hospital
  cama(c, x, y, mk, E, z) {
    caja(c, x - 50, y - 30, 100, 12, '#bdb6aa', mk.i);
    caja(c, x - 50, y - 36, 26, 8, '#d6d0c4', mk.i + 1);
    linea(c, x - 48, y - 18, x - 48, y); linea(c, x + 48, y - 18, x + 48, y);
    linea(c, x - 50, y - 30, x - 50, y - 56, GROSOR * 1.1); linea(c, x - 50, y - 56, x - 40, y - 56);
    c.fillStyle = 'rgba(80,60,50,.35)'; c.beginPath(); c.ellipse(x + 10, y - 26, 22, 4, 0, 0, 7); c.fill();
  },
  camilla(c, x, y, mk, E, z) {
    c.save(); c.translate(x, y); c.rotate(0.12);
    caja(c, -40, -26, 80, 8, '#a9a39a', mk.i);
    c.restore();
    linea(c, x - 30, y - 22, x - 34, y - 6); linea(c, x + 30, y - 16, x + 34, y - 6);
    circulo(c, x - 34, y - 4, 4, '#222'); circulo(c, x + 34, y - 4, 4, '#222');
  },
  luz_emergencia(c, x, y, mk, E, z) {
    const yt = techo(E, mk.i, mk.j);
    caja(c, x - 9, yt, 18, 10, '#3a1a1a', mk.i, 0.5, 1.8);
  },
  arbol_patio(c, x, y, mk, E, z) {
    // arbol seco del patio, ramas a tinta
    const r = azar(mk.i * 7);
    const rama = (x0, y0, ang, L, g) => {
      const x1 = x0 + Math.cos(ang) * L, y1 = y0 + Math.sin(ang) * L;
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 10, (y0 + y1) / 2, x1, y1);
      c.lineWidth = g; c.strokeStyle = TINTA; c.stroke();
      if (g > 1.4) { rama(x1, y1, ang - 0.4 - r() * 0.3, L * 0.7, g * 0.62); rama(x1, y1, ang + 0.35 + r() * 0.3, L * 0.68, g * 0.6); }
    };
    rama(x, y, -Math.PI / 2 + (r() - 0.5) * 0.2, 90, 9);
    caja(c, x - 26, y - 10, 52, 10, '#3d3532', mk.i);
  },
  banco_patio(c, x, y, mk, E, z) {
    caja(c, x - 34, y - 20, 68, 6, '#4a3b2b', mk.i);
    linea(c, x - 28, y - 14, x - 28, y); linea(c, x + 28, y - 14, x + 28, y);
  },
};

function frascoPeq(c, x, y, r, h, tapon) {
  trazar(c, [[x - r * 0.5, y - h], [x - r * 0.5, y - h * 0.6], [x - r, y - h * 0.35], [x - r, y], [x + r, y], [x + r, y - h * 0.35], [x + r * 0.5, y - h * 0.6], [x + r * 0.5, y - h]]);
  c.fillStyle = 'rgba(150,185,200,.22)'; c.fill(); tinta(c, 1.4);
  c.fillStyle = 'rgba(150,200,190,.35)'; c.fillRect(x - r + 1.5, y - h * 0.3, r * 2 - 3, h * 0.3 - 1.5);
  if (tapon) { c.fillStyle = TINTA; c.fillRect(x - r * 0.5, y - h - 3, r, 3); }
}

function papel(c, x, cy, w, h, s, t1, t2) {
  trazar(c, temblar([[x - w / 2, cy - h / 2], [x + w / 2, cy - h / 2 + 2], [x + w / 2 - 2, cy + h / 2], [x - w / 2 + 1, cy + h / 2 - 2]], 8, 0.8, s));
  c.fillStyle = '#d9d0b8'; c.fill(); tinta(c, 1.6);
  c.fillStyle = TINTA; c.textAlign = 'center';
  if (t1) { c.font = 'bold 6px Georgia'; c.fillText(t1, x, cy - h / 2 + 10); }
  if (t2) { c.font = '5px Georgia'; c.fillText(t2, x, cy - h / 2 + 18); }
  c.fillStyle = 'rgba(30,30,30,.35)';
  for (let k = 0; k < 5; k++) c.fillRect(x - w / 2 + 5, cy - h / 2 + 22 + k * 4, w - 10 - (k % 2) * 6, 1);
}

// ---------------------------------------------------------------- vivo
const VIVO = {
  asset(c, x, y, mk, E, z, t) { if (esVivo(mk) && mk.capa !== 'frente') pintarMarcaAsset(c, mk, E, t); },
  grieta(c, x, y, mk, E, z, t) {
    // polvo que cae por la grieta
    const yt = techo(E, mk.i, mk.j);
    c.fillStyle = rgba(z.polvo, 0.5);
    for (let k = 0; k < 7; k++) {
      const ciclo = ((t * 0.25 + k / 7 + hash(k, mk.i) * 0.3) % 1);
      const yy = yt + ciclo * 260, xx = x + (hash(k, mk.i + 1) - 0.5) * 30 + Math.sin(t + k) * 4;
      c.globalAlpha = 1 - ciclo;
      c.fillRect(xx, yy, 1.6, 1.6);
    }
    c.globalAlpha = 1;
  },
  luz_emergencia(c, x, y, mk, E, z, t) {
    const yt = techo(E, mk.i, mk.j);
    const f = 0.25 + 0.4 * Math.max(0, Math.sin(t * 1.6 + mk.i));
    c.fillStyle = `rgba(200,40,30,${f})`; c.fillRect(x - 6, yt + 3, 12, 5);
  },
  farola(c, x, y, mk, E, z, t) {
    if (mk.i % 3 !== 0) return;
    const f = parpadeo(t, mk.i);
    c.fillStyle = `rgba(250,240,215,${f * 0.8})`;
    if (E.nivel.zona === 'ciudad') c.fillRect(x + FAROLA.dx - 11, y - FAROLA.alto + 21, 22, 3);
    else c.fillRect(x + 16, y - 141, 16, 3);
  },
};

// Lo que se ve por las ventanas, con parallax (dibujo/ventanas.js). cam: { x, y, w, h, s }. Con hkp (la paleta a lo
// Hollow Knight) main.js la llama tras la luz y sin transformar: la ventana emite y queda detras de lo ya pintado; sin
// hkp, con lo de delante y en el mundo
export function dibujarVentanas(c, E, t, cam, hkp = null) {
  for (const mk of E.marcas) {
    if (mk.tipo !== 'ventana') continue;
    const x = mk.i * T + T / 2, y = (mk.j + 1) * T;
    if (x < cam.x - 80 || x > cam.x + cam.w + 80 || y < cam.y - 160 || y > cam.y + cam.h + 160) continue;
    componerVista(c, x, ventanaCy(E, mk, y), E, t, cam, hkp);
  }
}


// La cascada de luz de la anomalia: una columna que cae desde arriba, con hebras y motas, y bruma abajo
function cascada(c, x, E, t) {
  const alto = E.m.alto;
  c.save(); c.globalCompositeOperation = 'lighter';
  // halo ancho
  const g0 = c.createLinearGradient(x - 220, 0, x + 220, 0);
  g0.addColorStop(0, 'rgba(110,170,240,0)'); g0.addColorStop(0.5, 'rgba(140,195,255,.16)'); g0.addColorStop(1, 'rgba(110,170,240,0)');
  c.fillStyle = g0; c.fillRect(x - 220, 0, 440, alto);
  // columna
  const g = c.createLinearGradient(x - 70, 0, x + 70, 0);
  g.addColorStop(0, 'rgba(150,205,255,0)'); g.addColorStop(0.3, 'rgba(180,222,255,.22)'); g.addColorStop(0.5, 'rgba(240,250,255,.6)');
  g.addColorStop(0.7, 'rgba(180,222,255,.22)'); g.addColorStop(1, 'rgba(150,205,255,0)');
  c.fillStyle = g; c.fillRect(x - 70, 0, 140, alto);
  // hebras que caen
  for (let k = 0; k < 26; k++) {
    const xx = x - 34 + hash(k, 3) * 68, v = 220 + hash(k, 4) * 320, L = 90 + hash(k, 6) * 160;
    const y0 = ((t * v + hash(k, 5) * alto) % (alto + L)) - L;
    const gr = c.createLinearGradient(0, y0, 0, y0 + L);
    gr.addColorStop(0, 'rgba(235,248,255,0)'); gr.addColorStop(1, 'rgba(235,248,255,.7)');
    c.fillStyle = gr; c.fillRect(xx, y0, 1.2 + hash(k, 7) * 1.8, L);
  }
  // motas alrededor
  for (let k = 0; k < 60; k++) {
    const yy = ((t * (50 + hash(k, 7) * 140) + hash(k, 8) * alto) % alto);
    const xx = x + Math.sin(t * 0.7 + k) * (20 + hash(k, 9) * 90);
    c.fillStyle = hash(k, 10) < 0.5 ? 'rgba(233,245,255,.85)' : 'rgba(143,199,255,.85)';
    const sz = 1.2 + hash(k, 11) * 1.8;
    c.fillRect(xx, yy, sz, sz);
  }
  // bruma donde se pierde, abajo
  const gb = c.createRadialGradient(x, alto, 0, x, alto, 260);
  gb.addColorStop(0, 'rgba(200,230,255,.35)'); gb.addColorStop(1, 'rgba(200,230,255,0)');
  c.fillStyle = gb; c.fillRect(x - 260, alto - 260, 520, 260);
  c.restore();
}

// Lo que va detras del terreno y se mueve (la cascada)
export function dibujarDecoradoFondo(c, E, t) {
  for (const mk of E.marcas) if (mk.tipo === 'cascada') cascada(c, mk.i * T + T / 2, E, t);
}

// Lo que va por delante del 18 (capa 'frente'): se pinta tras los actores
export function dibujarDecoradoFrente(c, E, t) {
  for (const mk of E.marcas) if (mk.tipo === 'asset' && mk.capa === 'frente') pintarMarcaAsset(c, mk, E, t);
}
