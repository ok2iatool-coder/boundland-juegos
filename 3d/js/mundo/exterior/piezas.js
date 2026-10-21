// LAS PIEZAS del Muro Exterior, cada una de su tamano de verdad: bidon de 200 l (0,58 x 0,88), pale europeo
// (1,2 x 0,8 x 0,144), caja de madera, frigorifico, coche pequeno (3,9 m, perfil extruido con los pasos de rueda y el
// canto redondeado), gavion tipo Hesco (malla de 7,6 cm con geotextil, que se abomba), erizo checo, concertina (espiral
// de 0,9 m con sus cuchillas), chapa grecada, arbol seco, torre de alta tension y cuerda. L: los lotes (lotes.js).
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const azar = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

// BIDON de pie (o tumbado a lo largo de x con o.tumbado). fila: el color de la textura (0 azul, 1 oliva, 2 granate, 3 negro)
export function bidon(L, x, y, z, o = {}) {
  const R = 0.29, H = 0.88, k = o.mat || 'bidon';
  const g = new THREE.CylinderGeometry(R, R, H, 22, 6, false);
  const uv = g.attributes.uv, p = g.attributes.position, fila = o.fila ?? 0, r = azar(o.semilla ?? 7);
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (fila + 1 - uv.getY(i)) / 4);
  // abolladuras: la chapa se hunde en un par de sitios
  const ab = [[r() * 6.28, (r() - 0.5) * 0.6, 0.012 + r() * 0.02], [r() * 6.28, (r() - 0.5) * 0.6, r() * 0.015]];
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i)), yy = p.getY(i), rr = Math.hypot(p.getX(i), p.getZ(i));
    if (rr < R * 0.98) continue;
    let d = 0;
    for (const [aa, ya, h] of ab) { const da = Math.atan2(Math.sin(a - aa), Math.cos(a - aa)); d += h * Math.exp(-(da * da) / 0.12 - ((yy - ya) ** 2) / 0.03); }
    // los dos aros: la chapa sale 6 mm
    d -= 0.006 * (Math.exp(-(((yy - H / 6) / 0.012) ** 2)) + Math.exp(-(((yy + H / 6) / 0.012) ** 2)));
    const f = (rr - d) / rr;
    p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  const q = new THREE.Quaternion();
  if (o.tumbado) q.setFromAxisAngle(V(0, 0, 1), Math.PI / 2);
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), o.giro ?? r() * 6.28));
  const m = new THREE.Matrix4().compose(V(x, y + (o.tumbado ? R : H / 2), z), q, V(1, 1, 1));
  g.applyMatrix4(m);
  L.meter(k, g, o.color);
  L.tinta(g, 0.01);
  // la tapa con sus dos tapones
  if (!o.tumbado && o.tapa !== false) {
    L.cilindro(k, V(x, y + H, z), V(x, y + H + 0.012, z), R - 0.01, 18, 0, o.color);
    for (const [dx, dz, rr] of [[0.17, 0.05, 0.035], [-0.16, -0.08, 0.025]]) L.cilindro('aceroOsc', V(x + dx, y + H, z + dz), V(x + dx, y + H + 0.025, z + dz), rr, 8, 0);
  }
  return H;
}

// PALE europeo (1,2 x 0,8 x 0,144) centrado en (x, z) apoyado en y; giro sobre y
export function pale(L, x, y, z, giro = 0, color) {
  const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), giro);
  const pon = (cx, cy, cz, w, h, d) => {
    const p = V(cx, cy, cz).applyQuaternion(q).add(V(x, y, z));
    L.caja('madera', p.x, p.y, p.z, w, h, d, { q, tinta: 0.006, color });
  };
  for (const dz of [-0.345, 0, 0.345]) pon(0, 0.011, dz, 1.2, 0.022, 0.1);                  // tablas de abajo
  for (const dx of [-0.53, 0, 0.53]) for (const dz of [-0.345, 0, 0.345]) pon(dx, 0.022 + 0.039, dz, 0.145, 0.078, dz ? 0.1 : 0.145);   // tacos
  for (const dx of [-0.53, 0, 0.53]) pon(dx, 0.1 + 0.011, 0, 0.145, 0.022, 0.8);            // largueros
  for (const [dx, w] of [[-0.525, 0.145], [-0.26, 0.1], [0, 0.145], [0.26, 0.1], [0.525, 0.145]]) pon(dx, 0.122 + 0.011, 0, w, 0.022, 0.8);   // tablas de arriba
  return 0.144;
}

