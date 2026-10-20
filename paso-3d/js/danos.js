// LOS DANOS DEL MURO CON VOLUMEN. Antes eran dibujos en la textura de los paneles: rayas oscuras por grietas y un borron
// con el borde claro por desconchon, y de cerca parecian un garabato o una foto pegada (el usuario). Ahora:
//  - un panel AGRIETADO no es una caja: es la placa PARTIDA en trozos por sus grietas. Cada trozo se extruye entero (su
//    cara y las paredes de rotura, que bajan oscureciendose hasta el fondo de la junta), va un poco hundido o ladeado
//    respecto a los otros y deja entre ellos el hueco de la grieta, mas ancho en unos sitios, con los cantos saltados; de
//    las grietas salen ramas que acaban en punta dentro del trozo;
//  - un DESCONCHON es un agujero de verdad en el trozo con su FONDO de rotura: somero en el borde, hondo en el centro, en
//    escalones (el hormigon salta en conchas) y con el arido; la FERRALLA va dentro a 2-3 cm de la cara, medio enterrada
//    donde el fondo sube, y de el salen grietas en estrella;
//  - un DESCANTILLADO es una esquina o un canto del panel comido, con la rotura en rampa hacia la junta;
//  - un REMIENDO es una placa de mortero 3 mm por encima de la cara.
// La SUCIEDAD va donde la pone el dano: humedad oscura a los dos lados de cada grieta (una cinta con alfa que se pega a la
// cara de su trozo), eflorescencia blanca que baja de las grietas y oxido que chorrea de la ferralla (manchas de muro.js).
//
// Todo se calcula en el plano del panel: u (m) hacia -z desde su borde, v (m) hacia arriba, w (m) la profundidad desde la
// cara de atras (la cara buena esta en w = 0,05, el fondo de la junta en w = 0,01).
import * as THREE from 'three';

const CARA = 0.05, FONDO = 0.01;
const LUZ = [-0.5, 0.866];          // de donde viene la luz en el plano del panel (u, v): el sol esta arriba y hacia +z
// lo que lleva cada clase de panel danado: [minimo, maximo] de grietas pasantes, ramas y descantillados, y si lleva
// desconchon
const CLASES = {
  grietas: { pasantes: [1, 2], ramas: [2, 5], cantos: [0, 1], desconchon: false },
  ferralla: { pasantes: [0, 1], ramas: [0, 2], cantos: [0, 1], desconchon: true },
  golpe: { pasantes: [0, 0], ramas: [0, 0], cantos: [0, 1], desconchon: true },
  canto: { pasantes: [0, 0], ramas: [0, 1], cantos: [1, 3], desconchon: false },
  remiendo: { pasantes: [0, 0], ramas: [0, 0], cantos: [0, 0], desconchon: false },
};

// ------------------------------------------------------------- geometria 2D (puntos [u, v])
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const suma = (a, b) => [a[0] + b[0], a[1] + b[1]];
const esc = (a, s) => [a[0] * s, a[1] * s];
const largo = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => { const l = largo(a) || 1; return [a[0] / l, a[1] / l]; };
const girar = (a, t) => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];
function area(P) { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function dentro(P, p) {
  let d = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) d = !d;
  }
  return d;
}
function distSeg(p, a, b) {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (ab[0] * ab[0] + ab[1] * ab[1] || 1)));
  return largo(sub(p, suma(a, esc(ab, t))));
}
function distBorde(P, p) { let m = Infinity; for (let i = 0; i < P.length; i++) m = Math.min(m, distSeg(p, P[i], P[(i + 1) % P.length])); return m; }
function cruce(a, b, c, d) {
  const r = sub(b, a), s = sub(d, c), den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-12) return null;
  const q = sub(c, a), t = (q[0] * s[1] - q[1] * s[0]) / den, u = (q[0] * r[1] - q[1] * r[0]) / den;
  return t >= 0 && t < 1 && u >= 0 && u < 1 ? { t, u } : null;
}
const ccw = (P) => (area(P) < 0 ? P.slice().reverse() : P);
const cw = (P) => (area(P) > 0 ? P.slice().reverse() : P);

// PARTIR el poligono P (CCW) por la polilinea abierta N, que ha de cortar su borde EXACTAMENTE dos veces. Devuelve los
// dos trozos [A, B]: si N empieza fuera de P, A queda a la DERECHA de N y B a la izquierda (los dos CCW). Si cruza otra
// cantidad de veces, null (el que llama lo deja estar)
function partir(P, N) {
  const X = [], n = P.length;
  for (let i = 0; i < N.length - 1; i++) for (let j = 0; j < n; j++) {
    const c = cruce(N[i], N[i + 1], P[j], P[(j + 1) % n]);
    if (c) X.push({ i, t: c.t, j, s: c.u, p: suma(N[i], esc(sub(N[i + 1], N[i]), c.t)) });
  }
  if (X.length !== 2) return null;
  X.sort((a, b) => a.i + a.t - (b.i + b.t));
  const [x1, x2] = X;
  const arco = (a, b) => {
    const o = [a.p];
    if (a.j === b.j && b.s > a.s) { o.push(b.p); return o; }
    for (let j = (a.j + 1) % n; ; j = (j + 1) % n) { o.push(P[j]); if (j === b.j) break; }
    o.push(b.p);
    return o;
  };
  const tramo = N.slice(x1.i + 1, x2.i + 1);
  return [[...arco(x1, x2), ...tramo.slice().reverse()], [...arco(x2, x1), ...tramo]];
}

