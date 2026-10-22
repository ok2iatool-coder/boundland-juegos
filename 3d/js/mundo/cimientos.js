// LA CIMENTACION DE LA CIUDAD (2026-10-21, "pon cimentacion en el suelo de la futura ciudad"): dentro de la muralla, la
// obra de la ciudad que aun no esta, en las HUELLAS de los planos (web/datos/mundo/ciudad.json, que escribe
// diseno/planos/exportar_ciudad.py: el casco viejo, El Panal -tambien en la mitad sur-, la catedral, las torres, los
// edificios con nombre, los Bloques, las pilas del viaducto, la plaza y las calles). Cada huella, en un ESTADO de obra
// sacado de su sitio (siempre el mismo):
//   - LOSA: hormigonada, 15 cm sobre el suelo, con las ESPERAS de acero (grupos de cuatro barras en las esquinas y, en
//     las manzanas, pares por los lados);
//   - ZANJA: la zanja corrida abierta (tierra oscura) con su jaula de armado dentro, la tierra removida y el monton;
//   - REPLANTEO: solo las estacas, la cuerda tirada entre ellas y las lineas de cal;
//   - CURADA: la losa sola.
// Los grandes (torres, Bloques, catedral) llevan LOSA DE CIMENTACION con los ARRANQUES de los pilares (con su caja de
// choque); el viaducto, un ENCEPADO por pila con el arranque de la pila. Las calles, de zahorra. El 18 sube a las losas
// (`altura` les suma su canto) y la hierba no crece encima (`ocupado`, una rejilla de 0,5 m).
import * as THREE from 'three';
import * as R from './relieve.js';
import { TONO } from './tono.js';
import { Lote } from './puerta.js';
import { OBRA as OBRA_HIERBA } from './sitios.js';
import { reservado } from './macro.js';
import { reservadoTorres } from './torres.js';

let CIUDAD = null;
if (typeof window !== 'undefined') {
  try { CIUDAD = await fetch(new URL('../../datos/mundo/ciudad.json', import.meta.url), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)); } catch (e) { CIUDAD = null; }
}

// la rejilla de la obra: 0,5 m sobre el disco de dentro del muro (centro (0, 2400), 440 m)
const CX = 0, CZ = 2400, RG = 440, CEL = 0.5, NG = Math.round((2 * RG) / CEL);
const ALTO = new Uint8Array(NG * NG);       // lo que sube el suelo, en cm (las losas)
const OBRA = new Uint8Array(NG * NG);       // 1 = aqui no crece hierba
const celda = (x, z) => {
  const i = Math.floor((x - CX + RG) / CEL), j = Math.floor((z - CZ + RG) / CEL);
  return i < 0 || j < 0 || i >= NG || j >= NG ? -1 : j * NG + i;
};
export function alturaObra(x, z) { const k = celda(x, z); return k < 0 ? 0 : ALTO[k] / 100; }
export function ocupado(x, z) { const k = celda(x, z); return k >= 0 && OBRA[k] === 1; }

