// EL SUBSUELO DEL PROLOGO: el corte de la tierra por el que baja la camara desde la calle hasta el laboratorio.
// De arriba abajo: el firme de la calle, las tuberias (la alcantarilla con su pozo y sus peldaños, cables, los
// cimientos de ladrillo de un edificio), los ESCOMBROS de la ciudad que la explosion enterro (losas con la ferralla
// al aire, un coche boca abajo, una farola, una señal), estratos de tierra y roca, las galerias de los insectos que
// bajan hacia el laboratorio (GDD: son ellos los que desmontan el techo) y la LOSA del laboratorio, con la piedra
// encajada en una grieta justo encima del frasco del 18. Una grieta baja desde la calle y crece con cada pisada del
// gigante; por ella cae polvo, y abajo se cuela la luz calida del frasco.
// Va en pantalla, encima de todo (el juego ya ha pintado su mundo debajo): x en u desde un ancla que no se mueve
// mientras se baja, y la profundidad en u desde la calle. Lo quieto se pinta una vez en un lienzo; lo vivo, encima.
// PROFUNDIDAD (2026-10-20, pedido: «mete profundidad, hazlo algo 3D: un coche mas lejano, escombros uno mas cerca que
// otros, quita esos huevos»): tres capas que se mueven distinto al bajar. Al FONDO (mas oscura, mas pequeña, se
// mueve menos) la tierra de detras con otro coche aplastado, losas, tuberias y la boca de otro tunel, que se ve por
// los HUECOS que deja el derrumbe en el corte; el CORTE en medio; y DELANTE (mas grande, desenfocada, se mueve mas)
// rocas, raices, ferralla y el canto de una losa que pasan por delante de la camara.
import { TINTA, temblar, trazar, tinta, azar, hash, rgba, mezclar } from '../dibujo/tinta.js';
import { dibujarCoche } from '../dibujo/coche.js';

export const HONDO = 1244;            // de la calle al techo de la sala de estasis (u)
const M = 140;                        // margen a los lados (u): la sacudida no enseña el borde
const TIERRA = ['#24272d', '#1d2026', '#191b20', '#17191e', '#141619', '#121317'];

export class Subsuelo {
  constructor() { this.cv = null; this.clave = ''; this.polvo = []; this.grieta = []; this.hormiga = { huye: 0 }; this.ondas = []; this.chinas = []; this.reloj = 0; this.tension = 0; this.soltada = false; }

