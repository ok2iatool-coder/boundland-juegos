// EL LINDE · los TRONCOS: corteza en CRESTAS largas de cel (husos de tres valores planos que acaban en cuna o en
// bisel alargado, nunca en escalon), grietas negras en V donde se cruzan las puntas, veta en diagonal que sigue la
// curva del tronco, contrafuertes que abren el pie, LUZ MOTEADA que entra entre las copas y cruza placas y musgo,
// musgo en MANTOS de lobulos fibrosos (mechones hacia abajo, sombra agrupada abajo, luz en el borde de arriba) que
// se agarran al lado en sombra y cuelgan en hilos, hiedra que cruza la silueta en diagonal, silueta con nudos y un
// canto de contraluz pegado a la corteza. Tambien la rama que es plataforma y la seta de repisa.
// Todo es del arbol: aqui no se pinta nada de metal ni de casas.
import { TINTA, azar, mezclar, rgba, trazar, trazarSuave, tinta, ruido1 } from '../dibujo/tinta.js';
import { g, lerp, cl, tono, ladoLuz, brillo, RELIEVE } from './base.js';
import { formaTronco } from './geometria.js';
import { musgo, setaLuz } from './suelo.js';
import { hojas, colgajo } from './follaje.js';

const MPI = Math.PI / 2;

// paleta (de concepto/referencia.png): pizarra calida-fria en la sombra, ocre limpio en el lado del sol, musgo pardo oliva
export const CEL = {
  negro: '#050401',
  sombra: ['#121109', '#1e1c10', '#292820'],   // [sombra de la placa, cuerpo, labio]
  medio: ['#1e1c10', '#292820', '#3e3f35'],
  frio: '#414a50', cielo: '#728594',
  ocreM: ['#3a3224', '#7a6a49', '#a88f63'],
  ocreL: ['#6a5c40', '#c0a374', '#e3d5ad'],
  pico: '#e3d5ad',
  musgo: ['#16120a', '#2b2416', '#463c27', '#6e603d'],   // base, base 2, cuerpo en sombra, medio
  cuerpo: '#564a31',
  motas: ['#bda269', '#d3ba72', '#e3d5ad'],
  hiedraSombra: ['#28210f', '#3e371e'], hiedraLuz: ['#3e371e', '#b5a165', '#d3ba72'], tallo: '#17130b',
  anchoLuz: 0.22,        // fraccion del ancho que da al sol
  paso: 0.24,           // ancho angular de una columna de crestas (rad): ~22 px en un tronco de 200
  musgoAbajo: 0.32, musgoArriba: 0.1,
};

// el color segun la distancia: la bruma de la pagina y, ademas, menos contraste en los planos medios
function entona(c, d, x) {
  let k = tono(c, d, x);
  if (d > 0.12) k = mezclar(k, '#77705f', cl((d - 0.12) * 1.5, 0, 0.45) * (d > 0.6 ? cl(1 - (d - 0.6) * 4, 0, 1) : 1));
  return k;
}

// x de una polilinea [x, y] con la y bajando (el borde de verdad, con sus nudos)
function bordeDe(lista) {
  return (y) => {
    for (let i = 1; i < lista.length; i++) if (y >= lista[i][1]) { const [x0, y0] = lista[i - 1], [x1, y1] = lista[i]; return lerp(x0, x1, (y0 - y) / Math.max(1e-6, y0 - y1)); }
    return lista[lista.length - 1][0];
  };
}

// mancha de borde irregular (luz moteada, lobulos de musgo, cavidades)
function mancha(cx, cy, rx, ry, rr, n = 16) {
  const f1 = rr() * 7, f2 = rr() * 7, p = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, r = 1 + 0.22 * Math.sin(3 * a + f1) + 0.13 * Math.sin(5 * a + f2) + (rr() - 0.5) * 0.22; p.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]); }
  return p;
}

// mechones de musgo: trazos cortos que caen; oscuros abajo y claros arriba de la caja
function mechones(x0, y0, x1, y1, n, cols, col, rr, esc = 1) {
  g.lineWidth = 1.2; g.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const fy = rr(), hx = lerp(x0, x1, rr()), hy = lerp(y0, y1, fy), l = (3 + rr() * 5) * esc, a = (rr() - 0.5) * 0.6;
    g.strokeStyle = col(cols[Math.min(cols.length - 1, Math.floor((1 - fy) * cols.length * (0.75 + rr() * 0.5)))]);
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + Math.sin(a) * l, hy + Math.cos(a) * l); g.stroke();
  }
}

// musgo en LOMO: una banda de borde lobulado encima de una rama o una raiz (puntos del lomo de izquierda a derecha)
function lomoMusgo(arr, grosor, ld, col, rr) {
  const n = arr.length, f1 = rr() * 7, f2 = rr() * 7, top = [], bot = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), fin = Math.min(1, t * 5, (1 - t) * 4), h = grosor * fin * (0.55 + 0.3 * Math.sin(i * 1.7 + f1) + 0.25 * Math.sin(i * 0.6 + f2) + rr() * 0.2);
    top.push([arr[i][0], arr[i][1] - Math.max(0.5, h)]); bot.push([arr[i][0], arr[i][1] + 2 + fin * grosor * 0.25]);
  }
  const pol = [...top, ...[...bot].reverse()], M = CEL.musgo;
  trazarSuave(g, pol); g.fillStyle = col(M[0]); g.fill();
  g.save(); trazarSuave(g, pol); g.clip();
  // cuerpo encogido hacia arriba, mechones que caen y luz en el borde de arriba
  trazarSuave(g, [...top.map(([px, py]) => [px, py + 1]), ...[...bot].reverse().map(([px, py], i) => [px, lerp(py, top[n - 1 - i][1], 0.45)])]); g.fillStyle = col(CEL.cuerpo); g.fill();
  const xs = arr.map((q) => q[0]), ys = top.map((q) => q[1]);
  mechones(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...bot.map((q) => q[1])), n * grosor * 1.2, [M[3], CEL.cuerpo, M[2], M[1], M[0]], col, rr);
  trazarSuave(g, top, false); g.strokeStyle = col(M[3]); g.lineWidth = 1.6; g.stroke();
  for (let i = 0; i < n; i++) if (rr() < 0.35) { const q = top[i]; for (let k = 0; k < 3; k++) { const sz = 1 + rr() * 1.4; g.fillStyle = col(CEL.motas[Math.floor(rr() * 3)]); g.fillRect(q[0] + (rr() - 0.5) * 8, q[1] + rr() * 3, sz, sz); } }
  g.restore();
  // flecos por arriba (hojitas que asoman) y por abajo
  g.lineWidth = 1; g.lineCap = 'round'; g.strokeStyle = col(M[0]); g.beginPath();
  for (const q of top) if (rr() < 0.6) { g.moveTo(q[0], q[1] + 1); g.lineTo(q[0] + (rr() - 0.5) * 4, q[1] - 2 - rr() * 3); }
  for (const q of bot) if (rr() < 0.3) { g.moveTo(q[0], q[1] - 1); g.lineTo(q[0] + (rr() - 0.5) * 3, q[1] + 2 + rr() * 5); }
  g.stroke();
}

// hilos que cuelgan del musgo (por las grietas)
function hilo(x, y, l, col, rr, w = 1.2) {
  const dx = (rr() - 0.5) * 6;
  g.strokeStyle = col(rr() < 0.5 ? CEL.musgo[0] : CEL.musgo[1]); g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dx * 1.5, y + l * 0.5, x + dx, y + l); g.stroke();
  g.fillStyle = col(CEL.musgo[1]); g.beginPath(); g.arc(x + dx, y + l, w * 1.1, 0, 7); g.fill();
}