// una grieta: camino quebrado de a hacia b (o, sin b, en la direccion dir durante l), con pasos de 2-4 cm que rodean el
// arido: el rumbo se mantiene, tira hacia el destino y cada paso se tuerce hasta +-0,4 rad
function camino(r, a, b, dir, l, paso = 0.03) {
  const pts = [a];
  let p = a, d = b ? unit(sub(b, a)) : unit(dir), hecho = 0;
  for (let k = 0; k < 600; k++) {
    let quiere = d;
    if (b) {
      const hacia = sub(b, p), dist = largo(hacia);
      if (dist < paso * 1.4) { pts.push(b); break; }
      quiere = esc(hacia, 1 / dist);
      d = unit(suma(esc(d, 1 - (0.16 + 0.6 * Math.max(0, 1 - dist / 0.5))), esc(quiere, 0.16 + 0.6 * Math.max(0, 1 - dist / 0.5))));
    } else {
      if (hecho >= l) break;
      d = unit(suma(esc(d, 0.9), esc(unit(dir), 0.1)));
    }
    d = girar(d, (r() - 0.5) * 0.8);
    const s = paso * (0.6 + 0.8 * r());
    p = suma(p, esc(d, s));
    hecho += s;
    pts.push(p);
  }
  return pts;
}
// los dos labios de una grieta: el centro desplazado a izquierda y derecha la mitad de su ancho (cada labio el suyo)
function labios(C, wl, wr) {
  const L = [], R = [];
  for (let i = 0; i < C.length; i++) {
    const t = unit(sub(C[Math.min(i + 1, C.length - 1)], C[Math.max(i - 1, 0)])), nn = [-t[1], t[0]];
    L.push(suma(C[i], esc(nn, wl[i] / 2))); R.push(suma(C[i], esc(nn, -wr[i] / 2)));
  }
  return [L, R];
}
// ancho a lo largo: ondula suave y salta en los cantos rotos (un labio se come unos milimetros en 3-5 pasos)
function anchos(r, n, w0, w1, punta) {
  const f1 = r() * 6, f2 = r() * 6, k1 = 2 + r() * 3, k2 = 7 + r() * 6;
  const wl = [], wr = [];
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    let w = w0 + (w1 - w0) * t;
    w *= 0.62 + 0.24 * Math.sin(t * k1 + f1) + 0.14 * Math.sin(t * k2 + f2);
    if (punta) w *= Math.pow(1 - t, 0.9);
    wl.push(Math.max(punta && i === n - 1 ? 0 : 0.0016, w)); wr.push(wl[i]);
  }
  for (let c = 0, nc = Math.floor(n / 14 * r()); c < nc; c++) {
    const i0 = 1 + Math.floor(r() * (n - 4)), lado = r() < 0.5 ? wl : wr, m = 0.003 + 0.008 * r(), anch = 2 + Math.floor(r() * 3);
    for (let k = -anch; k <= anch; k++) { const i = i0 + k; if (i > 0 && i < n - 1) lado[i] += m * (1 - Math.abs(k) / (anch + 1)); }
  }
  return [wl, wr];
}
// una MUESCA (grieta que acaba en punta) como polilinea cerrada en U: por un labio hasta la punta y vuelta por el otro
function muesca(C, wl, wr) { const [L, R] = labios(C, wl, wr); return [...L, ...R.slice(0, -1).reverse()]; }

// el ARIDO de una rotura de hormigon: mortero con arena y poros y cantos rodados de 2 a 14 mm partidos (1,7 px por mm en
// una baldosa de 30 cm que se repite), cada canto con su luz arriba a la izquierda; y su altura para el relieve
function texturaArido() {
  const N = 512, cv = document.createElement('canvas'), ca = document.createElement('canvas');
  cv.width = cv.height = ca.width = ca.height = N;
  const c = cv.getContext('2d'), h = ca.getContext('2d');
  let sem = 911; const r = () => ((sem = (Math.imul(sem, 1664525) + 1013904223) >>> 0) / 4294967296);
  c.fillStyle = '#d6d3cc'; c.fillRect(0, 0, N, N);
  h.fillStyle = '#6e6e6e'; h.fillRect(0, 0, N, N);
  const copias = (fn) => { for (const [dx, dy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N], [N, N], [-N, -N], [N, -N], [-N, N]]) fn(dx, dy); };
  for (let i = 0; i < 9000; i++) {
    const x = r() * N, y = r() * N, claro = r() < 0.5, a = 0.12 + 0.25 * r(), w = 1 + r() * 1.6;
    c.fillStyle = claro ? `rgba(246,244,238,${a})` : `rgba(96,94,90,${a})`; c.fillRect(x, y, w, w);
    h.fillStyle = claro ? 'rgba(170,170,170,.35)' : 'rgba(60,60,60,.35)'; h.fillRect(x, y, w, w);
  }
  const tonos = ['#b4b0a7', '#9c988f', '#c4bdb0', '#878379', '#d2cec4', '#a69a8a', '#7b7871'];
  for (let i = 0; i < 230; i++) {
    const R = (2 + 12 * r() ** 1.8) * 1.7, x = r() * N, y = r() * N, lados = 7 + Math.floor(r() * 5), rot = r() * 6, el = 0.6 + 0.4 * r();
    const pts = [];
    for (let k = 0; k < lados; k++) {
      const an = k / lados * Math.PI * 2, rr = R * (0.8 + 0.3 * r()), px = Math.cos(an) * rr, py = Math.sin(an) * rr * el;
      pts.push([px * Math.cos(rot) - py * Math.sin(rot), px * Math.sin(rot) + py * Math.cos(rot)]);
    }
    const col = tonos[Math.floor(r() * tonos.length)], alto = 120 + Math.floor(r() * 120);
    const forma = (ctx, dx, dy, ox = 0, oy = 0, sc = 1) => { ctx.beginPath(); pts.forEach(([px, py], k) => ctx[k ? 'lineTo' : 'moveTo'](x + dx + ox + px * sc, y + dy + oy + py * sc)); ctx.closePath(); };
    copias((dx, dy) => {
      forma(c, dx, dy, R * 0.1, R * 0.12, 1.03); c.fillStyle = 'rgba(48,48,46,.38)'; c.fill();         // su sombra
      forma(c, dx, dy); c.fillStyle = col; c.fill();
      forma(c, dx, dy, -R * 0.18, -R * 0.2, 0.55); c.fillStyle = 'rgba(255,255,250,.22)'; c.fill();     // su luz
      forma(h, dx, dy); h.fillStyle = `rgb(${alto},${alto},${alto})`; h.fill();
      forma(h, dx, dy, -R * 0.1, -R * 0.1, 0.6); h.fillStyle = `rgba(255,255,255,.25)`; h.fill();
    });
  }
  for (let i = 0; i < 220; i++) {
    const x = r() * N, y = r() * N, rr = 0.5 + 1.4 * r() ** 2;
    copias((dx, dy) => {
      c.fillStyle = 'rgba(38,38,36,.6)'; c.beginPath(); c.arc(x + dx, y + dy, rr, 0, 7); c.fill();
      h.fillStyle = '#202020'; h.beginPath(); h.arc(x + dx, y + dy, rr, 0, 7); h.fill();
    });
  }
  const mapa = new THREE.CanvasTexture(cv), relieve = new THREE.CanvasTexture(ca);
  mapa.colorSpace = THREE.SRGBColorSpace;
  for (const t of [mapa, relieve]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return { mapa, relieve };
}

