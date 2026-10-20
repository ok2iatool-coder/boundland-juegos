// EL GIGANTE DEL PROLOGO: algo mucho mas grande que el Coloso, que pasa por detras de la ciudad y no se deja ver
// entero. No cabe en el encuadre: de el se ven las patas como columnas, el vientre que cuelga y el costado; el lomo
// y la cabeza se salen por arriba. Lo raro: lleva la ciudad clavada en la carne (un trozo de torre con sus ventanas,
// una viga, una farola, la aguja de una iglesia en el anca), por eso al pasar detras de los edificios parece que se
// mueve el horizonte; y en el costado se abre un OJO vertical, mira un momento y se cierra. Lleva PELO apelmazado:
// el costado peinado hacia atras y abajo, el anca y la cola con mechones, flecos largos que cuelgan del vientre y se
// mecen con cada paso, y greñas en los muslos, las rodillas y sobre los pies; y los tallos del hongo (`hongo.js`)
// se doblan y se mecen en cada fotograma.
// Va en el FONDO, entre la ciudad gotica (0,12) y el paso elevado (0,26), con su propio parallax (F): asi le tapan
// las capas de delante y le cubren sus velos de bruma, y se ve mal, como tiene que verse. Las cosas que brillan
// (pustulas, bolas de los tallos, esporas, el ojo) se pintan aparte despues de gradar el fondo (si no, el tinte
// azul de la ciudad se comeria el naranja) y se recortan con lo que tienen delante (`emisivos`, con la mascara).
// Coordenadas: las de su capa en u (x de la capa, y con el suelo de la capa en GY); `local` con el suelo en 0 bajo
// el centro del cuerpo, mirando a +x.
import { TINTA, temblar, trazarSuave, trazar, hash, azar, rgba } from '../dibujo/tinta.js';
import { COLOR } from '../dibujo/paletas.js';
import { mechon, talloHongo } from './hongo.js';

export const F = 0.18, FY = F * 0.6;
export const GY = 512 - 32 * (1 - FY);          // la raya del suelo de su capa (como las de ciudad/obrero.js)
// paso de elefante: la zancada (V * P) poco mas larga que la pata, asi la pata es una columna y no un tablon
export const V = 130;
const P = 3.6, VUELO = 0.3;
const CUERPO = '#141318', CUERPO_C = '#24232a', PATA = '#121116', PATA_L = '#1f1e25';
const Y0 = -660, Y1 = 40, X0 = -1520, X1 = 1020;
// el vientre, del pecho al anca: cuelga en el medio y forma bolsas entre las patas (local, de +x a -x)
const VIENTRE = [[800, -398], [700, -352], [610, -318], [520, -300], [430, -268], [330, -246], [220, -236], [110, -248], [10, -236],
  [-100, -230], [-210, -246], [-320, -266], [-430, -290], [-540, -318], [-640, -348], [-740, -372], [-840, -380]];       // lo que se pinta de antemano del cuerpo (local)

// las cuatro patas: cadera (local), fase del paso, lejos (del otro lado del cuerpo: mas clara, detras)
const PATAS = [
  { hx: -650, hy: -392, fase: 0, lejos: false, ancho: 150, dir: 1 },
  { hx: 560, hy: -384, fase: 0.25, lejos: false, ancho: 150, dir: -1 },
  { hx: -520, hy: -392, fase: 0.5, lejos: true, ancho: 128, dir: 1 },
  { hx: 690, hy: -384, fase: 0.75, lejos: true, ancho: 128, dir: -1 },
];

export class Gigante {
  constructor() { this.cv = null; this.k = 0; this.bx0 = 0; this.pustulas = []; this.bolas = []; this.tallos = []; this.flecos = []; this.polvos = []; this.ojo = 0; this.mira = 0; }

  // la x del cuerpo en su capa en el instante tg (segundos desde que empieza a andar)
  bx(tg) { return this.bx0 + V * tg; }
  // coloca el cuerpo para que el ojo pase por la x de pantalla xp en el instante tg (con la camara en camx)
  centrarOjo(xp, tg, camx) { this.bx0 = xp - OJO.x - V * tg + camx * F; }