// hoja de hiedra en corazon o de tres lobulos, que apunta en la direccion a; dos valores (mitad que mira arriba-al-sol
// mas clara) con tinta de 1 px
function hojaHiedra(hx, hy, s, a, enLuz, ld, col, d, rr) {
  const th = a - MPI;
  g.save(); g.translate(hx, hy); g.rotate(th);
  const tres = rr() < 0.4;
  g.beginPath(); g.moveTo(0, s * 0.12);
  if (tres) {
    g.quadraticCurveTo(-s * 0.35, -s * 0.15, -s * 0.55, s * 0.22); g.lineTo(-s * 0.3, s * 0.42); g.quadraticCurveTo(-s * 0.28, s * 0.8, 0, s);
    g.quadraticCurveTo(s * 0.28, s * 0.8, s * 0.3, s * 0.42); g.lineTo(s * 0.55, s * 0.22); g.quadraticCurveTo(s * 0.35, -s * 0.15, 0, s * 0.12);
  } else {
    g.bezierCurveTo(-s * 0.15, -s * 0.25, -s * 0.65, -s * 0.05, -s * 0.5, s * 0.35); g.quadraticCurveTo(-s * 0.3, s * 0.75, 0, s);
    g.quadraticCurveTo(s * 0.3, s * 0.75, s * 0.5, s * 0.35); g.bezierCurveTo(s * 0.65, -s * 0.05, s * 0.15, -s * 0.25, 0, s * 0.12);
  }
  g.closePath();
  const pal = enLuz ? CEL.hiedraLuz : CEL.hiedraSombra;
  g.fillStyle = col(pal[0]); g.fill();
  const lado = (Math.cos(th) * ld - Math.sin(th)) >= 0 ? 1 : -1;
  g.save(); g.clip(); g.fillStyle = col(enLuz ? pal[1 + Math.floor(rr() * 2)] : pal[1]); g.fillRect(lado > 0 ? 0.6 : -s, -s, s - 0.6, s * 2.2); g.restore();
  if (d < 0.4) { g.lineWidth = 1; g.strokeStyle = TINTA; g.lineJoin = 'round'; g.stroke(); }
  g.restore();
}

