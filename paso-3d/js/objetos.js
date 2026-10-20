// LOS OBJETOS DEL CONDUCTO, que la vista ve primero en 2D y luego en 3D: una valvula en la pared, una rejilla caida,
// un bidon, cajas, cables que cuelgan y un tablon. Cada uno tiene su DIBUJO (lienzo con la tinta del juego, en un plano
// de pie donde estaria en el 2D) y su MODELO (primitivas con el sombreado de dos escalones y casco de tinta). Mientras la
// camara gira, cada uno salta de dibujo a modelo en su momento (el modelo crece en z desde el plano del dibujo), asi que
// en el mismo cuadro hay cosas planas y cosas con volumen. El rotulo pintado de la pared (C-7) se queda 2D: es pintura.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { temblar, trazar, tinta, caja, circulo, linea, azar } from './tinta.js';

const PXM = 220;                       // px por metro de los dibujos
const TINTA = 0.028 * PXM;             // el grueso de la tinta de los sprites, a ojo

// cuando salta cada uno: e es la vista (0 lateral .. 1 detras) y x lo que tiene que haber avanzado el 18
const OBJETOS = [
  { n: 'rotulo', x: 3.9, y: 1.25, z: -0.79, w: 0.7, h: 0.3, nunca: true },
  { n: 'valvula', x: 4.5, y: 1.1, z: -0.68, w: 1.1, h: 0.5, e: 0.28 },
  { n: 'rejilla', x: 5.7, y: 0.42, z: -0.62, w: 0.62, h: 0.86, e: 0.5 },
  { n: 'bidon', x: 6.5, y: 0.34, z: 0.42, w: 0.48, h: 0.7, e: 0.68, choque: [0.21, 0.21] },
  { n: 'cajas', x: 7.5, y: 0.3, z: -0.48, w: 0.75, h: 0.62, e: 0.82, choque: [0.34, 0.27] },
  { n: 'cables', x: 8.7, y: 1.25, z: 0.05, w: 1.3, h: 0.95, hx: 8.1 },
  { n: 'tablon', x: 10.1, y: 0.6, z: 0.5, w: 0.5, h: 1.25, hx: 9.0 },
];

