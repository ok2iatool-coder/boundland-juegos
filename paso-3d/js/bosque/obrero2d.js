// EL BOSQUE FINAL en 2D (bosque/main.js), pintado en un HILO APARTE. Diseno propio (2026-10-22, el usuario: «no copies
// El Linde, El Linde esta mal, haz tu mismo la parte del bosque final»), en el lenguaje de los niveles del juego (los
// del laboratorio, la ciudad, el hospital): SILUETAS por planos, cada plano de UN valor que se aclara y se azula con la
// distancia metido en la bruma; lo jugable, lo mas oscuro, con un canto frio de luz; el primer plano, negro; la luz es
// la del alba que entra por los claros de las copas; lo calido, solo lo que brilla. Nada de las piezas de El Linde.
// Con DETALLE dentro de la silueta (2026-10-22, «mas detalles, mejoralo»): corteza en vetas que se encienden hacia el
// lado de la luz, nudos, raices retorcidas que salen y se meten, musgo, hiedra, setas de repisa, barbas de musgo que
// cuelgan de las ramas, telaranas con rocio, cuervos posados, y un suelo con grumos, hojarasca, piedras y ramitas.
//
// Todo se dibuja en METROS (el lienzo lleva la escala: x = z del mundo, y hacia arriba) y se devuelve como ImageBitmap
// (el hilo no se cierra: con la tarjeta grafica las ImageBitmap viven en su contexto):
//   capas    cinco planos de parallax (0,14 / 0,3 / 0,46 / 0,62 / 0,8): el cielo de bruma con el MURO GRANDE muy lejos,
//            filas de troncos (vivos, muertos tronchados, inclinados), monte bajo, troncos caidos y el techo de copas
//   fondo    lo del plano del 18 por detras: troncos con su detalle y su canto, y los sitios del camino
//   suelo    la tierra: el borde de musgo, hojarasca, piedras y ramitas; debajo raices y piedras metidas
//   delante  matas bajas delante del 18
//   frente   el primer plano negro y desenfocado (parallax 1,4)
// Cada bitmap lleva x0, y1 (arriba), w y h en sus metros (los de su capa).

const azar = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// un color entre dos (hex), con alfa
const mezcla = (a, b, t, al = 1) => { const A = rgb(a), B = rgb(b); return `rgba(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')},${al})`; };

// ---------------------------------------------------------------- la paleta (sRGB): un valor por plano
export const PAL = {
  cieloArriba: '#23292c', cieloBajo: '#596265', bruma: '#808889',
  planos: ['#4a5356', '#3c4447', '#2f3639', '#23292b', '#181d1f'],      // 0,14 ... 0,8
  muro: '#42494b',
  plano: '#0c1012', canto: '#a9b6b8', musgo: '#1a221f', musgoLuz: '#76877f', hoja: '#121916',
  tierra: '#0a0d0e', tierraHonda: '#050708', raiz: '#0f1416',
  frente: '#030506',
  setas: '#bfe3d2',
};

