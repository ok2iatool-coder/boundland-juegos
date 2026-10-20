// EL GIGANTE DEL PROLOGO: un AGUJERO NEGRO QUE ANDA (rediseño del 2026-10-20, pedido: «al ser el monstruo un agujero
// negro, tiene que tener cosas extrañas, tipo espaciales; haz como seria un agujero negro como tal»; el de antes,
// peludo y con la ciudad clavada, en antes/gigante_peludo_2026-10-20.js). Mucho mas grande que el Coloso; pasa por
// detras de la ciudad y no se deja ver entero: se ven las patas como columnas, el vientre y el costado.
//   - el cuerpo es VACIO: negro absoluto, y dentro, muy al fondo, estrellas y nebulosas (como una ventana al espacio)
//   - el borde es el ANILLO DE FOTONES: una raya de luz fria pegada a la silueta, que tiembla y corre
//   - alrededor, la LENTE: la luz del fondo se curva y se aparta (un halo oscuro), y por fuera corren anillos de
//     Einstein y estrellas estiradas a lo largo del contorno
//   - el DISCO DE ACRECION: un anillo inclinado de materia que gira (mas deprisa cuanto mas cerca, y mas brillante
//     por el lado que viene hacia la camara), pasa por detras y por delante del cuerpo
//   - lo que se traga: cascotes, un coche, una farola, una viga y ladrillos orbitan en espiral y se ESTIRAN al
//     caer dentro (espaguetizacion); el polvo del suelo sube hacia el
//   - el OJO es una singularidad: una rendija de luz que se abre con una espiral de estrellas cayendo dentro
//   - cada pisada abre en el suelo una onda que deforma la luz
// Colores frios de la anomalia (azul y violeta); nada naranja: el naranja es de la Podredumbre (GDD).
// Va en el FONDO, entre la ciudad gotica (0,12) y el paso elevado (0,26), con su propio parallax (F). Lo que brilla
// (anillo, disco, estrellas, ojo) se pinta aparte despues de gradar el fondo y se recorta con lo que tiene delante
// (`emisivos`, con la mascara). Coordenadas: las de su capa en u (x de la capa, y con el suelo en GY); `local` con
// el suelo en 0 bajo el centro del cuerpo, mirando a +x.
import { TINTA, temblar, trazarSuave, hash, azar, rgba } from '../dibujo/tinta.js';

export const F = 0.18, FY = F * 0.6;
export const GY = 512 - 32 * (1 - FY);          // la raya del suelo de su capa (como las de ciudad/obrero.js)
// paso de elefante: la zancada (V * P) poco mas larga que la pata, asi la pata es una columna y no un tablon
export const V = 130;
const P = 3.6, VUELO = 0.3;
const Y0 = -720, Y1 = 40, X0 = -1520, X1 = 1020;
const LUZ = '#d8ecff', AZUL = '#8fbaff', VIOLETA = '#a08cff', BLANCO = '#f4f8ff';
// el vientre, del pecho al anca (local, de +x a -x)
const VIENTRE = [[800, -398], [700, -352], [610, -318], [520, -300], [430, -268], [330, -246], [220, -236], [110, -248], [10, -236],
  [-100, -230], [-210, -246], [-320, -266], [-430, -290], [-540, -318], [-640, -348], [-740, -372], [-840, -380]];
// la silueta entera (cola que arrastra, anca, el lomo que se sale por arriba, el pecho y el vientre)
const BORDE = [
  [-1500, -12], [-1310, -58], [-1140, -150], [-1010, -262], [-940, -362], [-870, -468], [-770, -560], [-660, -650], [-640, -720],
  [990, -720], [960, -580], [915, -480], [870, -425],
  ...VIENTRE,
  [-905, -352], [-965, -302], [-1085, -192], [-1225, -100], [-1385, -30],
];
// el centro del disco de acrecion (local): a la altura del costado, para que cruce la pantalla
const DISCO = { x: 40, y: -330, a0: 470, a1: 1050, chato: 0.2, giro: -0.08 };
const RS = 215;          // el horizonte: la esfera negra del corazon, en el centro del disco

