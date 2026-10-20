// Lo que se ve por las ventanas (la casa de Varga y el hospital), con PARALLAX. Antes la ciudad iba pintada con la
// pared, dentro del trozo de terreno, y no se movia. Ahora el hueco es eso, un hueco: detras hay un paisaje lejano
// (cielo, cupulas y agujas, bloques, edificios cercanos y cables) que se mueve MAS DESPACIO que la pared y que el
// marco recorta. Se pinta cada fotograma: decorado.js (dibujarVentanas) desde main.js.
//
// Cada capa es un paisaje continuo y unico para todo el nivel: una capa con parallax f se mueve en pantalla f veces
// lo que la camara (la pared, 1). Por dentro del hueco eso es un corrimiento de (1 - f) veces la camara: lo lejano
// se corre mucho, lo cercano poco, y dos ventanas a la misma x en pisos distintos ven LOS MISMOS edificios.
// En vertical va anclado a cada ventana (la ciudad se ve en todas, cada una desde su piso: las de arriba miran por
// encima de los tejados de cerca) y se mueve con la camara amortiguado (KV): mirando una ventana de arriba se ve mas
// cielo; una de abajo, mas calle.
//
// Las capas de edificios se pintan UNA vez por trozos de TW u (y por escala) y se guardan; lo lejano a media
// resolucion (desenfocado, como el fondo a lo Hollow Knight). Lo que se mueve solo (nubes, cuervos) se pinta cada vez.
import { TINTA, GROSOR, hash, azar, rgba } from './tinta.js';

export const HUECO = { w: 64, h: 84 };

// la vista EMITE (componerVista), pero encima aun le caen la luz de la ventana (la imagen de Blender suma un parche
// claro sobre el cristal) y el resplandor de main.js: los valores van por debajo de ~0,65 para que, sumados, el cielo
// llegue casi a blanco y los edificios se lean a contraluz (lo lejano palido, lo cercano oscuro)
const PALETAS = {
  // de dia, cubierto: gris calido como el resto de la casa
  casa: {
    cieloAlto: '#857d6f', cieloBajo: '#a39a86', sol: '#cbc0a6', nube: '#b8ae9b',
    lejos: '#797264', medio: '#4f4a42', huecoM: '#2f2b26', cerca: '#26221e', huecoC: '#0f0d0b', suelo: '#1c1916',
    cable: '#0a0908', cuervo: '#3a3631', luces: 0,
  },
  // de noche: azul gris apagado; alguna ventana encendida en la ciudad
  hospital: {
    cieloAlto: '#1a1e28', cieloBajo: '#3d4554', sol: '#5a6272', nube: '#363d4a',
    lejos: '#2e3440', medio: '#20242d', huecoM: '#161920', cerca: '#121419', huecoC: '#08090b', suelo: '#0e1014',
    cable: '#050506', cuervo: '#0c0d10', luces: 0.07, luz: '#d8cfae',
  },
};

const TW = 256;                    // ancho de un trozo de capa (u)
const Y0 = -200, Y1 = 120;         // alto que se guarda de cada capa, respecto a su suelo (y = 0)
const KV = 0.14;                   // cuanto sigue la vista a la camara en vertical (mas, y las ventanas de arriba solo ven cielo)
const SESGO = 0.15;                // por piso: desde arriba, lo cercano queda mas bajo (se mira por encima)
// k: la escala de la capa (los edificios se dibujan en sus u y se encogen: lejos, mas). El hueco mide 84 u de alto: la
// ciudad tiene que caber en su mitad de abajo y dejar cielo encima, o solo se ven fachadas
const CAPAS = [
  { id: 'lejos', f: 0.1, base: 16, k: 0.35, paso: 46, maxW: 120, res: 0.5, velo: [0.1, 0.32] },
  { id: 'medio', f: 0.3, base: 40, k: 0.5, paso: 66, maxW: 130, res: 0.75, velo: [0.04, 0.22] },
  { id: 'cerca', f: 0.56, base: 92, k: 0.7, paso: 176, maxW: 170, res: 1, velo: [0, 0.1] },
];
const CABLES = { f: 0.76, base: 150, paso: 300 };

// ---------------------------------------------------------------- trozos guardados
const cache = new Map();
let escalaCache = 0;
const MAX_TROZOS = 48;

