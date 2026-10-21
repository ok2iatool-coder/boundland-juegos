// EL BLOQUE EN T del Muro Exterior (los de los puestos de control, «T-wall»): un PIE de 1,6 x 0,5 m con las cartelas que
// lo unen al ALMA, y el alma, de 30 cm abajo a 22 arriba, hasta los 4 m. Cotas de `MURO_EXTERIOR` del documento del
// mundo (boundland-bosque3d/diseno/planos, solo leido): alto 4, pie 1,6, alto del pie 0,5, grueso 0,3, bloque 1,2.
//
// El pie con las cartelas es UN perfil (corte transversal) extruido a lo largo del muro; el alma es su alzado (con los
// dos agujeros de izado y los cantos comidos) extruido a lo grueso y luego estrechado hacia arriba. Los dos con chaflan
// de verdad (el bisel de ExtrudeGeometry): la luz rasante se queda en el canto, que es lo que hace que lea hormigon
// prefabricado y no una caja. Los desconchones son MUESCAS del contorno (salen en la silueta y en la sombra); en los
// grandes asoma la ferralla.
import * as THREE from 'three';

export const T = { ALTO: 4.0, PIE: 1.6, ALTO_PIE: 0.5, GRUESO: 0.3, GRUESO_ARRIBA: 0.22, LARGO: 1.2, CARTELA: 0.2 };
export const ALMA_Y0 = T.ALTO_PIE + 0.12;               // el alma empieza dentro de la cartela (no queda costura)
const B = 0.018;                                         // el chaflan

// el grueso del alma (medio) a una altura: lo usan el bloque, las calcomanias y los choques
export const medioGrueso = (y) => {
  const k = Math.max(0, Math.min(1, (y - ALMA_Y0) / (T.ALTO - ALMA_Y0)));
  return (T.GRUESO + (T.GRUESO_ARRIBA - T.GRUESO) * k) / 2;
};

const extruir = (forma, largo) => new THREE.ExtrudeGeometry(forma, {
  depth: largo - 2 * B, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelOffset: -B, bevelSegments: 2, curveSegments: 10,
});

// el pie con las cartelas, en (z, y), extruido a lo largo (x); centrado en x
function pie(largo) {
  const P = T.PIE / 2, g0 = T.GRUESO / 2 - 0.004, c = T.CARTELA, y1 = T.ALTO_PIE;
  const f = new THREE.Shape();
  f.moveTo(-P, 0); f.lineTo(P, 0); f.lineTo(P, y1);
  f.lineTo(g0 + c, y1); f.lineTo(g0, y1 + c); f.lineTo(g0, ALMA_Y0 + 0.04);
  f.lineTo(-g0, ALMA_Y0 + 0.04); f.lineTo(-g0, y1 + c); f.lineTo(-g0 - c, y1); f.lineTo(-P, y1);
  f.closePath();
  const g = extruir(f, largo);
  // forma: x -> z del mundo, y -> y, extrusion (z de la forma) -> x del mundo
  g.rotateY(-Math.PI / 2).translate(largo / 2 - B, 0, 0);
  return g;
}

// el alzado del alma en (x, y) con sus desconchones; devuelve tambien donde asoma la ferralla
function alma(largo, r) {
  const u0 = -largo / 2, u1 = largo / 2, y0 = ALMA_Y0, y1 = T.ALTO;
  const pts = [];
  const ferralla = [];
  // canto vertical: de y0 a y1 por u (lado 1) o al reves; muesca ocasional
  function canto(u, sube, s) {
    if (r() < 0.32) {
      const ym = 1.3 + r() * 2.1, h = 0.05 + r() * 0.12, p = 0.012 + r() * 0.035;
      const a = [[u, ym - h], [u - s * p, ym - h * 0.35], [u - s * p * 0.7, ym + h * 0.4], [u, ym + h]];
      pts.push(...(sube ? a : a.reverse()));
    }
  }
  pts.push([u0, y0], [u1, y0]);
  canto(u1, true, 1);
  // esquina de arriba (derecha y luego izquierda), rota o no
  function esquina(u, s) {
    if (r() < 0.38) {
      const a = 0.04 + r() * 0.13, b = 0.03 + r() * 0.11;
      const m = [u - s * a * (0.3 + r() * 0.4), y1 - b * (0.3 + r() * 0.5)];
      if (a > 0.1 && b > 0.07) ferralla.push([u - s * 0.06, y1 - 0.06]);
      return s > 0 ? [[u, y1 - b], m, [u - s * a, y1]] : [[u - s * a, y1], m, [u, y1 - b]];
    }
    return [[u, y1]];
  }
  pts.push(...esquina(u1, 1));
  // la tapa: de derecha a izquierda, con una o dos muescas
  const n = r() < 0.45 ? 1 + (r() < 0.35 ? 1 : 0) : 0;
  const muescas = [];
  for (let k = 0; k < n; k++) muescas.push(u0 + 0.22 + r() * (largo - 0.44));
  muescas.sort((a, b) => b - a);
  for (const um of muescas) {
    const w = 0.05 + r() * 0.12, p = 0.015 + r() * 0.05;
    pts.push([um + w / 2, y1], [um + w * 0.2, y1 - p], [um - w * 0.25, y1 - p * 0.7], [um - w / 2, y1]);
  }
  pts.push(...esquina(u0, -1));
  canto(u0, false, -1);
  const f = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? f.lineTo(x, y) : f.moveTo(x, y)));
  f.closePath();
  // los dos agujeros de izado (pasan la eslinga), a 30 cm de la tapa
  for (const ua of [-0.3, 0.3]) {
    const h = new THREE.Path();
    h.absarc(ua, y1 - 0.3, 0.045, 0, Math.PI * 2, true);
    f.holes.push(h);
  }
  const g = extruir(f, T.GRUESO);
  g.translate(0, 0, -T.GRUESO / 2 + B);
  // estrechar: el grueso baja de 30 a 22 cm hacia arriba (el perfil de un T-wall)
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), y = p.getY(i);
    p.setZ(i, z * medioGrueso(y) / (T.GRUESO / 2));
  }
  g.computeVertexNormals();
  return { g, ferralla };
}