// CAJA de madera: el cuerpo, los listones de las esquinas y un pictograma (cas: 0 este lado arriba, 1 fragil, 2 seco)
export function cajaMadera(L, x0, x1, y0, y1, z0, z1, o = {}) {
  const color = o.color;
  L.cajaE('madera', x0 + 0.012, x1 - 0.012, y0, y1, z0 + 0.012, z1 - 0.012, { tinta: 0.008, color });
  const e = 0.03;
  for (const [a, b] of [[x0, z0], [x1 - e, z0], [x0, z1 - e], [x1 - e, z1 - e]]) L.cajaE('madera', a, a + e, y0, y1, b, b + e, { tinta: 0, color: o.color2 || color });
  for (const yy of [y0, y1 - e]) {
    L.cajaE('madera', x0, x1, yy, yy + e, z0, z0 + e, { tinta: 0, color: o.color2 || color });
    L.cajaE('madera', x0, x1, yy, yy + e, z1 - e, z1, { tinta: 0, color: o.color2 || color });
  }
  if (o.picto != null) {
    const w = Math.min(0.36, (x1 - x0) * 0.6), h = Math.min(0.36, (y1 - y0) * 0.65), lado = o.lado ?? 1;
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (o.picto + uv.getX(i)) / 3);
    if (lado < 0) g.rotateY(Math.PI);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, lado > 0 ? z1 + 0.003 : z0 - 0.003);
    L.meter('picto', g);
  }
}

// FRIGORIFICO de pie, viejo: esmalte amarillento con oxido, la junta de la puerta y el tirador
export function nevera(L, x0, x1, y0, y1, z0, z1, frente = 1) {
  L.cajaE('esmalte', x0, x1, y0, y1, z0, z1, { tinta: 0.01 });
  const zf = frente > 0 ? z1 : z0, s = frente;
  L.cajaE('negro', x0 + 0.02, x1 - 0.02, y1 - 0.42, y1 - 0.41, Math.min(zf, zf + s * 0.004), Math.max(zf, zf + s * 0.004), { tinta: 0 });
  L.cajaE('aceroOsc', x1 - 0.07, x1 - 0.04, y1 - 0.75, y1 - 0.48, Math.min(zf, zf + s * 0.035), Math.max(zf, zf + s * 0.035), { tinta: 0.004 });
  L.cajaE('aceroOsc', x0 + 0.03, x1 - 0.03, y0, y0 + 0.08, Math.min(zf, zf + s * 0.006), Math.max(zf, zf + s * 0.006), { tinta: 0 });
}