function trozo(zona, P, ci, k, s) {
  if (Math.abs(s - escalaCache) > 1e-3) { cache.clear(); escalaCache = s; }
  const clave = zona + '|' + ci + '|' + k;
  let cv = cache.get(clave);
  if (cv) { cache.delete(clave); cache.set(clave, cv); return cv; }
  cv = pintarTrozo(P, ci, k, s);
  cache.set(clave, cv);
  if (cache.size > MAX_TROZOS) cache.delete(cache.keys().next().value);
  return cv;
}

function pintarTrozo(P, ci, k, s) {
  const capa = CAPAS[ci], e = s * capa.res;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(TW * e); cv.height = Math.ceil((Y1 - Y0) * e);
  const c = cv.getContext('2d');
  c.setTransform(e, 0, 0, e, -k * TW * e, -Y0 * e);
  const xa = k * TW, xb = xa + TW;
  const luces = [];
  // el suelo de la capa (lo de abajo, que las capas de delante tapan casi siempre)
  suelo(c, P, ci, xa, xb);
  const n0 = Math.floor((xa / capa.k - capa.maxW) / capa.paso) - 1, n1 = Math.floor(xb / capa.k / capa.paso) + 1;
  for (let n = n0; n <= n1; n++) {
    const r = azar(((n * 7919) ^ (ci * 104729 + 9173)) >>> 0);
    c.save();
    c.scale(capa.k, capa.k);
    if (ci === 0) lejos(c, n, r, P);
    else if (ci === 1) medio(c, n, r, P, luces);
    else cerca(c, n, r, P, luces);
    c.restore();
  }
  // bruma entre capas (el velo de Hollow Knight): lo lejano mas claro y mas plano, y mas espesa a ras de suelo
  c.globalCompositeOperation = 'source-atop';
  const g = c.createLinearGradient(0, -110, 0, 6);
  g.addColorStop(0, rgba(P.cieloBajo, capa.velo[0])); g.addColorStop(1, rgba(P.cieloBajo, capa.velo[1]));
  c.fillStyle = g; c.fillRect(xa, Y0, TW, Y1 - Y0);
  c.globalCompositeOperation = 'source-over';
  // las ventanas encendidas, por encima de la bruma
  if (luces.length) {
    c.fillStyle = rgba(P.luz, ci === 1 ? 0.4 : 0.5);
    for (const [x, y, w, h] of luces) c.fillRect(x, y, w, h);
  }
  return cv;
}

function suelo(c, P, ci, xa, xb) {
  const r = azar(ci * 31 + 7 + Math.round(xa));
  c.fillStyle = ci === 0 ? P.lejos : ci === 1 ? P.huecoM : P.suelo;
  c.beginPath(); c.moveTo(xa - 2, Y1);
  // escombro: el borde de arriba con montones bajos
  for (let x = xa - 2; x <= xb + 2; x += 8) c.lineTo(x, (ci === 0 ? 1 : -3) - r() * (ci === 2 ? 9 : 4));
  c.lineTo(xb + 2, Y1); c.closePath(); c.fill();
}

// el lado en sombra de un volumen (la luz viene de la izquierda, como la de la sala)
function sombra(c, x, y, w, h, a = 0.12) { c.fillStyle = `rgba(0,0,0,${a})`; c.fillRect(x + w * 0.66, y, w * 0.34, h); }