// ------------------------------------------------------------- el constructor de los danos de todo el muro
// mapa(u, v, w) -> [x, y, z]; uvDe(u, v) -> [s, t]: los pone muro.js para cada panel
export function crearDanos() {
  const P = { pos: [], nor: [], uv: [], col: [] };                                   // placas (al lote de paneles)
  const F = { pos: [], col: [], uv: [], idx: [] };                                    // fondos de rotura
  const Hh = { pos: [], col: [] };                                                    // humedad junto a las grietas
  const Gn = [];                                                                      // el fondo negro de cada grieta
  const barras = [], manchas = { blanca: [], oxido: [], humeda: [] }, huecos = [];
  const cuenta = { paneles: 0, grietas: 0, ramas: 0, lajas: 0, desconchones: 0, descantillados: 0, remiendos: 0 };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();

  // pared = true: la luz viene de arriba, asi que la pared de rotura que mira arriba (el labio de abajo) se ve clara y la
  // que mira abajo, oscura; es lo que hace leer el canto como un escalon y no como una raya
  function tri(m, uvDe, col, p0, p1, p2, c0, c1, c2, pared = false) {
    const q = [m(...p0), m(...p1), m(...p2)];
    a.fromArray(q[0]); b.fromArray(q[1]); c.fromArray(q[2]);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    if (pared) { const k = Math.min(1.25, Math.max(0.3, 0.72 + 0.55 * n.y + 0.12 * n.z)); c0 *= k; c1 *= k; c2 *= k; }
    for (let k = 0; k < 3; k++) {
      P.pos.push(...q[k]); P.nor.push(n.x, n.y, n.z);
      P.uv.push(...uvDe([p0, p1, p2][k][0], [p0, p1, p2][k][1]));
      const cc = [c0, c1, c2][k]; P.col.push(col.r * cc, col.g * cc, col.b * cc);
    }
  }
  // un TROZO extruido: su cara (con sus agujeros) a la altura frente(u, v) y las paredes de todos sus bordes hasta el
  // fondo de la junta, de claro arriba a casi negro abajo
  function extruir(t, m, uvDe, col) {
    const Pe = ccw(t.P), hs = t.huecos.map(cw);
    const todos = [Pe, ...hs].flat();
    const caras = THREE.ShapeUtils.triangulateShape(Pe.map((p) => new THREE.Vector2(p[0], p[1])), hs.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1]))));
    const W = (p) => [p[0], p[1], t.frente(p[0], p[1])];
    for (const [i, j, k] of caras) {
      let p0 = todos[i], p1 = todos[j], p2 = todos[k];
      if ((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]) < 0) [p1, p2] = [p2, p1];
      tri(m, uvDe, col, W(p0), W(p1), W(p2), 1, 1, 1);
    }
    for (const L of [Pe, ...hs]) for (let i = 0; i < L.length; i++) {
      const p = L[i], q = L[(i + 1) % L.length];
      const pf = W(p), qf = W(q), pb = [p[0], p[1], FONDO], qb = [q[0], q[1], FONDO];
      tri(m, uvDe, col, pf, qb, qf, 0.8, 0.14, 0.8, true);
      tri(m, uvDe, col, pf, pb, qb, 0.8, 0.14, 0.14, true);
    }
  }
  // un FONDO de rotura: abanico desde el centro o, en un canto, desde el borde (anillos hasta el contorno). prof(f, i)
  // da la hondura (m bajo la cara de su trozo, frente) en el anillo f (0 centro, 1 contorno) y el rayo i; tono el color
  // por vertice. UV en metros / 0,3: la baldosa del arido
  const TEJA = 0.3;
  function abanico(m, centro, contorno, prof, tono, rectos, frente = () => CARA, ANI = 9) {
    const base = F.pos.length / 3, nr = contorno.length;
    const vert = [];
    for (let k = 0; k <= ANI; k++) {
      const f = k / ANI;
      for (let i = 0; i < (k === 0 ? 1 : nr); i++) {
        const q = k === 0 ? centro : suma(centro, esc(sub(contorno[i], centro), f));
        const d = prof(f, k === 0 ? 0 : i, q);
        F.pos.push(...m(q[0], q[1], frente(q[0], q[1]) - d)); F.uv.push(q[0] / TEJA, q[1] / TEJA);
        const cc = tono(f, d, q); F.col.push(cc.r, cc.g, cc.b);
        vert.push(q);
      }
    }
    const id = (k, i) => (k === 0 ? base : base + 1 + (k - 1) * nr + ((i + nr) % nr));
    const cerrado = !rectos;
    for (let i = 0; i < (cerrado ? nr : nr - 1); i++) F.idx.push(id(0, 0), id(1, i), id(1, i + 1));
    for (let k = 1; k < ANI; k++) for (let i = 0; i < (cerrado ? nr : nr - 1); i++) {
      const a0 = id(k, i), a1 = id(k, i + 1), b0 = id(k + 1, i), b1 = id(k + 1, i + 1);
      F.idx.push(a0, b0, b1, a0, b1, a1);
    }
    // en un canto: los dos rayos de los extremos van por el borde del panel y de ellos cuelga una pared hasta la junta
    if (rectos) for (const i of [0, nr - 1]) {
      for (let k = 0; k < ANI; k++) {
        const p = vert[k === 0 ? 0 : 1 + (k - 1) * nr + i], q = vert[1 + k * nr + i];
        const v0 = F.pos.length / 3;
        const dp = prof(k / ANI, i, p), dq = prof((k + 1) / ANI, i, q);
        for (const [pp, w, cc] of [[p, frente(...p) - dp, 0.5], [q, frente(...q) - dq, 0.5], [q, FONDO, 0.12], [p, FONDO, 0.12]]) {
          F.pos.push(...m(pp[0], pp[1], w)); F.col.push(0.2 * cc, 0.21 * cc, 0.22 * cc); F.uv.push(pp[0] / TEJA, (pp[1] + w) / TEJA);
        }
        if (i === 0) F.idx.push(v0, v0 + 2, v0 + 1, v0, v0 + 3, v0 + 2); else F.idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
      }
    }
  }
  // HUMEDAD a un lado de un labio: cinta de 1-3 cm pegada a la cara de su trozo, oscura en el labio y a nada por fuera
  function humedad(m, trozos, L, lado, r) {
    let prev = null;
    for (let i = 0; i < L.length; i++) {
      const t = unit(sub(L[Math.min(i + 1, L.length - 1)], L[Math.max(i - 1, 0)])), nn = esc([-t[1], t[0]], lado);
      const ancho = 0.015 + 0.03 * (0.5 + 0.5 * Math.sin(i * 0.37 + lado)) * (0.6 + 0.4 * r());
      const pi = suma(L[i], esc(nn, 0.0015)), po = suma(L[i], esc(nn, ancho));
      const tz = trozos.find((z) => dentro(z.P, suma(L[i], esc(nn, 0.004))) && !z.huecos.some((h) => dentro(h, pi)));
      const cur = tz ? [m(pi[0], pi[1], tz.frente(...pi) + 0.0008), m(po[0], po[1], tz.frente(...po) + 0.0008)] : null;
      if (prev && cur) {
        for (const [q, al] of [[prev[0], 0.55], [prev[1], 0], [cur[1], 0], [prev[0], 0.55], [cur[1], 0], [cur[0], 0.55]]) { Hh.pos.push(...q); Hh.col.push(0.012, 0.015, 0.018, al); }
      }
      prev = cur;
    }
  }

  // el FONDO de una grieta (entre sus dos labios, en el fondo de la junta): casi negro, sin luz, que la luz no entra
  function fondoGrieta(m, L, R) {
    for (let i = 0; i < L.length - 1; i++) {
      const q = [L[i], R[i], R[i + 1], L[i + 1]].map((p) => m(p[0], p[1], FONDO + 0.0012));
      Gn.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    }
  }

  // ---------------------------------------------------------- un panel danado
  // o: { r, ancho, alto (m del panel, sin junta), m, uvDe, col (tinte), aMundo(u, v) -> [z, y], tipo, desconchon?,
  //      remiendo? }. Devuelve false si no ha podido (el que llama pone la caja de siempre)
  function panel(o) {
    const { r, m, uvDe, col } = o, e = 0.02, U0 = e, U1 = o.ancho - e, V0 = e, V1 = o.alto - e;
    const K = CLASES[o.tipo], entre = ([a0, a1]) => a0 + Math.floor(r() * (a1 - a0 + 1));
    const evitar = o.evitar || [];
    const rect = [[U0, V0], [U1, V0], [U1, V1], [U0, V1]];
    const plano = (s0, au, av, uc, vc) => (u, v) => CARA - s0 - au * (u - uc) - av * (v - vc);
    let trozos = [{ P: rect, huecos: [], frente: plano(0.0004, 0, 0, 0, 0) }];
    const lineas = [];                                                              // [labio, lado] para la humedad
    const conLabios = [];                                                           // {C, L, R}: donde saltan lajas
    const centros = [];                                                             // los centros de las grietas (sitios de mancha)
    const enBorde = (lado, t) => [[U0 + (U1 - U0) * t, V0], [U1, V0 + (V1 - V0) * t], [U0 + (U1 - U0) * t, V1], [U0, V0 + (V1 - V0) * t]][lado];
    const fuera = (lado) => [[0, -1], [1, 0], [0, 1], [-1, 0]][lado];

    // GRIETAS PASANTES de un borde a otro del panel
    const pasantes = entre(K.pasantes);
    const usadas = [];
    for (let g = 0; g < pasantes; g++) {
      let A, B, la, lb;
      for (let intento = 0; intento < 6; intento++) {
        la = g === 0 ? 2 : Math.floor(r() * 4); lb = (la + 1 + Math.floor(r() * 3)) % 4;
        A = enBorde(la, 0.15 + 0.7 * r()); B = enBorde(lb, 0.15 + 0.7 * r());
        if (largo(sub(A, B)) > 0.9 && !usadas.some((u) => largo(sub(u, A)) < 0.5 || largo(sub(u, B)) < 0.5)) break;
      }
      const a0 = suma(A, esc(fuera(la), -0.02)), b0 = suma(B, esc(fuera(lb), -0.02));
      let C = camino(r, a0, b0, null, 0, 0.032);
      // que no cruce a otra pasante
      if (lineas.some(([L]) => { for (let i = 0; i < C.length - 1; i++) for (let j = 0; j < L.length - 1; j++) if (cruce(C[i], C[i + 1], L[j], L[j + 1])) return true; return false; })) continue;
      C = [suma(A, esc(fuera(la), 0.06)), ...C, suma(B, esc(fuera(lb), 0.06))];
      const [wl, wr] = anchos(r, C.length, 0.009 + 0.012 * r(), 0.006 + 0.009 * r(), false);
      const [L, R] = labios(C, wl, wr);
      const nuevos = [];
      for (const t of trozos) {
        const sL = partir(ccw(t.P), L), sR = partir(ccw(t.P), R);
        if (!sL && !sR) { nuevos.push(t); continue; }
        if (sL) nuevos.push({ P: sL[1], huecos: [] });
        if (sR) nuevos.push({ P: sR[0], huecos: [] });
      }
      if (nuevos.length === trozos.length) continue;
      trozos = nuevos;
      usadas.push(A, B);
      lineas.push([L, 1], [R, -1]);
      fondoGrieta(m, L, R);
      centros.push(C);
      conLabios.push({ C, L, R, cada: [3, 8] });
      cuenta.grietas++;
    }
    // cada trozo, un poco hundido y ladeado (el mayor se queda en su sitio)
    trozos.sort((p, q) => Math.abs(area(q.P)) - Math.abs(area(p.P)));
    trozos.forEach((t, i) => {
      if (i === 0 && !t.frente) t.frente = plano(0.0004, 0, 0, 0, 0);
      if (i > 0) {
        let cu = 0, cv = 0; for (const p of t.P) { cu += p[0]; cv += p[1]; }
        cu /= t.P.length; cv /= t.P.length;
        const au = (r() - 0.5) * 0.006, av = (r() - 0.5) * 0.006;
        let alto = -Infinity; for (const p of t.P) alto = Math.max(alto, -au * (p[0] - cu) - av * (p[1] - cv));
        t.frente = plano(0.002 + 0.006 * r() + Math.max(0, alto), au, av, cu, cv);
      }
    });

    // RAMAS: muescas que salen de las grietas pasantes (o de un borde del panel) y acaban en punta dentro de un trozo
    const nRamas = entre(K.ramas);
    for (let k = 0; k < nRamas; k++) {
      let S, dir, w0;
      if (centros.length && r() < 0.8) {
        const C = centros[Math.floor(r() * centros.length)], i = 3 + Math.floor(r() * (C.length - 6));
        const t = unit(sub(C[i + 1], C[i - 1]));
        S = C[i]; dir = girar(t, (r() < 0.5 ? 1 : -1) * (0.45 + 0.7 * r())); w0 = 0.006 + 0.005 * r();
      } else {
        const lado = Math.floor(r() * 4);
        S = suma(enBorde(lado, 0.15 + 0.7 * r()), esc(fuera(lado), 0.03)); dir = girar(esc(fuera(lado), -1), (r() - 0.5) * 0.9); w0 = 0.005 + 0.005 * r();
      }
      let l = 0.15 + 0.6 * r();
      for (let intento = 0; intento < 4; intento++, l *= 0.6) {
        const C = camino(r, S, null, dir, l, 0.026);
        if (C.length < 4) break;
        const [wl, wr] = anchos(r, C.length, w0, w0 * 0.4, true);
        const N = muesca(C, wl, wr);
        let hecho = false;
        trozos = trozos.map((t) => {
          if (hecho) return t;
          if (C.slice(3).some((p) => !dentro(t.P, p) || distBorde(t.P, p) < 0.015)) return t;
          const s = partir(ccw(t.P), N);
          if (!s) return t;
          hecho = true;
          return { ...t, P: Math.abs(area(s[0])) > Math.abs(area(s[1])) ? s[0] : s[1] };
        });
        if (hecho) { const [L, R] = labios(C, wl, wr); lineas.push([L, 1], [R, -1]); fondoGrieta(m, L, R); centros.push(C); conLabios.push({ C: C.slice(0, Math.floor(C.length * 0.6)), L, R, cada: [6, 12] }); cuenta.ramas++; break; }
      }
    }

    // LABIOS SALTADOS: a lo largo de cada grieta el canto se rompe en LAJAS (un mordisco de 1-3 cm en un labio con su
    // fondo en rampa hasta la grieta). Es lo que hace que una grieta se lea como rotura y no como una raya
    const frescoL = new THREE.Color('#7b7a76'), oscL = new THREE.Color('#383938');
    // (lejos, a mas de 30 m de la base, ni lajas ni humedad ni fondos finos: no se verian y costarian)
    for (const g of o.cerca === false ? [] : conLabios) {
      const { C, L, R } = g;
      for (let i = 3; i < C.length - 4; i += g.cada[0] + Math.floor(r() * (g.cada[1] - g.cada[0]))) {
        const izq = r() < 0.5, lip = izq ? L : R;
        if (i >= lip.length) break;
        const t = unit(sub(C[i + 1], C[i - 1])), ang = Math.atan2(t[1], t[0]);
        const th0 = izq ? ang : ang + Math.PI, th1 = th0 + Math.PI;
        const R0 = 0.012 + 0.022 * r() * r() + 0.008 * r(), NR = 9, cont = [], fa = r() * 6, centro = lip[i];
        for (let j = 0; j < NR; j++) {
          const th = th0 + (th1 - th0) * j / (NR - 1);
          const kk = (j === 0 || j === NR - 1 ? 0.8 : 1) * (1 + 0.3 * Math.sin((th - th0) * 3 + fa) + (r() - 0.5) * 0.3);
          cont.push(suma(centro, [Math.cos(th) * R0 * kk, Math.sin(th) * R0 * kk]));
        }
        const k = 1 + Math.ceil(R0 / 0.028);
        if (i - k < 0 || i + k >= C.length) continue;
        const N = izq ? [C[i + k], ...cont.slice(1, -1), C[i - k]] : [C[i - k], ...cont.slice(1, -1), C[i + k]];
        let host = null;
        trozos = trozos.map((tz) => {
          if (host || !dentro(tz.P, cont[Math.floor(NR / 2)])) return tz;
          const sp = partir(ccw(tz.P), N);
          if (!sp) return tz;
          host = { ...tz, P: Math.abs(area(sp[0])) > Math.abs(area(sp[1])) ? sp[0] : sp[1] };
          return host;
        });
        if (!host) continue;
        const dC = 0.005 + 0.01 * r();
        abanico(m, centro, cont, (f) => 0.0018 + (dC - 0.0018) * Math.pow(1 - f, 1.2), (f) => frescoL.clone().lerp(oscL, (1 - f) * 0.55), true, host.frente, 4);
        cuenta.lajas++;
      }
    }

    // DESCONCHON: agujero con fondo, ferralla y grietas en estrella
    const descs = o.desconchon ? [o.desconchon] : K.desconchon ? [null] : [];
    for (const dsp of descs) {
      const elong = o.tipo === 'ferralla' ? 1.6 + r() * 0.9 : 1.0 + r() * 0.35;
      let Ru = dsp ? dsp.R : 0.12 + 0.2 * r(), Rv = Ru / elong;
      const marg = 0.06;
      if (U1 - U0 < 2 * (marg + Ru * 1.25) || V1 - V0 < 2 * (marg + Rv * 1.25)) continue;
      // donde no lo tape un rotulo, una rejilla o un cinturon (lo que hay delante de la cara, en `evitar`)
      let cu, cv, libre = false;
      for (let intento = 0; intento < 8 && !libre; intento++) {
        cu = dsp ? dsp.u : U0 + marg + Ru + r() * Math.max(0, U1 - U0 - 2 * (marg + Ru));
        cv = dsp ? dsp.v : V0 + marg + Rv + r() * Math.max(0, V1 - V0 - 2 * (marg + Rv));
        cu = Math.min(U1 - marg - Ru * 1.25, Math.max(U0 + marg + Ru * 1.25, cu)); cv = Math.min(V1 - marg - Rv * 1.25, Math.max(V0 + marg + Rv * 1.25, cv));
        libre = !!dsp || !evitar.some(([a0, a1, b0, b1]) => cu + Ru * 1.3 > a0 && cu - Ru * 1.3 < a1 && cv + Rv * 1.3 > b0 && cv - Rv * 1.3 < b1);
      }
      if (!libre) continue;
      const NR = o.cerca === false ? 28 : 44, f1 = r() * 6, f2 = r() * 6, contorno = [];
      for (let i = 0; i < NR; i++) {
        const th = i / NR * Math.PI * 2;
        const k = 1 + 0.18 * Math.sin(th * 3 + f1) + 0.1 * Math.sin(th * 7 + f2) + (r() - 0.5) * 0.16;
        contorno.push([cu + Math.cos(th) * Ru * k, cv + Math.sin(th) * Rv * k]);
      }
      const tz = trozos.find((t) => contorno.every((p) => dentro(t.P, p) && distBorde(t.P, p) > 0.025) && !t.huecos.length);
      if (!tz) continue;
      // grietas en estrella desde el agujero (se unen a el)
      let hueco = ccw(contorno);
      const estrella = o.tipo === 'golpe' ? 4 + Math.floor(r() * 4) : 1 + Math.floor(r() * 2);
      for (let k = 0; k < estrella; k++) {
        const th = o.tipo === 'ferralla' ? (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.5 : k / estrella * Math.PI * 2 + (r() - 0.5) * 0.7;
        const dir = [Math.cos(th), Math.sin(th)], S = [cu + dir[0] * Ru * 0.6, cv + dir[1] * Rv * 0.6];
        let l = (o.tipo === 'ferralla' ? 0.4 + 0.9 * r() : 0.12 + 0.45 * r()) + Ru * 0.4;
        for (let intento = 0; intento < 4; intento++, l *= 0.65) {
          const C = camino(r, S, null, dir, l, 0.024);
          if (C.slice(3).some((p) => !dentro(tz.P, p) || distBorde(tz.P, p) < 0.03)) continue;
          const [wl, wr] = anchos(r, C.length, 0.008 + 0.006 * r(), 0.003, true);
          const s = partir(ccw(hueco), muesca(C, wl, wr));
          if (!s) continue;
          hueco = Math.abs(area(s[0])) > Math.abs(area(s[1])) ? s[0] : s[1];
          const [L, R] = labios(C, wl, wr);
          lineas.push([L.slice(4), 1], [R.slice(4), -1]); fondoGrieta(m, L, R); centros.push(C.slice(4));
          cuenta.ramas++;
          break;
        }
      }
      tz.huecos.push(hueco);
      // el fondo: somero en el contorno, hondo en el centro, en dos conchas, con el arido
      const dRim = 0.008 + 0.006 * r(), dMax = 0.026 + 0.01 * r(), concha = 0.5 + 0.2 * r(), fc = r() * 6;
      const arido = [];
      for (let i = 0; i < 70; i++) arido.push([cu + (r() * 2 - 1) * Ru, cv + (r() * 2 - 1) * Rv, 0.004 + 0.01 * r(), r()]);
      const filas = [];
      for (let vv = cv - Rv * 0.75; vv < cv + Rv * 0.8; vv += 0.15) filas.push(vv + (r() - 0.5) * 0.03);
      if (!filas.length) filas.push(cv + (r() - 0.5) * Rv * 0.4);
      const prof = (f, i, q) => {
        const th = Math.atan2(q[1] - cv, q[0] - cu);
        let d = dRim + (dMax - dRim) * (1 - Math.pow(f, 1.6));
        if (f < concha + 0.08 * Math.sin(th * 3 + fc)) d += 0.006;                // el escalon de la concha
        for (const [au, av, ra, al] of arido) { const dd = Math.hypot(q[0] - au, q[1] - av); if (dd < ra) d -= (al < 0.5 ? 0.003 : -0.002) * (1 - dd / ra); }
        return Math.max(0.003, Math.min(CARA - FONDO - 0.004, d));
      };
      const fresco = new THREE.Color('#86827b'), oscuro = new THREE.Color('#2b2c2c'), oxido = new THREE.Color('#4d3424');
      const tono = (f, d, q) => {
        const cc = fresco.clone().lerp(oscuro, Math.min(1, (d - dRim) / (dMax - dRim) * 0.7));
        cc.multiplyScalar(1 - 0.5 * Math.max(0, (f - 0.78) / 0.22) ** 1.5);          // la oclusion bajo el labio
        // y la sombra que echa el labio del lado de la luz (de arriba y de -u): no la da el mapa de sombras, de 1 cm
        const dq = unit(sub(q, [cu, cv])), luz = Math.max(0, dq[0] * LUZ[0] + dq[1] * LUZ[1]);
        cc.multiplyScalar(1 - 0.6 * luz * Math.min(1, Math.max(0, (f - 0.55) / 0.35)));
        for (const [au, av, ra, al] of arido) if (Math.hypot(q[0] - au, q[1] - av) < ra * 0.8) cc.multiplyScalar(al < 0.5 ? 0.75 : 1.15);
        for (const vv of filas) if (Math.abs(q[1] - vv) < 0.018 && CARA - d < 0.03) cc.lerp(oxido, 0.55);
        return cc;
      };
      abanico(m, [cu, cv], contorno, prof, tono, false, tz.frente, o.cerca === false ? 5 : 9);
      // la ferralla: barras horizontales cada 15 cm a 2,4 cm de la cara, de borde a borde del agujero (y metidas bajo el)
      for (const vv of filas) {
        const half = Ru * Math.sqrt(Math.max(0, 1 - ((vv - cv) / Rv) ** 2)) + 0.05;
        if (half < 0.06) continue;
        barras.push([m(cu - half, vv, CARA - 0.024), m(cu + half, vv + (r() - 0.5) * 0.01, CARA - 0.024 + (r() - 0.5) * 0.004), 0.0075]);
      }
      if (o.tipo === 'golpe' && r() < 0.6) barras.push([m(cu + (r() - 0.5) * Ru * 0.5, cv - Rv * 0.9, CARA - 0.034), m(cu + (r() - 0.5) * Ru * 0.5, cv + Rv * 0.9, CARA - 0.034), 0.0065]);
      // lo que sale de el: oxido que chorrea y la humedad del borde
      const [zA, yA] = o.aMundo(cu - Ru * 0.8, cv), [zB] = o.aMundo(cu + Ru * 0.8, cv);
      const [, yB] = o.aMundo(cu, cv - Rv);
      manchas.oxido.push([Math.min(zA, zB), Math.max(zA, zB), yB - 0.5 - 1.1 * r(), yB + 0.04]);
      const [hz0, hy0] = o.aMundo(cu + Ru * 1.25, cv - Rv * 1.25), [hz1, hy1] = o.aMundo(cu - Ru * 1.25, cv + Rv * 1.25);
      huecos.push([Math.min(hz0, hz1), Math.max(hz0, hz1), Math.min(hy0, hy1), Math.max(hy0, hy1)]);
      lineas.push([ccw(contorno).map((p) => suma([cu, cv], esc(sub(p, [cu, cv]), 1.0))), -1]);
      cuenta.desconchones++;
    }

    // DESCANTILLADOS: una esquina o un canto comido, con la rotura en rampa hacia la junta
    const nDesc = entre(K.cantos);
    for (let k = 0; k < nDesc; k++) {
      const esquina = r() < 0.5;
      let centro, th0, th1;
      if (esquina) {
        const q = Math.floor(r() * 4);
        centro = [[U0, V0], [U1, V0], [U1, V1], [U0, V1]][q];
        th0 = [0, Math.PI / 2, Math.PI, Math.PI * 1.5][q]; th1 = th0 + Math.PI / 2;
      } else {
        const lado = Math.floor(r() * 4);
        centro = enBorde(lado, 0.12 + 0.76 * r());
        th0 = [0, Math.PI / 2, Math.PI, Math.PI * 1.5][lado]; th1 = th0 + Math.PI;
      }
      const R0 = 0.05 + 0.1 * r(), NR = esquina ? 16 : 26, cont = [], fa = r() * 6;
      for (let i = 0; i < NR; i++) {
        const th = th0 + (th1 - th0) * i / (NR - 1);
        const kk = (i === 0 || i === NR - 1 ? 0.85 : 1) * (1 + 0.25 * Math.sin((th - th0) * 4 + fa) + (r() - 0.5) * 0.2);
        cont.push(suma(centro, [Math.cos(th) * R0 * kk, Math.sin(th) * R0 * kk]));
      }
      const bis = [Math.cos((th0 + th1) / 2), Math.sin((th0 + th1) / 2)];
      const salA = suma(cont[0], esc(girar([Math.cos(th0), Math.sin(th0)], -Math.PI / 2), 0.03));
      const salB = suma(cont[NR - 1], esc(girar([Math.cos(th1), Math.sin(th1)], Math.PI / 2), 0.03));
      if (dentro(rect, salA) || dentro(rect, salB)) continue;
      const N = [salA, ...cont.slice(1, -1), salB];
      let hecho = null;
      trozos = trozos.map((t) => {
        if (hecho) return t;
        const s = partir(ccw(t.P), N);
        if (!s) return t;
        const resto = Math.abs(area(s[0])) > Math.abs(area(s[1])) ? s[0] : s[1];
        if (t.huecos.some((h) => h.some((p) => !dentro(resto, p)))) return t;
        hecho = { ...t, P: resto };
        return hecho;
      });
      if (!hecho) continue;
      const dEsq = 0.016 + 0.018 * r();
      const prof = (f) => 0.003 + (dEsq - 0.003) * Math.pow(1 - f, 1.3);
      const fresco = new THREE.Color('#827f78'), osc = new THREE.Color('#3a3a37');
      abanico(m, centro, cont, prof, (f) => fresco.clone().lerp(osc, (1 - f) * 0.6), true, hecho.frente);
      cuenta.descantillados++;
    }

    // REMIENDO: placa de mortero 3 mm por encima de la cara, donde lo pinta la textura
    if (o.remiendo) {
      // el borde del mortero no es recto: se sale y se mete unos centimetros por donde paso la llana
      const [x0, x1, y0, y1] = o.remiendo, pts = [], f1 = r() * 6, f2 = r() * 6;
      const bordes = [[x0, y0, x1, y0, 0, -1], [x1, y0, x1, y1, 1, 0], [x1, y1, x0, y1, 0, 1], [x0, y1, x0, y0, -1, 0]];
      bordes.forEach(([ax, ay, bx, by, nx, ny], lado) => {
        for (let i = 0; i < 12; i++) {
          const t = i / 12, sp = lado + t, d = 0.008 + 0.014 * Math.sin(sp * 5.3 + f1) + 0.009 * Math.sin(sp * 13.1 + f2) + (r() - 0.5) * 0.006;
          const esq = Math.min(t, 1 - t) < 0.06 ? -0.012 : 0;                  // las esquinas, redondeadas
          pts.push([ax + (bx - ax) * t + nx * (d + esq), ay + (by - ay) * t + ny * (d + esq)]);
        }
      });
      const t = trozos.find((z) => pts.every((p) => dentro(z.P, p)) && !z.huecos.some((h) => h.some((p) => dentro(ccw(pts), p))));
      if (t) {
        const f = t.frente;
        extruir({ P: pts, huecos: [], frente: (u, v) => f(u, v) + 0.003 }, m, uvDe, col.clone().multiplyScalar(1.16).lerp(new THREE.Color(0.8, 0.79, 0.76), 0.12));
        cuenta.remiendos++;
      }
    }

    for (const t of trozos) extruir(t, m, uvDe, col);
    if (o.cerca !== false) for (const [L, lado] of lineas) humedad(m, trozos, L, lado, r);
    // eflorescencia: de la parte mas baja de cada grieta baja un chorreon blanquecino; y humedad debajo
    for (const C of centros) {
      let bajo = null;
      for (const p of C) if (p[0] > U0 + 0.1 && p[0] < U1 - 0.1 && p[1] > V0 + 0.15 && (!bajo || p[1] < bajo[1])) bajo = p;
      if (!bajo || r() < 0.3) continue;
      const [z0, y0] = o.aMundo(bajo[0] - 0.09 - 0.08 * r(), bajo[1]), [z1] = o.aMundo(bajo[0] + 0.09 + 0.08 * r(), bajo[1]);
      // (la eflorescencia blanca como rectangulo con chorreones parecia un manchurron: solo la humedad)
      manchas.humeda.push([Math.min(z0, z1), Math.max(z0, z1), y0 - 0.35 - 0.8 * r(), y0 + 0.06]);
    }
    cuenta.paneles++;
    return true;
  }

  function placas() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(P.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(P.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(P.col, 3));
    const idx = new Uint32Array(P.pos.length / 3); for (let i = 0; i < idx.length; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }
  function mallas(scene, gradiente) {
    const out = {};
    if (F.idx.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(F.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(F.col, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(F.uv, 2));
      g.setIndex(F.idx);
      g.computeVertexNormals();
      // Lambert y no toon: con los tres escalones del toon todo el fondo caia en el mismo y el relieve no se leia; y el
      // ARIDO de la rotura (cantos rodados, arena, poros) en una baldosa de 30 cm con su relieve
      const arido = texturaArido();
      out.texturas = [arido.mapa, arido.relieve];
      out.fondos = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: arido.mapa, bumpMap: arido.relieve, bumpScale: 1.6 }));
      out.fondos.name = 'fondosRotura'; out.fondos.receiveShadow = true;
      scene.add(out.fondos);
    }
    if (Gn.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(Gn, 3));
      out.negro = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#111417', side: THREE.DoubleSide }));
      out.negro.name = 'fondoGrietas';
      scene.add(out.negro);
    }
    if (Hh.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(Hh.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(Hh.col, 4));
      out.humedad = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      out.humedad.name = 'humedadGrietas'; out.humedad.renderOrder = -1;
      scene.add(out.humedad);
    }
    out.tris = { placas: P.pos.length / 9, fondos: F.idx.length / 3, negro: Gn.length / 9, humedad: Hh.pos.length / 9 };
    return out;
  }
  return { panel, placas, mallas, barras, manchas, huecos, cuenta };
}
