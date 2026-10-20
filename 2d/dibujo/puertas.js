// Las puertas, el montacargas y el conducto por los que se sale de un nivel y se entra en el siguiente
// (sim/pasos.js), a tinta. Las puertas estan en la pared del fondo: al abrirse ensenan el umbral, un pasillo
// oscuro que se hunde hacia dentro; el 18 entra o sale por el andando (main.js lo pinta mas pequeno y a
// oscuras dentro del hueco) y las hojas se vuelven a pintar por delante de el.
//   capa 'fondo'  fachada + vano + pasillo + hojas + marco (detras del 18)
//   capa 'hojas'  las hojas y el marco otra vez, por delante del 18 cuando esta en el umbral
//
// PROFUNDIDAD (2026-10-18, el usuario: "detalla mejor las puertas, juega con la profundidad"). El juego es
// 2D, pero las puertas se pintan en perspectiva desde una camara virtual a F u de la pared, en el centro de
// la vista (sale de la transformacion del lienzo, asi main.js no cambia): lo que esta hondo se acerca al
// centro y lo que sobresale se aleja. Por eso:
// - el hueco es un VANO hundido en el muro: al pasar por delante se ve una jamba y luego la otra;
// - jambas, dinteles, chapas y pilares son SOLIDOS que sobresalen y ensenan sus cantos;
// - las hojas estan al fondo del vano y las que giran (casa, verja) giran en 3D hacia dentro;
// - detras de la hoja, un pasillo que se hunde hacia su punto de fuga.
// Luz de arriba a la izquierda: los cantos de arriba y los que miran a la izquierda claros, los de abajo y
// los que miran a la derecha en sombra; el dintel y la jamba de la izquierda echan sombra sobre la hoja.
import { TINTA, GROSOR, caja, trazar, tinta, temblar, hash, mezclar } from './tinta.js';

// hueco de paso de cada tipo (ancho x alto, en u; el 18 mide 22 x 50)
const HUECO = { esclusa: [52, 84], conducto: [50, 62], portal: [56, 88], casa: [44, 82], verja: [62, 90], ascensor: [60, 80], escalera: [24, 64], trampilla: [40, 12], cae: [10, 10] };
// lo hondo que esta la hoja dentro del muro (u)
const HONDO = { esclusa: 30, conducto: 16, portal: 28, casa: 16, verja: 12 };

export function rectoUmbral(pu) {
  const [w, h] = HUECO[pu.tipo];
  return { x: pu.x - w / 2, y: pu.pie - h, w, h };
}

const suave = (u) => u * u * (3 - 2 * u);

// ---------------------------------------------------------------- la perspectiva
const F = 600;                     // la camara virtual, a F u de la pared
const V = { x: 0, y: 0 };          // y en el centro de la vista
function desde(c, pu) {
  const m = c.getTransform();
  if (m.a > 0 && c.canvas) { V.x = (c.canvas.width / 2 - m.e) / m.a; V.y = (c.canvas.height / 2 - m.f) / m.d; }
  else { V.x = pu.x; V.y = pu.pie - 80; }
}
const esc = (z) => F / (F + z);
const P = (x, y, z) => { const k = esc(z); return [V.x + (x - V.x) * k, V.y + (y - V.y) * k]; };
const PP = (pts, z) => pts.map(([x, y]) => P(x, y, z));
// lo que se pinte despues va al plano de profundidad z, con las coordenadas de la pared
function enPlano(c, z) { const k = esc(z); c.translate(V.x, V.y); c.scale(k, k); c.translate(-V.x, -V.y); }
const rect4 = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
function poli(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
// mas claro (l > 1) o mas oscuro (l < 1)
const tono = (col, l) => (l >= 1 ? mezclar(col, '#ffffff', Math.min(1, (l - 1) * 1.4)) : mezclar(col, '#000000', 1 - l));
const LUZ = [-0.55, -0.83];        // hacia la luz: arriba a la izquierda
let SOMBRAS = true;                // en la segunda pasada (por delante del 18) no se repiten las sombras sobre el muro

// Un solido de canto: la forma `pts` (en la pared) entre las profundidades zd (delante) y zt (detras). Pinta los
// cantos que asoman (los que ve la camara: el contorno de atras sale por fuera del de delante), sombreados por
// la luz, y luego la cara de delante con su tinta. Devuelve la cara de delante proyectada.
function solido(c, pts, zd, zt, col, op = {}) {
  const n = pts.length;
  let cx = 0, cy = 0;
  for (const [x, y] of pts) { cx += x / n; cy += y / n; }
  const fr = PP(pts, zd), bk = PP(pts, zt);
  // lo que sobresale echa su sombra sobre el muro, abajo a la derecha (en dos tonos, que a tinta se lee mejor
  // que un desenfoque)
  if (zd < 0 && op.sombra !== false && SOMBRAS) {
    const base = PP(pts, 0);
    for (const [f, al] of [[0.75, 0.2], [0.45, 0.16]]) {
      poli(c, base.map(([x, y]) => [x - zd * f * 0.8, y - zd * f])); c.fillStyle = `rgba(0,0,0,${al})`; c.fill();
    }
  }
  const vistas = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [ax, ay] = pts[i], [bx, by] = pts[j];
    let nx = by - ay, ny = ax - bx;
    const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
    if (((ax + bx) / 2 - cx) * nx + ((ay + by) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny; }    // hacia fuera
    const dx = (bk[i][0] + bk[j][0] - fr[i][0] - fr[j][0]) / 2, dy = (bk[i][1] + bk[j][1] - fr[i][1] - fr[j][1]) / 2;
    if (dx * nx + dy * ny <= 0.01) continue;
    const l = 0.66 + 0.3 * (LUZ[0] * nx + LUZ[1] * ny);
    poli(c, [fr[i], fr[j], bk[j], bk[i]]); c.fillStyle = tono(col, l); c.fill();
    c.strokeStyle = tono(col, l); c.lineWidth = 0.6; c.stroke();         // sin rendijas entre trozos
    vistas.push(i);
  }
  // la tinta del canto: solo su borde de fuera (el de atras), fina, para que no se lea como una linea doble
  if (vistas.length && op.grosor !== 0) {
    c.beginPath();
    for (const i of vistas) { const j = (i + 1) % n; c.moveTo(bk[i][0], bk[i][1]); c.lineTo(bk[j][0], bk[j][1]); }
    c.lineCap = 'round'; c.strokeStyle = TINTA; c.lineWidth = (op.grosor ?? GROSOR) * 0.42; c.stroke();
  }
  trazar(c, fr); c.fillStyle = col; c.fill();
  if (op.grosor !== 0) tinta(c, op.grosor ?? GROSOR);
  return fr;
}
const caja3 = (c, x, y, w, h, zd, col, sem, op = {}) => solido(c, temblar(rect4(x, y, w, h), 12, op.amp ?? 0.6, sem), zd, op.zt ?? 0, col, op);

// El vano: entre el hueco de la pared (z 0) y el plano de la hoja (z D), recortado por el hueco. El dintel (que
// mira abajo) oscuro, el umbral (mira arriba) claro, la jamba de la izquierda (mira a la derecha) en sombra
function vano(c, r, D, col) {
  const p0 = rect4(r.x, r.y, r.w, r.h), p1 = PP(p0, D);
  c.save(); poli(c, p0); c.clip();
  for (const [q, l] of [[[p0[0], p0[1], p1[1], p1[0]], 0.38], [[p0[3], p0[2], p1[2], p1[3]], 1.08], [[p0[0], p0[3], p1[3], p1[0]], 0.55], [[p0[1], p0[2], p1[2], p1[1]], 0.95]]) {
    poli(c, q); c.fillStyle = tono(col, l); c.fill();
  }
  // la arista del fondo y oclusion en los rincones
  poli(c, p1); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1.4; c.stroke();
  c.restore();
}

// pinta fn() en el plano de la hoja (z D), recortado por el hueco de la pared y por el del fondo
function alFondo(c, r, D, fn) {
  c.save();
  poli(c, rect4(r.x, r.y, r.w, r.h)); c.clip();
  enPlano(c, D);
  c.beginPath(); c.rect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1); c.clip();
  fn();
  c.restore();
}