// las cuatro patas: cadera (local), fase del paso, lejos (del otro lado del cuerpo: detras)
const PATAS = [
  { hx: -650, hy: -392, fase: 0, lejos: false, ancho: 150, dir: 1 },
  { hx: 560, hy: -384, fase: 0.25, lejos: false, ancho: 150, dir: -1 },
  { hx: -520, hy: -392, fase: 0.5, lejos: true, ancho: 128, dir: 1 },
  { hx: 690, hy: -384, fase: 0.75, lejos: true, ancho: 128, dir: -1 },
];
// lo que se esta tragando: cada pieza da vueltas en espiral alrededor del disco hasta caer dentro
const PIEZAS = (() => {
  const r = azar(6061), tipos = ['coche', 'farola', 'viga', 'losa', 'ladrillo', 'ladrillo', 'losa', 'ladrillo', 'coche', 'losa', 'ladrillo', 'viga', 'ladrillo', 'losa'];
  return tipos.map((tipo, i) => { const per = 9 + r() * 7; return { tipo, r0: 900 + r() * 700, per, retraso: r() * per, a0: r() * 6.28, inc: 0.1 + r() * 0.35, giro: r() * 6.28, vg: (r() - 0.5) * 3, tam: tipo === 'coche' ? 1 : 0.6 + r() * 0.8, sem: i }; });
})();

export class Gigante {
  constructor() { this.cv = null; this.k = 0; this.bx0 = 0; this.polvos = []; this.ojo = 0; this.mira = 0; this.bolas = []; this.pustulas = []; }

  // la x del cuerpo en su capa en el instante tg (segundos desde que empieza a andar)
  bx(tg) { return this.bx0 + V * tg; }
  // coloca el cuerpo para que el ojo pase por la x de pantalla xp en el instante tg (con la camara en camx)
  centrarOjo(xp, tg, camx) { this.bx0 = xp - OJO.x - V * tg + camx * F; }

  // ---------------------------------------------------------------- el cuerpo, pintado una vez: el vacio con su fondo
  preparar(k) {
    if (this.cv && this.k === k) return;
    this.k = k;
    const w = Math.ceil((X1 - X0) * k), h = Math.ceil((Y1 - Y0) * k);
    const cv = this.cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.setTransform(k, 0, 0, k, -X0 * k, -Y0 * k);
    const r = azar(4407);
    this.sil = temblar(BORDE, 60, 4, 71);
    this.camino = new Path2D(); this.sil.forEach(([x, y], i) => (i ? this.camino.lineTo(x, y) : this.camino.moveTo(x, y))); this.camino.closePath();
    c.fillStyle = '#000000'; c.fill(this.camino);
    c.save(); c.clip(this.camino);
    // muy al fondo: nebulosas apagadas y estrellas, como si el cuerpo fuera una ventana al espacio
    for (let q = 0; q < 7; q++) {
      const x = -1000 + r() * 1800, y = -650 + r() * 380, rr = 140 + r() * 260;
      const g = c.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, rgba(r() < 0.5 ? VIOLETA : AZUL, 0.07 + r() * 0.05)); g.addColorStop(1, rgba(AZUL, 0));
      c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    for (let q = 0; q < 900; q++) {
      const x = -1450 + r() * 2400, y = -720 + r() * 720, a = 0.1 + r() * r() * 0.6;
      c.fillStyle = rgba(r() < 0.8 ? LUZ : VIOLETA, a); c.fillRect(x, y, r() < 0.93 ? 1.2 : 2.4, r() < 0.93 ? 1.2 : 2.4);
    }
    // junto al borde, nada: la sombra del horizonte (la luz no sale de ahi)
    c.lineWidth = 120; c.strokeStyle = '#000000'; c.stroke(this.camino);
    c.restore();
  }

  // la altura del vientre (local) en x: lo mismo que la silueta, sin el temblor
  vientre(x) {
    const P2 = [[-905, -352], ...[...VIENTRE].reverse(), [870, -425]];
    if (x <= P2[0][0]) return P2[0][1];
    for (let k = 1; k < P2.length; k++) if (x <= P2[k][0]) { const f = (x - P2[k - 1][0]) / (P2[k][0] - P2[k - 1][0]); return P2[k - 1][1] + (P2[k][1] - P2[k - 1][1]) * f; }
    return P2[P2.length - 1][1];
  }

