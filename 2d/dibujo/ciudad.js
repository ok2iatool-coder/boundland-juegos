// Edificios del fondo de la ciudad: doce tipos para que el horizonte no sea una fila de cajas.
// Son siluetas planas del color de su capa (se pintan una vez y se desenfocan) con el detalle en un tono
// mas oscuro y otro mas claro del mismo color:
//   bloque (pisos con balcones), torre de oficinas (muro cortina con huecos de la explosion y antena),
//   ladrillo (cornisa, ventanas en arco, escalera de incendios, deposito en patas), iglesia (nave,
//   campanario con aguja, roseton), esqueleto (pilares y forjados al aire), inclinado (a punto de caer, con
//   cascotes al pie), fabrica (tejado en diente de sierra y chimeneas), cupula, grua torre, valla
//   publicitaria rota, paso elevado partido y deposito de agua; y casas adosadas, torre art deco, torre de
//   cristal arriostrada, aparcamiento, hotel con rotulo y mercado de boveda. El bloque elige uno de cinco
//   estilos de ventana y lleva bajos con toldos y persianas y azotea con trastos. Con { anomalia } (plaza
//   sin gravedad) a algunos se les va el techo a trozos; entre edificios de la capa media cuelgan cables.
import { mezclar, rgba } from './tinta.js';

const PESOS = {
  lejos: { bloque: 2.6, torre: 2, cristal: 1.3, artdeco: 1.1, hotel: 0.6, esqueleto: 1, iglesia: 0.5, cupula: 0.6, grua: 0.8, inclinado: 1, agua: 0.4 },
  medio: { bloque: 2.2, torre: 0.9, cristal: 1, artdeco: 0.8, casas: 1.4, aparcamiento: 0.8, hotel: 0.8, mercado: 0.6, ladrillo: 1.5,
    fabrica: 0.8, iglesia: 0.5, cupula: 0.4, esqueleto: 0.8, inclinado: 0.8, grua: 0.5, cartel: 0.6, agua: 0.4, puente: 0.4 },
};
// los que no tienen un techo que arrancar
const SIN_TECHO = new Set(['grua', 'cartel', 'puente', 'agua', 'esqueleto']);

function elegir(r, capa) {
  const p = PESOS[capa], total = Object.values(p).reduce((a, b) => a + b, 0);
  let x = r() * total;
  for (const [k, v] of Object.entries(p)) { x -= v; if (x <= 0) return k; }
  return 'bloque';
}

// una fila de edificios variados; devuelve nada, pinta en c. alto = altura de referencia (fraccion de H)
// opciones.anomalia: zona sin gravedad, a algunos edificios se les ha ido el techo y flota encima
export function horizonte(c, W, H, color, r, capa, escala = 1, opciones = {}) {
  const osc = mezclar(color, '#000000', 0.3), claro = mezclar(color, '#ffffff', 0.12);
  let x = -40 - r() * 60, previo = null;
  while (x < W) {
    const tipo = elegir(r, capa);
    const base = capa === 'lejos' ? 1 : 1.3;
    let w = (50 + r() * 70) * base * escala, h = H * (0.3 + r() * 0.42);
    if (tipo === 'torre') { w *= 0.8; h = H * (0.5 + r() * 0.35); }
    if (tipo === 'fabrica') { w *= 1.8; h = H * (0.15 + r() * 0.12); }
    if (tipo === 'iglesia') { w *= 1.3; h = H * (0.22 + r() * 0.1); }
    if (tipo === 'cupula') { h = H * (0.25 + r() * 0.15); }
    if (tipo === 'grua') { w = 30 * escala; h = H * (0.55 + r() * 0.25); }
    if (tipo === 'cartel') { w = 70 * escala; h = H * (0.18 + r() * 0.06); }
    if (tipo === 'puente') { w = (180 + r() * 120) * escala; h = H * (0.2 + r() * 0.1); }
    if (tipo === 'agua') { w = 34 * escala; h = H * (0.25 + r() * 0.1); }
    if (tipo === 'ladrillo') { h = H * (0.22 + r() * 0.2); }
    if (tipo === 'cristal') { w *= 0.75; h = H * (0.55 + r() * 0.35); }
    if (tipo === 'artdeco') { w *= 0.9; h = H * (0.5 + r() * 0.3); }
    if (tipo === 'hotel') { h = H * (0.4 + r() * 0.25); }
    if (tipo === 'casas') { w = (90 + r() * 80) * escala; h = H * (0.12 + r() * 0.08); }
    if (tipo === 'aparcamiento') { w *= 1.5; h = H * (0.14 + r() * 0.08); }
    if (tipo === 'mercado') { w *= 1.6; h = H * (0.12 + r() * 0.06); }
    const flota = opciones.anomalia && !SIN_TECHO.has(tipo) && r() < 0.38;
    const hd = flota ? h * (0.7 + r() * 0.15) : h;
    // cables que cuelgan de un edificio al siguiente
    if (previo && capa === 'medio' && r() < 0.35 && x - previo[0] < 160) {
      const y1 = H - hd + 10 + r() * 20;
      c.strokeStyle = color; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(previo[0], previo[1]); c.quadraticCurveTo((previo[0] + x) / 2, Math.max(previo[1], y1) + 18 + r() * 14, x, y1); c.stroke();
    }
    edificio(c, tipo, x, H, w, hd, color, osc, claro, r);
    if (flota) techoFlotando(c, x, H - hd, w, h - hd, color, osc, claro, r);
    if (!SIN_TECHO.has(tipo)) previo = [x + w, H - hd + 8 + r() * 16];
    x += (tipo === 'grua' || tipo === 'agua' || tipo === 'cartel' ? 20 : w * (0.6 + r() * 0.5)) + r() * 40 * escala;
  }
}

export function edificio(c, tipo, x, yb, w, h, color, osc, claro, r) {
  const F = EDIFICIOS[tipo] || EDIFICIOS.bloque;
  c.save(); F(c, x, yb, w, h, color, osc, claro, r); c.restore();
  // el bloque se lo pone el mismo (el inclinado lo dibuja girado)
  if (DESGASTE.has(tipo)) desgaste(c, x, yb, w, h, color, osc, claro, r);
}
// los que tienen fachada que ensuciar
const DESGASTE = new Set(['torre', 'ladrillo', 'cristal', 'artdeco', 'hotel', 'aparcamiento', 'fabrica', 'iglesia', 'cupula', 'mercado']);

const rejilla = (c, x0, y0, x1, y1, dx, dy, fn) => { for (let y = y0; y < y1; y += dy) for (let x = x0; x < x1; x += dx) fn(x, y); };