// ---------------------------------------------------------------- la CORTEZA en cel
// devuelve lo que necesitan la hiedra y el musgo que se salen de la silueta (se pintan despues de la tinta)
export function cortezaCel(F, pts, ld, d, rr, o = {}) {
  const col = (c) => entona(c, d, F.x);
  // posicion en el ancho (-1 sombra .. 1 sol): un cilindro con poco escorzo, para que las placas del canto con luz sigan siendo anchas
  const sN = (ph) => { const p = cl(ph, -MPI, MPI); return lerp(Math.sin(p), p / MPI, 0.8); };
  const P = (ph, y) => { const [a, b] = F.bordes(y); return [(a + b) / 2 + sN(ph) * ld * (b - a) / 2, y]; };
  const uDe = (ph) => sN(ph) / 2;
  const esc = cl(F.an / 210, 0.45, 1.3), lejos = d > 0.2;
  const Rm = F.an * 0.42;
  const bx = o.borde || F.bordes;
  const xSol = (y) => bx(y)[ld > 0 ? 1 : 0], xSom = (y) => bx(y)[ld > 0 ? 0 : 1];
  // veta en diagonal (10-25 grados) en el sentido de la curva: desplazamiento angular que crece al subir
  const veta = (0.18 + rr() * 0.22) * (o.sentido || 1);
  const sh = (y) => ld * veta * (F.base - y) / Rm;
  const shTop = sh(F.top);
  const M = CEL.musgo;

  trazarSuave(g, pts); g.fillStyle = col(CEL.negro); g.fill();
  g.save(); trazarSuave(g, pts); g.clip();

  // franjas de la orilla: la cresta de la orilla no deja una raya negra contra la tinta
  const franja = (xe, haciaFuera, w, c) => { const A = [], B = []; for (let y = F.base + 12; y > F.top - 14; y -= 12) { const x0 = xe(y); A.push([x0 + haciaFuera * 4, y]); B.push([x0 - haciaFuera * w, y]); } trazar(g, [...A, ...B.reverse()]); g.fillStyle = col(c); g.fill(); };
  franja(xSol, ld, 9 * esc, CEL.ocreM[1]);
  franja(xSom, -ld, 9 * esc, CEL.sombra[1]);

  // LUZ MOTEADA: el sol entra entre las copas y deja manchas de 20-60 px en medio del tronco y en el lado en sombra
  const luzM = [];
  { const n = Math.round(F.alto / 400 * (3 + rr() * 3) * (lejos ? 0.6 : 1));
    for (let i = 0; i < n; i++) {
      const y = F.top + 30 + rr() * (F.alto - 90), u = -0.42 + rr() * 0.72, ph = Math.asin(cl(u * 2, -1, 1));
      const [px] = P(ph + sh(y), y), rx = (10 + rr() * 20) * esc, ry = rx * (1.3 + rr() * 1.3);
      luzM.push({ p: mancha(px, y, rx, ry, rr), x0: px - rx * 1.4, x1: px + rx * 1.4, y0: y - ry * 1.4, y1: y + ry * 1.4 });
    } }
  const conLuz = (x0, x1, y0, y1, pinta) => { for (const m of luzM) { if (m.x1 < x0 || m.x0 > x1 || m.y1 < y0 || m.y0 > y1) continue; g.save(); trazarSuave(g, m.p); g.clip(); pinta(m); g.restore(); } };

  // columnas de crestas: cada junta ondula a su aire y todas siguen la veta
  const bs = [];
  { let p = Math.min(-MPI, -MPI - shTop) - 0.7; const fin = Math.max(MPI, MPI - shTop) + 0.7; while (p < fin) { bs.push({ p, a: 0.05 + rr() * 0.08, l1: 60 + rr() * 110, l2: 19 + rr() * 25, f1: rr() * 7, f2: rr() * 7 }); p += CEL.paso * (0.5 + rr() * 1.1); } }
  const J = (k, y) => { const b = bs[k]; return b.p + sh(y) + b.a * (Math.sin(y / b.l1 + b.f1) + 0.35 * Math.sin(y / b.l2 + b.f2)); };
  const xJ = (k, y) => P(J(k, y), y)[0] + (ruido1(y * 0.05, k * 17 + 3) - 0.5) * 3.4 + (ruido1(y * 0.23, k * 29 + 5) - 0.5) * 1.2;

  // una CRESTA: huso largo entre dos juntas que se afila en cuna (o en bisel ladeado) por arriba y por abajo;
  // donde se cruzan las puntas de dos crestas queda la grieta negra en V
  const placa = (k, ya, yb) => {
    const yM = (ya + yb) / 2, pl = J(k, yM), pr = J(k + 1, yM), pc = (pl + pr) / 2;
    if (pl > MPI + 0.02 || pr < -MPI - 0.02) return;
    const u = uDe(pc) + (rr() - 0.5) * 0.06, sol = u > 0.5 - CEL.anchoLuz, som = u < -0.1;
    const hueco = sol ? 1.1 : som ? -0.8 : 0.4;
    const n = 12, L = [], R = [];
    const tb = 0.2 + rr() * 0.22, tt = 0.2 + rr() * 0.25, lb = (rr() - 0.5) * 1.6, lt = (rr() - 0.5) * 1.6;
    let ok = 0, xmin = 1e9, xmax = -1e9;
    for (let i = 0; i <= n; i++) {
      const f = i / n, y = lerp(ya, yb, f), a = xJ(k, y), b = xJ(k + 1, y);
      const xl = Math.min(a, b) + hueco, xr = Math.max(Math.min(a, b) + hueco, Math.max(a, b) - hueco);
      if (xr - xl > 3) ok++;
      const e = Math.pow(cl(Math.min(f / tb, (1 - f) / tt), 0, 1), 0.6), tip = lerp(xl, xr, 0.5 + (f < 0.5 ? lb : lt) * 0.5);
      L.push([lerp(tip, xl, e), y]); R.push([lerp(tip, xr, e), y]);
      xmin = Math.min(xmin, xl); xmax = Math.max(xmax, xr);
    }
    if (ok < n * 0.5) return;
    const poli = [...L, ...[...R].reverse()];
    const fondo = ld > 0 ? L : R, cara = ld > 0 ? R : L;   // fondo = el canto que no da al sol, cara = el que da
    let pal;
    if (sol) pal = rr() < 0.55 + (u - 0.28) * 3 ? CEL.ocreL : CEL.ocreM;
    else if (!som) { pal = [...CEL.medio]; if (rr() < 0.15) pal[1] = CEL.frio; }
    else { pal = [...CEL.sombra]; if (rr() < 0.25) pal[1] = CEL.sombra[2]; else if (rr() < 0.06) pal[1] = CEL.frio; }
    trazar(g, poli); g.fillStyle = col(pal[1]); g.fill();
    g.save(); trazar(g, poli); g.clip();
    // franja de sombra en el canto que no da al sol (cel: un valor plano, sin degradado)
    const franjaS = (f0, c) => { const S = fondo.map((p, i) => [lerp(p[0], cara[i][0], f0 + (ruido1(p[1] * 0.04, k * 7) - 0.5) * 0.3), p[1]]); trazar(g, [...fondo.map(([px, py]) => [px - ld * 4, py]), ...[...S].reverse()]); g.fillStyle = col(c); g.fill(); };
    if (!som || rr() < 0.75) franjaS(0.28 + rr() * 0.22, pal[0]);
    // fibras: dos o tres hebras rotas a lo largo de la cresta (no un peine: pocas y del color de la sombra de la placa)
    if (!lejos) {
      const nr = Math.floor((xmax - xmin) / 11) + 1;
      g.lineWidth = 1; g.lineCap = 'round'; g.strokeStyle = rgba(col(sol ? '#4a3f2b' : CEL.negro), sol ? 0.55 : 0.6);
      for (let r = 0; r < nr; r++) {
        const fr = 0.2 + rr() * 0.6; let i = 1 + Math.floor(rr() * 3);
        g.beginPath();
        while (i < n - 1) { const j = Math.min(n - 1, i + 2 + Math.floor(rr() * 3)); g.moveTo(lerp(L[i][0], R[i][0], fr), L[i][1]); for (let q = i + 1; q <= j; q++) g.lineTo(lerp(L[q][0], R[q][0], fr) + (rr() - 0.5), L[q][1]); i = j + 1 + Math.floor(rr() * 3); }
        g.stroke();
      }
    }
    // labio de luz en el canto que da al sol; reflejo de cielo en el de arriba de alguna placa en sombra
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (sol || (!som && rr() < 0.5)) { trazar(g, cara.slice(1 + Math.floor(rr() * 3), n), false); g.strokeStyle = col(pal[2]); g.lineWidth = (sol ? 3.4 : 2.2) * esc; g.stroke(); }
    if (sol && rr() < 0.6) { trazar(g, cara.slice(n - 4), false); g.strokeStyle = col(CEL.pico); g.lineWidth = 3 * esc; g.stroke(); }
    if (!sol && rr() < 0.07) { trazar(g, fondo.slice(n - 5), false); g.strokeStyle = col(CEL.cielo); g.lineWidth = 2.2; g.stroke(); }
    // luz moteada encima: la placa entera pasa a ocre, con su franja de sombra en ocre medio y el labio en pico
    conLuz(xmin, xmax, yb, ya, () => {
      trazar(g, poli); g.fillStyle = col(sol ? CEL.ocreL[1] : rr() < 0.65 ? CEL.ocreL[1] : CEL.ocreM[2]); g.fill();
      franjaS(0.3 + rr() * 0.2, CEL.ocreM[1]);
      trazar(g, cara.slice(2, n), false); g.strokeStyle = col(CEL.pico); g.lineWidth = 3 * esc; g.stroke();
    });
    g.restore();
  };
  for (let k = 0; k < bs.length - 1; k++) {
    let y = F.base + 20 - rr() * 120 * esc;
    while (y > F.top - 30) {
      const solC = uDe(J(k, y)) > 0.22;
      const h = (solC ? 100 + rr() * 70 : 65 + rr() * 75) * esc * (1 - F.t(y) * 0.2);
      placa(k, y, y - h);
      y -= h * (0.66 + rr() * 0.12);
    }
  }

  // CONTRALUZ: banda de 0-4 px pegada a la corteza en la silueta que da al sol (la tinta va por fuera, encima)
  { const A = [], B = [];
    for (let y = F.base - 30; y > F.top - 6; y -= 4) {
      const xe = xSol(y), w = Math.max(0, 0.6 + 4.2 * ruido1(y * 0.022, F.x * 0.37) - 2.2 * ruido1(y * 0.09, F.x * 0.11 + 9));
      A.push([xe + ld * 3, y]); B.push([xe - ld * (1.3 + w * (lejos ? 1.3 : 1)), y]);
    }
    trazar(g, [...A, ...B.reverse()]); g.fillStyle = col(CEL.pico); g.fill(); }

  // grietas en CUNA sueltas (pocas: las V ya salen donde se cruzan las crestas), mas abiertas en la sombra
  const cuna = (k, yc, hu, hd, m) => {
    const izq = [], der = [];
    for (let i = -5; i <= 5; i++) {
      const s = i / 5, yy = s < 0 ? yc - s * hd : yc - s * hu;
      const px = xJ(k, yy), wq = m * Math.pow(1 - Math.abs(s), 1.3) / 2;
      izq.push([px - wq, yy]); der.push([px + wq, yy]);
    }
    trazar(g, [...izq, ...der.reverse()]); g.fillStyle = col(CEL.negro); g.fill();
  };
  const nG = Math.floor(F.alto * F.an / 6000 * (lejos ? 0.5 : 1));
  for (let i = 0, intentos = 0; i < nG && intentos < nG * 6; intentos++) {
    const k = 1 + Math.floor(rr() * (bs.length - 2)), yc = F.top + 40 + rr() * (F.alto - 60), p = J(k, yc);
    if (Math.abs(p) > 1.45) continue;
    i++;
    const som = uDe(p) < -0.1, m = (som ? 5 + rr() * 4 : 3 + rr() * 3) * esc;
    cuna(k, yc, (30 + rr() * 45) * esc, (30 + rr() * 45) * esc, m);
  }
  // CAVIDADES: huecos negros de 6-12 px de boca en las horquillas del lado en sombra
  if (!lejos) for (let i = 0; i < F.alto / 170; i++) {
    const k = 1 + Math.floor(rr() * (bs.length - 2)), yc = F.top + 60 + rr() * (F.alto - 100), p = J(k, yc);
    if (Math.abs(p) > 1.4 || uDe(p) > 0.15) continue;
    const [px] = P(p, yc), m = (3 + rr() * 3) * esc;
    trazarSuave(g, mancha(px, yc, m, m * (2.2 + rr() * 2), rr, 10)); g.fillStyle = col(CEL.negro); g.fill();
  }
  // entre los contrafuertes: cunas anchas que suben desde el suelo
  for (const p0 of [-0.95, -0.3, 0.35, 0.95]) { const p = p0 + (rr() - 0.5) * 0.25; const [px] = P(p, F.base), m = (7 + rr() * 5) * esc, h = (70 + rr() * 60) * esc; trazar(g, [[px - m / 2, F.base + 10], [px - m * 0.15, F.base - h * 0.5], [px + (rr() - 0.5) * 6, F.base - h], [px + m * 0.15, F.base - h * 0.5], [px + m / 2, F.base + 10]]); g.fillStyle = col(CEL.negro); g.fill(); }

  // grano fino sobre la pizarra (la referencia no tiene ni un trozo liso)
  if (!lejos) for (let i = 0; i < F.alto * F.an / 500; i++) {
    const p = -1.5 + rr() * 2.6, y = F.base - rr() * F.alto, [px] = P(p + sh(y), y), sol = uDe(p + sh(y)) > 0.3;
    g.fillStyle = rgba(col(sol ? '#4a4130' : rr() < 0.6 ? '#4e4e44' : '#0d0c07'), 0.55); g.fillRect(px, y, 1.3, 1.3);
  }

  // MUSGO EN MANTOS: masas de borde lobulado y deshilachado que se agarran al lado en sombra y cuelgan.
  // Por dentro son LOBULOS: cada uno con la sombra agrupada abajo, mechones que caen y luz en el borde de arriba
  const manto = (p0, y0, Wm, Hm) => {
    const N = 30, pol = [], f1 = rr() * 7, f2 = rr() * 7, f3 = rr() * 7;
    let fuera = 0;
    for (let i = 0; i < N; i++) {
      const th = (i / N) * 6.283, sn = Math.sin(th);
      let r = 1 + 0.2 * Math.sin(3 * th + f1) + 0.12 * Math.sin(7 * th + f2) + (rr() - 0.5) * 0.18;
      if (sn > 0) r *= 1 + 0.55 * sn * Math.max(0, Math.sin(5 * th + f3));   // lobulos que cuelgan
      const oy = (sn * r * 0.5 + 0.5) * Hm, ox = Math.cos(th) * r * (Wm / 2) * (1 - 0.35 * Math.max(0, sn));
      const y = y0 + oy, ph = p0 + sh(y);
      if (Math.abs(ph) > MPI) fuera++;
      pol.push([P(ph, y)[0] + ox * Math.max(0.3, Math.cos(cl(ph, -1.5, 1.5))), y]);
    }
    if (fuera > N * 0.6) return;
    const cx = pol.reduce((s, q) => s + q[0], 0) / N, cy = y0 + Hm / 2, u = uDe(p0 + sh(cy)), som = u < -0.15;
    // la sombra que hace el manto sobre la corteza: un hueco negro debajo
    if (!lejos && rr() < 0.7) { const q = pol[Math.floor(N / 4)]; trazarSuave(g, mancha(q[0] - ld * Wm * 0.08, q[1] - 2, (3 + rr() * 3) * esc, (9 + rr() * 12) * esc, rr, 10)); g.fillStyle = col(CEL.negro); g.fill(); }
    trazarSuave(g, pol); g.fillStyle = col(M[0]); g.fill();
    g.strokeStyle = col(M[0]); g.lineWidth = 1; g.lineCap = 'round'; g.beginPath();
    for (const [qx, qy] of pol) if (qy > cy && rr() < 0.7) { const l = (3 + rr() * 7) * esc; g.moveTo(qx, qy - 1); g.lineTo(qx + (rr() - 0.5) * 3, qy + l); }
    g.stroke();
    g.save(); trazarSuave(g, pol); g.clip();
    const enc = (k, dx, dy) => pol.map(([qx, qy]) => [cx + (qx - cx) * k + dx, cy + (qy - cy) * k + dy]);
    trazarSuave(g, enc(0.8, ld * Wm * 0.06, -Hm * 0.12)); g.fillStyle = col(som ? M[1] : M[2]); g.fill();
    // lobulos
    const nl = 3 + Math.floor(rr() * 3) + Math.floor(Hm / 60);
    const lob = [];
    for (let l = 0; l < nl; l++) {
      const lx = cx + (rr() - 0.5) * Wm * 0.75, ly = y0 + Hm * (0.04 + (l / nl) * 0.75 + rr() * 0.1), rx = Wm * (0.16 + rr() * 0.13), ry = rx * (1.1 + rr() * 0.8);
      lob.push({ lx, ly, rx, ry, lu: u + (lx - cx) * ld / Math.max(60, F.an) });
    }
    for (const { lx, ly, rx, ry, lu } of lob) {
      const p = mancha(lx, ly, rx, ry, rr, 12), osc = lu < -0.12;
      const cuerpo = osc ? M[2] : CEL.cuerpo, claro = osc ? CEL.cuerpo : M[3];
      trazarSuave(g, p); g.fillStyle = col(cuerpo); g.fill();
      g.save(); trazarSuave(g, p); g.clip();
      g.fillStyle = col(claro); g.beginPath(); g.ellipse(lx + ld * rx * 0.2, ly - ry * 0.5, rx * 0.85, ry * 0.5, 0, 0, 7); g.fill();
      g.fillStyle = col(M[1]); g.beginPath(); g.ellipse(lx - ld * rx * 0.1, ly + ry * 0.7, rx * 1.05, ry * 0.5, 0, 0, 7); g.fill();
      g.fillStyle = col(M[0]); g.beginPath(); g.ellipse(lx - ld * rx * 0.15, ly + ry * 1.0, rx * 0.9, ry * 0.3, 0, 0, 7); g.fill();
      mechones(lx - rx, ly - ry, lx + rx, ly + ry, rx * ry / 6, [claro, cuerpo, M[2], M[1], M[0]], col, rr, esc);
      g.restore();
      // borde de arriba del lobulo: luz del lado del sol
      if (lu > -0.2) { trazarSuave(g, ld > 0 ? p.slice(7, 12) : p.slice(5, 10), false); g.strokeStyle = col(lu > 0.15 ? CEL.motas[0] : M[3]); g.lineWidth = 1.5; g.stroke(); }
    }
    // pizarra que asoma entre los mechones (baja la saturacion del manto)
    g.lineWidth = 1;
    for (let k = 0; k < Wm * Hm / 120; k++) { const hx = cx + (rr() - 0.5) * Wm, hy = y0 + rr() * Hm, l = 3 + rr() * 5; g.strokeStyle = col(rr() < 0.5 ? '#2a2a24' : CEL.negro); g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + (rr() - 0.5) * 2, hy + l); g.stroke(); }
    // luz moteada: el manto que cae en una mancha de sol sube un valor y se llena de motas
    conLuz(cx - Wm, cx + Wm, y0 - 10, y0 + Hm * 1.4, () => {
      for (const { lx, ly, rx, ry } of lob) { g.fillStyle = col(M[3]); g.beginPath(); g.ellipse(lx + ld * rx * 0.2, ly - ry * 0.35, rx * 0.8, ry * 0.55, 0, 0, 7); g.fill(); }
      mechones(cx - Wm / 2, y0, cx + Wm / 2, y0 + Hm, Wm * Hm / 40, [CEL.motas[0], M[3], CEL.cuerpo, M[2], M[1]], col, rr, esc);
      for (let k = 0; k < Wm * Hm / 120; k++) { const s = 1 + rr() * 1.6; g.fillStyle = col(CEL.motas[Math.floor(rr() * 3)]); g.fillRect(cx + (rr() - 0.5) * Wm, y0 + rr() * Hm * 0.7, s, s); }
    });
    // motas de sol: racimos en el borde de arriba del lado del sol (como mucho un 6 % del parche)
    if (u > 0.05 || rr() < 0.2) {
      const nc = 1 + Math.floor(rr() * 3);
      for (let c = 0; c < nc; c++) {
        const bx2 = cx + ld * Wm * (0.15 + rr() * 0.3), by = y0 + Hm * (0.02 + rr() * 0.25);
        for (let k = 0; k < 3 + rr() * 6; k++) { const s = 1 + rr() * 1.6; g.fillStyle = col(CEL.motas[Math.floor(rr() * 3)]); g.fillRect(bx2 + (rr() - 0.5) * 8 * esc, by + (rr() - 0.5) * 6 * esc, s, s); }
      }
    }
    g.restore();
    // hilos colgando por las grietas
    if (!lejos) for (let k = 0; k < 1 + Math.floor(rr() * 4); k++) { const q = pol[Math.floor(N * (0.15 + rr() * 0.7) / 2)]; hilo(q[0], q[1] - 2, (20 + rr() * 40) * esc, col, rr, 1 + rr() * 0.6); }
  };
  const area = (y0, y1, frac) => {
    const media = 0.62 * 39 * 85 * esc * esc, anchoV = F.an * 0.9, n = Math.round(frac * anchoV * (y1 - y0) / media * 1.3);
    for (let i = 0; i < n; i++) {
      const u = -0.48 + Math.pow(rr(), 1.25) * 0.9, ph = Math.asin(cl(u * 2, -1, 1));
      const Hm = (40 + rr() * 110) * esc, y = y0 + rr() * (y1 - y0) - Hm * 0.3;
      manto(ph - sh(y), y, (22 + rr() * 40) * esc, Hm);
    }
  };
  const corte = F.base - F.alto * 2 / 3;
  area(Math.max(corte, F.top), F.base - 30, CEL.musgoAbajo * (o.musgo ?? 1));
  if (corte > F.top) area(F.top, corte, CEL.musgoArriba * (o.musgo ?? 1));
  g.restore();
  return { P, sh, uDe, bx, esc, lejos };
}