// SACOS TERREROS: un cojin de arpillera (60 x 35 x 15 cm aplastado); devuelve la InstancedMesh con todos los de la lista
// [{x, y, z, giro, ladeo}]
export function sacos(lista, material) {
  const g = new THREE.SphereGeometry(0.5, 14, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    y = Math.sign(y) * Math.min(Math.abs(y), 0.3) * (1 - 0.15 * x * x);       // aplastado arriba y abajo
    const pliegue = 1 + 0.05 * Math.sin(Math.atan2(z, x) * 9);                 // los pliegues de la boca atada
    p.setXYZ(i, x * 0.6 * (x > 0.35 ? pliegue : 1), y * 0.25, z * 0.36);      // 60 x 36 x 15 cm
  }
  g.computeVertexNormals();
  const m = new THREE.InstancedMesh(g, material, lista.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  const r = azar(3);
  lista.forEach((s, i) => {
    e.set(s.ladeo ?? (r() - 0.5) * 0.08, s.giro ?? 0, (r() - 0.5) * 0.08);
    q.setFromEuler(e);
    M.compose(V(s.x, s.y, s.z), q, V(0.95 + r() * 0.1, 0.9 + r() * 0.2, 0.95 + r() * 0.1));
    m.setMatrixAt(i, M);
    m.setColorAt(i, c.setScalar(0.78 + r() * 0.3));
  });
  m.castShadow = m.receiveShadow = true;
  return m;
}
// un muro de sacos de a a b (en planta), de n hiladas, a matajunta
export function muroSacos(lista, a, b, y0, n, grueso = 1) {
  const d = new THREE.Vector2(b.x - a.x, b.z - a.z), L = d.length(), giro = Math.atan2(-d.y, d.x);
  const u = d.clone().normalize(), w = new THREE.Vector2(-u.y, u.x);
  for (let h = 0; h < n; h++) {
    const paso = 0.56, desf = (h % 2) * paso / 2;
    for (let s = -desf; s < L - 0.1; s += paso) {
      const t = Math.min(L - 0.28, Math.max(0.28, s + 0.28));
      for (let k = 0; k < grueso; k++) {
        const o = (k - (grueso - 1) / 2) * 0.36;
        lista.push({ x: a.x + u.x * t + w.x * o, y: y0 + 0.065 + h * 0.13, z: a.z + u.y * t + w.y * o, giro });
      }
    }
  }
}

// GAVION tipo Hesco: caja de malla con el geotextil que se abomba entre los montantes, la tierra asomando arriba
export function gavion(L, x, y, z, w, h, d, giro = 0) {
  const g = new THREE.BoxGeometry(w, h, d, 6, 6, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i) / (w / 2), py = p.getY(i) / (h / 2), pz = p.getZ(i) / (d / 2);
    const lado = 1 + 0.045 * (1 - py * py) * (Math.abs(px) > 0.99 ? 1 - pz * pz : Math.abs(pz) > 0.99 ? 1 - px * px : 0);
    // abajo se abomba mas (la tierra empuja) y arriba se hunde un poco la tela
    const panza = 1 + 0.03 * Math.max(0, -py);
    p.setXYZ(i, p.getX(i) * (Math.abs(px) > 0.99 ? lado * panza : 1), p.getY(i), p.getZ(i) * (Math.abs(pz) > 0.99 ? lado * panza : 1));
  }
  g.computeVertexNormals();
  g.applyMatrix4(new THREE.Matrix4().compose(V(x, y + h / 2, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), giro), V(1, 1, 1)));
  L.meter('gavion', g);
  L.tinta(g, 0.01);
  // la tierra de arriba: un monton aplastado
  const t = new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  t.scale(w * 0.98, 0.16, d * 0.98).applyMatrix4(new THREE.Matrix4().compose(V(x, y + h - 0.05, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), giro), V(1, 1, 1)));
  L.meter('tierra', t);
}

// ERIZO CHECO: tres perfiles en L de 1,4 m cruzados por el centro, oxidados
export function erizo(L, x, y, z, giro) {
  const q0 = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), giro);
  const ejes = [V(1, 0.72, 0), V(-0.5, 0.72, 0.86), V(-0.5, 0.72, -0.86)].map((v) => v.normalize());
  const c = V(x, y + 0.5, z);
  for (const e of ejes) {
    const d = e.clone().applyQuaternion(q0);
    const a = c.clone().addScaledVector(d, -0.72), b = c.clone().addScaledVector(d, 0.72);
    L.barra('oxido', a, b, 0.085, { tinta: 0.008 });
    // la otra ala de la L
    const lado = new THREE.Vector3().crossVectors(d, V(0, 1, 0)).normalize().multiplyScalar(0.03);
    L.barra('oxido', a.clone().add(lado), b.clone().add(lado), 0.03, { tinta: 0 });
  }
  L.caja('oxido', c.x, c.y, c.z, 0.16, 0.16, 0.16, { tinta: 0.006 });             // la cartela del cruce
}