// ---------------------------------------------------------------- lejos: cupulas, agujas, torres (la ciudad de la bruma)
function lejos(c, n, r, P) {
  const x0 = n * 46 + r() * 22, tipo = r();
  c.fillStyle = P.lejos;
  if (tipo < 0.2) {
    // cupula sobre su tambor
    const w = 40 + r() * 34, h = 34 + r() * 40, cx = x0 + w / 2, dw = w * (0.55 + r() * 0.2), th = 8 + r() * 8;
    c.fillRect(x0, -h, w, h + 2);
    c.fillRect(cx - dw * 0.42, -h - th, dw * 0.84, th + 1);
    c.beginPath(); c.ellipse(cx, -h - th, dw / 2, dw * 0.5, 0, Math.PI, 0); c.fill();
    c.fillRect(cx - 2.5, -h - th - dw * 0.5 - 8, 5, 9);
    c.beginPath(); c.moveTo(cx - 1.2, -h - th - dw * 0.5 - 8); c.lineTo(cx, -h - th - dw * 0.5 - 20); c.lineTo(cx + 1.2, -h - th - dw * 0.5 - 8); c.fill();
    sombra(c, x0, -h, w, h, 0.08);
  } else if (tipo < 0.4) {
    // catedral: nave con hastial y una o dos torres con aguja
    const w = 46 + r() * 34, h = 30 + r() * 26;
    c.beginPath(); c.moveTo(x0, 2); c.lineTo(x0, -h); c.lineTo(x0 + w / 2, -h - 14 - r() * 8); c.lineTo(x0 + w, -h); c.lineTo(x0 + w, 2); c.fill();
    const dos = r() < 0.5;
    for (const tx of dos ? [x0 - 4, x0 + w - 10] : [x0 + (r() < 0.5 ? -6 : w - 12)]) {
      const tw = 12 + r() * 5, tht = h + 34 + r() * 46, ah = 26 + r() * 30;
      c.fillRect(tx, -tht, tw, tht + 2);
      c.beginPath(); c.moveTo(tx - 1, -tht); c.lineTo(tx + tw / 2, -tht - ah); c.lineTo(tx + tw + 1, -tht); c.fill();
      // un ventanal apuntado, mas claro (se ve el cielo a traves: esta hueca)
      c.fillStyle = P.cieloBajo; c.globalAlpha = 0.5;
      c.fillRect(tx + tw / 2 - 1.5, -tht + 8, 3, 9);
      c.globalAlpha = 1; c.fillStyle = P.lejos;
    }
  } else if (tipo < 0.68) {
    // torre: escalonada arriba o con antena
    const w = 16 + r() * 18, h = 60 + r() * 90;
    c.fillRect(x0, -h, w, h + 2);
    if (r() < 0.5) { c.fillRect(x0 + w * 0.15, -h - 10, w * 0.7, 11); c.fillRect(x0 + w * 0.3, -h - 18, w * 0.4, 9); }
    else { c.fillRect(x0 + w / 2 - 0.6, -h - 26 - r() * 20, 1.2, 30); }
    sombra(c, x0, -h, w, h, 0.07);
  } else {
    // bloque bajo con el tejado roto
    const w = 40 + r() * 50, h = 22 + r() * 36;
    c.beginPath(); c.moveTo(x0, 2); c.lineTo(x0, -h);
    for (let x = x0 + 6; x < x0 + w; x += 6 + r() * 6) c.lineTo(x, -h + (r() < 0.3 ? r() * 14 : 0));
    c.lineTo(x0 + w, -h * (0.7 + r() * 0.3)); c.lineTo(x0 + w, 2); c.fill();
  }
}

