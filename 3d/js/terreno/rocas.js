// Las ROCAS del mapa de terreno (copia de muro/rocas.js, que no esta montado), en LOW POLY de verdad: un icosaedro cortado por planos (caras grandes y aristas vivas, como una
// piedra partida), con musgo en lo que mira arriba y la TINTA del 18: un casco del reves un poco mas grande, en el color
// de su tinta (30, 24, 20), que solo se ve en el contorno. Diez formas y cada roca de la lista (suelo.js) es una
// instancia girada y escalada de una de ellas.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { azar } from '../texturas.js';
import { ROCAS, N_TIPOS_ROCA } from './sitios.js';
import { suave, fbm } from './relieve.js';

const TINTA = new THREE.Color().setRGB(30 / 255, 24 / 255, 20 / 255, THREE.SRGBColorSpace);

// una forma: base en y = 0, alto 1, huella de radio 1. `plana` (caras sueltas con color) y `casco` (con indice y
// normales suaves: el casco de tinta no se abre en las aristas)
function forma(semilla) {
  const r = azar(semilla);
  let g = new THREE.IcosahedronGeometry(1, 1);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  // planos de corte: mas en las rocas "partidas", menos en los cantos rodados
  const planos = [];
  const nPlanos = 4 + Math.floor(r() * 7);
  for (let k = 0; k < nPlanos; k++) {
    const n = new THREE.Vector3(r() * 2 - 1, r() * 1.7 - 0.35, r() * 2 - 1).normalize();
    planos.push([n, 0.6 + r() * 0.32]);
  }
  const sx = 0.85 + r() * 0.35, sy = 0.55 + r() * 0.55, sz = 0.72 + r() * 0.35;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).multiplyScalar(0.9 + r() * 0.2);
    for (const [n, c] of planos) { const d = v.dot(n) - c; if (d > 0) v.addScaledVector(n, -d); }
    v.y = Math.max(v.y, -0.5);                          // la base, plana: va enterrada
    p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const rx = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z), alto = bb.max.y - bb.min.y;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) / rx, (p.getY(i) - bb.min.y) / alto, p.getZ(i) / rx);
  g.computeVertexNormals();
  const casco = g;
  // la de color: caras sueltas, musgo en lo que mira arriba (a manchas), roca con su tono por cara, panza oscura
  const plana = g.toNonIndexed();
  plana.computeVertexNormals();
  const pos = plana.attributes.position, nor = plana.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const musgo = [0.72, 0.9, 0.56];
  for (let f = 0; f < pos.count; f += 3) {
    const ny = (nor.getY(f) + nor.getY(f + 1) + nor.getY(f + 2)) / 3;
    const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3, cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3;
    const m = suave(0.42, 0.8, ny) * suave(0.35, 0.6, fbm(cx * 2 + semilla, cz * 2 - semilla, 2) + 0.15 * cy);
    const k = (0.9 + 0.16 * r()) * (1 - 0.32 * suave(0.35, 0, cy)) * (ny < -0.2 ? 0.75 : 1);
    for (let c = 0; c < 3; c++) {
      const base = [k, k * 0.985, k * 0.96];
      for (let q = 0; q < 3; q++) col[(f + c) * 3 + q] = base[q] * (1 - m) + musgo[q] * k * m;
    }
  }
  plana.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return { plana, casco };
}

