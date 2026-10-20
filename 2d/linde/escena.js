// EL LINDE · la ESCENA: la composicion entera por capas de profundidad (lejos, medio lejos, medio, juego y
// primer plano), con la bruma y los rayos entre una y otra, las luces encima de la bruma de su capa, el reflejo
// del arroyo y el aire, para la pagina del concepto (todo en un lienzo). El nivel 6 del juego usa sus piezas y su
// bruma y sus rayos, pero se compone a su manera (linde/obrero.js).
//   S.capa(destino, desenfoque, fn)  pinta fn en un lienzo aparte y lo compone en 'fondo', 'juego' o 'frente'
//   S.ctx(destino)                   el contexto de ese destino (bruma, rayos, luces, aire)
//   S.copiar(C, x, y, w, h)          dibuja en C lo que ya hay pintado en ese rectangulo (fondo + juego): el agua lo refleja
//   P                                el plano: cotas de lo que se pisa (geometria.js) y lo que solo va en el concepto
// Las piezas son las de web/linde/. El suelo y el arroyo los pone ponerTerreno() antes de llamar.
import { TINTA, azar, mezclar, rgba, trazar, trazarSuave, tinta, hash } from '../dibujo/tinta.js';
import { W, H, SOL, AGUA, g, lerp, cl, haze, tono, sueloY, brillo, luces, brillos } from './base.js';
import { tronco, rama, setaRepisa, setasTronco } from './troncos.js';
import { musgo, grupoSetas, roca, cascada, hierba, pintarSuelo, pintarSetas, pintarJuncos, pintarAltramuces, pintarHierba } from './suelo.js';
import { hojas, colgajo, liana } from './follaje.js';
import { chapa, tubo, autobus, pasarela, viaducto, deposito, valla, arana, rejillaConducto, tendido, coche, paradaBus } from './metal.js';
import { aldea } from './aldea.js';
import { cisterna, autobusBosque, vigaCaida, tocon, raizArco, lena, cultivos, espantapajaros, invernadero, pozo, porche, guirnalda } from './piezas.js';
import { capsula, plataforma, escalera, edificio, casaMadera, aguja } from './casas.js';

// las luces (ventanas, farolillos) y los brillos (setas) se encienden DESPUES de la bruma de su capa: atraviesan la niebla
export function encenderLuces(M) { M.save(); M.globalCompositeOperation = 'lighter'; for (const [x, y, r0, a] of luces) { brillo(x, y, r0 * 5, '#ffcf7a', 0.32 * a, M); brillo(x, y, r0 * 1.4, '#fff0c4', 0.55 * a, M); } for (const [x, y, r0, col, a] of brillos) brillo(x, y, r0, col, a, M); M.restore(); luces.length = 0; brillos.length = 0; }
export function bruma(M, yTop, yBot, a, x0 = 0, x1 = W) {
  for (let x = x0; x < x1; x += 30) {
    const col = haze(x + 15), gr = M.createLinearGradient(0, yTop, 0, yBot);
    gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.7, rgba(col, a)); gr.addColorStop(1, rgba(col, a * 0.5));
    M.fillStyle = gr; M.fillRect(x, yTop, 31, yBot - yTop);
  }
}
export function rayos(M, n, alfa, sem, ancho = W) {
  const rr = azar(sem);
  M.save(); M.globalCompositeOperation = 'lighter';
  for (let k = 0; k < n; k++) {
    const x0 = rr() * ancho * 1.05, w = 30 + rr() * 170, f = 0.35 + 0.65 * Math.exp(-(((x0 - SOL.x) / 2600) ** 2));
    const dx = cl((x0 - SOL.x) * 0.32, -720, 720), gr = M.createLinearGradient(0, 0, 0, 1300);
    gr.addColorStop(0, `rgba(255,240,196,${alfa * f})`); gr.addColorStop(0.75, `rgba(255,240,196,${alfa * f * 0.4})`); gr.addColorStop(1, 'rgba(255,240,196,0)');
    M.fillStyle = gr; M.beginPath(); M.moveTo(x0, -20); M.lineTo(x0 + w, -20); M.lineTo(x0 + w * 1.8 + dx, 1300); M.lineTo(x0 + dx, 1300); M.fill();
  }
  M.restore();
}