  // ---------------------------------------------------------------- el cuerpo, pintado una vez
  preparar(k) {
    if (this.cv && this.k === k) return;
    this.k = k;
    const w = Math.ceil((X1 - X0) * k), h = Math.ceil((Y1 - Y0) * k);
    const cv = this.cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.setTransform(k, 0, 0, k, -X0 * k, -Y0 * k);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const r = azar(4407);
    // ---- la silueta: cola que arrastra, anca, el lomo que se sale por arriba, el pecho y el vientre que cuelga
    const borde = [
      [-1500, -12], [-1310, -58], [-1140, -150], [-1010, -262], [-940, -362], [-870, -468], [-770, -560], [-660, -650], [-640, -720],
      [990, -720], [960, -580], [915, -480], [870, -425],
      ...VIENTRE,
      [-905, -352], [-965, -302], [-1085, -192], [-1225, -100], [-1385, -30],
    ];
    const sil = temblar(borde, 38, 9, 71);
    trazarSuave(c, sil); c.fillStyle = CUERPO; c.fill();
    c.save(); trazarSuave(c, sil); c.clip();
    // volumen: el vientre recoge algo de la luz de la ciudad por abajo, el lomo se pierde en la oscuridad
    const g = c.createLinearGradient(0, -640, 0, -300);
    g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(130,140,165,.26)');
    c.fillStyle = g; c.fillRect(X0, Y0, X1 - X0, -230 - Y0);
    // pliegues de grasa que cuelgan del vientre
    for (let k2 = 0; k2 < 5; k2++) {
      const dy = 26 + k2 * 30;
      c.beginPath();
      for (let x = -880; x <= 860; x += 40) {
        const yb = this.vientre(x) - dy + Math.sin(x * 0.011 + k2 * 2) * 8;
        if (x === -880) c.moveTo(x, yb); else c.lineTo(x, yb);
      }
      c.strokeStyle = `rgba(0,0,0,${0.55 - k2 * 0.07})`; c.lineWidth = 6 - k2 * 0.6; c.stroke();
      c.strokeStyle = `rgba(150,160,180,${0.09 - k2 * 0.012})`; c.lineWidth = 2; c.stroke();
    }
    // arrugas verticales junto a las patas
    for (const p of PATAS) for (let q = -3; q <= 3; q++) {
      const x = p.hx + q * 22; c.beginPath(); c.moveTo(x, p.hy - 120); c.quadraticCurveTo(x + 10, p.hy - 50, x - 4, p.hy + 10);
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 3; c.stroke();
    }
    // costurones y placas de hongo seco
    for (let k2 = 0; k2 < 26; k2++) {
      const x = -900 + r() * 1750, y = -330 - r() * 300, w2 = 30 + r() * 90;
      c.fillStyle = rgba('#2a252a', 0.5 + r() * 0.3); c.beginPath(); c.ellipse(x, y, w2, w2 * 0.35, r() * 0.6 - 0.3, 0, 7); c.fill();
    }
    // el pelo del costado: mechones peinados hacia atras y abajo (de la cruz al vientre y de la grupa a la cola),
    // en tres pasadas: la sombra entre mechones, el mechon y una hebra de luz
    const flujo = (x, y) => Math.PI / 2 + 0.75 + (x < -850 ? 0.5 : 0) - Math.max(0, (y + 330) / 400) * 0.3;
    const mechones = [];
    for (let y = -700; y < -230; y += 18) for (let x = -1300; x < 960; x += 20) {
      const xx = x + (r() - 0.5) * 18 + ((y / 18) & 1) * 10, yy = y + (r() - 0.5) * 12;
      if (yy > this.vientre(xx) - 12) continue;
      mechones.push([xx, yy, flujo(xx, yy) + (r() - 0.5) * 0.35, 55 + r() * 45, 9 + r() * 6, (r() - 0.4) * 0.7, 5, 0.25 + r() * 0.25, r() * 6]);
    }
    c.beginPath(); for (const m of mechones) mechon(c, m[0] + 2, m[1] + 3, m[2], m[3], m[4], m[5], m[6], m[7], m[8]); c.fillStyle = 'rgba(0,0,0,.28)'; c.fill();
    c.beginPath(); for (const m of mechones) mechon(c, ...m); c.fillStyle = CUERPO_C; c.fill();
    c.beginPath();
    for (const [x, y, a, l] of mechones) if (r() < 0.45) { c.moveTo(x + Math.cos(a) * l * 0.15, y + Math.sin(a) * l * 0.15); c.quadraticCurveTo(x + Math.cos(a - 0.15) * l * 0.5, y + Math.sin(a - 0.15) * l * 0.5, x + Math.cos(a - 0.3) * l * 0.8, y + Math.sin(a - 0.3) * l * 0.8); }
    c.strokeStyle = 'rgba(150,158,178,.13)'; c.lineWidth = 1.4; c.stroke();
    // el volumen otra vez encima (el pelo no puede borrar la luz de abajo ni la sombra del lomo)
    c.fillStyle = g; c.fillRect(X0, Y0, X1 - X0, -230 - Y0);
    c.restore();
    // greñas que salen por el contorno del anca y la cola (hacia fuera y atras)
    const fuera = [];
    for (let i = 0; i < 9; i++) {
      const a = borde[i], b = borde[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L;
      for (let d = 0; d < L; d += 15) {
        const x = a[0] + (b[0] - a[0]) * d / L, y = a[1] + (b[1] - a[1]) * d / L;
        const ang = Math.atan2(ny, nx) * 0.5 + Math.atan2(0.3, -1) * 0.5 + (r() - 0.5) * 0.45;
        fuera.push([x - nx * 14, y - ny * 14, ang, 50 + r() * 90, 13 + r() * 9, (r() - 0.5) * 0.9, 6, 0.3 + r() * 0.3, r() * 6]);
      }
    }
    c.beginPath(); for (const m of fuera) mechon(c, ...m); c.fillStyle = CUERPO; c.fill(); c.strokeStyle = TINTA; c.lineWidth = 1.5; c.stroke();
    // la tinta del contorno (de la parte que se ve)
    trazarSuave(c, sil); c.strokeStyle = TINTA; c.lineWidth = 3.4; c.stroke();
    // ---- la ciudad clavada en la carne (despues del contorno: asoma por fuera)
    // (1) un trozo de torre, de lado, hundido en el costado con sus ventanas, que sale por debajo del vientre
    this.ruina(c, -330, -200, 80, 330, -0.5, 11);
    // (2) una viga de celosia que le atraviesa y asoma por abajo
    c.save(); c.translate(190, -150); c.rotate(-2.5);
    c.fillStyle = '#2b2b30'; c.fillRect(-12, -10, 24, 260); c.strokeStyle = TINTA; c.lineWidth = 3; c.strokeRect(-12, -10, 24, 260);
    c.beginPath(); for (let y = 0; y < 250; y += 24) { c.moveTo(-12, y); c.lineTo(12, y + 24); c.moveTo(12, y); c.lineTo(-12, y + 24); } c.lineWidth = 1.6; c.stroke();
    c.restore();
    // (3) una farola doblada que cuelga del vientre, con su pantalla
    c.strokeStyle = TINTA; c.lineWidth = 7; c.beginPath(); c.moveTo(470, -330); c.quadraticCurveTo(520, -250, 600, -236); c.stroke();
    c.strokeStyle = '#34343a'; c.lineWidth = 4; c.stroke();
    trazar(c, [[590, -242], [624, -242], [618, -226], [596, -226]]); c.fillStyle = '#2a2a30'; c.fill(); c.strokeStyle = TINTA; c.lineWidth = 2.4; c.stroke();
    // (4) la aguja de una iglesia en el anca, inclinada hacia atras
    this.aguja(c, -900, -440, -0.75, 13);
    // (5) cables y una cadena que le cuelgan del vientre
    c.strokeStyle = TINTA; c.lineWidth = 2.4;
    for (const [x, l] of [[60, 120], [-160, 90], [-60, 150], [380, 70]]) { const y0 = this.vientre(x) + 4; c.beginPath(); c.moveTo(x, y0); c.quadraticCurveTo(x + 14, y0 + l * 0.6, x + 4, y0 + l); c.stroke(); }
    // ---- pustulas: el sitio y el tamano (la luz va aparte, en emisivos)
    this.pustulas = [];
    for (let k2 = 0; k2 < 24; k2++) {
      const x = -820 + r() * 1650, y = this.vientre(x) - 20 - r() * 150, rr = 5 + r() * 13;
      c.fillStyle = '#2e2420'; c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill();
      c.strokeStyle = TINTA; c.lineWidth = 2; c.stroke();
      this.pustulas.push([x, y, rr, r() * 6]);
    }
    // ---- tallos del hongo: en el anca y saliendo del costado, curvados hacia arriba (se dibujan en cada fotograma)
    this.tallos = [];
    const tallo = (x, y, ang, largo, grosor) => this.tallos.push({ x, y, ang, largo, grosor, f: r() * 6, curva: -0.5 - r() * 0.5 });
    for (let k2 = 0; k2 < 9; k2++) tallo(-990 + k2 * 38 + r() * 20, -330 - k2 * 34 - r() * 20, -1.9 - r() * 0.7, 110 + r() * 120, 9 + r() * 7);
    for (let k2 = 0; k2 < 7; k2++) tallo(-560 + k2 * 170 + r() * 60, -470 - r() * 90, -2.4 + r() * 0.5, 80 + r() * 90, 8 + r() * 5);
    this.bolas = this.tallos.map((q) => [q.x, q.y, q.grosor * 1.3, q.f]);
    // los flecos del vientre: donde nacen, lo largos y su fase
    this.flecos = [];
    for (let x = -880; x <= 860; x += 9) {
      const largo = (35 + r() * 55 + (r() < 0.12 ? 70 : 0)) * (1 + 0.8 * Math.exp(-(((x + 60) / 520) ** 2)));
      this.flecos.push({ x: x + (r() - 0.5) * 8, largo, ancho: 11 + r() * 8, f: r() * 6, curva: (r() - 0.5) * 0.7, onda: 0.2 + r() * 0.3, dy: r() * 10 });
    }
    // la costura donde esta el ojo cerrado
    c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 4; c.beginPath(); c.moveTo(OJO.x, OJO.y - OJO.h * 0.55); c.quadraticCurveTo(OJO.x + 6, OJO.y, OJO.x, OJO.y + OJO.h * 0.55); c.stroke();
  }

  // la altura del vientre (local) en x: lo mismo que la silueta, sin el temblor
  vientre(x) {
    const P2 = [[-905, -352], ...[...VIENTRE].reverse(), [870, -425]];
    if (x <= P2[0][0]) return P2[0][1];
    for (let k = 1; k < P2.length; k++) if (x <= P2[k][0]) { const f = (x - P2[k - 1][0]) / (P2[k][0] - P2[k - 1][0]); return P2[k - 1][1] + (P2[k][1] - P2[k - 1][1]) * f; }
    return P2[P2.length - 1][1];
  }

  ruina(c, x, y, w, h, ang, sem) {
    c.save(); c.translate(x, y); c.rotate(ang);
    const pts = temblar([[-w / 2, 0], [w / 2, 0], [w / 2, -h * 0.82], [w * 0.15, -h], [-w * 0.2, -h * 0.9], [-w / 2, -h * 0.95]], 14, 2, sem);
    trazar(c, pts); c.fillStyle = '#2c2c33'; c.fill(); c.strokeStyle = TINTA; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#0c0c10';
    for (let j = 0; j < 9; j++) for (let i = 0; i < 3; i++) if (hash(i, j, sem) > 0.25) c.fillRect(-w / 2 + 10 + i * (w - 20) / 3, -24 - j * (h * 0.85 / 9), (w - 20) / 3 - 8, h * 0.85 / 9 - 10);
    c.restore();
  }
  aguja(c, x, y, ang, sem) {
    c.save(); c.translate(x, y); c.rotate(ang);
    const pts = temblar([[-26, 30], [26, 30], [22, -60], [10, -70], [4, -190], [0, -230], [-4, -190], [-10, -70], [-22, -60]], 12, 1.2, sem);
    trazar(c, pts); c.fillStyle = '#26262d'; c.fill(); c.strokeStyle = TINTA; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#0c0c10'; c.beginPath(); c.ellipse(0, -30, 7, 16, 0, 0, 7); c.fill();
    c.restore();
  }

  // ---------------------------------------------------------------- las patas
  // donde esta el pie de una pata (en la capa) en el instante tg, y si esta apoyado
  pie(p, tg) {
    const tau = tg / P + p.fase, n = Math.floor(tau), f = tau - n;
    // el pie apoya en el sitio por el que paso la cadera a mitad del apoyo
    const apoyo = (m) => this.bx((m - p.fase + (1 - VUELO) / 2) * P) + p.hx;
    if (f < 1 - VUELO) return { x: apoyo(n), y: 0, quieto: true, n };
    const k = (f - (1 - VUELO)) / VUELO, e = k * k * (3 - 2 * k);
    return { x: apoyo(n) + (apoyo(n + 1) - apoyo(n)) * e, y: -Math.sin(k * Math.PI) * 70, quieto: false, n };
  }
  // la onda de polvo que se abre a ras de suelo en la ultima pisada (prologo.pisar)
  onda(tg, k) {
    const q = this.polvos[this.polvos.length - 1];
    if (q && Math.abs(q.t - tg) < 0.05) q.k = k;
  }
  // las pisadas entre dos instantes (para el golpe, el polvo y el sonido): [{ x, lejos }]
  pisadas(t0, t1) {
    const out = [];
    // la pata se posa cuando acaba su vuelo: cuando tg / P + fase pasa por un entero
    for (const p of PATAS) {
      if (t1 <= 0 || Math.floor(t1 / P + p.fase) <= Math.floor(t0 / P + p.fase)) continue;
      const q = this.pie(p, t1);
      out.push({ x: q.x, lejos: p.lejos });
      this.polvos.push({ x: q.x, t: t1, lejos: p.lejos });
    }
    return out;
  }

  dibujarPata(c, p, tg) {
    const bx = this.bx(tg), q = this.pie(p, tg);
    const hx = bx + p.hx, hy = p.hy, fx = q.x, fy = q.y - 34;      // el tobillo, encima de la almohadilla
    // dos huesos (muslo y cana), casi rectos: una columna
    const l1 = 230, l2 = 215;
    let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy);
    if (d > (l1 + l2) * 0.999) { const s = (l1 + l2) * 0.999 / d; dx *= s; dy *= s; d = (l1 + l2) * 0.999; }
    const a = Math.atan2(dy, dx), b = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const ak = a - b * p.dir, kx = hx + Math.cos(ak) * l1, ky = hy + Math.sin(ak) * l1;
    const w = p.ancho, col = p.lejos ? PATA_L : PATA;
    // la columna: ancha arriba, la rodilla abultada, el tobillo y la almohadilla
    const lado = (x0, y0, x1, y1, w0, w1) => { const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L; return [[x0 + nx * w0 / 2, y0 + ny * w0 / 2], [x1 + nx * w1 / 2, y1 + ny * w1 / 2], [x1 - nx * w1 / 2, y1 - ny * w1 / 2], [x0 - nx * w0 / 2, y0 - ny * w0 / 2]]; };
    const m = lado(hx, hy - 60, kx, ky, w * 1.25, w * 0.92), s = lado(kx, ky, fx, fy, w * 0.92, w * 0.78);
    const pts = [m[0], m[1], s[1], [fx + w * 0.62, fy + 10], [fx + w * 0.6, q.y], [fx - w * 0.6, q.y], [fx - w * 0.58, fy + 8], s[2], m[2], m[3]];
    trazarSuave(c, temblar(pts, 30, 4, p.hx | 0)); c.fillStyle = col; c.fill(); c.strokeStyle = TINTA; c.lineWidth = 3.2; c.stroke();
    c.save(); trazarSuave(c, pts); c.clip();
    // anillos de piel y el canto que recoge algo de luz
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 3;
    for (let k = 0; k < 9; k++) { const f = k / 9, x = hx + (fx - hx) * f, y = hy + (fy - hy) * f + 20; c.beginPath(); c.moveTo(x - w * 0.7, y); c.quadraticCurveTo(x, y + 12, x + w * 0.7, y - 4); c.stroke(); }
    c.fillStyle = 'rgba(140,150,170,.08)'; c.fillRect(Math.min(hx, fx) - w, Math.min(hy, fy) - 80, w * 0.5, 600);
    c.restore();
    // greñas: por detras del muslo, en la rodilla y sobre el pie (cuelgan; la pata que vuela las lleva detras)
    const atras = m[0][0] < m[3][0] ? [m[0], m[1]] : [m[3], m[2]], vuelo = q.quieto ? 0 : 0.35;
    const gr = [];
    for (let f = 0.12; f < 0.95; f += 0.07) {
      const x = atras[0][0] + (atras[1][0] - atras[0][0]) * f, y = atras[0][1] + (atras[1][1] - atras[0][1]) * f, h = hash(f * 10, p.hx);
      gr.push([x + 8, y, Math.PI / 2 + 0.35 + vuelo + h * 0.25, 55 + hash(f * 10, 3) * 60, 15, 0.3, 6, 0.3, h * 6 - tg * 2]);
    }
    for (let k = -3; k <= 3; k++) gr.push([kx + k * w * 0.12, ky + 6, Math.PI / 2 + 0.3 + vuelo + k * 0.06, 60 + hash(k, p.hx) * 40, 16, 0.25, 6, 0.3, k - tg * 2]);
    for (let k = -4; k <= 4; k++) gr.push([fx + k * w * 0.11, fy - 22, Math.PI / 2 + k * 0.07 + vuelo * 0.5, 36 + hash(k, 7) * 26, 15, 0.1, 5, 0.2, k]);
    c.beginPath(); for (const m2 of gr) mechon(c, ...m2); c.fillStyle = col; c.fill(); c.strokeStyle = TINTA; c.lineWidth = 1.5; c.stroke();
    // las unas
    c.fillStyle = '#2d2b30';
    for (let k = -1; k <= 1; k++) { c.beginPath(); c.ellipse(fx + w * 0.42 + k * 4, q.y - 10 - k * 9, 14, 9, 0.3, 0, 7); c.fill(); c.strokeStyle = TINTA; c.lineWidth = 2; c.stroke(); }
  }

