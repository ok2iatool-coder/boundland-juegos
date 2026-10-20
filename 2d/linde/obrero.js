// EL LINDE en el juego (nivel 6): pinta en un HILO APARTE, con las piezas del concepto (web/linde/), lo que el
// nivel lleva de mas sobre su terreno por casillas: pintarlo lleva unos segundos y el juego no puede pararse.
//   fondo    tres capas de parallax (lejos 0,22, medio 0,45, cerca 0,7): cielo, bosque, penascos con cascadas,
//            viaducto, afueras y agujas de la ciudad, con su bruma y sus rayos, segun la seccion del nivel
//   piezas   el decorado del mapa (linde/nivel.js): arboles con sus ramas, la chatarra con musgo, el tocon, el agua,
//            la cascada, la cabana, los huertos, la granja, la aldea con sus capsulas y su puente, la pasarela de
//            hierro, las casas y el autobus de las afueras; cada una con su rectangulo en el mundo (u)
//   frente   el primer plano en silueta, que corre 1,25 veces el mundo
// Todo se pinta en px del concepto (el 18 a 0,52 de su hoja: un u son PXU px) y se devuelve como ImageBitmap.
// El hilo NO se cierra al acabar: con la tarjeta grafica, las ImageBitmap viven en su contexto (dibujo/linde.js).
import { T } from '../sim/constantes.js';
import { NIVELES } from '../sim/niveles.js';
import { azar, mezclar } from '../dibujo/tinta.js';
import { g, ponerG, ponerTerreno, ponerNiebla, ponerRelieve, SOL, haze, brillo, lerp } from './base.js';
import { PXU, formaTronco } from './geometria.js';
import { piezasDelLinde } from './nivel.js';
import { bruma, rayos, encenderLuces } from './escena.js';
import { tronco, rama, setaRepisa, setasTronco } from './troncos.js';
import { hojas, colgajo } from './follaje.js';
import { musgo, roca, cascada, grupoSetas, hierba } from './suelo.js';
import { chapa, autobus, pasarela, viaducto, valla, arana, coche, tendido, paradaBus } from './metal.js';
import { casaMadera, edificio, aguja, escalera } from './casas.js';
import { aldeaJuego } from './aldea.js';
import { autobusBosque, vigaCaida, tocon, lena, porche } from './piezas.js';
import { busDentro, busFuera } from './autobus_pasable.js';
import { aEscala, tablado, pilotes, colgadas, percha, lianaAncla, penasco, orilla, agua as aguaJuego, invernadero as invernaderoJuego, espantapajaros as espantapajarosJuego, huerto } from './atrezo.js';

// las piezas se escribieron para la pagina: crean lienzos con document y apuntan los troncos en window
self.window = self;
self.__troncos = [];
self.document = { createElement: () => new OffscreenCanvas(1, 1) };

const VW = 1024, VWMAX = 1400, VH = 576, CAMY = 192;     // la vista (u) y donde suele estar la camara con el 18 en el suelo
const SIN_ARROYO = { x0: -1e9, x1: -1e9 };
const AGUA_U = 3.2 * T;                                       // la lamina del agua, tantas u por encima del fondo del mapa
const px = (u) => u * PXU;
// setas en RACIMOS sueltos subiendo por un tronco (de uno en uno a paso fijo se leian como una escalera)
const racimos = (x, y0, y1, lado, grupos, s, d, sem) => { const r = azar(sem); for (let k = 0; k < grupos; k++) { const ya = lerp(y0, y1, (k + 0.15 + r() * 0.7) / grupos); setasTronco(x, ya, ya - 50 - r() * 50, r() < 0.75 ? lado : -lado, 2 + Math.floor(r() * 2), s, d, sem + k * 3); } };
// ESCALA DEL JUEGO: el 18 mide 50 u (137 px) y el mundo va a 64 u el metro (el coche de la ciudad). Las piezas del
// concepto se pintaron para un plano lejano y aqui se amplian con aEscala (atrezo.js): una casa a ESCALA_CASA
// tiene la puerta al doble de alto que el 18.
const ESCALA_CASA = 3;

