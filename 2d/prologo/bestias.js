// LAS BESTIAS DEL PROLOGO: lo que persigue al convoy. Animales de la ciudad tomados por la Podredumbre (GDD: el
// hongo se mete en cualquier ser vivo, lo controla y lo hace crecer): cuadrupedos flacos y encorvados, con la
// columna que se marca, sin ojos, la boca abierta y los tallos naranjas del hongo saliendo del lomo. El pelo,
// apelmazado y sucio: una crin que el aire de la carrera echa atras, flecos bajo la panza, una gorguera en el pecho,
// mechones en las rodillas y la cola.
// GALOPE (rehecho el 2026-10-20, pedido: «mejora la animacion y los detalles de los monstruos»): el galope
// rotatorio de un perro (atras, atras, delante, delante) con la COLUMNA que se recoge (las patas de atras entran bajo
// el vientre y el lomo se arquea) y se estira (vuelo con las cuatro fuera), el cuerpo que cabecea, la cabeza que
// compensa y la cola que va detras con retraso. Cada pata tiene TRES tramos (muslo, cana y metatarso, como un perro:
// se apoya en los dedos) con su forma de musculo, y una zarpa de cuatro dedos con unas curvas; en el apoyo el pie se
// queda clavado en el suelo mientras el cuerpo pasa por encima (cinematica inversa del muslo y la cana hasta el
// tobillo). Detalles: omoplato y cadera que asoman, costillas, placas del hongo, pustulas que laten, babas, dientes en
// las dos mandibulas y el vaho de la respiracion en la noche fria.
// Origen: en el suelo bajo el centro del cuerpo; corren hacia +x. `b.dist` es lo recorrido.
import { TINTA, temblar, trazar, trazarSuave, tinta, hash } from '../dibujo/tinta.js';
import { mechon, talloHongo } from './hongo.js';

const PIEL = '#2b2622', PIEL_C = '#3e3630', PIEL_O = '#191614', PIEL_L = '#4c433b';

// tipos: largo y alto del cuerpo (u), cuanto se encorva, cuantos tallos, la cabeza
// (a la escala del juego: el mas grande, un caballo; el pequeño, un perro grande. El 18 mide 50 u)
export const TIPOS = [
  { largo: 132, alto: 74, joroba: 0.26, tallos: 3, hocico: 1.0 },
  { largo: 168, alto: 96, joroba: 0.32, tallos: 4, hocico: 1.1 },
  { largo: 104, alto: 60, joroba: 0.2, tallos: 2, hocico: 0.9 },
  { largo: 200, alto: 116, joroba: 0.4, tallos: 5, hocico: 1.2 },
];

// dos huesos: de la cadera al tobillo con la rodilla hacia `dir` (+1 adelante, -1 atras)
function ik(hx, hy, fx, fy, l1, l2, dir) {
  let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy);
  const max = (l1 + l2) * 0.999;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; fx = hx + dx; fy = hy + dy; }
  const a = Math.atan2(dy, dx), cb = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const b = Math.acos(Math.max(-1, Math.min(1, cb)));
  const ak = a - b * dir;
  return [[hx, hy], [hx + Math.cos(ak) * l1, hy + Math.sin(ak) * l1], [fx, fy]];
}

// donde esta cada pata en este instante: apoyo (quieta en el suelo) o vuelo (sube, se recoge y adelanta)
// devuelve [x, y, vuelo 0-1]
function pata(b, hx, fase, zancada, alto) {
  const p = ((b.dist / zancada + fase) % 1 + 1) % 1, apoyo = 0.4;
  if (p < apoyo) { const k = p / apoyo; return [hx + zancada * (0.5 - k) * 0.5, 0, 0]; }
  const k = (p - apoyo) / (1 - apoyo);
  return [hx + zancada * (-0.5 + k) * 0.5, -Math.sin(k * Math.PI) * alto * 0.34, Math.sin(k * Math.PI)];
}