const EDIFICIOS = {
  bloque(c, x, yb, w, h, color, osc, claro, r) {
    // la caja de pisos, pero cada una con su fachada: cinco estilos de ventana, bajos comerciales y
    // azotea con trastos, o el techo roto
    const roto = r() < 0.4, techo = [];
    c.fillStyle = color; c.beginPath(); c.moveTo(x, yb); c.lineTo(x, yb - h);
    if (roto) {
      const n = 4 + Math.floor(r() * 4);
      for (let k = 1; k <= n; k++) { const p = [x + (w * k) / n, yb - h + (r() - 0.3) * h * 0.22 * (k % 2 ? 1 : 0.4)]; techo.push(p); c.lineTo(p[0], p[1]); }
    } else c.lineTo(x + w, yb - h);
    c.lineTo(x + w, yb); c.closePath(); c.fill();
    if (!roto) { c.fillRect(x - 2, yb - h - 3, w + 4, 3); c.fillStyle = osc; c.fillRect(x - 2, yb - h, w + 4, 1); }
    ventanas(c, x, yb - h + (roto ? h * 0.18 : 10), w, yb - 24, ESTILOS[Math.floor(r() * ESTILOS.length)], color, osc, claro, r);
    bajos(c, x, yb, w, color, osc, claro, r);
    if (!roto) azotea(c, x, w, yb - h - 3, color, osc, r);
    desgaste(c, x, yb, w, h, color, osc, claro, r);
    if (roto) entranas(c, x, yb - h, w, techo, color, osc, claro, r);
    enredaderas(c, x, yb, w, h, osc, r);
  },
  torre(c, x, yb, w, h, color, osc, claro, r) {
    // escalonada arriba (retranqueos), muro cortina, un boquete y la antena
    const pasos = 1 + Math.floor(r() * 3);
    c.fillStyle = color;
    c.fillRect(x, yb - h * 0.75, w, h * 0.75);
    let ww = w, xx = x, top = yb - h * 0.75;
    const cuerpos = [[x, yb - h * 0.75, w, h * 0.75]];
    for (let k = 0; k < pasos; k++) { const nw = ww * (0.65 + r() * 0.2); xx += (ww - nw) / 2; ww = nw; const ht = (h * 0.25) / pasos; c.fillRect(xx, top - ht, ww, ht); top -= ht; cuerpos.push([xx, top, ww, ht]); }
    c.fillRect(xx + ww / 2 - 1, top - h * 0.12, 2, h * 0.12);
    // muro cortina en todos los cuerpos, con el canto claro de cada retranqueo
    for (const [cx0, cy0, cw, ch] of cuerpos) {
      c.fillStyle = osc;
      for (let mx = cx0 + 5; mx < cx0 + cw - 2; mx += 6) c.fillRect(mx, cy0 + 3, 1, ch - 3);
      for (let my = cy0 + 8; my < cy0 + ch; my += 9) c.fillRect(cx0, my, cw, 1);
      c.fillStyle = claro; c.fillRect(cx0 - 1, cy0, cw + 2, 1.4);
      c.fillStyle = osc;
    }
    // boquete: paneles que faltan en una mancha
    const bx = x + r() * w * 0.6, by = yb - h * (0.3 + r() * 0.4);
    for (let k = 0; k < 14; k++) c.fillRect(bx + (r() - 0.3) * 20, by + (r() - 0.5) * 24, 5, 8);
    c.fillStyle = claro; c.fillRect(x, yb - h * 0.75, 2, h * 0.75);
  },
  ladrillo(c, x, yb, w, h, color, osc, claro, r) {
    c.fillStyle = color; c.fillRect(x, yb - h, w, h);
    c.fillRect(x - 3, yb - h - 4, w + 6, 5);                         // cornisa
    c.fillStyle = osc; c.fillRect(x - 3, yb - h + 1, w + 6, 1.2);
    rejilla(c, x + 7, yb - h + 14, x + w - 8, yb - 12, 13, 20, (xx, yy) => {
      if (r() < 0.15) return;
      c.fillStyle = osc; c.fillRect(xx, yy + 3, 7, 9); c.beginPath(); c.arc(xx + 3.5, yy + 3, 3.5, Math.PI, 0); c.fill();
    });
    // escalera de incendios en zigzag por un costado
    const ex = r() < 0.5 ? x + 4 : x + w - 22;
    c.strokeStyle = osc; c.lineWidth = 1;
    for (let yy = yb - h + 20, k = 0; yy < yb - 10; yy += 20, k++) {
      c.fillRect(ex, yy + 12, 18, 1.4);
      c.beginPath(); if (k % 2) { c.moveTo(ex + 2, yy + 12); c.lineTo(ex + 16, yy + 32); } else { c.moveTo(ex + 16, yy + 12); c.lineTo(ex + 2, yy + 32); } c.stroke();
      c.beginPath(); c.moveTo(ex, yy + 7); c.lineTo(ex + 18, yy + 7); c.stroke();
    }
    // deposito de agua en patas
    if (r() < 0.6) {
      const tx = x + w * (0.3 + r() * 0.4);
      c.fillStyle = color; c.fillRect(tx - 7, yb - h - 18, 14, 11);
      c.beginPath(); c.moveTo(tx - 8, yb - h - 18); c.lineTo(tx, yb - h - 25); c.lineTo(tx + 8, yb - h - 18); c.fill();
      c.fillRect(tx - 6, yb - h - 7, 1.5, 7); c.fillRect(tx + 4.5, yb - h - 7, 1.5, 7);
    }
  },
  iglesia(c, x, yb, w, h, color, osc, claro, r) {
    const nave = w * 0.62, tw = w * 0.22, tx = r() < 0.5 ? x : x + w - tw;
    const nx = tx === x ? x + tw : x;
    c.fillStyle = color;
    c.fillRect(nx, yb - h, nave, h);
    c.beginPath(); c.moveTo(nx - 4, yb - h); c.lineTo(nx + nave / 2, yb - h - h * 0.35); c.lineTo(nx + nave + 4, yb - h); c.fill();
    c.fillRect(tx, yb - h * 1.9, tw, h * 1.9);
    c.beginPath(); c.moveTo(tx - 2, yb - h * 1.9); c.lineTo(tx + tw / 2, yb - h * 1.9 - h * 0.9); c.lineTo(tx + tw + 2, yb - h * 1.9); c.fill();
    c.fillRect(tx + tw / 2 - 0.8, yb - h * 2.95, 1.6, h * 0.18); c.fillRect(tx + tw / 2 - 4, yb - h * 2.88, 8, 1.6);
    c.fillStyle = osc;
    c.beginPath(); c.arc(nx + nave / 2, yb - h * 0.7, Math.min(10, nave * 0.12), 0, 7); c.fill();
    c.fillStyle = color; c.fillRect(nx + nave / 2 - 0.6, yb - h * 0.7 - 10, 1.2, 20); c.fillRect(nx + nave / 2 - 10, yb - h * 0.7 - 0.6, 20, 1.2);
    c.fillStyle = osc;
    for (let k = 0; k < 4; k++) { const wx = nx + 8 + k * (nave - 16) / 4; c.fillRect(wx, yb - h * 0.45, 5, 14); c.beginPath(); c.arc(wx + 2.5, yb - h * 0.45, 2.5, Math.PI, 0); c.fill(); }
    c.fillRect(tx + tw / 2 - 4, yb - h * 1.65, 8, 12); c.beginPath(); c.arc(tx + tw / 2, yb - h * 1.65, 4, Math.PI, 0); c.fill();
    // contrafuertes
    c.fillStyle = color; for (let k = 0; k <= 3; k++) { const bx = nx + (k * nave) / 3 - 2; c.beginPath(); c.moveTo(bx, yb); c.lineTo(bx, yb - h * 0.6); c.lineTo(bx + 5, yb - h * 0.45); c.lineTo(bx + 5, yb); c.fill(); }
  },
  esqueleto(c, x, yb, w, h, color, osc, claro, r) {
    c.fillStyle = color;
    const pisos = Math.max(3, Math.floor(h / 18)), cols = Math.max(2, Math.floor(w / 22));
    const alto = pisos - Math.floor(r() * 2);
    for (let k = 0; k <= cols; k++) { const px = x + (k * w) / cols - 2; const ph = (alto - (k % 2 && r() < 0.4 ? 1 : 0)) * 18; c.fillRect(px, yb - ph, 4, ph); }
    for (let p = 1; p <= alto; p++) { const y = yb - p * 18; const roto = r() < 0.3 ? w * r() * 0.5 : 0; c.fillRect(x + roto, y, w - roto, 3); }
    // algun muro que queda y una losa colgando
    for (let k = 0; k < 4; k++) { const px = x + r() * (w - 20), p = 1 + Math.floor(r() * (alto - 1)); c.fillRect(px, yb - p * 18, 18, 15); }
    c.save(); c.translate(x + w, yb - alto * 18 + 1); c.rotate(0.6 + r() * 0.4); c.fillRect(0, 0, 26, 3); c.restore();
    c.strokeStyle = color; c.lineWidth = 0.8; for (let k = 0; k < 5; k++) { const px = x + r() * w; c.beginPath(); c.moveTo(px, yb - alto * 18); c.lineTo(px + (r() - 0.5) * 4, yb - alto * 18 - 6 - r() * 6); c.stroke(); }
  },
  inclinado(c, x, yb, w, h, color, osc, claro, r) {
    // gira sobre la esquina de abajo que aguanta
    const izq = r() < 0.5, px = izq ? x : x + w;
    c.save(); c.translate(px, yb); c.rotate((izq ? 1 : -1) * (0.06 + r() * 0.08));
    EDIFICIOS.bloque(c, x - px, 0, w, h, color, osc, claro, r);
    c.restore();
    // cascotes al pie
    c.fillStyle = color; c.beginPath(); c.moveTo(x - 20, yb); c.quadraticCurveTo(x + w / 2, yb - 26, x + w + 24, yb); c.fill();
  },
  fabrica(c, x, yb, w, h, color, osc, claro, r) {
    c.fillStyle = color; c.fillRect(x, yb - h, w, h);
    const dientes = Math.max(3, Math.floor(w / 22));
    c.beginPath(); c.moveTo(x, yb - h);
    for (let k = 0; k < dientes; k++) { const a = x + (k * w) / dientes, b = x + ((k + 1) * w) / dientes; c.lineTo(a, yb - h - 14); c.lineTo(b, yb - h); }
    c.lineTo(x + w, yb - h + 1); c.lineTo(x, yb - h + 1); c.fill();
    c.fillStyle = osc; for (let k = 0; k < dientes; k++) c.fillRect(x + (k * w) / dientes + 1, yb - h - 12, 2, 11);
    rejilla(c, x + 6, yb - h + 8, x + w - 8, yb - 8, 10, 14, (xx, yy) => { if (r() < 0.7) c.fillRect(xx, yy, 6, 8); });
    c.fillStyle = color;
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const cx = x + w * (0.15 + r() * 0.7), ch = h * (1.6 + r() * 1.4);
      c.beginPath(); c.moveTo(cx - 6, yb - h); c.lineTo(cx - 4, yb - h - ch); c.lineTo(cx + 4, yb - h - ch); c.lineTo(cx + 6, yb - h); c.fill();
      c.fillStyle = osc; c.fillRect(cx - 5, yb - h - ch * 0.8, 10, 2); c.fillRect(cx - 4.5, yb - h - ch * 0.95, 9, 2); c.fillStyle = color;
    }
  },
  cupula(c, x, yb, w, h, color, osc, claro, r) {
    c.fillStyle = color; c.fillRect(x, yb - h, w, h);
    c.fillRect(x + w * 0.15, yb - h - 8, w * 0.7, 8);
    c.beginPath(); c.ellipse(x + w / 2, yb - h - 8, w * 0.32, w * 0.3, 0, Math.PI, 0); c.fill();
    c.fillRect(x + w / 2 - 3, yb - h - 8 - w * 0.3 - 8, 6, 8); c.fillRect(x + w / 2 - 0.6, yb - h - 8 - w * 0.3 - 16, 1.2, 8);
    c.fillStyle = osc;
    for (let k = 0; k < 6; k++) { const cx = x + w * 0.2 + (k * w * 0.6) / 5; c.fillRect(cx - 1.5, yb - h * 0.95, 3, h * 0.55); }
    // la cupula rota: un hueco
    if (r() < 0.6) { c.beginPath(); c.ellipse(x + w * (0.4 + r() * 0.2), yb - h - 8 - w * 0.18, w * 0.08, w * 0.06, 0, 0, 7); c.fill(); }
  },
  grua(c, x, yb, w, h, color, osc, claro, r) {
    // grua torre: lastre, mastil en celosia, cabina, pluma triangular con tirantes a la torreta,
    // contrapluma con sus contrapesos, carro, gancho de dos ramales y a veces una viga colgando
    c.strokeStyle = color; c.fillStyle = color;
    const m = 8, top = yb - h, cx = x + m / 2;
    c.fillRect(x - 8, yb - 6, m + 16, 6);
    c.fillStyle = osc; c.fillRect(x - 7, yb - 4, m + 14, 0.8); c.fillRect(x - 1, yb - 6, 0.8, 6); c.fillRect(x + m + 0.2, yb - 6, 0.8, 6);
    c.fillStyle = color;
    c.fillRect(x, top, 1.4, h); c.fillRect(x + m - 1.4, top, 1.4, h);
    c.lineWidth = 0.7; c.beginPath();
    for (let y = top; y < yb - 6; y += m) { c.moveTo(x, y); c.lineTo(x + m, y + m / 2); c.lineTo(x, y + m); c.moveTo(x, y); c.lineTo(x + m, y); }
    c.stroke();
    const lado = r() < 0.5 ? 1 : -1, pluma = 90 + r() * 70, contra = 34, fin = cx + lado * pluma, fc = cx - lado * contra;
    // cabina
    const cbx = lado > 0 ? x + m : x - 9;
    c.fillRect(cbx, top + 1, 9, 9);
    c.fillStyle = osc; c.fillRect(cbx + 1.8, top + 3, 5.4, 4);
    c.fillStyle = claro; c.fillRect(cbx + 1.8, top + 3, 5.4, 0.8); c.fillRect(cbx, top + 10, 9, 0.8);
    c.fillStyle = color;
    // pluma
    c.lineWidth = 1.1; c.beginPath(); c.moveTo(cx, top); c.lineTo(fin, top); c.moveTo(cx, top - 7); c.lineTo(fin, top - 3); c.stroke();
    c.lineWidth = 0.6; c.beginPath();
    for (let k = 0; k + 6 <= pluma; k += 6) { const hk = 7 - (4 * (k + 3)) / pluma; c.moveTo(cx + lado * k, top); c.lineTo(cx + lado * (k + 3), top - hk); c.lineTo(cx + lado * (k + 6), top); }
    c.stroke();
    // contrapluma y contrapesos
    c.lineWidth = 1.1; c.beginPath(); c.moveTo(cx, top); c.lineTo(fc, top); c.moveTo(cx, top - 4); c.lineTo(fc, top - 3); c.stroke();
    const bx0 = Math.min(fc, fc + lado * 16);
    for (let k = 0; k < 3; k++) { c.fillRect(bx0 + k * 5.4, top + 1, 4.8, 10 - k * 1.5); c.fillStyle = osc; c.fillRect(bx0 + k * 5.4, top + 5, 4.8, 0.6); c.fillStyle = color; }
    // torreta y tirantes
    const pt = top - 22;
    c.lineWidth = 1.1; c.beginPath(); c.moveTo(cx - 3.5, top - 7); c.lineTo(cx, pt); c.lineTo(cx + 3.5, top - 7); c.moveTo(cx - 2, top - 14); c.lineTo(cx + 2, top - 14); c.stroke();
    c.lineWidth = 0.6; c.beginPath(); c.moveTo(cx, pt); c.lineTo(cx + lado * pluma * 0.62, top - 5); c.moveTo(cx, pt); c.lineTo(fc, top - 3); c.stroke();
    // carro, cable de dos ramales y gancho
    const gx = cx + lado * pluma * (0.45 + r() * 0.45), cable = 30 + r() * h * 0.4;
    c.fillRect(gx - 3.5, top + 0.5, 7, 2.5);
    c.lineWidth = 0.5; c.beginPath(); c.moveTo(gx - 1.3, top + 3); c.lineTo(gx - 1.3, top + cable); c.moveTo(gx + 1.3, top + 3); c.lineTo(gx + 1.3, top + cable); c.stroke();
    c.fillRect(gx - 3, top + cable, 6, 5);
    c.fillStyle = osc; c.beginPath(); c.arc(gx, top + cable + 2.5, 1.2, 0, 7); c.fill(); c.fillStyle = color;
    c.lineWidth = 1.1; c.beginPath(); c.arc(gx, top + cable + 8, 2.6, -Math.PI * 0.1, Math.PI * 1.15); c.stroke();
    if (r() < 0.5) {
      const vy = top + cable + 18, inc = (r() - 0.5) * 0.3;
      c.lineWidth = 0.5; c.beginPath(); c.moveTo(gx, top + cable + 10); c.lineTo(gx - 11, vy - inc * 11); c.moveTo(gx, top + cable + 10); c.lineTo(gx + 11, vy + inc * 11); c.stroke();
      c.save(); c.translate(gx, vy); c.rotate(inc);
      c.fillRect(-17, 0, 34, 3.2); c.fillStyle = osc; c.fillRect(-17, 1.3, 34, 0.6); c.restore();
    }
  },
  cartel(c, x, yb, w, h, color, osc, claro, r) {
    c.fillStyle = color;
    c.fillRect(x + w * 0.2, yb - h, 3, h); c.fillRect(x + w * 0.75, yb - h, 3, h);
    c.fillRect(x, yb - h - 34, w, 34);
    c.fillStyle = osc;
    for (let k = 0; k < 6; k++) if (r() < 0.6) c.fillRect(x + 3 + k * (w - 6) / 6, yb - h - 31, (w - 6) / 6 - 2, 28 - r() * 14);
    c.fillStyle = color; c.fillRect(x - 2, yb - h - 3, w + 4, 3);
  },
  puente(c, x, yb, w, h, color, osc, claro, r) {
    const roto = r() < 0.7;
    const fin = roto ? x + w * (0.7 + r() * 0.2) : x + w;
    c.fillStyle = color;
    c.fillRect(x, yb - h, fin - x, 10); c.fillRect(x, yb - h - 4, fin - x, 2);
    for (let px = x + 30; px < fin - 10; px += 70) { c.fillRect(px, yb - h + 10, 10, h - 10); c.fillRect(px - 5, yb - h + 10, 20, 4); }
    if (roto) {
      c.beginPath(); c.moveTo(fin, yb - h); c.lineTo(fin + 8, yb - h + 6); c.lineTo(fin + 2, yb - h + 10); c.lineTo(fin - 4, yb - h + 10); c.fill();
      c.strokeStyle = color; c.lineWidth = 0.8; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(fin, yb - h + 2 + k * 2); c.quadraticCurveTo(fin + 8, yb - h + 6 + k * 3, fin + 4 + r() * 6, yb - h + 14 + r() * 16); c.stroke(); }
      // el trozo caido
      c.save(); c.translate(fin + 30, yb); c.rotate(-0.9); c.fillRect(0, -10, 60, 10); c.restore();
    }
    c.fillStyle = osc; c.fillRect(x, yb - h + 8, fin - x, 2);
  },
  agua(c, x, yb, w, h, color, osc, claro, r) {
    c.fillStyle = color; c.strokeStyle = color; c.lineWidth = 1.2;
    const tanque = 26, top = yb - h;
    c.beginPath(); c.ellipse(x + w / 2, top + tanque / 2, w / 2, tanque / 2, 0, 0, 7); c.fill();
    c.beginPath(); c.moveTo(x + 2, top + 4); c.lineTo(x + w / 2, top - 8); c.lineTo(x + w - 2, top + 4); c.fill();
    for (const lx of [x + 4, x + w - 4]) { c.beginPath(); c.moveTo(lx, top + tanque - 4); c.lineTo(lx + (lx < x + w / 2 ? -6 : 6), yb); c.stroke(); }
    for (let y = top + tanque; y < yb - 6; y += 16) { c.beginPath(); c.moveTo(x + 2, y); c.lineTo(x + w - 2, y + 14); c.moveTo(x + w - 2, y); c.lineTo(x + 2, y + 14); c.stroke(); }
    c.fillStyle = osc; c.fillRect(x + 4, top + tanque / 2, w - 8, 1.2);
  },
  casas(c, x, yb, w, h, color, osc, claro, r) {
    // adosados estrechos, cada uno de su altura: tejado a dos aguas o plano con buhardilla, chimenea
    let cx = x;
    while (cx < x + w - 12) {
      const cw = Math.min(x + w - cx, 22 + r() * 18), ch = h * (0.75 + r() * 0.5);
      c.fillStyle = color; c.fillRect(cx, yb - ch, cw, ch);
      if (r() < 0.65) {
        const alto = cw * (0.35 + r() * 0.25);
        c.beginPath(); c.moveTo(cx - 2, yb - ch); c.lineTo(cx + cw / 2, yb - ch - alto); c.lineTo(cx + cw + 2, yb - ch); c.fill();
        if (r() < 0.3) { c.fillStyle = osc; c.beginPath(); c.moveTo(cx + cw * 0.3, yb - ch); c.lineTo(cx + cw * 0.5, yb - ch - alto * 0.6); c.lineTo(cx + cw * 0.62, yb - ch); c.fill(); c.fillStyle = color; }
      } else {
        c.fillRect(cx - 1, yb - ch - 3, cw + 2, 3);
        c.fillRect(cx + cw * 0.3, yb - ch - 9, cw * 0.35, 7);
        c.fillStyle = osc; c.fillRect(cx + cw * 0.38, yb - ch - 7, cw * 0.18, 4); c.fillStyle = color;
      }
      if (r() < 0.6) c.fillRect(cx + cw * (0.15 + r() * 0.6), yb - ch - cw * 0.5, 4, cw * 0.4);
      for (let yy = yb - ch + 6; yy < yb - 14; yy += 13) for (const fx of [0.22, 0.6]) if (r() < 0.85) ventana(c, cx + cw * fx, yy, 5, 8, color, osc, claro, r);
      c.fillStyle = osc; c.fillRect(cx + cw * 0.38, yb - 11, 6, 11);
      c.fillStyle = claro; c.fillRect(cx + cw * 0.38 - 1, yb - 12, 8, 1); c.fillRect(cx + cw * 0.38 - 1.5, yb - 1, 9, 1);
      c.fillStyle = claro; c.fillRect(cx, yb - ch, 1, ch);
      cx += cw;
    }
  },
  artdeco(c, x, yb, w, h, color, osc, claro, r) {
    // escalonada en tres cuerpos, pilastras verticales, corona y aguja
    const cuerpos = [[0, 0.55, 1], [0.55, 0.2, 0.74], [0.75, 0.12, 0.5]];
    for (const [desde, alto, ancho] of cuerpos) {
      const ww = w * ancho, xx = x + (w - ww) / 2, y0 = yb - h * (desde + alto);
      c.fillStyle = color; c.fillRect(xx, y0, ww, h * alto + 1);
      c.fillStyle = osc; for (let px = xx + 4; px < xx + ww - 3; px += 6) c.fillRect(px, y0 + 4, 1.4, h * alto - 6);
      c.fillStyle = claro; c.fillRect(xx, y0, ww, 1.4);
    }
    const cx = x + w / 2, top = yb - h * 0.87;
    c.fillStyle = color;
    c.beginPath(); c.moveTo(cx - w * 0.22, top); c.lineTo(cx - w * 0.14, top - h * 0.05); c.lineTo(cx - w * 0.06, top - h * 0.08); c.lineTo(cx, top - h * 0.13);
    c.lineTo(cx + w * 0.06, top - h * 0.08); c.lineTo(cx + w * 0.14, top - h * 0.05); c.lineTo(cx + w * 0.22, top); c.fill();
    c.fillRect(cx - 0.8, top - h * 0.26, 1.6, h * 0.14);
    c.fillStyle = osc; for (let k = 0; k < 3; k++) c.fillRect(cx - w * 0.04 + k * w * 0.04 - 1, top - h * 0.06, 2, h * 0.05);
  },
  cristal(c, x, yb, w, h, color, osc, claro, r) {
    // torre de cristal cortada en bisel, arriostrada en X, con paneles rotos
    const sube = r() < 0.5;
    c.fillStyle = color;
    c.beginPath(); c.moveTo(x, yb); c.lineTo(x, yb - h * (sube ? 0.86 : 1)); c.lineTo(x + w, yb - h * (sube ? 1 : 0.86)); c.lineTo(x + w, yb); c.closePath(); c.fill();
    c.save(); c.clip();
    c.fillStyle = osc;
    for (let px = x + 3; px < x + w; px += 6) c.fillRect(px, yb - h, 0.8, h);
    for (let py = yb - h; py < yb; py += 8) c.fillRect(x, py, w, 0.8);
    c.strokeStyle = osc; c.lineWidth = 1.6;
    const tramo = h / 3;
    for (let k = 0; k < 3; k++) { const y0 = yb - (k + 1) * tramo, y1 = yb - k * tramo; c.beginPath(); c.moveTo(x, y0); c.lineTo(x + w, y1); c.moveTo(x + w, y0); c.lineTo(x, y1); c.stroke(); }
    for (let k = 0; k < 18; k++) { c.fillStyle = r() < 0.6 ? osc : claro; c.fillRect(x + r() * w, yb - h * (0.2 + r() * 0.7), 5, 7); }
    c.restore();
    c.fillStyle = claro; c.fillRect(sube ? x + w - 2 : x, yb - h, 2, h);
  },
  aparcamiento(c, x, yb, w, h, color, osc, claro, r) {
    // plantas abiertas con pilares, rampa en diagonal, coches aparcados y la senal de la P
    c.fillStyle = color; c.fillRect(x, yb - h, w, h);
    for (let y = yb - h + 4; y < yb - 4; y += 13) {
      c.fillStyle = osc; c.fillRect(x + 3, y, w - 6, 7);
      c.fillStyle = color;
      for (let px = x + 3; px < x + w - 3; px += 22) c.fillRect(px, y, 3, 7);
      for (let k = 0; k < 4; k++) if (r() < 0.45) { const cx = x + 8 + r() * (w - 24); c.fillRect(cx, y + 3.5, 10, 3.5); c.fillRect(cx + 2, y + 2, 6, 2); }
    }
    c.strokeStyle = claro; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + w * 0.62, yb - 4); c.lineTo(x + w - 6, yb - h + 6); c.stroke();
    c.fillStyle = color; c.fillRect(x + w - 12, yb - h - 16, 10, 16);
    c.fillStyle = claro; c.beginPath(); c.arc(x + w - 7, yb - h - 11, 3.4, 0, 7); c.fill();
    c.fillStyle = osc; c.fillRect(x + w - 8, yb - h - 13.5, 1.4, 5); c.fillRect(x + w - 8, yb - h - 13.5, 2.8, 2.6);
  },
  hotel(c, x, yb, w, h, color, osc, claro, r) {
    // ventanas regulares con balcon, rotulo vertical al que le faltan letras y mastil arriba
    c.fillStyle = color; c.fillRect(x, yb - h, w, h); c.fillRect(x - 3, yb - h - 5, w + 6, 5);
    ventanas(c, x, yb - h + 10, w, yb - 24, 'balcones', color, osc, claro, r);
    bajos(c, x, yb, w, color, osc, claro, r);
    const izq = r() < 0.5, lado = izq ? x - 9 : x + w + 1, sy = yb - h + 12, letras = 5;
    c.fillStyle = color; c.fillRect(lado, sy, 8, letras * 11 + 6);
    c.fillRect(izq ? lado + 8 : x + w - 2, sy + 4, 3, 2); c.fillRect(izq ? lado + 8 : x + w - 2, sy + letras * 11, 3, 2);
    for (let k = 0; k < letras; k++) if (r() < 0.75) { c.fillStyle = r() < 0.3 ? osc : claro; c.fillRect(lado + 2, sy + 4 + k * 11, 4, 8); }
    c.fillStyle = color; c.fillRect(x + w / 2 - 0.7, yb - h - 24, 1.4, 20);
    c.beginPath(); c.moveTo(x + w / 2 + 0.7, yb - h - 24); c.lineTo(x + w / 2 + 10, yb - h - 21); c.lineTo(x + w / 2 + 0.7, yb - h - 18); c.fill();
  },
  mercado(c, x, yb, w, h, color, osc, claro, r) {
    // nave de mercado: boveda con costillas, banda de ventanas y entradas en arco
    c.fillStyle = color; c.fillRect(x, yb - h, w, h);
    c.beginPath(); c.ellipse(x + w / 2, yb - h, w / 2, h * 0.75, 0, Math.PI, 0); c.fill();
    c.strokeStyle = osc; c.lineWidth = 1;
    for (let k = 1; k < 6; k++) { const f = k / 6; c.beginPath(); c.ellipse(x + w / 2, yb - h, (w / 2) * Math.abs(1 - 2 * f) + 0.01, h * 0.75, 0, Math.PI, 0); c.stroke(); }
    if (r() < 0.6) { c.fillStyle = osc; c.beginPath(); c.ellipse(x + w * (0.3 + r() * 0.4), yb - h - h * 0.45, w * 0.07, h * 0.12, 0, 0, 7); c.fill(); }
    c.fillStyle = osc;
    for (let px = x + 6; px < x + w - 8; px += 10) c.fillRect(px, yb - h + 4, 6, 5);
    for (let k = 0; k < 3; k++) { const ax = x + w * (0.2 + k * 0.3); c.fillRect(ax - 6, yb - h * 0.55, 12, h * 0.55); c.beginPath(); c.arc(ax, yb - h * 0.55, 6, Math.PI, 0); c.fill(); }
  },
};