// ---------------------------------------------------------------- medio: bloques de pisos, rotos, depositos, una grua
function medio(c, n, r, P, luces) {
  if (hash(n, 17) < 0.12) return;
  const x0 = n * 66 + r() * 22, w = 30 + r() * 42, h = 36 + r() * 92, tipo = r();
  if (hash(n, 13) < 0.09) { grua(c, x0, r, P); return; }
  const roto = tipo < 0.35;
  c.beginPath(); c.moveTo(x0, 2); c.lineTo(x0, -h);
  const tope = [];
  if (roto) {
    // el borde partido, a dientes, mas bajo hacia un lado
    const caida = 0.35 + r() * 0.45, haciaDer = r() < 0.5;
    for (let x = x0; x <= x0 + w; x += 5 + r() * 5) {
      const u = (x - x0) / w, b = haciaDer ? u : 1 - u;
      const y = -h * (1 - caida * b * b) + (r() - 0.5) * 8;
      c.lineTo(x, y); tope.push([x, y]);
    }
    c.lineTo(x0 + w, -h * (1 - caida * (haciaDer ? 1 : 0)));
  } else { c.lineTo(x0 + w, -h); }
  c.lineTo(x0 + w, 2); c.closePath();
  c.fillStyle = P.medio; c.fill();
  c.save(); c.clip();
  // las ventanas: huecos oscuros en reticula, alguna que falta y, de noche, alguna encendida
  const cw = 9, ch = 12, mx = 4 + r() * 3;
  for (let y = -h + 8; y < -10; y += ch) for (let x = x0 + mx; x < x0 + w - 5; x += cw) {
    const q = hash(Math.round(x * 3), Math.round(y * 3), n);
    if (q < 0.12) continue;
    if (P.luces && q > 1 - P.luces) { luces.push([x, y, 4, 5]); continue; }
    c.fillStyle = P.huecoM; c.fillRect(x, y, 4, 5);
  }
  sombra(c, x0, -h - 20, w, h + 22, 0.12);
  c.restore();
  if (roto) {
    // la ferralla que sale del borde partido
    c.strokeStyle = P.huecoM; c.lineWidth = 0.9;
    for (let k = 0; k < 4 && tope.length; k++) {
      const [x, y] = tope[Math.floor(r() * tope.length)];
      c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x + (r() - 0.5) * 8, y - 6 - r() * 8); c.stroke();
    }
  } else {
    // cornisa y lo de la azotea: deposito de agua en patas o antena
    c.fillStyle = P.medio; c.fillRect(x0 - 2, -h - 2, w + 4, 3);
    const q = r();
    if (q < 0.4) {
      const dx = x0 + 6 + r() * (w - 22), dw = 12 + r() * 6;
      c.strokeStyle = P.medio; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(dx + 2, -h); c.lineTo(dx + 3, -h - 10); c.moveTo(dx + dw - 2, -h); c.lineTo(dx + dw - 3, -h - 10); c.stroke();
      c.fillRect(dx, -h - 24, dw, 14);
      c.beginPath(); c.moveTo(dx - 1, -h - 24); c.lineTo(dx + dw / 2, -h - 31); c.lineTo(dx + dw + 1, -h - 24); c.fill();
    } else if (q < 0.7) {
      const ax = x0 + 6 + r() * (w - 12);
      c.strokeStyle = P.medio; c.lineWidth = 1;
      c.beginPath(); c.moveTo(ax, -h); c.lineTo(ax, -h - 22 - r() * 22); c.moveTo(ax - 5, -h - 14); c.lineTo(ax + 5, -h - 14); c.stroke();
    }
  }
}

function grua(c, x0, r, P) {
  // grua torre parada desde la evacuacion: mastil de celosia, pluma y contrapluma, el gancho colgando
  const h = 210 + r() * 70, mw = 7, izq = r() < 0.5, L = 90 + r() * 50, Lc = 34;
  c.strokeStyle = P.medio; c.fillStyle = P.medio; c.lineWidth = 1.1;
  c.beginPath();
  c.moveTo(x0, 2); c.lineTo(x0, -h); c.moveTo(x0 + mw, 2); c.lineTo(x0 + mw, -h);
  for (let y = 0, k = 0; y > -h; y -= mw, k++) { c.moveTo(x0 + (k % 2 ? mw : 0), y); c.lineTo(x0 + (k % 2 ? 0 : mw), y - mw); }
  const s = izq ? -1 : 1, xp = izq ? x0 : x0 + mw;
  c.moveTo(xp, -h); c.lineTo(xp + s * L, -h); c.moveTo(xp, -h - 6); c.lineTo(xp + s * L, -h);
  c.moveTo(xp - s * mw, -h); c.lineTo(xp - s * (mw + Lc), -h);
  c.moveTo(x0 + mw / 2, -h - 22); c.lineTo(xp + s * L * 0.6, -h); c.moveTo(x0 + mw / 2, -h - 22); c.lineTo(xp - s * (mw + Lc), -h);
  for (let k = 1; k * 9 < L; k++) { c.moveTo(xp + s * k * 9, -h); c.lineTo(xp + s * (k * 9 - 4.5), -h - 6 + k * 6 / (L / 9)); }
  c.stroke();
  c.fillRect(x0 - 2, -h - 22, mw + 4, 4);
  c.fillRect(xp - s * (mw + Lc) - (izq ? 0 : 12), -h + 1, 12, 9);                 // contrapeso
  c.fillRect(x0 - 3, -h + 2, mw + 6, 8);                                          // cabina
  const gx = xp + s * L * (0.55 + r() * 0.35);
  c.beginPath(); c.moveTo(gx, -h); c.lineTo(gx, -h + 60 + r() * 50); c.stroke();
  c.fillRect(gx - 2.5, -h + 60, 5, 6);
}