function lienzo(o) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(o.w * PXM); cv.height = Math.ceil(o.h * PXM);
  return cv;
}
// los dibujos, en px con el origen arriba a la izquierda del rectangulo w x h del objeto (y hacia abajo)
const PINTAR = {
  rotulo(c, W, H) {
    c.font = `700 ${0.24 * PXM}px Bahnschrift, "Segoe UI", sans-serif`;
    c.fillStyle = 'rgba(190,200,210,.42)';
    c.fillText('C-7', 4, H * 0.82);
    c.beginPath(); c.moveTo(W * 0.66, H * 0.3); c.lineTo(W * 0.95, H * 0.5); c.lineTo(W * 0.66, H * 0.7); c.closePath(); c.fill();
  },
  valvula(c, W, H) {
    caja(c, 2, H * 0.5 - 0.07 * PXM, W - 4, 0.14 * PXM, '#36404b', 3, 1.2, TINTA * 0.8);
    caja(c, W * 0.5 - 0.07 * PXM, H * 0.5 - 0.1 * PXM, 0.14 * PXM, 0.2 * PXM, '#2b333c', 4, 0.8, TINTA * 0.7);
    circulo(c, W * 0.5, H * 0.5, 0.19 * PXM, null, TINTA, 5, 1.2);
    circulo(c, W * 0.5, H * 0.5, 0.045 * PXM, '#56606b', TINTA * 0.7, 6, 0.5);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.4;
      linea(c, W * 0.5, H * 0.5, W * 0.5 + Math.cos(a) * 0.19 * PXM, H * 0.5 + Math.sin(a) * 0.19 * PXM, TINTA * 0.7, '#0b0a0c', 7 + k, 0.4);
    }
  },
  rejilla(c, W, H) {
    c.save(); c.translate(W / 2, H / 2); c.rotate(-0.12);
    const w = 0.5 * PXM, h = 0.76 * PXM;
    caja(c, -w / 2, -h / 2, w, h, '#3a434c', 8, 1.2, TINTA);
    for (let y = -h / 2 + 12; y < h / 2 - 8; y += 0.07 * PXM) linea(c, -w / 2 + 8, y, w / 2 - 8, y + 4, TINTA * 0.55, '#0b0a0c', 9 + y, 0.5);
    c.restore();
  },
  bidon(c, W, H) {
    const w = 0.42 * PXM, h = 0.66 * PXM, x = (W - w) / 2, y = H - h - 2;
    caja(c, x, y, w, h, '#4a4f46', 10, 1.0, TINTA);
    for (const f of [0.22, 0.55, 0.85]) linea(c, x + 3, y + h * f, x + w - 3, y + h * f, TINTA * 0.6, '#0b0a0c', 11 + f, 0.4);
    c.fillStyle = 'rgba(92,72,58,.5)'; c.fillRect(x + w * 0.6, y + h * 0.25, w * 0.12, h * 0.5);
  },
  cajas(c, W, H) {
    const a = 0.48 * PXM, b = 0.32 * PXM;
    caja(c, 2, H - a - 2, a, a, '#5e5143', 12, 1.2, TINTA);
    linea(c, 6, H - a + 4, a - 4, H - 6, TINTA * 0.55, '#0b0a0c', 13, 0.6);
    caja(c, a - 6, H - b - 2, b, b, '#6a5c4c', 14, 1.0, TINTA);
    caja(c, a * 0.25, H - a - b * 0.8 - 2, b * 0.8, b * 0.8, '#55493c', 15, 1.0, TINTA * 0.9);
  },
  cables(c, W, H) {
    const r = azar(17);
    for (let k = 0; k < 3; k++) {
      const x0 = 6 + k * W * 0.16, x1 = W - 6 - k * W * 0.12, caida = H * (0.45 + 0.25 * r());
      const pts = [];
      for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([x0 + (x1 - x0) * t, 4 + Math.sin(t * Math.PI) * caida]); }
      trazar(c, pts, false); tinta(c, TINTA * (0.6 + 0.2 * k));
    }
    linea(c, W * 0.42, H * 0.55, W * 0.38, H - 4, TINTA * 0.7, '#0b0a0c', 18, 0.6);   // uno suelto que cuelga
  },
  tablon(c, W, H) {
    c.save(); c.translate(W / 2, H / 2); c.rotate(0.28);
    const w = 0.16 * PXM, h = 1.15 * PXM;
    caja(c, -w / 2, -h / 2, w, h, '#6b5b49', 19, 1.2, TINTA);
    for (const f of [-0.3, 0.05, 0.32]) linea(c, -w / 2 + 3, h * f, w / 2 - 3, h * f + 2, TINTA * 0.4, 'rgba(0,0,0,.6)', 20 + f, 0.3);
    c.restore();
  },
};