// lo que se sale de la silueta: musgo que rompe el contorno y HIEDRA que cruza el tronco en diagonal
function encima(F, ld, d, rr, C) {
  const col = (c) => entona(c, d, F.x), { P, uDe, bx, esc } = C, M = CEL.musgo;
  // musgo que asoma por el contorno, sobre todo del lado en sombra
  for (let i = 0; i < F.alto / 110; i++) {
    const y = F.base - 40 - Math.pow(rr(), 1.2) * F.alto * 0.8, sol = rr() < 0.25, fuera = sol ? ld : -ld;
    const xe = bx(y)[fuera > 0 ? 1 : 0], r = (4 + rr() * 7) * esc;
    const p = mancha(xe + fuera * r * 0.15, y, r * 1.1, r * (1.2 + rr() * 0.8), rr, 10);
    trazarSuave(g, p); g.fillStyle = col(M[0]); g.fill();
    g.save(); trazarSuave(g, p); g.clip();
    g.fillStyle = col(sol ? CEL.cuerpo : M[2]); g.beginPath(); g.ellipse(xe + fuera * r * 0.1, y - r * 0.35, r * 0.85, r * 0.6, 0, 0, 7); g.fill();
    mechones(xe - r, y - r, xe + r, y + r * 1.4, r * r / 3, [sol ? M[3] : CEL.cuerpo, M[2], M[1], M[0]], col, rr, esc);
    g.restore();
    if (sol) { trazarSuave(g, p.slice(fuera > 0 ? 7 : 4, fuera > 0 ? 10 : 8), false); g.strokeStyle = col(CEL.motas[1]); g.lineWidth = 1.8; g.stroke(); }
    g.strokeStyle = col(M[0]); g.lineWidth = 1; g.lineCap = 'round'; g.beginPath();
    for (let k = 0; k < 4; k++) { const hx = xe + (rr() - 0.5) * r * 1.8; g.moveTo(hx, y + r * 0.6); g.lineTo(hx + (rr() - 0.5) * 3, y + r * 0.6 + (3 + rr() * 9) * esc); }
    g.stroke();
  }
  // HIEDRA: 2-3 tallos que dan la vuelta al tronco en espiral (se van por detras y vuelven por el otro lado)
  const nv = F.an > 150 ? 2 + (rr() < 0.5 ? 1 : 0) : 1;
  const pos = (ph, y) => {
    const [a, b] = F.bordes(y), m = Math.abs(ph);
    if (m <= MPI) return P(ph, y)[0];
    const fuera = Math.sign(ph) * ld, xe = fuera > 0 ? b : a;
    return xe + fuera * (m - MPI) * F.an * 0.35;
  };
  for (let v = 0; v < nv; v++) {
    let ph = -1.4 + rr() * 2.8, y = F.base - 30 - rr() * F.alto * 0.3;
    const giro = (rr() < 0.5 ? 1 : -1) * (0.0045 + rr() * 0.003), len = (500 + rr() * 500) * esc, camino = [];
    for (let s = 0; s < len && y > F.top + 20; s += 4) {
      camino.push([ph, y]); y -= 4; ph += giro * 4 + (ruido1(s * 0.02, v * 31 + F.x) - 0.5) * 0.02;
      if (ph > Math.PI) ph -= 2 * Math.PI; else if (ph < -Math.PI) ph += 2 * Math.PI;
    }
    const vis = (p) => Math.abs(p) < MPI + 0.12;
    g.strokeStyle = col(CEL.tallo); g.lineWidth = 1.8 * esc; g.lineCap = 'round'; g.beginPath();
    let dentro = false;
    for (const [p, yy] of camino) { if (!vis(p)) { dentro = false; continue; } const px = pos(p, yy); if (!dentro) g.moveTo(px, yy); else g.lineTo(px, yy); dentro = true; }
    g.stroke();
    // racimos de 4-11 hojas que se abren a los dos lados del tallo y cuelgan
    for (let i = 3; i < camino.length; i += 6 + Math.floor(rr() * 5)) {
      const [p, yy] = camino[i]; if (!vis(p)) continue;
      const px = pos(p, yy), n = 4 + Math.floor(rr() * 8), luz = uDe(p) > 0.12;
      for (let k = 0; k < n; k++) {
        const lado = k % 2 ? 1 : -1, rd = (2 + rr() * 12) * esc, s = (9 + rr() * 7) * Math.min(1, esc);
        const a = MPI - lado * (0.25 + rr() * 1.1) + (rr() - 0.5) * 0.5;
        hojaHiedra(px + lado * rd * 0.8, yy + (rr() - 0.6) * rd, s, a, luz || rr() < 0.08, ld, col, d, rr);
      }
    }
  }
}