// ---- ayudas de geometria plana (x, z)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ARRIBA = V(0, 1, 0);
function centroide(P) { let x = 0, z = 0; for (const p of P) { x += p[0]; z += p[1]; } return [x / P.length, z / P.length]; }
function encoger(P, d) {               // hacia el centroide d metros (los poligonos son convexos y pequenos)
  const [cx, cz] = centroide(P);
  return P.map(([x, z]) => { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1; const f = Math.max(0, (l - d) / l); return [cx + dx * f, cz + dz * f]; });
}
function dentro(P, x, z) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function marcar(P, yTapa, margen = 0) {
  const Q = margen ? encoger(P, -margen) : P;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of Q) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (let z = Math.floor(z0 / CEL) * CEL + CEL / 2; z < z1; z += CEL) {
    for (let x = Math.floor(x0 / CEL) * CEL + CEL / 2; x < x1; x += CEL) {
      const k = celda(x, z);
      if (k < 0) continue;
      if (dentro(Q, x, z)) {
        OBRA[k] = 1;
        if (yTapa != null && dentro(P, x, z)) ALTO[k] = Math.max(ALTO[k], Math.max(0, Math.min(255, Math.round((yTapa - R.altura(x, z)) * 100))));
      }
    }
  }
}
function marcarBanda(A, B, ancho) {    // una calle (segmento con ancho)
  const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * ancho / 2, nz = dx / l * ancho / 2;
  marcar([[A[0] + nx, A[1] + nz], [B[0] + nx, B[1] + nz], [B[0] - nx, B[1] - nz], [A[0] - nx, A[1] - nz]], null);
}
// numero de 0 a 1 fijo para un sitio
const h01 = (x, z, k = 0) => { let s = Math.imul(Math.round(x * 10) | 0, 73856093) ^ Math.imul(Math.round(z * 10) | 0, 19349663) ^ Math.imul(k + 1, 83492791); s = Math.imul(s ^ (s >>> 13), 1274126177); return ((s ^ (s >>> 16)) >>> 0) / 4294967296; };