// ---------------------------------------------------------------- piezas comunes
const ESTILOS = ['rejilla', 'bandas', 'pares', 'balcones', 'tiras'];

// ventanas entre y0 (arriba) e y1 (abajo) en uno de cinco estilos
function ventanas(c, x, y0, w, y1, estilo, color, osc, claro, r) {
  const planta = 16;
  if (estilo === 'rejilla' || estilo === 'pares' || estilo === 'balcones') {
    // canto del forjado de cada planta, con su sombra
    for (let yy = y0 + 4; yy < y1; yy += planta) {
      c.fillStyle = claro; c.fillRect(x, yy - 4, w, 0.9);
      c.fillStyle = rgba(osc, 0.28); c.fillRect(x, yy - 3.1, w, 1.4);
    }
  }
  if (estilo === 'rejilla') {
    rejilla(c, x + 6, y0 + 4, x + w - 8, y1, 12, planta, (xx, yy) => { if (r() < 0.78) ventana(c, xx, yy, 6, 9, color, osc, claro, r); });
  } else if (estilo === 'bandas') {
    for (let yy = y0 + 4; yy < y1; yy += planta) {
      c.fillStyle = osc; c.fillRect(x + 4, yy, w - 8, 6);
      c.fillStyle = color; for (let px = x + 4 + r() * 20; px < x + w - 8; px += 18 + r() * 20) c.fillRect(px, yy, 2, 6);
      if (r() < 0.25) { c.fillStyle = claro; c.fillRect(x + 4 + r() * (w - 20), yy, 10, 6); }
    }
  } else if (estilo === 'pares') {
    rejilla(c, x + 6, y0 + 4, x + w - 14, y1, 20, planta, (xx, yy) => {
      if (r() < 0.12) return;
      ventana(c, xx, yy, 5, 9, color, osc, claro, r); ventana(c, xx + 7, yy, 5, 9, color, osc, claro, r);
      c.fillStyle = claro; c.fillRect(xx - 1, yy + 9, 14, 1.2);
    });
  } else if (estilo === 'balcones') {
    rejilla(c, x + 6, y0 + 4, x + w - 10, y1, 14, planta, (xx, yy) => {
      ventana(c, xx, yy, 6, 10, color, osc, claro, r);
      if (r() < 0.6) {
        // balcon: losa, barandilla de barrotes y a veces una maceta o ropa tendida
        c.fillStyle = claro; c.fillRect(xx - 2, yy + 10, 10, 1.3);
        c.fillStyle = rgba(osc, 0.4); c.fillRect(xx - 2, yy + 11.3, 10, 0.8);
        c.fillStyle = osc; c.fillRect(xx - 2, yy + 5.6, 10, 0.6); for (let b = 0; b < 5; b++) c.fillRect(xx - 2 + b * 2.4, yy + 6, 0.6, 4);
        const q = r();
        if (q < 0.25) { c.fillStyle = color; c.fillRect(xx - 1, yy + 7, 2.4, 3); c.beginPath(); c.arc(xx + 0.2, yy + 6, 2, 0, 7); c.fill(); }
        else if (q < 0.4) { c.fillStyle = rgba(claro, 0.8); c.fillRect(xx, yy + 6.2, 2, 3.5); c.fillRect(xx + 3, yy + 6.2, 2.4, 2.6); }
      }
    });
  } else {
    // tiras verticales de ventanas, cortadas a trozos
    for (let px = x + 5; px < x + w - 6; px += 9) {
      let yy = y0 + 4;
      while (yy < y1) { const largo = 20 + r() * 60; c.fillStyle = osc; c.fillRect(px, yy, 4, Math.min(largo, y1 - yy)); yy += largo + 4 + r() * 10; }
    }
  }
}