  // ---------------------------------------------------------------- lo quieto, una vez por tamano de pantalla
  preparar(w, s) {
    const k = Math.min(s, 1.6), clave = `${Math.round(w)}x${k.toFixed(2)}`;
    if (this.cv && this.clave === clave) return;
    this.clave = clave; this.w = w; this.k = k;
    const cv = this.cv = document.createElement('canvas');
    cv.width = Math.ceil((w + 2 * M) * k); cv.height = Math.ceil((HONDO + 20) * k);
    const c = cv.getContext('2d');
    c.setTransform(k, 0, 0, k, M * k, 0);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const r = azar(9151), X0 = -M, X1 = w + M, WW = X1 - X0;
    // ---- el fondo de tierra: bandas que oscurecen con la profundidad, con su borde ondulado
    const banda = (y0, y1, col, sem) => {
      c.beginPath(); c.moveTo(X0, y1 + 40);
      for (let x = X0; x <= X1; x += 30) c.lineTo(x, y0 + Math.sin(x * 0.008 + sem) * 14 + (hash(Math.round(x / 30), sem) - 0.5) * 6);
      c.lineTo(X1, y1 + 40); c.closePath(); c.fillStyle = col; c.fill();
      // el canto de arriba de cada estrato recoge algo de luz
      c.beginPath();
      for (let x = X0; x <= X1; x += 30) { const y = y0 + Math.sin(x * 0.008 + sem) * 14; if (x === X0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.strokeStyle = 'rgba(150,165,185,.07)'; c.lineWidth = 2; c.stroke();
    };
    c.fillStyle = TIERRA[0]; c.fillRect(X0, 0, WW, HONDO + 20);
    banda(70, 250, TIERRA[1], 1);
    banda(250, 660, TIERRA[2], 2);
    banda(660, 760, '#1a1c22', 3);
    banda(760, 850, TIERRA[3], 4);
    banda(850, 930, '#191a1f', 5);
    banda(930, 1070, TIERRA[4], 6);
    // grano: piedrecitas y motas por todas partes
    for (let i = 0; i < WW * HONDO / 900; i++) {
      const x = X0 + r() * WW, y = 40 + r() * (HONDO - 60), rr = 0.8 + r() * (y < 250 ? 3 : 5);
      c.fillStyle = rgba(r() < 0.5 ? '#3a404a' : '#0d0e11', 0.35 + r() * 0.4);
      c.beginPath(); c.ellipse(x, y, rr * 1.3, rr, r() * 3, 0, 7); c.fill();
    }
    // ---- el firme de la calle: zahorra apretada y una linea de cables
    c.fillStyle = '#2a2d33'; c.fillRect(X0, 30, WW, 36);
    for (let i = 0; i < WW / 5; i++) { c.fillStyle = rgba('#4a505a', 0.3 + r() * 0.3); c.beginPath(); c.arc(X0 + r() * WW, 34 + r() * 30, 1 + r() * 2.6, 0, 7); c.fill(); }
    c.strokeStyle = TINTA; c.lineWidth = 2; c.beginPath(); c.moveTo(X0, 66); c.lineTo(X1, 66); c.stroke();
    // ---- los cimientos de ladrillo de un edificio (a la izquierda)
    const bx0 = w * 0.04, bx1 = w * 0.24;
    c.fillStyle = '#2b2522'; c.fillRect(bx0, 66, bx1 - bx0, 200);
    for (let j = 0; j < 14; j++) for (let i = 0; i < 12; i++) {
      const x = bx0 + i * 34 + (j % 2) * 17, y = 70 + j * 14;
      if (x + 30 > bx1) continue;
      c.fillStyle = mezclar('#3a312c', '#24201d', hash(i, j, 5)); c.fillRect(x, y, 30, 11);
    }
    c.strokeStyle = TINTA; c.lineWidth = 2.4; c.strokeRect(bx0, 66, bx1 - bx0, 200);
    // ---- la alcantarilla: el tubo cortado, su pozo con peldaños hasta la calle, y tuberias y cables al lado
    const ax = w * 0.68, ay = 168, ar = 64;
    c.fillStyle = '#0a0b0e'; c.fillRect(ax - 20, 30, 40, ay - ar - 30 + 8);
    c.strokeStyle = '#3a404a'; c.lineWidth = 6; c.beginPath(); c.moveTo(ax - 23, 30); c.lineTo(ax - 23, ay - ar + 6); c.moveTo(ax + 23, 30); c.lineTo(ax + 23, ay - ar + 6); c.stroke();
    c.strokeStyle = '#59606c'; c.lineWidth = 2.4; for (let y = 44; y < ay - ar; y += 14) { c.beginPath(); c.moveTo(ax - 12, y); c.lineTo(ax + 12, y); c.stroke(); }
    c.beginPath(); c.arc(ax, ay, ar + 12, 0, 7); c.fillStyle = '#3a3f47'; c.fill(); c.strokeStyle = TINTA; c.lineWidth = 2.6; c.stroke();
    c.beginPath(); c.arc(ax, ay, ar, 0, 7); c.fillStyle = '#08090b'; c.fill(); c.stroke();
    c.save(); c.beginPath(); c.arc(ax, ay, ar, 0, 7); c.clip();
    c.fillStyle = '#16212a'; c.fillRect(ax - ar, ay + ar * 0.45, ar * 2, ar);
    c.strokeStyle = 'rgba(160,190,215,.25)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(ax - ar * 0.8, ay + ar * 0.45); c.lineTo(ax + ar * 0.8, ay + ar * 0.45); c.stroke();
    c.restore();
    c.strokeStyle = 'rgba(160,175,195,.12)'; c.lineWidth = 3; c.beginPath(); c.arc(ax, ay, ar + 6, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
    for (const [x, y, rr] of [[w * 0.32, 118, 17], [w * 0.37, 132, 11], [w * 0.88, 104, 13]]) {
      c.beginPath(); c.arc(x, y, rr, 0, 7); c.fillStyle = '#31363e'; c.fill(); c.strokeStyle = TINTA; c.lineWidth = 2.2; c.stroke();
      c.beginPath(); c.arc(x, y, rr * 0.62, 0, 7); c.fillStyle = '#0b0c0f'; c.fill();
    }
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(w * 0.47 + (i % 3) * 9, 90 + Math.floor(i / 3) * 9, 4.5, 0, 7); c.fillStyle = ['#2c2a26', '#33302a', '#24262b'][i % 3]; c.fill(); c.strokeStyle = TINTA; c.lineWidth = 1.4; c.stroke(); }
    // ---- los escombros de la ciudad enterrada
    // cada losa a su distancia (d: 0 lejos, 1 cerca): lejos pequeña, azulada y con la linea fina; cerca grande, oscura
    // y con la linea gruesa (asi en el corte unas quedan mas cerca que otras)
    const losa = (x, y, l, g, a, sem, d = hash(sem, 7)) => {
      c.save(); c.translate(x, y); c.rotate(a); c.scale(0.6 + 0.6 * d, 0.6 + 0.6 * d);
      trazar(c, temblar([[-l / 2, -g / 2], [l / 2, -g / 2], [l / 2 + 4, g / 2], [-l / 2 + 6, g / 2]], 16, 1.8, sem));
      c.fillStyle = mezclar(mezclar('#2d3138', '#22252b', hash(sem, 1)), '#4a5a72', 0.45 * (1 - d)); c.fill(); tinta(c, 1.2 + 2 * d);
      c.strokeStyle = 'rgba(160,170,185,.12)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-l / 2 + 4, -g / 2 + 2); c.lineTo(l / 2 - 4, -g / 2 + 2); c.stroke();
      // la ferralla que asoma por la rotura
      c.strokeStyle = '#4a3a30'; c.lineWidth = 1.8;
      for (let q = 0; q < 3; q++) { const yy = -g / 2 + (q + 1) * g / 4; c.beginPath(); c.moveTo(l / 2, yy); c.quadraticCurveTo(l / 2 + 14, yy - 6 + q * 5, l / 2 + 18 + q * 6, yy + 10 - q * 9); c.stroke(); }
      c.restore();
    };
    // (de lejos a cerca: las cercanas tapan a las lejanas)
    const losas = Array.from({ length: 30 }, (_, i) => [X0 + r() * WW, 280 + r() * 360, 50 + r() * 170, 16 + r() * 24, (r() - 0.5) * 1.4, 100 + i]);
    losas.sort((a, b) => hash(a[5], 7) - hash(b[5], 7)).forEach((q) => losa(...q));
    // un coche boca abajo
    c.save(); c.translate(w * 0.2, 470); c.rotate(0.12); c.scale(0.95, 0.95); dibujarCoche(c, { semilla: 7, vuelto: true, pintura: '#3d4148', verde: '#26281f', verdeClaro: '#3a3c2e' }); c.restore();
    // una farola tumbada y una señal con el rombo
    c.save(); c.translate(w * 0.78, 400); c.rotate(-0.42);
    c.fillStyle = '#2a2d33'; c.fillRect(-150, -5, 300, 10); c.strokeStyle = TINTA; c.lineWidth = 2.4; c.strokeRect(-150, -5, 300, 10);
    trazar(c, [[150, -12], [190, -16], [196, 8], [150, 10]]); c.fillStyle = '#32363d'; c.fill(); tinta(c, 2.2);
    c.restore();
    c.save(); c.translate(w * 0.52, 560); c.rotate(0.6);
    c.fillStyle = '#2a2d33'; c.fillRect(-4, 0, 8, 120); c.strokeStyle = TINTA; c.lineWidth = 2; c.strokeRect(-4, 0, 8, 120);
    trazar(c, [[0, -34], [30, 0], [0, 34], [-30, 0]]); c.fillStyle = '#3b3f46'; c.fill(); tinta(c, 2.2);
    c.strokeStyle = 'rgba(190,185,165,.3)'; c.lineWidth = 2; trazar(c, [[0, -18], [16, 0], [0, 18], [-16, 0]]); c.stroke();
    c.restore();
    // ladrillos sueltos y cristales
    for (let i = 0; i < 80; i++) {
      const x = X0 + r() * WW, y = 270 + r() * 380, d = r(), e = 0.55 + 0.75 * d;
      c.save(); c.translate(x, y); c.rotate(r() * 3); c.scale(e, e);
      c.fillStyle = mezclar(mezclar('#3a312c', '#211d1a', r()), '#4a5a72', 0.5 * (1 - d)); c.fillRect(-8, -4, 16, 8);
      if (d > 0.6) { c.strokeStyle = TINTA; c.lineWidth = 1.4; c.strokeRect(-8, -4, 16, 8); }
      c.restore();
    }
    for (let i = 0; i < 40; i++) { const x = X0 + r() * WW, y = 270 + r() * 380; c.fillStyle = 'rgba(190,210,225,.22)'; trazar(c, [[x, y], [x + 4, y - 3], [x + 7, y + 2]]); c.fill(); }
    // ---- estratos: vetas finas y cantos rodados
    for (let i = 0; i < 18; i++) {
      const y = 680 + r() * 380; c.beginPath();
      for (let x = X0; x <= X1; x += 40) { const yy = y + Math.sin(x * 0.006 + i) * 18; if (x === X0) c.moveTo(x, yy); else c.lineTo(x, yy); }
      c.strokeStyle = rgba(r() < 0.5 ? '#2a2f37' : '#0b0c0f', 0.5); c.lineWidth = 1 + r() * 2; c.stroke();
    }
    for (let i = 0; i < 40; i++) {
      const x = X0 + r() * WW, y = 680 + r() * 380, rr = 8 + r() * 26;
      trazar(c, temblar([[x - rr, y], [x - rr * 0.4, y - rr * 0.7], [x + rr * 0.6, y - rr * 0.6], [x + rr, y + rr * 0.1], [x + rr * 0.3, y + rr * 0.6], [x - rr * 0.6, y + rr * 0.5]], 8, 1.2, 300 + i));
      c.fillStyle = mezclar('#272a31', '#1a1c21', r()); c.fill(); tinta(c, 1.8);
      c.strokeStyle = 'rgba(150,165,185,.1)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - rr * 0.4, y - rr * 0.6); c.lineTo(x + rr * 0.5, y - rr * 0.5); c.stroke();
    }
    // ---- un tunel de metro enterrado, medio hundido: el anillo de dovelas, la via y los cascotes que lo llenan
    const mx = w * 0.27, my = 830, mr = 118;
    c.beginPath(); c.arc(mx, my, mr + 16, 0, 7); c.fillStyle = '#30353d'; c.fill(); c.strokeStyle = TINTA; c.lineWidth = 2.6; c.stroke();
    c.beginPath(); c.arc(mx, my, mr, 0, 7); c.fillStyle = '#0a0b0e'; c.fill(); c.stroke();
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(mx + Math.cos(a) * mr, my + Math.sin(a) * mr); c.lineTo(mx + Math.cos(a) * (mr + 16), my + Math.sin(a) * (mr + 16)); c.stroke(); }
    c.save(); c.beginPath(); c.arc(mx, my, mr, 0, 7); c.clip();
    c.fillStyle = '#1b1d22'; c.fillRect(mx - mr, my + mr * 0.62, mr * 2, mr);                                   // la solera
    c.strokeStyle = '#4a4e56'; c.lineWidth = 3; c.beginPath(); c.moveTo(mx - mr, my + mr * 0.6); c.lineTo(mx + mr, my + mr * 0.6); c.stroke();   // el carril
    // el derrumbe que entra por un lado
    trazar(c, temblar([[mx + mr, my - mr * 0.4], [mx + mr * 0.2, my + mr * 0.1], [mx - mr * 0.1, my + mr * 0.6], [mx + mr, my + mr]], 10, 3, 77));
    c.fillStyle = '#25282e'; c.fill(); tinta(c, 1.8);
    c.strokeStyle = 'rgba(150,165,185,.1)'; c.lineWidth = 3; c.beginPath(); c.arc(mx, my, mr - 6, Math.PI * 1.1, Math.PI * 1.55); c.stroke();
    c.restore();
    // ---- la losa del laboratorio (lo de la piedra va aparte: depende de donde caiga el frasco)
    const L0 = 1072;
    c.fillStyle = '#0d0e10'; c.fillRect(X0, L0 - 10, WW, 10);                               // la lamina impermeable
    c.fillStyle = '#2c3138'; c.fillRect(X0, L0, WW, HONDO - L0 + 20);
    const gl = c.createLinearGradient(0, L0, 0, HONDO);
    gl.addColorStop(0, 'rgba(0,0,0,.25)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gl; c.fillRect(X0, L0, WW, HONDO - L0);
    for (let y = L0 + 28; y < HONDO; y += 30) { c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(X0, y); c.lineTo(X1, y); c.stroke(); }
    for (let x = X0 + 20; x < X1; x += 120) { c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, L0); c.lineTo(x, HONDO); c.stroke(); }
    // ferralla vista en el corte de la losa: puntos de las barras
    for (let x = X0 + 10; x < X1; x += 22) for (const y of [L0 + 22, HONDO - 22]) { c.fillStyle = '#4a3a30'; c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill(); }
    // un conducto de ventilacion y una bandeja de cables que pasan por dentro
    const cx0 = w * 0.08, cx1 = w * 0.3;
    c.fillStyle = '#3a3f47'; c.fillRect(cx0, 1112, cx1 - cx0, 56); c.strokeStyle = TINTA; c.lineWidth = 2.4; c.strokeRect(cx0, 1112, cx1 - cx0, 56);
    c.fillStyle = '#0b0c0f'; c.fillRect(cx0 + 8, 1120, cx1 - cx0 - 16, 40);
    for (let x = cx0 + 6; x < cx1; x += 18) { c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.arc(x, 1115, 1.5, 0, 7); c.arc(x, 1165, 1.5, 0, 7); c.fill(); }
    c.fillStyle = '#23272d'; c.fillRect(w * 0.7, 1150, w * 0.32, 14); c.strokeStyle = TINTA; c.lineWidth = 1.8; c.strokeRect(w * 0.7, 1150, w * 0.32, 14);
    // el borde de abajo (el techo de la sala, visto desde arriba en corte)
    c.strokeStyle = TINTA; c.lineWidth = 3; c.beginPath(); c.moveTo(X0, HONDO); c.lineTo(X1, HONDO); c.stroke();
    // ---- oscurecer con la profundidad (la calle aun recoge luz; lo hondo casi negro) menos la losa
    const go = c.createLinearGradient(0, 0, 0, HONDO);
    go.addColorStop(0, 'rgba(0,0,0,0)'); go.addColorStop(0.35, 'rgba(0,0,0,.12)'); go.addColorStop(0.8, 'rgba(0,0,0,.26)'); go.addColorStop(0.86, 'rgba(0,0,0,.15)'); go.addColorStop(1, 'rgba(0,0,0,.05)');
    c.fillStyle = go; c.fillRect(X0, 0, WW, HONDO + 20);
    // el color del laboratorio y de la ciudad (dibujo/hk.js: azul pizarra) sobre todo el corte: los ladrillos y la
    // ferralla no se quedan en pardo-naranja (GDD: el naranja es solo la Podredumbre)
    c.save(); c.globalCompositeOperation = 'color'; c.globalAlpha = 0.5; c.fillStyle = '#41658f'; c.fillRect(X0, 0, WW, HONDO + 20); c.restore();
    // ---- los huecos del derrumbe: bolsas de aire entre los escombros por las que se ve la capa de detras
    c.save(); c.globalCompositeOperation = 'destination-out';
    this.huecos = [];
    for (const [fx, y, rw, rh, sem] of [[0.42, 340, 190, 78, 1], [0.64, 540, 220, 90, 2], [0.12, 600, 160, 66, 3], [0.9, 300, 130, 56, 4], [0.5, 770, 180, 60, 5], [0.84, 920, 170, 70, 6], [0.06, 990, 130, 50, 7]]) {
      const x = w * fx, pts = [];
      for (let q = 0; q < 11; q++) { const a = (q / 11) * Math.PI * 2; pts.push([x + Math.cos(a) * rw * (0.7 + hash(q, sem) * 0.45), y + Math.sin(a) * rh * (0.6 + hash(q, sem + 9) * 0.5)]); }
      trazar(c, temblar(pts, 10, 3, 600 + sem)); c.fill();
      this.huecos.push(pts);
    }
    c.restore();
    // el canto de cada hueco: la tierra cortada con su tinta y la luz que roza el borde de arriba
    for (const pts of this.huecos) {
      trazar(c, temblar(pts, 10, 3, 700)); tinta(c, 2.6);
      c.strokeStyle = 'rgba(150,165,185,.12)'; c.lineWidth = 3; c.beginPath();
      pts.slice(5, 10).forEach(([x, y], q) => (q ? c.lineTo(x, y - 2) : c.moveTo(x, y - 2))); c.stroke();
    }
    this.fondo = this.capaFondo(w, k);
    this.cerca = this.capaCerca(w, k);
    this.galerias = null;
  }

  // ---- la capa de detras: la tierra lejana, oscura y azulada, mas pequeña (0,7), con otro coche, losas, tuberias y
  // la boca de otro tunel; se ve por los huecos del corte y se mueve menos al bajar
  capaFondo(w, k) {
    const cv = document.createElement('canvas'); cv.width = Math.ceil((w + 2 * M) * k); cv.height = Math.ceil((HONDO + 20) * k);
    const c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, M * k, 0); c.lineJoin = 'round'; c.lineCap = 'round';
    const r = azar(3131), X0 = -M, X1 = w + M, WW = X1 - X0;
    c.fillStyle = '#18202c'; c.fillRect(X0, 0, WW, HONDO + 20);
    for (let i = 0; i < WW * HONDO / 1400; i++) { c.fillStyle = rgba(r() < 0.5 ? '#2c3646' : '#10141b', 0.45); c.beginPath(); c.arc(X0 + r() * WW, r() * HONDO, 0.6 + r() * 2.6, 0, 7); c.fill(); }
    // cosas a 0,7 de escala: mas pequeñas y lejos
    c.save(); c.scale(0.7, 0.7);
    for (let i = 0; i < 22; i++) {
      const x = (X0 + r() * WW) / 0.7, y = (260 + r() * 820) / 0.7, l = 60 + r() * 140, g = 14 + r() * 20;
      c.save(); c.translate(x, y); c.rotate((r() - 0.5) * 1.2);
      trazar(c, temblar([[-l / 2, -g / 2], [l / 2, -g / 2], [l / 2 + 4, g / 2], [-l / 2 + 6, g / 2]], 16, 1.6, 900 + i)); c.fillStyle = '#2a3442'; c.fill(); tinta(c, 1.4);
      c.strokeStyle = 'rgba(170,190,220,.2)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-l / 2 + 4, -g / 2 + 2); c.lineTo(l / 2 - 4, -g / 2 + 2); c.stroke();
      c.strokeStyle = '#2f2a28'; c.lineWidth = 1.6; for (let q = 0; q < 2; q++) { c.beginPath(); c.moveTo(l / 2, -4 + q * 6); c.lineTo(l / 2 + 16, -10 + q * 10); c.stroke(); }
      c.restore();
    }
    // el coche lejano, de lado y aplastado, y una tuberia rota que lo cruza
    c.save(); c.translate((w * 0.6) / 0.7, 560 / 0.7); c.rotate(-0.18); c.scale(0.85, 0.7);
    dibujarCoche(c, { semilla: 19, pintura: '#34404f', verde: '#262e36', verdeClaro: '#3a4552' });
    c.restore();
    c.strokeStyle = TINTA; c.lineWidth = 22; c.beginPath(); c.moveTo((w * 0.3) / 0.7, 400 / 0.7); c.lineTo((w * 0.95) / 0.7, 330 / 0.7); c.stroke();
    c.strokeStyle = '#2c3644'; c.lineWidth = 16; c.stroke();
    // la boca de otro tunel, lejos y casi a oscuras
    const tx = (w * 0.72) / 0.7, ty = 900 / 0.7;
    c.beginPath(); c.arc(tx, ty, 120, 0, 7); c.fillStyle = '#2a3442'; c.fill(); tinta(c, 2);
    c.beginPath(); c.arc(tx, ty, 100, 0, 7); c.fillStyle = '#040405'; c.fill();
    c.restore();
    // la niebla de lo lejos: todo un poco azulado y apagado
    c.fillStyle = 'rgba(70,95,130,.2)'; c.fillRect(X0, 0, WW, HONDO + 20);
    return cv;
  }