  // ---------------------------------------------------------------- en el lienzo del fondo (px), detras de las capas de delante
  dibujar(c, tg, camF, s) {
    const ox = -camF.x * F, oy = -Math.max(0, camF.y) * FY + GY;
    const k = Math.min(s, 1.4);
    this.preparar(k);
    c.save(); c.setTransform(s, 0, 0, s, ox * s, oy * s);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const bx = this.bx(tg);
    // la sombra en el suelo
    const g = c.createRadialGradient(bx, 0, 0, bx, 0, 1300);
    g.addColorStop(0, 'rgba(10,10,14,.5)'); g.addColorStop(1, 'rgba(10,10,14,0)');
    c.save(); c.scale(1, 0.05); c.fillStyle = g; c.fillRect(bx - 1300, -1300, 2600, 2600); c.restore();
    // lo que se mueve (patas, flecos, tallos) se pinta en capas sin desenfoque y cada capa se desenfoca de una vez:
    // con el filtro puesto se desenfocaba cada trazo por separado y, con las greñas, las patas costaban 230 ms
    const lejos = this.capaLimpia(0, c, s, ox, oy);
    for (const p of PATAS) if (p.lejos) this.dibujarPata(lejos, p, tg);
    this.ponerCapa(c, 0, 1.1 * s);
    // el cuerpo, de su lienzo (un poco desenfocado: esta lejos)
    c.save(); c.filter = `blur(${(0.9 * s).toFixed(2)}px)`;
    // el cuerpo cabecea con cada paso
    const cab = Math.sin((tg / P) * Math.PI * 4) * 5;
    c.drawImage(this.cv, bx + X0, Y0 + cab, X1 - X0, Y1 - Y0);
    c.restore();
    // el ojo, en la carne (el parpado y la pupila; su luz va en emisivos)
    if (this.ojo > 0.02) this.dibujarOjo(c, bx, cab);
    // los flecos del vientre y los tallos, y encima las patas de este lado, que van por delante del vientre: se
    // recortan por debajo de su curva (un poco por encima, para que tapen la tinta del vientre) y asi la pata sale
    // del cuerpo sin una tapa dibujada arriba
    const cerca = this.capaLimpia(1, c, s, ox, oy);
    this.vivo(cerca, tg, bx, cab);
    cerca.save();
    cerca.beginPath(); cerca.moveTo(bx - 1600, 200);
    for (let x = -1600; x <= 1100; x += 40) cerca.lineTo(bx + x, this.vientre(x) + cab - 46);
    cerca.lineTo(bx + 1100, 200); cerca.closePath(); cerca.clip();
    for (const p of PATAS) if (!p.lejos) this.dibujarPata(cerca, p, tg);
    cerca.restore();
    this.ponerCapa(c, 1, 0.85 * s);
    // el polvo de cada pisada: una onda a ras de suelo que sale disparada y una nube baja que se abre y se va
    for (const q of this.polvos) {
      const e = tg - q.t; if (e < 0 || e > 3.2) continue;
      if (e < 0.9) {
        const ko = (q.k ?? 1) * (1 - e / 0.9) ** 1.5, ro = 160 + e * 1100;
        c.save(); c.translate(q.x, -6); c.scale(1, 0.07);
        c.lineWidth = 60 + e * 160; c.strokeStyle = `rgba(165,170,182,${(0.34 * ko).toFixed(3)})`;
        c.beginPath(); c.arc(0, 0, ro, 0, Math.PI * 2); c.stroke();
        c.restore();
      }
      const a = (1 - e / 3.2) * 0.42, rr = 120 + e * 140;
      const gp = c.createRadialGradient(q.x, -30, 0, q.x, -30, rr);
      gp.addColorStop(0, `rgba(150,156,168,${a})`); gp.addColorStop(1, 'rgba(150,156,168,0)');
      c.save(); c.translate(q.x, -30); c.scale(1.6, 0.55); c.translate(-q.x, 30); c.fillStyle = gp; c.fillRect(q.x - rr, -30 - rr, rr * 2, rr * 2); c.restore();
    }
    this.polvos = this.polvos.filter((q) => tg - q.t < 3.4);
    c.restore();
  }