// ---------------------------------------------------------------- cerca: ladrillo con escalera de incendios, esqueletos de hormigon, chimeneas
function cerca(c, n, r, P, luces) {
  if (hash(n, 19) < 0.3) return;
  const x0 = n * 176 + r() * 50, w = 64 + r() * 60, h = 50 + r() * 76, tipo = r();
  c.lineJoin = 'round';
  if (tipo < 0.3) {
    // esqueleto de hormigon: forjados y pilares, y por los huecos se ve lo de atras
    const pl = 30, nPl = Math.floor(h / pl), cols = 2 + Math.floor(w / 46);
    c.fillStyle = P.cerca;
    for (let k = 0; k <= nPl; k++) {
      const y = -k * pl, alto = k >= nPl - 2;
      let a = x0, b = x0 + w;
      if (alto) { if (r() < 0.5) b -= r() * w * 0.6; else a += r() * w * 0.6; }
      c.fillRect(a, y - 5, b - a, 5);
      if (alto) { c.strokeStyle = P.cerca; c.lineWidth = 0.9; c.beginPath(); for (let q = 0; q < 3; q++) { const x = (r() < 0.5 ? a : b); c.moveTo(x, y - 3); c.lineTo(x + (r() - 0.5) * 12, y - 3 - r() * 7); } c.stroke(); }
    }
    for (let q = 0; q < cols; q++) {
      const x = x0 + q * (w - 6) / (cols - 1), top = -(nPl - (q % 2 ? 2 : 1)) * pl;
      c.fillRect(x, top, 6, -top + 2);
    }
    // un tabique de atras aqui y alla
    c.globalAlpha = 0.55;
    for (let k = 1; k < nPl - 1; k++) if (r() < 0.35) { const a = x0 + r() * w * 0.6; c.fillRect(a, -k * pl, 18 + r() * 24, pl - 5); }
    c.globalAlpha = 1;
    return;
  }
  if (tipo < 0.45) {
    // nave baja con chimenea de ladrillo
    const hb = h * 0.3, cx = x0 + w * (0.2 + r() * 0.5), cwid = 12 + r() * 5, ch = h * (0.8 + r() * 0.3);
    c.fillStyle = P.cerca;
    c.beginPath(); c.moveTo(x0, 2); c.lineTo(x0, -hb); for (let k = 0; k < 4; k++) { c.lineTo(x0 + w * (k + 0.5) / 4, -hb - 10); c.lineTo(x0 + w * (k + 1) / 4, -hb); } c.lineTo(x0 + w, 2); c.closePath();
    c.fill(); c.strokeStyle = rgba(TINTA, 0.5); c.lineWidth = 1.1; c.stroke();
    c.fillStyle = P.cerca;
    c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx + 1.5, -ch); c.lineTo(cx + cwid - 1.5, -ch); c.lineTo(cx + cwid, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = P.huecoC; for (let y = -ch + 10; y < -hb; y += 24) c.fillRect(cx + 1, y, cwid - 2, 2.5);
    c.fillStyle = P.cerca; c.fillRect(cx - 1.5, -ch - 4, cwid + 3, 5);
    return;
  }
  // bloque de ladrillo: cornisa, ventanas grandes (huecos sin cristal), escalera de incendios por un lado
  c.fillStyle = P.cerca;
  c.beginPath(); c.moveTo(x0, 2); c.lineTo(x0, -h);
  const roto = r() < 0.35;
  if (roto) { for (let x = x0 + 8; x < x0 + w; x += 8 + r() * 8) c.lineTo(x, -h + r() * 26); }
  c.lineTo(x0 + w, -h + (roto ? 18 : 0)); c.lineTo(x0 + w, 2); c.closePath();
  c.fill();
  c.save(); c.clip();
  const vw = 7, vh = 11, px = 15, py = 22;
  for (let y = -h + 14; y < -14; y += py) for (let x = x0 + 7; x < x0 + w - 9; x += px) {
    const q = hash(Math.round(x * 5), Math.round(y * 5), n + 3);
    if (P.luces && q > 1 - P.luces * 0.7) { luces.push([x, y, vw, vh]); continue; }
    c.fillStyle = P.huecoC; c.fillRect(x, y, vw, vh);
    if (q < 0.3) { c.fillStyle = P.cerca; c.fillRect(x, y + vh * 0.55, vw, 1.4); }   // el travesano que queda
  }
  c.fillStyle = 'rgba(0,0,0,.14)';
  for (let y = -h + 30; y < 0; y += 44) c.fillRect(x0, y, w, 1.5);                    // las juntas de cada planta
  sombra(c, x0, -h - 30, w, h + 32, 0.14);
  c.restore();
  c.strokeStyle = rgba(TINTA, 0.5); c.lineWidth = 1.1; c.stroke();
  if (!roto) { c.fillStyle = P.cerca; c.fillRect(x0 - 3, -h - 3, w + 6, 4); }
  // la escalera de incendios, en zigzag, con un descansillo cada dos plantas
  if (r() < 0.7) {
    const ex = r() < 0.5 ? x0 + 4 : x0 + w - 26, ew = 22;
    c.strokeStyle = P.huecoC; c.lineWidth = 1;
    c.beginPath();
    for (let y = -24, k = 0; y > -h + 30; y -= 44, k++) {
      c.moveTo(ex - 2, y); c.lineTo(ex + ew + 2, y);
      c.moveTo(ex - 2, y - 6); c.lineTo(ex + ew + 2, y - 6);
      c.moveTo(k % 2 ? ex : ex + ew, y); c.lineTo(k % 2 ? ex + ew : ex, y - 44);
    }
    c.stroke();
  }
}