function pintar({ y0, z0, z1, alto }) {
  const t0 = performance.now();
  // un lienzo en metros: [xa, xa + w] x [yt - h, yt], a k px por metro, con y hacia arriba
  const lienzo = (xa, yt, w, h, k) => {
    const c = new OffscreenCanvas(Math.max(1, Math.ceil(w * k)), Math.max(1, Math.ceil(h * k)));
    const x = c.getContext('2d'); x.setTransform(k, 0, 0, -k, -xa * k, yt * k);
    x.lineCap = 'round'; x.lineJoin = 'round';
    return { c, x, k, xa, yt, w, h };
  };
  const desenfoque = (l, blur) => {
    if (!blur) return l;
    const a = lienzo(l.xa, l.yt, l.w, l.h, l.k);
    a.x.save(); a.x.setTransform(1, 0, 0, 1, 0, 0); a.x.filter = `blur(${blur}px)`; a.x.drawImage(l.c, 0, 0); a.x.restore();
    return a;
  };
  const salida = { capas: [], piezas: [], frente: [] };
  const bitmap = (l, extra) => ({ bmp: l.c.transferToImageBitmap(), x0: l.xa, y1: l.yt, w: l.w, h: l.h, ...extra });
  const avisa = () => postMessage({ progreso: (salida.capas.length + salida.frente.length + salida.piezas.length / 8) / 14 });

  // ================================================================= las formas
  // una forma que adelgaza a lo largo de una curva (raiz, rama, barba): [[x, y], ...] y el grueso al principio y al final
  function cinta(M, pts, g0, g1, col) {
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      const g = lerp(g0, g1, i / (pts.length - 1)) / 2, nx = -dy / d, ny = dx / d;
      L.push([pts[i][0] + nx * g, pts[i][1] + ny * g]); R.push([pts[i][0] - nx * g, pts[i][1] - ny * g]);
    }
    M.beginPath(); L.forEach((p, i) => (i ? M.lineTo(p[0], p[1]) : M.moveTo(p[0], p[1]))); for (let i = R.length - 1; i >= 0; i--) M.lineTo(R[i][0], R[i][1]); M.closePath();
    M.fillStyle = col; M.fill();
    return L;
  }
  const bez = (a, c, b, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, m = 1 - t; return [m * m * a[0] + 2 * m * t * c[0] + t * t * b[0], m * m * a[1] + 2 * m * t * c[1] + t * t * b[1]]; });
  // un trazo de luz (canto) a lo largo de unos puntos, con su alfa
  const cantoEn = (M, pts, a, ancho = 0.018) => { M.save(); M.strokeStyle = `rgba(169,182,184,${a})`; M.lineWidth = ancho; M.beginPath(); pts.forEach((p, i) => (i ? M.lineTo(p[0], p[1]) : M.moveTo(p[0], p[1]))); M.stroke(); M.restore(); };

  // una RAIZ que sale del pie, se arquea un poco por encima del suelo y se mete
  function raiz(M, x0, yb, lado, largo, grueso, col, rr, canto) {
    const x1 = x0 + lado * largo, alto = grueso * (1.6 + rr() * 1.8);
    const pts = bez([x0, yb + grueso * 1.6], [x0 + lado * largo * (0.25 + rr() * 0.2), yb + alto], [x1, yb - 0.1], 16);
    const borde = cinta(M, pts, grueso * 1.9, 0.025, col);
    // un nudo en el lomo
    const [kx, ky] = pts[5 + Math.floor(rr() * 4)]; M.fillStyle = col; M.beginPath(); M.ellipse(kx, ky + grueso * 0.35, grueso * 0.55, grueso * 0.4, 0, 0, 7); M.fill();
    if (canto) cantoEn(M, (lado > 0 ? borde : borde).slice(2, -3), canto * 0.6, 0.012);
  }
  // un TRONCO en silueta con su detalle: se estrecha al subir, se tuerce un poco, raices retorcidas, vetas de corteza
  // que se encienden hacia la luz (la derecha), nudos, musgo en el pie, hiedra, setas, ramas que adelgazan con ramitas y
  // barbas de musgo; `roto` lo tronca con el borde astillado; `canto` enciende el borde de la derecha y se apaga hacia
  // arriba
  function arbol(M, x, yb, h, w, col, rr, o = {}) {
    const lean = o.inclina ?? (rr() - 0.5) * 0.04, fase = rr() * 6, ondas = 0.05 + rr() * 0.06, hT = h * (o.roto || 1);
    const eje = (t) => x + lean * t * h + Math.sin(t * 3.2 + fase) * w * ondas;
    const medio = (t) => w / 2 * (1 - 0.28 * t) + w * 0.55 * Math.pow(Math.max(0, 1 - t / 0.09), 2.2);
    const izq = [], der = [], tMax = o.roto || 1;
    for (let t = 0; t <= tMax + 1e-4; t += 0.02) { const y = yb + t * h, n = Math.sin(y * 7 + fase) * w * 0.015 + Math.sin(y * 23 + fase) * w * 0.006; izq.push([eje(t) - medio(t) + n, y]); der.push([eje(t) + medio(t) - n, y]); }
    M.beginPath(); M.moveTo(izq[0][0], yb - 0.2);
    for (const p of izq) M.lineTo(p[0], p[1]);
    if (o.roto) {
      // la punta astillada
      const a = izq[izq.length - 1], b = der[der.length - 1], n = 7;
      for (let i = 1; i < n; i++) { const u = i / n; M.lineTo(lerp(a[0], b[0], u), lerp(a[1], b[1], u) + (i % 2 ? w * (0.4 + rr() * 0.9) : -w * rr() * 0.2)); }
    }
    for (let i = der.length - 1; i >= 0; i--) M.lineTo(der[i][0], der[i][1]);
    M.lineTo(der[0][0], yb - 0.2); M.closePath();
    M.fillStyle = col; M.fill();
    const det = o.detalle || 0, claro = (t, a) => mezcla(col, PAL.canto, t, a);
    // raices retorcidas
    if (o.raices) for (const lado of [-1, 1]) {
      const n = 1 + Math.floor(rr() * 2.4);
      for (let k = 0; k < n; k++) raiz(M, x + lado * w * (0.25 + rr() * 0.25), yb, lado, w * (0.55 + rr() * 0.6) * (o.escalaRaiz || 1), w * (0.12 + rr() * 0.1), col, rr, det && lado > 0 ? (o.cantoA ?? 0.35) : 0);
    }
    if (det) {
      M.save(); M.beginPath(); for (const p of izq) M.lineTo(p[0], p[1]); for (let i = der.length - 1; i >= 0; i--) M.lineTo(der[i][0], der[i][1]); M.closePath(); M.clip();
      // VETAS de corteza: lineas que suben ondulando, mas claras hacia la derecha y apagadas hacia arriba
      const nv = Math.round(w / 0.035);
      for (let v = 0; v < nv; v++) {
        const u = (v + rr() * 0.6) / nv * 2 - 1, ta = rr() * 0.3, tb = Math.min(tMax, ta + 0.06 + rr() * 0.22);
        const luz = Math.max(0, u) ** 1.5;
        M.strokeStyle = claro(0.1 + 0.25 * luz, (0.25 + 0.55 * luz) * det); M.lineWidth = 0.008 + rr() * 0.012;
        M.beginPath();
        for (let t = ta; t <= tb; t += 0.01) { const px = eje(t) + u * medio(t) * 0.95 + Math.sin(t * 40 + v) * w * 0.012; t === ta ? M.moveTo(px, yb + t * h) : M.lineTo(px, yb + t * h); }
        M.stroke();
      }
      // NUDOS
      for (let k = 0; k < (det >= 1 ? 1 + Math.floor(rr() * 2) : 0); k++) {
        const t = 0.15 + rr() * 0.4, cx = eje(t) + (rr() - 0.3) * medio(t), cy = yb + t * h, r = w * (0.07 + rr() * 0.07);
        M.fillStyle = mezcla(col, '#000000', 0.4); M.beginPath(); M.ellipse(cx, cy, r * 0.7, r * 1.3, 0, 0, 7); M.fill();
        M.strokeStyle = claro(0.3, 0.5 * det); M.lineWidth = 0.008; M.beginPath(); M.ellipse(cx, cy, r, r * 1.7, 0, -0.9, 0.9); M.stroke();
      }
      // MUSGO en matas al pie, que suben un poco por el lado de la luz (sueltas por el tronco eran manchas)
      if (det >= 1) for (let m = 0; m < 3; m++) {
        const t0m = rr() * 0.06, lado = m === 0 ? 1 : rr() < 0.7 ? 1 : -1;
        for (let k = 0; k < 14; k++) {
          const t = t0m + Math.pow(rr(), 2.5) * 0.12, cx = eje(t) + lado * (0.45 + rr() * 0.55) * medio(t), cy = yb + t * h;
          M.fillStyle = mezcla(PAL.musgo, PAL.musgoLuz, rr() * 0.15); M.beginPath(); M.ellipse(cx, cy, 0.025 + rr() * 0.05, 0.02 + rr() * 0.03, rr(), 0, 7); M.fill();
        }
      }
      M.restore();
      // HIEDRA que sube enroscandose, con sus hojas
      if (o.hiedra) {
        const tTop = 0.35 + rr() * 0.35;
        M.strokeStyle = col; M.lineWidth = 0.022; M.beginPath();
        const vid = [];
        for (let t = 0; t <= tTop; t += 0.008) { const s = Math.sin(t * 22 + fase); vid.push([eje(t) + s * medio(t) * 0.92, yb + t * h, s]); }
        vid.forEach((p, i) => (i ? M.lineTo(p[0], p[1]) : M.moveTo(p[0], p[1]))); M.stroke();
        for (let i = 2; i < vid.length; i += 3) {
          const [px, py, s] = vid[i], lado = i % 2 ? 1 : -1, ex = px + lado * (0.05 + rr() * 0.05), ey = py + 0.02;
          hojaHiedra(M, ex, ey, 0.045 + rr() * 0.035, lado * (0.4 + rr() * 0.5), s > 0 ? PAL.hoja : col, s > 0.3 ? 0.35 : 0);
        }
      }
      // SETAS DE REPISA con la cara de abajo encendida
      if (o.setas) for (let k = 0; k < 3; k++) {
        const t = 0.08 + k * 0.05 + rr() * 0.05, lado = rr() < 0.7 ? 1 : -1, bx = eje(t) + lado * medio(t) * 0.9, by = yb + t * h, r = 0.08 + rr() * 0.06;
        M.fillStyle = col; M.beginPath(); M.ellipse(bx + lado * r * 0.6, by, r, r * 0.32, lado * 0.15, 0, Math.PI); M.fill();
        M.strokeStyle = `rgba(191,227,210,${0.35 * det})`; M.lineWidth = 0.01; M.beginPath(); M.moveTo(bx, by); M.lineTo(bx + lado * r * 1.5, by + 0.004); M.stroke();
      }
    }
    // ramas que adelgazan, con ramitas, alguna rota, y barbas de musgo colgando
    const ramas = o.ramas ?? 0, perchas = [];
    for (let k = 0; k < ramas; k++) {
      const t = Math.min(tMax - 0.05, 0.4 + rr() * 0.45), lado = rr() < 0.5 ? -1 : 1, bx = eje(t) + lado * medio(t) * 0.7, by = yb + t * h;
      const rota = rr() < 0.25, L = (rota ? 0.25 + rr() * 0.3 : 0.9 + rr() * 1.8) * (o.escala || 1), ang = (0.55 + rr() * 0.5) * lado;
      const ex = bx + Math.sin(ang) * L, ey = by + Math.cos(ang) * L * 0.65;
      const pts = bez([bx - lado * medio(t) * 0.4, by - w * 0.15], [bx + (ex - bx) * 0.5, by + (ey - by) * 0.15], [ex, ey], 14);
      const borde = cinta(M, pts, w * 0.32, rota ? w * 0.18 : 0.02, col);
      if (o.canto && det) cantoEn(M, borde.slice(3, -2), (o.cantoA ?? 0.4) * 0.6, 0.012);
      if (!rota && Math.abs(ang) > 0.6) perchas.push({ x: pts[8][0], y: pts[8][1] + w * 0.08, lado });
      if (rota) { M.fillStyle = col; M.beginPath(); M.moveTo(ex - 0.05, ey - 0.04); M.lineTo(ex + lado * 0.06, ey + 0.08); M.lineTo(ex + 0.02, ey + 0.01); M.lineTo(ex + lado * 0.03, ey - 0.07); M.fill(); continue; }
      M.strokeStyle = col;
      for (let k2 = 0; k2 < 4; k2++) {
        const [ax2, ay2] = pts[5 + Math.floor(rr() * 8)], l2 = 0.2 + rr() * 0.5, a2 = ang + (rr() - 0.5) * 1.8, mx = ax2 + Math.sin(a2) * l2, my = ay2 + Math.cos(a2) * l2;
        M.lineWidth = 0.022; M.beginPath(); M.moveTo(ax2, ay2); M.quadraticCurveTo(lerp(ax2, mx, 0.5) + 0.04, lerp(ay2, my, 0.5), mx, my); M.stroke();
        M.lineWidth = 0.012; M.beginPath(); M.moveTo(mx, my); M.lineTo(mx + Math.sin(a2 + 0.6) * l2 * 0.4, my + Math.cos(a2 + 0.6) * l2 * 0.4); M.stroke();
        if (o.hojas) mata(M, mx, my, 0.18 + rr() * 0.22, col, rr);
      }
      if (o.barba) for (let k2 = 0; k2 < 3 + Math.floor(rr() * 4); k2++) {
        const [ax2, ay2] = pts[4 + Math.floor(rr() * 9)];
        barba(M, ax2, ay2 - w * 0.05, 0.15 + Math.pow(rr(), 1.5) * 0.7, col, rr);
      }
    }
    if (o.canto) {
      // el canto de luz de la derecha, que se apaga hacia arriba (entero, de arriba abajo, parecia un alambre), y un
      // contraluz mucho mas flojo a la izquierda
      M.save(); M.lineWidth = o.cantoAncho || 0.02;
      const a = o.cantoA ?? 0.4, g = M.createLinearGradient(0, yb, 0, yb + h * 0.55);
      g.addColorStop(0, `rgba(169,182,184,${a})`); g.addColorStop(0.5, `rgba(169,182,184,${a * 0.45})`); g.addColorStop(1, 'rgba(169,182,184,0)');
      M.strokeStyle = g; M.beginPath(); der.forEach((p, i) => (i ? M.lineTo(p[0] - 0.004, p[1]) : M.moveTo(p[0] - 0.004, p[1]))); M.stroke();
      const g2 = M.createLinearGradient(0, yb, 0, yb + h * 0.4); g2.addColorStop(0, `rgba(169,182,184,${a * 0.25})`); g2.addColorStop(1, 'rgba(169,182,184,0)');
      M.strokeStyle = g2; M.lineWidth = (o.cantoAncho || 0.02) * 0.6; M.beginPath(); izq.forEach((p, i) => (i ? M.lineTo(p[0] + 0.004, p[1]) : M.moveTo(p[0] + 0.004, p[1]))); M.stroke();
      M.restore();
    }
    return { eje, medio, h: hT, perchas };
  }
  // una hoja de hiedra de tres puntas
  function hojaHiedra(M, x, y, r, ang, col, canto) {
    M.save(); M.translate(x, y); M.rotate(ang);
    M.beginPath(); M.moveTo(0, -r * 0.6); M.lineTo(-r * 0.7, -r * 0.1); M.lineTo(-r * 0.45, r * 0.25); M.lineTo(0, r * 0.75); M.lineTo(r * 0.45, r * 0.25); M.lineTo(r * 0.7, -r * 0.1); M.closePath();
    M.fillStyle = col; M.fill();
    if (canto) { M.strokeStyle = `rgba(169,182,184,${canto})`; M.lineWidth = 0.006; M.beginPath(); M.moveTo(r * 0.7, -r * 0.1); M.lineTo(r * 0.45, r * 0.25); M.lineTo(0, r * 0.75); M.stroke(); }
    M.restore();
  }
  // una BARBA de musgo que cuelga: hebras que caen y se abren
  function barba(M, x, y, l, col, rr) {
    M.strokeStyle = col;
    for (let k = 0; k < 4 + Math.floor(rr() * 4); k++) {
      const dx = (rr() - 0.5) * 0.08, ll = l * (0.5 + rr() * 0.5);
      M.lineWidth = 0.006 + rr() * 0.01; M.beginPath(); M.moveTo(x + dx * 0.3, y); M.quadraticCurveTo(x + dx + (rr() - 0.5) * 0.06, y - ll * 0.5, x + dx * 1.6, y - ll); M.stroke();
    }
  }
  // una MATA de hojas en silueta: discos que se solapan y un borde mordido de hojas sueltas
  function mata(M, x, y, r, col, rr) {
    M.fillStyle = col;
    for (let k = 0; k < 9; k++) { const a = rr() * Math.PI * 2, d = rr() * r * 0.7; M.beginPath(); M.arc(x + Math.cos(a) * d * 1.4, y + Math.sin(a) * d * 0.6, r * (0.3 + rr() * 0.3), 0, 7); M.fill(); }
    for (let k = 0; k < 34; k++) { const a = rr() * Math.PI * 2, d = r * (0.85 + rr() * 0.45); M.beginPath(); M.ellipse(x + Math.cos(a) * d * 1.2, y + Math.sin(a) * d * 0.62, r * (0.08 + rr() * 0.08), r * 0.035, a + (rr() - 0.5), 0, 7); M.fill(); }
  }
  // el TECHO DE COPAS: una masa por arriba con el borde de abajo de hojas sueltas, lianas y barbas que cuelgan
  function techo(M, xa, xb, ybajo, ytop, col, rr, o = {}) {
    M.fillStyle = col;
    // la masa de arriba, salvo donde el dosel se abre
    for (let x = xa; x < xb; x += 0.25) if (!(o.hueco && o.hueco(x + 0.125))) M.fillRect(x, ybajo + 0.9, 0.26, ytop - ybajo);
    for (let x = xa - 1; x < xb + 1; x += 0.35 + rr() * 0.6) {
      if (o.hueco && o.hueco(x)) { rr(); rr(); continue; }          // (bajarla dejaba una bola suelta: el hueco es hueco)
      const r = (0.35 + rr() * 0.75) * (o.escala || 1), y = ybajo + 0.5 + rr() * 0.8;
      M.beginPath(); M.ellipse(x, y, r * 1.3, r, 0, 0, 7); M.fill();
      for (let k = 0; k < 12; k++) { const a = Math.PI * 1.05 + rr() * Math.PI * 0.9; M.beginPath(); M.ellipse(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * (0.95 + rr() * 0.25), r * (0.08 + rr() * 0.07), r * 0.035, a + (rr() - 0.5), 0, 7); M.fill(); }
    }
    if (o.lianas) for (let x = xa; x < xb; x += 0.7 + rr() * 2.5) {
      if (o.hueco && o.hueco(x)) continue;
      const l = 0.4 + Math.pow(rr(), 1.6) * 3.2, y1 = ybajo + 0.2 - l;
      if (rr() < 0.35) { barba(M, x, ybajo + 0.3, l * 0.5, col, rr); continue; }
      M.strokeStyle = col; M.lineWidth = 0.025 + rr() * 0.03;
      M.beginPath(); M.moveTo(x, ybajo + 0.6); M.quadraticCurveTo(x + (rr() - 0.5) * 0.4, ybajo - l * 0.5, x + (rr() - 0.5) * 0.25, y1); M.stroke();
      if (o.hojasLiana) for (let k = 0; k < l / 0.45; k++) { const yy = ybajo - 0.2 - k * 0.45, a = rr() < 0.5 ? -1 : 1; hojaHiedra(M, x + a * 0.05, yy, 0.07 + rr() * 0.03, a * 0.8, col, 0); }
    }
  }
  // un HELECHO en silueta: frondas en abanico con foliolos que menguan; `canto` enciende las de la derecha
  // PASTO: una alfombra de matojos muy juntos de xa a xb sobre y, en un solo color y un solo relleno. `paso` es lo que
  // hay de un matojo al siguiente; el alto va por rodales (trozos altos y trozos ralos); alguna espiga doblada
  function pasto(M, xa, xb, y, alto, col, rr, paso = 0.06, o = {}) {
    M.beginPath();
    for (let x = xa; x < xb; x += paso * (0.5 + rr())) {
      const rodal = 0.5 + 0.5 * Math.sin(x * 0.8 + (o.sem || 0)) * Math.sin(x * 0.31 + 2.1), yy = y + (o.alza ? o.alza(x) : 0) + (rr() - 0.5) * 0.04;
      const h = alto * (0.15 + 0.85 * Math.pow(rr(), 1.5) * (0.35 + 0.65 * rodal)), n = 3 + Math.floor(rr() * 6), lado = (o.viento ?? 0.12);
      for (let b = 0; b < n; b++) {
        const a = (b / (n - 1 || 1) - 0.5) * 1.0 + lado + (rr() - 0.5) * 0.35, l = h * (0.5 + rr() * 0.6), bx = x + (b / n - 0.5) * 0.09, w = 0.008 + rr() * 0.012;
        const ex = bx + Math.sin(a) * l, ey = yy + Math.cos(a) * l * (1 - 0.12 * Math.abs(a));
        M.moveTo(bx - w, yy); M.quadraticCurveTo(bx + Math.sin(a * 0.35) * l * 0.45 - w * 0.5, yy + l * 0.58, ex, ey); M.quadraticCurveTo(bx + Math.sin(a * 0.35) * l * 0.45 + w * 0.5, yy + l * 0.58, bx + w, yy); M.closePath();
      }
      if (rr() < (o.espiga ?? 0.05)) {   // espiga: tallo fino mas alto, doblado, con granos
        const L = alto * (1.1 + rr() * 0.5), a = lado + 0.15 + rr() * 0.35, tx = x + Math.sin(a) * L, ty = yy + Math.cos(a) * L, cx = x + Math.sin(a * 0.3) * L * 0.5, cy = yy + L * 0.6;
        M.moveTo(x - 0.004, yy); M.quadraticCurveTo(cx, cy, tx, ty); M.quadraticCurveTo(cx + 0.004, cy, x + 0.004, yy); M.closePath();
        for (let j = 0; j < 7; j++) { const u = 0.72 + j * 0.04, ix = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * cx + u * u * tx, iy = (1 - u) * (1 - u) * yy + 2 * (1 - u) * u * cy + u * u * ty, r = 0.011 - j * 0.0008, sg = j % 2 ? 1 : -1; M.moveTo(ix + sg * r * 1.7, iy); M.ellipse(ix + sg * r * 0.8, iy, r * 0.9, r * 0.55, -a + sg * 0.6, 0, 7); }
      }
    }
    M.fillStyle = col; M.fill();
  }
  function helecho(M, x, y, alto, col, rr, n = 5, canto = 0) {
    M.fillStyle = col; M.strokeStyle = col;
    for (let k = 0; k < n; k++) {
      const a = (k / (n - 1) - 0.5) * 2.2 + (rr() - 0.5) * 0.25, l = alto * (0.7 + rr() * 0.4);
      const ex = x + Math.sin(a) * l, ey = y + Math.cos(a) * l * 0.75, cx = x + Math.sin(a) * l * 0.5, cy = y + l * 0.85;
      const P = (t) => { const m = 1 - t; return [m * m * x + 2 * m * t * cx + t * t * ex, m * m * y + 2 * m * t * cy + t * t * ey]; };
      M.lineWidth = alto * 0.025; M.beginPath(); M.moveTo(x, y); M.quadraticCurveTo(cx, cy, ex, ey); M.stroke();
      for (let i = 1; i < 12; i++) {
        const t = i / 12, [px, py] = P(t), [qx, qy] = P(Math.min(1, t + 0.03)), ang = Math.atan2(qy - py, qx - px), lf = (1 - t) * l * 0.22 + l * 0.02;
        for (const s of [-1, 1]) { const fa = ang + s * 1.1; M.beginPath(); M.moveTo(px, py); M.lineTo(px + Math.cos(fa - s * 0.25) * lf, py + Math.sin(fa - s * 0.25) * lf); M.lineTo(px + Math.cos(fa + s * 0.3) * lf * 0.8, py + Math.sin(fa + s * 0.3) * lf * 0.8); M.closePath(); M.fill(); }
      }
      if (canto && a > 0) cantoEn(M, Array.from({ length: 8 }, (_, i) => P(0.2 + i * 0.1)), canto, 0.008);
    }
  }
  // una PENA: canto rodado de borde quebrado con grietas, su gorro de musgo irregular que cuelga en barbas y su canto
  function pena(M, x, yb, w, h, col, rr) {
    const n = 22, pts = [];
    for (let i = 0; i <= n; i++) { const a = Math.PI * (i / n), r = 1 + (rr() - 0.5) * 0.12; pts.push([x + w / 2 - Math.cos(a) * w / 2 * r, yb + Math.pow(Math.sin(a), 0.75) * h * r]); }
    M.beginPath(); M.moveTo(x - 0.05, yb - 0.2); for (const p of pts) M.lineTo(p[0], p[1]); M.lineTo(x + w + 0.05, yb - 0.2); M.closePath();
    M.fillStyle = col; M.fill();
    // grietas y caras
    M.save(); M.clip();
    for (let k = 0; k < 4; k++) { const sx = x + w * (0.2 + rr() * 0.6), sy = yb + h * (0.5 + rr() * 0.4); M.strokeStyle = 'rgba(0,0,0,.6)'; M.lineWidth = 0.012; M.beginPath(); M.moveTo(sx, sy); let px = sx, py = sy; for (let i = 0; i < 4; i++) { px += (rr() - 0.4) * 0.15; py -= 0.06 + rr() * 0.1; M.lineTo(px, py); } M.stroke(); }
    for (let k = 0; k < 3; k++) { const cx = x + w * (0.3 + k * 0.22); M.strokeStyle = 'rgba(169,182,184,.14)'; M.lineWidth = 0.02; M.beginPath(); M.moveTo(cx, yb + h * 0.85); M.lineTo(cx + w * 0.08, yb + h * 0.35); M.stroke(); }
    M.restore();
    // el gorro de musgo: grumos de distinto tamano sobre el lomo y barbas en el borde
    for (let i = 2; i < n - 1; i++) {
      const [px, py] = pts[i];
      for (let k = 0; k < 3; k++) { M.fillStyle = mezcla(PAL.musgo, PAL.musgoLuz, rr() * 0.18); M.beginPath(); M.ellipse(px + (rr() - 0.5) * 0.12, py - 0.02 - rr() * 0.05, 0.04 + rr() * 0.1, 0.03 + rr() * 0.06, rr(), 0, 7); M.fill(); }
      if ((i < 5 || i > n - 5) && rr() < 0.6) barba(M, px, py - 0.05, 0.08 + rr() * 0.2, PAL.musgo, rr);
    }
    cantoEn(M, pts.slice(4, n - 2).map((p) => [p[0], p[1] + 0.035]), 0.4, 0.02);
  }
  // un CUERVO posado, de perfil
  function cuervo(M, x, y, s, col, lado = 1) {
    M.save(); M.translate(x, y); M.scale(s * lado, s); M.fillStyle = col; M.strokeStyle = col;
    M.beginPath(); M.ellipse(0, 0.1, 0.13, 0.075, 0.25, 0, 7); M.fill();                    // cuerpo
    M.beginPath(); M.arc(0.11, 0.17, 0.05, 0, 7); M.fill();                                // cabeza
    M.beginPath(); M.moveTo(0.15, 0.19); M.lineTo(0.23, 0.16); M.lineTo(0.15, 0.15); M.fill(); // pico
    M.beginPath(); M.moveTo(-0.1, 0.07); M.lineTo(-0.26, 0.0); M.lineTo(-0.24, 0.05); M.lineTo(-0.09, 0.11); M.fill();     // cola
    M.lineWidth = 0.012; M.beginPath(); M.moveTo(0.0, 0.04); M.lineTo(0.01, -0.02); M.moveTo(0.04, 0.04); M.lineTo(0.05, -0.02); M.stroke();
    M.restore();
  }
  // una TELARANA entre cuatro puntos de anclaje, con rocio que coge la luz
  function telarana(M, cx, cy, r, rr) {
    M.save(); M.strokeStyle = 'rgba(190,206,208,.22)'; M.lineWidth = 0.004;
    const radios = 11, ang = (i) => i / radios * Math.PI * 2 + rr() * 0.15;
    const as = Array.from({ length: radios }, (_, i) => ang(i));
    for (const a of as) { M.beginPath(); M.moveTo(cx, cy); M.lineTo(cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 0.9); M.stroke(); }
    for (let v = 1; v < 9; v++) {
      const rv = r * v / 9; M.beginPath();
      as.forEach((a, i) => { const px = cx + Math.cos(a) * rv * (1 + Math.sin(i + v) * 0.04), py = cy + Math.sin(a) * rv * 0.85 - (1 - Math.abs(Math.sin(a))) * 0.01; i ? M.lineTo(px, py) : M.moveTo(px, py); });
      M.closePath(); M.stroke();
    }
    for (let k = 0; k < 18; k++) { const a = rr() * Math.PI * 2, d = rr() * r; M.fillStyle = `rgba(220,232,234,${0.25 + rr() * 0.45})`; M.beginPath(); M.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, 0.006 + rr() * 0.006, 0, 7); M.fill(); }
    M.restore();
  }

  // ================================================================= los planos de parallax
  const YT = y0 + 7.6, YB = y0 - 2.4;
  const capa = (f, k, blur, fn, destino = salida.capas) => {
    const HW = 13, xa = z0 * f - HW, xb = z1 * f + HW;
    const l = lienzo(xa, YT, xb - xa, YT - YB, k);
    fn(l.x, xa, xb);
    destino.push(bitmap(desenfoque(l, blur), { f }));
    avisa();
  };
  // donde acaba el bosque (lo ultimo del tramo 2D): los arboles se separan y asoma el muro
  const claroFinal = (zm) => Math.max(0, Math.min(1, (zm + 101) / 8));
  // ---- 0,14: el cielo de bruma del alba, el MURO GRANDE muy lejos (una franja recta con sus torres) y troncos palidos
  capa(0.14, 40, 2.5, (M, xa, xb) => {
    const g = M.createLinearGradient(0, YT, 0, y0);
    g.addColorStop(0, PAL.cieloArriba); g.addColorStop(0.75, PAL.cieloBajo); g.addColorStop(1, PAL.bruma);
    M.fillStyle = g; M.fillRect(xa, YB, xb - xa, YT - YB);
    // el alba: una claridad baja hacia delante (a la derecha)
    const ga = M.createRadialGradient(xb - 4, y0 + 1, 0, xb - 4, y0 + 1, 12); ga.addColorStop(0, 'rgba(176,184,184,.35)'); ga.addColorStop(1, 'rgba(176,184,184,0)');
    M.fillStyle = ga; M.fillRect(xa, YB, xb - xa, YT - YB);
    const xm = -104 * 0.14;
    M.fillStyle = PAL.muro; M.fillRect(xm, y0 - 1, xb - xm, 3.6);
    for (let x = xm + 0.4; x < xb; x += 1.6) { M.fillRect(x, y0 + 2.6, 0.06, 0.9); M.fillRect(x - 0.12, y0 + 3.45, 0.3, 0.12); }
    const gm = M.createLinearGradient(xm, 0, xm + 5, 0); gm.addColorStop(0, PAL.cieloBajo); gm.addColorStop(1, 'rgba(89,98,101,0)');
    M.fillStyle = gm; M.fillRect(xm - 0.1, y0 - 1, 5.1, 4.8);
    const rr = azar(11);
    for (let x = xa; x < xb; x += 0.25 + rr() * 0.45) arbol(M, x, y0 - 0.3, 9, 0.12 + rr() * 0.1, PAL.planos[0], rr, { roto: rr() < 0.08 ? 0.3 + rr() * 0.4 : 0 });
    const gb = M.createLinearGradient(0, y0 + 1.6, 0, y0 - 0.6); gb.addColorStop(0, 'rgba(128,136,137,0)'); gb.addColorStop(1, PAL.bruma);
    M.fillStyle = gb; M.fillRect(xa, YB, xb - xa, y0 + 1.6 - YB);
  });
  // ---- 0,3 / 0,46 / 0,62 / 0,8: filas de troncos (vivos, muertos tronchados, inclinados), monte bajo, algun tronco
  // caido, el techo de copas, cada una mas oscura y con su bruma baja
  const fila = (f, n, k, blur, sem, wa, wb, paso, o = {}) => capa(f, k, blur, (M, xa, xb) => {
    const rr = azar(sem), col = PAL.planos[n];
    for (let x = xa; x < xb; x += paso * (0.6 + rr() * 0.8) * (1 + 2.2 * claroFinal(x / f))) {
      const tipo = rr(), w = wa + rr() * (wb - wa);
      const oa = { raices: true, ramas: o.ramas ? Math.floor(rr() * 3) : 0, escala: o.escala, detalle: o.detalle || 0, barba: o.barba, canto: o.canto, cantoA: o.cantoA };
      if (tipo < 0.12) arbol(M, x, y0 - 0.2, 10, w, col, rr, { ...oa, roto: 0.15 + rr() * 0.4, ramas: 1 });
      else if (tipo < 0.22) arbol(M, x, y0 - 0.2, 10, w * 0.8, col, rr, { ...oa, inclina: (rr() < 0.5 ? -1 : 1) * (0.05 + rr() * 0.05) });
      else if (tipo < 0.28) { arbol(M, x - w * 0.6, y0 - 0.2, 10, w * 0.75, col, rr, oa); arbol(M, x + w * 0.6, y0 - 0.2, 10, w * 0.6, col, rr, { ...oa, raices: false }); }
      else arbol(M, x, y0 - 0.2, 10, w, col, rr, oa);
    }
    if (o.caidos) for (let x = xa + 3; x < xb; x += 9 + rr() * 9) {
      const l = 2.5 + rr() * 3, a = (rr() - 0.5) * 0.5, r = 0.12 + rr() * 0.15;
      cinta(M, [[x, y0 - 0.1 + r], [x + Math.cos(a) * l, y0 - 0.1 + r + Math.max(0, Math.sin(a) * l)]], r * 2, r * 1.6, col);
    }
    if (o.techo) techo(M, xa, xb, y0 + o.techo, YT + 1, col, rr, { lianas: true, hojasLiana: f >= 0.8, escala: o.escalaTecho, hueco: (x) => claroFinal(x / f) > 0.5 && Math.sin(x * 0.9) > 0.2 });
    // monte bajo: matas y helechos de alturas distintas
    for (let x = xa; x < xb; x += 0.4 + rr() * 0.9) { if (rr() < 0.5) mata(M, x, y0 - 0.15 + rr() * 0.25, 0.2 + rr() * 0.45, col, rr); else helecho(M, x, y0 - 0.2, 0.4 + rr() * 0.6, col, rr, 5); }
    pasto(M, xa, xb, y0 - 0.38, 0.6 + f * 0.9, col, rr, 0.06, { sem: sem, espiga: 0.05 });   // la franja de hierba de su suelo
    const gb = M.createLinearGradient(0, y0 + 1.4, 0, y0 - 0.5); gb.addColorStop(0, 'rgba(128,136,137,0)'); gb.addColorStop(1, `rgba(128,136,137,${o.bruma ?? 0.3})`);
    M.fillStyle = gb; M.fillRect(xa, YB, xb - xa, y0 + 1.4 - YB);
    M.fillStyle = col; M.fillRect(xa, YB, xb - xa, y0 - 0.45 - YB);
  });
  fila(0.3, 1, 45, 1.8, 21, 0.18, 0.34, 0.7, { bruma: 0.38 });
  fila(0.46, 2, 50, 1.2, 31, 0.26, 0.5, 1.0, { ramas: true, bruma: 0.3, techo: 5.4, escalaTecho: 0.8, caidos: true, barba: true });
  fila(0.62, 3, 55, 0.7, 41, 0.34, 0.7, 1.5, { ramas: true, bruma: 0.22, techo: 5.8, caidos: true, barba: true });
  fila(0.8, 4, 60, 0.4, 51, 0.45, 0.9, 2.2, { ramas: true, bruma: 0.12, techo: 6.2, escalaTecho: 1.2, barba: true, detalle: 0.35, canto: PAL.canto, cantoA: 0.12 });

  // ================================================================= el plano del 18 (sin parallax)
  const K = 120;                       // px por metro: el de la pantalla a 1080 lineas (9 m de alto)
  const pieza = (xa, xb, yt, yb, nombre, fn) => {
    const l = lienzo(xa, yt, xb - xa, yt - yb, K);
    fn(l.x, xa, xb);
    salida.piezas.push(bitmap(l, { nombre }));
    avisa();
  };
  // LOS SITIOS del camino (z): la pena, el arbol gigante con su hueco, el tronco caido sobre otra pena, el claro con el
  // tocon y el corro de setas, la ultima pena y el cartel viejo, y al final el bosque que se abre
  const SITIOS = [{ z: -127.5, t: 'pena' }, { z: -121.5, t: 'gigante' }, { z: -113.5, t: 'caido' }, { z: -107, t: 'claro' }, { z: -101.5, t: 'pena' }, { z: -97.6, t: 'cartel' }];
  // ---- detras del 18: troncos con su detalle, su canto y lianas, y los sitios
  {
    const rr = azar(1601), arboles = [];
    for (let z = z0 - 10; z < z1 + 10; z += (4.5 + rr() * 5) * (1 + 1.5 * claroFinal(z))) if (!SITIOS.some((s) => Math.abs(s.z - z) < (s.t === 'gigante' ? 4 : s.t === 'claro' ? 3 : 1.6))) arboles.push(z);
    for (let za = z0 - 12; za < z1 + 12; za += 9) {
      const zb = za + 9;
      pieza(za - 3, zb + 3, YT, y0 - 0.8, 'fondo', (M) => {
        for (const z of arboles) if (z >= za && z < zb) {
          const r2 = azar(Math.round(z * 113)), w = 0.36 + r2() * 0.34;
          const T = arbol(M, z, y0 - 0.1, 9, w, PAL.plano, r2, { raices: true, ramas: 1 + Math.floor(r2() * 3), canto: PAL.canto, cantoA: 0.38, detalle: 1, hiedra: r2() < 0.45, setas: r2() < 0.5, barba: true });
          if (r2() < 0.7) helecho(M, z + (r2() < 0.5 ? -1 : 1) * (w + 0.3), y0 - 0.05, 0.45 + r2() * 0.35, PAL.plano, r2, 5, 0.25);
          // un cuervo en alguna rama baja; una telarana entre el tronco y el suelo de algun arbol
          if (r2() < 0.3 && T.perchas.length) { const q = T.perchas[0]; cuervo(M, q.x, q.y, 1.1, PAL.plano, -q.lado); }
          if (r2() < 0.22) telarana(M, z + w * 0.9, y0 + 0.75 + r2() * 0.5, 0.28 + r2() * 0.12, r2);
        }
        for (const s of SITIOS) if (s.z >= za && s.z < zb) sitio(M, s);
      });
    }
  }
  function sitio(M, s) {
    const rr = azar(Math.round(s.z * 97)), z = s.z;
    if (s.t === 'gigante') {
      // EL ARBOL GIGANTE: tres veces el grueso de los otros, raices como contrafuertes, hiedra, setas, un hueco en el pie
      // donde brillan setas palidas y un cuervo en la rama
      const T = arbol(M, z, y0 - 0.1, 9, 1.9, PAL.plano, rr, { raices: true, escalaRaiz: 1.1, ramas: 3, canto: PAL.canto, cantoA: 0.45, cantoAncho: 0.03, escala: 1.4, detalle: 1, hiedra: true, setas: true, barba: true });
      M.fillStyle = '#020304';
      M.beginPath(); M.moveTo(z - 0.55, y0 - 0.05); M.quadraticCurveTo(z - 0.5, y0 + 1.5, z + 0.05, y0 + 1.75); M.quadraticCurveTo(z + 0.55, y0 + 1.45, z + 0.6, y0 - 0.05); M.closePath(); M.fill();
      cantoEn(M, bez([z + 0.6, y0 - 0.05], [z + 0.6, y0 + 1.3], [z + 0.06, y0 + 1.72], 10), 0.3, 0.014);
      for (let k = 0; k < 9; k++) { const x = z - 0.35 + rr() * 0.7, y = y0 + 0.02 + rr() * 0.3, h = 0.05 + rr() * 0.06; M.fillStyle = 'rgba(191,227,210,.55)'; M.fillRect(x - 0.006, y, 0.012, h); M.fillStyle = 'rgba(191,227,210,.9)'; M.beginPath(); M.ellipse(x, y + h, 0.035 + rr() * 0.03, 0.02, 0, 0, Math.PI); M.fill(); }
      telarana(M, z + 1.55, y0 + 2.5, 0.42, rr);
      if (T.perchas.length) { const q = T.perchas[T.perchas.length - 1]; cuervo(M, q.x, q.y, 1.3, PAL.plano, -q.lado); }      helecho(M, z - 1.9, y0 - 0.05, 0.8, PAL.plano, rr, 6, 0.2); helecho(M, z + 1.8, y0 - 0.05, 0.7, PAL.plano, rr, 6, 0.3);
    } else if (s.t === 'pena') {
      pena(M, z - 1.2, y0 - 0.1, 2.4 + rr() * 0.6, 1.3 + rr() * 0.4, PAL.plano, rr);
      helecho(M, z - 1.3, y0 - 0.05, 0.6, PAL.plano, rr, 5, 0.2); helecho(M, z + 1.4, y0 - 0.05, 0.5, PAL.plano, rr, 5, 0.3);
    } else if (s.t === 'caido') {
      // EL TRONCO CAIDO: apoyado en una pena, de la tierra a 1,4 m: corteza, musgo encima, barbas que cuelgan, un munon de
      // rama, setas en la cara cortada y un helecho que le crece encima
      pena(M, z + 0.9, y0 - 0.1, 1.6, 1.0, PAL.plano, rr);
      const a = [z - 3.4, y0 + 0.05], b = [z + 2.4, y0 + 1.25], r = 0.42, ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(ang), ny = Math.cos(ang);
      const P = (t, u) => [lerp(a[0], b[0], t) + nx * r * u * lerp(0.95, 0.7, t), lerp(a[1], b[1], t) + ny * r * u * lerp(0.95, 0.7, t)];
      M.fillStyle = PAL.plano; M.beginPath();
      for (let t = 0; t <= 1.001; t += 0.05) { const [px, py] = P(t, 1); t === 0 ? M.moveTo(px, py) : M.lineTo(px, py + Math.sin(t * 30) * 0.01); }
      for (let t = 1; t >= -0.001; t -= 0.05) { const [px, py] = P(t, -1); M.lineTo(px, py); }
      M.closePath(); M.fill();
      M.beginPath(); M.ellipse(b[0], b[1], r * 0.25, r * 0.72, ang, 0, 7); M.fill();
      // la cara cortada con sus anillos
      for (let k = 1; k < 4; k++) { M.strokeStyle = `rgba(169,182,184,${0.12 + k * 0.03})`; M.lineWidth = 0.008; M.beginPath(); M.ellipse(b[0], b[1], r * 0.25 * k / 4, r * 0.72 * k / 4, ang, 0, 7); M.stroke(); }
      // vetas a lo largo
      for (let k = 0; k < 14; k++) { const u = rr() * 1.8 - 0.9, ta = rr() * 0.6, tb = ta + 0.1 + rr() * 0.35; M.strokeStyle = mezcla(PAL.plano, PAL.canto, 0.15 + 0.2 * Math.max(0, u), 0.4); M.lineWidth = 0.008; M.beginPath(); const p0 = P(ta, u), p1 = P(tb, u); M.moveTo(p0[0], p0[1]); M.lineTo(p1[0], p1[1]); M.stroke(); }
      cantoEn(M, Array.from({ length: 21 }, (_, i) => P(i / 20, 1)), 0.45, 0.022);
      for (let t = 0.05; t < 0.95; t += 0.04 + rr() * 0.05) { const [x, y] = P(t, 0.85); M.fillStyle = mezcla(PAL.musgo, PAL.musgoLuz, rr() * 0.2); M.beginPath(); M.ellipse(x, y, 0.06 + rr() * 0.1, 0.04 + rr() * 0.05, ang, 0, 7); M.fill(); }
      for (let t = 0.15; t < 0.9; t += 0.08 + rr() * 0.08) { const [x, y] = P(t, -1); barba(M, x, y + 0.02, 0.15 + rr() * 0.45, PAL.plano, rr); }
      const m = P(0.6, 0.6); cinta(M, [[m[0], m[1]], [m[0] + 0.15, m[1] + 0.45], [m[0] + 0.32, m[1] + 0.8]], 0.12, 0.05, PAL.plano);
      const hp = P(0.35, 0.9); helecho(M, hp[0], hp[1], 0.35, PAL.plano, rr, 4, 0.25);
      for (let k = 0; k < 4; k++) { const [x, y] = P(0.92, 0.2 * k - 0.3); M.fillStyle = PAL.plano; M.beginPath(); M.ellipse(x + 0.06, y, 0.07, 0.025, 0.2, 0, Math.PI); M.fill(); M.strokeStyle = 'rgba(191,227,210,.3)'; M.lineWidth = 0.008; M.beginPath(); M.moveTo(x, y); M.lineTo(x + 0.13, y + 0.01); M.stroke(); }
    } else if (s.t === 'claro') {
      // EL CLARO: un tocon viejo con sus anillos y su musgo, un corro de setas que brillan y dos piedras
      const col = PAL.plano;
      M.fillStyle = col; M.beginPath(); M.moveTo(z - 0.58, y0 - 0.1); M.lineTo(z - 0.5, y0 + 0.55); M.lineTo(z - 0.22, y0 + 0.63); M.lineTo(z - 0.05, y0 + 0.5); M.lineTo(z + 0.18, y0 + 0.66); M.lineTo(z + 0.48, y0 + 0.55); M.lineTo(z + 0.58, y0 - 0.1); M.closePath(); M.fill();
      for (const lado of [-1, 1]) raiz(M, z + lado * 0.4, y0 - 0.05, lado, 0.6, 0.1, col, rr, lado > 0 ? 0.3 : 0);
      cantoEn(M, [[z - 0.5, y0 + 0.55], [z - 0.22, y0 + 0.63], [z - 0.05, y0 + 0.5], [z + 0.18, y0 + 0.66], [z + 0.48, y0 + 0.55]], 0.5, 0.022);
      for (let k = 0; k < 12; k++) { M.fillStyle = mezcla(PAL.musgo, PAL.musgoLuz, rr() * 0.2); M.beginPath(); M.ellipse(z - 0.45 + rr() * 0.9, y0 + rr() * 0.4, 0.05 + rr() * 0.06, 0.03, rr(), 0, 7); M.fill(); }
      for (let k = 0; k < 16; k++) { const x = z + Math.cos(k / 16 * Math.PI * 2) * 1.35 + (rr() - 0.5) * 0.2, h = 0.07 + rr() * 0.08; M.fillStyle = 'rgba(191,227,210,.45)'; M.fillRect(x - 0.008, y0 - 0.02, 0.016, h); M.fillStyle = PAL.setas; M.beginPath(); M.ellipse(x, y0 + h, 0.045 + rr() * 0.03, 0.022, 0, 0, Math.PI); M.fill(); }
      pena(M, z + 1.7, y0 - 0.1, 0.5, 0.28, col, rr); pena(M, z - 2.1, y0 - 0.1, 0.35, 0.2, col, rr);
    } else if (s.t === 'cartel') {
      // EL CARTEL VIEJO: el poste torcido y una chapa con franjas de aviso, comida de hiedra; lo primero que dice que
      // alli delante hay alguien (el muro)
      const px = z, ang = -0.12;
      M.save(); M.translate(px, y0 - 0.1); M.rotate(ang);
      M.fillStyle = PAL.plano; M.fillRect(-0.05, 0, 0.1, 1.55);
      M.fillRect(-0.42, 1.0, 0.84, 0.52);
      M.save(); M.beginPath(); M.rect(-0.38, 1.04, 0.76, 0.44); M.clip();
      for (let k = -6; k < 8; k++) { M.fillStyle = k % 2 ? 'rgba(110,104,84,.32)' : 'rgba(20,24,25,.9)'; M.beginPath(); M.moveTo(-0.5 + k * 0.12, 1.0); M.lineTo(-0.38 + k * 0.12, 1.0); M.lineTo(-0.1 + k * 0.12, 1.55); M.lineTo(-0.22 + k * 0.12, 1.55); M.closePath(); M.fill(); }
      M.restore();
      cantoEn(M, [[-0.42, 1.52], [0.42, 1.52], [0.42, 1.0]], 0.45, 0.018);
      M.fillStyle = '#000'; M.beginPath(); M.arc(0.18, 1.3, 0.025, 0, 7); M.fill(); M.beginPath(); M.arc(-0.2, 1.18, 0.018, 0, 7); M.fill();
      M.restore();
      // la hiedra sube pegada al poste (que se inclina hacia la derecha) y trepa por el canto de la chapa
      for (let k = 0; k < 24; k++) { const t = Math.pow(rr(), 0.8), y = y0 - 0.1 + t * 1.25, x = px + (y - y0) * 0.12 + (rr() - 0.5) * 0.1; hojaHiedra(M, x, y, 0.045 + rr() * 0.03, rr() * 2 - 1, PAL.hoja, rr() < 0.3 ? 0.3 : 0); }
      helecho(M, px - 0.4, y0 - 0.05, 0.45, PAL.plano, rr, 5, 0.2);
    }
  }
  // ---- el suelo: masa oscura, un borde vivo (musgo en matas de distinto tamano, hojarasca, piedras, ramitas, brotes y
  // setas) y debajo raices y piedras metidas
  for (let za = z0 - 12; za < z1 + 12; za += 9) {
    const zb = za + 9;
    pieza(za, zb, y0 + 1.9, y0 - alto, 'suelo', (M) => {
      const rr = azar(Math.round(za * 13 + 7));
      const alza = (x) => 0.025 + Math.max(0, Math.sin(x * 0.9 + 1.3) * Math.sin(x * 2.3)) * 0.06 + Math.sin(x * 7.1) * 0.008;
      const g = M.createLinearGradient(0, y0, 0, y0 - alto);
      g.addColorStop(0, PAL.tierra); g.addColorStop(1, PAL.tierraHonda);
      M.fillStyle = g; M.beginPath(); M.moveTo(za, y0 - alto); for (let x = za; x <= zb + 0.01; x += 0.05) M.lineTo(x, y0 + alza(x)); M.lineTo(zb, y0 - alto); M.closePath(); M.fill();
      // debajo: vetas de tierra, raices que bajan y piedras metidas, apenas
      for (let k = 0; k < 6; k++) { const y = y0 - 0.25 - k * 0.3 - rr() * 0.1; M.strokeStyle = 'rgba(20,26,28,.5)'; M.lineWidth = 0.01; M.beginPath(); for (let x = za; x <= zb; x += 0.3) M.lineTo(x, y + Math.sin(x * 1.3 + k) * 0.04); M.stroke(); }
      for (let k = 0; k < 10; k++) { const x = za + rr() * 9, l = 0.4 + rr() * 1.4; M.strokeStyle = PAL.raiz; M.lineWidth = 0.025 + rr() * 0.045; M.beginPath(); M.moveTo(x, y0 - 0.02); M.bezierCurveTo(x + (rr() - 0.5) * 0.6, y0 - l * 0.4, x + (rr() - 0.5) * 0.8, y0 - l * 0.7, x + (rr() - 0.5), y0 - l); M.stroke(); }
      for (let k = 0; k < 6; k++) { const x = za + rr() * 9, y = y0 - 0.25 - rr() * 1.4, r = 0.05 + rr() * 0.1; M.fillStyle = 'rgba(16,21,23,.7)'; M.beginPath(); M.ellipse(x, y, r * 1.4, r, rr(), 0, 7); M.fill(); M.strokeStyle = 'rgba(169,182,184,.06)'; M.lineWidth = 0.008; M.beginPath(); M.ellipse(x, y, r * 1.4, r, 0, 0.3, 2.8); M.stroke(); }
      // el borde: matas de musgo en grupos (de una en una a paso fijo era una fila de cuentas)
      for (let x = za - 0.3; x < zb + 0.3; x += 0.45 + rr() * 1.4) {
        const n = 2 + Math.floor(rr() * 5), ancho = 0.12 + rr() * 0.4;
        for (let k = 0; k < n; k++) {
          const cx = x + (k / n) * ancho + (rr() - 0.5) * 0.05, r = 0.03 + rr() * 0.09 * (1 - Math.abs(k / n - 0.5)), cy = y0 + alza(cx) - r * 0.3;
          M.fillStyle = mezcla(PAL.musgo, PAL.plano, rr() * 0.4); M.beginPath(); M.ellipse(cx, cy, r * 1.3, r, 0, 0, 7); M.fill();
          if (rr() < 0.35) { M.save(); M.strokeStyle = `rgba(118,135,127,${0.25 + rr() * 0.3})`; M.lineWidth = 0.012; M.beginPath(); M.ellipse(cx, cy, r * 1.3, r, 0, 0.5, Math.PI - 0.6); M.stroke(); M.restore(); }
        }
      }
      // hojarasca, piedrecitas y ramitas sobre el borde
      for (let k = 0; k < 70; k++) {
        const x = za + rr() * 9, y = y0 + alza(x) * rr(), a = (rr() - 0.5) * 0.6, r = 0.025 + rr() * 0.035;
        M.fillStyle = rr() < 0.5 ? '#141a17' : '#101413'; M.beginPath(); M.ellipse(x, y, r, r * 0.35, a, 0, 7); M.fill();
      }
      for (let k = 0; k < 14; k++) { const x = za + rr() * 9, r = 0.025 + rr() * 0.05, y = y0 + alza(x) - r * 0.2; M.fillStyle = '#121618'; M.beginPath(); M.ellipse(x, y, r * 1.3, r, 0, 0, 7); M.fill(); M.strokeStyle = 'rgba(169,182,184,.3)'; M.lineWidth = 0.008; M.beginPath(); M.ellipse(x, y, r * 1.3, r, 0, 0.4, 2.6); M.stroke(); }
      for (let k = 0; k < 8; k++) { const x = za + rr() * 9, l = 0.15 + rr() * 0.4, a = (rr() - 0.5) * 0.4, y = y0 + alza(x) + 0.01; M.strokeStyle = PAL.plano; M.lineWidth = 0.012 + rr() * 0.01; M.beginPath(); M.moveTo(x, y); M.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.3); M.lineTo(x + Math.cos(a) * l * 0.7 + 0.05, y + 0.06); M.stroke(); }
      // HIERBA en silueta, muy junta: una capa baja y espesa, otra alta por rodales con espigas, y matas sueltas mas altas
      pasto(M, za, zb, y0 - 0.02, 0.32, '#0b1012', rr, 0.03, { alza: (x) => alza(x) * 0.5, viento: 0.08, espiga: 0, sem: 1 });
      pasto(M, za, zb, y0 - 0.04, 0.85, PAL.plano, rr, 0.045, { alza: (x) => alza(x) * 0.4, viento: 0.14, espiga: 0.07, sem: 2 });
      for (let x = za + rr(); x < zb; x += 0.7 + rr() * 1.6) pasto(M, x, x + 0.15 + rr() * 0.25, y0 - 0.05, 0.9 + rr() * 0.35, PAL.plano, rr, 0.03, { viento: 0.1, espiga: 0.3 });
      for (let k = 0; k < 4; k++) helecho(M, za + rr() * 9, y0 + 0.02, 0.15 + rr() * 0.15, PAL.plano, rr, 4, 0.2);
      // setitas sueltas que brillan un poco
      for (let k = 0; k < 3; k++) { const x = za + rr() * 9; for (let j = 0; j < 2 + Math.floor(rr() * 3); j++) { const xx = x + j * 0.05, h = 0.03 + rr() * 0.04; M.fillStyle = 'rgba(191,227,210,.35)'; M.fillRect(xx - 0.004, y0, 0.008, h); M.fillStyle = 'rgba(191,227,210,.75)'; M.beginPath(); M.ellipse(xx, y0 + h, 0.022, 0.012, 0, 0, Math.PI); M.fill(); } }
    });
  }
  // ---- matas bajas delante del 18 (como mucho por los tobillos)
  for (let za = z0 - 12; za < z1 + 12; za += 16) {
    const zb = za + 16;
    pieza(za, zb, y0 + 0.8, y0 - 0.3, 'delante', (M) => {
      const rr = azar(Math.round(za * 31 + 3));
      for (let x = za; x < zb; x += 1.2 + rr() * 2.6) {
        if (rr() < 0.55) helecho(M, x, y0 - 0.12, 0.3 + rr() * 0.25, PAL.frente, rr, 4);
        else mata(M, x, y0 - 0.05, 0.12 + rr() * 0.12, PAL.frente, rr);
      }
    });
  }

  // ================================================================= el primer plano negro (parallax 1,4)
  capa(1.4, 60, 6, (M, xa, xb) => {
    const rr = azar(1701), arriba = y0 + 7.1, abajo = y0 - 1.9;
    for (let x = xa; x < xb; x += 1.2 + rr() * 2.4) {
      if (rr() < 0.6) helecho(M, x, abajo - 0.2, 1.1 + rr() * 0.9, PAL.frente, rr, 6);
      else mata(M, x, abajo + 0.1, 0.5 + rr() * 0.5, PAL.frente, rr);
    }
    for (let x = xa; x < xb; x += 5 + rr() * 7) {
      // una rama con hojas que entra por arriba
      M.strokeStyle = PAL.frente; M.lineWidth = 0.12;
      const ex = x + 2 + rr() * 2, ey = arriba - 0.8 - rr() * 1.2;
      M.beginPath(); M.moveTo(x, arriba + 0.6); M.quadraticCurveTo(x + 1, arriba - 0.2, ex, ey); M.stroke();
      for (let k = 0; k < 6; k++) mata(M, lerp(x + 0.6, ex, k / 5), lerp(arriba, ey, k / 5) - 0.1, 0.25 + rr() * 0.3, PAL.frente, rr);
      if (rr() < 0.5) barba(M, ex, ey, 0.6 + rr() * 0.8, PAL.frente, rr);
    }
  }, salida.frente);

  const bmps = [...salida.capas.map((c) => c.bmp), ...salida.piezas.map((p) => p.bmp), ...salida.frente.map((p) => p.bmp)];
  postMessage({ ...salida, ms: Math.round(performance.now() - t0) }, bmps);
}

self.onmessage = (e) => {
  try { pintar(e.data); } catch (err) { postMessage({ error: String((err && err.stack) || err) }); }
};