// ---------------------------------------------------------------- el TRONCO
// troncos ya pintados: las ramas y las setas se pegan a la silueta de verdad (el tronco se curva)
const VIVOS = [];
function troncoEn(x, y, d) {
  let mejor = null, dm = 1e9;
  for (const F of VIVOS) { if (Math.abs(F.d - d) > 0.1 || y > F.base + 10 || y < F.top) continue; const dx = Math.abs(F.cx(y) - x); if (dx < F.an * 0.9 && dx < dm) { dm = dx; mejor = F; } }
  return mejor;
}
export function tronco(x, base, top, an, d, sem, o = {}) {
  const rr = azar(sem), ld = ladoLuz(x);
  // curva de 3-8 grados de media (no hay troncos cilindro); el banco la cambia por una inclinacion sobre un pivote.
  // La forma sale de geometria.js, que el nivel del juego usa tambien para saber donde nacen las ramas
  const { F, curva, incl, piv } = formaTronco(rr, x, base, top, an, o);
  F.d = d; VIVOS.push(F);
  // la veta se tuerce en el sentido en que se inclina el tronco al subir
  const sentido = o.recto ? (incl > 0 ? -1 : 1) * ld : (curva > 0 ? 1 : -1) * ld;
  // silueta con NUDOS y bultos de corteza: ruido de 2-6 px (menos en lo lejano)
  const k0 = cl(an / 210, 0.3, 1.2) * (d < 0.35 ? 1 : 0.4), nud = [];
  for (let i = 0; i < (base - top) / 170; i++) nud.push({ y: top + rr() * (base - top), a: (2 + rr() * 4) * (rr() < 0.6 ? 1 : -0.5), s: 8 + rr() * 20, lado: rr() < 0.5 ? 0 : 1 });
  const rb = (y, lado) => k0 * ((ruido1(y * 0.018, sem + lado * 13) - 0.5) * 4.5 + (ruido1(y * 0.07, sem + lado * 29 + 5) - 0.5) * 2.4 + nud.reduce((s, n) => (n.lado === lado ? s + n.a * Math.exp(-(((y - n.y) / n.s) ** 2)) : s), 0));
  const izq = [], der = [];
  for (let y = base + 8; y > top; y -= 9) { const [a, b] = F.bordes(y); izq.push([a - rb(y, 0), y]); der.push([b + rb(y, 1), y]); }
  { const [a, b] = F.bordes(top); izq.push([a, top]); der.push([b, top]); }
  const pts = [...izq, ...[...der].reverse()];
  const bI = bordeDe(izq), bD = bordeDe(der), borde = (y) => [bI(y), bD(y)];
  const col = (c) => entona(c, d, x);
  let C = null;
  if (d < 0.35) {
    C = cortezaCel(F, pts, ld, d, rr, { sentido, musgo: o.musgo, borde });
    if (RELIEVE) {
      // VOLUMEN de cilindro encima del cel: cara al sol encendida, sombra propia que se come el otro lado, el canto del
      // fondo con un rebote apagado y la copa que ensombrece lo alto del tronco
      g.save(); trazarSuave(g, pts); g.clip();
      const s = (u) => (ld > 0 ? u : 1 - u);
      for (let y = top - 12; y < base + 12; y += 16) {
        const [a, b] = F.bordes(y); if (b - a < 4) continue;
        const gr = g.createLinearGradient(a, 0, b, 0);
        gr.addColorStop(s(0), 'rgba(16,13,6,.34)'); gr.addColorStop(s(0.06), 'rgba(16,13,6,.46)'); gr.addColorStop(s(0.3), 'rgba(16,13,6,.22)');
        gr.addColorStop(s(0.55), 'rgba(16,13,6,0)'); gr.addColorStop(s(0.8), 'rgba(236,214,160,.14)'); gr.addColorStop(s(0.93), 'rgba(246,226,176,.24)'); gr.addColorStop(s(1), 'rgba(16,13,6,.22)');
        g.fillStyle = gr; g.fillRect(a - 8, y - 1, b - a + 16, 18);
      }
      const gc = g.createLinearGradient(0, top, 0, top + (base - top) * 0.32); gc.addColorStop(0, 'rgba(8,7,3,.5)'); gc.addColorStop(1, 'rgba(8,7,3,0)');
      g.fillStyle = gc; g.fillRect(x - an * 2, top - 10, an * 4, (base - top) * 0.32 + 12);
      g.restore();
    }
    if (d < 0.1) window.__troncos.push({ x, base, top, an, curva, inclina: incl, pivote: piv });
  } else {
    // lejos: tres valores planos (sombra, medio, canto de luz) y poca cosa mas; la bruma hace el resto
    trazarSuave(g, pts); g.fillStyle = col('#3e3f35'); g.fill();
    g.save(); trazarSuave(g, pts); g.clip();
    const banda = (u0, u1, c) => { const l = [], r = []; for (let y = base + 8; y > top - 10; y -= 40) { const [a, b] = F.bordes(y), m = (a + b) / 2, h = (b - a) / 2; l.push([m + u0 * 2 * h * ld, y]); r.push([m + u1 * 2 * h * ld, y]); } trazar(g, [...l, ...r.reverse()]); g.fillStyle = c; g.fill(); };
    banda(-0.6, -0.08, col('#292820'));
    banda(0.4, 0.6, col('#7a6a49'));
    // veta: unos trazos oscuros en diagonal
    g.strokeStyle = col('#1e1c10'); g.lineCap = 'round';
    for (let l = 0; l < an / 12; l++) { const u = rr() - 0.5, y0 = base - rr() * (base - top), len = 60 + rr() * 160, [a, b] = F.bordes(y0), px = (a + b) / 2 + u * (b - a); g.lineWidth = 1 + rr() * 2; g.beginPath(); g.moveTo(px, y0); g.lineTo(px - curva * 0.002 * len - ld * len * 0.12, y0 - len); g.stroke(); }
    // musgo pardo oliva en manchas abajo, en el lado en sombra
    for (let k = 0; k < (base - top) / 160; k++) { const t = Math.pow(rr(), 1.4) * 0.65, yy = base - t * (base - top), [a, b] = F.bordes(yy), px = (a + b) / 2 - ld * (b - a) * (0.1 + rr() * 0.3), r0 = (b - a) * (0.08 + rr() * 0.1); for (let q = 0; q < 6; q++) { g.fillStyle = col(q % 3 === 0 ? CEL.musgo[3] : q % 2 ? CEL.musgo[2] : CEL.cuerpo); g.beginPath(); g.ellipse(px + (rr() - 0.5) * r0 * 2, yy + rr() * r0 * 3, r0 * (0.5 + rr() * 0.5), r0 * (0.6 + rr() * 0.7), 0, 0, 7); g.fill(); } }
    // canto de luz
    g.strokeStyle = col(CEL.pico); g.lineWidth = 4; g.beginPath(); for (let y = base; y > top; y -= 30) { const b = F.bordes(y), px = ld > 0 ? b[1] : b[0]; if (y === base) g.moveTo(px, y); else g.lineTo(px, y); } g.stroke();
    g.restore();
  }
  // sombra del pie
  { g.save(); trazarSuave(g, pts); g.clip(); const gb = g.createLinearGradient(0, base - 160, 0, base + 10); gb.addColorStop(0, 'rgba(5,4,1,0)'); gb.addColorStop(1, 'rgba(5,4,1,.55)'); g.fillStyle = gb; g.fillRect(x - an * 2, base - 160, an * 4, 180); g.restore(); }
  if (d < 0.4) { trazarSuave(g, pts); tinta(g, 2.6 * (1 - d * 2.3)); }
  // lo que rompe la silueta va encima de la tinta
  if (C && !C.lejos) encima(F, ld, d, rr, C);
  // raices: salen de los contrafuertes y se meten en el suelo, en cel con musgo encima
  if (o.raices) for (let k = 0; k < (o.raicesBajo ? 9 : 6); k++) {
    // contrafuerte que se abre del pie y se mete en el suelo: cuna gruesa que se afila, en cel
    // o.raicesBajo (los arboles del juego): nacen al pie, apenas asoman un lomo sobre el suelo y se meten en la tierra
    // antes de llegar al borde de lo que pisan (o.raizIzq / o.raizDer: cuanto suelo hay a cada lado, en px desde el
    // eje). Sin ella, los contrafuertes altos del concepto
    // y las tres ultimas (asoma) salen de la tierra junto al tronco, hacen un lomo y vuelven a entrar
    const bajo = !!o.raicesBajo, asoma = bajo && k >= 6, l2 = k % 2 ? 1 : -1, [a, b] = F.bordes(base - (bajo ? 14 : 40)), esc = an / 210;
    const lim = bajo ? ((l2 > 0 ? o.raizDer : o.raizIzq) ?? Infinity) : Infinity;
    const sx = asoma ? (l2 > 0 ? b : a) + l2 * an * (0.02 + rr() * 0.22) : (l2 > 0 ? b : a) - l2 * an * (bajo ? 0.06 + rr() * 0.1 : 0.12 + rr() * 0.2);
    const sy = asoma ? base + 18 : bajo ? base - 10 - rr() * 14 : base - 60 - rr() * 50;
    let rl = asoma ? an * (0.16 + rr() * 0.2) : bajo ? an * (0.22 + rr() * 0.38) : Math.min(o.raizMax ?? Infinity, an * (0.45 + rr() * 0.8));   // raizMax: en el juego no pueden cruzar por encima de lo que se pisa
    if (bajo) rl = Math.max(asoma ? 0 : an * 0.06, Math.min(rl, lim - Math.abs(sx - x)));
    if (asoma && rl < an * 0.08) continue;
    const ex = sx + l2 * rl, ey = bajo ? base + 18 + (asoma ? 0 : 2 + rr() * 16) : base + 14;
    const w0 = (asoma ? 9 + rr() * 5 : bajo ? 15 + rr() * 9 - k : 24 + rr() * 12 - k * 2) * esc * (1 - d * 0.4), cx1 = sx + l2 * rl * (bajo ? 0.5 : 0.35), cy1 = asoma ? base - 14 - rr() * 10 : bajo ? base - 5 - rr() * 6 : base - 10;
    const qx = (t) => (1 - t) ** 2 * sx + 2 * (1 - t) * t * cx1 + t * t * ex, qy = (t) => (1 - t) ** 2 * sy + 2 * (1 - t) * t * cy1 + t * t * ey;
    const arr = [], abj = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12, w = lerp(w0, 2.5, Math.pow(t, 0.8)) / 2, x0 = qx(t), y0 = qy(t), dx = qx(Math.min(1, t + 0.01)) - qx(Math.max(0, t - 0.01)), dy = qy(Math.min(1, t + 0.01)) - qy(Math.max(0, t - 0.01)), n = Math.hypot(dx, dy) || 1; arr.push([x0 + (dy / n) * w * l2, y0 - Math.abs(dx / n) * w]); abj.push([x0 - (dy / n) * w * l2, y0 + Math.abs(dx / n) * w]); }
    const poli = [...arr, ...[...abj].reverse()];
    trazarSuave(g, poli); g.fillStyle = col(CEL.sombra[1]); g.fill();
    g.save(); trazarSuave(g, poli); g.clip();
    trazar(g, [...arr, ...[...arr].reverse().map(([px, py]) => [px, py + w0 * 0.35])]); g.fillStyle = col(l2 === ld ? CEL.ocreM[1] : CEL.medio[1]); g.fill();
    trazar(g, arr, false); g.strokeStyle = col(l2 === ld ? CEL.pico : CEL.medio[2]); g.lineWidth = 2.5; g.stroke();
    for (let i = 0; i < 3; i++) { const t = 0.15 + rr() * 0.6, m = 2 + rr() * 2.5, h = 12 + rr() * 16; trazar(g, [[qx(t) - l2 * h, qy(t) + 1], [qx(t), qy(t) - m], [qx(t) + l2 * h * 0.6, qy(t) + 2], [qx(t), qy(t) + m * 0.4]]); g.fillStyle = col(CEL.negro); g.fill(); }
    g.restore();
    if (d < 0.4) { trazarSuave(g, poli); tinta(g, 2.4 * (1 - d * 2)); }
    if (d < 0.5) {
      const lomo = arr.slice(0, 10).map(([px, py]) => [px, py + 2]);
      lomoMusgo(l2 > 0 ? lomo : lomo.reverse(), 6 * esc, ld, col, rr);
    }
  }
  // enredaderas que cuelgan
  if (o.colgajos) for (let k = 0; k < o.colgajos; k++) colgajo(x + (rr() - 0.5) * an * 1.4, top + rr() * (base - top) * 0.3, 60 + rr() * 260, d, sem + 400 + k);
}

