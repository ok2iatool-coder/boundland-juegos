// LO QUE HAY TIRADO EN EL SUELO, EN 3D (21-10, «pequenas ramitas realistas, con un poco de profundidad»): ramitas con
// sus ramillas, hojas secas curvadas y piedrecitas, encima del suelo de fotos (suelo_bosque.js). Se reparten por la
// MASCARA del suelo: muchas en la hojarasca, alguna en la tierra, casi ninguna en la hierba, y fuera del empedrado.
// Todo instanciado; solo se dibuja lo de los tramos cercanos al 18 (a mas de 30 m no se distingue del suelo).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// una ramita de 1 m (se escala entera): palo con un quiebro y una o dos ramillas, a lo largo de +x
function ramita(r) {
  const piezas = [];
  const palo = (x0, y0, z0, x1, y1, z1, rad0, rad1) => {
    const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), l = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(rad1, rad0, l, 5, 1, false);
    g.translate(0, l / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.applyQuaternion(q).translate(a.x, a.y, a.z);
    piezas.push(g);
  };
  const qx = 0.4 + r() * 0.2, qz = (r() - 0.5) * 0.08;
  palo(0, 0, 0, qx, 0.004, qz, 0.016, 0.013);
  palo(qx, 0.004, qz, 1, 0, qz + (r() - 0.5) * 0.12, 0.013, 0.007);
  const n = 1 + Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    const t = 0.3 + r() * 0.5, x = t, z = qz * t / qx, s = r() < 0.5 ? -1 : 1, l = 0.18 + r() * 0.22;
    palo(x, 0.003, z, x + l * 0.75, 0.006, z + s * l * 0.66, 0.008, 0.004);
  }
  const g = mergeGeometries(piezas.map((p) => p.toNonIndexed()));
  g.computeVertexNormals();
  return g;
}

