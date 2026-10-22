// EL BOSQUE EN 3D de la entrada (bosque/main.js), en el estilo de la escena del muro (toon de tres escalones con la
// linea de tinta por casco invertido, color por vertice): arboles con raices, ramas y copa de bultos, matas, helechos,
// setas que brillan, hierba, luciérnagas y el suelo del bosque, del principio del paso al campo del muro.
//
// Lo que BROTA (pedido: «ves agregando arboles en primer plano, por delante del personaje, solo algunos, no muchos,
// poco a poco, hasta que este todo verde»): mientras el 2D manda, cada arbol de los que se ven desde el lateral crece del
// suelo (con un rebote) cuando el 18 llega a unos metros de el. Primero solo los de DELANTE (entre la camara y el 18),
// pocos y cada vez mas seguidos; desde B.DETRAS0 tambien los de detras, la hierba y las matas, hasta tapar el 2D. Esos
// van sueltos (una malla por arbol, se escalan); el resto del bosque, el que no se ve desde el lateral, va en lotes por
// tramos y aparece entero en el cambio (B.CAMBIO), cuando la camara aun mira de lado y no lo ve.
// Todo lo del bosque va tambien en la CAPA 3: mientras el 2D manda, main.js pinta solo esa capa sobre el 2D.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { B } from './datos.js';

export const CAPA_BOSQUE = 3;
const col = (h) => new THREE.Color(h);
function azar(s) { let a = s >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function h3(x, y, z) { let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + Math.floor(z) * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function ruido3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(i, j, k), h3(i + 1, j, k), u), L(h3(i, j + 1, k), h3(i + 1, j + 1, k), u), v),
    L(L(h3(i, j, k + 1), h3(i + 1, j, k + 1), u), L(h3(i, j + 1, k + 1), h3(i + 1, j + 1, k + 1), u), v), w);
}
const lisa = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ geometria (todo sin indices: se junta en lotes)
function limpiar(g) {
  if (g.index) g = g.toNonIndexed();
  for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
  return g;
}
function pintar(g, fn) {
  const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(t, p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)); c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
// el casco de tinta: la misma forma hinchada por su normal (se pinta por dentro, en negro)
function casco(g, w) {
  const t = g.clone(), p = t.attributes.position, n = t.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * w, p.getY(i) + n.getY(i) * w, p.getZ(i) + n.getZ(i) * w);
  t.deleteAttribute('color'); t.deleteAttribute('corteza');
  return t;
}
// CORTEZA (x, z del eje del tronco; 1 corteza, 0 hojas): el sombreador de los arboles (materialArbol) saca de ahi las vetas
// de la corteza alrededor del tronco o el moteado de las hojas, sin texturas (los arboles pintados del 2D no tienen
// ninguna superficie lisa)
function marcar(g, cx, cz, k) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = cx; a[i * 3 + 1] = cz; a[i * 3 + 2] = k; }
  g.setAttribute('corteza', new THREE.BufferAttribute(a, 3));
  return g;
}

// la paleta de los arboles pintados del 2D a la luz de la luna (corteza gris verdosa, musgo, hojas verde gris)
const CORTEZA = [col('#545a53'), col('#686e65'), col('#7c8075')], MUSGO = col('#5d6e44');
const HOJA = [col('#38483a'), col('#445842'), col('#53694c'), col('#627b55')], HOJA_LUZ = col('#a3b585');