// la sombra que echan el dintel y la jamba de la izquierda sobre lo que hay al fondo (en coordenadas del plano)
function sombras(c, r, k = 1) {
  let g = c.createLinearGradient(0, r.y, 0, r.y + 18);
  g.addColorStop(0, `rgba(0,0,0,${0.6 * k})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(r.x, r.y, r.w, 18);
  g = c.createLinearGradient(r.x, 0, r.x + 14, 0);
  g.addColorStop(0, `rgba(0,0,0,${0.42 * k})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(r.x, r.y, 14, r.h);
  g = c.createLinearGradient(0, r.y + r.h - 8, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.3 * k})`);
  c.fillStyle = g; c.fillRect(r.x, r.y + r.h - 8, r.w, 8);
}

// ---------------------------------------------------------------- puerta
export function dibujarPuerta(c, pu, t, E, zona, capa) {
  const r = rectoUmbral(pu);
  const a = suave(Math.max(0, Math.min(1, pu.abre)));
  desde(c, pu);
  if (Math.abs(pu.x - V.x) > 1600) return;                     // lejos de la vista
  if (pu.tipo === 'ascensor') { SOMBRAS = capa === 'fondo'; montacargas(c, r, pu, t, a, capa); return; }
  if (pu.tipo === 'cae') return;
  if (pu.tipo === 'escalera') { if (capa === 'fondo') escotilla(c, pu, a); return; }
  if (pu.tipo === 'trampilla') { if (capa === 'fondo') trampilla(c, pu, a); return; }
  const D = HONDO[pu.tipo];
  SOMBRAS = capa === 'fondo';
  if (capa === 'fondo') {
    fachada(c, r, pu, E, zona);
    vano(c, r, D, colorVano(pu, E, zona));
    pasillo(c, r, pu, a, D);
  }
  hojas(c, r, pu, t, a, D);
  marco(c, r, pu, t, a, E, zona, capa === 'fondo');
}

function colorVano(pu, E, zona) {
  if (pu.tipo === 'esclusa') return '#3b4249';
  if (pu.tipo === 'conducto') return '#40474d';
  if (pu.tipo === 'portal') return mezclar('#6a655c', zona.masa, 0.3);
  if (pu.tipo === 'casa') return E.nivel.zona === 'casa' ? mezclar(zona.masaClara, '#6b5a48', 0.4) : '#6d4a3a';
  return '#77746d';
}

// ---- lo que hay detras de la puerta en la calle: sin esto, una puerta de casa en una azotea flotaba sola.
// Caseta de ladrillo (casa), trozo de fachada rota y desconchada (portal) o tapia del hospital (verja); en el
// laboratorio la pared del fondo ya esta. Es una losa con grosor: por arriba y por los lados ensena su canto
function fachada(c, r, pu, E, zona) {
  if (pu.tipo === 'esclusa' || pu.tipo === 'conducto') return;
  if (pu.tipo === 'casa' && E.nivel.zona === 'casa') return;
  const sem = Math.round(pu.x) + 31, m = pu.tipo === 'verja' ? 40 : pu.tipo === 'portal' ? 36 : 30, alto = pu.tipo === 'verja' ? 30 : pu.tipo === 'portal' ? 56 : 44;
  const x0 = r.x - m, x1 = r.x + r.w + m, y0 = r.y - alto, y1 = r.y + r.h;
  const base = pu.tipo === 'portal' ? mezclar('#8a8478', zona.masaClara, 0.45) : mezclar(zona.masaClara, zona.masa, 0.35);
  const borde = pu.tipo === 'portal'
    ? temblar([[x0 + 6, y1], [x0, y0 + 22], [x0 + 14, y0 + 6], [x0 + 34, y0 + 16], [x0 + 52, y0 + 2], [x1 - 34, y0], [x1 - 14, y0 + 12], [x1, y0 + 26], [x1 - 4, y1]], 10, 2.4, sem)
    : temblar([[x0, y1], [x0, y0], [x1, y0], [x1, y1]], 12, 1, sem);
  const fr = solido(c, borde, 0, 16, base, { grosor: GROSOR * 0.9 });
  trazar(c, fr);
  c.save(); c.clip();
  if (pu.tipo === 'portal') enlucido(c, x0, y0, x1, y1, sem);
  else {
    // hiladas de ladrillo o de bloque
    c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1;
    const hy = pu.tipo === 'casa' ? 7 : 12, hx = pu.tipo === 'casa' ? 16 : 26;
    for (let y = y1, k = 0; y > y0 - hy; y -= hy, k++) {
      c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
      for (let x = x0 + (k % 2) * hx / 2; x < x1; x += hx) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - hy); c.stroke(); }
    }
  }
  // humedad y sombra al pie
  const g = c.createLinearGradient(0, y1 - 30, 0, y1);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.4)');
  c.fillStyle = g; c.fillRect(x0 - 20, y1 - 30, x1 - x0 + 40, 30);
  c.restore();
  trazar(c, fr); tinta(c, GROSOR * 0.9);
  if (pu.tipo === 'casa') caja3(c, x0 - 4, y0 - 6, x1 - x0 + 8, 8, -7, mezclar(base, '#000000', 0.3), sem + 1);   // el alero de la caseta
}

// enlucido viejo sobre ladrillo: manchas, desconchones que ensenan el ladrillo con su borde roto, grietas
function enlucido(c, x0, y0, x1, y1, sem) {
  // grano y manchas del enlucido
  for (let k = 0; k < 60; k++) {
    const x = x0 + hash(k, sem, 1) * (x1 - x0), y = y0 + hash(k, sem, 2) * (y1 - y0), s = 1 + hash(k, sem, 3) * 2.2;
    c.fillStyle = hash(k, sem, 4) < 0.5 ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.06)';
    c.fillRect(x, y, s, s);
  }
  // chorretones desde arriba
  for (let k = 0; k < 7; k++) {
    const x = x0 + 6 + hash(k, sem, 5) * (x1 - x0 - 12), l = 14 + hash(k, sem, 6) * 46;
    const g = c.createLinearGradient(0, y0, 0, y0 + l);
    g.addColorStop(0, 'rgba(40,30,22,.28)'); g.addColorStop(1, 'rgba(40,30,22,0)');
    c.fillStyle = g; c.fillRect(x, y0, 2 + hash(k, sem, 7) * 3, l);
  }
  // desconchones: el ladrillo de debajo, con su sombra arriba (el enlucido tiene grosor)
  for (let k = 0; k < 3; k++) {
    const cx = x0 + 10 + hash(k, sem, 8) * (x1 - x0 - 20), cy = y0 + 14 + hash(k, sem, 9) * (y1 - y0 - 40);
    const rx = 9 + hash(k, sem, 10) * 9, ry = 6 + hash(k, sem, 11) * 6;
    const pts = [];
    for (let i = 0; i < 9; i++) { const an = (i / 9) * Math.PI * 2, f = 0.7 + hash(i, k, sem) * 0.5; pts.push([cx + Math.cos(an) * rx * f, cy + Math.sin(an) * ry * f]); }
    c.save(); poli(c, pts); c.fillStyle = '#5c3f33'; c.fill(); c.clip();
    c.strokeStyle = 'rgba(30,20,16,.6)'; c.lineWidth = 0.9;
    for (let y = cy - ry - 4, f = 0; y < cy + ry + 4; y += 4.5, f++) {
      c.beginPath(); c.moveTo(cx - rx - 2, y); c.lineTo(cx + rx + 2, y); c.stroke();
      for (let x = cx - rx - 2 + (f % 2) * 5; x < cx + rx + 2; x += 10) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 4.5); c.stroke(); }
    }
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(cx - rx - 2, cy - ry - 2, rx * 2 + 4, 3);
    c.restore();
    poli(c, pts); c.strokeStyle = 'rgba(255,250,240,.25)'; c.lineWidth = 1; c.stroke();
    tinta(c, 1);
  }
  // grietas
  c.strokeStyle = 'rgba(15,12,10,.55)'; c.lineWidth = 0.9;
  for (let k = 0; k < 3; k++) {
    let x = x0 + hash(k, sem, 12) * (x1 - x0), y = y0 + 4;
    c.beginPath(); c.moveTo(x, y);
    for (let i = 0; i < 6; i++) { x += (hash(i, k, sem + 13) - 0.5) * 12; y += 5 + hash(i, k, sem + 14) * 7; c.lineTo(x, y); }
    c.stroke();
  }
}

// ---- el pasillo de detras: de la boca (z D) hacia su fondo, con juntas que se hunden y una luz muy lejos
function pasillo(c, r, pu, a, D) {
  const caja0 = rect4(r.x, r.y, r.w, r.h), zf = D + 900;
  const boca = PP(caja0, D), fondo = PP(caja0, zf);
  c.save();
  poli(c, caja0); c.clip(); poli(c, boca); c.clip();
  c.fillStyle = '#040405'; poli(c, boca); c.fill();
  // techo, suelo (algo mas claro) y paredes
  for (const [q, al] of [[[boca[0], boca[1], fondo[1], fondo[0]], 0.015], [[boca[3], boca[2], fondo[2], fondo[3]], 0.07], [[boca[0], boca[3], fondo[3], fondo[0]], 0.03], [[boca[1], boca[2], fondo[2], fondo[1]], 0.045]]) {
    poli(c, q); c.fillStyle = `rgba(255,255,255,${al})`; c.fill();
  }
  // juntas (o nervios del conducto) cada vez mas juntas al hundirse
  c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 1;
  const paso = pu.tipo === 'conducto' ? 40 : 110;
  for (let z = D + paso; z < zf; z += paso) { poli(c, PP(caja0, z)); c.stroke(); }
  c.strokeStyle = 'rgba(255,255,255,.07)';
  c.beginPath();
  for (let i = 0; i < 4; i++) { c.moveTo(boca[i][0], boca[i][1]); c.lineTo(fondo[i][0], fondo[i][1]); }
  c.stroke();
  // la luz del fondo
  const luz = pu.tipo === 'verja' ? 'rgba(150,165,185,' : pu.tipo === 'portal' ? 'rgba(130,135,140,' : pu.tipo === 'casa' ? 'rgba(170,140,100,' : 'rgba(140,165,185,';
  const [fx, fy] = P(r.x + r.w / 2, r.y + r.h * 0.45, zf);
  const R = r.w * 0.8;
  const g = c.createRadialGradient(fx, fy, 0, fx, fy, R);
  g.addColorStop(0, luz + (0.28 * a) + ')'); g.addColorStop(1, luz + '0)');
  c.fillStyle = g; c.fillRect(fx - R, fy - R, R * 2, R * 2);
  c.restore();
}

// ---------------------------------------------------------------- lo que cierra el paso, segun la puerta
function hojas(c, r, pu, t, a, D) {
  const sem = Math.round(pu.x);
  if (pu.tipo === 'casa') { hojaCasa(c, r, D, a, sem); return; }
  if (pu.tipo === 'verja') { verja3d(c, r, D, a); return; }
  alFondo(c, r, D, () => {
    if (pu.tipo === 'esclusa') hojasEsclusa(c, r, a, sem);
    else if (pu.tipo === 'conducto') rejilla(c, r, a, sem);
    else if (pu.tipo === 'portal') persiana(c, r, a, sem);
    sombras(c, r);
  });
}

// un panel en relieve (o hundido): bisel claro arriba y a la izquierda, oscuro abajo y a la derecha
function panel(c, x, y, w, h, col, hundido = false) {
  c.fillStyle = col; c.fillRect(x, y, w, h);
  const claro = 'rgba(255,255,255,.14)', oscuro = 'rgba(0,0,0,.5)';
  c.lineWidth = 1.3;
  c.strokeStyle = hundido ? oscuro : claro; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y); c.lineTo(x + w, y); c.stroke();
  c.strokeStyle = hundido ? claro : oscuro; c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.stroke();
}

// dos hojas blindadas que se meten en el marco: paneles en relieve, ojo de buey, canto dentado, franjas y remaches
function hojasEsclusa(c, r, a, sem) {
  const hw = r.w / 2, d = hw * a;
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? r.x - d : r.x + hw + d;
    caja(c, x0, r.y, hw, r.h, '#3a4149', sem + s, 0.4, 2);
    panel(c, x0 + 4, r.y + 5, hw - 8, r.h * 0.42, '#414952');
    panel(c, x0 + 4, r.y + r.h * 0.53, hw - 8, r.h * 0.42, '#414952');
    // ojo de buey: aro atornillado y cristal oscuro con su brillo
    const ox = x0 + hw / 2 + s * 1.5, oy = r.y + 5 + r.h * 0.2, R = Math.min(hw * 0.27, 7.5);
    c.beginPath(); c.arc(ox, oy, R + 2.6, 0, 7); c.fillStyle = '#58616a'; c.fill(); tinta(c, 1.4);
    const gv = c.createRadialGradient(ox - R * 0.35, oy - R * 0.35, 0, ox, oy, R);
    gv.addColorStop(0, '#2e3d48'); gv.addColorStop(1, '#080b0e');
    c.beginPath(); c.arc(ox, oy, R, 0, 7); c.fillStyle = gv; c.fill(); tinta(c, 1);
    c.beginPath(); c.arc(ox, oy, R * 0.68, -2.7, -1.7); c.strokeStyle = 'rgba(220,235,245,.45)'; c.lineWidth = 1.1; c.stroke();
    for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3 + 0.3; c.beginPath(); c.arc(ox + Math.cos(an) * (R + 1.3), oy + Math.sin(an) * (R + 1.3), 0.7, 0, 7); c.fillStyle = '#20252a'; c.fill(); }
    // el canto del centro: dientes que encajan con la otra hoja
    const xc = s < 0 ? x0 + hw : x0;
    c.beginPath(); c.moveTo(xc, r.y);
    for (let k = 0, y = r.y; y < r.y + r.h; k++, y += 7) { c.lineTo(xc - s * (k % 2 ? 2.5 : 0), y); c.lineTo(xc - s * (k % 2 ? 2.5 : 0), y + 7); }
    c.strokeStyle = TINTA; c.lineWidth = 1.6; c.stroke();
    // las franjas de aviso junto al canto
    c.save(); c.beginPath(); c.rect(xc + (s < 0 ? -9 : 3), r.y + r.h * 0.36, 6, r.h * 0.3); c.clip();
    c.fillStyle = '#9a8a4a'; c.fillRect(x0, r.y, hw, r.h);
    c.strokeStyle = TINTA; c.lineWidth = 2.2;
    for (let yy = r.y; yy < r.y + r.h + 10; yy += 7) { c.beginPath(); c.moveTo(x0 - 2, yy); c.lineTo(x0 + hw + 2, yy + 8); c.stroke(); }
    c.restore();
    for (let k = 0; k < 5; k++) remache(c, x0 + (s < 0 ? 3 : hw - 3), r.y + 6 + k * (r.h - 12) / 4);
    // desgaste: rozaduras claras a la altura de la mano y oscuro abajo
    c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(x0 + 3, r.y + r.h * 0.48, hw - 6, 3);
  }
}

// rejilla de lamas que sube: cada lama con su cara de arriba clara, sombra debajo y oscuro entre lamas
function rejilla(c, r, a, sem) {
  const dy = -r.h * a;
  caja(c, r.x + 2, r.y + dy, r.w - 4, r.h, '#454c53', sem, 0.4, 2);
  c.fillStyle = '#0b0d0f'; c.fillRect(r.x + 6, r.y + 5 + dy, r.w - 12, r.h - 10);
  for (let yy = r.y + 7; yy < r.y + r.h - 7; yy += 7) {
    const y = yy + dy;
    c.beginPath(); c.moveTo(r.x + 6, y + 1); c.lineTo(r.x + r.w - 6, y + 1); c.lineTo(r.x + r.w - 6, y + 5); c.lineTo(r.x + 6, y + 5); c.closePath();
    c.fillStyle = '#58606a'; c.fill();
    c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(r.x + 6, y + 1, r.w - 12, 1.1);
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(r.x + 6, y + 5, r.w - 12, 1.4);
  }
  for (const [x, y] of [[r.x + 4.5, r.y + 3.5], [r.x + r.w - 4.5, r.y + 3.5], [r.x + 4.5, r.y + r.h - 3.5], [r.x + r.w - 4.5, r.y + r.h - 3.5]]) remache(c, x, y + dy);
}

// persiana de chapa ondulada que se enrolla arriba: guias en U a los lados, lamas con luz y pliegue, dos
// abolladas, oxido que chorrea, mugre abajo, barra de abajo con su tirador y el candado
function persiana(c, r, a, sem) {
  for (const x of [r.x, r.x + r.w - 4]) {
    c.fillStyle = '#211f1b'; c.fillRect(x, r.y, 4, r.h);
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x + (x === r.x ? 3 : 0.4), r.y, 0.8, r.h);
  }
  const alto = r.h * (1 - a);
  if (alto < 1) return;
  const x0 = r.x + 3, w = r.w - 6, base = r.y + alto, paso = 5;
  // pintura verde gris descolorida; donde salto, chapa oxidada con el borde de la pintura claro
  c.fillStyle = '#4c5650'; c.fillRect(x0, r.y, w, alto);
  c.save(); c.beginPath(); c.rect(x0, r.y, w, alto); c.clip();
  // la pintura salta sobre todo abajo, donde se roza, y en los bordes; trocitos irregulares, no manchas
  for (let k = 0; k < 14; k++) {
    const abajo = k < 8;
    const px = abajo ? x0 + hash(k, sem, 11) * w : (hash(k, sem, 15) < 0.5 ? x0 + 2 : x0 + w - 2) + (hash(k, sem, 11) - 0.5) * 6;
    const py = abajo ? base - 3 - hash(k, sem, 12) * 20 : base - 10 - hash(k, sem, 12) * r.h * 0.8;
    const rx = 1.2 + hash(k, sem, 13) * 3.2, ry = 0.8 + hash(k, sem, 14) * 1.8;
    c.beginPath();
    for (let i = 0; i < 7; i++) { const an = (i / 7) * Math.PI * 2, f = 0.45 + hash(i, k, sem) * 0.9; c[i ? 'lineTo' : 'moveTo'](px + Math.cos(an) * rx * f, py + Math.sin(an) * ry * f); }
    c.closePath(); c.fillStyle = '#4e3a2b'; c.fill(); c.strokeStyle = 'rgba(190,200,190,.22)'; c.lineWidth = 0.6; c.stroke();
  }
  c.restore();
  for (let i = 0, y = base - 7 - paso; y > r.y - paso; i++, y -= paso) {
    const v = hash(i, sem, 3);
    c.fillStyle = `rgba(${v < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + 0.05 * Math.abs(v - 0.5)})`; c.fillRect(x0, y, w, paso);
    c.fillStyle = 'rgba(255,255,255,.13)'; c.fillRect(x0, y + 0.6, w, 1.1);
    c.fillStyle = 'rgba(0,0,0,.42)'; c.fillRect(x0, y + paso - 1.3, w, 1.3);
    if (i === 4 || i === 9) {
      // abollada: una hondonada con su luz al lado
      const cx = x0 + w * (0.3 + 0.4 * hash(i, sem, 4));
      const g = c.createRadialGradient(cx, y + paso / 2, 0, cx, y + paso / 2, 6);
      g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(cx - 10, y - 3, 20, paso + 6);
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(cx + 3, y + 1, 5, 1);
    }
  }
  // oxido: chorretones pardos que bajan desde las juntas
  for (let k = 0; k < 6; k++) {
    const x = x0 + 3 + hash(k, sem, 5) * (w - 6), y = r.y + hash(k, sem, 6) * alto * 0.6, l = 10 + hash(k, sem, 7) * alto * 0.4;
    const g = c.createLinearGradient(0, y, 0, y + l);
    g.addColorStop(0, 'rgba(94,58,34,.45)'); g.addColorStop(1, 'rgba(94,58,34,0)');
    c.fillStyle = g; c.fillRect(x, y, 1.6 + hash(k, sem, 8) * 1.6, l);
  }
  // mugre de abajo
  const g = c.createLinearGradient(0, base - 22, 0, base);
  g.addColorStop(0, 'rgba(20,16,12,0)'); g.addColorStop(1, 'rgba(20,16,12,.45)');
  c.fillStyle = g; c.fillRect(x0, base - 22, w, 22);
  trazar(c, temblar(rect4(x0, r.y - 2, w, alto + 2), 12, 0.4, sem)); tinta(c, 1.8);
  // la barra de abajo, el tirador y el candado en su pestillo
  caja(c, x0 - 1, base - 7, w + 2, 7, '#34312c', sem + 2, 0.3, 1.6);
  c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x0, base - 6.2, w, 1);
  c.beginPath(); c.moveTo(r.x + r.w / 2 - 6, base - 6); c.lineTo(r.x + r.w / 2 - 6, base - 10); c.lineTo(r.x + r.w / 2 + 6, base - 10); c.lineTo(r.x + r.w / 2 + 6, base - 6);
  c.strokeStyle = TINTA; c.lineWidth = 2.4; c.stroke(); c.strokeStyle = '#6a6760'; c.lineWidth = 1; c.stroke();
  if (a < 0.05) {
    const lx = x0 + w - 9, ly = base - 3;
    c.beginPath(); c.arc(lx, ly + 1, 2.4, Math.PI, 0); c.strokeStyle = TINTA; c.lineWidth = 2.2; c.stroke(); c.strokeStyle = '#8a8478'; c.lineWidth = 0.9; c.stroke();
    caja(c, lx - 3.4, ly + 1, 6.8, 6, '#6e5a3a', sem + 4, 0.15, 1.3);
    c.fillStyle = TINTA; c.fillRect(lx - 0.5, ly + 3.5, 1, 2);
  }
}

// la puerta de madera de la casa gira sobre su bisagra (a la izquierda) HACIA DENTRO, en 3D: se estrecha, se
// oscurece al dejar de mirar a la luz y ensena su canto
function hojaCasa(c, r, D, a, sem) {
  const th = a * 1.32, W = r.w, cs = Math.cos(th), sn = Math.sin(th);
  const Q = (u, v, e = 0) => P(r.x + u * cs - e * sn, r.y + v, D + u * sn + e * cs);
  c.save();
  poli(c, rect4(r.x, r.y, r.w, r.h)); c.clip();
  poli(c, PP(rect4(r.x, r.y, r.w, r.h), D)); c.clip();
  const madera = '#5d4632', l = 1 - 0.5 * a;
  if (a > 0.02) {
    poli(c, [Q(W, 0), Q(W, r.h), Q(W, r.h, 4), Q(W, 0, 4)]); c.fillStyle = tono(madera, 0.8); c.fill(); tinta(c, 1.2);
  }
  poli(c, [Q(0, 0), Q(W, 0), Q(W, r.h), Q(0, r.h)]); c.fillStyle = tono(madera, l); c.fill(); tinta(c, 2);
  // vetas
  c.strokeStyle = 'rgba(30,20,12,.28)'; c.lineWidth = 0.8;
  for (let k = 0; k < 6; k++) {
    const u = 3 + hash(k, sem, 2) * (W - 6);
    c.beginPath(); const [ax, ay] = Q(u, 2), [bx, by] = Q(u + (hash(k, sem, 3) - 0.5) * 4, r.h - 2); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
  }
  // cuarterones hundidos
  for (const [v0, v1] of [[8, r.h * 0.46], [r.h * 0.54, r.h - 8]]) {
    const u0 = 6, u1 = W - 6;
    poli(c, [Q(u0, v0), Q(u1, v0), Q(u1, v1), Q(u0, v1)]); c.fillStyle = tono(madera, l * 0.86); c.fill();
    c.lineWidth = 1.3;
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.moveTo(...Q(u0, v1)); c.lineTo(...Q(u0, v0)); c.lineTo(...Q(u1, v0)); c.stroke();
    c.strokeStyle = 'rgba(255,225,180,.16)'; c.beginPath(); c.moveTo(...Q(u1, v0)); c.lineTo(...Q(u1, v1)); c.lineTo(...Q(u0, v1)); c.stroke();
  }
  // mirilla, pomo de laton y bocallave
  const [mx, my] = Q(W / 2, r.h * 0.3); c.beginPath(); c.arc(mx, my, 1.4 * cs + 0.3, 0, 7); c.fillStyle = '#b39a5a'; c.fill(); tinta(c, 0.8);
  if (a < 0.7) {
    const [px, py] = Q(W - 7, r.h * 0.5);
    c.beginPath(); c.arc(px, py, 2.4, 0, 7); c.fillStyle = '#b39a5a'; c.fill(); tinta(c, 1);
    c.beginPath(); c.arc(px - 0.7, py - 0.7, 0.8, 0, 7); c.fillStyle = 'rgba(255,245,210,.7)'; c.fill();
    const [kx, ky] = Q(W - 7, r.h * 0.5 + 6); c.fillStyle = TINTA; c.fillRect(kx - 0.6, ky - 1.2, 1.2 * cs + 0.2, 2.6);
  }
  c.restore();
}

// dos hojas de barrotes que giran hacia dentro sobre sus bisagras, en 3D
function verja3d(c, r, D, a) {
  const hw = r.w / 2, th = a * 1.25;
  c.save(); poli(c, rect4(r.x, r.y, r.w, r.h)); c.clip();
  for (const s of [-1, 1]) {
    const hx = s < 0 ? r.x : r.x + r.w;
    const Q = (u, v) => P(hx - s * u * Math.cos(th), r.y + v, D + u * Math.sin(th));
    c.strokeStyle = TINTA; c.lineCap = 'round';
    c.beginPath();
    for (const v of [10, r.h * 0.55, r.h - 8]) { c.moveTo(...Q(0, v)); c.lineTo(...Q(hw, v)); }
    c.lineWidth = 2.4; c.stroke();
    for (let k = 0; k <= 5; k++) {
      const u = (hw * k) / 5;
      c.beginPath(); c.moveTo(...Q(u, 4)); c.lineTo(...Q(u, r.h)); c.lineWidth = 2.2; c.stroke();
      const [tx, ty] = Q(u, 0);
      c.beginPath(); c.moveTo(tx - 2, ty + 6); c.lineTo(tx, ty); c.lineTo(tx + 2, ty + 6); c.fillStyle = TINTA; c.fill();
    }
  }
  c.restore();
}

// ---------------------------------------------------------------- el marco, por delante del vano
function marco(c, r, pu, t, a, E, zona, luces) {
  const sem = Math.round(pu.x) + 11;
  if (pu.tipo === 'esclusa') {
    const g = 13;
    // jambas y dintel de acero que sobresalen del muro, atornillados
    const iz = caja3(c, r.x - g, r.y - 20, g, r.h + 20, -9, '#4b525a', sem);
    const de = caja3(c, r.x + r.w, r.y - 20, g, r.h + 20, -9, '#4b525a', sem + 1);
    for (const fr of [iz, de]) {
      c.save(); enPlano(c, -9);
      const x = fr === iz ? r.x - g / 2 : r.x + r.w + g / 2;
      for (let k = 0; k < 6; k++) remache(c, x, r.y - 12 + k * (r.h + 8) / 5);
      c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x - g / 2 + 1.5, r.y - 18, 1.2, r.h + 16);
      c.restore();
    }
    caja3(c, r.x - g - 2, r.y - 24, r.w + 2 * g + 4, 24, -11, '#565e66', sem + 2);
    // el rotulo del sector en su chapa, que sobresale del dintel
    const dest = pu.entrada ? (E.id >= 100 ? null : E.id) : (E.id >= 100 ? E.id - 99 : E.id + 1);
    caja3(c, r.x + r.w / 2 - 22, r.y - 19, 44, 13, -14, '#b9b19a', sem + 3, { zt: -11, grosor: 1.6 });
    c.save(); enPlano(c, -14);
    c.fillStyle = TINTA; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 7px Georgia';
    c.fillText(E.nivel.final && !pu.entrada ? 'EXIT' : dest ? 'SECTOR ' + dest : 'AIRLOCK', r.x + r.w / 2, r.y - 11.2);
    c.restore();
    // el piloto en su caja: rojo cerrada, blanco abierta
    caja3(c, r.x + r.w + g / 2 - 5, r.y - 34, 10, 9, -13, '#3a4047', sem + 4, { zt: -11, grosor: 1.6 });
    if (luces) { const [px, py] = P(r.x + r.w + g / 2, r.y - 29.5, -14); piloto(c, px, py, a > 0.5 ? 'rgba(225,240,255,' : 'rgba(230,70,60,', t); }
  } else if (pu.tipo === 'conducto') {
    // la brida de la boca, atornillada en las esquinas
    caja3(c, r.x - 7, r.y, 7, r.h, -5, '#5a6168', sem + 1, { grosor: 2 });
    caja3(c, r.x + r.w, r.y, 7, r.h, -5, '#5a6168', sem + 2, { grosor: 2 });
    caja3(c, r.x - 7, r.y - 7, r.w + 14, 9, -6, '#62696f', sem, { grosor: 2 });
    c.save(); enPlano(c, -6);
    for (const [x, y] of [[r.x - 3.5, r.y - 3], [r.x + r.w + 3.5, r.y - 3], [r.x - 3.5, r.y + r.h - 6], [r.x + r.w + 3.5, r.y + r.h - 6]]) remache(c, x, y);
    c.restore();
  } else if (pu.tipo === 'portal') {
    // dos pilares de hormigon que sobresalen, con chaflan, juntas del encofrado y una esquina rota con la
    // armadura dentro; encima, la viga del dintel, partida a la derecha
    const col = '#625d55', Z = -12;
    for (const [x0, x1, k] of [[r.x - 17, r.x, 1], [r.x + r.w, r.x + r.w + 17, 2]]) {
      const pts = temblar([[x0, r.y + r.h], [x0, r.y - 10], [x1, r.y - 10], [x1, r.y + r.h]], 10, 0.8, sem + k);
      const fr = solido(c, pts, Z, 0, col);
      c.save(); trazar(c, fr); c.clip(); enPlano(c, Z); hormigon(c, x0, r.y - 10, x1 - x0, r.h + 10, sem + k, k === 2 ? 'arriba' : 'abajo'); c.restore();
      trazar(c, fr); tinta(c);
    }
    const ZD = -15;
    const dintel = temblar([[r.x - 23, r.y - 2], [r.x - 23, r.y - 27], [r.x + r.w + 9, r.y - 28], [r.x + r.w + 23, r.y - 21], [r.x + r.w + 17, r.y - 13], [r.x + r.w + 23, r.y - 2]], 10, 0.8, sem);
    const fd = solido(c, dintel, ZD, 0, '#6b665d');
    c.save(); trazar(c, fd); c.clip(); enPlano(c, ZD); hormigon(c, r.x - 23, r.y - 28, r.w + 46, 26, sem + 5, 'derecha'); c.restore();
    trazar(c, fd); tinta(c);
    // las varillas: salen de la rotura del dintel y de lo alto de los pilares, pardas de oxido y torcidas
    for (const [x, y, z0, dx, dy, dz] of [[r.x + r.w + 20, r.y - 17, ZD + 3, 9, -3, -6], [r.x + r.w + 19, r.y - 9, ZD + 3, 10, 4, -4], [r.x + r.w + 18, r.y - 24, ZD + 4, 6, -8, -5]]) {
      const [ax, ay] = P(x, y, z0), [mx, my] = P(x + dx * 0.6, y + dy * 0.4, z0 + dz * 0.5), [bx, by] = P(x + dx, y + dy, z0 + dz);
      c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my, bx, by); c.lineCap = 'round';
      c.strokeStyle = TINTA; c.lineWidth = 2.6; c.stroke(); c.strokeStyle = '#5e3f2a'; c.lineWidth = 1.1; c.stroke();
    }
    // el farol de jaula sobre la puerta, apagado: un brazo que sale del muro (lo mas cercano de todo)
    farol(c, r.x + r.w / 2, r.y - 44, sem);
  } else if (pu.tipo === 'casa') {
    // el cerco de madera con su moldura, el umbral y la chapa con el numero
    const g = 6, mad = '#6b5038';
    for (const [x, k] of [[r.x - g, 0], [r.x + r.w, 1]]) {
      caja3(c, x, r.y - g, g, r.h + g, -4, mad, sem + k, { grosor: 2 });
      c.save(); enPlano(c, -4); c.strokeStyle = 'rgba(255,225,180,.18)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x + 2, r.y - g + 2); c.lineTo(x + 2, r.y + r.h); c.stroke(); c.restore();
    }
    caja3(c, r.x - g - 2, r.y - g - 4, r.w + 2 * g + 4, 6, -6, '#7a5c41', sem + 2, { grosor: 2 });
    caja3(c, r.x - 4, r.y + r.h - 3, r.w + 8, 3, -5, '#4f3b2a', sem + 6, { grosor: 1.6 });
    caja3(c, r.x + r.w / 2 - 6, r.y - 19, 12, 9, -8, '#b39a5a', sem + 3, { zt: -6, grosor: 1.2 });
    c.save(); enPlano(c, -8);
    c.fillStyle = TINTA; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 7px Georgia';
    // el portal de la casa de Varga es el 1 y su piso, en el cuarto, el 4
    c.fillText(String(!!pu.entrada === (E.id >= 100) ? 4 : 1), r.x + r.w / 2, r.y - 14.3);
    c.restore();
  } else if (pu.tipo === 'verja') {
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? r.x - 16 : r.x + r.w;
      caja3(c, x0, r.y - 14, 16, r.h + 14, -10, '#8a8780', sem + s);
      c.save(); enPlano(c, -10);
      c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1;
      for (let yy = r.y; yy < r.y + r.h; yy += 12) { c.beginPath(); c.moveTo(x0 + 1, yy); c.lineTo(x0 + 15, yy); c.stroke(); }
      c.restore();
      caja3(c, x0 - 3, r.y - 22, 22, 9, -13, '#9a978f', sem + s + 5);
    }
    // el arco de hierro
    const [ax, ay] = P(r.x, r.y - 6, -4), [qx, qy] = P(r.x + r.w / 2, r.y - 30, -4), [bx, by] = P(r.x + r.w, r.y - 6, -4);
    c.strokeStyle = TINTA; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(qx, qy, bx, by); c.stroke();
    if (luces) { const [px, py] = P(r.x + r.w / 2, r.y - 22, -4); piloto(c, px, py, 'rgba(255,220,200,', t, 0.5); }
  }
}

// la cara de un pilar o una viga de hormigon viejo (en el plano de esa cara): chaflan con su luz arriba y a la
// izquierda, juntas del encofrado con los agujeros de los latiguillos, poro fino, chorretones, una esquina
// rota (roto: 'arriba', 'abajo', 'derecha') que ensena el hueco y la armadura, y mugre abajo
function hormigon(c, x, y, w, h, sem, roto) {
  const vertical = h > w;
  // poro fino
  for (let k = 0; k < Math.round(w * h / 40); k++) {
    const px = x + hash(k, sem, 1) * w, py = y + hash(k, sem, 2) * h;
    c.fillStyle = hash(k, sem, 4) < 0.7 ? 'rgba(0,0,0,.13)' : 'rgba(255,255,255,.08)';
    c.fillRect(px, py, 0.9, 0.9);
  }
  // juntas del encofrado (tablas horizontales en los pilares, una a media altura en la viga) y latiguillos
  c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 0.9;
  const juntas = vertical ? Array.from({ length: Math.floor(h / 16) }, (_, i) => y + 8 + i * 16) : [y + h * 0.5];
  for (const jy of juntas) {
    c.beginPath(); c.moveTo(x, jy); c.lineTo(x + w, jy); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x, jy + 0.6, w, 0.7);
  }
  c.fillStyle = 'rgba(0,0,0,.45)';
  for (let k = 0; k < juntas.length; k += 2) for (const fx of [0.28, 0.72]) { c.beginPath(); c.arc(x + w * fx, juntas[k] - 4, 0.9, 0, 7); c.fill(); }
  // chorretones de humedad desde arriba
  for (let k = 0; k < Math.max(2, Math.round(w / 14)); k++) {
    const px = x + 2 + hash(k, sem, 5) * (w - 4), l = h * (0.2 + 0.4 * hash(k, sem, 6));
    const g = c.createLinearGradient(0, y, 0, y + l);
    g.addColorStop(0, 'rgba(30,24,18,.25)'); g.addColorStop(1, 'rgba(30,24,18,0)');
    c.fillStyle = g; c.fillRect(px, y, 1.4 + hash(k, sem, 7) * 2, l);
  }
  // la esquina rota: la cara se ha ido a trozos y queda la rotura, aspera y mas clara que la cara lisa, con
  // su sombra arriba (la cara tiene grosor) y una varilla de la armadura al aire. Pegada al canto, no en medio
  if (roto) {
    const s = vertical ? w * 0.95 : h * 0.95;
    let pts;
    if (roto === 'derecha') { const ex = x + w; pts = [[ex, y + h * 0.05], [ex - s * 0.55, y + h * 0.12], [ex - s * 0.85, y + h * 0.45], [ex - s * 0.5, y + h * 0.8], [ex, y + h * 0.95]]; }
    else { const ex = x + w, ey = roto === 'arriba' ? y + 2 : y + h * 0.6; pts = [[ex, ey], [ex - s * 0.6, ey + s * 0.2], [ex - s * 0.75, ey + s * 0.75], [ex - s * 0.35, ey + s * 1.3], [ex, ey + s * 1.5]]; }
    const ys = pts.map((p) => p[1]), xs = pts.map((p) => p[0]);
    const bx0 = Math.min(...xs), by0 = Math.min(...ys), bw = Math.max(...xs) - bx0, bh = Math.max(...ys) - by0;
    poli(c, pts); c.fillStyle = '#77716a'; c.fill();
    c.save(); poli(c, pts); c.clip();
    for (let k = 0; k < Math.round(bw * bh / 6); k++) {
      c.fillStyle = hash(k, sem, 21) < 0.5 ? 'rgba(0,0,0,.28)' : 'rgba(255,250,240,.16)';
      c.fillRect(bx0 + hash(k, sem, 22) * bw, by0 + hash(k, sem, 23) * bh, 1.2, 1.2);
    }
    const g = c.createLinearGradient(bx0, 0, bx0 + bw * 0.5, 0);
    g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(bx0, by0, bw, bh);
    c.lineCap = 'round'; c.beginPath();
    if (vertical) { c.moveTo(bx0 + bw * 0.65, by0 - 1); c.lineTo(bx0 + bw * 0.6, by0 + bh + 1); }
    else { c.moveTo(bx0 - 1, by0 + bh * 0.55); c.lineTo(bx0 + bw + 1, by0 + bh * 0.5); }
    c.strokeStyle = TINTA; c.lineWidth = 2.2; c.stroke(); c.strokeStyle = '#5e3f2a'; c.lineWidth = 1.1; c.stroke();
    c.restore();
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
    c.strokeStyle = 'rgba(10,8,6,.75)'; c.lineWidth = 1; c.stroke();
  }
  // el chaflan: luz en la arista de arriba y la de la izquierda, sombra en la de la derecha
  c.fillStyle = 'rgba(255,250,236,.16)'; c.fillRect(x, y, w, 1.6); c.fillRect(x, y, 1.6, h);
  c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x + w - 1.8, y, 1.8, h);
  // mugre de abajo
  const g = c.createLinearGradient(0, y + h - 22, 0, y + h);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.32)');
  c.fillStyle = g; c.fillRect(x, y + h - 22, w, 22);
}

// el farol de jaula de la calle, apagado: escuadra que sale del muro y una tulipa de cristal sucio con su rejilla
function farol(c, x, y, sem) {
  const Z = -22;
  // la placa en el muro y el brazo que sale hacia delante
  caja3(c, x - 5, y - 6, 10, 9, -2, '#3d3a35', sem + 7, { grosor: 1.4, amp: 0.2 });
  const [ax, ay] = P(x, y - 2, -2), [bx, by] = P(x, y - 2, Z);
  c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.lineCap = 'round'; c.strokeStyle = TINTA; c.lineWidth = 3.2; c.stroke(); c.strokeStyle = '#4c4842'; c.lineWidth = 1.4; c.stroke();
  // la sombra del farol en el muro
  const [sx, sy] = P(x + 12, y + 16, 0);
  c.beginPath(); c.ellipse(sx, sy, 7, 9, 0, 0, 7); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill();
  c.save(); enPlano(c, Z);
  // sombrerete, tulipa y rejilla
  c.beginPath(); c.moveTo(x - 9, y + 2); c.lineTo(x, y - 4); c.lineTo(x + 9, y + 2); c.closePath(); c.fillStyle = '#3f3b35'; c.fill(); tinta(c, 1.8);
  c.beginPath(); c.moveTo(x - 6, y + 2); c.quadraticCurveTo(x - 7, y + 13, x, y + 15); c.quadraticCurveTo(x + 7, y + 13, x + 6, y + 2); c.closePath();
  const g = c.createLinearGradient(x - 6, 0, x + 6, 0); g.addColorStop(0, '#6c6a60'); g.addColorStop(0.35, '#4a4842'); g.addColorStop(1, '#2c2a26');
  c.fillStyle = g; c.fill(); tinta(c, 1.6);
  c.strokeStyle = TINTA; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x, y + 15); c.moveTo(x - 6.5, y + 8); c.quadraticCurveTo(x, y + 10, x + 6.5, y + 8); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x - 4.5, y + 4, 1, 6);
  c.restore();
}

// ---------------------------------------------------------------- el montacargas
// pozo hondo con sus juntas y guias, jaula colgada de su cable (se mueve pu.desp) un poco hundida, reja de
// tijera en la boca y el marco de perfiles que sobresale con la polea y el indicador
function montacargas(c, r, pu, t, a, capa) {
  const sem = Math.round(pu.x), Z = 34, ZJ = 10;
  const caja0 = rect4(r.x, r.y, r.w, r.h);
  if (capa === 'fondo') {
    c.save(); poli(c, caja0); c.clip();
    c.fillStyle = '#060607'; c.fillRect(r.x, r.y, r.w, r.h);
    // las paredes del pozo hasta su fondo y el fondo con sus juntas y las dos guias
    const boca = PP(caja0, 4), fondo = PP(caja0, Z);
    for (const [q, al] of [[[boca[0], boca[3], fondo[3], fondo[0]], 0.05], [[boca[1], boca[2], fondo[2], fondo[1]], 0.08]]) { poli(c, q); c.fillStyle = `rgba(160,175,190,${al})`; c.fill(); }
    c.save(); enPlano(c, Z);
    c.strokeStyle = 'rgba(160,175,190,.12)'; c.lineWidth = 1;
    for (let y = r.y - 30; y < r.y + r.h + 30; y += 16) { c.beginPath(); c.moveTo(r.x - 20, y); c.lineTo(r.x + r.w + 20, y); c.stroke(); }
    for (const x of [r.x + 5, r.x + r.w - 5]) { c.fillStyle = '#2a2f34'; c.fillRect(x - 2, r.y - 40, 4, r.h + 80); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x - 2, r.y - 40, 1, r.h + 80); }
    c.restore();
    // la jaula
    c.save(); enPlano(c, ZJ);
    const y0 = r.y + pu.desp, y1 = y0 + r.h;
    c.strokeStyle = TINTA; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(pu.x, r.y - 60); c.lineTo(pu.x, y0 + 2); c.stroke();                 // el cable
    c.fillStyle = 'rgba(40,46,52,.88)'; c.fillRect(r.x + 8, y0 + 6, r.w - 16, r.h - 12);           // fondo de chapa perforada
    c.fillStyle = 'rgba(0,0,0,.35)';
    for (let yy = y0 + 12; yy < y1 - 10; yy += 6) for (let xx = r.x + 12; xx < r.x + r.w - 10; xx += 6) c.fillRect(xx, yy, 1.6, 1.6);
    caja(c, r.x + 3, y0, r.w - 6, 6, '#4b535b', sem, 0.3, 1.8);                                     // techo
    caja(c, r.x + 3, y1 - 6, r.w - 6, 6, '#565e66', sem + 1, 0.3, 1.8);                             // piso
    c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(r.x + 4, y1 - 5.5, r.w - 8, 1);
    for (const x of [r.x + 5, r.x + r.w - 5]) { c.strokeStyle = TINTA; c.lineWidth = 2.6; c.beginPath(); c.moveTo(x, y0 + 4); c.lineTo(x, y1 - 4); c.stroke(); }
    // la bombilla del techo de la jaula
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(pu.x, y0 + 9, 0, pu.x, y0 + 9, r.h * 0.8);
    g.addColorStop(0, 'rgba(255,225,170,.28)'); g.addColorStop(1, 'rgba(255,225,170,0)');
    c.fillStyle = g; c.fillRect(r.x, y0, r.w, r.h);
    c.restore();
    c.beginPath(); c.arc(pu.x, y0 + 9, 2.4, 0, 7); c.fillStyle = '#ffe8c0'; c.fill();
    c.restore();
    // la sombra de la boca sobre lo de dentro
    c.save(); enPlano(c, ZJ); sombras(c, r, 0.8); c.restore();
    c.restore();
  }
  // la reja de tijera en la boca (tambien por delante del 18)
  c.save(); poli(c, caja0); c.clip(); enPlano(c, 3); reja(c, r, a, sem); c.restore();
  // el marco del pozo: dos pilares de perfil y el cabezal, que sobresalen, con la polea y el indicador
  const g2 = 9;
  for (const [x, k] of [[r.x - g2, 2], [r.x + r.w, 3]]) {
    caja3(c, x, r.y - 26, g2, r.h + 26, -8, '#454c53', sem + k, { amp: 0.4 });
    c.save(); enPlano(c, -8); for (let i = 0; i < 5; i++) remache(c, x + g2 / 2, r.y - 10 + i * (r.h + 4) / 4); c.restore();
  }
  caja3(c, r.x - g2 - 3, r.y - 30, r.w + 2 * g2 + 6, 12, -10, '#50585f', sem + 4, { amp: 0.4 });
  // la polea, que sobresale del cabezal, y su cable
  const [qx, qy] = P(pu.x, r.y - 36, -12);
  c.beginPath(); c.arc(qx, qy, 7, 0, 7); c.fillStyle = '#5b636b'; c.fill(); tinta(c, 1.6);
  c.save(); c.translate(qx, qy); c.rotate(pu.desp * 0.15);
  c.strokeStyle = TINTA; c.lineWidth = 1.2; for (let k = 0; k < 3; k++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.stroke(); }
  c.restore();
  // el indicador: flecha del sentido, encendida mientras se mueve
  const mov = pu.desp !== 0, arriba = (pu.entrada ? pu.viene === 'abajo' : pu.va === 'sube');
  caja3(c, r.x + r.w + g2 + 2, r.y, 12, 16, -6, '#2a2e33', sem + 5, { grosor: 1.4, amp: 0.2 });
  const [fx, fy] = P(r.x + r.w + g2 + 8, r.y + 8, -6);
  c.beginPath(); if (arriba) { c.moveTo(fx, fy - 5); c.lineTo(fx + 4, fy + 2); c.lineTo(fx - 4, fy + 2); } else { c.moveTo(fx, fy + 5); c.lineTo(fx + 4, fy - 2); c.lineTo(fx - 4, fy - 2); }
  c.closePath(); c.fillStyle = mov ? '#ffd9a0' : 'rgba(255,217,160,.25)'; c.fill();
}

// ---- escotilla con escalerilla. Salida: la escalera sube del suelo al techo y arriba esta la escotilla
// (hueco oscuro, marco y tapa que se abre hacia dentro). Entrada: la escotilla esta en el suelo, la tapa se
// levanta y asoman los pasamanos de la escalera
function escotilla(c, pu, a) {
  const x = pu.x, sem = Math.round(x);
  const hueco = (y, abajo) => {
    c.fillStyle = '#050506'; c.fillRect(x - 15, abajo ? y : y - 6, 30, 6 + 2);
    caja(c, x - 18, abajo ? y - 2 : y - 2, 36, 4, '#555c63', sem, 0.3, 1.6);
  };
  const escalera = (y0, y1) => {
    for (const dx of [-9, 9]) { c.strokeStyle = TINTA; c.lineWidth = 3.2; c.beginPath(); c.moveTo(x + dx, y0); c.lineTo(x + dx, y1); c.stroke(); c.strokeStyle = '#6a7177'; c.lineWidth = 1.6; c.stroke(); }
    for (let y = y1 - 6; y > y0 + 2; y -= 9) { c.strokeStyle = TINTA; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x - 9, y); c.lineTo(x + 9, y); c.stroke(); c.strokeStyle = '#7a8086'; c.lineWidth = 1; c.stroke(); }
  };
  if (!pu.entrada) {
    escalera(pu.techo, pu.pie);
    hueco(pu.techo, false);
    // la tapa: abierta, colgando hacia arriba dentro del hueco (se ve de canto); cerrada, tapa el hueco
    c.save(); c.translate(x + 15, pu.techo); c.rotate(-Math.PI / 2 * a);
    caja(c, -30, -3, 30, 4, '#3e454b', sem + 1, 0.3, 1.6);
    c.restore();
  } else {
    hueco(pu.pie, true);
    escalera(pu.pie - 14 * a, pu.pie + 6);
    // la tapa se levanta sobre su bisagra (a la izquierda) hasta quedar de pie
    c.save(); c.translate(x - 15, pu.pie); c.rotate(-Math.PI / 2 * a);
    caja(c, 0, -4, 30, 4, '#3e454b', sem + 1, 0.3, 1.6);
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(k * 7.5, -4); c.lineTo(k * 7.5, 0); c.stroke(); }
    c.restore();
  }
}

// ---- trampilla de dos hojas. Salida: en el suelo, con franjas de aviso; al abrirse las hojas caen hacia
// abajo. Entrada: en el techo, sus hojas cuelgan abiertas
function trampilla(c, pu, a) {
  const x = pu.x, sem = Math.round(x), y = pu.entrada ? pu.techo : pu.pie, w = 40;
  // el hueco, oscuro, que se ve a medida que se abre
  if (a > 0.02) { c.fillStyle = '#040405'; c.fillRect(x - w / 2, pu.entrada ? y - 8 : y, w, 8); }
  for (const lado of [-1, 1]) {
    c.save(); c.translate(x + lado * w / 2, y); c.rotate(lado * Math.PI / 2 * a);
    const x0 = lado < 0 ? 0 : -w / 2;
    caja(c, x0, -2, w / 2, 4, '#4a5056', sem + lado, 0.2, 1.6);
    if (!pu.entrada) {
      c.save(); c.beginPath(); c.rect(x0 + 1, -1.5, w / 2 - 2, 3); c.clip();
      c.fillStyle = '#8f8350'; c.fillRect(x0, -2, w / 2, 4);
      c.strokeStyle = TINTA; c.lineWidth = 1.6; for (let k = -2; k < 8; k++) { c.beginPath(); c.moveTo(x0 + k * 4, -2); c.lineTo(x0 + k * 4 + 4, 2); c.stroke(); }
      c.restore();
    }
    c.restore();
  }
  // el marco y sus bisagras
  c.strokeStyle = TINTA; c.lineWidth = 1.6; c.strokeRect(x - w / 2 - 2, y - 2, w + 4, 4);
  for (const lado of [-1, 1]) { c.beginPath(); c.arc(x + lado * w / 2, y, 1.8, 0, 7); c.fillStyle = '#7a8086'; c.fill(); }
}

// reja de tijera: rombos que se pliegan hacia la izquierda al abrir
function reja(c, r, a, sem) {
  const w = r.w * (1 - 0.85 * a);
  if (w < 3) return;
  const n = 5, paso = w / n;
  c.strokeStyle = TINTA; c.lineWidth = 1.6;
  c.beginPath();
  for (let k = 0; k < n; k++) {
    const x0 = r.x + k * paso, x1 = x0 + paso;
    c.moveTo(x0, r.y + 4); c.lineTo(x1, r.y + r.h - 4); c.moveTo(x1, r.y + 4); c.lineTo(x0, r.y + r.h - 4);
  }
  c.stroke();
  c.strokeStyle = '#7a8189'; c.lineWidth = 0.7; c.stroke();
  for (let k = 0; k <= n; k++) { const x = r.x + k * paso; c.strokeStyle = TINTA; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x, r.y + 2); c.lineTo(x, r.y + r.h - 2); c.stroke(); }
  c.strokeStyle = TINTA; c.lineWidth = 2.4; c.beginPath(); c.moveTo(r.x, r.y + 3); c.lineTo(r.x + w, r.y + 3); c.moveTo(r.x, r.y + r.h - 3); c.lineTo(r.x + w, r.y + r.h - 3); c.stroke();
}

function remache(c, x, y) {
  c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fillStyle = '#6b737b'; c.fill();
  c.strokeStyle = TINTA; c.lineWidth = 0.8; c.stroke();
  c.beginPath(); c.arc(x - 0.5, y - 0.5, 0.5, 0, 7); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();
}

function piloto(c, x, y, col, t, k = 1) {
  c.save();
  c.beginPath(); c.arc(x, y, 3, 0, 7); c.fillStyle = col + '0.95)'; c.fill(); tinta(c, 1.2);
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, 16);
  g.addColorStop(0, col + (0.45 * k) + ')'); g.addColorStop(1, col + '0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, 16, 0, 7); c.fill();
  c.restore();
}