function pintar() {
  ponerRelieve(true);                                         // troncos, copas y matas con volumen (base.js)
  const t0 = performance.now();
  const nivel = NIVELES.find((n) => n.zona === 'linde');
  const L = piezasDelLinde(nivel), ancho = L.ancho, alto = L.alto, C = T;
  const aldea = L.piezas.find((p) => p.pieza === 'aldea');
  // ---- la bruma por secciones (columnas del mapa) y el sol sobre la aldea
  const PARADAS = [[0, '#a3ad80'], [50, '#c0c28e'], [88, '#e2d8a4'], [133, '#f4e8b8'], [166, '#ddd6b8'], [180, '#cfcbbb']];
  const enCapa = (u, f) => (u - VW / 2) * f + VW / 2;               // donde cae en una capa (u) lo que en el mundo esta en u
  const delMundo = (lu, f) => (lu - VW / 2) / f + VW / 2;           // y al reves
  const niebla = (f) => ponerNiebla(PARADAS.map(([c, col]) => [px(enCapa(c * C, f)), col]), px(enCapa(aldea ? aldea.x : ancho * 0.7, f)));
  let hechas = 0; const total = 5 + L.piezas.length;
  const avisa = () => postMessage({ progreso: ++hechas / total });

  // un lienzo para un rectangulo de px del concepto, a k px por px
  const lienzo = (x0, y0, w, h, k) => { const c = new OffscreenCanvas(Math.max(1, Math.ceil(w * k)), Math.max(1, Math.ceil(h * k))); const x = c.getContext('2d'); x.setTransform(k, 0, 0, k, -x0 * k, -y0 * k); return { c, x, k, x0, y0, w, h }; };
  const conDesenfoque = (de, blur) => { if (!blur) return de; const a = lienzo(de.x0, de.y0, de.w, de.h, de.k); a.x.save(); a.x.setTransform(1, 0, 0, 1, 0, 0); a.x.filter = `blur(${blur * de.k}px)`; a.x.drawImage(de.c, 0, 0); a.x.restore(); return a; };

  // ================================================================= el fondo: tres capas de parallax
  const capas = [];
  const capa = (f, k, blur, fn) => {
    const fy = f * 0.6, lw = ancho * f + VWMAX * (1 - f) + 60, lh = alto * fy + VH * (1 - fy) + 60;
    const LG = px(alto * 0.79 - CAMY * (1 - fy));                    // la raya del suelo de esta capa (px)
    niebla(f);
    const l = lienzo(0, 0, px(lw), px(lh), k);
    ponerG(l.x); ponerTerreno(() => LG, SIN_ARROYO);
    const col = (lx) => delMundo(lx / PXU, f) / C;                   // la columna del mundo que cae en lx (px de la capa)
    fn(l.x, LG, px(lw), px(lh), col, (d) => {
      // la tierra bajo la raya del suelo de la capa, del color de su bruma (sin ella, por los huecos del mapa se veia cielo)
      for (let x = 0; x < px(lw); x += 24) { const gr = l.x.createLinearGradient(0, LG - 6, 0, px(lh)); gr.addColorStop(0, mezclar('#3a3624', haze(x), Math.min(0.9, d * 1.05))); gr.addColorStop(1, mezclar('#15130c', haze(x), Math.min(0.9, d * 0.8))); l.x.fillStyle = gr; l.x.fillRect(x, LG - 6, 25, px(lh) - LG + 6); }
    });
    encenderLuces(l.x);
    const d = conDesenfoque(l, blur);
    capas.push({ bmp: d.c.transferToImageBitmap(), f, fy, k, w: lw, h: lh });
    avisa();
  };
  // ---- LEJOS: cielo, troncos palidos y copas, agujas de la ciudad
  capa(0.22, 0.4, 3.5, (M, LG, W, H, col, tierra) => {
    M.fillStyle = '#e8e0c2'; M.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 8) { const hz = haze(x), gr = M.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, mezclar(hz, col(x) < 60 ? '#7d8c62' : '#b8b08a', 0.35)); gr.addColorStop(0.6, mezclar(hz, '#fff7dc', 0.3)); gr.addColorStop(1, hz); M.fillStyle = gr; M.fillRect(x, 0, 9, H); }
    M.save(); M.globalCompositeOperation = 'lighter'; brillo(SOL.x, 60, 2200, '#fff1c8', 0.3, M); brillo(SOL.x, 60, 520, '#fffbe8', 0.35, M); M.restore();
    tierra(0.86);
    const rr = azar(11);
    for (let x = -40; x < W; x += 110 + rr() * 150) {
      const c = col(x);
      if (c < 150) { tronco(x, LG - 30, -60, 40 + rr() * 60, 0.82 + rr() * 0.08, Math.floor(x)); hojas(x + (rr() - 0.5) * 100, 60 + rr() * 160, 180 + rr() * 120, 90 + rr() * 60, 0.82, Math.floor(x) + 7, { den: 0.35, tam: 9 }); }
      else aguja(x, LG + 10, 380 + rr() * 640, 50 + rr() * 70, 0.78 + rr() * 0.1, Math.floor(x));
    }
    for (let x = 0; x < W; x += 90 + rr() * 120) hojas(x, LG - 60 - rr() * 70, 90 + rr() * 90, 50 + rr() * 40, 0.87, Math.floor(x) + 9, { den: 0.35, tam: 8 });
    bruma(M, LG - 380, LG + 60, 0.42, 0, W);
    rayos(M, Math.round(W / 380), 0.06, 31, W);
  });
  // ---- MEDIO: penascos con cascadas y torres rotas (arroyo y aldea), arboles con copa (bosque y huertos),
  // el viaducto sobre los huertos, el deposito de agua y la grua de las afueras, bloques de la ciudad
  capa(0.45, 0.45, 1.4, (M, LG, W, H, col, tierra) => {
    const rr = azar(21), rc = azar(12), d = 0.46;
    tierra(0.5);
    const seccion = (x) => { const c = col(x); return c < 60 ? 'bosque' : c < 96 ? 'arroyo' : c < 124 ? 'huertos' : c < 162 ? 'aldea' : c < 174 ? 'afueras' : 'ciudad'; };
    // penascos en bancales con su cascada (antes, un monticulo redondo con corona de matas: se leian como almiares)
    for (let x = 0; x < W; x += 1100 + rc() * 700) {
      const s = seccion(x); if (s !== 'arroyo' && s !== 'aldea') continue;
      penasco(x, 280 + rc() * 170, LG - 520 - rc() * 170, LG + 10, 0.5, Math.floor(x));
    }
    // arboles con copa
    for (let x = 60; x < W; x += 230 + rr() * 170) {
      const s = seccion(x); if (s === 'afueras' || s === 'ciudad') continue;
      tronco(x, LG + 10, -80, 70 + rr() * 60, d, Math.floor(x), { colgajos: 4 });
      for (let k = 0; k < 3; k++) hojas(x + (rr() - 0.5) * 300, 40 + rr() * 260, 170 + rr() * 90, 90 + rr() * 50, d, Math.floor(x) + k * 13, { den: 0.55, tam: 8 });
    }
    // el viaducto de hierro sobre los huertos, con un vano caido y una arana encima
    { let a = null, b = null; for (let x = 0; x < W; x += 20) if (seccion(x) === 'huertos') { if (a === null) a = x; b = x; }
      if (a !== null && b - a > 600) { viaducto(a - 200, b + 200, LG - 500, LG + 10, 0.5, 23, { roto: (a + b) / 2 }); arana((a + b) / 2 - 300, LG - 500, 30, 0.5, 24); } }
    // afueras: deposito de agua, chimenea y grua; la ciudad
    for (let x = 0; x < W; x += 340) {
      const s = seccion(x);
      if (s === 'afueras' && rr() < 0.7) { const b = LG + 10; if (rr() < 0.5) { for (const p2 of [x - 70, x + 70]) chapa([[p2 - 6, b], [p2 - 6, b - 380], [p2 + 6, b - 380], [p2 + 6, b]], d, p2); chapa([[x - 110, b - 380], [x - 110, b - 520], [x - 70, b - 560], [x + 70, b - 560], [x + 110, b - 520], [x + 110, b - 380]], d, x + 1, { remaches: 20 }); } else chapa([[x - 40, b], [x - 28, b - 640], [x + 28, b - 640], [x + 40, b]], d, x + 5, { remaches: 14 }); }
      if (s === 'ciudad') edificio(x, LG + 10, 200 + rr() * 80, 560 + rr() * 300, d, Math.floor(x));
    }
    bruma(M, LG - 260, LG + 60, 0.26, 0, W);
    rayos(M, Math.round(W / 330), 0.05, 41, W);
  });
  // ---- CERCA: el borde de la copa arriba, arboles y matas, casas sobre pilotes (aldea), casas en hilera (afueras),
  // fachadas de la ciudad
  capa(0.7, 0.5, 0.6, (M, LG, W, H, col, tierra) => {
    const rr = azar(51), d = 0.3;
    tierra(0.3);
    const seccion = (x) => { const c = col(x); return c < 60 ? 'bosque' : c < 96 ? 'arroyo' : c < 124 ? 'huertos' : c < 162 ? 'aldea' : c < 174 ? 'afueras' : 'ciudad'; };
    for (let x = -100; x < W; x += 120 + rr() * 90) { const s = seccion(x); if (s === 'afueras' || s === 'ciudad') continue; hojas(x, -20 + rr() * (s === 'bosque' ? 200 : 110), 170 + rr() * 80, 90 + rr() * 50, d, Math.floor(x) + 2, { den: 0.75, tam: 8 }); }
    for (let x = 200; x < W; x += 420 + rr() * 220) { const s = seccion(x); if (s === 'bosque' || s === 'huertos') tronco(x, LG + 10, -40, 90 + rr() * 50, d, Math.floor(x) + 1, { colgajos: 6, raices: true }); }
    for (let x = 0; x < W; x += 70 + rr() * 90) { const s = seccion(x); if (s !== 'ciudad') hojas(x, LG - 20 - rr() * 40, 60 + rr() * 50, 34 + rr() * 22, d, Math.floor(x) + 3, { den: 0.8 }); }
    for (let x = 0; x < W; x += 380 + rr() * 240) {
      const s = seccion(x);
      // (a escala: en la capa de 0,7 una casa va algo menor que en el mundo; cada una distinta, con su escalera)
      if (s === 'aldea' && rr() < 0.75) {
        const e = 1.8 + rr() * 0.5, w = 105 + rr() * 75, h = 70 + rr() * 45, pil = 22 + rr() * 50, cx = x + (w * e) / 2, xl = cx - w / 2, b = LG + 10 - pil;
        const o = { luz: rr() < 0.8, humo: rr() < 0.3, chimenea: rr() < 0.6, puertaAlto: Math.min(h * 0.78, 80), puertaAncho: 36, chimeneaBaja: true, pared: rr() < 0.4 ? ['#7c7466', '#857152'][Math.floor(rr() * 2)] : undefined }, esc = rr() < 0.7;
        aEscala(cx, LG + 10, e, () => { for (const p2 of [xl + 8, xl + w - 8, ...(w > 150 ? [cx] : [])]) chapa([[p2 - 5, LG + 14], [p2 - 5, b], [p2 + 5, b], [p2 + 5, LG + 14]], d, p2); casaMadera(xl, w, h, b, d, Math.floor(x), { ...o, relieve: true }); if (esc) escalera(xl + w * 0.12 + 18, LG + 12, b + 2, d); });
      }
      if (s === 'afueras') { const e = 2.1, w = 80 + rr() * 30, h = 85 + rr() * 30, cx = x + (w * e) / 2; aEscala(cx, LG + 10, e, () => casaMadera(cx - w / 2, w, h, LG + 10, d, Math.floor(x) + 9, { pared: ['#7c7466', '#6e685c', '#857c6c'][Math.floor(rr() * 3)], tejado: '#45493c', luz: rr() < 0.4, chimenea: rr() < 0.5, puertaAlto: 70, puertaAncho: 32, chimeneaBaja: true, relieve: true })); }
      if (s === 'ciudad') edificio(x, LG + 10, 180 + rr() * 60, 300 + rr() * 100, d, Math.floor(x) + 7, { hiedra: 0.9 });
      if (s === 'afueras' && rr() < 0.3) arana(x + 80, LG - 20, 20, d + 0.1, Math.floor(x));
    }
    bruma(M, LG - 160, LG + 70, 0.14, 0, W);
    rayos(M, Math.round(W / 470), 0.04, 51, W);
  });

  // ================================================================= las piezas del decorado
  niebla(1);
  const piezas = [];
  const suelo = (p) => px(L.suelo(p.i0, p.j1 + 1) * C);               // el suelo bajo la pieza (px)
  for (const p of L.piezas) {
    const X = px(p.x), Yb = px(p.y);
    let caja = null, pinta = null, capaP = p.delante ? 'delante' : p.capa || 'fondo', k = 0.75, funde = null;
    switch (p.pieza) {
      case 'arbol': {
        // las raices, metidas en la tierra y sin pasar del suelo que tiene debajo (en una columna estrecha volaban)
        const jb = p.j1 + 1, ic = Math.floor(p.x / C), macizo = (i) => L.suelo(i, jb) === jb;
        let ia = ic, ib = ic; while (ia > 0 && macizo(ia - 1)) ia--; while (ib < ancho / C - 1 && macizo(ib + 1)) ib++;
        const an = p.an || 200, sem = Math.round(X), top = -560;
        const o = { raices: true, raicesBajo: true, raizIzq: px(p.x - ia * C) - px(10), raizDer: px((ib + 1) * C - p.x) - px(10), colgajos: 10 };
        const ramas = L.piezas.filter((q) => q.pieza === 'rama' && q.arbol === p);
        let a = X - an * 1.6 - 420, b = X + an * 1.6 + 420;
        for (const q of ramas) { a = Math.min(a, px(q.i0 * C) - 120); b = Math.max(b, px((q.i1 + 1) * C) + 120); }
        caja = [a, top - 300, b, Yb + 80];
        pinta = () => {
          tronco(X, Yb, top, an, 0.04, sem, o);
          const F = formaTronco(azar(sem), X, Yb, top, an, o).F;
          for (const q of ramas) {
            const y = px(q.j0 * C) + 20, lado = q.lado, borde = F.bordes(y)[lado > 0 ? 1 : 0] - lado * 10;
            const lejos = lado > 0 ? px((q.i1 + 1) * C) : px(q.i0 * C);
            rama(X + lado * 40, y, Math.abs(lejos - borde) + 6, lado, 0.02, sem + q.j0 * 7);
          }
          for (let k2 = 0; k2 < 4; k2++) setaRepisa(X + (k2 % 2 ? an * 0.42 : -an * 0.42), Yb - 150 - k2 * 66 - ((sem * (k2 + 3)) % 47), 16 + k2 * 2, k2 % 2 ? 1 : -1, 0, sem + k2);
          racimos(X, Yb - 60, Yb - 470, X < SOL.x ? -1 : 1, p.setas ? 3 : 2, 11, 0.04, sem + 1);
          grupoSetas(X + an * 0.7, Yb - 4, 4, 7, 0, sem + 2); grupoSetas(X - an * 0.75, Yb - 4, 3, 6, 0, sem + 3);
          for (const [dx, cy, rx, ry] of [[-300, -300, 300, 130], [250, -340, 300, 140], [-120, -160, 220, 90], [150, -120, 200, 80], [0, -460, 260, 110]]) hojas(X + dx, cy, rx, ry, 0.04, sem + dx, { den: 0.85 });
        };
        break;
      }
      case 'autobus_bosque': {
        // a la escala del juego (el autobus del nivel 8 mide 12 casillas) y con la viga apoyada en el arbol de al
        // lado. Sin la cisterna: a su escala no cabia sin taparle el barranco de zarzas
        const s = 1.875, xv = X + 480;
        caja = [X - 600, Yb - 640, X + 1000, Yb + 70];
        pinta = () => {
          aEscala(xv, Yb + 8, 1.5, () => vigaCaida(xv, Yb + 8, 0.06));
          aEscala(X, Yb, s, () => autobusBosque(X, Yb, 0.06));
          grupoSetas(X - 540, Yb - 2, 3, 7, 0.06, 1331);
          const rc = azar(61); for (let x = X - 520; x < X + 560; x += 46 + rc() * 60) hojas(x, Yb - 8 - rc() * 10, 34 + rc() * 30, 18 + rc() * 10, 0.06, Math.floor(x) + 61, { den: 0.9, mata: true });
        };
        break;
      }
      case 'tocon':
        // encima del terreno y mas alto: abajo, la hierba lo tapaba entero y el juego de los anillos no se veia
        caja = [X - 230, Yb - 220, X + 230, Yb + 60]; capaP = 'sobre';
        pinta = () => aEscala(X, Yb, 1.3, () => tocon(X, Yb - 85, Yb));
        break;
      case 'agua': {
        let i1 = p.i0; while (i1 + 1 < 400 && (nivel.mapa[p.j0][i1 + 1] ?? '#') !== '#') i1++;
        const x0 = px(p.i0 * C) - 6, x1 = px((i1 + 1) * C) + 6, ys = px(alto - AGUA_U), yb = px(alto) + 40;
        // la orilla de enfrente, detras de todo, desde el canto de la orilla MAS BAJA (la del estanque esta dos filas
        // por debajo de la de la izquierda: desde la alta, el rectangulo oscuro tapaba la aldea como un muro)
        { let jl = p.j0; while (jl > 0 && (nivel.mapa[jl - 1][p.i0 - 1] ?? '#') === '#') jl--;
          let jr = p.j0; while (jr > 0 && (nivel.mapa[jr - 1][i1 + 1] ?? '#') === '#') jr--;
          const yt = px(Math.max(jl, jr) * C) - 4, l = lienzo(x0 - 20, yt - 50, x1 - x0 + 40, ys - yt + 80, 0.6); ponerG(l.x);
          orilla(x0 - 20, x1 + 20, yt, ys, p.i0 * 13);
          piezas.push({ bmp: l.c.transferToImageBitmap(), x: (x0 - 20) / PXU, y: (yt - 50) / PXU, w: (x1 - x0 + 40) / PXU, h: (ys - yt + 80) / PXU, capa: 'fondo', pieza: 'barranco' }); }
        caja = [x0, ys - 30, x1, yb]; capaP = 'delante'; k = 0.6;
        pinta = () => aguaJuego(x0, x1, ys, yb, 77 + p.i0);
        break;
      }
      case 'cascada': {
        const x0 = px(p.i0 * C) - 6, ys = px(p.j0 * C), yb = px(alto - AGUA_U);
        caja = [x0 - 120, ys - 40, x0 + 170, yb + 90];
        pinta = () => { roca([[x0 - 30, ys + 30], [x0 - 20, ys - 10], [x0 + 30, ys - 22], [x0 + 70, ys - 6], [x0 + 74, ys + 26]], 0.1, 7401); cascada(x0, ys + 6, yb, 46, 0.12, 7402, { velo: 0.22 }); };
        break;
      }
      // a la escala del juego (ESCALA_CASA): puerta de persona, el doble de alta que el 18
      case 'cabana': {
        // la cabana de Meshy (img/linde/cabana.webp, de tools/cabana_meshy.py), 1 px de la imagen = 1 px del concepto,
        // con su ancla en el centro de la cabana y en el suelo; la bruma del sitio por encima y sus luces encendidas.
        // Si no carga, la de siempre, pintada
        // la dibuja linde/casa3d.js en 3D (el modelo de Meshy) en el hilo principal
        if (CASA_3D) continue;
        if (CASA) {
          const { bmp, d } = CASA, x0 = X - d.ancla[0], y0 = Yb - d.ancla[1];
          caja = [x0 - 40, y0 - 420, x0 + d.ancho + 40, y0 + d.alto + 10];
          pinta = () => {
            g.drawImage(bmp, x0, y0);
            g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.2; g.fillStyle = haze(X); g.fillRect(x0, y0, d.ancho, d.alto); g.restore();
            // humo de la chimenea (manchas que se abren al subir, como el de las casas pintadas)
            const [hx, hy] = [x0 + d.humo[0], y0 + d.humo[1]];
            for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(155,151,138,${0.1 - k * 0.012})`; g.beginPath(); g.arc(hx + (k * 9 + Math.sin(k) * 6) * 2.4, hy - (16 + k * 26) * 2.4, (10 + k * 5) * 2.4, 0, 7); g.fill(); }
            g.save(); g.globalCompositeOperation = 'lighter';
            for (const l of d.luces) { brillo(x0 + l.x, y0 + l.y, l.r * 2.6, '#ffcf7a', l.a * 0.5); brillo(x0 + l.x, y0 + l.y, l.r, '#fff0c4', l.a); }
            g.restore();
          };
          break;
        }
        const s = ESCALA_CASA; caja = [X - 130 * s, Yb - 480 * s, X + 150 * s, Yb + 60]; pinta = () => aEscala(X, Yb, s, () => casaMadera(X - 100, 200, 110, Yb, 0, 3420, { luz: true, humo: true, puertaAlto: 90, puertaAncho: 40, chimeneaBaja: true, relieve: true })); break;
      }
      case 'lena': {
        if (CASA) continue;                                   // la cabana de Meshy trae su lena apilada
        const s = 1.9; caja = [X - 90 * s, Yb - 110 * s, X + 130 * s, Yb + 40]; pinta = () => aEscala(X, Yb, s, () => lena(X - 60, Yb)); break; }
      case 'valla': { const s = 2.8; caja = [X - 80 * s, Yb - 80 * s, X + 80 * s, Yb + 40]; pinta = () => aEscala(X, Yb, s, () => valla(X - 60, X + 60, 0)); break; }
      case 'espantapajaros': caja = [X - 640, Yb - 400, X + 180, Yb + 50]; pinta = () => { huerto(X - 600, X - 150, Yb, 1090); espantapajarosJuego(X, Yb, 1095); }; break;
      case 'invernadero': caja = [X - 440, Yb - 620, X + 440, Yb + 50]; pinta = () => invernaderoJuego(X, Yb, 520, 470, 1150); break;
      case 'granja': { const s = ESCALA_CASA; caja = [X - 140 * s, Yb - 320 * s, X + 150 * s, Yb + 60];
        pinta = () => { aEscala(X, Yb, s, () => casaMadera(X - 115, 230, 115, Yb, 0, 4880, { pared: '#857152', luz: true, puertaAlto: 90, puertaAncho: 40, chimeneaBaja: true, relieve: true })); aEscala(X + 60, Yb, 2.2, () => porche(X + 60, Yb - 150, { campanillas: 0.42, relieve: true })); }; break; }
      case 'casa': { const s = ESCALA_CASA, base = suelo(p), w = 160 + (p.i0 % 2) * 22, h = 104 + (p.i0 % 3) * 8;
        caja = [X - (w / 2 + 40) * s, base - (h + w * 0.45 + 160) * s, X + (w / 2 + 40) * s, base + 60];
        pinta = () => aEscala(X, base, s, () => casaMadera(X - w / 2, w, h, base, 0, Math.round(X), { pared: ['#7c7466', '#6e685c', '#857c6c'][p.i0 % 3], tejado: '#45493c', luz: p.i0 % 2 === 0, chimenea: p.i0 % 2 === 1, puertaAlto: 90, puertaAncho: 40, chimeneaBaja: true, relieve: true })); break; }
      case 'autobus': {
        const x0 = px(p.i0 * C), w = px((p.i1 - p.i0 + 1) * C), base = px((p.j1 + 1) * C), top = px(p.j0 * C), h = base - top;
        // el autobus ocupa sus casillas (12 x 4) y SE ATRAVIESA (linde/autobus_pasable.js): el interior va detras del 18
        // (con la parada y el tendido, que no se desvanecen) y la carroceria delante, desvaneciendose con el 18 dentro
        { const cj = [x0 - 420, base - 760, x0 + w + 640, base + 40], li = lienzo(cj[0], cj[1], cj[2] - cj[0], cj[3] - cj[1], 0.75);
          ponerG(li.x); ponerTerreno(() => suelo(p), SIN_ARROYO); self.__troncos = [];
          aEscala(x0, base, 2, () => { tendido([x0 - 150, x0 + w / 2 + 240]); paradaBus(x0 - 100); });
          busDentro(x0, base, w, h, 6520);
          encenderLuces(li.x);
          piezas.push({ bmp: li.c.transferToImageBitmap(), x: cj[0] / PXU, y: cj[1] / PXU, w: (cj[2] - cj[0]) / PXU, h: (cj[3] - cj[1]) / PXU, capa: 'fondo', pieza: 'autobus_dentro' }); }
        caja = [x0 - 80, base - h - 220, x0 + w + 90, base + 40]; capaP = 'sobre'; funde = [p.i0 * C, (p.i1 + 1) * C];
        pinta = () => busFuera(x0, base, w, h, 6520);
        break;
      }
      case 'aldea': {
        const plataformas = L.piezas.filter((q) => q.pieza === 'plataforma').map((q) => ({ x0: px(q.i0 * C), x1: px((q.i1 + 1) * C), y: px(q.j0 * C) })).sort((a, b) => b.y - a.y);
        const puentes = L.piezas.filter((q) => q.pieza === 'puente').map((q) => ({ x0: px(q.i0 * C) - 8, x1: px((q.i1 + 1) * C) + 8, y: px(q.j0 * C), huecos: q.tablas.map((i) => [px(i * C), px((i + 1) * C)]) }));
        const xs = [X - 900, ...plataformas.map((q) => q.x0 - 200), ...puentes.map((q) => q.x0 - 60)], xe = [X + 900, ...puentes.map((q) => q.x1 + 120)];
        caja = [Math.min(...xs), -900, Math.max(...xe), suelo(p) + 80]; k = 0.7;
        // capsulas a la escala del 18 y los puentes como tablado de tablas (los del concepto eran de 10 px y en el
        // juego se leian como un cable)
        pinta = () => { aldeaJuego({ x: X, base: suelo(p), plataformas, puentes, sinPuentes: true, capsulaMax: 170, capsulaK: 0.42 }, 0.06); for (const pu of puentes) tablado(pu.x0 + 8, pu.x1 - 8, pu.y, { puente: true, huecos: pu.huecos, semilla: Math.round(pu.x0) }); };
        break;
      }
      case 'tronco_hueco': {
        // el arbol colosal del tunel: su tronco es el macizo del mapa (lo tapa entero) y su base esta HUECA: el tunel
        // pasa por dentro. Las raices que cierran la entrada son las suyas (el Hack 3, actores.js)
        const x0 = px(p.i0 * C), x1 = px((p.i1 + 1) * C), X2 = (x0 + x1) / 2, an = (x1 - x0) * 1.38, base = px(L.suelo(p.i0, p.j1 + 1) * C), sem = 6101;
        // (hasta la camara de raices de debajo: el mapa baja cuatro filas por dentro del arbol)
        caja = [X2 - an * 1.9 - 420, -980, X2 + an * 1.9 + 420, base + px(5 * C)]; capaP = 'sobre';
        pinta = () => {
          // (raices cortas: la de la derecha cruzaba por encima de la pasarela del arroyo como una rampa)
          tronco(X2, base, -760, an, 0.03, sem, { raices: true, colgajos: 16, recto: true, raizMax: 170 });
          racimos(X2, base - 140, base - 700, -1, 3, 13, 0.03, sem + 1);
          racimos(X2, base - 180, base - 560, 1, 2, 10, 0.03, sem + 2);
          // el hueco: un arco oscuro de lado a lado, con luz al fondo (del otro lado entra el dia)
          const h0 = x0 + 6, h1 = x1 - 6, ya = px((p.j1 + 1) * C) - 34;
          const arco = () => { g.beginPath(); g.moveTo(h0, base + 8); g.lineTo(h0, ya + 70); g.quadraticCurveTo(h0 + 10, ya - 6, X2, ya - 18); g.quadraticCurveTo(h1 - 10, ya - 6, h1, ya + 70); g.lineTo(h1, base + 8); g.closePath(); };
          arco(); const gr = g.createLinearGradient(h0, 0, h1, 0); gr.addColorStop(0, '#0a0906'); gr.addColorStop(0.7, '#1a1710'); gr.addColorStop(1, '#4a4530'); g.fillStyle = gr; g.fill();
          // por dentro: la madera del hueco (vetas que siguen la boveda), el suelo que alcanza la luz del otro lado
          // y la boca de salida encendida (antes era una losa negra lisa)
          g.save(); arco(); g.clip();
          const rv = azar(6120);
          for (let k = 0; k < 16; k++) { const f = (k + 0.5) / 16, xx = lerp(h0, h1, f), off = (rv() - 0.5) * 30; g.strokeStyle = `rgba(${f > 0.7 ? '120,104,70' : '58,48,30'},${0.35 + rv() * 0.3})`; g.lineWidth = 1.4 + rv() * 2; g.beginPath(); g.moveTo(xx + off, base + 10); g.quadraticCurveTo(xx + off * 0.3, ya + 40, lerp(xx, X2, 0.5), ya - 10); g.stroke(); }
          brillo(h1 + 40, base - 60, 260, '#e8dcae', 0.35);
          g.globalCompositeOperation = 'lighter'; brillo(h1 - 30, base - 10, 200, '#f2e6b8', 0.28); brillo(lerp(h0, h1, 0.6), base + 4, 180, '#d9c99a', 0.14);
          g.globalCompositeOperation = 'source-over';
          g.fillStyle = 'rgba(20,18,12,.55)'; g.fillRect(h0, base - 6, h1 - h0, 14);
          g.restore();
          arco(); g.lineWidth = 9; g.strokeStyle = '#3a3122'; g.stroke(); arco(); g.lineWidth = 2.6; g.strokeStyle = '#0b0a0c'; g.stroke();
          const rq = azar(6140);
          for (let k = 0; k < 10; k++) colgajo(h0 + 20 + rq() * (h1 - h0 - 40), ya - 4, 40 + rq() * 90, 0.03, 6150 + k);
          grupoSetas(h0 + 60, base - 2, 3, 5, 0.03, 6160); grupoSetas(h1 - 90, base - 2, 2, 5, 0.03, 6161);
          for (const [dx, cy, rx, ry] of [[-320, -640, 330, 140], [300, -700, 340, 150], [-140, -500, 260, 100], [190, -470, 240, 90], [0, -820, 300, 120]]) hojas(X2 + dx, cy, rx, ry, 0.03, sem + dx, { den: 0.85 });
          raicesDelHueco(p, base, ya);
        };
        break;
      }
      case 'pasarela': {
        const x0 = px(p.i0 * C) - 30, x1 = px((p.i1 + 1) * C) + 30, y = px(p.j0 * C);
        caja = [x0 - 40, y - 80, x1 + 40, px(alto) + 20];
        pinta = () => pasarela(x0, x1, y, px(alto - AGUA_U), 0, 91 + p.i0);
        break;
      }
      case 'tablado': {
        // la pasarela por las copas: tablas colgadas de las ramas, con barandilla de cuerda (la pintaba el terreno
        // como una tabla suelta con hierba encima, flotando entre dos arboles)
        const x0 = px(p.i0 * C), x1 = px((p.i1 + 1) * C), y = px(p.j0 * C);
        caja = [x0 - 220, y - 1180, x1 + 220, y + 90];
        pinta = () => tablado(x0, x1, y, { copas: true, huecos: (p.tablas || []).map((i) => [px(i * C), px((i + 1) * C)]), semilla: 9100 + p.i0 });
        break;
      }
      case 'tablas': {
        // lo que aguanta una fila de tablas podridas: pilotes sobre el agua o cuerdas que suben a las ramas
        const x0 = px(p.i0 * C), x1 = px((p.i1 + 1) * C), y = px(p.j0 * C);
        if (p.agua) { const ys = px(alto - AGUA_U); caja = [x0 - 60, y - 20, x1 + 60, ys + 130]; pinta = () => pilotes(x0, x1, y, ys, 9200 + p.i0); }
        else { caja = [x0 - 140, y - 1060, x1 + 140, y + 60]; pinta = () => colgadas(x0, x1, y, 9300 + p.i0); }
        break;
      }
      case 'cuerda': {
        // de donde cuelga una cuerda: una percha que sale del tablero de al lado (antes colgaba de nada)
        if (p.xp === null) continue;
        const xr = px(p.x), yTop = px(p.y - 6), xp = px(p.xp), yd = px(p.yDeck);
        caja = [Math.min(xr, xp) - 70, yTop - 90, Math.max(xr, xp) + 70, yd + 130]; capaP = 'sobre';
        pinta = () => percha(xr, yTop, xp, yd, 9400 + p.i0);
        break;
      }
      case 'ancla': {
        // la anilla del gancho cuelga de una liana que baja de las ramas (antes flotaba en el aire)
        const x = px(p.x), y = px(p.y);
        caja = [x - 300, y - 1250, x + 300, y + 20];
        pinta = () => lianaAncla(x, y, 9500 + p.i0);
        break;
      }
      case 'pena': {
        // la roca de la salida del conducto: tapa su bloque de casillas (como el arbol colosal tapa el suyo; el
        // terreno lo pintaba como un cuadrado negro en el cielo), con raices debajo y la copa por encima
        const X5 = px((p.i1 + 1) * C + 14), Y5 = px(5 * C + 16), X2 = px(2 * C + 12), Y12 = px((p.j1 + 1) * C + 4);
        caja = [-120, -420, X5 + 160, Y12 + 40]; capaP = 'sobre';
        pinta = () => {
          roca([[-90, -330], [X5 + 40, -330], [X5 + 8, px(1.5 * C)], [X5 + 22, px(3 * C)], [X5 - 6, Y5 - 30], [X5 - 40, Y5 + 6], [px(3.4 * C), Y5 + 18], [X2 + 14, Y5 + 34], [X2 - 2, px(7.5 * C)], [X2 + 10, px(9.5 * C)], [X2, Y12], [-90, Y12]], 0.08, 7700);
          const rp = azar(7701);
          for (let k = 0; k < 7; k++) colgajo(px(2.4 * C) + rp() * (X5 - px(2.6 * C)), Y5 + 10, 50 + rp() * 120, 0.06, 7710 + k);
          for (let x = -60; x < X5; x += 70 + rp() * 60) hojas(x, -300 + rp() * 30, 70 + rp() * 50, 30 + rp() * 20, 0.06, Math.floor(x) + 7720, { den: 0.85 });
          grupoSetas(X2 + 30, Y12 - 2, 3, 6, 0.06, 7730);
        };
        break;
      }
      default: continue;      // ramas y plataformas van con su arbol o con la aldea
    }
    const l = lienzo(caja[0], caja[1], caja[2] - caja[0], caja[3] - caja[1], k);
    ponerG(l.x); ponerTerreno(() => suelo(p), SIN_ARROYO); self.__troncos = [];
    pinta();
    encenderLuces(l.x);
    piezas.push({ bmp: l.c.transferToImageBitmap(), x: caja[0] / PXU, y: caja[1] / PXU, w: (caja[2] - caja[0]) / PXU, h: (caja[3] - caja[1]) / PXU, capa: capaP, pieza: p.pieza, ...(funde ? { funde } : {}) });
    avisa();
  }

  // ================================================================= el primer plano (corre 1,25 veces el mundo)
  // Solo por el canto de abajo (lo macizo bajo el suelo jugable): subia 4 filas y tapaba las zarzas del barranco.
  let frente = null;
  { const f = 1.25, a = -(f - 1) * (ancho - VW) / 2 - 80, b = (ancho - VW) * (f + 1) / 2 + VWMAX + 80, y0 = -160, y1 = alto + 40;
    const l = lienzo(px(a), px(y0), px(b - a), px(y1 - y0), 0.4);
    ponerG(l.x); const rr = azar(99), H = px(alto), NEG = { osc: '#070805', med: '#0e1108', cla: '#1a200e', luz: '#3c3c1c', den: 0.7, tam: 12 };
    const colDe = (x) => ((x / PXU + (f - 1) * (ancho - VW) / 2) / f) / C;
    for (let x = px(a); x < px(b); x += 140 + rr() * 220) {
      const c = colDe(x), y = H + 30 - rr() * 50;
      if (c > 166 ? rr() < 0.6 : rr() < 0.1) {
        const w = 160 + rr() * 220, yy = H - 30 - rr() * 40; g.fillStyle = '#070706';
        g.fillRect(x, yy, w, 34); g.fillRect(x + w - 34, yy - 120, 34, 154); g.beginPath(); g.arc(x + w * 0.4, yy + 17, 30, 0, 7); g.fill(); g.fillRect(x + w * 0.4 - 4, yy - 40, 8, 40); g.fillRect(x + w * 0.4 - 26, yy - 46, 52, 10); g.fillRect(x, yy + 34, w * 0.8, H - yy + 40);
      } else hojas(x, y, 140 + rr() * 110, 60 + rr() * 40, 0, Math.floor(x) + 5, NEG);
    }
    for (let x = px(a); x < px(b); x += 500 + rr() * 600) if (colDe(x) < 124) for (let k = 0; k < 4; k++) colgajo(x + k * 30, px(y0) + 40, 160 + rr() * 300, 0, Math.floor(x) + k);
    const d = conDesenfoque(l, 5);
    d.x.save(); d.x.setTransform(1, 0, 0, 1, 0, 0); d.x.globalCompositeOperation = 'lighter';
    for (let n = 0; n < (b - a) / 90; n++) { const x = rr() * d.c.width, y = d.c.height - rr() * 60; const gr = d.x.createRadialGradient(x, y, 0, x, y, 4 + rr() * 9); gr.addColorStop(0, `rgba(255,230,168,${0.3 + rr() * 0.3})`); gr.addColorStop(1, 'rgba(255,230,168,0)'); d.x.fillStyle = gr; d.x.fillRect(x - 14, y - 14, 28, 28); }
    d.x.restore();
    frente = { bmp: d.c.transferToImageBitmap(), x: a, y: y0, w: b - a, h: y1 - y0, f };
    avisa();
  }
  const bmps = [...capas.map((c) => c.bmp), ...piezas.map((p) => p.bmp), frente.bmp];
  postMessage({ capas, piezas, frente, ms: Math.round(performance.now() - t0) }, bmps);
}

// la cabana de Meshy se carga antes de pintar (fetch + createImageBitmap tambien van en un hilo)
let CASA = null;
const CASA_3D = true;
async function cargarCasa() {
  try {
    const url = (f) => new URL('../img/linde/' + f, import.meta.url);
    const d = await (await fetch(url('cabana.json'))).json();
    const bmp = await createImageBitmap(await (await fetch(url('cabana.webp'))).blob());
    CASA = { bmp, d };
  } catch (e) { CASA = null; }
}
self.onmessage = async () => {
  await cargarCasa();
  try { pintar(); } catch (e) { postMessage({ error: String(e && e.stack || e) }); }
};

// LO DE DEBAJO DEL ARBOL COLOSAL (pedido del 2026-10-18: que El Linde tambien baje): en la base hueca una CORTINA
// DE RAICES (las casillas macizas que cortan el tunel) y, debajo del suelo, la CAMARA de raices por la que se pasa:
// tierra oscura, raices que cuelgan del techo, setas que brillan en el fondo. Las casillas las da el mapa (macizo en
// la cortina, aire en la camara); aqui se buscan en el nivel y se pintan encima del terreno.
function raicesDelHueco(p, base, ya) {
  const n = NIVELES.find((q) => q.id === 6), M = n.mapa, ch = (i, j) => (M[j] ? M[j][i] ?? ' ' : '#');
  const C = T, rr = azar(6201);
  // la camara: el aire por debajo del suelo de la base (fila p.j1 + 1) entre las columnas del tronco
  let c0 = 99999, c1 = -1, f1 = -1;
  for (let i = p.i0; i <= p.i1; i++) for (let j = p.j1 + 4; j < M.length; j++) if (ch(i, j) === ' ') { c0 = Math.min(c0, i); c1 = Math.max(c1, i); f1 = Math.max(f1, j); }
  if (c1 >= 0) {
    const xa = px(c0 * C) - 6, xb = px((c1 + 1) * C) + 6, ys = base - 4, yf = px((f1 + 1) * C);
    const gr = g.createLinearGradient(0, ys, 0, yf);
    gr.addColorStop(0, '#0b0906'); gr.addColorStop(0.6, '#15110a'); gr.addColorStop(1, '#22190e');
    g.save(); g.beginPath(); g.moveTo(xa, ys); g.lineTo(xb, ys); g.lineTo(xb - 4, yf); g.lineTo(xa + 4, yf); g.closePath(); g.fillStyle = gr; g.fill(); g.clip();
    // vetas de la tierra y piedras metidas en ella
    for (let k = 0; k < 26; k++) { const x = lerp(xa, xb, rr()), y = lerp(ys, yf, rr()); g.fillStyle = `rgba(${60 + rr() * 30},${48 + rr() * 20},${30 + rr() * 14},${0.18 + rr() * 0.2})`; g.beginPath(); g.ellipse(x, y, 6 + rr() * 16, 3 + rr() * 6, rr() * 3, 0, 7); g.fill(); }
    // raices que cuelgan del techo de la camara (las del arbol, gruesas arriba y finas abajo)
    for (let k = 0; k < 14; k++) {
      const x = lerp(xa + 10, xb - 10, (k + rr()) / 14), l = 40 + rr() * (yf - ys) * 0.7;
      g.strokeStyle = k % 3 ? '#2c2416' : '#3d3220'; g.lineWidth = 2 + rr() * 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, ys); g.bezierCurveTo(x + (rr() - 0.5) * 30, ys + l * 0.4, x + (rr() - 0.5) * 40, ys + l * 0.7, x + (rr() - 0.5) * 24, ys + l); g.stroke();
      g.strokeStyle = 'rgba(150,128,84,.25)'; g.lineWidth = 1; g.stroke();
    }
    // setas que brillan en el fondo (la luz la pone linde/luces.js)
    grupoSetas(lerp(xa, xb, 0.3), yf - 2, 3, 4, 0.03, 6210); grupoSetas(lerp(xa, xb, 0.78), yf - 2, 2, 4, 0.03, 6211);
    g.globalCompositeOperation = 'lighter'; brillo(lerp(xa, xb, 0.5), yf - 30, 160, '#c9d9a0', 0.16); g.globalCompositeOperation = 'source-over';
    g.restore();
  }
  // la cortina de raices: lo macizo dentro de la base hueca (por encima del suelo, debajo del tronco)
  let r0 = 99999, r1 = -1;
  for (let i = p.i0; i <= p.i1; i++) for (let j = p.j1 + 1; j <= p.j1 + 3; j++) if (ch(i, j) === '#') { r0 = Math.min(r0, i); r1 = Math.max(r1, i); }
  if (r1 >= 0) {
    const xa = px(r0 * C), xb = px((r1 + 1) * C), yt = ya - 20, yb = base + 4;
    g.fillStyle = '#120f09'; g.fillRect(xa + 4, yt + 20, xb - xa - 8, yb - yt - 20);
    for (let k = 0; k < 34; k++) {
      const x = lerp(xa - 6, xb + 6, rr()), x2 = x + (rr() - 0.5) * 40;
      g.strokeStyle = ['#2a2214', '#3a2e1c', '#4a3c24'][k % 3]; g.lineWidth = 3 + rr() * 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, yt + rr() * 20); g.bezierCurveTo(x + (rr() - 0.5) * 50, lerp(yt, yb, 0.35), x2 + (rr() - 0.5) * 50, lerp(yt, yb, 0.7), x2, yb + rr() * 8); g.stroke();
      g.strokeStyle = '#0b0a0c'; g.lineWidth = 1.2; g.stroke();
    }
    for (let k = 0; k < 6; k++) colgajo(lerp(xa, xb, rr()), yt + 10, 30 + rr() * 50, 0.03, 6230 + k);
  }
}