  // una capa del tamano del lienzo, limpia y con la transformacion de la del gigante
  capaLimpia(i, c, s, ox, oy) {
    const W = c.canvas.width, H = c.canvas.height;
    const capas = this.capas || (this.capas = []);
    const cv = capas[i] || (capas[i] = document.createElement('canvas'));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const e = cv.getContext('2d');
    e.setTransform(1, 0, 0, 1, 0, 0); e.clearRect(0, 0, W, H);
    e.setTransform(s, 0, 0, s, ox * s, oy * s); e.lineJoin = 'round'; e.lineCap = 'round';
    return e;
  }
  ponerCapa(c, i, blur) {
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.filter = `blur(${blur.toFixed(2)}px)`; c.drawImage(this.capas[i], 0, 0); c.restore();
  }

  vivo(e, tg, bx, cab) {
    // el balanceo del paso: el vientre baja y sube y los flecos llegan tarde
    const paso = Math.sin((tg / P) * Math.PI * 4 - 0.9);
    e.beginPath();
    for (const q of this.flecos) {
      const y = this.vientre(q.x) + cab - 8;
      mechon(e, bx + q.x, y - q.dy, Math.PI / 2 + 0.22 + Math.sin(tg * 1.7 + q.f) * 0.06 + paso * 0.07, q.largo, q.ancho, q.curva + paso * 0.15, 7, q.onda, q.f - tg * 2.2);
    }
    e.fillStyle = CUERPO; e.fill(); e.strokeStyle = TINTA; e.lineWidth = 1.5; e.stroke();
    e.beginPath();
    for (const q of this.flecos) { const x = bx + q.x, y = this.vientre(q.x) + cab - 4, a = Math.PI / 2 + 0.2 + paso * 0.07; e.moveTo(x - 4, y); e.quadraticCurveTo(x - 6 + Math.cos(a) * q.largo * 0.3, y + q.largo * 0.35, x - 2 + Math.cos(a) * q.largo * 0.6, y + q.largo * 0.65); }
    e.strokeStyle = 'rgba(140,150,172,.16)'; e.lineWidth = 1.6; e.stroke();
    // los tallos: se mecen despacio y cabecean con el paso
    this.tallos.forEach((q, i) => {
      const mece = Math.sin(tg * 0.9 + q.f) * 0.06 + paso * 0.05;
      const [x, y, R] = talloHongo(e, bx + q.x, q.y + cab, q.ang + mece, q.largo, q.grosor, q.curva - mece * 1.5, {
        piel: CUERPO_C, tallo: '#4a2210', bola: '#6a3416', nucleo: '#8a4a22', borde: '#2a1208', tinta: 3, hifas: 'rgba(226,121,43,.22)', luz: 'rgba(210,120,60,.3)',
      });
      this.bolas[i] = [x - bx, y - cab, R, q.f];
    });
  }