// planta baja: escaparates, persianas a medio bajar y toldos rotos
function bajos(c, x, yb, w, color, osc, claro, r) {
  let px = x + 3;
  c.fillStyle = color; c.fillRect(x, yb - 22, w, 2);
  while (px < x + w - 12) {
    const lw = Math.min(x + w - 3 - px, 14 + r() * 14);
    c.fillStyle = osc; c.fillRect(px, yb - 17, lw - 3, 17);
    if (r() < 0.45) {
      c.fillStyle = color; const baja = 4 + r() * 10; c.fillRect(px, yb - 17, lw - 3, baja);
      c.fillStyle = osc; for (let k = 2; k < baja; k += 2.5) c.fillRect(px, yb - 17 + k, lw - 3, 0.6);
    }
    if (r() < 0.4) {
      c.fillStyle = r() < 0.5 ? claro : color;
      c.beginPath(); c.moveTo(px - 1, yb - 19); c.lineTo(px + lw - 2, yb - 19); c.lineTo(px + lw + 1, yb - 13 + (r() < 0.3 ? 4 : 0)); c.lineTo(px - 3, yb - 13); c.fill();
    }
    px += lw;
  }
}

// trastos de la azotea: deposito, maquinas de aire, antena, parabolica o un arbol que ha crecido
function azotea(c, x, w, top, color, osc, r) {
  const n = 1 + Math.floor(r() * 3);
  c.strokeStyle = color; c.lineWidth = 1;
  for (let k = 0; k < n; k++) {
    const px = x + 6 + r() * (w - 16), q = r();
    c.fillStyle = color;
    if (q < 0.22) {
      c.fillRect(px - 6, top - 14, 12, 9);
      c.beginPath(); c.moveTo(px - 7, top - 14); c.lineTo(px, top - 19); c.lineTo(px + 7, top - 14); c.fill();
      c.fillRect(px - 5, top - 5, 1.4, 5); c.fillRect(px + 3.6, top - 5, 1.4, 5);
    } else if (q < 0.45) {
      c.fillRect(px, top - 6, 9, 6); c.fillRect(px + 10, top - 4, 6, 4);
      c.fillStyle = osc; c.beginPath(); c.arc(px + 4.5, top - 3, 2, 0, 7); c.fill();
    } else if (q < 0.65) {
      c.beginPath(); c.moveTo(px, top); c.lineTo(px, top - 22); c.moveTo(px - 4, top - 16); c.lineTo(px + 4, top - 16); c.moveTo(px - 3, top - 11); c.lineTo(px + 3, top - 11); c.stroke();
    } else if (q < 0.8) {
      c.save(); c.translate(px, top - 6); c.rotate(-0.5); c.beginPath(); c.ellipse(0, 0, 6, 3, 0, 0, Math.PI); c.fill(); c.restore();
      c.fillRect(px - 0.7, top - 6, 1.4, 6);
    } else {
      c.fillRect(px - 0.8, top - 10, 1.6, 10);
      for (let b = 0; b < 4; b++) { c.beginPath(); c.arc(px + (r() - 0.5) * 12, top - 12 - r() * 8, 4 + r() * 4, 0, 7); c.fill(); }
    }
  }
}