// CONCERTINA de a a b (puntos con y = el suelo): espiral de radio r con el bucle ladeado (las grapas que la cierran) y
// cuchillas cada pocos centimetros
export function concertina(L, a, b, r = 0.44, suelo = null, paso = 0.26) {
  const d = new THREE.Vector3().subVectors(b, a), largo = d.length();
  if (largo < 0.3) return;
  const u = d.clone().normalize(), w = new THREE.Vector3().crossVectors(u, V(0, 1, 0)).normalize();
  const vueltas = largo / paso, N = Math.ceil(vueltas * 16);
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, ang = t * vueltas * Math.PI * 2;
    const base = a.clone().addScaledVector(d, t);
    const ys = suelo ? suelo(base.x, base.z) : base.y;
    const p = V(base.x, ys + r, base.z)
      .addScaledVector(w, Math.cos(ang) * r)
      .add(V(0, Math.sin(ang) * r * 0.97, 0))
      .addScaledVector(u, Math.sin(ang) * 0.1);
    pts.push(p);
  }
  // el alambre: un tubo de tres lados
  const curva = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
  L.meter('alambre', new THREE.TubeGeometry(curva, N, 0.0045, 3, false));
  // las cuchillas: dos aletas finas cada 1/9 de vuelta
  const g = [];
  for (let i = 0; i < pts.length - 1; i += 2) {
    const p = pts[i], t = pts[i + 1].clone().sub(p).normalize();
    const n = new THREE.Vector3().crossVectors(t, V(0, 1, 0)).normalize();
    for (const s of [-1, 1]) {
      const q = p.clone().addScaledVector(n, s * 0.022).addScaledVector(t, 0.012);
      g.push(p.x, p.y, p.z, q.x, q.y + 0.004, q.z, p.x + t.x * 0.024, p.y + t.y * 0.024, p.z + t.z * 0.024);
    }
  }
  const gb = new THREE.BufferGeometry();
  gb.setAttribute('position', new THREE.Float32BufferAttribute(g, 3));
  gb.computeVertexNormals();
  L.meter('alambre', gb);
}

// CHAPA GRECADA de w x l: grecas cada 7,6 cm; se coloca con su base (centro del borde de abajo) en p0, subiendo hacia
// p1 (el borde de arriba), y la cara hacia `fuera`
export function chapaGrecada(L, p0, p1, w, fuera, color) {
  const l = p0.distanceTo(p1), n = Math.max(8, Math.round(w / 0.019));
  const g = new THREE.PlaneGeometry(w, l, n, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), k = (x / 0.076) * Math.PI * 2;
    p.setZ(i, 0.011 * Math.sign(Math.sin(k)) * Math.min(1, Math.abs(Math.sin(k)) * 2.2));
  }
  g.computeVertexNormals();
  // ejes: x a lo ancho, y de p0 a p1, z hacia fuera
  const ey = p1.clone().sub(p0).normalize(), ez = fuera.clone().sub(ey.clone().multiplyScalar(fuera.dot(ey))).normalize();
  const ex = new THREE.Vector3().crossVectors(ey, ez);
  const m = new THREE.Matrix4().makeBasis(ex, ey, ez).setPosition(p0.clone().addScaledVector(ey, l / 2));
  g.applyMatrix4(m);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 1.2, uv.getY(i) * l / 1.2);
  L.meter('chapaOx', g, color);
  return g;
}

// ARBOL SECO: tronco y ramas que se abren y se afinan, tres niveles
export function arbolSeco(L, x, y, z, alto, semilla) {
  const r = azar(semilla);
  function rama(a, dir, largo, radio, nivel) {
    const b = a.clone().addScaledVector(dir, largo);
    L.cilindro('tronco', a, b, radio, nivel ? 5 : 7, nivel > 1 ? 0 : 0.012, null, radio * 0.62);
    if (nivel >= 3) return;
    const n = nivel === 0 ? 3 : 2 + (r() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const giro = r() * 6.28, abre = 0.35 + r() * 0.5;
      const d = dir.clone().applyAxisAngle(new THREE.Vector3(Math.cos(giro), 0, Math.sin(giro)), abre).normalize();
      d.y = Math.max(d.y, 0.15); d.normalize();
      const desde = a.clone().lerp(b, nivel === 0 ? 0.55 + r() * 0.45 : 0.6 + r() * 0.4);
      rama(desde, d, largo * (0.5 + r() * 0.25), radio * 0.55, nivel + 1);
    }
  }
  const inclina = V((r() - 0.5) * 0.25, 1, (r() - 0.5) * 0.25).normalize();
  rama(V(x, y - 0.1, z), inclina, alto * 0.55, alto * 0.028, 0);
}