// ---------------------------------------------------------------- lo que se mueve: nubes y cuervos
function nubes(c, P, ox, gy, xa, xb, t) {
  // bandas largas y blandas que van hacia la izquierda (parallax casi nulo, deriva lenta)
  const paso = 120;
  for (let n = Math.floor((xa - ox + t * 5) / paso) - 2; n <= Math.floor((xb - ox + t * 5) / paso) + 1; n++) {
    const x = ox + n * paso + hash(n, 41) * 90 - t * 5, y = gy - 40 - hash(n, 42) * 50, w = 50 + hash(n, 43) * 60, h = 4 + hash(n, 44) * 6;
    if (x + w < xa || x - w > xb) continue;
    const g = c.createRadialGradient(x, y, 0, x, y, w);
    g.addColorStop(0, rgba(P.nube, 0.3)); g.addColorStop(1, rgba(P.nube, 0));
    c.save(); c.translate(x, y); c.scale(1, h / w); c.translate(-x, -y);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, w, 0, 7); c.fill();
    c.restore();
  }
}

function cuervos(c, P, ox, gy, xa, xb, t) {
  // cuervos que dan vueltas sobre la ciudad, a la distancia de los bloques
  const paso = 420;
  for (let n = Math.floor((xa - ox) / paso) - 1; n <= Math.floor((xb - ox) / paso) + 1; n++) {
    if (hash(n, 51) < 0.35) continue;
    const cx0 = ox + n * paso + hash(n, 52) * 200, cy0 = gy - 44 - hash(n, 53) * 26, R = 12 + hash(n, 54) * 14;
    c.strokeStyle = P.cuervo; c.lineWidth = 0.7; c.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const a = t * (0.35 + hash(n, 55) * 0.2) * (hash(n, 56) < 0.5 ? 1 : -1) + k * 2.1 + hash(n, k) * 0.8;
      const x = cx0 + Math.cos(a) * R * (1 + k * 0.15), y = cy0 + Math.sin(a) * R * 0.35 + k * 3;
      if (x < xa - 6 || x > xb + 6) continue;
      const ala = 1 + Math.sin(t * 7 + k * 1.7 + n) * 1, aw = 2.1;
      c.beginPath(); c.moveTo(x - aw, y - ala); c.quadraticCurveTo(x - aw * 0.4, y - ala * 0.2, x, y); c.quadraticCurveTo(x + aw * 0.4, y - ala * 0.2, x + aw, y - ala); c.stroke();
    }
  }
}