// el casco de tinta: cada vertice sale por su normal suave lo que mide la linea (en metros del mundo, segun lo grande
// que sea la roca: 1 cm en una piedra, 3 en un bloque del acantilado)
function materialTinta() {
  const m = new THREE.MeshBasicMaterial({ color: TINTA, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 esc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        float grosor = clamp(0.008 + 0.006 * esc.x, 0.008, 0.034);
        transformed += normal * grosor / esc;
      }`);
  };
  return m;
}

export function crearRocas(grupo, tono) {
  const formas = Array.from({ length: N_TIPOS_ROCA }, (_, i) => forma(300 + i * 17));
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: tono, flatShading: true });
  const tinta = materialTinta();
  const r = azar(55);
  const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  const v = new THREE.Vector3(), s = new THREE.Vector3(), CERO = new THREE.Matrix4().makeScale(0, 0, 0);
  // tono de la roca: gris calido, algo mas claro o mas pardo cada una; las del agua mas oscuras
  const gris = new THREE.Color(0x9a9383), pardo = new THREE.Color(0x8b7d68), ocre = new THREE.Color(0xa68b66), claro = new THREE.Color(0xbdb5a3);
  // cada forma, una pareja de InstancedMesh (color y tinta) con HUECO para las rocas que ponga el editor (crece si se llena)
  const clases = [];
  function clase(t, cabe) {
    const im = new THREE.InstancedMesh(formas[t].plana, mat, cabe);
    const ic = new THREE.InstancedMesh(formas[t].casco, tinta, cabe);
    im.castShadow = im.receiveShadow = true;
    im.name = 'rocas';
    ic.name = 'rocas_tinta';
    im.count = ic.count = 0;
    grupo.add(im, ic);
    return { im, ic, cabe, n: 0, lista: [] };
  }
  function colocar(o) {
    const k = clases[o.tipo];
    q.setFromEuler(e.set(o.inclina[0], o.giro, o.inclina[1]));
    mt.compose(v.set(o.x, o.y, o.z), q, s.set(o.r, o.alto, o.r));
    const m = o.quitada ? CERO : mt;
    k.im.setMatrixAt(o.slot, m);
    k.ic.setMatrixAt(o.slot, m);
    k.im.instanceMatrix.needsUpdate = k.ic.instanceMatrix.needsUpdate = true;
    k.sucia = true;
  }
  function meter(o) {
    let k = clases[o.tipo];
    if (k.n >= k.cabe) {
      // sin hueco: una pareja nueva el doble de grande con lo de la vieja
      const nueva = clase(o.tipo, k.cabe * 2);
      k.lista.forEach((p) => { nueva.lista.push(p); nueva.im.setColorAt(p.slot, k.im.getColorAt(p.slot, c)); });
      nueva.n = k.n;
      for (const m of [k.im, k.ic]) { grupo.remove(m); m.dispose(); }
      clases[o.tipo] = k = nueva;
      k.lista.forEach(colocar);
    }
    o.slot = k.n++;
    k.lista.push(o);
    k.im.count = k.ic.count = k.n;
    c.copy(gris).lerp(pardo, r() * 0.6).multiplyScalar(0.88 + r() * 0.2);
    // las del escarpe y los cerros, del ocre de su estrato; los cantos de la rambla, lavados y claros
    if (o.cat === 'escarpe' || o.cat === 'cerro' || o.cat === 'canchal') c.lerp(ocre, 0.35);
    if (o.cat === 'lecho') c.lerp(claro, 0.4);
    k.im.setColorAt(o.slot, c);
    k.im.instanceColor.needsUpdate = true;
    colocar(o);
  }
  for (let t = 0; t < N_TIPOS_ROCA; t++) clases.push(clase(t, ROCAS.filter((o) => o.tipo === t).length + 64));
  for (const o of ROCAS) meter(o);
  // la esfera de cada pareja (para no dibujar lo que no se ve), al final de cada cambio
  function cerrar() {
    for (const k of clases) if (k.sucia) { k.im.computeBoundingSphere(); k.ic.computeBoundingSphere(); k.sucia = false; }
  }
  cerrar();
  const tris = () => clases.reduce((n, k, t) => n + k.n * (formas[t].plana.attributes.position.count / 3), 0);
  // el editor: `meter` una roca nueva (ya en ROCAS), `colocar` una que ha cambiado (quitada, o asentada en otra cota)
  return { formas, meter: (o) => { meter(o); cerrar(); }, colocar: (o) => { colocar(o); cerrar(); }, cerrar, colocarSinCerrar: colocar, info: () => ({ rocas: ROCAS.filter((o) => !o.quitada).length, triangulosRocas: tris() }) };
}