  // ---------------------------------------------------------------- las patas
  // donde esta el pie de una pata (en la capa) en el instante tg, y si esta apoyado
  pie(p, tg) {
    const tau = tg / P + p.fase, n = Math.floor(tau), f = tau - n;
    const apoyo = (m) => this.bx((m - p.fase + (1 - VUELO) / 2) * P) + p.hx;
    if (f < 1 - VUELO) return { x: apoyo(n), y: 0, quieto: true, n };
    const k = (f - (1 - VUELO)) / VUELO, e = k * k * (3 - 2 * k);
    return { x: apoyo(n) + (apoyo(n + 1) - apoyo(n)) * e, y: -Math.sin(k * Math.PI) * 70, quieto: false, n };
  }
  // las pisadas entre dos instantes (para el golpe, el polvo y el sonido): [{ x, lejos }]
  pisadas(t0, t1) {
    const out = [];
    for (const p of PATAS) {
      if (t1 <= 0 || Math.floor(t1 / P + p.fase) <= Math.floor(t0 / P + p.fase)) continue;
      const q = this.pie(p, t1);
      out.push({ x: q.x, lejos: p.lejos });
      this.polvos.push({ x: q.x, t: t1, lejos: p.lejos });
    }
    return out;
  }
  // la onda de la ultima pisada, con la fuerza que le da el prologo
  onda(tg, k) {
    const q = this.polvos[this.polvos.length - 1];
    if (q && Math.abs(q.t - tg) < 0.05) q.k = k;
  }
  // el contorno de una pata (dos huesos casi rectos: una columna) en el instante tg
  formaPata(p, tg) {
    const bx = this.bx(tg), q = this.pie(p, tg);
    const hx = bx + p.hx, hy = p.hy, fx = q.x, fy = q.y - 34;
    const l1 = 230, l2 = 215;
    let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy);
    if (d > (l1 + l2) * 0.999) { const s = (l1 + l2) * 0.999 / d; dx *= s; dy *= s; d = (l1 + l2) * 0.999; }
    const a = Math.atan2(dy, dx), b = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const ak = a - b * p.dir, kx = hx + Math.cos(ak) * l1, ky = hy + Math.sin(ak) * l1;
    const w = p.ancho;
    const lado = (x0, y0, x1, y1, w0, w1) => { const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L; return [[x0 + nx * w0 / 2, y0 + ny * w0 / 2], [x1 + nx * w1 / 2, y1 + ny * w1 / 2], [x1 - nx * w1 / 2, y1 - ny * w1 / 2], [x0 - nx * w0 / 2, y0 - ny * w0 / 2]]; };
    const m = lado(hx, hy - 60, kx, ky, w * 1.15, w * 0.85), s = lado(kx, ky, fx, fy, w * 0.85, w * 0.7);
    return [m[0], m[1], s[1], [fx + w * 0.55, fy + 10], [fx + w * 0.5, q.y], [fx - w * 0.5, q.y], [fx - w * 0.52, fy + 8], s[2], m[2], m[3]];
  }
  // el trozo de pantalla por debajo del vientre (menos `margen`): ahi una pata de este lado tapa el cuerpo
  bajoVientre(c, bx, cab, margen = 46) {
    c.beginPath(); c.moveTo(bx - 1600, 200);
    for (let x = -1600; x <= 1100; x += 40) c.lineTo(bx + x, this.vientre(x) + cab - margen);
    c.lineTo(bx + 1100, 200); c.closePath();
  }
  dibujarPata(c, p, tg) {
    const pts = this.formaPata(p, tg);
    trazarSuave(c, pts); c.fillStyle = '#000000'; c.fill();
    c.strokeStyle = rgba(LUZ, p.lejos ? 0.18 : 0.3); c.lineWidth = 2; c.stroke();
  }

  // ---------------------------------------------------------------- lo que se traga: donde va cada pieza en el instante tg
  // (en espiral sobre un anillo inclinado; r baja hasta el borde y vuelve a empezar). delante: si pasa por delante.
  // CADA PIEZA ENTRA DESDE MUY ARRIBA (2026-10-20, pedido: «he visto un objeto aparecer de repente en el cielo y
  // caer; que caiga desde mas arriba, que no se vea que aparece en medio de la nada»): antes cada una empezaba a
  // mitad de su vuelta y salia de golpe en el cielo; ahora espera su turno (`retraso`) y la atrae desde 1.500 u por
  // encima de su espiral, fuera de la pantalla, y se acerca cayendo. null: aun no ha entrado
  pieza(q, tg, bx, cab) {
    const tt = tg - q.retraso;
    if (tt < 0) return null;
    const f = (tt / q.per) % 1, r = q.r0 * (1 - 0.72 * f * f);
    const a = q.a0 + tg * (0.25 + 260 / r) * 0.5 + f * 2.5;
    const x = bx + DISCO.x + Math.cos(a) * r, y = DISCO.y + cab + Math.sin(a) * r * q.inc - 1500 * (1 - f) ** 2;
    const estira = 1 + 5 * Math.pow(f, 3), ang = Math.atan2(Math.cos(a) * q.inc, -Math.sin(a));
    return { x, y, f, estira, ang, delante: Math.sin(a) > 0, alfa: 1 - Math.pow(f, 4) };
  }
  dibujarPieza(c, q, o) {
    if (!o || o.alfa <= 0.02) return;
    c.save(); c.translate(o.x, o.y); c.rotate(o.ang); c.scale(o.estira, 1 / Math.sqrt(o.estira)); c.rotate(q.giro + q.vg * o.f * 6);
    c.globalAlpha = o.alfa; c.scale(q.tam, q.tam);
    c.fillStyle = '#16171c'; c.strokeStyle = TINTA; c.lineWidth = 3;
    if (q.tipo === 'coche') {
      c.beginPath(); c.moveTo(-60, 0); c.lineTo(-56, -22); c.lineTo(-28, -26); c.lineTo(-14, -44); c.lineTo(26, -44); c.lineTo(42, -24); c.lineTo(62, -20); c.lineTo(62, 0); c.closePath(); c.fill(); c.stroke();
      for (const x of [-34, 36]) { c.beginPath(); c.arc(x, 2, 12, 0, 7); c.fillStyle = '#0b0b0d'; c.fill(); c.stroke(); }
      c.fillStyle = 'rgba(150,175,205,.25)'; c.fillRect(-10, -40, 30, 12);
    } else if (q.tipo === 'farola') {
      c.fillRect(-90, -4, 180, 8); c.strokeRect(-90, -4, 180, 8);
      c.beginPath(); c.moveTo(90, -10); c.lineTo(118, -14); c.lineTo(120, 8); c.lineTo(90, 6); c.closePath(); c.fill(); c.stroke();
    } else if (q.tipo === 'viga') {
      c.fillRect(-110, -10, 220, 20); c.strokeRect(-110, -10, 220, 20);
      c.beginPath(); for (let x = -110; x < 110; x += 22) { c.moveTo(x, -10); c.lineTo(x + 22, 10); c.moveTo(x + 22, -10); c.lineTo(x, 10); } c.lineWidth = 1.4; c.stroke();
    } else if (q.tipo === 'losa') {
      c.beginPath(); c.moveTo(-50, -12); c.lineTo(48, -16); c.lineTo(54, 10); c.lineTo(-46, 14); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#2a2f37'; c.lineWidth = 1.6; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(54, -6 + k * 6); c.lineTo(68, -12 + k * 8); c.stroke(); }
    } else { c.fillRect(-14, -7, 28, 14); c.strokeRect(-14, -7, 28, 14); }
    c.restore();
  }

  // ---------------------------------------------------------------- en el lienzo del fondo (px), detras de las capas de delante
  dibujar(c, tg, camF, s) {
    const ox = -camF.x * F, oy = -Math.max(0, camF.y) * FY + GY;
    const k = Math.min(s, 1.4);
    this.preparar(k);
    c.save(); c.setTransform(s, 0, 0, s, ox * s, oy * s);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const bx = this.bx(tg), cab = Math.sin((tg / P) * Math.PI * 4) * 5;
    // la sombra en el suelo
    const g = c.createRadialGradient(bx, 0, 0, bx, 0, 1300);
    g.addColorStop(0, 'rgba(4,4,8,.6)'); g.addColorStop(1, 'rgba(4,4,8,0)');
    c.save(); c.scale(1, 0.05); c.fillStyle = g; c.fillRect(bx - 1300, -1300, 2600, 2600); c.restore();
    // la LENTE: alrededor del cuerpo la luz del fondo se aparta (un halo oscuro que se va aclarando hacia fuera)
    c.save(); c.translate(bx, cab);
    for (const [w, a] of [[420, 0.12], [260, 0.16], [150, 0.2]]) { c.lineWidth = w; c.strokeStyle = `rgba(0,0,6,${a})`; c.stroke(this.camino); }
    c.restore();
    // lo que se traga y pasa por detras del cuerpo
    const piezas = PIEZAS.map((q) => [q, this.pieza(q, tg, bx, cab)]).filter(([, o]) => o);
    for (const [q, o] of piezas) if (!o.delante) this.dibujarPieza(c, q, o);
    for (const p of PATAS) if (p.lejos) this.dibujarPata(c, p, tg);
    // el cuerpo: el vacio con su fondo de estrellas (de su lienzo)
    c.drawImage(this.cv, bx + X0, Y0 + cab, X1 - X0, Y1 - Y0);
    c.save(); c.translate(bx, cab); c.lineWidth = 2.4; c.strokeStyle = rgba(LUZ, 0.35); c.stroke(this.camino); c.restore();
    // el ojo cerrado: una costura donde no hay estrellas
    if (this.ojo <= 0.02) { c.strokeStyle = 'rgba(160,190,230,.18)'; c.lineWidth = 3; c.beginPath(); c.moveTo(bx + OJO.x, OJO.y + cab - OJO.h * 0.5); c.quadraticCurveTo(bx + OJO.x + 6, OJO.y + cab, bx + OJO.x, OJO.y + cab + OJO.h * 0.5); c.stroke(); }
    else this.dibujarOjo(c, bx, cab, tg);
    // las patas de este lado, delante del vientre (recortadas por debajo de su curva)
    c.save(); this.bajoVientre(c, bx, cab, 95); c.clip();
    for (const p of PATAS) if (!p.lejos) this.dibujarPata(c, p, tg);
    c.restore();
    for (const [q, o] of piezas) if (o.delante) this.dibujarPieza(c, q, o);
    // el polvo del suelo, que sube hacia el cuerpo en espiral
    for (let i = 0; i < 60; i++) {
      const per = 4 + hash(i, 2) * 3, f = ((tg / per + hash(i, 3)) % 1 + 1) % 1, x0 = bx - 1000 + hash(i, 4) * 2000;
      const x = x0 + (bx + DISCO.x - x0) * f * f * 0.7 + Math.sin(f * 9 + i) * 30 * f, y = -4 - f * (380 + hash(i, 5) * 200);
      c.fillStyle = `rgba(150,160,180,${(0.35 * Math.sin(f * Math.PI)).toFixed(3)})`; c.fillRect(x, y, 2 + f * 2, 2 + f * 2);
    }
    // la onda de cada pisada: el suelo se arruga (la luz se dobla) en un anillo que sale disparado, y el polvo
    for (const q of this.polvos) {
      const e = tg - q.t; if (e < 0 || e > 3.2) continue;
      if (e < 0.9) {
        const ko = (q.k ?? 1) * (1 - e / 0.9) ** 1.5, ro = 160 + e * 1100;
        c.save(); c.translate(q.x, -6); c.scale(1, 0.07);
        c.lineWidth = 60 + e * 160; c.strokeStyle = `rgba(165,170,182,${(0.3 * ko).toFixed(3)})`;
        c.beginPath(); c.arc(0, 0, ro, 0, Math.PI * 2); c.stroke();
        c.lineWidth = 10; c.strokeStyle = `rgba(190,215,255,${(0.35 * ko).toFixed(3)})`; c.beginPath(); c.arc(0, 0, ro * 0.92, 0, Math.PI * 2); c.stroke();
        c.restore();
      }
      const a = (1 - e / 3.2) * 0.4, rr = 120 + e * 140;
      const gp = c.createRadialGradient(q.x, -30, 0, q.x, -30, rr);
      gp.addColorStop(0, `rgba(150,156,168,${a})`); gp.addColorStop(1, 'rgba(150,156,168,0)');
      c.save(); c.translate(q.x, -30); c.scale(1.6, 0.55); c.translate(-q.x, 30); c.fillStyle = gp; c.fillRect(q.x - rr, -30 - rr, rr * 2, rr * 2); c.restore();
    }
    this.polvos = this.polvos.filter((q) => tg - q.t < 3.4);
    c.restore();
  }

  // el ojo abierto: una rendija con el borde de luz y, dentro, una espiral de estrellas cayendo a un punto negro
  dibujarOjo(c, bx, cab, tg) {
    const k = this.ojo, x = bx + OJO.x, y = OJO.y + cab, w = OJO.w * k, h = OJO.h;
    const almendra = () => { c.beginPath(); c.moveTo(x, y - h / 2); c.quadraticCurveTo(x + w, y, x, y + h / 2); c.quadraticCurveTo(x - w, y, x, y - h / 2); };
    c.save(); almendra(); c.fillStyle = '#05060c'; c.fill(); c.clip();
    const px = x + this.mira * w * 0.35;
    for (let i = 0; i < 40; i++) {
      const f = ((tg * 0.5 + hash(i, 1)) % 1), r = h * 0.48 * (1 - f), a = hash(i, 2) * 6.28 + f * 9;
      c.fillStyle = rgba(i % 3 ? LUZ : VIOLETA, 0.8 * (1 - f)); c.fillRect(px + Math.cos(a) * r * 0.5, y + Math.sin(a) * r, 2, 2);
    }
    c.fillStyle = '#000000'; c.beginPath(); c.arc(px, y, Math.max(2, w * 0.18), 0, 7); c.fill();
    c.restore();
    almendra(); c.strokeStyle = rgba(BLANCO, 0.8); c.lineWidth = 3; c.stroke();
  }

  // ---------------------------------------------------------------- lo que brilla (px, encima del fondo ya gradado)
  // mascara: un lienzo con lo que tapa al gigante (las capas de delante); lo que brilla detras no se ve
  emisivos(c, tg, camF, s, t, mascara) {
    const ox = -camF.x * F, oy = -Math.max(0, camF.y) * FY + GY, bx = this.bx(tg);
    const cab = Math.sin((tg / P) * Math.PI * 4) * 5;
    const W = c.canvas.width, H = c.canvas.height;
    const tmp = this.tmp || (this.tmp = document.createElement('canvas'));
    if (tmp.width !== W || tmp.height !== H) { tmp.width = W; tmp.height = H; }
    // ---- el VACIO por encima de la niebla y la bruma del fondo: un agujero en el mundo (negro con su fondo de
    // estrellas), recortado por lo que tiene delante. Pintado dentro del fondo, el velo lo dejaba gris como el cielo
    const hv = this.hueco || (this.hueco = document.createElement('canvas'));
    if (hv.width !== W || hv.height !== H) { hv.width = W; hv.height = H; }
    const h = hv.getContext('2d');
    h.setTransform(1, 0, 0, 1, 0, 0); h.globalCompositeOperation = 'source-over'; h.clearRect(0, 0, W, H);
    h.setTransform(s, 0, 0, s, ox * s, oy * s);
    // (antes las patas se pintaban enteras ENCIMA del cuerpo: dentro de el se veian como columnas negras sin
    // estrellas que subian hasta la cadera, y parecia que el cuerpo quedaba delante de ellas)
    h.fillStyle = '#000000';
    for (const p of PATAS) { if (!p.lejos) continue; trazarSuave(h, this.formaPata(p, tg)); h.fill(); }
    if (this.cv) h.drawImage(this.cv, bx + X0, Y0 + cab, X1 - X0, Y1 - Y0);
    h.save(); this.bajoVientre(h, bx, cab, 95); h.clip();
    for (const p of PATAS) { if (p.lejos) continue; trazarSuave(h, this.formaPata(p, tg)); h.fill(); }
    h.restore();
    // el horizonte: negro sin nada (el resto del cuerpo deja ver estrellas lejanas; aqui no sale ni la luz)
    h.beginPath(); h.arc(bx + DISCO.x, DISCO.y + cab, RS, 0, Math.PI * 2); h.fill();
    if (this.ojo > 0.02) this.dibujarOjo(h, bx, cab, tg);
    h.setTransform(1, 0, 0, 1, 0, 0);
    if (mascara) { h.globalCompositeOperation = 'destination-out'; h.drawImage(mascara, 0, 0, W, H); }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.9; c.drawImage(hv, 0, 0); c.restore();
    const e = tmp.getContext('2d');
    e.setTransform(1, 0, 0, 1, 0, 0); e.globalCompositeOperation = 'source-over'; e.clearRect(0, 0, W, H);
    e.setTransform(s, 0, 0, s, ox * s, oy * s);
    e.lineCap = 'round'; e.lineJoin = 'round';
    e.globalCompositeOperation = 'lighter';
    const brillo = (x, y, r, color, a) => {
      const g = e.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(color, a)); g.addColorStop(0.35, rgba(color, a * 0.35)); g.addColorStop(1, rgba(color, 0));
      e.fillStyle = g; e.fillRect(x - r, y - r, r * 2, r * 2);
    };
    // ---- el disco de acrecion: la mitad de detras (la de arriba), que el cuerpo tapara
    const D = DISCO, cx = bx + D.x, cy = D.y + cab;
    const disco = (delante) => {
      // el anillo: un degradado del borde de dentro (blanco) hacia fuera (azul, violeta, nada), achatado e inclinado;
      // el lado izquierdo, que viene hacia la camara, mas brillante (Doppler)
      for (const [lado, kb] of [[-1, 1], [1, 0.55]]) {
        e.save(); e.translate(cx, cy); e.rotate(D.giro); e.scale(1, D.chato);
        e.beginPath(); e.rect(lado < 0 ? -D.a1 : 0, delante ? 0 : -D.a1, D.a1, D.a1); e.clip();
        const g = e.createRadialGradient(0, 0, D.a0 * 0.97, 0, 0, D.a1);
        g.addColorStop(0, rgba(BLANCO, 0)); g.addColorStop(0.02, rgba(BLANCO, 0.55 * kb)); g.addColorStop(0.12, rgba(LUZ, 0.32 * kb));
        g.addColorStop(0.4, rgba(AZUL, 0.16 * kb)); g.addColorStop(0.75, rgba(VIOLETA, 0.06 * kb)); g.addColorStop(1, rgba(VIOLETA, 0));
        e.fillStyle = g; e.beginPath(); e.arc(0, 0, D.a1, 0, Math.PI * 2); e.arc(0, 0, D.a0 * 0.97, 0, Math.PI * 2, true); e.fill();
        e.restore();
      }
      // la turbulencia: rayas finas que giran (mas deprisa las de dentro)
      for (let i = 0; i < 220; i++) {
        const u = hash(i, 11), r = D.a0 + (D.a1 - D.a0) * u * u, a = hash(i, 12) * 6.28 + tg * 0.55 * Math.pow(D.a0 / r, 1.5) * 2.2;
        if ((Math.sin(a) > 0) !== delante) continue;
        const ln = 0.12 * Math.pow(D.a0 / r, 1.5) * 1.6, viene = 0.5 + 0.5 * -Math.cos(a), al = (0.1 + 0.35 * (1 - u)) * viene;
        e.strokeStyle = rgba(u < 0.4 ? BLANCO : u < 0.75 ? AZUL : VIOLETA, al); e.lineWidth = 0.8 + (1 - u) * 1.4;
        e.beginPath();
        for (let q = 0; q <= 4; q++) {
          const aa = a - ln * (q / 4), xx = Math.cos(aa) * r, yy = Math.sin(aa) * r * D.chato;
          const X = cx + xx * Math.cos(D.giro) - yy * Math.sin(D.giro), Y = cy + xx * Math.sin(D.giro) + yy * Math.cos(D.giro);
          q ? e.lineTo(X, Y) : e.moveTo(X, Y);
        }
        e.stroke();
      }
    };
    disco(false);
    // el cuerpo tapa lo de detras: se borra su silueta (y la de las patas)
    e.save(); e.globalCompositeOperation = 'destination-out';
    e.save(); e.translate(bx, cab); e.fill(this.camino); e.restore();
    for (const p of PATAS) { trazarSuave(e, this.formaPata(p, tg)); e.fill(); }
    e.restore();
    // ---- el CORAZON: el anillo de fotones del horizonte (un circulo de luz), debajo la imagen de la parte de atras del
    // disco doblada por la gravedad (un arco que abraza la esfera por abajo; el de arriba queda fuera de la pantalla)
    // y mas fuera un anillo de Einstein
    {
      const hx = cx, hy = cy, vib = 0.85 + 0.15 * Math.sin(t * 7);
      e.beginPath(); e.arc(hx, hy, RS * 1.02, 0, Math.PI * 2);
      e.lineWidth = 26; e.strokeStyle = rgba(AZUL, 0.12 * vib); e.stroke();
      e.lineWidth = 7; e.strokeStyle = rgba(LUZ, 0.35 * vib); e.stroke();
      e.lineWidth = 2.4; e.strokeStyle = rgba(BLANCO, 0.9 * vib); e.stroke();
      for (const [rr, w, a] of [[1.16, 14, 0.12], [1.16, 4, 0.5], [1.22, 2, 0.25]]) {
        e.beginPath(); e.arc(hx, hy, RS * rr, Math.PI * 0.04, Math.PI * 0.96);
        e.lineWidth = w; e.strokeStyle = rgba(rr > 1.2 ? VIOLETA : LUZ, a); e.stroke();
      }
      e.setLineDash([18, 26]); e.lineDashOffset = t * 50;
      e.beginPath(); e.arc(hx, hy, RS * 1.55, 0, Math.PI * 2); e.lineWidth = 1.6; e.strokeStyle = rgba(VIOLETA, 0.14); e.stroke();
      e.setLineDash([]);
    }
    // ---- el ANILLO DE FOTONES: una raya de luz pegada al contorno, que tiembla y corre, con su halo
    e.save(); e.translate(bx, cab);
    e.lineWidth = 22; e.strokeStyle = rgba(AZUL, 0.07 + 0.03 * Math.sin(t * 3)); e.stroke(this.camino);
    e.lineWidth = 6; e.strokeStyle = rgba(LUZ, 0.22); e.stroke(this.camino);
    e.setLineDash([60, 140, 20, 90]); e.lineDashOffset = -t * 160;
    e.lineWidth = 2.2; e.strokeStyle = rgba(BLANCO, 0.7); e.stroke(this.camino);
    e.setLineDash([]);
    // ---- los ANILLOS DE EINSTEIN: copias del contorno algo mas grandes, finas, que corren al reves
    for (const [esc, al, vel] of [[1.02, 0.16, 90], [1.045, 0.1, -60], [1.075, 0.06, 40]]) {
      e.save(); e.translate(D.x, -380); e.scale(esc, esc); e.translate(-D.x, 380);
      e.setLineDash([30 + esc * 40, 80 + esc * 60]); e.lineDashOffset = t * vel;
      e.lineWidth = 2.4 / esc; e.strokeStyle = rgba(esc < 1.1 ? LUZ : VIOLETA, al); e.stroke(this.camino);
      e.restore();
    }
    e.setLineDash([]);
    e.restore();
    // ---- las estrellas de detras, estiradas por la lente en rayitas a lo largo del contorno
    const sil = this.sil || BORDE;
    for (let i = 0; i < 110; i++) {
      const j = Math.floor(hash(i, 21) * sil.length), [x0, y0] = sil[j], [x1, y1] = sil[(j + 1) % sil.length];
      const f = hash(i, 22), x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
      const dx = x - D.x, dy = y + 380, L = Math.hypot(dx, dy) || 1, sale = 14 + hash(i, 23) * 120;
      const X = bx + x + (dx / L) * sale, Y = cab + y + (dy / L) * sale;
      const tx = (x1 - x0), ty = (y1 - y0), tl = Math.hypot(tx, ty) || 1, largo = 6 + (1 - sale / 134) * 40;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (1 + hash(i, 24) * 3) + i));
      e.strokeStyle = rgba(hash(i, 25) < 0.8 ? LUZ : VIOLETA, 0.55 * tw * (1 - sale / 160)); e.lineWidth = 1.4;
      e.beginPath(); e.moveTo(X - (tx / tl) * largo, Y - (ty / tl) * largo); e.lineTo(X + (tx / tl) * largo, Y + (ty / tl) * largo); e.stroke();
    }
    // ---- las PATAS DE ESTE LADO VAN DELANTE DEL CUERPO (2026-10-20, pedido: «las piernas del monstruo estan por
    // detras del cuerpo completo, reajustalo»): el anillo de fotones del contorno, sus copias y las estrellas
    // estiradas se borran donde una pata de este lado tapa el vientre, y el borde de luz de cada pata solo se pinta
    // donde se ve: las de este lado por debajo del vientre (su canto se junta con el del cuerpo) y las de detras
    // solo fuera de la silueta del cuerpo
    e.save(); this.bajoVientre(e, bx, cab, 95); e.clip();
    e.globalCompositeOperation = 'destination-out';
    for (const p of PATAS) { if (p.lejos) continue; trazarSuave(e, this.formaPata(p, tg)); e.fillStyle = '#000'; e.fill(); }
    e.restore();
    // (el muslo sube 95 u por encima del vientre: su canto se ve POR DELANTE del cuerpo, y en la cadera, donde se
    // junta, un anillo de luz)
    for (const p of PATAS) {
      if (p.lejos) continue;
      const hx = bx + p.hx, hy = p.hy + cab - 20, gc = e.createRadialGradient(hx, hy, 0, hx, hy, 120);
      gc.addColorStop(0, rgba(AZUL, 0.16)); gc.addColorStop(1, rgba(AZUL, 0));
      e.fillStyle = gc; e.fillRect(hx - 120, hy - 120, 240, 240);
    }
    e.save(); this.bajoVientre(e, bx, cab, 95); e.clip();
    for (const p of PATAS) {
      if (p.lejos) continue;
      trazarSuave(e, this.formaPata(p, tg));
      e.lineWidth = 3; e.strokeStyle = rgba(LUZ, 0.32); e.stroke();
      e.lineWidth = 9; e.strokeStyle = rgba(AZUL, 0.06); e.stroke();
    }
    e.restore();
    if (!this.fuera) { this.fuera = new Path2D(); this.fuera.rect(-4000, -4000, 8000, 8000); this.fuera.addPath(this.camino); }
    e.save(); e.translate(bx, cab); e.clip(this.fuera, 'evenodd'); e.translate(-bx, -cab);
    for (const p of PATAS) {
      if (!p.lejos) continue;
      trazarSuave(e, this.formaPata(p, tg));
      e.lineWidth = 3; e.strokeStyle = rgba(LUZ, 0.18); e.stroke();
    }
    e.restore();
    // ---- el disco: la mitad de delante, por encima del cuerpo
    disco(true);
    // ---- el ojo: la rendija de luz
    if (this.ojo > 0.02) {
      const px = bx + OJO.x + this.mira * OJO.w * this.ojo * 0.35, py = OJO.y + cab;
      brillo(px, py, OJO.h * 1.1, AZUL, 0.4 * this.ojo);
      brillo(px, py, OJO.h * 0.4, BLANCO, 0.5 * this.ojo);
      e.strokeStyle = rgba(BLANCO, 0.35 * this.ojo); e.lineWidth = 2;
      e.beginPath(); e.moveTo(px - 220 * this.ojo, py); e.lineTo(px + 220 * this.ojo, py); e.stroke();     // el destello
    }
    e.setTransform(1, 0, 0, 1, 0, 0);
    // lo que tiene delante lo tapa
    if (mascara) { e.globalCompositeOperation = 'destination-out'; e.drawImage(mascara, 0, 0, W, H); }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.9; c.drawImage(tmp, 0, 0); c.restore();
  }
}

// el ojo, en el costado (local)
const OJO = { x: 330, y: -372, w: 30, h: 96 };