// una hoja seca: rombo doblado por el nervio y algo combado, de 1 m (se escala), con UV del atlas
function hoja() {
  const v = [
    [0, 0, 0], [0.5, 0.06, 0.22], [1, 0.02, 0], [0.5, 0.02, 0], [0.5, 0.06, -0.22],
  ];
  const pos = [], uv = [];
  const tri = (a, b, c) => { for (const i of [a, b, c]) { pos.push(...v[i]); uv.push(v[i][0], 0.5 + v[i][2] / 0.44); } };
  tri(0, 3, 1); tri(1, 3, 2); tri(0, 4, 3); tri(4, 2, 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// atlas de hojas secas: 4 en fila (parda, naranja, amarilla, verde apagada), con nervios
function texturaHojas(azar) {
  const r = azar(91), W = 128, H = 64;
  const c = document.createElement('canvas'); c.width = W * 4; c.height = H;
  const g = c.getContext('2d');
  const tonos = [[120, 82, 46], [176, 104, 44], [196, 160, 70], [118, 120, 60]];
  tonos.forEach(([R, G, B], k) => {
    const ox = k * W;
    g.fillStyle = `rgb(${R},${G},${B})`;
    g.beginPath(); g.moveTo(ox + 2, H / 2);
    g.quadraticCurveTo(ox + W * 0.45, -2, ox + W - 3, H / 2);
    g.quadraticCurveTo(ox + W * 0.45, H + 2, ox + 2, H / 2);
    g.fill();
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(${R * 0.6},${G * 0.55},${B * 0.5},${0.15 + r() * 0.25})`;
      g.fillRect(ox + 10 + r() * (W - 20), 10 + r() * (H - 20), 2 + r() * 4, 2 + r() * 3);
    }
    g.strokeStyle = `rgba(${R * 0.55},${G * 0.5},${B * 0.45},0.8)`; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(ox + 2, H / 2); g.lineTo(ox + W - 6, H / 2); g.stroke();
    for (let i = 1; i < 6; i++) {
      const x = ox + i * W / 6.5;
      g.beginPath(); g.moveTo(x, H / 2); g.lineTo(x + 12, H / 2 - 16); g.moveTo(x, H / 2); g.lineTo(x + 12, H / 2 + 16); g.stroke();
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function crearHojarasca({ grupo, altura, mascara, distCamino, anchoCamino, LADO, azar, corteza }) {
  const r = azar(88);
  const TRAMO = 10, LEJOS = 32;
  const celdas = new Map();
  const celda = (x, z) => {
    const k = Math.floor(x / TRAMO) + ',' + Math.floor(z / TRAMO);
    if (!celdas.has(k)) celdas.set(k, { x: (Math.floor(x / TRAMO) + 0.5) * TRAMO, z: (Math.floor(z / TRAMO) + 0.5) * TRAMO, ramas: [[], [], []], hojas: [[], [], [], []], chinas: [] });
    return celdas.get(k);
  };
  const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const fuera = (x, z) => distCamino(x, z).d > anchoCamino + 0.05;
  let nR = 0, nH = 0, nC = 0;
  // RAMITAS: 9.000 intentos, se quedan segun la mascara
  for (let i = 0; i < 9000; i++) {
    const x = (r() * 2 - 1) * LADO, z = (r() * 2 - 1) * LADO;
    const [ti, ho] = mascara(x, z);
    if (r() > ho * 0.9 + ti * 0.6 || !fuera(x, z)) continue;
    const L = 0.12 + Math.pow(r(), 2) * 0.55, y = altura(x, z);
    e.set((r() - 0.5) * 0.12, r() * Math.PI * 2, (r() - 0.5) * 0.12, 'YXZ');
    celda(x, z).ramas[Math.floor(r() * 3)].push(mt.compose(v.set(x, y + 0.012 * L, z), q.setFromEuler(e), s.set(L, L, L)).clone());
    nR++;
  }
  // HOJAS secas: muchas bajo los arboles
  for (let i = 0; i < 26000; i++) {
    const x = (r() * 2 - 1) * LADO, z = (r() * 2 - 1) * LADO;
    const [ti, ho, hi] = mascara(x, z);
    if (r() > ho * 0.95 + ti * 0.5 + hi * 0.05) continue;
    const enCam = !fuera(x, z);
    if (enCam && r() > 0.08) continue;
    const L = 0.05 + r() * 0.07, y = altura(x, z) + (enCam ? 0.07 : 0.004);
    e.set((r() - 0.5) * 0.5, r() * Math.PI * 2, (r() - 0.5) * 0.5, 'YXZ');
    celda(x, z).hojas[Math.floor(r() * 4)].push(mt.compose(v.set(x, y, z), q.setFromEuler(e), s.set(L, L * (0.6 + r() * 0.6), L)).clone());
    nH++;
  }
  // PIEDRECITAS en la tierra
  for (let i = 0; i < 9000; i++) {
    const x = (r() * 2 - 1) * LADO, z = (r() * 2 - 1) * LADO;
    const [ti, ho] = mascara(x, z);
    if (r() > ti * 0.8 + ho * 0.15 || !fuera(x, z)) continue;
    const rad = 0.006 + Math.pow(r(), 2.5) * 0.04, y = altura(x, z);
    const g = 0.45 + r() * 0.35;
    celda(x, z).chinas.push([mt.compose(v.set(x, y + rad * 0.2, z), q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3)), s.set(rad, rad * (0.5 + r() * 0.3), rad * (0.7 + r() * 0.5))).clone(),
      new THREE.Color().setRGB(g * (1 + r() * 0.08), g, g * (0.88 + r() * 0.08), THREE.SRGBColorSpace)]);
    nC++;
  }
  const RAMAS = [ramita(r), ramita(r), ramita(r)];
  const matRama = new THREE.MeshStandardMaterial({ map: corteza, color: 0x9a8a78, roughness: 0.95 });
  const HOJA = [0, 1, 2, 3].map((k) => {
    const g = hoja(), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i) * 0.98 + 0.01) / 4);
    return g;
  });
  const matHoja = new THREE.MeshStandardMaterial({ map: texturaHojas(azar), side: THREE.DoubleSide, roughness: 0.9 });
  const CHINA = new THREE.IcosahedronGeometry(1, 1);
  const matChina = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const lista = [];
  for (const C of celdas.values()) {
    const mallas = [];
    C.ramas.forEach((l, k) => { if (!l.length) return; const im = new THREE.InstancedMesh(RAMAS[k], matRama, l.length); l.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; mallas.push(im); });
    C.hojas.forEach((l, k) => { if (!l.length) return; const im = new THREE.InstancedMesh(HOJA[k], matHoja, l.length); l.forEach((m, i) => im.setMatrixAt(i, m)); im.receiveShadow = true; mallas.push(im); });
    if (C.chinas.length) { const im = new THREE.InstancedMesh(CHINA, matChina, C.chinas.length); C.chinas.forEach(([m, c], i) => { im.setMatrixAt(i, m); im.setColorAt(i, c); }); im.receiveShadow = true; im.castShadow = true; mallas.push(im); }
    for (const m of mallas) { m.computeBoundingSphere(); m.visible = false; grupo.add(m); }
    lista.push({ x: C.x, z: C.z, mallas });
  }
  return {
    actualizar(foco) {
      for (const C of lista) {
        const ver = Math.hypot(C.x - foco.x, C.z - foco.z) < LEJOS;
        for (const m of C.mallas) m.visible = ver;
      }
    },
    info: { ramitas: nR, hojasSecas: nH, piedrecitas: nC },
  };
}