  // ---- la capa de delante: cosas grandes y desenfocadas pegadas a la camara (rocas, raices, ferralla, el canto de
  // una losa, una tuberia) que pasan deprisa al bajar. Fondo transparente
  capaCerca(w, k) {
    const cv = document.createElement('canvas'); cv.width = Math.ceil((w + 2 * M) * k); cv.height = Math.ceil((HONDO + 400) * k);
    const c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, M * k, 0); c.lineJoin = 'round'; c.lineCap = 'round';
    const r = azar(5353);
    const roca = (x, y, rr, sem) => {
      const pts = []; for (let q = 0; q < 9; q++) { const a = (q / 9) * Math.PI * 2; pts.push([x + Math.cos(a) * rr * (0.7 + hash(q, sem) * 0.5), y + Math.sin(a) * rr * (0.6 + hash(q, sem + 3) * 0.5)]); }
      trazar(c, temblar(pts, 14, 3, sem)); c.fillStyle = '#0b0c10'; c.fill(); tinta(c, 3);
      c.strokeStyle = 'rgba(150,170,200,.16)'; c.lineWidth = 3; c.beginPath(); c.moveTo(pts[5][0], pts[5][1]); c.lineTo(pts[6][0], pts[6][1]); c.lineTo(pts[7][0], pts[7][1]); c.stroke();
    };
    // a los lados (no tapan el centro, por donde cae la piedra): rocas, el canto de una losa con su ferralla y raices
    // (solo hasta 860: al llegar abajo no puede quedar una roca tapando el techo del laboratorio)
    for (let i = 0; i < 7; i++) {
      const izq = i % 2 === 0, x = izq ? w * (0.04 + r() * 0.12) : w * (0.84 + r() * 0.12), y = 120 + i * 115 + r() * 50;
      roca(x, y, 50 + r() * 70, 1000 + i);
    }
    // un neumatico y un bidon aplastado, cerca de la camara
    c.save(); c.translate(w * 0.9, 430); c.rotate(0.3);
    c.beginPath(); c.ellipse(0, 0, 46, 46, 0, 0, 7); c.fillStyle = '#08090b'; c.fill(); tinta(c, 3);
    c.beginPath(); c.ellipse(0, 0, 22, 22, 0, 0, 7); c.fillStyle = '#16191f'; c.fill(); tinta(c, 2);
    c.strokeStyle = 'rgba(150,170,200,.14)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 40, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
    c.restore();
    c.save(); c.translate(w * 0.12, 760); c.rotate(-0.5);
    trazar(c, temblar([[-30, -40], [28, -44], [34, 40], [-26, 44]], 12, 3, 1200)); c.fillStyle = '#0e1014'; c.fill(); tinta(c, 3);
    for (const y of [-20, 10]) { c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(-28, y); c.lineTo(30, y - 3); c.stroke(); }
    c.restore();
    c.save(); c.translate(w * 0.1, 520); c.rotate(0.35);
    trazar(c, temblar([[-180, -26], [120, -34], [130, 30], [-170, 36]], 18, 2, 1100)); c.fillStyle = '#0d0f13'; c.fill(); tinta(c, 3);
    c.strokeStyle = '#2b2522'; c.lineWidth = 4; for (let q = 0; q < 4; q++) { c.beginPath(); c.moveTo(126, -20 + q * 13); c.quadraticCurveTo(160, -30 + q * 10, 170 + q * 8, 10 + q * 14); c.stroke(); }
    c.restore();
    for (let i = 0; i < 6; i++) {
      const x = w * (i < 3 ? 0.02 + i * 0.05 : 0.86 + (i - 3) * 0.05), y = 40 + r() * 200;
      c.strokeStyle = '#08090b'; c.lineWidth = 6 - i % 3; c.beginPath(); c.moveTo(x, y);
      c.bezierCurveTo(x + 20, y + 120, x - 30, y + 220, x + 10, y + 320 + r() * 120); c.stroke();
    }
    c.strokeStyle = '#090a0d'; c.lineWidth = 34; c.beginPath(); c.moveTo(w * 0.78, 760); c.lineTo(w * 1.2, 700); c.stroke();
    c.strokeStyle = 'rgba(140,160,190,.12)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w * 0.78, 746); c.lineTo(w * 1.2, 686); c.stroke();
    // desenfocada una vez aqui (con el filtro en cada fotograma, en un lienzo asi, costaba)
    const b = document.createElement('canvas'); b.width = cv.width; b.height = cv.height;
    const bc = b.getContext('2d'); bc.filter = `blur(${(2.4 * k).toFixed(1)}px)`; bc.drawImage(cv, 0, 0);
    return b;
  }

  // la grieta principal y las galerias dependen de donde esta la piedra (la x del frasco en esta pantalla)
  trazado(px) {
    if (this.galerias && this.px === px) return;
    this.px = px;
    const w = this.w, r = azar(771);
    // la grieta: de la calle, en zigzag, hasta la piedra
    const g = [[w * 0.56, 66]];
    for (let y = 120; y < HONDO - 60; y += 60 + r() * 50) {
      const f = y / HONDO, xo = w * 0.56 + (px - w * 0.56) * Math.pow(f, 1.6);
      g.push([xo + (r() - 0.5) * 70 * (1 - f * 0.7), y]);
    }
    g.push([px + 6, HONDO - 56], [px, HONDO - 30]);
    this.grieta = g;
    // las galerias de los insectos: bajan serpenteando hasta una camara sobre la piedra
    this.galerias = [];
    const gal = (x0, y0, x1, y1, sem) => { const p = []; for (let k = 0; k <= 14; k++) { const f = k / 14; p.push([x0 + (x1 - x0) * f + Math.sin(f * 7 + sem) * 40 * (1 - f), y0 + (y1 - y0) * f + Math.cos(f * 5 + sem) * 14]); } this.galerias.push(p); };
    gal(w * 0.9, 620, px + 70, 1036, 1);
    gal(w * 0.1, 700, px - 80, 1040, 2);
    gal(px + 70, 1036, px + 10, 1060, 3);
    this.camara = [px + 26, 1044];
  }

  // un punto de la grieta a una fraccion f de su largo (0 la calle, 1 la piedra)
  enGrieta(f) {
    const g = this.grieta;
    if (!g.length) return [this.w / 2, 300];
    const u = Math.max(0, Math.min(0.9999, f)) * (g.length - 1), i = Math.floor(u), r = u - i;
    return [g[i][0] + (g[i + 1][0] - g[i][0]) * r, g[i][1] + (g[i + 1][1] - g[i][1]) * r];
  }

  // LA PIEDRA SE ANUNCIA (2026-10-20, pedido: «agrega mas estimulos en el interior del suelo para que se vea mas
  // obvio la caida de la piedra»): cada pisada manda una ONDA de luz fria que baja por la grieta hasta la piedra
  // soltando chinas a su paso, la piedra se carga de TENSION (se le abren grietas alrededor, suelta lascas y le corre
  // un hilo de arenilla por los lados, cada vez mas) y le late un canto de luz; al soltarse, revienta en chinas y polvo
  golpe(k, t) {
    this.ondas.push({ t: 0, k: Math.min(1.3, k) });
    this.tension = Math.min(1, this.tension + 0.07 * k);
    // con cada pisada cae polvo por la grieta y por todo el corte
    for (let i = 0; i < 26 * k; i++) {
      const g = this.grieta[Math.floor(Math.random() * this.grieta.length)] || [this.w / 2, 300];
      this.polvo.push({ x: g[0] + (Math.random() - 0.5) * 14, y: g[1], vy: 20 + Math.random() * 60, vida: 1.6 + Math.random() * 1.4, t: 0, r: 0.8 + Math.random() * 1.8 });
    }
    for (let i = 0; i < 40 * k; i++) this.polvo.push({ x: -M + Math.random() * (this.w + 2 * M), y: 60 + Math.random() * (HONDO - 100), vy: 10 + Math.random() * 40, vida: 0.8 + Math.random() * 1.2, t: 0, r: 0.6 + Math.random() * 1.2 });
    if (k > 0.5) this.hormiga.huye = Math.max(this.hormiga.huye, 0.001);
  }

  actualizar(dt) {
    this.reloj += dt;
    for (const p of this.polvo) { p.t += dt; p.vy += 300 * dt; p.y += p.vy * dt; }
    this.polvo = this.polvo.filter((p) => p.t < p.vida);
    // la onda baja por la grieta (1,1 s) y suelta chinas por donde pasa
    for (const o of this.ondas) {
      o.t += dt;
      const f = o.t / 1.1;
      if (f < 1 && Math.random() < dt * 22 * o.k) { const [x, y] = this.enGrieta(f); this.china(x, y, 1); }
    }
    this.ondas = this.ondas.filter((o) => o.t < 1.4);
    // la arenilla y las lascas que suelta la piedra, cada vez mas
    if (this.px !== undefined && !this.soltada && Math.random() < dt * (1 + 14 * this.tension ** 1.5)) {
      const lado = Math.random() < 0.5 ? -1 : 1;
      this.polvo.push({ x: this.px + lado * (16 + Math.random() * 12), y: HONDO - 44, vy: 10 + Math.random() * 30, vida: 0.9 + Math.random() * 0.6, t: 0, r: 0.7 + Math.random() * 1.1 });
      if (Math.random() < 0.25 * this.tension) this.china(this.px + lado * (12 + Math.random() * 10), HONDO - 40, 0.6);
    }
    for (const q of this.chinas) {
      q.t += dt; if (q.quieta) continue;
      q.vy += 700 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.ang += q.va * dt;
      if (q.y > q.suelo) { q.y = q.suelo; q.vy *= -0.3; q.vx *= 0.5; if (Math.abs(q.vy) < 30) q.quieta = true; }
    }
    this.chinas = this.chinas.filter((q) => q.t < q.vida);
    if (this.hormiga.huye) this.hormiga.huye += dt;
  }

  china(x, y, k) {
    if (this.chinas.length > 220) return;
    // (cae hasta la siguiente veta o, si esta encima de la losa, hasta la losa)
    const suelo = y > HONDO - 120 ? HONDO - 32 + Math.random() * 4 : y + 60 + Math.random() * 140;
    this.chinas.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: Math.random() * 30, r: (1.4 + Math.random() * 2.6) * k, ang: Math.random() * 6.28, va: (Math.random() - 0.5) * 12, t: 0, vida: 2.4 + Math.random() * 1.6, suelo });
  }

  // sx, sy: donde cae en pantalla (u) el origen del corte (x del ancla, la calle); o: { piedraX (x del frasco en el
  // corte), grieta (0-1, cuanto ha bajado), luz (0-1, la luz del frasco que se cuela), t, temblor }
  dibujar(ctx, W, H, s, sx, sy, o) {
    if (!this.cv) return;
    const y0 = -sy, y1 = H / s - sy;                     // lo que se ve, en profundidad
    if (y1 < 30 || y0 > HONDO) return;
    this.trazado(o.piedraX);
    ctx.save();
    ctx.setTransform(s, 0, 0, s, sx * s, sy * s);
    // el borde de arriba se funde con la calle del juego
    // (en franjas con la opacidad subiendo: el asfalto del juego sigue viendose arriba y no hay un corte recto)
    const top = 26, fade = 36, k = this.k, cw = this.cv.width;
    for (let i = 0; i < 9; i++) {
      const ya = top + (fade * i) / 9, yb = top + (fade * (i + 1)) / 9;
      ctx.globalAlpha = (i + 1) / 10;
      ctx.drawImage(this.cv, 0, ya * k, cw, (yb - ya) * k, -M, ya, this.w + 2 * M, yb - ya);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.beginPath(); ctx.rect(-M, top + fade, this.w + 2 * M, HONDO - top - fade + 1); ctx.clip();
    // la capa de detras, que se mueve menos al bajar (se ve por los huecos)
    const desp = (f) => (sy + 300) * (f - 1);
    if (this.fondo) ctx.drawImage(this.fondo, -M, desp(0.78), this.w + 2 * M, HONDO + 20);
    ctx.drawImage(this.cv, -M, 0, this.w + 2 * M, HONDO + 20);
    // la camara de los insectos sobre la losa y las galerias
    // (galerias excavadas: borde de tierra apretada mas clara y el hueco negro; los nidos con huevos se quitaron el
    // 2026-10-20 a peticion del usuario)
    for (const p of this.galerias) {
      ctx.beginPath(); p.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = '#2b3038'; ctx.lineWidth = 28; ctx.stroke();
      ctx.strokeStyle = TINTA; ctx.lineWidth = 20; ctx.stroke();
      ctx.strokeStyle = '#06070a'; ctx.lineWidth = 15; ctx.stroke();
    }
    const [hx, hy] = this.camara;
    ctx.beginPath(); ctx.ellipse(hx, hy, 70, 22, 0, 0, 7); ctx.fillStyle = '#07080a'; ctx.fill(); tinta(ctx, 2.4);
    this.dibujarHormiga(ctx, hx, hy + 18, o.t);
    // la piedra encajada en la losa: el hueco que le han hecho, sus grietas en estrella y la luz que se cuela
    const px = o.piedraX;
    ctx.save(); ctx.translate(px, HONDO);
    trazar(ctx, temblar([[-30, 0], [-26, -34], [-8, -46], [14, -40], [28, -22], [30, 0]], 8, 1.6, 501));
    ctx.fillStyle = '#08090b'; ctx.fill(); tinta(ctx, 2.2);
    // la parte de arriba de la piedra (la de abajo la pinta el juego colgando del techo); suelta, queda el hueco
    if (!o.suelta) {
      const ten = this.tension, golpe = this.ondas.reduce((m, q) => Math.max(m, q.t > 0.9 && q.t < 1.4 ? (1 - (q.t - 0.9) / 0.5) * q.k : 0), 0);
      ctx.rotate((o.tiembla || 0) * (1 + 2 * ten) + golpe * 0.04 * Math.sin(this.reloj * 60));
      trazar(ctx, temblar([[-18, 0], [-17, -16], [-6, -26], [9, -24], [18, -12], [19, 0]], 7, 1, 503));
      ctx.fillStyle = '#5b5e64'; ctx.fill(); tinta(ctx, 2);
      ctx.fillStyle = '#7a7d84'; ctx.beginPath(); ctx.ellipse(-3, -16, 9, 5, -0.3, 0, 7); ctx.fill();
      // el hueco que se abre a su alrededor: una raya negra que crece
      ctx.strokeStyle = '#030304'; ctx.lineWidth = 1.5 + 2.5 * ten;
      ctx.beginPath(); ctx.moveTo(-21, -2); ctx.quadraticCurveTo(-22, -18, -8, -29); ctx.moveTo(21, -2); ctx.quadraticCurveTo(21, -16, 10, -27); ctx.stroke();
      // el canto de luz fria que late cuando le llega la onda
      if (golpe > 0.02) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        trazar(ctx, temblar([[-18, 0], [-17, -16], [-6, -26], [9, -24], [18, -12], [19, 0]], 7, 1, 503));
        ctx.strokeStyle = rgba('#cfe0ff', 0.55 * golpe); ctx.lineWidth = 2.2; ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
    ctx.restore();
    // la grieta principal, hasta donde ha llegado
    const g = this.grieta, hasta = o.grieta * HONDO;
    ctx.beginPath(); ctx.moveTo(g[0][0], g[0][1]);
    for (let k = 1; k < g.length; k++) {
      const a = g[k - 1], b = g[k];
      if (b[1] <= hasta) ctx.lineTo(b[0], b[1]);
      else { const f = Math.max(0, (hasta - a[1]) / (b[1] - a[1])); ctx.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); break; }
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(150,165,185,.18)'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = '#040405'; ctx.lineWidth = 3; ctx.stroke();
    // ramas de la grieta alrededor de la piedra: crecen con la tension (cada pisada las alarga)
    {
      const ten = Math.max(this.tension, o.grieta > 0.95 ? 0.6 : 0);
      ctx.strokeStyle = '#040405'; ctx.lineWidth = 1.4 + ten;
      for (let q = 0; q < 8; q++) {
        const a = -Math.PI * (0.06 + q * 0.12), L = (30 + q * 6 + (q % 3) * 10) * Math.min(1, ten * 1.6);
        if (L < 4) continue;
        ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * 20, HONDO - 30 + Math.sin(a) * 14);
        ctx.lineTo(px + Math.cos(a + 0.08) * (20 + L * 0.5), HONDO - 30 + Math.sin(a + 0.08) * (14 + L * 0.32));
        ctx.lineTo(px + Math.cos(a) * (20 + L), HONDO - 30 + Math.sin(a) * (14 + L * 0.62));
        ctx.stroke();
      }
    }
    // la ONDA de cada pisada bajando por la grieta: un tramo de luz fria con su estela
    if (this.ondas.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const q of this.ondas) {
        const f = q.t / 1.1; if (f > 1.05) continue;
        const a = Math.max(0, 1 - Math.max(0, f - 0.9) / 0.15) * Math.min(1, q.k);
        for (let j = 0; j < 6; j++) {
          const f0 = f - j * 0.025, f1 = f - (j + 1) * 0.025; if (f1 < 0) break;
          const [x0, y0] = this.enGrieta(f0), [x1, y1] = this.enGrieta(f1);
          ctx.strokeStyle = rgba('#bcd2ff', 0.5 * a * (1 - j / 6)); ctx.lineWidth = 4 - j * 0.5;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
        const [hx2, hy2] = this.enGrieta(Math.min(1, f));
        const gq = ctx.createRadialGradient(hx2, hy2, 0, hx2, hy2, 40);
        gq.addColorStop(0, rgba('#d8e6ff', 0.4 * a)); gq.addColorStop(1, rgba('#d8e6ff', 0));
        ctx.fillStyle = gq; ctx.fillRect(hx2 - 40, hy2 - 40, 80, 80);
      }
      ctx.restore();
    }
    // al soltarse: revienta el hueco en chinas y polvo
    if (o.suelta && !this.soltada) {
      this.soltada = true;
      for (let i = 0; i < 40; i++) this.china(px + (Math.random() - 0.5) * 50, HONDO - 30 - Math.random() * 20, 1.2);
      for (let i = 0; i < 80; i++) this.polvo.push({ x: px + (Math.random() - 0.5) * 70, y: HONDO - 40 - Math.random() * 30, vy: 40 + Math.random() * 120, vida: 1 + Math.random(), t: 0, r: 0.8 + Math.random() * 1.6 });
    }
    // la luz del frasco que se cuela por la grieta de la losa
    if (o.luz > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(px, HONDO - 10, 0, px, HONDO - 10, 220);
      gl.addColorStop(0, rgba('#ffd7a0', 0.35 * o.luz)); gl.addColorStop(0.4, rgba('#ffd7a0', 0.1 * o.luz)); gl.addColorStop(1, rgba('#ffd7a0', 0));
      ctx.fillStyle = gl; ctx.fillRect(px - 220, HONDO - 230, 440, 230);
      ctx.strokeStyle = rgba('#ffe3ba', 0.6 * o.luz); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(px - 26, HONDO - 6); ctx.lineTo(px - 12, HONDO - 30); ctx.moveTo(px + 24, HONDO - 4); ctx.lineTo(px + 14, HONDO - 26); ctx.stroke();
      ctx.restore();
    }
    // las chinas: piedrecitas que caen girando y se quedan en la veta de abajo
    for (const q of this.chinas) {
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.ang); ctx.globalAlpha = Math.min(1, (q.vida - q.t) * 1.5);
      ctx.beginPath(); ctx.moveTo(-q.r, -q.r * 0.4); ctx.lineTo(q.r * 0.2, -q.r * 0.8); ctx.lineTo(q.r, 0); ctx.lineTo(-q.r * 0.3, q.r * 0.7); ctx.closePath();
      ctx.fillStyle = '#6a6e76'; ctx.fill(); ctx.strokeStyle = '#08090b'; ctx.lineWidth = 0.9; ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // el polvo que cae
    ctx.fillStyle = 'rgba(190,200,215,.55)';
    for (const p of this.polvo) { const a = Math.min(1, (p.vida - p.t) * 2); ctx.globalAlpha = a; ctx.fillRect(p.x, p.y, p.r, p.r * 1.6); }
    ctx.globalAlpha = 1;
    // la capa de delante: mas grande, desenfocada y mas deprisa (pasa por delante de la camara)
    if (this.cerca) {
      ctx.save();
      ctx.translate(this.w / 2, desp(1.4) - 80); ctx.scale(1.18, 1.18); ctx.translate(-this.w / 2, 0);
      ctx.drawImage(this.cerca, -M, 0, this.w + 2 * M, HONDO + 400);
      ctx.restore();
    }
    ctx.restore();
  }

  // una hormiga obrera de los entomorficos en su camara, rascando la losa con su llave; con el golpe huye por la galeria
  dibujarHormiga(c, x, pie, t) {
    const h = this.hormiga, huye = h.huye ? Math.min(1, h.huye / 1.6) : 0;
    if (huye >= 1) return;
    const gx = x + 30 * huye * 4, gy = pie - huye * 30;
    c.save(); c.translate(gx, gy); c.scale(huye ? 1 : -1, 1);
    const rasca = huye ? 0 : Math.sin(t * 9) * 0.4;
    c.lineCap = 'round'; c.strokeStyle = TINTA;
    // patas
    c.lineWidth = 2; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-6 + k * 6, -10); c.lineTo(-10 + k * 7, -2 + Math.sin(t * 20 * (huye ? 1 : 0.1) + k) * 2); c.stroke(); }
    // abdomen, torax con peto de laton y cabeza
    c.fillStyle = '#2a211a'; c.beginPath(); c.ellipse(-12, -14, 9, 6, 0.3, 0, 7); c.fill(); tinta(c, 1.6);
    c.fillStyle = '#6e5a34'; c.beginPath(); c.ellipse(0, -18, 6, 7, 0, 0, 7); c.fill(); tinta(c, 1.6);
    c.fillStyle = '#2a211a'; c.beginPath(); c.ellipse(8, -26, 5, 4.5, 0, 0, 7); c.fill(); tinta(c, 1.6);
    c.beginPath(); c.moveTo(10, -30); c.quadraticCurveTo(16, -40, 22, -36); c.lineWidth = 1.2; c.stroke();
    // la llave inglesa, rascando hacia arriba
    c.save(); c.translate(5, -20); c.rotate(-1.1 + rasca);
    c.strokeStyle = '#8a7a52'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, 0); c.lineTo(16, 0); c.stroke();
    c.restore();
    c.restore();
  }
}