// TORRE de alta tension en celosia (22 m), con sus dos crucetas y los aisladores; devuelve donde cuelgan los cables
export function torreta(L, x, y, z, giro = 0) {
  const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), giro);
  const P = (a, h, b) => V(a, h, b).applyQuaternion(q).add(V(x, y, z));
  const ancho = (h) => 2.6 - h * 0.095;
  const niveles = [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22];
  for (let i = 0; i < niveles.length - 1; i++) {
    const h0 = niveles[i], h1 = niveles[i + 1], a0 = ancho(h0) / 2, a1 = ancho(h1) / 2;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) L.barra('celosia', P(sx * a0, h0, sz * a0), P(sx * a1, h1, sz * a1), 0.09, { tinta: 0 });
    for (const [p, q2] of [[[1, 1], [1, -1]], [[1, -1], [-1, -1]], [[-1, -1], [-1, 1]], [[-1, 1], [1, 1]]]) {
      L.barra('celosia', P(p[0] * a1, h1, p[1] * a1), P(q2[0] * a1, h1, q2[1] * a1), 0.05, { tinta: 0 });
      L.barra('celosia', P(p[0] * a0, h0, p[1] * a0), P(q2[0] * a1, h1, q2[1] * a1), 0.035, { tinta: 0 });
      L.barra('celosia', P(q2[0] * a0, h0, q2[1] * a0), P(p[0] * a1, h1, p[1] * a1), 0.035, { tinta: 0 });
    }
  }
  const cuelga = [];
  for (const [h, l] of [[17.5, 4.2], [21.0, 3.0]]) {
    L.barra('celosia', P(-l, h, 0), P(l, h, 0), 0.12, { tinta: 0 });
    L.barra('celosia', P(-l, h, 0), P(-ancho(h) / 2, h - 1.4, 0), 0.05, { tinta: 0 });
    L.barra('celosia', P(l, h, 0), P(ancho(h) / 2, h - 1.4, 0), 0.05, { tinta: 0 });
    for (const s of [-1, 1]) {
      const a = P(s * (l - 0.2), h, 0), b = P(s * (l - 0.2), h - 1.1, 0);
      L.cilindro('aislador', a, b, 0.07, 6, 0);
      cuelga.push(b);
    }
  }
  return cuelga;
}

// un cable que cuelga de a a b (catenaria aproximada con la flecha f)
export function cable(L, a, b, f, r = 0.012, k = 'cuerda', n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(a.clone().lerp(b, t).add(V(0, -4 * f * t * (1 - t), 0))); }
  L.meter(k, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, r, 4, false));
}
// una cuerda por puntos
export function cuerda(L, pts, r = 0.013, k = 'cuerda') {
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  L.meter(k, new THREE.TubeGeometry(c, Math.max(8, pts.length * 10), r, 5, false));
  return c;
}