// ================================================================= 1. CIELO (de P.y0 a P.y1)
export function cielo(M, P) {
  const y0 = P.y0, h = P.y1 - P.y0;
  M.fillStyle = '#e8e0c2'; M.fillRect(0, y0, W, h);
  for (let x = 0; x < W; x += 6) {
    const hz = haze(x), gr = M.createLinearGradient(0, y0, 0, y0 + h);
    gr.addColorStop(0, mezclar(hz, x < 3000 ? '#7d8c62' : '#b8b08a', 0.35)); gr.addColorStop(0.6, mezclar(hz, '#fff7dc', 0.3)); gr.addColorStop(1, hz);
    M.fillStyle = gr; M.fillRect(x, y0, 7, h);
  }
  M.save(); M.globalCompositeOperation = 'lighter';
  brillo(SOL.x, SOL.y, 2600, '#fff1c8', 0.3, M); brillo(SOL.x, SOL.y, 600, '#fffbe8', 0.35, M);
  M.restore();
}

// ================================================================= 2-8. LAS CAPAS
export function pintarEscena(S, P) {
  const F = S.ctx('fondo'), J = S.ctx('juego');
  // ================================================================= 2. LEJOS: troncos palidos del bosque, colinas y agujas de la ciudad
  S.capa('fondo', 3.5, () => {
    const d = 0.82, rr = azar(11);
    for (let x = -40; x < 3700; x += 120 + rr() * 140) { tronco(x, 1110, -60, 40 + rr() * 60, d + rr() * 0.08, Math.floor(x)); hojas(x + (rr() - 0.5) * 100, 60 + rr() * 140, 180 + rr() * 120, 90 + rr() * 60, d, Math.floor(x) + 7, { den: 0.35, tam: 9 }); }
    // troncos palidos tambien hacia la aldea, mas claros y separados (el bosque se abre)
    { const rt = azar(14); for (let x = 3760; x < 7000; x += 260 + rt() * 260) { if (Math.abs(x - SOL.x) < 160) continue; tronco(x, 1120, -60, 46 + rt() * 50, 0.86 + rt() * 0.06, Math.floor(x) + 1); hojas(x + (rt() - 0.5) * 100, 40 + rt() * 140, 170 + rt() * 110, 80 + rt() * 50, 0.86, Math.floor(x) + 8, { den: 0.3, tam: 9 }); } }
    for (let x = 3400; x < 6600; x += 90 + rr() * 120) hojas(x, 1040 - rr() * 70, 90 + rr() * 90, 50 + rr() * 40, d + 0.05, Math.floor(x) + 9, { den: 0.35, tam: 8 });
    // agujas de la ciudad
    for (let x = 6350; x < W + 100; x += 90 + rr() * 150) aguja(x, 1150, 380 + rr() * 640, 50 + rr() * 70, 0.78 + rr() * 0.1, Math.floor(x));
    for (let x = 6200; x < W; x += 160 + rr() * 120) hojas(x, 1120 - rr() * 40, 100, 40, d, Math.floor(x) + 4, { den: 0.35 });
  });
  bruma(F, 760, 1180, 0.42);
  rayos(F, 22, 0.06, 31);

  // ================================================================= 3. MEDIO LEJOS: arboles grandes con copa, el arbol de la aldea, chimeneas y torres de las afueras, bloques de la ciudad
  S.capa('fondo', 1.4, () => {
    const d = 0.46, rr = azar(21);
    // PENASCOS del fondo (lo primero de esta capa: en la capa lejana se pierden en la bruma): roca en cel con su
    // meseta de matas, una cascada larga que cae de cada uno y torres rotas encima, como los de la referencia
    { const rc = azar(12), dp = 0.55;
      for (const [x0, x1, top, cx, cw, torre] of [[3640, 4080, 620, 3860, 22, 3780], [4230, 4820, 520, 4560, 34, 4700], [4930, 5300, 650, 5150, 20, 0], [5980, 6460, 570, 6200, 28, 6380]]) {
        const pts = [[x0, 1190], [x0 + 20, top + 260], [x0 + 60, top + 120 + rc() * 40], [x0 + 110, top + 30], [x0 + (x1 - x0) * 0.35, top + rc() * 20], [x0 + (x1 - x0) * 0.6, top + 10 + rc() * 30], [x1 - 90, top + 40 + rc() * 30], [x1 - 40, top + 150], [x1 - 10, top + 300], [x1, 1190]];
        roca(pts, dp, Math.floor(x0));
        for (let x = x0 + 70; x < x1 - 50; x += 40 + rc() * 50) hojas(x, top + 18 + Math.abs(x - (x0 + x1) / 2) * 0.12, 34 + rc() * 40, 14 + rc() * 10, dp, Math.floor(x) + 17, { den: 0.6, tam: 7, mata: true });
        cascada(cx, top + 30, 1190, cw, dp, Math.floor(cx), { velo: 0.25 });
        if (torre) aguja(torre, top + 40, 300 + rc() * 260, 46 + rc() * 24, 0.6, Math.floor(torre) + 3);
      } }
    // bosque
    for (let x = 60; x < 3500; x += 220 + rr() * 160) {
      tronco(x, 1170, -80, 70 + rr() * 60, d, Math.floor(x), { colgajos: 4 });
      for (let k = 0; k < 3; k++) hojas(x + (rr() - 0.5) * 300, 40 + rr() * 260, 170 + rr() * 90, 90 + rr() * 50, d, Math.floor(x) + k * 13, { den: 0.55, tam: 8 });
      if (rr() < 0.5) for (let k = 0; k < 3; k++) setaRepisa(x + 30, 900 - k * 22 - rr() * 200, 14, 1, d, Math.floor(x) + k);
    }
    // el claro del arroyo a la aldea: arboles con copa a pasos largos (no se cierra: se ven los penascos) y el
    // VIADUCTO de hierro que lo cruza en lo alto, con un vano caido
    { const rq = azar(22); for (const x of [3560, 3900, 4330, 4700]) { tronco(x, 1180, -80, 80 + rq() * 40, d, Math.floor(x) + 2, { colgajos: 3 }); for (let k = 0; k < 3; k++) hojas(x + (rq() - 0.5) * 280, 30 + rq() * 220, 160 + rq() * 90, 80 + rq() * 50, d, Math.floor(x) + k * 17, { den: 0.6, tam: 8 }); }
      viaducto(3260, 5120, 690, 1180, 0.5, 23, { roto: 4420 });
      arana(4150, 690, 30, 0.5, 24); }
    // detras de la aldea: arboles normales
    for (let x = 5000; x < 6300; x += 260 + rr() * 120) { tronco(x, 1180, -60, 80 + rr() * 40, d, Math.floor(x), { colgajos: 3 }); for (let k = 0; k < 3; k++) hojas(x + (rr() - 0.5) * 260, 40 + rr() * 260, 170 + rr() * 80, 90 + rr() * 50, d, Math.floor(x) + k * 13, { den: 0.6, tam: 8 }); }
    // afueras: deposito de agua, chimenea, andamios y grua
    { const x = 6700, b = 1180; for (const px of [x - 70, x + 70]) chapa([[px - 6, b], [px - 6, b - 380], [px + 6, b - 380], [px + 6, b]], d, px); g.strokeStyle = tono('#2a231a', d, x); g.lineWidth = 3; g.beginPath(); for (let y = b; y > b - 380; y -= 60) { g.moveTo(x - 70, y); g.lineTo(x + 70, y - 60); g.moveTo(x + 70, y); g.lineTo(x - 70, y - 60); } g.stroke(); chapa([[x - 110, b - 380], [x - 110, b - 520], [x - 70, b - 560], [x + 70, b - 560], [x + 110, b - 520], [x + 110, b - 380]], d, x + 1, { remaches: 20 }); }
    { const x = 7000, b = 1180; chapa([[x - 40, b], [x - 28, b - 640], [x + 28, b - 640], [x + 40, b]], d, x + 5, { remaches: 14 }); }
    { const x = 7200, b = 1180; g.strokeStyle = tono('#2a231a', d, x); g.lineWidth = 4; g.beginPath(); g.moveTo(x, b); g.lineTo(x, b - 700); g.lineTo(x + 380, b - 700); g.moveTo(x, b - 640); g.lineTo(x + 300, b - 700); for (let y = b; y > b - 700; y -= 40) { g.moveTo(x - 14, y); g.lineTo(x + 14, y - 40); } g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 340, b - 700); g.lineTo(x + 340, b - 460); g.stroke(); chapa([[x + 326, b - 460], [x + 354, b - 460], [x + 350, b - 430], [x + 330, b - 430]], d, x + 9); }
    // bloques de la ciudad
    for (const [x, w, h] of [[7400, 200, 560], [7640, 240, 760], [7920, 200, 620], [8150, 260, 860]]) edificio(x, 1180, w, h, d, x);
  });
  bruma(F, 900, 1230, 0.26);
  encenderLuces(F);
  rayos(F, 26, 0.05, 41);

  // ================================================================= 4. MEDIO: arbustos y troncos, el autobus del bosque, casitas de la aldea, coches, aranas, fachadas
  S.capa('fondo', 0.6, () => {
    const d = 0.3, rr = azar(51);
    // copa alta del bosque
    for (let x = -100; x < 3600; x += 110 + rr() * 80) hojas(x, -20 + rr() * 180, 170 + rr() * 80, 90 + rr() * 50, d, Math.floor(x) + 2, { den: 0.75, tam: 8 });
    for (let x = 200; x < 3400; x += 420 + rr() * 200) tronco(x, 1190, -40, 90 + rr() * 50, d, Math.floor(x) + 1, { colgajos: 6, raices: true });
    // el borde de la copa sigue por encima del claro (enmarca sin cerrarlo) y por encima de las afueras
    { const rq = azar(52); for (let x = 3600; x < 5150; x += 150 + rq() * 120) hojas(x, -60 + rq() * 90, 150 + rq() * 80, 70 + rq() * 40, d, Math.floor(x) + 4, { den: 0.7, tam: 8 });
      for (let x = 6250; x < 7100; x += 160 + rq() * 140) hojas(x, -70 + rq() * 60, 140 + rq() * 70, 60 + rq() * 30, d, Math.floor(x) + 5, { den: 0.6, tam: 8 }); }
    // LA ALDEA DEL ARBOL (linde/aldea.js), algo mas cerca que el resto de la capa
    aldea(0.16);
    for (let x = 0; x < 6300; x += 70 + rr() * 90) if (!(x > 2400 && x < 3200)) hojas(x, sueloY(x) - 30 - rr() * 40, 60 + rr() * 50, 34 + rr() * 22, d, Math.floor(x) + 3, { den: 0.8 });
    // (el autobus del bosque pasa a la capa de la CHATARRA, mas cerca; aqui se gasta su azar para no mover lo demas)
    for (let k = 0; k < 6; k++) rr();
    // arroyo: rocas y una cascada pequena desde una tuberia
    roca([[3030, 1270], [3060, 1150], [3140, 1110], [3220, 1140], [3240, 1270]], d, 61);
    chapa([[3100, 1124], [3180, 1124], [3180, 1150], [3100, 1150]], d, 62, { remaches: 12 }); cascada(3112, 1150, 1272, 22, d, 63);
    // aldea: casitas sobre pilotes con ventanas redondas
    for (const [x, w, h] of [[5240, 150, 120], [5480, 130, 140], [6000, 160, 130]]) { for (const px of [x + 10, x + w - 10]) chapa([[px - 6, sueloY(px) + 4], [px - 6, sueloY(px) - 60], [px + 6, sueloY(px) - 60], [px + 6, sueloY(px) + 4]], d, px); casaMadera(x, w, h, sueloY(x + w / 2) - 60, d, x, { luz: true, humo: x === 5480 }); }
    // afueras: casas en hilera, coches, aranas a lo lejos
    for (let k = 0; k < 4; k++) casaMadera(6380 + k * 128, 120, 200 + (k % 2) * 30, sueloY(6440 + k * 128), d, 6380 + k * 9, { pared: ['#7c7466', '#6e685c', '#857c6c'][k % 3], tejado: '#45493c', luz: k === 2, chimenea: k % 2 === 0 });
    arana(6980, sueloY(6980) - 30, 22, d + 0.1, 1); arana(7120, sueloY(7120) - 60, 16, d + 0.15, 2);
    // fachadas bajas de la ciudad
    for (const [x, w, h] of [[7340, 180, 300], [7560, 220, 360], [7820, 200, 280], [8060, 230, 380]]) edificio(x, sueloY(x), w, h, d, x + 7, { hiedra: 0.9 });
  });
  bruma(F, 1000, 1260, 0.14);
  encenderLuces(F);
  rayos(F, 18, 0.04, 51);


  // ================================================================= 5. JUEGO: suelo, troncos cercanos, conducto, tocon, pasarela, cabana, huertos, aldea, afueras, ciudad, el 18
  S.capa('juego', 0, () => {
    const d = 0, rr = azar(71);
    // LA CHATARRA del bosque, lo primero de la capa: los troncos le pasan por delante y el ribazo del suelo entra
    // por detras (destination-over), asi se ve entera sobre el camino, como el autobus de la referencia.
    // EXCEPCION a la regla de la vegetacion (la pidio el usuario el 2026-10-18): el autobus, la cisterna y la viga
    // del bosque llevan musgo y hiedra ENCIMA, como en la referencia. Lo demas del hierro y las casas sigue sin.
    { const dc = 0.06, rc = azar(61);
      // una bajante que sale de la tierra junto al conducto, se dobla y acaba en una brida rota
      { const y = sueloY(640); tubo([[610, y + 10], [610, y - 70], [636, y - 104], [700, y - 104], [716, y - 92]], 15, dc, 610); }
      // la cisterna tumbada entre el primer tronco y el segundo, el autobus de la linea 4 y una viga caida, con su musgo (linde/piezas.js)
      cisterna(1000, sueloY(1120), dc);
      autobusBosque(1740, sueloY(1740), dc);
      vigaCaida(2030, sueloY(2030) + 8, dc);
      // setas que brillan al pie del hierro y matas que lo tapan por abajo (nacen del suelo)
      grupoSetas(2050, sueloY(2050) - 2, 4, 7, dc, 2011); grupoSetas(1270, sueloY(1270) - 2, 3, 6, dc, 1331);
      for (let x = 980; x < 2080; x += 46 + rc() * 60) hojas(x, sueloY(x) - 8 - rc() * 10, 34 + rc() * 30, 18 + rc() * 10, dc, Math.floor(x) + 61, { den: 0.9, mata: true }); }
    // troncos enormes de delante con ramas que son plataformas
    const ramas = [];
    for (const t of P.troncos) { tronco(t.x, t.base, t.top, t.an, 0.04, t.x, t.o); ramas.push([t.x, t.an]); }
    for (const [x, y, l, lado] of P.ramas) rama(x + lado * 40, y, l, lado, 0.02, x + y);
    for (const [x, an] of ramas) for (let k = 0; k < 4; k++) setaRepisa(x + (k % 2 ? an * 0.42 : -an * 0.42), sueloY(x) - 160 - k * 70, 16 + k * 2, k % 2 ? 1 : -1, 0, x + k);
    // setas que brillan subiendo por los troncos grandes, en el lado de la sombra (como en la referencia)
    setasTronco(860, sueloY(860) - 40, sueloY(860) - 420, -1, 7, 12, 0.04, 861);
    setasTronco(1400, sueloY(1400) - 60, sueloY(1400) - 300, 1, 5, 10, 0.04, 1401);
    setasTronco(2300, sueloY(2300) - 50, sueloY(2300) - 360, -1, 6, 11, 0.04, 2301);
    // el suelo
    pintarSuelo(rr);
    // 1 · el conducto en la roca
    roca([[-40, 1190], [-40, 900], [40, 870], [150, 880], [270, 915], [370, 980], [450, 1060], [520, 1150], [560, 1190]], 0, 81);
    musgo(-30, 885, 330, 22, '#8f9a36', 82, { cuelga: 40, esporas: true }); musgo(280, 950, 160, 16, '#7f8a2c', 86, { cuelga: 24 });
    for (let k = 0; k < 12; k++) { g.strokeStyle = '#1a170f'; g.lineWidth = 3 + rr() * 5; g.beginPath(); const sx = 240 + rr() * 260; g.moveTo(sx, 960 + rr() * 60); g.quadraticCurveTo(sx + 30, 1080, sx + 10 + rr() * 60, 1190); g.stroke(); }
    if (P.rejilla) rejillaConducto();
    // setas que brillan por todo el bosque
    pintarSetas(rr);
    // Juego 1: el tocon de los anillos (la raiz que se aparta)
    { const x = P.tocon.x, b = sueloY(x); tocon(x, P.tocon.y, b); raizArco(x, b); }
    // 3 · el arroyo: piedras y la pasarela de hierro
    for (const [x, w] of [[2560, 70], [2700, 56], [2840, 74], [2990, 60]]) { roca([[x - w / 2, AGUA + 8], [x - w * 0.42, AGUA - 14], [x - w * 0.1, AGUA - 24], [x + w * 0.35, AGUA - 18], [x + w / 2, AGUA + 8]], 0, x); musgo(x - w * 0.4, AGUA - 18, w * 0.8, 8, '#8f9a36', x + 1); }
    pasarela(P.pasarela.x0, P.pasarela.x1, P.pasarela.y, AGUA + 40, 0, 91);
    pintarJuncos(rr);
    // 4 · la cabana del lenador
    casaMadera(3420, 220, 160, sueloY(3530), 0, 3420, { luz: true, humo: true });
    lena(3690, sueloY(3720));
    pintarAltramuces(rr);
    // 5 · los huertos y la granja con el porche de las campanillas
    valla(4040, 4380, 0); valla(4700, 5020, 0);
    cultivos(4080);
    espantapajaros(4450, sueloY(4450));
    invernadero(4530, sueloY(4620));
    pozo(4790, sueloY(4790));
    casaMadera(4880, 240, 175, sueloY(5000), 0, 4880, { pared: '#857152', luz: true });
    porche(5000, sueloY(5000) - 196);
    // 6 · la aldea: casas al pie del arbol, escalera y farolillos
    for (const [x, w, h] of [[5180, 170, 140], [5420, 150, 170], [5900, 180, 150], [6120, 150, 130]]) casaMadera(x, w, h, sueloY(x + w / 2), 0, x + 1, { luz: true, humo: x === 5420, pared: x % 3 ? '#6e5a3e' : '#7c6a4c' });
    // la capsula a la que se sube: va atornillada al arbol gigante de la capa de detras (linde/aldea.js)
    { const c = P.capsula; capsula(c.cx, c.cy, 78, 0, 5682, { ventanas: 3, puerta: true, oxido: true, luz: 1.8 }); plataforma(c.x0, c.x1, c.y, 0, 5683); escalera(c.escX, c.escY, c.escB, 0); }
    for (const [a, b2] of [[5250, 5600], [5760, 6170]]) guirnalda(a, b2, sueloY(a) - 200);
    // 7 · las afueras: el autobus como plataforma, postes, coche, parada y valla
    autobus(P.bus.x, P.bus.y, P.bus.w, P.bus.h, 0, 6520, { letrero: 'CENTRO' });
    tendido([6300, 6620, 6980, 7320]);
    coche(7000);
    paradaBus(6880);
    // 8 · la ciudad: acera, persiana, y el cuadro de luz del Juego 3
    g.fillStyle = '#4b4a42'; g.fillRect(7250, sueloY(7300) - 6, W, 26); g.strokeStyle = TINTA; g.lineWidth = 2; for (let x = 7250; x < W; x += 70) { g.beginPath(); g.moveTo(x, sueloY(7300) - 6); g.lineTo(x + 3, sueloY(7300) + 20); g.stroke(); hierba(x + 30, sueloY(7300) - 6, 12 + rr() * 14, 0, x); }
    if (P.persiana) { const x = 7960, b = sueloY(x) - 6, y = b - 300;
      chapa([[x + 90, b], [x + 90, b - 210], [x + 320, b - 210], [x + 320, b]], 0, 61, { col: '#4e4c44' }); g.strokeStyle = rgba(TINTA, 0.5); g.lineWidth = 2; for (let yy = b - 200; yy < b; yy += 12) { g.beginPath(); g.moveTo(x + 92, yy); g.lineTo(x + 318, yy); g.stroke(); }
      chapa([[x - 40, y], [x + 60, y], [x + 60, y + 120], [x - 40, y + 120]], 0, 62, { col: '#5d5a4e', remaches: 12 });
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { const px = x - 30 + i * 30, py = y + 10 + j * 27; g.fillStyle = '#1e1e1a'; g.fillRect(px, py, 26, 23); g.strokeStyle = (i + j) % 2 ? '#bfe3f4' : '#7c8a92'; g.lineWidth = 3; g.beginPath(); const q = (i * 3 + j) % 3; if (q === 0) { g.moveTo(px, py + 11); g.lineTo(px + 26, py + 11); } else if (q === 1) { g.moveTo(px + 13, py); g.lineTo(px + 13, py + 11); g.lineTo(px + 26, py + 11); } else { g.moveTo(px + 13, py); g.lineTo(px + 13, py + 23); } g.stroke(); }
      g.save(); g.globalCompositeOperation = 'lighter'; brillo(x + 10, y + 60, 130, '#a9cde6', 0.25); g.restore();
      g.strokeStyle = TINTA; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 60, y + 60); g.quadraticCurveTo(x + 80, y + 110, x + 96, b - 214); g.stroke(); }
    // hierba, hojarasca y flores
    pintarHierba(rr);
    // el 18 (solo en el concepto: en el juego esta el de verdad)
    if (P.dieciocho) P.dieciocho();
  });

  encenderLuces(J);
  // ================================================================= 6. EL REFLEJO del arroyo
  {
    const M = J, x0 = P.reflejo.x0, x1 = P.reflejo.x1, h = 330, y0 = AGUA, fondo = P.y1;
    const cp = document.createElement('canvas'); cp.width = x1 - x0; cp.height = h; const C = cp.getContext('2d');
    C.translate(0, h); C.scale(1, -1); S.copiar(C, x0, y0 - h, x1 - x0, h);
    M.save(); M.beginPath(); M.rect(x0, y0, x1 - x0, fondo - y0); M.clip();
    M.fillStyle = '#2e3a30'; M.fillRect(x0, y0, x1 - x0, fondo - y0);
    M.globalAlpha = 0.62; M.filter = 'blur(1.5px)'; M.drawImage(cp, x0, y0); M.filter = 'none'; M.globalAlpha = 1;
    const gr = M.createLinearGradient(0, y0, 0, y0 + 260); gr.addColorStop(0, 'rgba(30,40,32,.15)'); gr.addColorStop(1, 'rgba(14,18,14,.85)'); M.fillStyle = gr; M.fillRect(x0, y0, x1 - x0, 300);
    M.globalCompositeOperation = 'lighter'; const rr = azar(77);
    for (let k = 0; k < 160; k++) { const y = y0 + 4 + Math.pow(rr(), 1.5) * 150; M.fillStyle = `rgba(255,246,214,${0.08 + rr() * 0.25})`; M.fillRect(x0 + rr() * (x1 - x0), y, 12 + rr() * 60, 1.4); }
    M.restore();
    M.strokeStyle = TINTA; M.lineWidth = 2; M.beginPath(); M.moveTo(x0, y0); M.lineTo(x1, y0); M.stroke();
  }

  // ================================================================= 7. AIRE: polvo en los rayos, luciernagas, hojas que caen
  { const M = J;
  M.save(); M.globalCompositeOperation = 'lighter';
  { const rr = azar(88);
    for (let k = 0; k < 4200; k++) { const x = rr() * W, y = rr() * 1250, f = 0.4 + 0.6 * Math.exp(-(((x - SOL.x) / 3000) ** 2)); M.fillStyle = `rgba(255,244,214,${(0.06 + rr() * 0.28) * f})`; M.fillRect(x, y, 1.6, 1.6); }
    for (let k = 0; k < 160; k++) { const x = rr() * 3500, y = 500 + rr() * 650; brillo(x, y, 9 + rr() * 9, '#f3f0b8', 0.5, M); M.fillStyle = 'rgba(255,252,220,.95)'; M.fillRect(x - 1, y - 1, 2.4, 2.4); }
  }
  M.restore();
  { const rr = azar(89); for (let k = 0; k < 90; k++) { const x = 200 + rr() * 6000, y = 150 + rr() * 900; M.save(); M.translate(x, y); M.rotate(rr() * 3); M.beginPath(); M.ellipse(0, 0, 6, 2.6, 0, 0, 7); M.fillStyle = ['#a8964e', '#7f8a2c', '#c9b46a'][k % 3]; M.fill(); M.strokeStyle = TINTA; M.lineWidth = 0.9; M.stroke(); M.restore(); } }
  { const rr = azar(90); for (let k = 0; k < 14; k++) { const x = 5200 + rr() * 900, y = 700 + rr() * 300; M.strokeStyle = 'rgba(245,242,230,.85)'; M.lineWidth = 2; M.beginPath(); M.moveTo(x - 8, y - 4); M.quadraticCurveTo(x - 4, y - 7, x, y); M.quadraticCurveTo(x + 4, y - 7, x + 8, y - 4); M.stroke(); } }
  }

  // ================================================================= 8. PRIMER PLANO en silueta, desenfocado, con bokeh
  S.capa('frente', 5, () => {
    const rr = azar(99);
    const NEG = { osc: '#070805', med: '#0e1108', cla: '#1a200e', luz: '#3c3c1c', den: 0.7, tam: 12 };
    for (let x = -60; x < W; x += 120 + rr() * 200) {
      const ciudad = x > 6900, y = H - 60 - rr() * 160;
      if (ciudad ? rr() < 0.6 : rr() < 0.12) {
        // tuberia con valvula y codo
        const w = 160 + rr() * 220, yy = H - 120 - rr() * 120; g.fillStyle = '#070706';
        g.fillRect(x, yy, w, 34); g.fillRect(x + w - 34, yy - 120, 34, 154); g.beginPath(); g.arc(x + w * 0.4, yy + 17, 30, 0, 7); g.fill(); g.fillRect(x + w * 0.4 - 4, yy - 40, 8, 40); g.fillRect(x + w * 0.4 - 26, yy - 46, 52, 10); g.fillRect(x, yy + 34, w * 0.8, H - yy);
        g.strokeStyle = 'rgba(240,220,160,.28)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w - 34, yy); g.moveTo(x + w - 34, yy - 120); g.lineTo(x + w, yy - 120); g.stroke();
      } else {
        hojas(x, y, 140 + rr() * 110, 90 + rr() * 70, 0, Math.floor(x) + 5, NEG);
        if (rr() < 0.5) { const fx = x + 60, fy = H + 20; g.strokeStyle = '#080a05'; g.lineCap = 'round'; for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.3, l = 220 + rr() * 120, ex = fx + Math.cos(a) * l, ey = fy + Math.sin(a) * l; g.lineWidth = 6; g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo(fx + Math.cos(a) * l * 0.5, fy + Math.sin(a) * l * 0.6 - 30, ex, ey); g.stroke(); for (let h = 1; h < 12; h++) { const t = h / 12, hx = fx + (ex - fx) * t, hy = fy + (ey - fy) * t - Math.sin(t * Math.PI) * 26, hl = (1 - t) * 50 + 8; g.lineWidth = 5; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - hl * 0.8, hy - hl * 0.5); g.moveTo(hx, hy); g.lineTo(hx + hl * 0.8, hy - hl * 0.5); g.stroke(); } } }
      }
    }
    // marcos a los lados, como en la referencia
    hojas(-150, 760, 150, 420, 0, 981, NEG); hojas(W - 60, 1000, 180, 360, 0, 982, NEG);
    hojas(200, -30, 420, 150, 0, 991, NEG); hojas(3000, -60, 360, 120, 0, 993, NEG);
    for (let k = 0; k < 18; k++) colgajo(20 + k * 30, 40, 80 + rr() * 260, 0, 992 + k);
  });
  { const M = S.ctx('frente');
  M.save(); M.globalCompositeOperation = 'lighter';
  { const rr = azar(111); for (let k = 0; k < 70; k++) { const x = rr() * W, y = H - rr() * 260, r0 = 6 + rr() * 22; brillo(x, y, r0, '#ffe6a8', 0.35 + rr() * 0.3, M); } }
  M.restore();
  }
}