  dibujarOjo(c, bx, cab) {
    const k = this.ojo, x = bx + OJO.x, y = OJO.y + cab, w = OJO.w * k, h = OJO.h;
    c.save();
    // el parpado abierto: almendra vertical
    c.beginPath(); c.moveTo(x, y - h / 2); c.quadraticCurveTo(x + w, y, x, y + h / 2); c.quadraticCurveTo(x - w, y, x, y - h / 2);
    c.fillStyle = '#3b1d10'; c.fill();
    c.save(); c.clip();
    // el iris, apagado, y la pupila de rendija que se mueve hacia donde mira
    const px = x + this.mira * w * 0.35;
    const gi = c.createRadialGradient(px, y, 0, px, y, h * 0.42);
    gi.addColorStop(0, '#c9773a'); gi.addColorStop(0.6, '#7a3510'); gi.addColorStop(1, '#2a1208');
    c.fillStyle = gi; c.fillRect(x - w, y - h / 2, w * 2, h);
    c.fillStyle = '#050405'; c.beginPath(); c.ellipse(px, y, Math.max(1.5, w * 0.12), h * 0.36, 0, 0, 7); c.fill();
    c.restore();
    c.beginPath(); c.moveTo(x, y - h / 2); c.quadraticCurveTo(x + w, y, x, y + h / 2); c.quadraticCurveTo(x - w, y, x, y - h / 2);
    c.strokeStyle = TINTA; c.lineWidth = 4; c.stroke();
    // pliegues de carne alrededor
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
    for (const d of [-1, 1]) { c.beginPath(); c.moveTo(x + d * (w + 8), y - h * 0.45); c.quadraticCurveTo(x + d * (w + 20), y, x + d * (w + 8), y + h * 0.45); c.stroke(); }
    c.restore();
  }