// un tronco que se estrecha, se curva y abre el pie en raices
function tronco(rr, alto, rb, curva) {
  let g = new THREE.CylinderGeometry(rb * 0.36, rb, alto, 11, 12, true).translate(0, alto / 2, 0);
  g = limpiar(g);
  const p = g.attributes.position, sem = rr() * 100, lob = 4 + Math.floor(rr() * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y / alto, a = Math.atan2(z, x);
    let k = 1 + 0.07 * (ruido3(a * 2 + sem, y * 1.5, 0) - 0.5);
    if (t < 0.16) { const e = (1 - t / 0.16) ** 2; k *= 1 + e * (0.7 + 0.45 * Math.max(0, Math.sin(a * lob + sem))); }
    p.setXYZ(i, x * k + curva * Math.sin(t * 2.4), y, z * k);
  }
  g.computeVertexNormals();
  marcar(g, 0, 0, 1);
  return pintar(g, (c, x, y, z, nx) => {
    const n = ruido3(x * 3, y * 2.2, z * 3);
    c.copy(CORTEZA[0]).lerp(CORTEZA[1], n).lerp(CORTEZA[2], Math.max(0, n - 0.6) * 1.5);
    c.lerp(MUSGO, (1 - lisa(0.1 * alto, 0.45 * alto, y)) * lisa(0.1, 0.6, -nx + 0.3 * n) * 0.85);
  });
}
// una rama: un cilindro fino de a a b
function rama(a, b, r) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  let g = new THREE.CylinderGeometry(r * 0.45, r, L, 6, 2, true).translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())).translate(a.x, a.y, a.z);
  return marcar(pintar(limpiar(g), (c) => c.copy(CORTEZA[1])), 0, 0, 0.5);
}
// un bulto de copa: icosaedro abollado y aplastado; las normales salen de su centro (sombreado de bola, como las copas
// pintadas) y el color baja a oscuro por debajo y se aclara arriba
function bulto(rr, cx, cy, cz, r, aplast = 0.78, tono = 0) {
  let g = limpiar(new THREE.IcosahedronGeometry(r, 1));
  const p = g.attributes.position, n = g.attributes.normal, s = rr() * 50;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.22 * (ruido3(x * 2.2 / r + s, y * 2.2 / r, z * 2.2 / r) - 0.5);
    p.setXYZ(i, cx + x * k, cy + y * k * aplast, cz + z * k);
    const L = Math.hypot(x, y * aplast, z) || 1; n.setXYZ(i, x / L, (y * aplast) / L, z / L);
  }
  const base = HOJA[Math.min(HOJA.length - 1, Math.floor(rr() * 3 + tono))];
  marcar(g, 0, 0, 0);
  return pintar(g, (c, x, y, z, nx, ny) => {
    c.copy(base).lerp(HOJA[0], lisa(0.2, -0.8, ny) * 0.7).lerp(HOJA_LUZ, lisa(0.45, 1, ny) * 0.35 * (0.6 + ruido3(x * 3, y * 3, z * 3)));
  });
}

// un ARBOL entero en su sitio (0,0,0 en el pie): { geo, tinta, rb }
export function geoArbol(semilla, alto, rb) {
  const rr = azar(semilla), partes = [], tintas = [];
  const curva = (rr() - 0.5) * rb * 1.6, ht = alto * (0.7 + rr() * 0.08);
  const T = tronco(rr, ht, rb, curva);
  partes.push(T); tintas.push(casco(T, 0.035 + rb * 0.04));
  const topX = curva * Math.sin(2.4), rc = alto * 0.17;
  // ramas que salen hacia la copa, con un racimo de hojas en la punta
  for (let k = 0; k < 4 + Math.floor(rr() * 4); k++) {
    const t = 0.45 + rr() * 0.45, a = rr() * 6.28, y = ht * t, x0 = curva * Math.sin(t * 2.4);
    const L = alto * (0.12 + rr() * 0.12);
    const b = new THREE.Vector3(x0 + Math.cos(a) * L, y + L * (0.35 + rr() * 0.45), Math.sin(a) * L);
    const R = rama(new THREE.Vector3(x0, y, 0), b, rb * 0.2);
    partes.push(R); tintas.push(casco(R, 0.02));
    for (let q = 0; q < 2 + Math.floor(rr() * 2); q++) {
      const C = bulto(rr, b.x + (rr() - 0.5) * rc * 0.5, b.y + rr() * rc * 0.3, b.z + (rr() - 0.5) * rc * 0.5, rc * (0.24 + rr() * 0.14), 0.72, q % 2);
      partes.push(C); tintas.push(casco(C, 0.045));
    }
  }
  // la copa: muchos bultos pequenos arriba (se lee como hojas, no como piedras)
  const n = 14 + Math.floor(rr() * 7);
  for (let k = 0; k < n; k++) {
    const a = rr() * 6.28, d = rc * 1.25 * Math.sqrt(rr()), y = ht + rc * (-0.45 + rr() * 1.05);
    const C = bulto(rr, topX + Math.cos(a) * d, y, Math.sin(a) * d, rc * (0.34 + rr() * 0.24), 0.74 + rr() * 0.12, k % 2);
    partes.push(C); tintas.push(casco(C, 0.05));
  }
  return { geo: mergeGeometries(partes), tinta: mergeGeometries(tintas), rb, alto };
}
// una MATA: tres o cuatro bultos bajos
function geoMata(semilla, r) {
  const rr = azar(semilla), partes = [], tintas = [];
  for (let k = 0; k < 8 + Math.floor(rr() * 5); k++) {
    const a = rr() * 6.28, d = r * 0.75 * Math.sqrt(rr()), rk = r * (0.22 + rr() * 0.2);
    const C = bulto(rr, Math.cos(a) * d, rk * 0.5 + rr() * r * 0.45 * (1 - d / r), Math.sin(a) * d, rk, 0.75, 1);
    partes.push(C); tintas.push(casco(C, 0.02));
  }
  return { geo: mergeGeometries(partes), tinta: mergeGeometries(tintas) };
}
// un HELECHO: hojas largas que salen del centro y se arquean (dos caras)
function geoHelecho(semilla, l) {
  const rr = azar(semilla), partes = [];
  const n = 7 + Math.floor(rr() * 4);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 6.28 + rr() * 0.4, L = l * (0.7 + rr() * 0.4), sube = 0.6 + rr() * 0.4;
    const pos = [], seg = 7;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, w = L * 0.11 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.004;
      const r = L * t, y = L * (sube * t - 0.9 * t * t) * 0.9;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
      pos.push([cx - px, y, cz - pz], [cx + px, y, cz + pz]);
    }
    const tri = [];
    for (let i = 0; i < seg; i++) { const A = pos[i * 2], Bv = pos[i * 2 + 1], C = pos[i * 2 + 2], D = pos[i * 2 + 3]; tri.push(...A, ...Bv, ...C, ...Bv, ...D, ...C); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
    g.computeVertexNormals();
    const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0);   // luz de arriba, como la hierba
    partes.push(pintar(g, (c, x, y) => c.copy(HOJA[1]).lerp(HOJA_LUZ, Math.min(1, y / (l * 0.4)) * 0.4)));
  }
  return mergeGeometries(partes);
}
// una SETA que brilla (crema verdoso, como las de El Linde): pie y sombrero
function geoSeta(x, y, z, s) {
  const pie = new THREE.CylinderGeometry(s * 0.18, s * 0.24, s * 0.9, 6).translate(x, y + s * 0.45, z);
  const som = new THREE.SphereGeometry(s * 0.5, 8, 4, 0, 6.29, 0, Math.PI / 2).scale(1, 0.6, 1).translate(x, y + s * 0.85, z);
  return [limpiar(pie), limpiar(som)];
}