// una ventana con su hueco, carpinteria, dintel en sombra y alfeizar; cada una a su manera: cristal roto,
// tapiada con tablas, persiana a medio bajar, cortina o reflejo; chorreon bajo el alfeizar y a veces un
// aparato de aire colgado
function ventana(c, x, y, w, h, color, osc, claro, r) {
  const k = r();
  c.fillStyle = osc; c.fillRect(x, y, w, h);
  if (k < 0.13) {
    c.fillStyle = rgba(claro, 0.9);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.65, y); c.lineTo(x + w * 0.2, y + h * 0.3); c.lineTo(x, y + h * 0.55); c.fill();
    c.beginPath(); c.moveTo(x + w, y + h); c.lineTo(x + w, y + h * 0.55); c.lineTo(x + w * 0.7, y + h * 0.8); c.lineTo(x + w * 0.45, y + h); c.fill();
  } else if (k < 0.21) {
    c.save(); c.translate(x + w / 2, y + h / 2); c.fillStyle = color;
    c.rotate(0.28); c.fillRect(-w * 0.75, -h * 0.28, w * 1.5, Math.max(1.4, h * 0.18));
    c.rotate(-0.56); c.fillRect(-w * 0.75, h * 0.08, w * 1.5, Math.max(1.4, h * 0.18));
    c.restore();
  } else if (k < 0.34) {
    const b = h * (0.25 + r() * 0.5);
    c.fillStyle = rgba(claro, 0.55); c.fillRect(x, y, w, b);
    c.fillStyle = rgba(osc, 0.9); for (let yy = y + 1.4; yy < y + b; yy += 1.6) c.fillRect(x, yy, w, 0.45);
  } else if (k < 0.45) {
    c.fillStyle = rgba(claro, 0.35); c.fillRect(r() < 0.5 ? x : x + w * 0.6, y, w * 0.4, h);
  } else {
    c.fillStyle = rgba(claro, 0.2);
    c.beginPath(); c.moveTo(x, y + h * 0.55); c.lineTo(x + w * 0.55, y); c.lineTo(x + w * 0.85, y); c.lineTo(x, y + h * 0.9); c.fill();
  }
  c.fillStyle = color;
  if (w >= 5) c.fillRect(x + w / 2 - 0.35, y, 0.7, h);
  c.fillRect(x, y + h * 0.35, w, 0.7);
  c.fillStyle = rgba(osc, 0.5); c.fillRect(x - 0.5, y - 1, w + 1, 1);
  c.fillStyle = claro; c.fillRect(x - 1, y + h, w + 2, 1.1);
  if (r() < 0.35) { c.fillStyle = rgba(osc, 0.3); c.fillRect(x + 0.5 + r() * (w - 1), y + h + 1.1, 0.9, 3 + r() * 9); }
  if (r() < 0.08) {
    const aw = Math.max(5, w * 0.85), ax = x + (w - aw) / 2;
    c.fillStyle = color; c.fillRect(ax, y + h + 1.6, aw, 3.6);
    c.fillStyle = osc; for (let g = 0.8; g < aw - 0.5; g += 1.4) c.fillRect(ax + g, y + h + 2.4, 0.6, 2.2);
    c.fillStyle = rgba(osc, 0.3); c.fillRect(ax + aw - 1, y + h + 5.2, 0.7, 4 + r() * 6);
  }
}