function cables(c, P, ox, gy, xa, xb) {
  // postes con dos cables combados: lo mas cerca de todo y lo que mas se nota que se corre
  const paso = CABLES.paso;
  const poste = (n) => [ox + n * paso + hash(n, 61) * 90, gy - 150 - hash(n, 62) * 40];
  c.strokeStyle = P.cable; c.lineCap = 'round';
  for (let n = Math.floor((xa - ox) / paso) - 2; n <= Math.floor((xb - ox) / paso) + 1; n++) {
    const [x, y] = poste(n), [x2, y2] = poste(n + 1);
    if (x2 < xa - 4 || x > xb + 4) continue;
    c.lineWidth = 3.4; c.beginPath(); c.moveTo(x, gy + 40); c.lineTo(x, y - 6); c.stroke();
    c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 9, y); c.lineTo(x + 9, y); c.stroke();
    c.lineWidth = 0.9; c.beginPath();
    for (const d of [-7, 6]) { c.moveTo(x + d, y); c.quadraticCurveTo((x + x2) / 2, Math.max(y, y2) + 44 + hash(n, 63) * 20, x2 + d, y2); }
    c.stroke();
  }
}

// ---------------------------------------------------------------- la vista por una ventana
// (x, cy): centro del hueco en el mundo; cam: { x, y, w, h, s } la camara del juego (con la sacudida de los golpes, que
// tambien mueve el paisaje). hkp: la paleta a lo Hollow Knight de la zona (dibujo/hk.js) o null.
//   con hkp   main.js la llama DESPUES de la luz de la sala, sobre el lienzo sin transformar: la vista se pinta aparte
//             y se pone DETRAS de lo ya pintado (destination-over). Asi la ventana EMITE (la penumbra no la apaga ni
//             le come el contraste: medido, la multiplicaba por 0,36) y el 18, el polvo y las lamparas siguen delante.
//             Se tine con el color de la zona, como el fondo
//   sin hkp   va con lo de delante, en el mundo, antes de la luz (zonas sin el estilo HK)
const lienzo = typeof document !== 'undefined' ? document.createElement('canvas') : null;
export function componerVista(c, x, cy, E, t, cam, hkp) {
  if (!hkp) { pintarVista(c, x, cy, E, t, cam, null); return; }
  const s = cam.s, M = GROSOR;
  const { w, h } = HUECO;
  // el rectangulo en pantalla, a pixel entero (la vista se pinta ya en su sitio: sin remuestrear)
  const px = Math.floor((x - w / 2 - M - cam.x) * s), py = Math.floor((cy - h / 2 - M - cam.y) * s);
  const pw = Math.ceil((w + 2 * M) * s) + 2, ph = Math.ceil((h + 2 * M) * s) + 2;
  if (px + pw < 0 || py + ph < 0 || px > c.canvas.width || py > c.canvas.height) return;
  if (lienzo.width < pw || lienzo.height < ph) { lienzo.width = Math.max(lienzo.width, pw); lienzo.height = Math.max(lienzo.height, ph); }
  const o = lienzo.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
  o.clearRect(0, 0, pw, ph);
  o.setTransform(s, 0, 0, s, -cam.x * s - px, -cam.y * s - py);
  pintarVista(o, x, cy, E, t, cam, hkp);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'destination-over';
  c.drawImage(lienzo, 0, 0, pw, ph, px, py, pw, ph);
  c.restore();
}

