// LA CIUDAD en el juego (niveles 7 y 8): pinta en un HILO APARTE, con las piezas de web/ciudad/piezas.js y el
// hierro del Linde, lo que la calle lleva de mas sobre su terreno por casillas. Como El Linde (linde/obrero.js):
//   fondo    cinco capas de parallax: el cielo de nubes a contraluz; la ciudad gotica lejana (catedrales, agujas que
//            se deshacen en esqueleto, cupulas de costillas); torres esqueleto y el PASO ELEVADO de arcos con los
//            soldados de la Podredumbre; el plano medio (bloques rotos, semaforos, torres de la luz, farolas con
//            banderola, barreras); y los ARMAZONES de hormigon cercanos con sus orbes encendidos
//   piezas   lo del mapa (ciudad/nivel.js): el edificio de cada sala, la fachada del bloque, el paso elevado de la
//            losa, farolas, semaforos, coches, barreras y escombros de la calle
//   frente   el primer plano en silueta (vallas, varillas, cascotes), que corre 1,25 veces el mundo
// Todo en el MUNDO COMUN de los dos niveles (ciudad/nivel.js) y en px del concepto (un u son PXU px).
// El hilo NO se cierra al acabar: con la tarjeta grafica, las ImageBitmap viven en su contexto.
import { T } from '../sim/constantes.js';
import { azar, mezclar } from '../dibujo/tinta.js';
import { g, ponerG, ponerTerreno, ponerNiebla, SOL, haze, brillo, luces as lucesPintadas, brillos } from '../linde/base.js';
import { PXU } from '../linde/geometria.js';
import { bruma, rayos, encenderLuces } from '../linde/escena.js';
import { chapa, coche } from '../linde/metal.js';
import { edificio, aguja } from '../linde/casas.js';
import { mundoCiudad, FAROLA } from './nivel.js';
import { torreGotica, cupula, catedral, torreEsqueleto, pasoElevado, farolaSimple, soldadoSilueta, farolaCiudad, semaforo, torreLuz, barrera, escombros, armazon, hongos, venas, oxido, bidon, neumaticos, tuboHormigon, furgoneta, vallaObra } from './piezas.js';

// las piezas se escribieron para una pagina: crean lienzos con document
self.window = self;
self.__troncos = [];
self.document = { createElement: () => new OffscreenCanvas(1, 1) };

const VW = 1024, VWMAX = 1400, VH = 576;
const CAMY = 32;              // la camara con el 18 en la calle (en los dos niveles, en el mundo comun)
const px = (u) => u * PXU;
const SIN_ARROYO = { x0: -1e9, x1: -1e9 };