  // ---------------------------------------------------------------- lo que brilla (px, encima del fondo ya gradado)
  // mascara: un lienzo con lo que tapa al gigante (las capas de delante); lo que brilla detras no se ve
  emisivos(c, tg, camF, s, t, mascara) {
    const ox = -camF.x * F, oy = -Math.max(0, camF.y) * FY + GY, bx = this.bx(tg);
    const cab = Math.sin((tg / P) * Math.PI * 4) * 5;
    const W = c.canvas.width, H = c.canvas.height;
    const tmp = this.tmp || (this.tmp = document.createElement('canvas'));
    if (tmp.width !== W || tmp.height !== H) { tmp.width = W; tmp.height = H; }
    const e = tmp.getContext('2d');
    e.setTransform(1, 0, 0, 1, 0, 0); e.globalCompositeOperation = 'source-over'; e.clearRect(0, 0, W, H);
    e.setTransform(s, 0, 0, s, ox * s, oy * s);
    e.globalCompositeOperation = 'lighter';
    const brillo = (x, y, r, color, a) => {
      const g = e.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(color, a)); g.addColorStop(0.35, rgba(color, a * 0.35)); g.addColorStop(1, rgba(color, 0));
      e.fillStyle = g; e.fillRect(x - r, y - r, r * 2, r * 2);
    };
    // pustulas y bolas de los tallos: laten despacio, desacompasadas
    for (const [x, y, r, f] of this.pustulas) { const a = 0.42 + 0.3 * Math.sin(t * 1.3 + f); brillo(bx + x, y + cab, r * 3.4, COLOR.podre, a); brillo(bx + x, y + cab, r * 0.8, '#ffd2a0', a * 0.8); }
    for (const [x, y, r, f] of this.bolas) { const a = 0.5 + 0.3 * Math.sin(t * 1.7 + f); brillo(bx + x, y + cab, r * 3.6, COLOR.podre, a); brillo(bx + x, y + cab, r, '#ffd2a0', a * 0.9); }
    // esporas que caen del vientre como nieve sucia
    for (let i = 0; i < 70; i++) {
      const x = bx - 900 + hash(i, 3) * 1800, y0 = this.vientre(x - bx) + cab;
      const caida = (t * (14 + hash(i, 5) * 18) + hash(i, 7) * 400) % 420;
      const y = y0 + caida, a = 0.5 * (1 - caida / 420);
      e.fillStyle = rgba('#f0a467', a); e.beginPath(); e.arc(x + Math.sin(t * 0.8 + i) * 12, y, 1.4 + hash(i, 9) * 1.4, 0, 7); e.fill();
    }
    // el ojo
    if (this.ojo > 0.02) brillo(bx + OJO.x + this.mira * OJO.w * this.ojo * 0.35, OJO.y + cab, OJO.h * 0.9, '#e08a44', 0.32 * this.ojo);
    e.setTransform(1, 0, 0, 1, 0, 0);
    // lo que tiene delante lo tapa
    if (mascara) { e.globalCompositeOperation = 'destination-out'; e.drawImage(mascara, 0, 0, W, H); }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.85; c.drawImage(tmp, 0, 0); c.restore();
  }
}

// el ojo, en el costado (local)
const OJO = { x: 330, y: -372, w: 30, h: 96 };