// la fachada envejecida: humedad que sube del suelo, chorretones de la cornisa, desconchones con el
// ladrillo debajo, grietas con ramas, bajante con abrazaderas y carteles pegados a pie de calle
function desgaste(c, x, yb, w, h, color, osc, claro, r) {
  c.save(); c.beginPath(); c.rect(x, yb - h, w, h); c.clip();
  const hum = 14 + r() * 22, fase = r() * 6;
  let g = c.createLinearGradient(0, yb - hum, 0, yb);
  g.addColorStop(0, rgba(osc, 0)); g.addColorStop(1, rgba(osc, 0.4));
  c.fillStyle = g; c.beginPath(); c.moveTo(x, yb);
  for (let px = x; px <= x + w + 6; px += 6) c.lineTo(px, yb - hum * (0.6 + 0.4 * Math.sin(px * 0.13 + fase)));
  c.lineTo(x + w + 6, yb); c.fill();
  for (let k = 0; k < w / 12; k++) {
    if (r() < 0.45) continue;
    const sx = x + r() * w, sw = 1.5 + r() * 4, sl = h * (0.08 + r() * 0.4), sy = yb - h + r() * h * 0.15;
    g = c.createLinearGradient(0, sy, 0, sy + sl); g.addColorStop(0, rgba(osc, 0.32)); g.addColorStop(1, rgba(osc, 0));
    c.fillStyle = g; c.fillRect(sx, sy, sw, sl);
  }
  const parches = 1 + Math.floor(r() * 3);
  for (let k = 0; k < parches; k++) {
    const px = x + r() * Math.max(1, w - 16), py = yb - h * (0.15 + r() * 0.7), pw = 8 + r() * 14, ph = 5 + r() * 9;
    c.save(); c.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, f = 0.7 + r() * 0.4; c.lineTo(px + pw / 2 + Math.cos(a) * pw / 2 * f, py + ph / 2 + Math.sin(a) * ph / 2 * f); }
    c.closePath(); c.fillStyle = rgba(claro, 0.55); c.fill(); c.clip();
    c.fillStyle = rgba(osc, 0.45);
    for (let yy = py, fila = 0; yy < py + ph; yy += 2.6, fila++) {
      c.fillRect(px, yy, pw, 0.5);
      for (let xx = px + (fila % 2) * 2.5; xx < px + pw; xx += 5) c.fillRect(xx, yy, 0.5, 2.6);
    }
    c.restore();
  }
  c.strokeStyle = rgba(osc, 0.9); c.lineWidth = 0.8;
  for (let k = 0; k < (w > 50 ? 2 : 1); k++) if (r() < 0.7) grieta(c, x + w * (0.1 + r() * 0.8), yb - h + r() * h * 0.3, h * (0.15 + r() * 0.35), r, 2);
  if (r() < 0.55) {
    const bx = r() < 0.5 ? x + 2 : x + w - 4;
    c.fillStyle = rgba(osc, 0.7); c.fillRect(bx, yb - h + 3, 1.6, h - 3); c.fillRect(bx - 1.5, yb - h + 2, 4.6, 2.2);
    c.fillStyle = claro; for (let yy = yb - h + 10; yy < yb; yy += 18) c.fillRect(bx - 0.6, yy, 2.8, 1);
  }
  for (let k = 0; k < 3; k++) if (r() < 0.35) { c.fillStyle = rgba(claro, 0.6 + r() * 0.3); c.fillRect(x + 3 + r() * Math.max(1, w - 12), yb - 26 - r() * 10, 5 + r() * 3, 7 + r() * 3); }
  c.restore();
}