// COCHE pequeno, de perfil extruido (morro en x0, a lo largo de +x; costado cercano en z0, ancho hacia +z). Con
// `quemado`: sin cristales, la chapa negra y oxidada y las ruedas sin goma
export function coche(L, x0, y0, z0, o = {}) {
  const largo = 3.9, ancho = o.ancho ?? 1.6, b = 0.045;
  const f = new THREE.Shape();
  f.moveTo(0.05, 0.3); f.lineTo(0.4, 0.3);
  f.absarc(0.78, 0.3, 0.38, Math.PI, 0, true);
  f.lineTo(2.74, 0.3);
  f.absarc(3.12, 0.3, 0.38, Math.PI, 0, true);
  f.lineTo(3.9, 0.32); f.lineTo(3.92, 0.62); f.lineTo(3.86, 0.94); f.lineTo(3.58, 1.0); f.lineTo(3.12, 1.38);
  f.lineTo(1.78, 1.36); f.lineTo(1.28, 0.87); f.lineTo(1.15, 0.84); f.lineTo(0.2, 0.7); f.lineTo(0.04, 0.6);
  f.closePath();
  const g = new THREE.ExtrudeGeometry(f, { depth: ancho - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 3, curveSegments: 12 });
  g.translate(x0, y0, z0 + b);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.4, uv.getY(i) / 1.4);
  const kc = o.quemado ? 'quemado' : 'carroceria';
  L.meter(kc, g, o.color);
  L.tinta(g, 0.012);
  const z1 = z0 + ancho;
  // lunas: las de los costados, el parabrisas y la de atras (oscuras; en el quemado, huecos negros)
  const kv = o.quemado ? 'negro' : 'luna';
  const ventanas = [[[1.42, 0.93], [1.82, 1.3], [2.42, 1.31], [2.42, 0.93]], [[2.5, 0.93], [2.5, 1.31], [3.08, 1.32], [3.44, 1.0], [3.42, 0.93]]];
  for (const v of ventanas) {
    const s = new THREE.Shape(v.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const zz of [z0 - 0.003, z1 + 0.003]) {              // (las lunas van por las dos caras)
      const gv = new THREE.ShapeGeometry(s);
      gv.translate(x0, y0, zz);
      L.meter(kv, gv);
    }
  }
  const quad = (a, b2, c, d) => {
    const gq = new THREE.BufferGeometry();
    gq.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b2, ...c, ...a, ...c, ...d], 3));
    gq.computeVertexNormals();
    L.meter(kv, gq);
  };
  const lunaInclinada = (p, q2, e) => {
    const nx = -(q2[1] - p[1]), ny = q2[0] - p[0], l = Math.hypot(nx, ny), ox = nx / l * e, oy = ny / l * e;
    const A = [x0 + p[0] + ox, y0 + p[1] + oy], B2 = [x0 + q2[0] + ox, y0 + q2[1] + oy];
    quad([A[0], A[1], z0 + 0.1], [A[0], A[1], z1 - 0.1], [B2[0], B2[1], z1 - 0.1], [B2[0], B2[1], z0 + 0.1]);
    quad([A[0], A[1], z1 - 0.1], [A[0], A[1], z0 + 0.1], [B2[0], B2[1], z0 + 0.1], [B2[0], B2[1], z1 - 0.1]);
  };
  lunaInclinada([1.32, 0.9], [1.76, 1.33], 0.004);
  lunaInclinada([3.14, 1.35], [3.55, 1.02], -0.004);
  // juntas de las puertas, paragolpes, faros y retrovisor
  for (const xx of [1.45, 2.46, 3.42]) for (const zz of [z0 - 0.002, z1 - 0.004]) L.cajaE('negro', x0 + xx, x0 + xx + 0.008, y0 + 0.34, y0 + 0.94, zz, zz + 0.006, { tinta: 0 });
  L.cajaE('aceroOsc', x0 - 0.04, x0 + 0.12, y0 + 0.3, y0 + 0.46, z0 + 0.05, z1 - 0.05, { tinta: 0.006 });
  L.cajaE('aceroOsc', x0 + 3.82, x0 + 3.97, y0 + 0.32, y0 + 0.48, z0 + 0.05, z1 - 0.05, { tinta: 0.006 });
  if (!o.quemado) for (const zz of [z0 + 0.18, z1 - 0.38]) L.cajaE('faro', x0 + 0.02, x0 + 0.06, y0 + 0.52, y0 + 0.6, zz, zz + 0.2, { tinta: 0.003 });
  L.cajaE(kc, x0 + 1.3, x0 + 1.42, y0 + 0.88, y0 + 0.98, z0 - 0.13, z0, { tinta: 0.004, color: o.color });
  // ruedas (una pinchada; en el quemado, la llanta sola)
  const ruedas = [[0.78, 0.18], [3.12, 0.18], [0.78, ancho - 0.18], [3.12, ancho - 0.18]];
  ruedas.forEach(([rx, rz], i) => {
    const pinchada = i === (o.pinchada ?? 1);
    const rr = o.quemado ? 0.21 : 0.3, cy = y0 + (pinchada ? 0.24 : 0.3);
    const a = V(x0 + rx, cy, z0 + rz - 0.1), bb = V(x0 + rx, cy, z0 + rz + 0.1);
    if (!o.quemado) {
      const gr = new THREE.CylinderGeometry(rr, rr, 0.2, 18, 1);
      gr.rotateX(Math.PI / 2);
      // pinchada: aplastada por abajo (y algo mas ancha donde apoya)
      if (pinchada) { const p = gr.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k); if (y < -0.22) { p.setY(k, -0.22 - (-0.22 - y) * 0.15); p.setZ(k, p.getZ(k) * 1.12); } } gr.computeVertexNormals(); }
      gr.translate(a.x, cy, (a.z + bb.z) / 2);
      L.meter('goma', gr);
      L.tinta(gr, 0.008);
    }
    const zt = rz < ancho / 2 ? a.z - 0.005 : bb.z + 0.005;
    L.cilindro('aceroOsc', V(a.x, cy, zt), V(a.x, cy, rz < ancho / 2 ? a.z + 0.02 : bb.z - 0.02), 0.19, 12, 0);
  });
}