// ---------------------------------------------------------------- RAMA: plataforma jugable (del arbol: lleva musgo encima)
export function rama(x, y, l, lado, d, sem) {
  // nace en el canto del tronco (que se curva): el pie se ensancha en horquilla y se mete un poco en la corteza
  { const F = troncoEn(x - lado * 40, y, d); if (F) { const [a, b] = F.bordes(y); x = (lado > 0 ? b : a) - lado * 10; } }
  const rr = azar(sem), ex = x + lado * l, ld = ladoLuz(x), col = (c) => entona(c, d, x);
  const eje = (t) => { const mt = 1 - t; return [mt * mt * x + 2 * mt * t * (x + lado * l * 0.5) + t * t * ex, mt * mt * (y + 8) + 2 * mt * t * (y - 18) + t * t * (y - 8)]; };
  const gro = (t) => (lerp(14, 4.5, Math.pow(t, 0.85)) + 5 * Math.pow(Math.max(0, 1 - t * 5), 2)) * (1 - d * 0.3);
  const N = 18, arr = [], abj = [];
  for (let i = 0; i <= N; i++) { const t = i / N, [px, py] = eje(t), e = (ruido1(i * 0.9, sem) - 0.5) * 2; arr.push([px, py - gro(t) + e]); abj.push([px, py + gro(t) * (1 + 0.25 * Math.max(0, 1 - t * 5)) + e]); }
  const poli = [...arr, ...[...abj].reverse()];
  trazarSuave(g, poli); g.fillStyle = col(CEL.sombra[1]); g.fill();
  g.save(); trazarSuave(g, poli); g.clip();
  // cel: vientre en sombra, lomo en el valor medio, labio de luz en el lomo (a tramos)
  trazar(g, [...arr, ...[...arr].reverse().map(([px, py], i) => [px, py + gro(1 - i / N) * 0.95])]); g.fillStyle = col(CEL.medio[1]); g.fill();
  g.lineWidth = 4; g.strokeStyle = col(CEL.ocreM[1]); g.lineCap = 'round'; trazar(g, arr.map(([px, py]) => [px, py + 1.5]), false); g.stroke();
  g.lineWidth = 2.4; g.strokeStyle = col(CEL.ocreL[1]);
  for (let i = 1; i < N - 1; i += 2 + Math.floor(rr() * 3)) { const j = Math.min(N, i + 2 + Math.floor(rr() * 3)); trazar(g, arr.slice(i, j + 1).map(([px, py]) => [px, py + 1.2]), false); g.stroke(); }
  // grietas en cuna a lo largo y grano
  for (let k = 0; k < l / 22; k++) { const t = 0.05 + rr() * 0.85, [px, py] = eje(t), h = 8 + rr() * 18, o = (rr() - 0.3) * gro(t); trazar(g, [[px - h, py + o + (rr() - 0.5) * 3], [px, py + o - 1.4 - rr()], [px + h, py + o + (rr() - 0.5) * 3], [px, py + o + 1.4]]); g.fillStyle = col(CEL.negro); g.fill(); }
  for (let k = 0; k < l * 1.5; k++) { const t = rr(), [px, py] = eje(t), o = (rr() - 0.5) * 2 * gro(t); g.fillStyle = rgba(col(rr() < 0.5 ? CEL.medio[2] : CEL.negro), 0.6); g.fillRect(px, py + o, 1.3, 1.3); }
  g.restore();
  // tinta solo por arriba y por abajo: por el pie se funde con el tronco
  if (d < 0.4) { trazarSuave(g, arr.slice(1), false); tinta(g, 2.4); trazarSuave(g, abj.slice(1), false); tinta(g, 2.4); g.beginPath(); g.moveTo(arr[N][0], arr[N][1]); g.lineTo(abj[N][0], abj[N][1]); tinta(g, 2.4); }
  // musgo en lomo, con hilos que cuelgan
  lomoMusgo((lado > 0 ? arr : [...arr].reverse()).filter((_, i, A) => i > 0 && i < A.length - 2).map(([px, py]) => [px, py + 3]), 13, ld, col, rr);
  // un manto mas gordo en la horquilla, donde para el agua
  { const pie = arr.slice(0, 8).map(([px, py]) => [px, py + 3]); lomoMusgo(lado > 0 ? pie : pie.reverse(), 17, ld, col, rr); }
  for (let k = 0; k < l / 40; k++) { const t = 0.1 + rr() * 0.75, [px, py] = eje(t); hilo(px, py + gro(t) - 1, 14 + rr() * 30, col, rr, 1.2); }
  for (let k = 0; k < 6; k++) colgajo(x + lado * (30 + rr() * l * 0.9), y - 2, 40 + rr() * 150, d, sem + 10 + k);
  hojas(ex + lado * 20, y - 40, 90, 55, d, sem + 30, { den: 0.9 });
  void musgo;
}