// un tramo con forma de musculo: de (x0,y0) a (x1,y1), ancho w0 a w1, con un bulto hacia `lado` a un tercio
function tramo(c, x0, y0, x1, y1, w0, w1, bulto = 0) {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
  const mx = x0 + (x1 - x0) * 0.38, my = y0 + (y1 - y0) * 0.38, wm = (w0 * 0.62 + w1 * 0.38) / 2;
  c.beginPath();
  c.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2);
  c.quadraticCurveTo(mx + nx * (wm + bulto), my + ny * (wm + bulto), x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  c.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2);
  c.quadraticCurveTo(mx - nx * wm * 0.9, my - ny * wm * 0.9, x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  c.closePath();
}

export function dibujarBestia(c, b, t, s = 1) {
  const T = TIPOS[b.tipo % TIPOS.length], L = T.largo * (b.k || 1), H = T.alto * (b.k || 1);
  const zancada = L * 1.3;
  const fase = b.dist / zancada, ciclo = fase * Math.PI * 2;
  const corre = !b.quieta && !b.vuela && !b.monta && !b.salta;
  // ---- el galope: la columna se recoge (+1) y se estira (-1); el cuerpo cabecea; sube en el vuelo
  const flex = corre ? Math.sin(ciclo - 0.9) : 0;
  const cabeceo = corre ? 0.055 * Math.sin(ciclo + 0.4) : 0;
  const sq = b.salta ? b.salta : null;
  const agacha = sq && sq.pre ? Math.min(1, sq.t / sq.pre) : 0;          // el amago antes del salto
  const vuelo = sq && !sq.pre ? Math.sin(Math.min(1, sq.k || 0) * Math.PI) : 0;
  const bote = b.monta ? H * 0.16 + Math.sin(t * 9 + b.sem) * H * 0.012
    : sq ? H * 0.16 * agacha - H * 0.05 * vuelo
      : corre ? -H * (0.035 + 0.04 * Math.max(0, -flex)) + H * 0.025 * Math.max(0, flex) : 0;
  const Lc = L * (1 - 0.075 * flex + 0.06 * vuelo);                      // recogida, mas corta; estirada, mas larga
  const J = T.joroba + 0.1 * Math.max(0, flex) + 0.08 * agacha;
  const cab = corre ? Math.sin(ciclo + 1) * 0.06 - cabeceo * 0.8 : sq ? -0.12 * vuelo : 0;   // la cabeza compensa el cabeceo
  c.save();
  if (b.vuela) { c.translate(0, -b.vuela.y); c.rotate(b.vuela.ang); }
  c.lineCap = 'round'; c.lineJoin = 'round';
  // el cuerpo gira alrededor de su centro (cabeceo); las patas buscan el suelo desde donde quedan cadera y hombro
  const cy0 = -H * 0.62 + bote, rot = (x, y) => [x * Math.cos(cabeceo) - (y - cy0) * Math.sin(cabeceo), cy0 + x * Math.sin(cabeceo) + (y - cy0) * Math.cos(cabeceo)];
  const hip = rot(-Lc * 0.36, -H * 0.62 + bote), hom = rot(Lc * 0.26, -H * 0.66 + bote);
  const l1 = H * 0.27, l2 = H * 0.27, l3 = H * 0.15;
  const piernas = [
    { x: hip[0], y: hip[1], fase: 0.0, dir: 1, lejos: true, tras: true },
    { x: hom[0], y: hom[1], fase: 0.55, dir: -1, lejos: true, tras: false },
    { x: hip[0] + 6, y: hip[1], fase: 0.11, dir: 1, lejos: false, tras: true },
    { x: hom[0] + 6, y: hom[1], fase: 0.66, dir: -1, lejos: false, tras: false },
  ];
  const dibPierna = (q) => {
    // el pie (donde apoyan los dedos) y cuanto va en el aire
    let fx, fy, enAire = 0;
    if (b.quieta) { fx = q.x - q.dir * H * 0.5; fy = -H * 0.45; enAire = 1; }
    else if (b.vuela) { fx = q.x + Math.sin(t * 9 + q.fase * 6) * 18; fy = -H * 0.12; enAire = 1; }
    else if (sq && !sq.pre) {
      // en el aire: las de delante estiradas hacia donde va a caer, las de atras empujando hacia atras; al final las
      // cuatro se adelantan para agarrarse
      const fin = Math.max(0, ((sq.k || 0) - 0.65) / 0.35);
      fx = q.tras ? q.x - H * (0.62 - 0.5 * fin) : q.x + H * (0.55 - 0.15 * fin);
      fy = -H * (q.tras ? 0.3 - 0.15 * fin : 0.28) + (q.lejos ? 4 : 0); enAire = 1;
    } else if (sq) { fx = q.x + (q.tras ? H * 0.12 : -H * 0.05); fy = 0; }            // agachada: las patas bajo el cuerpo
    else if (b.monta) { fx = q.x - q.dir * H * 0.08 + Math.sin(t * 5 + q.fase * 9) * 2; fy = 0; }
    else { const p = pata(b, q.x, q.fase, zancada, H); fx = p[0]; fy = p[1]; enAire = p[2]; }
    // el metatarso: casi vertical en el apoyo (el tobillo detras y arriba de los dedos); en el aire se recoge
    const th = (q.tras ? 0.42 : 0.16) + enAire * (q.tras ? 0.9 : 1.2);
    const ax = fx - Math.sin(th) * l3, ay = fy - Math.cos(th) * l3;
    const [a, k, f] = ik(q.x, q.y, ax, ay, l1, l2, q.dir);
    const col = q.lejos ? PIEL_O : PIEL, borde = q.lejos ? 1.6 : 2;
    // muslo (con su musculo), cana y metatarso
    c.fillStyle = col; c.strokeStyle = TINTA; c.lineWidth = borde;
    tramo(c, a[0], a[1], k[0], k[1], H * (q.tras ? 0.32 : 0.25), H * 0.13, H * (q.tras ? 0.07 : 0.04) * (q.dir > 0 ? 1 : -1)); c.fill(); c.stroke();
    tramo(c, k[0], k[1], f[0], f[1], H * 0.13, H * 0.08, H * 0.02); c.fill(); c.stroke();
    tramo(c, f[0], f[1], fx, fy, H * 0.08, H * 0.06); c.fill(); c.stroke();
    // la luz de la luna por el canto de delante del muslo
    if (!q.lejos) { c.strokeStyle = 'rgba(150,135,120,.3)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(a[0] + H * 0.08, a[1] + H * 0.02); c.quadraticCurveTo((a[0] + k[0]) / 2 + H * 0.07, (a[1] + k[1]) / 2, k[0] + H * 0.04, k[1] - H * 0.02); c.stroke(); }
    // la articulacion: un nudo con su luz
    if (!q.lejos) { c.fillStyle = PIEL_C; c.beginPath(); c.arc(k[0], k[1], H * 0.045, 0, 7); c.fill(); c.strokeStyle = 'rgba(150,135,120,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(k[0], k[1] - 1, H * 0.035, Math.PI * 1.1, Math.PI * 1.8); c.stroke(); }
    // el mechon de la rodilla (cuelga y lo echa atras la carrera)
    c.beginPath(); mechon(c, k[0], k[1], Math.PI / 2 + 0.7 + Math.sin(t * 11 + q.fase * 7) * 0.15, H * 0.13, H * 0.07, 0.5, 4);
    c.fillStyle = col; c.fill(); tinta(c, 1.1);
    // la zarpa: almohadilla y cuatro dedos con unas curvas que se clavan (en el aire, recogidos)
    c.fillStyle = col; c.beginPath(); c.ellipse(fx + H * 0.03, fy - H * 0.025, H * 0.06, H * 0.03, 0, 0, 7); c.fill(); tinta(c, 1.4);
    c.strokeStyle = TINTA; c.lineWidth = 1.8;
    for (let d = 0; d < 4; d++) {
      const ux = fx + H * (0.0 + d * 0.025), uy = fy - H * 0.01, gancho = enAire > 0.3 ? 0.6 : 0;
      c.beginPath(); c.moveTo(ux, uy); c.quadraticCurveTo(ux + H * 0.05, uy - H * 0.01 + gancho * 3, ux + H * 0.06, uy + H * 0.025 - gancho * H * 0.03); c.stroke();
    }
    c.fillStyle = '#bdb4a0';
    for (let d = 0; d < 4; d++) { const ux = fx + H * (0.06 + d * 0.025), uy = fy + H * 0.02; c.beginPath(); c.arc(ux, uy, 0.9, 0, 7); c.fill(); }
  };
  for (const q of piernas) if (q.lejos) dibPierna(q);
  // ---- el cuerpo: lomo encorvado con las vertebras, vientre hundido, cuello largo hacia delante (todo cabeceando)
  c.save(); c.translate(0, cy0); c.rotate(cabeceo); c.translate(0, -cy0);
  const lomo = [
    [-Lc * 0.52, -H * 0.62 + bote],
    [-Lc * 0.4, -H * (0.8 + J * 0.4) + bote],
    [-Lc * 0.12, -H * (0.92 + J) + bote],
    [Lc * 0.14, -H * (0.9 + J * 0.7) + bote],
    [Lc * 0.32, -H * 0.8 + bote],
  ];
  // (la cabeza va pegada al cuello: antes el craneo empezaba 20 u por delante del final del cuello y se veia suelta)
  const cuello = [Lc * 0.46, -H * (0.72 + cab) + bote];
  const cabeza = [cuello[0] + H * 0.17, -H * (0.6 + cab) + bote];
  const panza = [
    [Lc * 0.34, -H * 0.5 + bote], [Lc * 0.12, -H * (0.42 + 0.04 * flex) + bote], [-Lc * 0.14, -H * 0.5 + bote], [-Lc * 0.34, -H * 0.46 + bote], [-Lc * 0.5, -H * 0.5 + bote],
  ];
  const cuerpo = temblar([...lomo, cuello, [cuello[0] + 6, cuello[1] + H * 0.14], ...panza], 12, 1.4, b.sem);
  // el cuello hasta la nuca: un tramo grueso que se mete bajo el craneo
  c.fillStyle = PIEL; c.strokeStyle = TINTA; c.lineWidth = 2.4;
  tramo(c, lomo[4][0] - H * 0.05, lomo[4][1] + H * 0.08, cabeza[0] - H * 0.08, cabeza[1] - H * 0.02, H * 0.3, H * 0.17, -H * 0.03); c.fill(); c.stroke();
  trazarSuave(c, cuerpo); c.fillStyle = PIEL; c.fill(); tinta(c, 2.6);
  c.save(); trazarSuave(c, cuerpo); c.clip();
  // la luz en el lomo (la luna, desde arriba) y la sombra de la panza
  c.strokeStyle = PIEL_C; c.lineWidth = H * 0.1;
  c.beginPath(); c.moveTo(lomo[0][0], lomo[0][1] + 4); for (const q of lomo.slice(1)) c.lineTo(q[0], q[1] + 4); c.stroke();
  c.strokeStyle = PIEL_L; c.lineWidth = H * 0.025;
  c.beginPath(); c.moveTo(lomo[0][0], lomo[0][1] + 2); for (const q of lomo.slice(1)) c.lineTo(q[0], q[1] + 2); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = H * 0.12;
  c.beginPath(); c.moveTo(panza[0][0], panza[0][1] - 3); for (const q of panza.slice(1)) c.lineTo(q[0], q[1] - 3); c.stroke();
  // el omoplato y el hueso de la cadera, que se marcan bajo la piel
  for (const [x, y, r] of [[hom[0] - Lc * 0.02, hom[1] - H * 0.06, H * 0.13], [hip[0] + Lc * 0.02, hip[1] - H * 0.08, H * 0.12]]) {
    c.fillStyle = 'rgba(62,54,48,.85)'; c.beginPath(); c.ellipse(x, y, r * 0.75, r, -0.3, 0, 7); c.fill();
    c.strokeStyle = 'rgba(160,145,128,.35)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y, r * 0.75, r, -0.3, Math.PI * 1.05, Math.PI * 1.7); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(x, y, r * 0.75, r, -0.3, Math.PI * 0.1, Math.PI * 0.8); c.stroke();
  }
  // las costillas, que se abren al respirar
  const resp = 0.5 + 0.5 * Math.sin(t * (corre ? 9 : 4) + b.sem);
  c.strokeStyle = 'rgba(0,0,0,.42)'; c.lineWidth = 1.6;
  for (let k = 0; k < 6; k++) { const x = -Lc * 0.05 + k * Lc * 0.06; c.beginPath(); c.moveTo(x, -H * 0.8 + bote); c.quadraticCurveTo(x - 8 - resp * 2, -H * 0.62 + bote, x - 2, -H * (0.48 + 0.02 * resp) + bote); c.stroke(); }
  c.strokeStyle = 'rgba(150,135,120,.18)'; c.lineWidth = 1;
  for (let k = 0; k < 6; k++) { const x = -Lc * 0.05 + k * Lc * 0.06 + 3; c.beginPath(); c.moveTo(x, -H * 0.79 + bote); c.quadraticCurveTo(x - 6, -H * 0.66 + bote, x, -H * 0.56 + bote); c.stroke(); }
  // venas del hongo bajo la piel (el naranja apagado: sin su luz casi no se ve)
  c.strokeStyle = 'rgba(226,121,43,.28)'; c.lineWidth = 1.2;
  for (let k = 0; k < 5; k++) { const x0 = -Lc * 0.3 + hash(k, b.sem) * Lc * 0.5; c.beginPath(); c.moveTo(x0, -H * 0.85 + bote); c.lineTo(x0 + 10, -H * 0.7 + bote); c.lineTo(x0 + 4, -H * 0.58 + bote); c.lineTo(x0 + 12, -H * 0.5 + bote); c.stroke(); }
  // costras del hongo: placas secas y agrietadas en el costado, con un borde de liquen
  for (let k = 0; k < 4; k++) {
    const x = -Lc * 0.34 + hash(k, b.sem + 20) * Lc * 0.6, y = -H * (0.58 + hash(k, b.sem + 21) * 0.22) + bote, r = H * (0.07 + hash(k, b.sem + 22) * 0.06);
    c.fillStyle = '#3a2f26'; c.beginPath(); c.ellipse(x, y, r * 1.5, r, hash(k, b.sem + 23) - 0.5, 0, 7); c.fill();
    c.fillStyle = 'rgba(120,100,70,.35)'; for (let j = 0; j < 6; j++) { const a = j * 1.05 + k; c.beginPath(); c.arc(x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 0.95, 1.1, 0, 7); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x - r, y); c.lineTo(x, y - r * 0.4); c.lineTo(x + r * 0.9, y + r * 0.2); c.moveTo(x, y - r * 0.4); c.lineTo(x + r * 0.2, y + r * 0.6); c.stroke();
  }
  // cicatrices: tajos claros cosidos por el hongo
  c.strokeStyle = 'rgba(160,140,120,.45)'; c.lineWidth = 1.3;
  for (let k = 0; k < 2; k++) {
    const x = -Lc * 0.2 + hash(k, b.sem + 30) * Lc * 0.4, y = -H * 0.7 + bote;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + H * 0.18, y + H * 0.1); c.stroke();
    c.strokeStyle = 'rgba(226,121,43,.35)'; c.lineWidth = 0.8; c.beginPath();
    for (let j = 1; j < 4; j++) { const u = j / 4, px = x + H * 0.18 * u, py = y + H * 0.1 * u; c.moveTo(px - 2, py + 3); c.lineTo(px + 2, py - 3); }
    c.stroke(); c.strokeStyle = 'rgba(160,140,120,.45)'; c.lineWidth = 1.3;
  }
  c.restore();
  // pustulas: bultos naranjas apagados que laten (su luz la pone el prologo, b._pust)
  const pust = b._pust || (b._pust = []);
  pust.length = 0;
  for (let k = 0; k < 5; k++) {
    const x = -Lc * 0.35 + hash(k, b.sem + 40) * Lc * 0.6, y = -H * (0.55 + hash(k, b.sem + 41) * 0.25) + bote, r = (2 + hash(k, b.sem + 42) * 2.4) * (0.9 + 0.15 * Math.sin(t * 5 + k * 2));
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = '#7a3a17'; c.fill(); tinta(c, 1);
    c.fillStyle = 'rgba(240,170,110,.6)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, 7); c.fill();
    pust.push(rot(x, y));
  }
  // ---- el pelo
  const enLomo = (f) => {
    const u = Math.max(0, Math.min(0.9999, f)) * (lomo.length - 1), i = Math.floor(u), g = u - i;
    const a = lomo[i], b2 = lomo[i + 1];
    return [a[0] + (b2[0] - a[0]) * g, a[1] + (b2[1] - a[1]) * g, Math.atan2(b2[1] - a[1], b2[0] - a[0])];
  };
  const viento = b.quieta ? 0 : b.vuela ? 0.5 : b.monta ? 0.7 : 1;
  const pelo = (lista, color, borde = 1.2) => { c.beginPath(); for (const m of lista) mechon(c, ...m); c.fillStyle = color; c.fill(); tinta(c, borde); };
  // la cola: cuatro mechones largos que van detras del cuerpo con retraso (latigo)
  const cola = [];
  const retraso = corre ? Math.sin(ciclo - 2.2) * 0.35 : 0;
  for (let k = 0; k < 4; k++) cola.push([lomo[0][0] + 2, lomo[0][1] + 4 + k * 3, Math.PI + 0.3 - k * 0.08 + retraso + Math.sin(t * 9 + k * 1.3 + b.sem) * 0.18 * viento, H * (0.3 + hash(k, b.sem + 9) * 0.16), H * 0.09, -0.6 - 0.3 * Math.sin(t * 9 + k) * viento - retraso * 0.6, 6, 0.4 * viento, k - t * 10]);
  pelo(cola, PIEL_O);
  // flecos bajo la panza y gorguera del pecho
  const flecos = [];
  for (let k = 0; k < panza.length - 1; k++) for (let j = 0; j < 3; j++) {
    const f = j / 3, x = panza[k][0] + (panza[k + 1][0] - panza[k][0]) * f, y = panza[k][1] + (panza[k + 1][1] - panza[k][1]) * f - 2;
    flecos.push([x, y, Math.PI / 2 + 0.5 + Math.sin(t * 10 + k * 3 + j) * 0.18 * viento + flex * 0.15, H * (0.07 + hash(k, j, b.sem) * 0.08), H * 0.06, 0.35, 4]);
  }
  for (let k = 0; k < 5; k++) { const f = k / 4; flecos.push([cuello[0] - 2 - f * Lc * 0.08, cuello[1] + H * (0.04 + f * 0.1), Math.PI / 2 + 0.55 + Math.sin(t * 10 + k) * 0.15 * viento, H * (0.12 + hash(k, b.sem + 4) * 0.06), H * 0.07, 0.4, 4]); }
  pelo(flecos, PIEL_O);
  // la crin: del anca a la cruz, mas larga en los hombros; dos capas (la de detras mas oscura) y la ola de la carrera
  const crin = [[], []], n = Math.round(L / 8);
  for (let k = 0; k < n; k++) {
    const f = 0.04 + 0.88 * k / n, [x, y, ta] = enLomo(f);
    const largo = H * (0.08 + 0.17 * Math.exp(-(((f - 0.72) / 0.26) ** 2)) + 0.05 * hash(k, b.sem + 2));
    const ang = ta + Math.PI + 0.42 + Math.sin(t * 13 + k * 0.9 + b.sem) * 0.14 * viento + (corre ? Math.sin(ciclo - f * 3) * 0.12 : 0) - (b.quieta ? 0.3 : 0);
    crin[k % 2].push([x + 1, y + 3 + (k % 2) * 1.5, ang - (k % 2) * 0.12, largo * (k % 2 ? 0.85 : 1), H * 0.075, -0.75, 5, 0.3 * viento, k * 0.7 - t * 14]);
  }
  pelo(crin[0], PIEL_O); pelo(crin[1], PIEL, 1);
  // unas hebras con algo de luz encima (el pelo no es una mancha)
  c.strokeStyle = 'rgba(120,108,96,.5)'; c.lineWidth = 0.8; c.beginPath();
  for (let k = 0; k < n; k += 2) { const f = 0.06 + 0.88 * k / n, [x, y, ta] = enLomo(f), a = ta + Math.PI + 0.3; c.moveTo(x, y + 2); c.quadraticCurveTo(x + Math.cos(a) * H * 0.07, y + Math.sin(a) * H * 0.07, x + Math.cos(a - 0.4) * H * 0.12, y + Math.sin(a - 0.4) * H * 0.12); }
  c.stroke();
  // vertebras que asoman del lomo
  c.fillStyle = PIEL_O;
  for (let k = 0; k < 7; k++) {
    const f = k / 6, i = Math.min(lomo.length - 2, Math.floor(f * (lomo.length - 1))), g = f * (lomo.length - 1) - i;
    const x = lomo[i][0] + (lomo[i + 1][0] - lomo[i][0]) * g, y = lomo[i][1] + (lomo[i + 1][1] - lomo[i][1]) * g;
    trazar(c, [[x - 4, y + 2], [x - 1, y - 8 - hash(k, 2) * 5], [x + 4, y + 2]]); c.fill(); tinta(c, 1.4);
  }
  // ---- la cabeza: craneo alargado sin ojos y la mandibula que se abre con el jadeo
  const jadeo = corre ? 0.3 + 0.28 * Math.max(0, Math.sin(ciclo * 2 + 0.5)) : sq ? 0.55 * (agacha + vuelo) : 0.25 + Math.max(0, Math.sin(t * 7 + b.sem)) * 0.35;
  c.save(); c.translate(cabeza[0], cabeza[1]); c.rotate(0.15 + cab);
  const cr = [[-H * 0.18, -H * 0.12], [H * 0.05, -H * 0.15], [H * 0.3 * T.hocico, -H * 0.06], [H * 0.34 * T.hocico, 0], [-H * 0.12, H * 0.04]];
  trazarSuave(c, temblar(cr, 10, 1, b.sem + 3)); c.fillStyle = PIEL_C; c.fill(); tinta(c, 2.4);
  // el craneo se marca: la ceja de hueso y las arrugas del hocico
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.2; c.beginPath();
  c.moveTo(-H * 0.06, -H * 0.12); c.quadraticCurveTo(H * 0.06, -H * 0.15, H * 0.12, -H * 0.1);
  for (let k = 0; k < 3; k++) { c.moveTo(H * (0.16 + k * 0.035) * T.hocico, -H * 0.075); c.lineTo(H * (0.17 + k * 0.035) * T.hocico, -H * 0.045); }
  c.stroke();
  c.save(); c.rotate(jadeo);
  const mand = [[-H * 0.12, H * 0.02], [H * 0.28 * T.hocico, H * 0.02], [H * 0.26 * T.hocico, H * 0.08], [-H * 0.08, H * 0.1]];
  trazar(c, mand); c.fillStyle = PIEL; c.fill(); tinta(c, 2.2);
  // dientes de abajo
  c.fillStyle = '#c9c1aa';
  for (let k = 0; k < 5; k++) { const x = H * (0.03 + k * 0.05) * T.hocico; trazar(c, [[x, H * 0.02], [x + 2.4, H * 0.02], [x + 1.2, -H * (0.03 + (k === 0 ? 0.02 : 0))]]); c.fill(); }
  c.restore();
  // dientes de arriba (el colmillo mas largo) y la encia oscura
  c.fillStyle = '#3a1d16'; c.fillRect(0, -1, H * 0.3 * T.hocico, 2.2);
  c.fillStyle = '#c9c1aa';
  for (let k = 0; k < 5; k++) { const x = H * (0.04 + k * 0.05) * T.hocico; trazar(c, [[x, 0], [x + 2.4, 0], [x + 1.2, H * (0.05 + (k === 1 ? 0.035 : 0))]]); c.fill(); }
  // el hueco donde iban los ojos: una grieta naranja apagada, con hebras del hongo que salen
  c.strokeStyle = 'rgba(226,121,43,.55)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(H * 0.02, -H * 0.1); c.lineTo(H * 0.1, -H * 0.08); c.stroke();
  c.strokeStyle = 'rgba(226,121,43,.35)'; c.lineWidth = 0.8; c.beginPath();
  for (let k = 0; k < 3; k++) { c.moveTo(H * (0.04 + k * 0.025), -H * 0.095); c.quadraticCurveTo(H * (0.03 + k * 0.03), -H * 0.16, H * (0.0 + k * 0.035), -H * (0.19 + k * 0.01)); }
  c.stroke();
  // las babas: dos hilos que cuelgan de la mandibula y se mecen con la carrera
  const babea = Math.sin(t * 6 + b.sem) * 0.4 + (corre ? Math.sin(ciclo) * 0.3 : 0);
  c.strokeStyle = 'rgba(200,205,195,.55)'; c.lineWidth = 1;
  for (const [bx, L2] of [[H * 0.12, H * 0.16], [H * 0.2, H * 0.1]]) {
    const x0 = bx * T.hocico, y0 = H * 0.08 + Math.sin(jadeo) * bx;
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 - 3 + babea * 6, y0 + L2 * 0.6, x0 - 6 + babea * 10, y0 + L2); c.stroke();
    c.fillStyle = 'rgba(210,215,205,.6)'; c.beginPath(); c.arc(x0 - 6 + babea * 10, y0 + L2 + 1, 1.4, 0, 7); c.fill();
  }
  // el vaho: la noche es fria y cada jadeo deja una nubecilla delante de la boca que el aire de la carrera echa atras
  if (!b.quieta) {
    for (let k = 0; k < 3; k++) {
      const e = ((t * (corre ? 2.2 : 1.2) + k / 3 + hash(b.sem, 9)) % 1), r = H * (0.05 + e * 0.14);
      const vx = H * 0.36 * T.hocico - e * H * (corre ? 0.7 : 0.15), vy = H * 0.04 - e * H * 0.12;
      const g = c.createRadialGradient(vx, vy, 0, vx, vy, r);
      g.addColorStop(0, `rgba(200,212,226,${(0.16 * (1 - e)).toFixed(3)})`); g.addColorStop(1, 'rgba(200,212,226,0)');
      c.fillStyle = g; c.fillRect(vx - r, vy - r, r * 2, r * 2);
    }
  }
  c.restore();
  // ---- los tallos del hongo en el lomo: salen de un bulto, se afinan, se doblan atras con el aire y dan un latigazo
  // en cada zancada (van un poco detras del bote del cuerpo)
  const bolas = b._bolas || (b._bolas = []);
  for (let k = 0; k < T.tallos; k++) {
    const f = 0.15 + (k / Math.max(1, T.tallos - 1)) * 0.6, [x, y, ta] = enLomo(f);
    const h = H * (0.3 + hash(k, b.sem) * 0.3);
    const latigo = Math.sin(fase * Math.PI * 4 - 1.2 - k * 0.6) * 0.22 * viento;
    // (nacen hacia arriba y algo atras aunque el lomo baje hacia el anca: tumbados parecian cuernos)
    const ang = Math.max(-2.25, Math.min(-1.5, ta - Math.PI / 2 - 0.3)) + Math.sin(t * 6 + k * 2 + b.sem) * 0.1;
    const [bx, by] = talloHongo(c, x, y + 1, ang, h, H * 0.042 + 1.3, -0.45 - latigo, { piel: PIEL_O, tinta: 1.3 });
    const [rx, ry] = rot(bx, by);
    bolas[k] = [rx, ry - (b.vuela ? b.vuela.y : 0)];
  }
  bolas.length = T.tallos;
  c.restore();       // (el cabeceo)
  for (const q of piernas) if (!q.lejos) dibPierna(q);
  c.restore();
}