// grieta que baja quebrada y se ramifica
function grieta(c, x, y, largo, r, rama) {
  const pasos = Math.max(3, Math.round(largo / 5)), ramas = [];
  let px = x, py = y;
  c.beginPath(); c.moveTo(px, py);
  for (let i = 0; i < pasos; i++) {
    px += (r() - 0.5) * 5; py += largo / pasos; c.lineTo(px, py);
    if (rama > 0 && r() < 0.18) ramas.push([px, py]);
  }
  c.stroke();
  for (const [bx, by] of ramas) grieta(c, bx, by, largo * 0.35, r, rama - 1);
}

// lo que asoma bajo un techo partido: plantas abiertas con sus forjados y tabiques, y la ferralla al aire
function entranas(c, x, top, w, techo, color, osc, claro, r) {
  const pts = [[x, top], ...techo], d = 10 + r() * 8;
  const ymin = Math.min(...pts.map((p) => p[1])), ymax = Math.max(...pts.map((p) => p[1]));
  c.save(); c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) c.lineTo(p[0], p[1]);
  for (let i = pts.length - 1; i >= 0; i--) c.lineTo(pts[i][0], pts[i][1] + d);
  c.closePath(); c.fillStyle = rgba(osc, 0.85); c.fill(); c.clip();
  c.fillStyle = color;
  for (let y = ymin + 6; y < ymax + d; y += 9) { let px = x; while (px < x + w) { const l = 6 + r() * 20; if (r() < 0.75) c.fillRect(px, y, l, 1.6); px += l + 2 + r() * 6; } }
  for (let px = x + 4 + r() * 10; px < x + w; px += 10 + r() * 16) c.fillRect(px, ymin, 1.4, ymax - ymin + d);
  c.fillStyle = rgba(claro, 0.5); for (let k = 0; k < 4; k++) c.fillRect(x + r() * w, ymin + r() * (ymax - ymin + d), 3 + r() * 4, 2);
  c.restore();
  c.strokeStyle = color; c.lineWidth = 0.7;
  for (const [px, py] of pts) ferralla(c, px, py, 1 + Math.floor(r() * 3), r);
}