function pintar() {
  const t0 = performance.now();
  const M = mundoCiudad(), ancho = M.ancho, alto = M.alto, C = T;
  const SUELO7 = 16 * C;                                         // la calle del nivel 7 (mundo comun, u)
  // ---- la bruma: gris calido, mas clara hacia donde esta el sol (sobre la union de los dos niveles)
  const SOLX = M.W7 * C * 0.98;
  const PARADAS = [[0, '#b8b0a3'], [ancho * 0.22, '#c6bdae'], [SOLX, '#dcd1bc'], [ancho * 0.78, '#c8bfb0'], [ancho, '#b6aea2']];
  const enCapa = (u, f) => (u - VW / 2) * f + VW / 2;
  const delMundo = (lu, f) => (lu - VW / 2) / f + VW / 2;
  const niebla = (f) => ponerNiebla(PARADAS.map(([u, col]) => [px(enCapa(u, f)), col]), px(enCapa(SOLX, f)));
  const piezasMapa = M.piezas.length + M.marcas.length;
  let hechas = 0; const total = 7 + piezasMapa + M.calle.length * 2;
  const avisa = () => postMessage({ progreso: Math.min(1, ++hechas / total) });

  const lienzo = (x0, y0, w, h, k) => { const c = new OffscreenCanvas(Math.max(1, Math.ceil(w * k)), Math.max(1, Math.ceil(h * k))); const x = c.getContext('2d'); x.setTransform(k, 0, 0, k, -x0 * k, -y0 * k); return { c, x, k, x0, y0, w, h }; };
  const conDesenfoque = (de, blur) => { if (!blur) return de; const a = lienzo(de.x0, de.y0, de.w, de.h, de.k); a.x.save(); a.x.setTransform(1, 0, 0, 1, 0, 0); a.x.filter = `blur(${blur * de.k}px)`; a.x.drawImage(de.c, 0, 0); a.x.restore(); return a; };

  // ================================================================= el fondo: cinco capas de parallax
  const capas = [];
  const capa = (f, k, blur, fn) => {
    const fy = f * 0.6, lw = ancho * f + VWMAX * (1 - f) + 60, lh = alto * fy + VH * (1 - fy) + 60;
    const LG = px(SUELO7 - CAMY * (1 - fy));                        // la raya del suelo de esta capa (px)
    niebla(f);
    const l = lienzo(0, 0, px(lw), px(lh), k);
    ponerG(l.x); ponerTerreno(() => LG, SIN_ARROYO);
    const col = (lx) => delMundo(lx / PXU, f) / C;                  // la columna del mundo que cae en lx
    fn(l.x, LG, px(lw), px(lh), col, (dd) => {
      // la tierra de la capa bajo su raya del suelo, del color de su bruma
      for (let x = 0; x < px(lw); x += 24) { const gr = l.x.createLinearGradient(0, LG - 4, 0, px(lh)); gr.addColorStop(0, mezclar('#3b3833', haze(x), Math.min(0.92, dd * 1.05))); gr.addColorStop(1, mezclar('#151413', haze(x), Math.min(0.9, dd * 0.75))); l.x.fillStyle = gr; l.x.fillRect(x, LG - 4, 25, px(lh) - LG + 4); }
    });
    encenderLuces(l.x);
    const d = conDesenfoque(l, blur);
    capas.push({ bmp: d.c.transferToImageBitmap(), f, fy, k, w: lw, h: lh });
    avisa();
  };

  // ---- CIELO: nubes en bandas a contraluz, el resplandor detras de la ciudad
  capa(0.03, 0.3, 5, (G, LG, W, H) => {
    const gr = G.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#8b8781'); gr.addColorStop(0.35, '#b3ab9f'); gr.addColorStop(0.7, '#e2d8c4'); gr.addColorStop(1, '#efe6d3');
    G.fillStyle = gr; G.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 10) { G.fillStyle = mezclar(haze(x), '#ffffff', 0.05); G.globalAlpha = 0.25; G.fillRect(x, H * 0.55, 11, H * 0.45); }
    G.globalAlpha = 1;
    G.save(); G.globalCompositeOperation = 'lighter'; brillo(SOL.x, LG - 520, 2600, '#fff0d0', 0.22, G); brillo(SOL.x, LG - 420, 900, '#fffaf0', 0.28, G); G.restore();
    // nubes: lenguas largas, oscuras abajo y con el borde de arriba encendido
    const rr = azar(707);
    for (let k = 0; k < 70; k++) {
      const cx = rr() * W, cy = rr() * LG * 0.75, w = 300 + rr() * 900, h = 26 + rr() * 60, cerca = Math.abs(cx - SOL.x) < 1400;
      G.fillStyle = mezclar('#8e8981', '#d8cfbe', cy / LG); G.globalAlpha = 0.35 + rr() * 0.3;
      G.beginPath(); G.ellipse(cx, cy, w / 2, h / 2, 0, 0, 7); G.fill();
      G.fillStyle = cerca ? '#fff6e2' : '#ece2cf'; G.globalAlpha = 0.18 + (cerca ? 0.22 : 0);
      G.beginPath(); G.ellipse(cx + (SOL.x - cx) * 0.02, cy - h * 0.25, w * 0.42, h * 0.22, 0, 0, 7); G.fill();
    }
    G.globalAlpha = 1;
    rayos(G, Math.round(W / 420), 0.05, 707, W);
  });
  // ---- LEJOS: la ciudad gotica en la bruma
  capa(0.12, 0.4, 2.4, (G, LG, W, H, col, tierra) => {
    tierra(0.85);
    const rr = azar(1201);
    for (let x = -100; x < W; x += 180 + rr() * 260) {
      const z = rr(), d = 0.8 + rr() * 0.08, b = LG + 20;
      if (z < 0.16) catedral(x, b, 360 + rr() * 200, 760 + rr() * 300, d, Math.floor(x));
      else if (z < 0.3) cupula(x, b - 120 - rr() * 160, 110 + rr() * 80, d, Math.floor(x) + 1);
      else if (z < 0.8) torreGotica(x, b, 620 + rr() * 520, 70 + rr() * 60, d, Math.floor(x) + 2);
      else aguja(x, b, 500 + rr() * 500, 50 + rr() * 50, d, Math.floor(x) + 3);
    }
    // bloques bajos que hacen de pie de la ciudad
    for (let x = -40; x < W; x += 60 + rr() * 90) { const h = 90 + rr() * 220; G.fillStyle = mezclar('#6b645b', haze(x), 0.82); G.fillRect(x, LG + 20 - h, 50 + rr() * 90, h); }
    bruma(G, LG - 520, LG + 40, 0.5, 0, W);
    rayos(G, Math.round(W / 380), 0.05, 1203, W);
  });
  // ---- MEDIO LEJOS: torres esqueleto, otra cupula y el PASO ELEVADO con los soldados
  capa(0.26, 0.45, 1.2, (G, LG, W, H, col, tierra) => {
    tierra(0.62);
    const rr = azar(2601);
    for (let x = 60; x < W; x += 380 + rr() * 420) {
      const z = rr(), d = 0.55 + rr() * 0.1, b = LG + 10;
      if (z < 0.2) torreEsqueleto(x, b, 120 + rr() * 80, 900 + rr() * 500, d, Math.floor(x));
      else if (z < 0.75) torreGotica(x, b, 900 + rr() * 400, 130 + rr() * 60, d, Math.floor(x) + 1, { esqueleto: 0.3 + rr() * 0.3 });
      else if (z < 0.88) cupula(x, b - 260, 170 + rr() * 60, d, Math.floor(x) + 2);
      else edificio(x - 120, b, 240 + rr() * 120, 500 + rr() * 300, d, Math.floor(x) + 3);
    }
    // el paso elevado: tramos largos con un corte de vez en cuando
    for (let x = -200; x < W; ) {
      const l = 1600 + rr() * 1600, y = LG - 300 - rr() * 60;
      pasoElevado(x, x + l, y, LG + 10, 0.5, Math.floor(x) + 5, { roto: rr() < 0.5 ? x + l * (0.3 + rr() * 0.4) : null, soldados: 2 + Math.floor(rr() * 3), vano: 300 });
      x += l + 300 + rr() * 900;
    }
    bruma(G, LG - 380, LG + 40, 0.3, 0, W);
    rayos(G, Math.round(W / 330), 0.04, 2603, W);
  });
  // ---- MEDIO: bloques rotos, semaforos, torres de la luz, farolas con banderola, barreras, soldados en la calle
  capa(0.45, 0.5, 0.6, (G, LG, W, H, col, tierra) => {
    tierra(0.42);
    const rr = azar(4501), d = 0.38;
    for (let x = 0; x < W; x += 300 + rr() * 380) edificio(x, LG + 10, 240 + rr() * 180, 480 + rr() * 520, d + 0.04, Math.floor(x), { hiedra: 0 });
    for (let x = 200; x < W; x += 900 + rr() * 900) torreLuz(x, LG + 8, 620 + rr() * 200, d + 0.05, Math.floor(x));
    // los montones de lo que se cayo, al pie de los bloques
    for (let x = 0; x < W; x += 260 + rr() * 300) if (rr() < 0.7) escombros(x, x + 160 + rr() * 260, LG + 10, d, Math.floor(x) + 9, { alto: 90 + rr() * 60 });
    for (let x = 100; x < W; x += 200 + rr() * 220) {
      const z = rr();
      if (z < 0.3) farolaSimple(x, LG + 6, 300 + rr() * 60, d, Math.floor(x), { bandera: true, dir: rr() < 0.5 ? -1 : 1 });
      else if (z < 0.42) semaforo(x, LG + 6, d, Math.floor(x), { dir: rr() < 0.5 ? -1 : 1, alto: 300, brazo: 170 });
      else if (z < 0.56) barrera(x, LG + 6, 120 + rr() * 60, d, Math.floor(x));
      else if (z < 0.7) soldadoSilueta(x, LG + 6, 120 + rr() * 20, d, Math.floor(x));
      else if (z < 0.78) furgoneta(x, LG + 8, d, Math.floor(x), { w: 280 });
      else if (z < 0.86) bidon(x, LG + 6, d, Math.floor(x));
    }
    bruma(G, LG - 200, LG + 50, 0.16, 0, W);
    rayos(G, Math.round(W / 470), 0.035, 4503, W);
  });
  // ---- CERCA: los armazones de hormigon con sus orbes, a los lados de la avenida
  // (plantas de 2,5 veces el 18, como en la referencia; pocos y separados: dejan ver la avenida)
  capa(0.68, 0.6, 0.5, (G, LG, W, H, col, tierra) => {
    tierra(0.3);
    const rr = azar(6801), d = 0.3;
    for (let x = 400 + rr() * 500; x < W; x += 1800 + rr() * 1500) {
      const w = 700 + rr() * 600, h = 1400 + rr() * 900;
      armazon(x, LG + 10, w, h, d, Math.floor(x), { fh: 470 + rr() * 60, canto: 40, bay: 250 + rr() * 60, orbes: 1 + (rr() < 0.25 ? 1 : 0), orbeDesde: 1, podre: 0.12, estandartes: 0.14, vidrios: 0.22, techo: LG + 10 - h });
    }
    for (let x = 0; x < W; x += 320 + rr() * 380) {
      const z = rr();
      if (z < 0.45) escombros(x, x + 180 + rr() * 260, LG + 12, d, Math.floor(x), { alto: 80 + rr() * 50 });
      else if (z < 0.58) furgoneta(x, LG + 12, d, Math.floor(x) + 3);
      else if (z < 0.7) vallaObra(x, x + 200 + rr() * 200, LG + 12, d, Math.floor(x) + 5);
      else if (z < 0.8) barrera(x, LG + 12, 130, d, Math.floor(x) + 7);
    }
    bruma(G, LG - 160, LG + 60, 0.12, 0, W);
  });

  // ================================================================= las piezas del mapa
  niebla(1);
  const piezas = [];
  const sueloPx = (x) => px(M.sueloEn(x / PXU));                    // el suelo de la calle bajo x (px)
  const SUELO = (xu) => M.sueloEn(xu) ;                              // (u)
  // lo que se pinta encendido en las piezas (orbes y luz de la Podredumbre, ventanas) son lamparas en el juego
  // (dibujo/ciudad_pintada.js lucesCiudad): [x, y, radio, color, fuerza] en u del mundo comun. Los hongos sueltos no
  // (radio pequeno): serian cientos de luces de nada
  const lucesJuego = [];
  const pon = (caja, capaP, pinta, k = 0.75, nombre = '') => {
    const l = lienzo(caja[0], caja[1], caja[2] - caja[0], caja[3] - caja[1], k);
    ponerG(l.x); ponerTerreno(sueloPx, SIN_ARROYO);
    pinta();
    for (const [x, y, r, col, a] of brillos) if (r >= 120) lucesJuego.push([x / PXU, y / PXU, r / PXU, col, Math.min(0.75, a * 4)]);
    for (const [x, y, r0, a] of lucesPintadas) lucesJuego.push([x / PXU, y / PXU, (r0 * 5) / PXU, '#ffcf8a', Math.min(0.7, 0.55 * a)]);
    encenderLuces(l.x);
    piezas.push({ bmp: l.c.transferToImageBitmap(), x: caja[0] / PXU, y: caja[1] / PXU, w: (caja[2] - caja[0]) / PXU, h: (caja[3] - caja[1]) / PXU, capa: capaP, pieza: nombre });
    avisa();
  };
  const ARRIBA = -14 * C;                                             // hasta donde suben los edificios (u)

  for (const p of M.piezas) {
    if (p.pieza === 'sala') {
      // el edificio de la sala: pilares en sus paredes, forjados en el techo y el suelo de la sala, mas plantas encima
      const x0 = px(p.x0), x1 = px(p.x1), base = px(SUELO((p.x0 + p.x1) / 2)), top = px(ARRIBA);
      const fh = px(6 * C), yTecho = px(p.y0), ySuelo = px(p.y1);
      const pisos = [ySuelo, yTecho]; for (let y = yTecho - fh; y > top + fh * 0.5; y -= fh) pisos.push(y);
      const n = Math.max(2, Math.round((x1 - x0) / 420));
      const bay = (x1 - x0 - 26 + 2) / n;
      pon([x0 - 160, top - 60, x1 + 160, base + 40], 'fondo', () => {
        armazon(x0, base, x1 - x0, base - top, 0.04, 7000 + p.i0, { pisos, fh, canto: px(C) * 0.9, bay, orbes: 1, orbeDesde: 2, orbeTam: 0.72, techo: top, estandartes: 0.3 });
      }, 0.7, 'sala');
    } else if (p.pieza === 'bloque') {
      // detras: lo que queda del edificio (pilares hasta la calle, plantas por encima); encima: la fachada del bloque
      const x0 = px(p.x0), x1 = px(p.x1), base = px(SUELO((p.x0 + p.x1) / 2)), top = px(ARRIBA);
      const fh = px(6 * C);
      const pisos = [px(p.y1)]; for (let y = px(p.y0) - fh * 0.2; y > top + fh * 0.5; y -= fh) pisos.push(y);
      pon([x0 - 200, top - 60, x1 + 200, base + 40], 'fondo', () => {
        armazon(x0 - 60, base, x1 - x0 + 120, base - top, 0.06, 7300 + p.i0, { pisos, fh, canto: 40, bay: 230, orbes: 1, orbeDesde: 2, techo: top });
        escombros(x0 - 120, x1 + 80, base + 4, 0.04, 7310, { alto: 90 });
      }, 0.7, 'bloque_fondo');
      pon([x0 - 30, px(p.y0) - 40, x1 + 30, px(p.y1) + 160], 'sobre', () => fachadaBloque(x0, px(p.y0), x1, px(p.y1), 7320 + p.i0), 0.75, 'bloque');
    } else if (p.pieza === 'losa') {
      // el paso elevado: el tablero sobre la losa (encima del terreno) y las pilas hasta la calle (detras)
      const x0 = px(p.x0), x1 = px(p.x1), y = px(p.ty0), canto = px(p.ty1) - px(p.ty0), base = px(SUELO((p.x0 + p.x1) / 2));
      pon([x0 - 80, y - 200, x1 + 80, base + 40], 'fondo', () => {
        for (const q of p.patas) { const cx = px((q.i + 0.5) * C); pilaPaso(cx, px((q.j1 + 1) * C), base, 7400 + q.i); }
        // barandilla y farolas detras del que anda por encima
        const o = tono0();
        for (let x = x0 + 20; x < x1 - 10; x += 52) { g.fillStyle = o; g.fillRect(x, y - 52, 3, 52); }
        g.fillStyle = o; g.fillRect(x0, y - 54, x1 - x0, 4); g.fillRect(x0, y - 30, x1 - x0, 2.4);
        for (let x = x0 + 260; x < x1 - 100; x += 620) farolaSimple(x, y, 300, 0.05, 7410 + Math.floor(x), { bandera: true });
      }, 0.75, 'losa_fondo');
      pon([x0 - 20, y - 14, x1 + 20, y + canto + 30], 'sobre', () => tableroPaso(x0, x1, y, canto, 7420 + p.i0), 0.75, 'losa');
      // las patas del mapa (las casillas que cuelgan del tablero) son el arranque de cada pila: encima del terreno
      for (const q of p.patas) {
        const cx = px((q.i + 0.5) * C), a = px(q.j0 * C), b = px((q.j1 + 1) * C);
        pon([cx - 70, a - 10, cx + 70, b + 20], 'sobre', () => {
          chapa([[cx - 46, a - 4], [cx + 46, a - 4], [cx + 40, b + 2], [cx - 40, b + 2]], 0, 7430 + q.i, { col: '#4f4c46', juntas: [999, 80] });
          g.fillStyle = '#d8c296'; g.globalAlpha = 0.6; g.fillRect(cx + 36, a, 3, b - a); g.globalAlpha = 1;
          g.fillStyle = 'rgba(8,8,9,.55)'; g.fillRect(cx - 46, a - 4, 92, 8);
        }, 0.75, 'pata');
      }
    }
  }
  for (const m of M.marcas) {
    const X = px(m.x), Yb = px(m.y);
    if (m.pieza === 'farola') pon([X - 150, Yb - px(FAROLA.alto) - 80, X + px(FAROLA.dx) + 120, Yb + 30], 'fondo', () => farolaCiudad(X, Yb, px(FAROLA.alto), px(FAROLA.dx), 0, 8000 + m.i, { dir: 1 }), 0.75, 'farola');
    else if (m.pieza === 'senal') pon([X - 60, Yb - 440, X + 320, Yb + 30], 'fondo', () => { semaforo(X, Yb, 0, 8100 + m.i, { dir: 1, alto: 400, brazo: 250 }); placaZona(X, Yb - 230); }, 0.75, 'senal');
    else if (m.pieza === 'coche') pon([X - 140, Yb - 160, X + 140, Yb + 30], 'fondo', () => coche(X - 108), 0.75, 'coche');
    else { avisa(); }
  }
  // ---- la calle: barreras y escombros sin tapar las marcas, la entrada ni la salida
  {
    const libre = (a, b) => !M.ocupado.some(([c, d]) => b > c && a < d);
    for (const c of M.calle) {
      // (lo que se reparte, con su ancho en u y como se pinta; todo detras del 18 y bajo: no tapa nada)
      const COSAS = [
        [0.24, 70, (X, Y, s) => barrera(X, Y + 4, px(70), 0, s)],
        [0.5, 110, (X, Y, s) => escombros(X, X + px(110), Y + 6, 0, s, { alto: 60 })],
        [0.62, 40, (X, Y, s) => bidon(X, Y + 4, 0, s)],
        [0.72, 30, (X, Y, s) => neumaticos(X + 40, Y + 2, 1 + (s % 3), 0, s)],
        [0.8, 50, (X, Y, s) => tuboHormigon(X, Y + 4, 34, 0, s)],
        [0.9, 120, (X, Y, s) => vallaObra(X, X + px(120), Y + 4, 0, s)],
        [1, 130, (X, Y, s) => furgoneta(X, Y + 6, 0, s)],
      ];
      const rr = azar(9000 + c.i0), w = c.x1 - c.x0;
      if (w > 160) for (let x = c.x0 + 40 + rr() * 120; x < c.x1 - 100; x += 230 + rr() * 300) {
        const z = rr(), [, ancho, fn] = COSAS.find(([p]) => z < p);
        if (x + ancho > c.x1 - 20 || !libre(x - 10, x + ancho + 10)) continue;
        const X = px(x), Y = px(c.y), s = 9100 + Math.floor(x);
        pon([X - 50, Y - 200, X + px(ancho) + 60, Y + 30], 'fondo', () => fn(X, Y, s), 0.75, 'calle');
      }
      avisa();
    }
    // los fosos de cristales: cascotes en los bordes
    for (const f of M.fosos) { const a = px(f.i0 * C), b = px((f.i1 + 1) * C), y = px(M.sueloCol(f.i0 - 1) * C); pon([a - 160, y - 140, a + 20, y + 24], 'fondo', () => escombros(a - 140, a, y + 6, 0, 9300 + f.i0, { alto: 50 }), 0.75, 'borde'); pon([b - 20, y - 140, b + 160, y + 24], 'fondo', () => escombros(b, b + 140, y + 6, 0, 9310 + f.i0, { alto: 50 }), 0.75, 'borde'); }
  }

  // ================================================================= el primer plano (corre 1,25 veces el mundo)
  let frente = null;
  { const f = 1.25, a = -(f - 1) * (ancho - VW) / 2 - 80, b = (ancho - VW) * (f + 1) / 2 + VWMAX + 80, y0 = -160, y1 = alto + 40;
    const l = lienzo(px(a), px(y0), px(b - a), px(y1 - y0), 0.4);
    // Una franja casi negra por DEBAJO de la calle de los dos niveles (de 500 u para abajo: la calle esta en 512 y en
    // 384; no tapa al 18) hecha de lo que hay tirado delante: el monton de cascotes de base y encima barreras, vallas
    // de barrotes, haces de varillas, neumaticos, barandillas torcidas y tocones de poste; solo lo fino sube algo
    // mas. El canto de arriba de cada cosa lo lame un hilo de luz calida, como en la referencia.
    ponerG(l.x); const rr = azar(99), H = px(alto), NEG = '#0a0908', CANTO = 'rgba(92,72,52,.55)';
    // (BAJA: el nivel 8 baja a un paso inferior cuyo suelo esta en 576 del mundo comun; la franja va por debajo de
    // el, o tapaba al 18 alli abajo)
    const BAJA = 120, Y = (u) => px(u + BAJA), x0 = px(a), x1 = px(b);
    const filo = (pts) => { g.strokeStyle = CANTO; g.lineWidth = 2.4; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]); g.stroke(); };
    const masa = (pts) => { g.beginPath(); g.moveTo(pts[0][0], H + 60); for (const p of pts) g.lineTo(p[0], p[1]); g.lineTo(pts[pts.length - 1][0], H + 60); g.closePath(); g.fillStyle = NEG; g.fill(); filo(pts); };
    // el monton de base, con lomas
    { const pts = []; for (let x = x0; x <= x1; x += 22) { const loma = Math.max(0, Math.sin(x * 0.0021) * Math.sin(x * 0.0007 + 1)) * 34; pts.push([x, Y(566) - loma - rr() * 10]); } masa(pts); }
    for (let x = x0; x < x1; x += 120 + rr() * 260) {
      const z = rr();
      if (z < 0.3) { // cascote anguloso
        const w = 50 + rr() * 140, top = Y(522 + rr() * 26);
        masa([[x, Y(570)], [x + w * 0.15, top + 20], [x + w * (0.3 + rr() * 0.3), top], [x + w * 0.75, top + 8 + rr() * 16], [x + w, Y(570)]]);
        if (rr() < 0.5) { g.strokeStyle = NEG; g.lineWidth = 5; g.beginPath(); for (let q = 0; q < 4; q++) { g.moveTo(x + w * 0.4 + q * 8, top + 10); g.quadraticCurveTo(x + w * 0.4 + q * 14, top - 40, x + w * 0.4 + q * 20 - 30 + rr() * 30, Y(440 + rr() * 50)); } g.stroke(); }
      } else if (z < 0.45) { // barrera New Jersey
        const w = 230 + rr() * 60, top = Y(516);
        masa([[x, Y(568)], [x + 10, top + 60], [x + 26, top], [x + w - 26, top], [x + w - 10, top + 60], [x + w, Y(568)]]);
      } else if (z < 0.6) { // valla de barrotes con sus travesanos, torcida
        const w = 220 + rr() * 300, inc = (rr() - 0.5) * 0.2;
        g.fillStyle = NEG; for (let q = 0; q < w; q += 22) { const top = Y(502 + rr() * 12); g.save(); g.translate(x + q, Y(570)); g.rotate(inc); g.fillRect(-3, top - Y(570), 7, Y(570) - top + 20); g.restore(); }
        g.fillRect(x - 10, Y(510), w + 20, 9); g.fillRect(x - 10, Y(542), w + 20, 8); filo([[x - 10, Y(510)], [x + w + 10, Y(510)]]);
      } else if (z < 0.72) { // neumaticos
        for (let k = 0; k < 1 + Math.floor(rr() * 3); k++) { g.beginPath(); g.ellipse(x + k * 12, Y(556) - k * 16, 48, 14, 0, 0, 7); g.fillStyle = NEG; g.fill(); g.strokeStyle = CANTO; g.lineWidth = 2; g.beginPath(); g.ellipse(x + k * 12, Y(556) - k * 16, 48, 14, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      } else if (z < 0.82) { // barandilla torcida
        const w = 200 + rr() * 200; g.strokeStyle = NEG; g.lineWidth = 9; g.beginPath(); g.moveTo(x, Y(528)); g.quadraticCurveTo(x + w * 0.5, Y(518) + rr() * 24, x + w, Y(534)); g.stroke();
        for (let q = 0; q <= w; q += 60) { g.fillStyle = NEG; g.fillRect(x + q - 4, Y(528) + (q > w * 0.6 ? 10 : 0), 8, Y(570) - Y(528)); }
        filo([[x, Y(525)], [x + w, Y(531)]]);
      } else if (z < 0.9) { // tocon de poste con su placa ladeada
        g.fillStyle = NEG; g.fillRect(x, Y(450), 16, Y(570) - Y(450)); g.save(); g.translate(x + 8, Y(458)); g.rotate(0.35); g.fillRect(-40, -34, 80, 52); g.restore(); filo([[x, Y(450)], [x + 16, Y(450)]]);
      }
    }
    const d = conDesenfoque(l, 4);
    frente = { bmp: d.c.transferToImageBitmap(), x: a, y: y0, w: b - a, h: y1 - y0, f };
    avisa();
  }
  const bmps = [...capas.map((c) => c.bmp), ...piezas.map((p) => p.bmp), frente.bmp];
  postMessage({ capas, piezas, frente, luces: lucesJuego, ms: Math.round(performance.now() - t0) }, bmps);
}