// ---- la textura del hormigon (se repite cada 4 m)
function texturaHormigon() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9c9a'; g.fillRect(0, 0, 512, 512);
  let s = 7; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const repetir = (f) => { for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) f(ox, oy); };
  for (let n = 0; n < 70; n++) {
    const x = r() * 512, y = r() * 512, rr = 30 + r() * 120, t = r() < 0.6 ? '60,62,62' : '190,190,184', a = 0.04 + r() * 0.08;
    repetir((ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr); gr.addColorStop(0, `rgba(${t},${a})`); gr.addColorStop(1, `rgba(${t},0)`); g.fillStyle = gr; g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2); });
  }
  for (let n = 0; n < 5000; n++) { g.fillStyle = `rgba(40,42,44,${r() * 0.28})`; g.fillRect(r() * 512, r() * 512, 1 + r() * 1.6, 1 + r() * 1.6); }
  for (let n = 0; n < 900; n++) { g.fillStyle = `rgba(230,230,224,${r() * 0.18})`; g.fillRect(r() * 512, r() * 512, 1, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ---- piezas
const HORM = [0.92, 0.92, 0.9], ACERO = [0.36, 0.22, 0.15], TIERRA = [0.22, 0.17, 0.13], REMOVIDA = [0.36, 0.29, 0.22];
const MADERA = [0.62, 0.48, 0.32], CUERDA = [0.95, 0.42, 0.12], CAL = [0.93, 0.92, 0.86], ZAHORRA = [0.66, 0.62, 0.53];
// un prisma de planta P de y0 a y1: tapa (en abanico: son convexos) y costados
function prisma(L, P, y0, y1, col = HORM, tapa = true) {
  if (tapa) for (let k = 1; k + 1 < P.length; k++) {
    const a = P[0], b = P[k], c = P[k + 1];
    L.tri(V(a[0], y1, a[1]), V(b[0], y1, b[1]), V(c[0], y1, c[1]), ARRIBA, [a[0] / 4, a[1] / 4, b[0] / 4, b[1] / 4, c[0] / 4, c[1] / 4], col);
  }
  let u = 0;
  for (let k = 0; k < P.length; k++) {
    const a = P[k], b = P[(k + 1) % P.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [cx, cz] = centroide(P), mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz;
    let nx = b[1] - a[1], nz = -(b[0] - a[0]); if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
    const n = V(nx, 0, nz).normalize(), cs = col.map((v) => v * 0.9);
    L.quad(V(a[0], y0, a[1]), V(b[0], y0, b[1]), V(b[0], y1, b[1]), V(a[0], y1, a[1]), n, [u / 4, y0 / 4, (u + l) / 4, y0 / 4, (u + l) / 4, y1 / 4, u / 4, y1 / 4], cs);
    u += l;
  }
}
// una lamina a ras de suelo (tierra, cal, zahorra): cada vertice a `sobre` m del suelo de SU sitio (el suelo no es
// plano del todo: +-5 cm; con una cota sola, el suelo asomaba a manchas)
const cota = (x, z, sobre) => R.altura(x, z) + sobre;
function lamina(L, P, sobre, col) {
  for (let k = 1; k + 1 < P.length; k++) {
    const a = P[0], b = P[k], c = P[k + 1];
    L.tri(V(a[0], cota(a[0], a[1], sobre), a[1]), V(b[0], cota(b[0], b[1], sobre), b[1]), V(c[0], cota(c[0], c[1], sobre), c[1]), ARRIBA, [a[0] / 4, a[1] / 4, b[0] / 4, b[1] / 4, c[0] / 4, c[1] / 4], col);
  }
}
function banda(L, A, B, ancho, sobre, col) {
  const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * ancho / 2, nz = dx / l * ancho / 2;
  const n = Math.max(1, Math.ceil(l / 4));
  for (let q = 0; q < n; q++) {
    const f0 = q / n, f1 = (q + 1) / n, a = [A[0] + dx * f0, A[1] + dz * f0], b = [A[0] + dx * f1, A[1] + dz * f1];
    lamina(L, [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], sobre, col);
  }
}
// lo mas alto del suelo bajo una huella (sus vertices, los medios de sus lados y su centro)
function cotaMax(P) {
  let y = -Infinity;
  const [cx, cz] = centroide(P);
  y = Math.max(y, R.altura(cx, cz));
  for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length]; y = Math.max(y, R.altura(a[0], a[1]), R.altura((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)); }
  return y;
}
// una barra de acero vertical (cuatro caras) o tumbada de A a B (para las jaulas)
function barra(L, x, y0, z, alto, g = 0.016, col = ACERO) {
  const a = V(x - g, y0, z - g), b = V(x + g, y0, z - g), c = V(x + g, y0, z + g), d = V(x - g, y0, z + g), up = (p) => p.clone().setY(y0 + alto);
  L.quad(a, b, up(b), up(a), V(0, 0, -1), undefined, col); L.quad(b, c, up(c), up(b), V(1, 0, 0), undefined, col);
  L.quad(c, d, up(d), up(c), V(0, 0, 1), undefined, col); L.quad(d, a, up(a), up(d), V(-1, 0, 0), undefined, col);
}
function barraTumbada(L, A, B, y, g = 0.014, col = ACERO) {
  const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * g, nz = dx / l * g;
  const p = (P, s, h) => V(P[0] + nx * s, y + h, P[1] + nz * s);
  L.quad(p(A, -1, g), p(B, -1, g), p(B, 1, g), p(A, 1, g), ARRIBA, undefined, col);
  L.quad(p(A, 1, -g), p(B, 1, -g), p(B, 1, g), p(A, 1, g), V(nx, 0, nz).normalize(), undefined, col);
  L.quad(p(B, -1, -g), p(A, -1, -g), p(A, -1, g), p(B, -1, g), V(-nx, 0, -nz).normalize(), undefined, col);
}
function esperas(L, x, y, z, alto) {   // un grupo de cuatro barras (la armadura de un pilar o una esquina)
  for (const [a, b] of [[-0.12, -0.12], [0.12, -0.12], [0.12, 0.12], [-0.12, 0.12]]) barra(L, x + a, y - 0.05, z + b, alto + 0.05);
}

export function crearCimientos(grupo, cajas) {
  const raiz = new THREE.Group();
  raiz.name = 'cimientos';
  grupo.add(raiz);
  if (!CIUDAD) {
    console.warn('cimientos: falta web/datos/mundo/ciudad.json (correr diseno/planos/exportar_ciudad.py)');
    return { raiz, info: () => ({ cimientos: 'sin datos' }) };
  }
  // la obra va por TROZOS de 150 m (una malla por material y trozo: asi se recortan fuera de camara)
  const TROZO = 150, trozos = new Map();
  const lotes = (x, z) => {
    const k = Math.floor(x / TROZO) + ',' + Math.floor(z / TROZO);
    if (!trozos.has(k)) trozos.set(k, { horm: new Lote(), acero: new Lote(), tierra: new Lote(), madera: new Lote(), plano: new Lote() });
    return trozos.get(k);
  };
  const cuenta = { losa: 0, zanja: 0, replanteo: 0, curada: 0, arranques: 0, barras: 0 };

  // ---- una huella pequena (manzana o modulo) en su estado de obra
  function huellaPequena(P, manzana) {
    const [cx, cz] = centroide(P), y = cotaMax(encoger(P, -1.2)), L = lotes(cx, cz);
    const r = h01(cx, cz);
    const estado = r < 0.52 ? 'losa' : r < 0.74 ? 'zanja' : r < 0.88 ? 'replanteo' : 'curada';
    cuenta[estado]++;
    const Q = encoger(P, 0.35);
    if (estado === 'losa' || estado === 'curada') {
      prisma(L.horm, Q, y - 0.25, y + 0.18);
      marcar(Q, y + 0.18, 0.4);
      if (estado === 'losa') {
        const E = encoger(Q, 0.45);
        for (const [x, z] of E) { esperas(L.acero, x, y + 0.18, z, 1.0 + 0.5 * h01(x, z, 1)); cuenta.barras += 4; }
        if (manzana) {                   // pares por los lados, cada 3 m
          for (let k = 0; k < E.length; k++) {
            const a = E[k], b = E[(k + 1) % E.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(l / 3);
            for (let q = 1; q < n; q++) { const f = q / n, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; barra(L.acero, x - 0.08, y + 0.1, z, 0.9); barra(L.acero, x + 0.08, y + 0.1, z, 0.9); cuenta.barras += 2; }
          }
        }
      }
    } else if (estado === 'zanja') {
      // la tierra removida alrededor, la zanja corrida (oscura) con la jaula dentro, y el monton
      lamina(L.tierra, encoger(P, -1.2), 0.03, REMOVIDA);
      marcar(P, null, 1.2);
      const E = encoger(Q, 0.3);
      for (let k = 0; k < E.length; k++) {
        const a = E[k], b = E[(k + 1) % E.length];
        banda(L.tierra, a, b, 0.75, 0.045, TIERRA);
        barraTumbada(L.acero, a, b, y + 0.08); barraTumbada(L.acero, a, b, y + 0.32);
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.floor(l / 0.9));
        for (let q = 0; q < n; q++) { const f = q / n, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; barra(L.acero, x, y + 0.02, z, 0.36, 0.01); }
        cuenta.barras += n + 2;
      }
      // el monton de tierra, fuera de una esquina
      const [mx, mz] = encoger(P, -2.2)[Math.floor(h01(cx, cz, 2) * P.length)];
      const rr = 1.1 + h01(mx, mz) * 0.8, hh = 0.5 + h01(mz, mx) * 0.5, lados = 9;
      for (let q = 0; q < lados; q++) {
        const a0 = (q / lados) * Math.PI * 2, a1 = ((q + 1) / lados) * Math.PI * 2, w0 = 1 + 0.2 * Math.sin(q * 2.3), w1 = 1 + 0.2 * Math.sin((q + 1) * 2.3);
        const A = V(mx + Math.cos(a0) * rr * w0, y, mz + Math.sin(a0) * rr * w0), B = V(mx + Math.cos(a1) * rr * w1, y, mz + Math.sin(a1) * rr * w1), C = V(mx, y + hh, mz);
        const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)).normalize();
        if (n.y < 0) n.negate();
        L.tierra.tri(A, B, C, n, undefined, REMOVIDA);
      }
    } else {
      // replanteo: estacas en las esquinas, cuerda entre ellas a 40 cm y la linea de cal en el suelo
      const E = encoger(P, 0.2);
      for (let k = 0; k < E.length; k++) {
        const a = E[k], b = E[(k + 1) % E.length];
        barra(L.madera, a[0], y, a[1], 0.6, 0.025, MADERA);
        barraTumbada(L.madera, a, b, y + 0.4, 0.006, CUERDA);
        banda(L.plano, a, b, 0.08, 0.04, CAL);
      }
    }
  }
  CIUDAD.casco.forEach((P) => huellaPequena(P, true));
  // (donde van el macroedificio, macro.js, y las torres de refugio, torres.js, no hay modulos de El Panal)
  CIUDAD.panal.forEach(({ hex }) => { const [x, z] = centroide(hex); if (!reservado(x, z) && !reservadoTorres(x, z)) huellaPequena(hex, false); });

  // ---- los grandes: losa de cimentacion y arranques de pilares (con caja de choque)
  function arranque(L, x, y, z, w, d, alto) {
    prisma(L.horm, [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]], y - 0.1, y + alto);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) barra(L.acero, x + a * (w / 2 - 0.08), y + alto, z + b * (d / 2 - 0.08), 0.9, 0.018);
    cajas.push({ x, z, hx: w / 2, hz: d / 2, ang: 0 });
    cuenta.arranques++; cuenta.barras += 4;
  }
  function losaGrande(P, canto, rejilla) {
    const M = encoger(P, -1.5), [cx, cz] = centroide(P), y = cotaMax(M), L = lotes(cx, cz);
    prisma(L.horm, M, y - 0.3, y + canto);
    marcar(M, y + canto, 0.5);
    if (!rejilla) return;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const nx = Math.max(1, Math.round((x1 - x0 - 2) / rejilla)), nz = Math.max(1, Math.round((z1 - z0 - 2) / rejilla));
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const x = x0 + 1 + ((x1 - x0 - 2) * i) / nx, z = z0 + 1 + ((z1 - z0 - 2) * j) / nz;
      arranque(L, x, y + canto, z, 0.8, 0.8, 1.2 + 0.6 * h01(x, z, 3));
    }
  }
  CIUDAD.torres.forEach((t) => losaGrande(t.huella, 0.45, 7));
  CIUDAD.bloques.forEach((b) => losaGrande(b.huella, 0.4, 7.5));
  CIUDAD.edificios.forEach((e) => losaGrande(e.huella, 0.3, 8));
  CIUDAD.catedral.forEach((P) => {
    losaGrande(P, 0.3, 0);
    // el arranque de los muros: un murete de 0,8 m de grueso por el borde con esperas cada metro
    const [cx, cz] = centroide(P), y = cotaMax(encoger(P, -1.5)) + 0.3, L = lotes(cx, cz);
    for (let k = 0; k < P.length; k++) {
      const a = P[k], b = P[(k + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = -dz / l * 0.4, nz = dx / l * 0.4;
      prisma(L.horm, [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], y - 0.05, y + 0.7);
      for (let q = 0; q <= Math.floor(l); q++) { const f = q / Math.max(1, Math.floor(l)); barra(L.acero, a[0] + dx * f, y + 0.7, a[1] + dz * f, 0.8, 0.016); }
      cuenta.barras += Math.floor(l) + 1;
    }
  });
  // ---- el viaducto: un encepado por pila (con su caja) y el arranque de la pila
  for (const [x, z] of CIUDAD.viaducto.pilas) {
    const an = CIUDAD.viaducto.ancho, y = cotaMax([[x - 2.2, z - an / 2 - 1.2], [x + 2.2, z - an / 2 - 1.2], [x + 2.2, z + an / 2 + 1.2], [x - 2.2, z + an / 2 + 1.2]]), L = lotes(x, z);
    prisma(L.horm, [[x - 2.2, z - an / 2 - 1.2], [x + 2.2, z - an / 2 - 1.2], [x + 2.2, z + an / 2 + 1.2], [x - 2.2, z + an / 2 + 1.2]], y - 0.3, y + 0.8);
    cajas.push({ x, z, hx: 2.2, hz: an / 2 + 1.2, ang: 0 });
    marcar([[x - 2.2, z - an / 2 - 1.2], [x + 2.2, z - an / 2 - 1.2], [x + 2.2, z + an / 2 + 1.2], [x - 2.2, z + an / 2 + 1.2]], null, 0.6);
    arranque(L, x, y + 0.8, z, 1.8, an - 1.5, 2.2);
    cajas.pop();                         // la caja del arranque la cubre la del encepado
  }
  // ---- la plaza (una losa redonda con su bordillo) y las calles de zahorra
  {
    const [x, z] = CIUDAD.plaza.centro, r = CIUDAD.plaza.radio, L = lotes(x, z), n = 48;
    const C = Array.from({ length: n }, (_, k) => [x + Math.cos((k / n) * Math.PI * 2) * r, z + Math.sin((k / n) * Math.PI * 2) * r]);
    let y = cotaMax(C);
    for (let a = 0; a < r; a += 4) for (let b = 0; b < 24; b++) y = Math.max(y, R.altura(x + Math.cos(b / 24 * 6.283) * a, z + Math.sin(b / 24 * 6.283) * a));
    prisma(L.horm, C, y - 0.2, y + 0.12, [0.84, 0.82, 0.78]);
    marcar(C, y + 0.12, 0.3);
    for (let k = 0; k < n; k++) { const a = C[k], b = C[(k + 1) % n]; prisma(L.horm, [[a[0], a[1]], [b[0], b[1]], [b[0] + (b[0] - x) * 0.012, b[1] + (b[1] - z) * 0.012], [a[0] + (a[0] - x) * 0.012, a[1] + (a[1] - z) * 0.012]], y, y + 0.18); }
  }
  const calle = (pts, ancho) => {
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1];
      for (let s = 0; s < 1; s += 0.25) {    // en trozos de su largo, cada uno a su trozo de malla
        const A = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s], B = [a[0] + (b[0] - a[0]) * (s + 0.25), a[1] + (b[1] - a[1]) * (s + 0.25)];
        banda(lotes(A[0], A[1]).plano, A, B, ancho, 0.06, ZAHORRA);
      }
      marcarBanda(a, b, ancho);
    }
  };
  for (const [nombre, pts] of Object.entries(CIUDAD.calles)) calle(pts, nombre === 'Avenida Mayor' ? 14 : 9);
  calle(CIUDAD.rondaCasco, 8);
  {
    const n = 160, r = CIUDAD.ronda, pts = Array.from({ length: n + 1 }, (_, k) => [CX + Math.cos((k / n) * Math.PI * 2) * r, CZ + Math.sin((k / n) * Math.PI * 2) * r]);
    calle(pts, 10);
  }

  OBRA_HIERBA.ocupado = ocupado;        // la hierba (sitios.cubierta) no crece en la obra

  // ---- mallas
  const tHorm = texturaHormigon();
  const mats = {
    horm: new THREE.MeshToonMaterial({ map: tHorm, vertexColors: true, gradientMap: TONO }),
    acero: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: TONO }),
    tierra: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: TONO, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    madera: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: TONO }),
    plano: new THREE.MeshToonMaterial({ map: tHorm, vertexColors: true, gradientMap: TONO, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  };
  let tris = 0;
  for (const t of trozos.values()) {
    for (const [k, L] of Object.entries(t)) {
      if (!L.i.length) continue;
      const m = new THREE.Mesh(L.geometria(), mats[k]);
      m.receiveShadow = true;
      m.castShadow = k === 'horm' || k === 'acero';
      raiz.add(m);
      tris += L.i.length / 3;
    }
  }
  return { raiz, info: () => ({ cimientos: { ...cuenta, trozos: trozos.size, tris, manzanas: CIUDAD.casco.length, modulos: CIUDAD.panal.length } }) };
}