// un bloque entero, en sus ejes (x a lo largo, z = 0 el plano medio, y = 0 el suelo); r: azar
export function bloqueT(r, largo = T.LARGO - 0.035) {
  const a = alma(largo, r);
  const g = [pie(largo), a.g].map((x) => (x.index ? x.toNonIndexed() : x));
  for (const x of g) x.deleteAttribute('uv');
  return { piezas: g, ferralla: a.ferralla };
}

// las UV en el mundo (1 = 1 m), segun hacia donde mira cada cara, y un desfase por bloque
export function uvMundo(g, ox, oy) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), nz = Math.abs(n.getZ(i));
    let u, v;
    if (nz >= nx && nz > 0.4) { u = p.getX(i); v = p.getY(i); }
    else if (nx > 0.4) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getZ(i); }
    uv[i * 2] = u + ox; uv[i * 2 + 1] = v + oy;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// textura del hormigon de los bloques (se repite cada 2,4 m): gris de prefabricado con poros, aridos, la piel lisa del
// molde con ondas, chorretones desde la tapa, manchas y eflorescencia. Todo se pinta con vuelta (sin costura)
export function texturaHormigonT() {
  const N = 1024, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const c = cv.getContext('2d');
  let s = 91; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const vuelta = (f) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { c.save(); c.translate(dx, dy); f(); c.restore(); } };
  c.fillStyle = '#a3a6a4'; c.fillRect(0, 0, N, N);
  // manchas grandes (tonos del cemento de cada amasada)
  for (let n = 0; n < 90; n++) {
    const x = r() * N, y = r() * N, rr = 40 + r() * 220, v = r() < 0.55 ? '58,60,62' : '196,198,194', a = 0.03 + r() * 0.07;
    vuelta(() => { const g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, `rgba(${v},${a})`); g.addColorStop(1, `rgba(${v},0)`); c.fillStyle = g; c.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); });
  }
  // la piel del molde: ondas horizontales muy suaves
  for (let y = 0; y < N; y += 3) {
    const a = 0.018 * (0.5 + 0.5 * Math.sin(y * 0.021 + Math.sin(y * 0.0063) * 3));
    c.fillStyle = `rgba(40,42,44,${a})`; c.fillRect(0, y, N, 2);
  }
  // aridos asomando y poros (burbujas del vibrado)
  for (let n = 0; n < 9000; n++) {
    const x = r() * N, y = r() * N, k = r();
    if (k < 0.6) { c.fillStyle = `rgba(${r() < 0.5 ? '70,70,68' : '190,188,182'},${0.12 + r() * 0.2})`; c.fillRect(x, y, 1 + r() * 2, 1 + r() * 2); }
    else if (k < 0.93) { c.fillStyle = `rgba(30,31,32,${0.25 + r() * 0.35})`; c.beginPath(); c.arc(x, y, 0.6 + r() * 1.4, 0, 7); c.fill(); }
    else { const rr = 1.5 + r() * 3.5; c.fillStyle = 'rgba(28,29,30,.55)'; c.beginPath(); c.ellipse(x, y, rr, rr * (0.6 + r() * 0.4), r() * 3, 0, 7); c.fill(); c.fillStyle = 'rgba(220,220,214,.25)'; c.beginPath(); c.arc(x - rr * 0.3, y + rr * 0.4, rr * 0.45, 0, 7); c.fill(); }
  }
  // chorretones de lluvia (la textura se repite cada 2,4 m: la tapa de los bloques cae en y = 0,4 de la textura y
  // tambien los hay sueltos)
  for (let n = 0; n < 150; n++) {
    const x = r() * N, y0 = r() * N, h = 60 + r() * 480, w = 1 + r() * 6, oscuro = r() < 0.8;
    vuelta(() => {
      const g = c.createLinearGradient(0, y0, 0, y0 + h);
      const v = oscuro ? '44,46,48' : '214,214,206', a = oscuro ? 0.06 + r() * 0.12 : 0.05 + r() * 0.08;
      g.addColorStop(0, `rgba(${v},${a})`); g.addColorStop(0.7, `rgba(${v},${a * 0.5})`); g.addColorStop(1, `rgba(${v},0)`);
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x, y0);
      for (let k = 0; k <= 8; k++) c.lineTo(x + Math.sin(k * 1.3 + x) * 1.5 + (k / 8) * w * 0.3, y0 + h * k / 8);
      c.lineTo(x + w * 0.4, y0 + h); for (let k = 8; k >= 0; k--) c.lineTo(x + w + Math.sin(k * 1.1 + x) * 1.2, y0 + h * k / 8);
      c.fill();
    });
  }
  // grietas finas de retraccion
  c.lineCap = 'round';
  for (let n = 0; n < 14; n++) {
    let x = r() * N, y = r() * N, ang = r() * 6.28;
    c.strokeStyle = 'rgba(35,36,37,.38)'; c.lineWidth = 0.9;
    vuelta(() => { c.beginPath(); c.moveTo(x, y); let xx = x, yy = y, aa = ang; for (let k = 0; k < 14; k++) { aa += (r() - 0.5) * 0.9; xx += Math.cos(aa) * 9; yy += Math.sin(aa) * 9; c.lineTo(xx, yy); } c.stroke(); });
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.repeat.set(1 / 2.4, 1 / 2.4);
  return t;
}