// ---------------------------------------------------------------- piezas que solo usa el mapa
const tono0 = () => '#2a1d16';            // la barandilla de hierro, oxidada
// la fachada del bloque que flota: hormigon por plantas, ventanas a oscuras con algun vidrio, el borde de abajo
// roto con varillas y una losa que cuelga
function fachadaBloque(x0, y0, x1, y1, sem) {
  const rr = azar(sem), w = x1 - x0, h = y1 - y0, LUZ = '#d9c497', NEG = '#0a0a0b';
  chapa([[x0 - 6, y0], [x1 + 6, y0], [x1 + 6, y1], [x0 - 6, y1]], 0, sem, { col: '#5d5850', juntas: [w / 7, 999] });
  // plantas: el canto del forjado en relieve (luz arriba, sombra debajo) y entre canto y canto los vanos hondos
  const np = 3, fh = (h - 20) / np;
  for (let p = 0; p < np; p++) {
    const y = y0 + 10 + p * fh;
    chapa([[x0 - 10, y], [x1 + 10, y], [x1 + 10, y + 22], [x0 - 10, y + 22]], 0, sem + p, { liso: true, col: '#6a655c' });
    g.fillStyle = LUZ; g.globalAlpha = 0.85; g.fillRect(x0 - 10, y, w + 20, 1.8); g.globalAlpha = 1;
    g.fillStyle = 'rgba(8,8,9,.6)'; g.fillRect(x0 - 10, y + 22, w + 20, 6);
    // los vanos: hondos (sombra del dintel y de la jamba), alguno tapiado con chapa, alguno con vidrio en punta
    const vy = y + 40, vh = fh - 62;
    for (let x = x0 + 34; x < x1 - 90; x += 118) {
      const z = rr();
      if (z < 0.1) continue;
      if (z < 0.22) { chapa([[x, vy], [x + 74, vy], [x + 74, vy + vh], [x, vy + vh]], 0, sem + Math.floor(x), { liso: true, col: '#3e3830', remaches: 14 }); continue; }
      g.fillStyle = NEG; g.fillRect(x, vy, 74, vh);
      g.fillStyle = '#18171a'; g.fillRect(x + 6, vy + 6, 62, vh * 0.4);            // la pared de dentro, con luz de otra ventana
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, vy, 74, 9); g.fillRect(x, vy, 7, vh);   // dintel y jamba
      g.fillStyle = LUZ; g.globalAlpha = 0.7; g.fillRect(x - 2, vy + vh + 1, 78, 1.8); g.fillRect(x + 74, vy + 8, 1.6, vh - 8); g.globalAlpha = 1;
      if (z > 0.7) { g.fillStyle = 'rgba(160,168,170,.28)'; g.beginPath(); g.moveTo(x + 4, vy + 4); g.lineTo(x + 50, vy + 4); g.lineTo(x + 14, vy + vh * 0.7); g.closePath(); g.fill(); }
      g.strokeStyle = 'rgba(11,10,12,.9)'; g.lineWidth = 2; g.strokeRect(x, vy, 74, vh);
    }
  }
  // chorretones bajo los alfeizares
  for (let k = 0; k < w / 70; k++) { const x = x0 + rr() * w, y = y0 + 40 + rr() * h * 0.7; g.fillStyle = 'rgba(12,11,10,.35)'; g.fillRect(x, y, 3 + rr() * 3, 30 + rr() * 60); }
  g.fillStyle = LUZ; g.globalAlpha = 0.8; g.fillRect(x0 - 6, y0, w + 12, 2); g.globalAlpha = 1;
  // el borde de abajo: varillas y una losa colgando
  for (let x = x0; x < x1; x += 12 + rr() * 16) { g.strokeStyle = '#0a0909'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y1 - 2); g.lineTo(x + (rr() - 0.5) * 16, y1 + 14 + rr() * 40); g.stroke(); }
  g.save(); g.translate(x0 + w * (0.25 + rr() * 0.5), y1); g.rotate(0.5 + rr() * 0.3); chapa([[0, -10], [180, -10], [180, 14], [0, 14]], 0, sem + 3, { col: '#4a4741' }); g.restore();
  hongos(x0 + w * 0.8, y1 - 2, 4, 60, 0, sem + 9, { abre: 1.2 });
}
// el tablero del paso elevado (lo que se pisa): canto de hormigon con junta, impostas y la luz arriba
function tableroPaso(x0, x1, y, canto, sem) {
  chapa([[x0 - 8, y], [x1 + 8, y], [x1 + 8, y + canto], [x0 - 8, y + canto]], 0, sem, { col: '#57534b', juntas: [260, 999] });
  g.fillStyle = '#e1cc9e'; g.globalAlpha = 0.85; g.fillRect(x0 - 8, y, x1 - x0 + 16, 2); g.globalAlpha = 1;
  g.fillStyle = 'rgba(8,8,9,.6)'; g.fillRect(x0 - 8, y + canto * 0.72, x1 - x0 + 16, 4);
  g.fillStyle = 'rgba(8,8,9,.75)'; g.fillRect(x0, y + canto, x1 - x0, 10);
  // el oxido de las varillas y de los anclajes de la barandilla, que baja por el canto
  const rr = azar(sem + 5); for (let x = x0 + 20; x < x1 - 20; x += 40 + rr() * 90) oxido(x, y + 4, 18 + rr() * (canto + 20), 3 + rr() * 3, 0, sem + Math.floor(x));
}
// la pila del paso elevado: de la losa a la calle, con capitel y el pie en un monton de cascotes
function pilaPaso(cx, yTop, base, sem) {
  chapa([[cx - 34, yTop], [cx + 34, yTop], [cx + 28, base + 6], [cx - 28, base + 6]], 0.04, sem, { col: '#4f4c46', juntas: [999, 160] });
  chapa([[cx - 50, yTop - 4], [cx + 50, yTop - 4], [cx + 40, yTop + 22], [cx - 40, yTop + 22]], 0.04, sem + 1, { liso: true, col: '#57534b' });
  g.fillStyle = '#d8c296'; g.globalAlpha = 0.55; g.fillRect(cx + 24, yTop + 22, 3, base - yTop - 22); g.globalAlpha = 1;
  escombros(cx - 90, cx + 90, base + 4, 0.04, sem + 2, { alto: 60 });
}
// la placa de la zona (la marca 'senal' era el cartel ZONE / NO ENTRY): va en el poste del semaforo
function placaZona(x, y) {
  chapa([[x - 34, y - 26], [x + 34, y - 26], [x + 34, y + 20], [x - 34, y + 20]], 0, 8150, { liso: true, col: '#8e8a7e' });
  g.fillStyle = '#0b0a0c'; g.font = 'bold 17px Georgia'; g.textAlign = 'center'; g.fillText('ZONE', x, y - 4); g.font = '11px Georgia'; g.fillText('NO ENTRY', x, y + 12); g.textAlign = 'left';
}

self.onmessage = () => {
  try { pintar(); } catch (e) { postMessage({ error: String(e && e.stack || e) }); }
};