// varillas de acero que salen dobladas de un borde roto, hacia arriba
function ferralla(c, x, y, n, r) {
  for (let k = 0; k < n; k++) {
    const bx = x + (r() - 0.5) * 4, l = 4 + r() * 9, dx = (r() - 0.5) * 8;
    c.beginPath(); c.moveTo(bx, y + 1); c.quadraticCurveTo(bx + dx * 0.2, y - l * 0.7, bx + dx, y - l); c.stroke();
  }
}

// zona sin gravedad: el techo se ha arrancado y sus trozos flotan encima, en el hueco que dejo: losas con
// la ferralla al aire, pedazos de la ultima planta con sus ventanas, trastos de la azotea y grava
function techoFlotando(c, x, top, w, hueco, color, osc, claro, r) {
  c.fillStyle = color;
  c.beginPath(); c.moveTo(x, top + 1);
  const borde = [];
  for (let px = x; px <= x + w; px += 5 + r() * 6) { const p = [px, top - r() * 9]; borde.push(p); c.lineTo(p[0], p[1]); }
  c.lineTo(x + w, top + 1); c.closePath(); c.fill();
  c.strokeStyle = color; c.lineWidth = 0.7;
  for (const [px, py] of borde) if (r() < 0.5) ferralla(c, px, py, 1 + Math.floor(r() * 2), r);
  const n = 4 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const cx = x + w * (0.1 + r() * 0.8), cy = top - 12 - r() * (hueco + 24), q = r();
    c.save(); c.translate(cx, cy); c.rotate((r() - 0.5) * 1.4);
    if (q < 0.5) {
      const largo = 10 + r() * 14, grueso = 2.5 + r() * 3;
      c.fillStyle = color; c.beginPath();
      c.moveTo(-largo / 2, -grueso / 2); c.lineTo(largo / 2 - r() * 3, -grueso / 2);
      c.lineTo(largo / 2, 0); c.lineTo(largo / 2 - r() * 4, grueso / 2); c.lineTo(-largo / 2 + r() * 3, grueso / 2 + r() * 2);
      c.closePath(); c.fill();
      c.fillStyle = claro; c.fillRect(-largo / 2, -grueso / 2, largo - 3, 0.8);
      c.fillStyle = rgba(osc, 0.6); c.fillRect(-largo / 2 + 1, grueso / 2 - 0.8, largo - 4, 0.8);
      c.strokeStyle = color; c.lineWidth = 0.6;
      for (let j = 0; j < 2 + Math.floor(r() * 2); j++) { const vy = (r() - 0.5) * grueso; c.beginPath(); c.moveTo(largo / 2 - 1, vy); c.quadraticCurveTo(largo / 2 + 3, vy + (r() - 0.5) * 3, largo / 2 + 4 + r() * 5, vy + (r() - 0.5) * 8); c.stroke(); }
    } else if (q < 0.82) {
      const pw = 14 + r() * 12, ph = 10 + r() * 5;
      c.fillStyle = color; c.beginPath(); c.moveTo(-pw / 2, -ph / 2); c.lineTo(pw / 2, -ph / 2);
      for (let px = pw / 2; px >= -pw / 2; px -= 3 + r() * 3) c.lineTo(px, ph / 2 + r() * 3);
      c.closePath(); c.fill();
      c.fillRect(-pw / 2 - 1.5, -ph / 2 - 2, pw + 3, 2);
      c.fillStyle = claro; c.fillRect(-pw / 2 - 1.5, -ph / 2 - 2, pw + 3, 0.7);
      for (let vx = -pw / 2 + 2.5; vx < pw / 2 - 4; vx += 6) ventana(c, vx, -ph / 2 + 2.5, 3.6, 5.5, color, osc, claro, r);
      c.strokeStyle = color; c.lineWidth = 0.6; ferralla(c, (r() - 0.5) * pw, ph / 2 + 3, 2, r);
    } else {
      azotea(c, -8, 16, 0, color, osc, r);
      c.fillStyle = color; c.fillRect(-9, 0, 18, 2.5);
    }
    c.restore();
  }
  c.fillStyle = color;
  for (let k = 0; k < 14; k++) { const s = 1 + r() * 1.6; c.fillRect(x + r() * w, top - r() * (hueco + 50), s, s); }
}

function enredaderas(c, x, yb, w, h, osc, r) {
  c.strokeStyle = osc; c.lineWidth = 1.2;
  for (let k = 0; k < Math.floor(w / 30); k++) {
    if (r() < 0.4) continue;
    const vx = x + 4 + r() * (w - 8), v0 = yb - h + h * 0.1 * r(), largo = h * (0.1 + r() * 0.35);
    c.beginPath(); c.moveTo(vx, v0);
    for (let yy = v0; yy < v0 + largo; yy += 6) c.lineTo(vx + Math.sin(yy * 0.2 + k) * 2, yy);
    c.stroke();
  }
}