function pintarVista(c, x, cy, E, t, cam, hkp) {
  const zona = PALETAS[E.nivel.zona] ? E.nivel.zona : 'casa', P = PALETAS[zona];
  const s = cam.s, CX = cam.x + cam.w / 2, CY = cam.y + cam.h / 2;
  const { w, h } = HUECO, xa = x - w / 2, xb = x + w / 2, ya = cy - h / 2, yb = cy + h / 2;
  // cuanto mira hacia arriba o hacia abajo esta ventana (amortiguado y con tope, para no salirse de lo guardado)
  const dv = Math.max(-300, Math.min(300, CY - cy)) * KV;
  const piso = (E.m.alto / 2 - cy) * SESGO;
  const suelo = (f, base) => cy + base + dv * (1 - f) + piso * f;
  c.save();
  c.beginPath(); c.rect(xa, ya, w, h); c.clip();
  // el cielo: degradado hasta el horizonte y un sol velado fijo en la pantalla (parallax 0)
  const gh = suelo(0, CAPAS[0].base);
  const g = c.createLinearGradient(0, gh - 140, 0, gh);
  g.addColorStop(0, P.cieloAlto); g.addColorStop(1, P.cieloBajo);
  c.fillStyle = g; c.fillRect(xa, ya, w, h);
  const sx = CX + 220, sy = gh - 50, gs = c.createRadialGradient(sx, sy, 0, sx, sy, 300);
  gs.addColorStop(0, rgba(P.sol, 0.32)); gs.addColorStop(1, rgba(P.sol, 0));
  c.fillStyle = gs; c.fillRect(xa, ya, w, h);
  nubes(c, P, CX * 0.97, gh, xa, xb, t);
  // las capas de edificios, de lejos a cerca
  for (let ci = 0; ci < CAPAS.length; ci++) {
    const capa = CAPAS[ci], ox = CX * (1 - capa.f), gy = suelo(capa.f, capa.base);
    const k0 = Math.floor((xa - ox) / TW), k1 = Math.floor((xb - ox) / TW);
    for (let k = k0; k <= k1; k++) c.drawImage(trozo(zona, P, ci, k, s), ox + k * TW, gy + Y0, TW, Y1 - Y0);
    if (ci === 0) cuervos(c, P, CX * 0.8, gy, xa, xb, t);
  }
  cables(c, P, CX * (1 - CABLES.f), suelo(CABLES.f, CABLES.base), xa, xb);
  // el cristal: un reflejo en diagonal, mugre en las esquinas y la sombra del grueso del muro arriba y a la izquierda
  const gr = c.createLinearGradient(xa, ya, xb, yb);
  gr.addColorStop(0.18, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, 'rgba(255,255,255,.09)'); gr.addColorStop(0.42, 'rgba(255,255,255,0)');
  gr.addColorStop(0.62, 'rgba(255,255,255,0)'); gr.addColorStop(0.68, 'rgba(255,255,255,.05)'); gr.addColorStop(0.74, 'rgba(255,255,255,0)');
  c.fillStyle = gr; c.fillRect(xa, ya, w, h);
  const gm = c.createRadialGradient(x, cy, h * 0.3, x, cy, h * 0.75);
  gm.addColorStop(0, 'rgba(40,32,24,0)'); gm.addColorStop(1, 'rgba(40,32,24,.2)');
  c.fillStyle = gm; c.fillRect(xa, ya, w, h);
  const gt = c.createLinearGradient(0, ya, 0, ya + 9);
  gt.addColorStop(0, 'rgba(0,0,0,.4)'); gt.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gt; c.fillRect(xa, ya, w, 9);
  const gl = c.createLinearGradient(xa, 0, xa + 6, 0);
  gl.addColorStop(0, 'rgba(0,0,0,.3)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gl; c.fillRect(xa, ya, 6, h);
  // el color de la zona por encima (como el fondo en hk.gradarFondo), solo dentro del cristal
  if (hkp) { c.globalCompositeOperation = 'color'; c.globalAlpha = hkp.kFondo * 0.6; c.fillStyle = hkp.tinta; c.fillRect(xa, ya, w, h); }
  c.restore();
  // el marco: cuarterones y la grieta del cristal
  c.strokeStyle = TINTA; c.lineWidth = GROSOR;
  c.strokeRect(xa, ya, w, h);
  c.beginPath(); c.moveTo(x, ya); c.lineTo(x, yb); c.moveTo(xa, cy); c.lineTo(xb, cy); c.stroke();
  const grieta = [[x - 22, cy - 34], [x - 13, cy - 24], [x - 4, cy - 15], [x - 9, cy - 6], [x - 15, cy + 2]];
  for (const [color, d] of [['rgba(255,255,255,.14)', 0.6], ['rgba(0,0,0,.5)', 0]]) {
    c.strokeStyle = color; c.lineWidth = 0.7;
    c.beginPath(); grieta.forEach(([gx, gy], i) => (i ? c.lineTo(gx + d, gy + d) : c.moveTo(gx + d, gy + d)));
    c.moveTo(x - 13 + d, cy - 24 + d); c.lineTo(x - 21 + d, cy - 16 + d); c.stroke();
  }
}
