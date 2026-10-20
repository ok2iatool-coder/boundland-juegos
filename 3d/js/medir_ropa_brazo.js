// REGLA R23 del taller (escuela/notas/02-metodo.md): la ropa no traspasa el brazo ni un milimetro. Se mide sobre las
// MALLAS que se pintan, con su piel, fotograma a fotograma en el recorrido de recorrido_capa.js: cada vertice de la capa
// (capa, jirones, dobladillo) contra la manga y la mano (las mallas de color, sin el casco de tinta). Dentro = del lado de
// dentro de la normal del vertice del brazo mas cercano (a menos de 2,5 cm). No mira huesos ni capsulas.
// Uso: `await (await import('/js/medir_ropa_brazo.js')).medir(__dbg)`; `{ fisica: false }` mide el clip solo (el modelo).
// `evaluar(__dbg.heroe)` mide el fotograma de ahora y devuelve los puntos peores (para ver DONDE).
import * as THREE from 'three';
import { GUION } from './recorrido_capa.js';

const ROPA = /^(capa_1|capa_jiron_[di]_1|dobladillo)$/;
const BRAZO = /^(manga_[lr]_1|mano_palma_[lr])$/;
const CELDA = 0.01, CERCA = 0.025;
const clave = (x, y, z) => ((x + 100000) * 262144 + (y + 100000)) * 262144 + (z + 100000);

function mallas(raiz, re) {
  const r = [];
  raiz.traverse((o) => { if (o.isSkinnedMesh && re.test(o.name)) r.push(o); });
  return r;
}

const v = new THREE.Vector3(), w = new THREE.Vector3();

// un fotograma: los vertices de la ropa dentro del brazo, de mas a menos hondo (max `cuantos`)
export function evaluar(H, { cuantos = 20 } = {}) {
  const ropa = mallas(H.raiz, ROPA), brazo = mallas(H.raiz, BRAZO);
  H.raiz.updateMatrixWorld(true);
  // el brazo deformado: posicion y normal de cada vertice (la normal, por diferencia con un punto 1 mm hacia fuera:
  // applyBoneTransform pesa con los huesos del vertice i, vale tambien para el punto desplazado)
  const P = [], N = [], de = [], hash = new Map(), caja = new THREE.Box3();
  for (const m of brazo) {
    const pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); w.fromBufferAttribute(nor, i).multiplyScalar(0.001).add(v);
      m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld);
      m.applyBoneTransform(i, w); w.applyMatrix4(m.matrixWorld);
      const k = P.length / 3;
      P.push(v.x, v.y, v.z);
      w.sub(v).normalize();
      N.push(w.x, w.y, w.z);
      de.push([m.name, i]);
      caja.expandByPoint(v);
      const c = clave(Math.floor(v.x / CELDA), Math.floor(v.y / CELDA), Math.floor(v.z / CELDA));
      let l = hash.get(c); if (!l) hash.set(c, (l = [])); l.push(k);
    }
  }
  caja.expandByScalar(CERCA);
  const malos = [];
  for (const m of ropa) {
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld);
      if (!caja.containsPoint(v)) continue;
      const cx = Math.floor(v.x / CELDA), cy = Math.floor(v.y / CELDA), cz = Math.floor(v.z / CELDA);
      let mejor = CERCA * CERCA, kb = -1;
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
        const l = hash.get(clave(cx + dx, cy + dy, cz + dz));
        if (!l) continue;
        for (const k of l) {
          const ex = v.x - P[3 * k], ey = v.y - P[3 * k + 1], ez = v.z - P[3 * k + 2];
          const d2 = ex * ex + ey * ey + ez * ez;
          if (d2 < mejor) { mejor = d2; kb = k; }
        }
      }
      if (kb < 0) continue;
      const dentro = -((v.x - P[3 * kb]) * N[3 * kb] + (v.y - P[3 * kb + 1]) * N[3 * kb + 1] + (v.z - P[3 * kb + 2]) * N[3 * kb + 2]);
      if (dentro > 0) {
        // movil = lo mueve la fisica (algo de peso en huesos de capa); fijo = va con la espalda: es cosa del modelo
        const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
        let wc = 0;
        for (let k = 0; k < 4; k++) if (/^cape_/.test(m.skeleton.bones[si.getComponent(i, k)].name)) wc += sw.getComponent(i, k);
        malos.push({ dentro, movil: wc > 0.05, ropa: m.name, i, p: v.toArray(), brazo: de[kb][0], j: de[kb][1], a: [P[3 * kb], P[3 * kb + 1], P[3 * kb + 2]], dist: Math.sqrt(mejor) });
      }
    }
  }
  malos.sort((x, y) => y.dentro - x.dentro);
  const mov = malos.filter((x) => x.movil), fij = malos.filter((x) => !x.movil);
  return { peor: malos[0] ? malos[0].dentro : 0, peorMovil: mov[0] ? mov[0].dentro : 0, peorFijo: fij[0] ? fij[0].dentro : 0,
    n: malos.length, n1mm: malos.filter((x) => x.dentro > 0.001).length, puntos: malos.slice(0, cuantos), peorMovilPunto: mov[0] || null };
}

export async function medir(D, { fps = 60, fisica = true, cada = 1 } = {}) {
  const H = D.heroe;
  // el mismo arranque que recorrido_capa.js
  D.congelar(true); D.soltar();
  D.camara(Math.PI, 0.28, 3.4); D.ir(0, 0);
  if (H.vel) H.vel.set(0, 0, 0);
  H.giro = 0; H.vy = 0;
  if (H.mixer) H.mixer.setTime(0);
  const antes = H.fisica;
  H.fisica = fisica;
  D.avanzar(1 / fps, 90);
  H.tela.reiniciar();
  D.avanzar(1 / fps, 30);
  const res = { fisica, fotogramas: 0, conDentro: 0, peor_mm: 0, peor: null, tramos: {}, partes: {}, brazos: {} };
  const fin = GUION[GUION.length - 1][1];
  for (let f = 0, t = 0; t < fin; f++, t = f / fps) {
    const g = GUION.find(([a, b]) => t >= a && t < b);
    D.soltar(); D.pulsar(...g[2]);
    if (Math.abs(t - 4.3) < 0.5 / fps) D.saltar();
    D.avanzar(1 / fps, 1);
    if (f % cada) continue;
    const e = evaluar(H, { cuantos: 1 });
    const pe = e.peorMovilPunto || e.puntos[0];
    res.peorFijo_mm = Math.max(res.peorFijo_mm || 0, +(e.peorFijo * 1000).toFixed(1));
    e.peor = e.peorMovil;            // lo que se juzga aqui es la fisica; lo fijo (del modelo) va aparte en peorFijo_mm
    res.fotogramas++;
    const tr = (res.tramos[g[3]] ||= { fotogramas: 0, conDentro: 0, peor_mm: 0 });
    tr.fotogramas++;
    if (e.peor > 0.001) {
      res.conDentro++; tr.conDentro++;
      res.partes[pe.ropa] = (res.partes[pe.ropa] || 0) + 1;
      res.brazos[pe.brazo] = (res.brazos[pe.brazo] || 0) + 1;
    }
    const mm = +(e.peor * 1000).toFixed(1);
    tr.peor_mm = Math.max(tr.peor_mm, mm);
    if (mm > res.peor_mm) { res.peor_mm = mm; res.peor = { t: +t.toFixed(2), tramo: g[3], ropa: pe.ropa, brazo: pe.brazo }; }
    await new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = r; ch.port2.postMessage(0); });
  }
  D.soltar();
  H.fisica = antes;
  return res;
}