// ---------------------------------------------------------------- SETA DE REPISA (del tronco): sombrero oscuro, brillo crema verdoso
export function setaRepisa(x, y, s, lado, d, sem) {
  { const F = troncoEn(x, y, d); if (F) { const [a, b] = F.bordes(y); x = lado > 0 ? b - 3 : a + 3; } }
  const rr = azar(sem + 77), col = (c) => entona(c, d, x);
  s *= 1.35;
  g.save(); g.translate(x, y); g.scale(lado, 1);
  g.save(); g.globalCompositeOperation = 'lighter'; brillo(s * 0.9, s * 0.35, s * 2.6, '#d8e6c2', 0.18); g.restore();
  // una repisa grande y una o dos pequenas pegadas debajo: sombrero oscuro en cel, laminas que brillan crema verdoso
  const una = (ox, oy, k) => {
    const S = s * k;
    g.beginPath(); g.moveTo(ox, oy - S * 0.42); g.quadraticCurveTo(ox + S * 1.15, oy - S * 0.78, ox + S * 1.7, oy + S * 0.02); g.quadraticCurveTo(ox + S * 1.72, oy + S * 0.2, ox + S * 1.5, oy + S * 0.24);
    g.quadraticCurveTo(ox + S * 0.8, oy + S * 0.42, ox, oy + S * 0.3); g.closePath();
    g.fillStyle = col('#1c1a14'); g.fill();
    g.save(); g.clip();
    g.fillStyle = col('#2f2b22'); g.beginPath(); g.ellipse(ox + S * 0.75, oy - S * 0.38, S * 0.85, S * 0.28, -0.12, 0, 7); g.fill();
    g.strokeStyle = col('#7a6a49'); g.lineWidth = 1.6; g.beginPath(); g.moveTo(ox + S * 0.25, oy - S * 0.5); g.quadraticCurveTo(ox + S * 1.15, oy - S * 0.72, ox + S * 1.62, oy - S * 0.08); g.stroke();
    // laminas por debajo
    g.strokeStyle = 'rgba(226,236,204,.75)'; g.lineWidth = 1;
    g.beginPath(); for (let i = 1; i < 7; i++) { const t = i / 7; g.moveTo(ox + S * 0.15, oy + S * 0.27); g.lineTo(ox + S * (0.25 + t * 1.3), oy + S * (0.28 - t * 0.1) - 1); } g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(232,240,212,.85)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(ox + S * 0.1, oy + S * 0.3); g.quadraticCurveTo(ox + S * 0.9, oy + S * 0.36, ox + S * 1.55, oy + S * 0.22); g.stroke();
    if (d < 0.4) { g.beginPath(); g.moveTo(ox, oy - S * 0.42); g.quadraticCurveTo(ox + S * 1.15, oy - S * 0.78, ox + S * 1.7, oy + S * 0.02); g.quadraticCurveTo(ox + S * 1.72, oy + S * 0.2, ox + S * 1.5, oy + S * 0.24); g.quadraticCurveTo(ox + S * 0.8, oy + S * 0.42, ox, oy + S * 0.3); tinta(g, 1.4); }
  };
  una(0, 0, 1);
  if (rr() < 0.75) una(-s * 0.05, s * 0.55, 0.62 + rr() * 0.15);
  if (rr() < 0.4) una(s * 0.05, -s * 0.5, 0.5);
  g.restore();
}

