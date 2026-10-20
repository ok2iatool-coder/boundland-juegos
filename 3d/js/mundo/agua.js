// EL AGUA del mapa del mundo: el rio (de la Sierra a la Hoz), el arroyo de los Picos (del lago helado al farallon y de
// la poza al Lago), la CASCADA que cae por el farallon, la poza, el Lago y el lago helado. Las lineas y las cotas vienen de
// geo.json (exportar_juego.py desde mapa.py); el cauce ya esta excavado en el relieve. La lamina corre: una textura de
// vetas que se desliza aguas abajo (mas deprisa en la cascada).
import * as THREE from 'three';
import { GEO, altura } from './relieve.js';

// vetas claras sobre el azul del agua (se repite a lo largo)
function texturaVetas(semilla, claro) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 256);
  let s = semilla;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < 46; k++) {
    const x = r() * 64, y = r() * 256, l = 18 + r() * 60, a = (claro ? 0.25 : 0.12) + r() * 0.2;
    g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 1 + r() * 2.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + l); g.stroke();
    g.strokeStyle = `rgba(40,70,90,${a * 0.6})`; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x + 3, y + 4); g.lineTo(x + 3 + (r() - 0.5) * 6, y + l * 0.7); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function materialAgua(textura, color, opacidad) {
  return new THREE.MeshBasicMaterial({
    map: textura, color, transparent: true, opacity: opacidad, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

// una cinta de agua por una linea [x, z, cota del agua, medio ancho]: plana de lado a lado, a la cota del agua o, donde el
// fondo asoma (un arroyo de dos metros en una rejilla de ocho), un palmo por encima del suelo
function cinta(pts, ensancha = 1.12) {
  const pos = [], uv = [], idx = [];
  let s = 0;
  for (let k = 0; k < pts.length; k++) {
    const [x, z, nivel, w] = pts[k];
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    if (k > 0) s += Math.hypot(x - pts[k - 1][0], z - pts[k - 1][1]);
    const W = w * ensancha, nx = -tz, nz = tx;
    const y = Math.max(nivel, altura(x, z) + 0.06);
    pos.push(x + nx * W, y, z + nz * W, x - nx * W, y, z - nz * W);
    uv.push(0, s / 14, 1, s / 14);
    if (k > 0) { const q = (k - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
// una elipse llana (los lagos, la poza)
function elipse(cx, cz, rx, rz, giro, y, seg = 72) {
  const pos = [cx, y, cz], uv = [0.5, 0.5], idx = [];
  const c = Math.cos(giro), s = Math.sin(giro);
  for (let k = 0; k <= seg; k++) {
    const t = (k / seg) * Math.PI * 2, u = rx * Math.cos(t), v = rz * Math.sin(t);
    pos.push(cx + u * c - v * s, y, cz + u * s + v * c);
    uv.push(0.5 + 0.5 * Math.cos(t) * rx / 40, 0.5 + 0.5 * Math.sin(t) * rz / 40);
    if (k > 0) idx.push(0, k, k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function crearAgua(grupo, tono) {
  const g = new THREE.Group();
  g.name = 'agua';
  grupo.add(g);
  const AZUL = 0x7fb0c4;
  const vetas = texturaVetas(7, false), vetasCascada = texturaVetas(19, true), vetasLago = texturaVetas(31, false);
  vetas.repeat.set(1, 1);
  vetasCascada.repeat.set(1, 1);
  vetasLago.repeat.set(3, 3);
  const matRio = materialAgua(vetas, AZUL, 0.86);
  const matCascada = materialAgua(vetasCascada, 0xcfe4ec, 0.9);
  const matLago = materialAgua(vetasLago, 0x6d9fb6, 0.88);
  const mallas = [];
  const poner = (geo, mat, nombre) => { const m = new THREE.Mesh(geo, mat); m.name = nombre; m.renderOrder = 2; g.add(m); mallas.push(m); return m; };

  // el rio y el arroyo
  for (const [nombre, pts] of Object.entries(GEO.lineas)) poner(cinta(pts), matRio, nombre);

  // la cascada: de lo alto del farallon a la poza, pegada a la pared (un metro y medio por fuera)
  const C = GEO.cascada;
  {
    const pos = [], uv = [], idx = [], M = 48;
    const dx = C.x1 - C.x0, dz = C.z1 - C.z0, L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
    let s = 0, yAntes = C.y0, xA = C.x0, zA = C.z0;
    for (let k = 0; k <= M; k++) {
      const t = k / M, x = C.x0 + dx * t, z = C.z0 + dz * t;
      const y = k === 0 ? C.y0 + 0.3 : Math.max(C.y1 + 0.05, Math.min(yAntes, altura(x, z) + 1.5));
      if (k > 0) s += Math.hypot(x - xA, y - yAntes, z - zA);
      const W = C.ancho / 2 * (1 + 0.5 * t);                               // se abre al caer
      pos.push(x + nx * W, y, z + nz * W, x - nx * W, y, z - nz * W);
      uv.push(0, s / 10, 1, s / 10);
      if (k > 0) { const q = (k - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      yAntes = y; xA = x; zA = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    poner(geo, matCascada, 'cascada');
  }
  // la espuma al pie: un anillo blanco que late
  const espuma = new THREE.Mesh(new THREE.RingGeometry(2, 9, 40), new THREE.MeshBasicMaterial({ color: 0xf2f6f7, transparent: true, opacity: 0.55, depthWrite: false }));
  espuma.rotation.x = -Math.PI / 2;
  espuma.position.set(C.x1 + (C.x0 - C.x1) * 0.35, GEO.poza.cota + 0.08, C.z1 + (C.z0 - C.z1) * 0.35);
  espuma.name = 'espuma';
  espuma.renderOrder = 3;
  g.add(espuma);

  // la poza y los lagos
  const Pz = GEO.poza;
  poner(elipse(Pz.x, Pz.z, Pz.r, Pz.r, 0, Pz.cota), matLago, 'poza');
  for (const L of GEO.lagos) {
    if (!L.helado) { poner(elipse(L.x, L.z, L.rx, L.rz, L.giro, L.cota), matLago, L.id); continue; }
    // el lago helado: una lamina de hielo opaca, con sus grietas
    const hielo = new THREE.Mesh(elipse(L.x, L.z, L.rx, L.rz, L.giro, L.cota + 0.02), new THREE.MeshToonMaterial({ color: 0xdce9ef, gradientMap: tono }));
    hielo.name = 'lago_helado';
    hielo.receiveShadow = true;
    g.add(hielo);
    const lin = [], c = Math.cos(L.giro), s = Math.sin(L.giro);
    let sem = 5;
    const r = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
    for (let k = 0; k < 9; k++) {
      let u = (r() - 0.5) * 1.2 * L.rx, v = (r() - 0.5) * 1.2 * L.rz;
      for (let q = 0; q < 4; q++) {
        const u2 = u + (r() - 0.5) * 10, v2 = v + (r() - 0.5) * 8;
        if ((u2 / L.rx) ** 2 + (v2 / L.rz) ** 2 > 0.9) break;
        lin.push(L.x + u * c - v * s, L.cota + 0.05, L.z + u * s + v * c, L.x + u2 * c - v2 * s, L.cota + 0.05, L.z + u2 * s + v2 * c);
        u = u2; v = v2;
      }
    }
    const gl = new THREE.BufferGeometry();
    gl.setAttribute('position', new THREE.Float32BufferAttribute(lin, 3));
    const grietas = new THREE.LineSegments(gl, new THREE.LineBasicMaterial({ color: 0x9fb7c2 }));
    grietas.name = 'grietas';
    g.add(grietas);
  }

  return {
    grupo: g,
    actualizar(t, dt) {
      vetas.offset.y -= dt * 0.28;                // aguas abajo (v crece a lo largo de la linea, de la fuente a la boca)
      vetasCascada.offset.y -= dt * 1.6;
      vetasLago.offset.x += dt * 0.004;
      espuma.material.opacity = 0.45 + 0.15 * Math.sin(t * 5.3);
      const k = 1 + 0.06 * Math.sin(t * 3.1);
      espuma.scale.set(k, k, 1);
    },
    info: () => ({ laminasAgua: mallas.length }),
  };
}