// ------------------------------------------------------------------ el bosque
export function crearBosque3D(escena, { suelo, M, escaparse = [], estorba = () => false, primerPlano = null }) {
  const grupo = new THREE.Group(); grupo.name = 'bosque3d';
  escena.add(grupo);
  const gradiente = M.suelo.gradientMap;
  const toon = materialArbol(gradiente);
  const toonDos = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradiente, side: THREE.DoubleSide });
  const tinta = M.tinta;
  const brillo = new THREE.MeshBasicMaterial({ color: '#d8eab0' });
  const enCapa = (o) => { o.traverse((m) => m.layers.enable(CAPA_BOSQUE)); return o; };
  // el suelo del bosque: el del muro, sin la cuesta del campo mas alla de Z_LLANO
  const alto = (x, z) => suelo(x, Math.max(z, B.Z_LLANO));
  const CX = B.CAMINO_X;
  const rr = azar(7101);
  const libre = (x, z, r) => {
    // SIN CAMINO (pedido 2026-10-22: «quita el caminito, arboles por todos lados, mas boscoso»): solo queda libre el
    // paso del 18, lo justo para que no choque con un tronco
    if (Math.abs(x - CX) < 0.2 + r) return false;
    for (const e of escaparse) if (Math.hypot(x - e.x, z - e.z) < e.r + r) return false;
    return true;
  };
  const choques = [];
  const sueltos = [];                 // lo que brota: { obj, z, x, t0, pop }
  const lotes = new Map();            // tramo -> { geo[], tinta[], dos[] }
  const lote = (z) => { const k = Math.floor((z + 200) / 18); if (!lotes.has(k)) lotes.set(k, { geo: [], tinta: [], dos: [], brillo: [] }); return lotes.get(k); };
  const colocar = (g, x, y, z, giro) => {
    const c = g.clone().rotateY(giro).translate(x, y, z), a = c.attributes.corteza;
    if (a) for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) + x, a.getY(i) + z);
    return c;
  };
  // lo que se ve desde la camara del lateral antes del cambio (la de 2 grados no ve mas cerca que 18 m delante del
  // camino): eso brota suelto; lo demas va en lotes y aparece en el cambio sin que se vea
  const seVe = (x, z) => z < B.CAMBIO + 9 && x > CX - 22;
  // EL CLARO del cambio: mientras la camara pasa del lateral a detras del 18 lo mira desde delante y a la izquierda (de -x
  // a -z); lo que hubiera ahi se le pondria delante. Un claro en ese barrido y una calle en la linea del lateral
  const enClaro = (x, z) => x < CX - 1.8 && ((z > B.CAMBIO - 3 && z < B.GIRO1 + 4 && x > CX - 30) || (z > B.CAMBIO - 5 && z < B.CAMBIO + 7));

  // ---- los arboles
  const arboles = [];
  // DELANTE del 18 (entre la camara del lateral y el camino): pocos, cada vez mas seguidos
  for (let z = B.DELANTE0; z < B.DELANTE1;) {
    const k = (z - B.DELANTE0) / (B.DELANTE1 - B.DELANTE0);
    const x = CX - 2.6 - rr() * 3.8;
    if (!estorba(x, z, 0.8)) arboles.push({ x, z, brota: true, lado: 'delante' });
    z += 11 - 6.5 * k + rr() * 2.5;
  }
  // el resto del bosque, por todas partes (los que se ven desde el lateral brotan; los demas, en lotes)
  for (let n = 0, intentos = 0; n < 1100 && intentos < 60000; intentos++) {
    const x = -46 + rr() * 92, z = B.DETRAS0 - 4 + rr() * (B.BOSQUE1 - B.DETRAS0 + 4);
    if (Math.abs(x - CX) > 16 && rr() < 0.45) continue;                          // mas tupido donde se ve
    // llega hasta el foso del muro (algo menos en el ultimo trozo)
    if (rr() > 1 - 0.6 * lisa(B.BOSQUE1 - 5, B.BOSQUE1, z)) continue;
    // delante del camino, antes del cambio, solo los de la lista de arriba
    if (x < CX && z < B.DELANTE1 + 2 && x > CX - 22) continue;
    if (!libre(x, z, 1.2) || enClaro(x, z) || estorba(x, z, 1.2)) continue;
    if (arboles.some((a) => Math.hypot(a.x - x, a.z - z) < 2.5)) continue;
    arboles.push({ x, z, brota: seVe(x, z), lado: x > CX ? 'detras' : 'delante' });
    n++;
  }
  // el ARBOL DE PRIMER PLANO del giro (main.js lo pone en la linea de vista de la camara): grueso, que se lea de cerca
  if (primerPlano) arboles.push({ x: primerPlano.x, z: primerPlano.z, brota: true, lado: 'delante', rb: primerPlano.rb, alto: 17 });
  // al otro lado del muro el bosque sigue (pedido: «coloca mas arboles detras del muro, se tiene que ver el muro grande
  // pero no mucho»): tupido, con un resquicio que se abre poco a poco en la linea del camino por el que asoma el muro
  // grande entre las copas
  for (let n = 0, intentos = 0; n < 150 && intentos < 9000; intentos++) {
    const x = -60 + rr() * 120, z = B.DENTRO.z0 + rr() * (B.DENTRO.z1 - B.DENTRO.z0);
    if (Math.abs(x - CX) < 3.2 + (z - B.DENTRO.z0) * 0.05 || rr() > 1 - lisa(B.DENTRO.z1 - 25, B.DENTRO.z1, z) * 0.7) continue;
    if (arboles.some((a) => Math.hypot(a.x - x, a.z - z) < 3.6)) continue;
    arboles.push({ x, z, brota: false, lado: 'dentro' });
    n++;
  }
  for (const a of arboles) {
    const cerca = Math.abs(a.x - CX) < 9;
    const fino = cerca || a.brota;      // los que se ven desde el lateral, como los troncos pintados
    const altoA = a.alto || (cerca ? 13 : 15) + rr() * (cerca ? 5 : 8), rb = a.rb || (fino ? 0.2 + rr() * 0.2 : 0.3 + rr() * 0.35);
    const { geo, tinta: gt } = geoArbol(Math.floor(rr() * 1e9), altoA, rb);
    const y = alto(a.x, a.z) - 0.05, giro = rr() * 6.28;
    choques.push({ x: a.x, z: a.z, r: rb * 1.05 });
    if (a.brota) {
      const o = new THREE.Group(); o.position.set(a.x, y, a.z); o.rotation.y = giro;
      const m = new THREE.Mesh(geo, toon); m.castShadow = true; m.receiveShadow = true;
      o.add(m, new THREE.Mesh(gt, tinta));
      o.visible = false; o.scale.setScalar(0.001);
      grupo.add(enCapa(o));
      sueltos.push({ obj: o, x: a.x, z: a.z, t0: -1, tipo: 'arbol' });
    } else {
      const L = lote(a.z);
      L.geo.push(colocar(geo, a.x, y, a.z, giro)); L.tinta.push(colocar(gt, a.x, y, a.z, giro));
    }
  }
  // ---- matas, helechos y setas que brillan: alrededor del camino y al pie de los arboles
  const helechoGeo = [geoHelecho(11, 0.75), geoHelecho(23, 0.95), geoHelecho(37, 0.6)];
  const setas = [];
  for (let n = 0, intentos = 0; n < 1000 && intentos < 30000; intentos++) {
    const x = CX + (rr() < 0.5 ? -1 : 1) * (0.9 + rr() * rr() * 30), z = B.DELANTE0 + 4 + rr() * (B.BOSQUE1 - B.DELANTE0 - 4);
    if (Math.abs(x - CX) < 0.85) continue;
    if (z > B.BOSQUE1 - 1 || enClaro(x, z) || estorba(x, z, 0.9)) continue;
    // antes de los de detras, solo delante del camino y pocas
    if (z < B.DETRAS0 && (x > CX || rr() < 0.8 || z < B.DELANTE0 + 6)) continue;
    const y = alto(x, z), giro = rr() * 6.28, que = rr();
    const vista = seVe(x, z);                                          // se ve desde el lateral: brota
    let o = null, L = vista ? null : lote(z);
    if (que < 0.45) {
      const { geo, tinta: gt } = geoMata(Math.floor(rr() * 1e9), 0.45 + rr() * 0.55);
      if (vista) { o = new THREE.Group(); const m = new THREE.Mesh(geo, toon); m.castShadow = true; o.add(m, new THREE.Mesh(gt, tinta)); }
      else { L.geo.push(colocar(geo, x, y, z, giro)); L.tinta.push(colocar(gt, x, y, z, giro)); }
    } else {
      const g = helechoGeo[Math.floor(rr() * 3)];
      if (vista) { o = new THREE.Group(); o.add(new THREE.Mesh(g, toonDos)); }
      else L.dos.push(colocar(g, x, y, z, giro));
    }
    if (rr() < 0.18) {
      const sx = x + (rr() - 0.5) * 0.6, sz = z + (rr() - 0.5) * 0.6, s = 0.07 + rr() * 0.06;
      setas.push({ x: sx, y: alto(sx, sz), z: sz });
      const gs = geoSeta(0, 0, 0, s);
      if (vista && o) { const m = new THREE.Mesh(mergeGeometries(gs), brillo); m.position.set(sx - x, alto(sx, sz) - y, sz - z); o.add(m); }
      else if (L) for (const q of gs) L.brillo.push(q.translate(sx, alto(sx, sz), sz));
    }
    if (o) {
      o.position.set(x, y, z); o.rotation.y = giro; o.visible = false; o.scale.setScalar(0.001);
      grupo.add(enCapa(o));
      sueltos.push({ obj: o, x, z, t0: -1, tipo: 'mata' });
    }
    n++;
  }
  // los lotes: una malla por tramo y material
  const enLotes = [];
  for (const L of lotes.values()) {
    const g = new THREE.Group(); g.visible = false;
    if (L.geo.length) { const m = new THREE.Mesh(mergeGeometries(L.geo), toon); m.castShadow = true; m.receiveShadow = true; g.add(m); }
    if (L.tinta.length) g.add(new THREE.Mesh(mergeGeometries(L.tinta), tinta));
    if (L.dos.length) g.add(new THREE.Mesh(mergeGeometries(L.dos), toonDos));
    if (L.brillo.length) g.add(new THREE.Mesh(mergeGeometries(L.brillo), brillo));
    grupo.add(enCapa(g));
    enLotes.push(g);
  }

  // ---- la HIERBA (2026-10-22, «mas pequena, mas particulas, mas juntas, con viento»): matojos bajos de nueve briznas
  // finas muy juntos, instanciados, que se MECEN en el sombreador: la punta se dobla con una racha que corre por el
  // bosque (la de las motas del viento) y un temblor propio por matojo; la raiz no se mueve
  const VIENTO = { dx: 0.82, dz: 0.57, v: 1.6 };            // hacia donde sopla (en planta) y a cuanto avanza la racha
  const uViento = { value: 0 };
  const matHierba = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradiente, side: THREE.DoubleSide });
  matHierba.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uViento;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec2 w = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float fase = dot(w, vec2(${VIENTO.dx.toFixed(3)}, ${VIENTO.dz.toFixed(3)}));
        float racha = 0.55 + 0.45 * sin(uT * 1.1 - fase * 0.35) * sin(uT * 0.37 - fase * 0.11 + 1.3);
        float temblor = sin(uT * 7.0 + w.x * 3.1 + w.y * 2.3 + position.x * 40.0) * 0.18;
        float k = position.y * position.y * 9.0;          // la punta se dobla, la raiz no
        vec2 d = vec2(${VIENTO.dx.toFixed(3)}, ${VIENTO.dz.toFixed(3)}) * (racha + temblor) * k * 0.55;
        transformed.x += d.x; transformed.z += d.y; transformed.y -= length(d) * 0.35;
      }`);
  };
  const hierba = (() => {
    const pos = [], col3 = [], NB = 9;
    for (let k = 0; k < NB; k++) {
      const a = (k / NB) * 3.14 + 0.2 + (k % 3) * 0.4, r = 0.012 + (k % 4) * 0.012;
      const h = 0.09 + ((k * 7) % 5) * 0.025, w = 0.008, inc = ((k * 5) % 7 - 3) * 0.022;
      const ox = Math.cos(a * 2.3) * r, oz = Math.sin(a * 2.3) * r, cx = Math.cos(a) * w, cz = Math.sin(a) * w;
      pos.push(ox - cx, 0, oz - cz, ox + cx, 0, oz + cz, ox + inc, h, oz + inc * 0.6);
      col3.push(0.36, 0.43, 0.31, 0.36, 0.43, 0.31, 1.12, 1.22, 0.96);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col3, 3));
    const N = 230000, im = new THREE.InstancedMesh(g, matHierba, N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), eje = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3(), e = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      // por todas partes, tambien por donde anda el 18; muy junta cerca de el y mas rala lejos (la bruma la tapa)
      const lado = rr() < 0.5 ? -1 : 1, x = CX + lado * Math.pow(rr(), 1.9) * 26, z = B.DELANTE0 + rr() * (B.BOSQUE1 - B.DELANTE0);
      const enPaso = 1 - lisa(0.4, 1.4, Math.abs(x - CX));
      const sc = (0.75 + Math.pow(rr(), 2) * 0.9) * (1 - 0.35 * enPaso) * (Math.abs(x - CX) > 0.9 && estorba(x, z, 0.1) ? 0.6 : 1);
      c.copy(HOJA[1]).lerp(HOJA_LUZ, rr() * 0.5).multiplyScalar(0.8 + rr() * 0.35);
      im.setColorAt(i, c);
      m4.compose(v.set(x, alto(x, z) - 0.01, z), q.setFromAxisAngle(eje, rr() * 6.28), e.set(sc, sc * (0.8 + rr() * 0.4), sc));
      im.setMatrixAt(i, m4);
    }
    im.frustumCulled = false; im.receiveShadow = true;
    grupo.add(enCapa(im));
    return { im };
  })();

  // ---- lo que LLEVA EL VIENTO: semillas, polvo y briznas sueltas que cruzan el bosque con la racha, cerca del suelo y
  // hasta la altura de las copas bajas; viajan en una caja de 40 x 120 m que se repite (sin fin) y cabecean al volar
  const vuela = (() => {
    const n = 9000, p = new Float32Array(n * 3), f = new Float32Array(n);
    for (let i = 0; i < n; i++) { p[i * 3] = rr() * 40; p[i * 3 + 1] = Math.pow(rr(), 1.8) * 4.5; p[i * 3 + 2] = rr() * 120; f[i] = rr() * 6.28; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('fase', new THREE.BufferAttribute(f, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uT: uViento, uO: { value: new THREE.Vector3(CX - 20, alto(CX, -60), B.DELANTE0) } }, transparent: true, depthWrite: false,
      vertexShader: `uniform float uT; uniform vec3 uO; attribute float fase; varying float vA;
        void main(){
          vec2 dir = vec2(${VIENTO.dx.toFixed(3)}, ${VIENTO.dz.toFixed(3)});
          float vel = 1.1 + 0.9 * fract(fase * 7.13);
          vec3 q = position;
          q.xz += dir * uT * vel * ${VIENTO.v.toFixed(2)};
          q.x = mod(q.x, 40.0); q.z = mod(q.z, 120.0);
          q.y += sin(uT * (1.3 + fract(fase)) + fase * 3.0) * 0.18 + sin(uT * 0.4 + fase) * 0.25;
          q.xz += vec2(sin(uT * 2.1 + fase * 5.0), cos(uT * 1.7 + fase * 4.0)) * 0.12;
          vec3 w = uO + q;
          vec4 mv = modelViewMatrix * vec4(w, 1.0);
          float d = max(0.4, -mv.z);
          vA = (0.55 + 0.45 * fract(fase * 3.7)) * smoothstep(40.0, 6.0, d) * smoothstep(0.0, 0.8, d);
          gl_PointSize = clamp((2.2 + 2.8 * fract(fase * 5.3)) * 9.0 / d, 1.5, 7.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(c * vec2(1.0, 1.8))) * vA;
          gl_FragColor = vec4(vec3(0.9, 0.93, 0.9) * a, a); }`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5;
    grupo.add(enCapa(pts));
    return { m, pts };
  })();

  // ---- MOTAS de la manana (polen, polvo): flotan en ochos por el bosque y brillan doradas a contraluz (sobre el 2D
  // tambien: capa 3)
  const luci = (() => {
    const n = 260, p = new Float32Array(n * 3), f = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = CX + (rr() - 0.5) * 30, z = B.DELANTE0 + rr() * (B.BOSQUE1 - B.DELANTE0);
      p[i * 3] = x; p[i * 3 + 1] = alto(x, z) + 0.3 + rr() * 2.2; p[i * 3 + 2] = z; f[i] = rr() * 6.28;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('fase', new THREE.BufferAttribute(f, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uTam: { value: 26 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uT, uTam; attribute float fase; varying float vA;
        void main(){
          vec3 q = position + vec3(sin(uT * 0.37 + fase) * 0.6, sin(uT * 0.71 + fase * 1.3) * 0.25, sin(uT * 0.29 + fase * 0.7) * 0.6);
          vec4 mv = modelViewMatrix * vec4(q, 1.0);
          vA = 0.45 + 0.55 * pow(max(0.0, sin(uT * (0.6 + 0.4 * fract(fase)) + fase * 2.0)), 2.0);
          gl_PointSize = uTam * (0.6 + 0.4 * vA) / max(0.5, -mv.z) * 4.0;
          gl_PointSize = clamp(gl_PointSize, 1.5, 9.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); a = a * a * vA;
          gl_FragColor = vec4(vec3(1.0, 0.94, 0.78) * a * 0.8, a * 0.8); }`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5;
    grupo.add(enCapa(pts));
    return m;
  })();

  // ---- HACES DE SOL entre las copas (como los del 2D): dos planos cruzados por haz, aditivos, inclinados desde el sol bajo
  const haces = (() => {
    const lz = document.createElement('canvas'); lz.width = 64; lz.height = 256;
    const q = lz.getContext('2d'), gv = q.createLinearGradient(0, 0, 0, 256);
    gv.addColorStop(0, 'rgba(255,255,255,0)'); gv.addColorStop(0.15, 'rgba(255,255,255,0.85)'); gv.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gv.addColorStop(1, 'rgba(255,255,255,0)');
    q.fillStyle = gv; q.fillRect(0, 0, 64, 256);
    q.globalCompositeOperation = 'destination-in';
    const gh = q.createLinearGradient(0, 0, 64, 0); gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(0.5, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
    q.fillStyle = gh; q.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(lz); t.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: t, color: '#cfdde4', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const g = new THREE.Group(); g.visible = false;
    for (let k = 0; k < 34; k++) {
      const z = B.GIRO1 - 2 + rr() * (B.BOSQUE1 - B.GIRO1 + 2), x = CX + (rr() < 0.5 ? -1 : 1) * (0.5 + rr() * rr() * 14), w = 1.2 + rr() * 2.6, h = 16;
      for (const giro of [0, Math.PI / 2]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        m.position.set(x, alto(x, z) + h * 0.42, z); m.rotation.set(0, giro + rr() * 0.4, 0); m.rotateZ(-0.35); m.rotateX(-0.55);
        m.renderOrder = 4; g.add(m);
      }
    }
    grupo.add(g);
    return g;
  })();

  // ---- el SUELO del bosque: musgo, tierra y hojarasca, sin senda (el camino se quito el 2026-10-22). Encima del suelo del muro (que sigue debajo) y se hunde bajo el en el borde del campo
  {
    const xs = [], zs = [];
    for (let x = -64; x <= 64.001; x += 1) xs.push(x);
    for (let z = B.Z0 - 22; z <= B.BOSQUE1 + 1.001; z += 0.5) zs.push(z);
    const nx = xs.length, pos = [], cl = [], uv = [];
    const c = new THREE.Color(), musgo = col('#58663d'), tierra = col('#5a4b37'), hojarasca = col('#73603f');
    for (const z of zs) for (const x of xs) {
      const borde = lisa(B.BOSQUE1 - 0.5, B.BOSQUE1 + 1, z);
      const y = alto(x, z) + 0.03 - 0.12 * borde;
      pos.push(x, y, z); uv.push(x, z);
      const n = ruido3(x * 0.3, 0, z * 0.3), n2 = ruido3(x * 1.3, 5, z * 1.3);
      c.copy(musgo).lerp(tierra, lisa(0.4, 0.75, n)).lerp(hojarasca, lisa(0.55, 0.9, n2) * 0.6);
      c.multiplyScalar(0.85 + 0.3 * n2);
      cl.push(c.r, c.g, c.b);
    }
    const idx = [];
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c2 = a + nx, d = c2 + 1; idx.push(a, c2, b, b, c2, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const mat = M.suelo.clone(); mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2;
    const s = new THREE.Mesh(g, mat); s.receiveShadow = true; s.name = 'sueloBosque';
    grupo.add(s);
  }

  // ------------------------------------------------------------------ por fotograma
  const rebote = (k) => { if (k >= 1) return 1; const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
  let todos = false;
  // zh: donde va el 18; brotan los del lateral al acercarse (devuelve cuantos han empezado, para el sonido)
  function actualizar(t, zh, fase) {
    luci.uniforms.uT.value = t;
    let nuevos = 0;
    for (const s of sueltos) {
      if (s.t0 < 0) {
        if (!(todos || s.z < zh + (s.tipo === 'arbol' ? 6.5 : 6))) continue;
        s.t0 = todos ? t - 2 : t; s.obj.visible = true; if (!todos) nuevos++;
      }
      const k = Math.min(1, (t - s.t0) / (s.tipo === 'arbol' ? 0.85 : 0.55));
      const e = rebote(k);
      s.obj.scale.set(Math.max(0.001, e * (0.9 + 0.1 * k)), Math.max(0.001, e), Math.max(0.001, e * (0.9 + 0.1 * k)));
    }
    uViento.value = t;
    void fase;
    return nuevos;
  }
  // en el cambio: todo el bosque (lo que no se ve de lado aparece de golpe; lo que estaba brotando sigue)
  function completar() {
    if (todos) return;
    todos = true;
    for (const g of enLotes) g.visible = true;
    haces.visible = true;
  }
  function reiniciar() {
    todos = false;
    for (const s of sueltos) { s.t0 = -1; s.obj.visible = false; s.obj.scale.setScalar(0.001); }
    for (const g of enLotes) g.visible = false;
    haces.visible = false;
  }
  return { grupo, choques, altura: alto, actualizar, completar, reiniciar, setas, sueltos, info: { arboles: arboles.length, sueltos: sueltos.length, lotes: enLotes.length } };
}

// EL MATERIAL DE LOS ARBOLES: toon de tres escalones con el color por vertice y, encima, lo que en los arboles pintados
// hace la textura: en la CORTEZA vetas que suben alrededor del tronco, grietas y liquen; en las HOJAS un moteado de
// claros y oscuros (sin el, cada bulto era una piedra lisa)
function materialArbol(gradiente) {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradiente });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec3 corteza;\nvarying vec3 vPosA;\nvarying vec3 vCort;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vPosA = position; vCort = corteza;');
    sh.fragmentShader = `varying vec3 vPosA;
      varying vec3 vCort;
      float ah3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float aruido(vec3 x) {
        vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(ah3(i), ah3(i + vec3(1, 0, 0)), f.x), mix(ah3(i + vec3(0, 1, 0)), ah3(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(ah3(i + vec3(0, 0, 1)), ah3(i + vec3(1, 0, 1)), f.x), mix(ah3(i + vec3(0, 1, 1)), ah3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (vCort.z > 0.25) {
        float a = atan(vPosA.z - vCort.y, vPosA.x - vCort.x);
        float veta = aruido(vec3(a * 5.0, vPosA.y * 0.35, 1.0));
        float grieta = smoothstep(0.66, 0.8, aruido(vec3(a * 9.0, vPosA.y * 0.9, 7.0)));
        float liquen = smoothstep(0.7, 0.9, aruido(vec3(a * 3.0, vPosA.y * 1.4, 3.0)) * aruido(vPosA * 5.0));
        diffuseColor.rgb *= (0.8 + 0.34 * veta) * (1.0 - 0.45 * grieta * vCort.z);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.15, 1.3, 1.05), liquen * 0.7 * vCort.z);
      } else {
        float n = aruido(vPosA * 3.2), n2 = aruido(vPosA * 8.5 + 5.0);
        diffuseColor.rgb *= 0.76 + 0.38 * n + 0.22 * (n2 - 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.22, 1.1), smoothstep(0.7, 0.85, n2) * 0.8);
      }`);
  };
  return m;
}