// ---------------------------------------------------------------- SETAS QUE BRILLAN subiendo por el tronco
// Como las de la referencia: racimos en el canto del tronco, cada una con un pie que sale de la corteza hacia
// fuera y se dobla hacia arriba (pardo claro en cel, tinta), y encima la seta que brilla de suelo.js (su luz va
// a brillos). En racimos de 2-4 a alturas distintas, las grandes abajo; y = de y0 (abajo) a y1 (arriba).
export function setasTronco(x, y0, y1, lado, n, s, d, sem) {
  const rr = azar(sem), col = (c) => entona(c, d, x), lst = [];
  for (let k = 0; k < n; k++) {
    const t = (k + rr() * 0.7) / n, y = lerp(y0, y1, t), F = troncoEn(x, y, d);
    let bx = x; if (F) { const [a, b] = F.bordes(y); bx = lado > 0 ? b - 3 : a + 3; }
    const racimo = 1 + Math.floor(rr() * 3);
    for (let q = 0; q < racimo; q++) lst.push([bx, y + q * s * 1.1 + (rr() - 0.5) * s, s * (1 - t * 0.45) * (q ? 0.55 + rr() * 0.35 : 0.9 + rr() * 0.4), (q ? 0.6 : 1) * (s * 1.6 + rr() * s * 2.2)]);
  }
  lst.sort((a, b) => a[2] - b[2]);
  for (const [bx, by, ss, sale] of lst) {
    const ex = bx + lado * sale, ey = by - sale * 0.25, pw = Math.max(1.4, ss * 0.22);
    const pie = new Path2D(); pie.moveTo(bx, by - pw); pie.quadraticCurveTo(bx + lado * sale * 0.75, by - pw, ex - pw * 0.9, ey); pie.lineTo(ex + pw * 0.9, ey); pie.quadraticCurveTo(bx + lado * sale * 0.75, by + pw, bx, by + pw); pie.closePath();
    g.fillStyle = col('#8f8c72'); g.fill(pie); g.save(); g.clip(pie); g.fillStyle = col('#5e5c48'); g.translate(0, pw * 0.8); g.fill(pie); g.restore();
    if (d < 0.4) { g.strokeStyle = rgba(TINTA, 0.9); g.lineWidth = 1.1; g.stroke(pie); }
    setaLuz(ex, ey + 1, ss, d, Math.floor(ex * 3 + ey));
  }
}

// BANCO (?banco o ?banco=troncos): tres troncos de la capa JUEGO, el que mide musgo_banco/musgo_medir.
// Inclinados 3,5 grados sobre y = 800 para que los parches de musgo_banco (y 420-1180) sigan dentro del tronco.
export function banco() { for (const x of [400, 1100, 1800]) tronco(x, 1500, -100, 230, 0.04, x, { raices: true, recto: true, inclina: -0.061, pivote: 800 }); }