// los modelos, en metros alrededor del centro del objeto (z = 0 es el plano de su dibujo)
function modelos(M) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), Yv = new THREE.Vector3(0, 1, 0);
  const barra = (a, b, r, n = 8) => {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    return new THREE.CylinderGeometry(r, r, L, n).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Yv, d.normalize())).translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  };
  return {
    valvula: () => [
      [M.acero, [barra(V(-0.55, 0, -0.06), V(0.55, 0, -0.06), 0.07, 12), barra(V(0, 0, -0.12), V(0, 0, 0.07), 0.055, 10)]],
      [M.aceroOsc, [new THREE.TorusGeometry(0.19, 0.022, 6, 22).translate(0, 0, 0.08), new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10).rotateX(Math.PI / 2).translate(0, 0, 0.08),
        ...[0, 1, 2, 3].map((k) => barra(V(0, 0, 0.08), V(Math.cos(k * Math.PI / 2 + 0.4) * 0.19, Math.sin(k * Math.PI / 2 + 0.4) * 0.19, 0.08), 0.012, 5))]],
    ],
    rejilla: () => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22, 0, -0.12));
      const gs = [new THREE.BoxGeometry(0.5, 0.76, 0.03)];
      for (let y = -0.3; y <= 0.31; y += 0.07) gs.push(new THREE.BoxGeometry(0.44, 0.018, 0.05).translate(0, y, 0.02));
      return [[M.acero, gs.map((g) => g.applyQuaternion(q))]];
    },
    bidon: () => [
      [M.bidon, [new THREE.CylinderGeometry(0.21, 0.21, 0.66, 16)]],
      [M.aceroOsc, [0.22, 0.55, 0.85].map((f) => new THREE.TorusGeometry(0.212, 0.012, 4, 16).rotateX(Math.PI / 2).translate(0, 0.33 - 0.66 * f, 0))],
    ],
    cajas: () => [
      [M.madera, [new THREE.BoxGeometry(0.48, 0.48, 0.44).translate(-0.12, -0.07, 0), new THREE.BoxGeometry(0.32, 0.32, 0.3).rotateY(0.3).translate(0.2, -0.15, 0.06),
        new THREE.BoxGeometry(0.26, 0.26, 0.26).rotateY(-0.25).translate(-0.12, 0.3, 0.02)]],
    ],
    cables: () => {
      const gs = [];
      for (let k = 0; k < 3; k++) {
        const x0 = -0.62 + k * 0.2, x1 = 0.62 - k * 0.16, caida = 0.45 + 0.12 * k, z = -0.25 + k * 0.22;
        for (let i = 0; i < 10; i++) {
          const t0 = i / 10, t1 = (i + 1) / 10;
          const p = (t) => V(x0 + (x1 - x0) * t, 0.45 - Math.sin(t * Math.PI) * caida, z);
          gs.push(barra(p(t0), p(t1), 0.014 + 0.004 * k, 5));
        }
      }
      gs.push(barra(V(-0.1, -0.05, 0.1), V(-0.15, -0.45, 0.12), 0.014, 5));
      return [[M.cuerda, gs]];
    },
    tablon: () => [[M.madera, [new THREE.BoxGeometry(0.16, 1.15, 0.04).rotateZ(-0.28).rotateX(0.18)]]],
  };
}

export function crearObjetos(scene, M, materialCarton, choques) {
  const lista = [], texturas = [];
  const fabricas = modelos(M);
  const limpia = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; };
  for (const o of OBJETOS) {
    const cv = lienzo(o);
    PINTAR[o.n](cv.getContext('2d'), cv.width, cv.height);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.NoColorSpace;
    texturas.push(t);
    const dibujo = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h).translate(o.x, o.y, o.z), materialCarton(t, true));
    dibujo.renderOrder = 1;
    scene.add(dibujo);
    let grupo = null;
    if (!o.nunca) {
      grupo = new THREE.Group();
      grupo.position.set(o.x, o.y, o.z);
      for (const [mat, gs] of fabricas[o.n]()) {
        const g = mergeGeometries(gs.map(limpia));
        const m = new THREE.Mesh(g, mat);
        grupo.add(m);
        // casco de tinta: la misma malla un poco mas gorda, por dentro
        const gt = g.clone();
        const p = gt.attributes.position, n = gt.attributes.normal;
        for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * 0.012, p.getY(i) + n.getY(i) * 0.012, p.getZ(i) + n.getZ(i) * 0.012);
        grupo.add(new THREE.Mesh(gt, M.tinta));
      }
      grupo.visible = false;
      scene.add(grupo);
    }
    if (o.choque) choques.cajas.push({ x: o.x, z: o.z, hx: o.choque[0], hz: o.choque[1], ang: 0 });
    lista.push({ ...o, dibujo, grupo, pop: -1, s: 0 });
  }
  const sobre = (k) => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;
  // en la simulacion (para que __dbg.ir lo reproduzca): devuelve cuantos saltan ahora
  function paso(t, hx, e, activa) {
    let nuevos = 0;
    for (const o of lista) {
      if (o.nunca) continue;
      if (o.pop < 0 && activa && (o.e !== undefined ? e >= o.e : hx >= o.hx)) { o.pop = t; nuevos++; }
      const k = o.pop < 0 ? 0 : Math.min(1, (t - o.pop) / 0.4);
      o.s = k <= 0 ? 0 : k >= 1 ? 1 : sobre(k);
    }
    return nuevos;
  }
  function pintar() {
    for (const o of lista) {
      if (!o.grupo) continue;
      o.grupo.visible = o.s > 0.001;
      o.grupo.scale.z = Math.max(0.001, o.s);
      o.dibujo.visible = o.s < 0.6;
    }
  }
  function reiniciar() { for (const o of lista) { o.pop = -1; o.s = 0; } pintar(); }
  return { lista, paso, pintar, reiniciar, texturas };
}
