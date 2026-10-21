// EL MURO EXTERIOR (escena aparte: muro4.html). El muro bajo, de 4 m, a 300 m del grande (documento del mundo, «El Muro
// Exterior»): bloques de hormigon en T de los puestos de control uno junto a otro, por fuera un FOSO de 3 x 1,5 m y la
// tierra que salio de el, y se salta desde DENTRO: el pie de la T hace de escalon y la gente ha arrimado coches, bidones,
// pales y cajas (los SALTADEROS). Donde lo cruza la carretera, un PUESTO de control: el porton, la pluma, la caseta, el
// nido de sacos, los gaviones en chicane y un mastil con dos focos mirando fuera. Entre los dos muros, Extramuros: la
// ronda de los militares, una chabola contra el muro y una hoguera en un bidon. Fuera, concertina, erizos y campo.
// Al fondo, a 300 m, el muro grande en la bruma y, detras, el resplandor de la ciudad.
//
// Ejes: el muro corre a lo largo de x por z = 0; dentro es +z, fuera -z. Suelo en y = 0.
// Interfaz que pide heroe.js: altura(x, z), choques {circulos, cajas (con ytop las que se pisan)}, salida, borde, limitar.
import * as THREE from 'three';
import { caseta } from '../casetas.js';
import { T, bloqueT, uvMundo, texturaHormigonT, medioGrueso } from './bloque.js';
import * as TX from './texturas.js';
import { crearLotes } from './lotes.js';
import { azar, bidon, pale, cajaMadera, nevera, sacos, muroSacos, gavion, erizo, concertina, chapaGrecada, arbolSeco, torreta, cable, cuerda, coche } from './piezas.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lisa = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const col = (h) => new THREE.Color(h);

export const M4 = {
  N: 55,                 // bloques a cada lado del centro (110 en total, 132 m)
  PUESTO: 2.4,           // el hueco del puesto: x en [-2,4, 2,4]
  CAIDO: 22,             // el bloque que se cayo hacia fuera (x = 27)
  TORCIDO: 13,           // el bloque que se inclina hacia dentro, apuntalado (x = 16,2)
  FOSO: { z0: -1.3, z1: -4.3, hondo: 1.5, agua: -1.22 },
  BORDE: { x0: -58, x1: 58, z0: -26, z1: 24 },
};
const xBloque = (i) => (i + 0.5) * T.LARGO;

// ------------------------------------------------------------------ el suelo (sin lo que hay encima)
function h2(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function ruido(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (h2(i, j) * (1 - u) + h2(i + 1, j) * u) * (1 - v) + (h2(i, j + 1) * (1 - u) + h2(i + 1, j + 1) * u) * v;
}
// el perfil del foso (0 arriba .. 1 al fondo) a una distancia zz = -z del muro
function fondoFoso(zz, x) {
  const F = M4.FOSO;
  if (zz <= -F.z0 || zz >= -F.z1) return 0;
  const t0 = -F.z0, t3 = -F.z1;
  // taludes de 1 m de ancho para 1,5 de hondo (56 grados): no se sube por ellos; mas comidos en algun tramo
  const come = 0.25 * (ruido(x * 0.4, 9.1) - 0.5);
  let d;
  if (zz < t0 + 1 + come) d = (zz - t0) / (1 + come);
  else if (zz < t3 - 1 - come) d = 1;
  else d = (t3 - zz) / (1 + come);
  return Math.max(0, Math.min(1, d));
}
export function suelo(x, z) {
  const ax = Math.abs(x), zz = -z;
  const n1 = ruido(x * 0.31 + 11, z * 0.31 - 4), n2 = ruido(x * 1.3, z * 1.3 + 7);
  let h = 0.05 * (n1 - 0.5) + 0.022 * (n2 - 0.5);
  // al pie del muro, por los dos lados, lo pisado: un poco mas bajo
  h -= 0.03 * (1 - lisa(0.8, 2.0, Math.abs(z)));
  // la calzada y su arcen (plana; fuera baja con el campo)
  const calzada = 1 - lisa(3.1, 4.0, ax);
  const campo = -0.022 * Math.max(0, zz - 8);
  if (z > -0.9) {
    // la ronda de los militares: dos rodadas con el lomo en medio
    const r1 = Math.exp(-(((z - 7.15) / 0.24) ** 2)), r2 = Math.exp(-(((z - 8.85) / 0.24) ** 2));
    h += -0.06 * (r1 + r2) * (0.7 + 0.6 * ruido(x * 0.5, 3)) + 0.02 * Math.exp(-(((z - 8.0) / 0.35) ** 2));
    return h * (1 - calzada);
  }
  // FUERA: el foso (que la calzada cruza sobre su terraplen), el caballon de tierra y el campo que baja
  const corte = Math.max(0, Math.min(1, (ax - 3.4) / 1.9));
  const hf = -M4.FOSO.hondo * fondoFoso(zz, x) * corte;
  let he = 0;
  if (zz > -M4.FOSO.z1) he = 0.55 * Math.exp(-(((zz - 5.8) / 1.15) ** 2)) * (0.7 + 0.6 * n1);
  return (h + hf + he + campo) * (1 - calzada) + campo * calzada;
}

// ------------------------------------------------------------------ el mundo
export function crearMuro4(scene) {
  const L = crearLotes();
  const { cajaE, barra, cilindro, caja } = L;
  const r = azar(4041);

  // ---------------- texturas y materiales (toon de tres escalones, como el resto de la prueba)
  const gradiente = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  gradiente.minFilter = gradiente.magFilter = THREE.NearestFilter; gradiente.needsUpdate = true;
  const tRuido = TX.texturaRuido();
  const tHorm = texturaHormigonT(), tSuelo = TX.texturaSuelo(), tAsfalto = TX.texturaAsfalto(), tMadera = TX.texturaMadera();
  const tPicto = TX.texturaPictogramas(), tBidon = TX.texturaBidon(), tSaco = TX.texturaSaco(), tGavion = TX.texturaGavion();
  const tLona = TX.texturaLona(), tChapa = TX.texturaChapa(), tPintadas = TX.texturaPintadas(), tSen = texturaSenales4();
  tSuelo.repeat.set(1 / 2.2, 1 / 2.2); tChapa.repeat.set(1, 1);
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradiente, vertexColors: true, ...extra });
  const U = { uRuido: { value: tRuido }, uT: { value: 0 } };
  // el hormigon de los bloques: la textura en el mundo + el barro que salpica abajo, la humedad que sube por la cara de
  // fuera (mas a la sombra, verdina) y la tapa mas oscura (se moja y no se seca)
  const hormigon = toon('#c3c6c4', { map: tHorm });
  hormigon.onBeforeCompile = (sh) => {
    sh.uniforms.uRuido = U.uRuido;
    sh.vertexShader = 'varying vec3 vMundo;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vMundo;\nuniform sampler2D uRuido;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float nA = texture2D(uRuido, vMundo.xy * vec2(0.21, 0.37) + vMundo.z * 0.1).r;
      float nB = texture2D(uRuido, vMundo.xy * vec2(1.3, 0.9)).r;
      float barro = 1.0 - smoothstep(0.02, 0.38 + 0.5 * nA + 0.12 * nB, vMundo.y);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.5, 0.47, 0.42), barro * 0.9);
      float fuera = smoothstep(0.02, -0.2, vMundo.z);
      float humedad = (1.0 - smoothstep(0.4, 1.2 + 1.1 * nA, vMundo.y)) * fuera * smoothstep(0.35, 0.65, nB * 0.6 + nA * 0.6);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.235, 0.19), humedad * 0.55);
      float tapa = smoothstep(3.92, 3.99, vMundo.y);
      diffuseColor.rgb *= 1.0 - 0.18 * tapa;`);
  };
  const suelo4 = toon('#ffffff', { map: tSuelo });
  const M = {
    hormigon, suelo: suelo4, tinta: new THREE.MeshBasicMaterial({ color: '#0b0a0c', side: THREE.BackSide }),
    asfalto: toon('#ffffff', { map: tAsfalto }), madera: toon('#ffffff', { map: tMadera }), picto: new THREE.MeshToonMaterial({ map: tPicto, gradientMap: gradiente, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    bidon: toon('#ffffff', { map: tBidon }), gavion: toon('#ffffff', { map: tGavion }), tierra: toon('#5a5247', { map: tSuelo }),
    oxido: toon('#5b4436'), alambre: toon('#8b9297'), lona: toon('#ffffff', { map: tLona, side: THREE.DoubleSide }), chapaOx: toon('#ffffff', { map: tChapa, side: THREE.DoubleSide }),
    tronco: toon('#3b3732'), celosia: toon('#4a4f54'), aislador: toon('#7c8288'), cuerda: toon('#6b6250'), goma: toon('#1e1e1f'),
    carroceria: toon('#ffffff', { map: TX.texturaCarroceria() }), quemado: toon('#2e2a27', { map: tChapa }), luna: toon('#1a2026', { side: THREE.DoubleSide }), faro: toon('#a9acab'),
    esmalte: toon('#b9b5a6'), ferralla: toon('#4e3628'), tela: toon('#ffffff', { side: THREE.DoubleSide, map: TX.texturaColchon() }),
    pintadas: new THREE.MeshToonMaterial({ map: tPintadas, gradientMap: gradiente, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    // lo que presta la caseta (casetas.js)
    acero: toon('#5a6168'), aceroOsc: toon('#373c42'), chapa: toon('#7f878f'), puerta: toon('#4d555d'),
    vidrio: new THREE.MeshToonMaterial({ color: '#243039', gradientMap: gradiente, transparent: true, opacity: 0.42, depthWrite: false }),
    ventana: new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), ambar: new THREE.MeshBasicMaterial({ color: '#ffd8a8' }),
    negro: new THREE.MeshBasicMaterial({ color: '#07090b', side: THREE.DoubleSide }), focoLuz: new THREE.MeshBasicMaterial({ color: '#f1f5f9' }),
    interiorPared: new THREE.MeshBasicMaterial({ color: '#8b7e6b' }), interiorBajo: new THREE.MeshBasicMaterial({ color: '#5e564b' }),
    interiorTecho: new THREE.MeshBasicMaterial({ color: '#a8997c' }), mueble: new THREE.MeshBasicMaterial({ color: '#3f3a34' }),
    pantalla: new THREE.MeshBasicMaterial({ color: '#d6b883' }), pantallaApagada: new THREE.MeshBasicMaterial({ color: '#2b2a28' }),
    plano: new THREE.MeshBasicMaterial({ color: '#b9ae93' }), senal: new THREE.MeshToonMaterial({ map: tSen, gradientMap: gradiente }),
    lejos: new THREE.MeshToonMaterial({ color: '#4b525a', gradientMap: gradiente }), rejilla: toon('#7c8389', { map: texturaMalla(), alphaTest: 0.5, side: THREE.DoubleSide }),
    fuego: toon('#ffffff', { map: tBidon, emissive: '#ffffff', emissiveMap: texturaAgujerosFuego(), emissiveIntensity: 1 }),
    pintura: toon('#c9ccc8'), alfombra: toon('#ffffff', { map: texturaAlfombra(), side: THREE.DoubleSide }),
  };
  M.picto.vertexColors = false; M.pintadas.vertexColors = false;

  const choques = { circulos: [], cajas: [] };
  const caja2 = (x0, x1, z0, z1, ytop) => choques.cajas.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, ang: 0, ytop });
  // lo que se pisa por encima: tablas y el bloque caido (solo cuentan si el 18 viene por arriba)
  const TABLAS = [];

  // ================================================================== EL MURO
  const calco = [];                          // las calcomanias (pintadas, codigos, oxido): quads en el lote 'pintadas'
  const cas = (i) => ({ u0: (i % 4) / 4, v0: 1 - (Math.floor(i / 4) + 1) / 2 });
  // un quad pintado en la cara del alma de un bloque (en sus ejes; lado +1 dentro, -1 fuera): u, v el centro, w x h
  function pintada(lista, i, u, v, w, h, lado, giro = 0) {
    const c = cas(i), pts = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const ca = Math.cos(giro), sa = Math.sin(giro);
      const x = u + (a * w / 2) * ca - (b * h / 2) * sa, y = v + (a * w / 2) * sa + (b * h / 2) * ca;
      pts.push([x * lado, y, lado * (medioGrueso(y) + 0.0025), c.u0 + (a + 1) / 2 / 4, c.v0 + (b + 1) / 2 / 2]);
    }
    lista.push(pts);
  }
  const bloques = [], ferralla = [];
  const quadsBloque = (lista, mat) => {
    const pos = [], uv = [];
    for (const q of lista) for (const k of [0, 1, 2, 0, 2, 3]) {
      const p = V(q[k][0], q[k][1], q[k][2]).applyMatrix4(mat);
      pos.push(p.x, p.y, p.z); uv.push(q[k][3], q[k][4]);
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    calco.push(g);
  };
  // la zona de cada pintada: mas junto a los saltaderos y la chabola, casi nada junto al puesto (lo limpian)
  const SALT1 = -12.4, SALT2 = 19.8;
  function ponerBloque(i, mat, opciones = {}) {
    const rb = azar(1000 + i * 17);
    const b = bloqueT(rb);
    const tono = 0.9 + rb() * 0.16, tinte = col('#ffffff').setRGB(tono, tono * (0.99 + rb() * 0.02), tono * (0.97 + rb() * 0.04));
    for (const g of b.piezas) {
      g.applyMatrix4(mat);
      uvMundo(g, rb() * 9, rb() * 9);
      L.meter('hormigon', g, tinte);
      L.tinta(g, 0.011);
    }
    for (const [u, v] of b.ferralla) {
      for (const d of [-0.05, 0.05]) {
        const a = V(u + d, v - 0.05, 0.02 * Math.sign(d)).applyMatrix4(mat), c = V(u + d * 1.3 + 0.01, v + 0.05 + rb() * 0.06, 0.03 * Math.sign(d)).applyMatrix4(mat);
        ferralla.push([a, c]);
      }
    }
    // pintadas en la cara de dentro (y algun codigo fuera)
    const x = xBloque(i), lista = [];
    const cerca = Math.max(Math.exp(-(((x - SALT1) / 7) ** 2)), Math.exp(-(((x + 23) / 5) ** 2)), 0.6 * Math.exp(-(((x - SALT2) / 4) ** 2)));
    const lejosPuesto = lisa(4, 9, Math.abs(x));
    if (rb() < 0.55) pintada(lista, 5 + (rb() < 0.5 ? 1 : 0), (rb() - 0.5) * 0.3, 1.05 + rb() * 0.25, 0.5, 0.5, 1);
    if (rb() < 0.25) pintada(lista, 5 + (rb() < 0.5 ? 1 : 0), (rb() - 0.5) * 0.3, 1.15, 0.45, 0.45, -1);
    if (rb() < (0.18 + 0.6 * cerca) * lejosPuesto) {
      const k = [0, 2, 3, 4, 0, 2, 3][Math.floor(rb() * 7)];
      pintada(lista, k, (rb() - 0.5) * 0.25, 1.7 + rb() * 0.9, 0.85 + rb() * 0.2, 0.85 + rb() * 0.2, 1, (rb() - 0.5) * 0.12);
    }
    if (opciones.flecha) pintada(lista, 1, 0, 2.4, 0.9, 0.9, 1);
    // el oxido que chorrea de los agujeros de izado, por las dos caras
    for (const ua of [-0.3, 0.3]) for (const lado of [1, -1]) {
      if (rb() < 0.25) continue;
      const largo = 0.5 + rb() * 0.9;
      pintada(lista, 7, ua * lado, 3.72 - largo / 2 + 0.08, 0.26, largo, lado);
    }
    quadsBloque(lista, mat);
    bloques.push({ i, x, mat });
  }
  const mBloque = (x, y, z, rx, ry, rz) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V(1, 1, 1));
  for (let i = -M4.N; i < M4.N; i++) {
    const x = xBloque(i);
    if (Math.abs(x) < M4.PUESTO) continue;
    const rb = azar(77 + i * 31);
    if (i === M4.CAIDO) continue;
    let rx = (rb() - 0.5) * 0.012, ry = (rb() - 0.5) * 0.012, dz = (rb() - 0.5) * 0.03, dy = -rb() * 0.035;
    if (i === M4.TORCIDO) { rx = 0.04; dz = 0.02; }
    ponerBloque(i, mBloque(x + (rb() - 0.5) * 0.012, dy, dz, rx, ry, (rb() - 0.5) * 0.004), { flecha: i === -10 });
  }
  // la ferralla que asoma de los cantos rotos
  for (const [a, b] of ferralla) cilindro('ferralla', a, b, 0.006, 5, 0);
  // los choques del muro: el PIE se pisa (0,5) y el ALMA tambien por arriba (4 m), a trozos por el puesto y el caido
  const xc = xBloque(M4.CAIDO);
  for (const [x0, x1] of [[-M4.N * T.LARGO, -M4.PUESTO], [M4.PUESTO, xc - 0.6], [xc + 0.6, M4.N * T.LARGO]]) {
    caja2(x0, x1, -0.8, 0.8, T.ALTO_PIE);
    caja2(x0, x1, -0.15, 0.15, T.ALTO);
  }

  // ---- el bloque CAIDO hacia fuera: tumbado sobre el foso, el alma de puente hasta el caballon
  {
    // giro de mas de 90 grados (alfa) para que la punta apoye en el caballon; se busca el que la deja en el suelo
    let mejor = null;
    for (let a = 0.05; a < 0.6; a += 0.005) {
      const mat = new THREE.Matrix4().makeRotationX(-(Math.PI / 2 + a));
      const P1 = V(0, T.ALTO_PIE, -T.PIE / 2).applyMatrix4(mat), P2 = V(0, T.ALTO, 0).applyMatrix4(mat);
      const t = V(xc, -P1.y, -1.05 - P1.z);
      const punta = P2.clone().add(t);
      const e = Math.abs(punta.y - (suelo(xc, punta.z) + 0.02));
      if (!mejor || e < mejor.e) mejor = { e, a, t };
    }
    const mat = new THREE.Matrix4().makeRotationX(-(Math.PI / 2 + mejor.a)).premultiply(new THREE.Matrix4().makeTranslation(mejor.t.x, mejor.t.y, mejor.t.z));
    ponerBloque(M4.CAIDO, mat);
    // lo que se pisa: la cara de dentro del alma (ahora mira arriba), de un lado al otro del foso
    const perfil = [];
    for (let y = 0.7; y <= T.ALTO; y += 0.1) { const p = V(0, y, medioGrueso(y)).applyMatrix4(mat); perfil.push([p.z, p.y]); }
    perfil.sort((a, b) => a[0] - b[0]);
    TABLAS.push({ x0: xc - 0.56, x1: xc + 0.56, z0: perfil[0][0], z1: perfil[perfil.length - 1][0], h: (z) => interp(perfil, z) });
    // donde el alma queda alta sobre la berma (junto al pie) choca: por debajo no se pasa, por encima se anda
    const altos = perfil.filter(([z, y]) => y - suelo(xc, z) > 0.3 && suelo(xc, z) > -0.3);
    if (altos.length) caja2(xc - 0.58, xc + 0.58, Math.min(...altos.map((p) => p[0])) - 0.05, Math.max(...altos.map((p) => p[0])) + 0.05, Math.max(...altos.map((p) => p[1])));
    // el pie, ahora de canto, choca
    const pie = [V(0, 0, -0.8), V(0, 0, 0.8), V(0, 0.5, -0.8), V(0, 0.5, 0.8)].map((p) => p.applyMatrix4(mat));
    caja2(xc - 0.6, xc + 0.6, Math.min(...pie.map((p) => p.z)), Math.max(...pie.map((p) => p.z)), Math.max(...pie.map((p) => p.y)));
    // el hueco que dejo, tapado con dos gaviones y concertina encima
    gavion(L, xc, 0, 0, 1.08, 1.37, 1.08, 0.02);
    gavion(L, xc, 1.37, 0.02, 1.06, 1.0, 1.06, -0.03);
    concertina(L, V(xc - 0.75, 2.37, 0), V(xc + 0.75, 2.37, 0), 0.3);
    caja2(xc - 0.6, xc + 0.6, -0.55, 0.55);
    // y los sacos que cierran las rendijas con los bloques de al lado (luego, con los demas sacos)
  }
  // ---- el bloque TORCIDO, apuntalado con dos tablones contra el suelo
  {
    const x = xBloque(M4.TORCIDO);
    for (const dx of [-0.35, 0.35]) {
      const a = V(x + dx, 2.75, 0.24), b = V(x + dx * 1.4, 0.0, 2.35);
      barra('madera', a, b, 0.14, { tinta: 0.01, color: col('#8a7b66') });
      cajaE('madera', x + dx * 1.4 - 0.2, x + dx * 1.4 + 0.2, 0, 0.08, 2.2, 2.6, { tinta: 0.006, color: col('#6f6352') });
      choques.circulos.push({ x: x + dx * 1.2, z: 1.9, r: 0.12 });
    }
  }

  // ================================================================== EL SUELO
  const grupoSuelo = construirSuelo();
  scene.add(grupoSuelo);
  function colorSuelo(x, z, h) {
    const n = ruido(x * 0.23 - 3, z * 0.23 + 5), n2 = ruido(x * 1.1 + 2, z * 1.1);
    const c = new THREE.Color();
    const zz = -z;
    if (z > -0.9) {
      c.set('#5f5c55').lerp(col('#6f6b62'), n * 0.8);
      const ronda = Math.exp(-(((z - 8) / 1.5) ** 4));
      c.lerp(col('#76726a'), ronda * 0.8);
      const rodada = Math.exp(-(((z - 7.15) / 0.3) ** 2)) + Math.exp(-(((z - 8.85) / 0.3) ** 2));
      c.lerp(col('#433f3a'), Math.min(1, rodada) * 0.75);
      c.lerp(col('#3f3c37'), (1 - lisa(0.8, 2.4, z)) * 0.8);          // el barro al pie del muro
    } else {
      const f = fondoFoso(zz, x) * Math.max(0, Math.min(1, (Math.abs(x) - 3.4) / 1.9));
      c.set('#55503f').lerp(col('#5f6150'), n);                       // el campo, hierba seca
      c.lerp(col('#4f493f'), Math.exp(-(((zz - 5.8) / 1.4) ** 2)) * 0.85);   // la tierra removida del caballon
      c.lerp(col('#433f39'), (1 - lisa(0.9, 1.5, zz)) * 0.8);
      c.lerp(col('#3a3631'), Math.min(1, f * 2.2));
      c.lerp(col('#2a2723'), Math.max(0, f - 0.5) * 2);
    }
    const ax = Math.abs(x);
    c.lerp(col('#4d4a45'), (1 - lisa(3.1, 4.2, ax)) * 0.9);
    c.multiplyScalar(0.88 + 0.24 * n2);
    return c;
  }
  function construirSuelo() {
    const g = new THREE.Group();
    // malla fina: x cada 0,5 m; z mas denso en el foso y junto al muro
    const xs = [], zs = [];
    for (let x = -96; x <= 96.001; x += 0.5) xs.push(x);
    for (let z = 48; z > -84.001;) { zs.push(z); z -= z > 14 ? 1 : z > 1.6 ? 0.35 : z > -6.5 ? 0.1 : z > -16 ? 0.35 : 1; }
    if (zs[zs.length - 1] > -84) zs.push(-84);
    g.add(rejilla(xs, zs, false));
    // la de lejos, gruesa, con un hueco donde esta la fina
    const xl = [], zl = [];
    for (let x = -1200; x <= 1200; x += 12) xl.push(x);
    for (let z = 1200; z >= -1200; z -= 12) zl.push(z);
    g.add(rejilla(xl, zl, true));
    return g;
  }
  function rejilla(xs, zs, hueco) {
    const nx = xs.length, nz = zs.length, pos = new Float32Array(nx * nz * 3), cl = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = xs[i], z = zs[j], k = j * nx + i;
      let y = suelo(x, z);
      if (hueco) y = Math.max(-2.6, y) - 0.02 * Math.min(1, Math.hypot(x, z) / 400);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      const c = colorSuelo(x, z, y);
      cl[k * 3] = c.r; cl[k * 3 + 1] = c.g; cl[k * 3 + 2] = c.b;
      uv[k * 2] = x; uv[k * 2 + 1] = z;
    }
    const idx = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      if (hueco) { const xm = (xs[i] + xs[i + 1]) / 2, zm = (zs[j] + zs[j + 1]) / 2; if (xm > -96 && xm < 96 && zm < 48 && zm > -84) continue; }
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, b, c, b, d, c);                  // (z baja con j: asi la cara mira arriba)
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cl, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M.suelo);
    m.receiveShadow = true;
    m.name = hueco ? 'sueloLejos' : 'suelo';
    return m;
  }

  // ---- la CARRETERA: de lejos de dentro, por el hueco del puesto, sobre el terraplen del foso y fuera por el campo
  {
    const pos = [], uv = [], idx = [];
    const zs = [];
    for (let z = 46; z >= -82; z -= 0.5) zs.push(z);
    const xs = [-3.05, -2.3, -1.5, -0.75, 0, 0.75, 1.5, 2.3, 3.05];
    zs.forEach((z, j) => xs.forEach((x, i) => {
      // el borde comido: el asfalto se deshace hacia fuera
      const borde = Math.abs(x) > 3 ? (ruido(z * 0.9, x) - 0.5) * 0.35 : 0;
      const xx = x + Math.sign(x) * borde;
      pos.push(xx, suelo(xx, z) + 0.018, z);
      uv.push((x + 3.05) / 6.1, z / 6.1);
    }));
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) { const a = j * xs.length + i, b = a + 1, c = a + xs.length, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const c = new Float32Array(g.attributes.position.count * 3).fill(1);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const m = new THREE.Mesh(g, M.asfalto);
    m.receiveShadow = true; m.name = 'carretera';
    scene.add(m);
  }

  // ---- el AGUA: el fondo del foso y los charcos de las rodadas y los baches (reflejan el cielo y las luces calidas)
  const aguaU = { uArriba: { value: col('#3a4652') }, uHorizonte: { value: col('#76828f') }, uCalido: { value: col('#8b8274') }, uFondo: { value: col('#14171a') },
    uRuido: U.uRuido, uT: U.uT, uLP: { value: [V(0, -99, 0), V(0, -99, 0), V(0, -99, 0), V(0, -99, 0)] }, uLC: { value: [V(0, 0, 0), V(0, 0, 0), V(0, 0, 0), V(0, 0, 0)] } };
  const agua = new THREE.ShaderMaterial({
    uniforms: aguaU, fog: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
      uniform vec3 uArriba, uHorizonte, uCalido, uFondo; uniform sampler2D uRuido; uniform float uT; uniform vec3 uLP[4], uLC[4];
      varying vec3 vW;
      void main() {
        vec3 Vd = normalize(cameraPosition - vW);
        vec2 q = vW.xz * 0.9;
        float a = texture2D(uRuido, q * 0.21 + vec2(uT * 0.013, uT * 0.007)).r - texture2D(uRuido, q * 0.21 + vec2(0.003, 0.0) + vec2(uT * 0.013, uT * 0.007)).r;
        float b = texture2D(uRuido, q * 0.37 + vec2(-uT * 0.009, uT * 0.011)).r - texture2D(uRuido, q * 0.37 + vec2(0.0, 0.003) + vec2(-uT * 0.009, uT * 0.011)).r;
        vec3 N = normalize(vec3(a * 6.0, 1.0, b * 6.0));
        vec3 R = reflect(-Vd, N);
        float h = clamp(R.y, 0.0, 1.0);
        vec3 cielo = mix(mix(uHorizonte, uCalido, smoothstep(-0.2, 0.9, R.z) * 0.6), uArriba, pow(h, 0.55));
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, Vd), 0.0), 5.0);
        vec3 c = mix(uFondo, cielo, clamp(F * 1.15, 0.0, 1.0));
        for (int k = 0; k < 4; k++) {
          vec3 Ld = uLP[k] - vW; float d = length(Ld); Ld /= d;
          float s = pow(max(dot(R, Ld), 0.0), 260.0) * 3.0 + pow(max(dot(R, Ld), 0.0), 18.0) * 0.06;
          c += uLC[k] * s / (1.0 + d * d * 0.01);
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  {
    // el foso (de punta a punta menos el terraplen)
    for (const [x0, x1] of [[-80, -4.4], [4.4, 80]]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 2.6).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, M4.FOSO.agua, -2.8), agua);
      w.name = 'aguaFoso'; scene.add(w);
    }
    // los charcos: en las rodadas (el suelo los recorta) y en los baches del arcen
    const ch = new THREE.Mesh(new THREE.PlaneGeometry(110, 0.7).rotateX(-Math.PI / 2), agua);
    for (const zr of [7.15, 8.85]) { const c = ch.clone(); c.position.set(0, -0.052, zr); c.name = 'charco'; scene.add(c); }
    for (const [x, z, s] of [[-2.2, 6.5, 0.9], [1.9, 11.4, 0.6], [-1.6, -9.5, 0.8], [2.4, -16, 1.1], [-3.4, 3.4, 0.7]]) {
      const g = new THREE.CircleGeometry(s, 18).rotateX(-Math.PI / 2);
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const f = 0.75 + 0.35 * Math.sin(a * 3 + x) * Math.sin(a * 2 - z); p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f * 0.7); }
      const c = new THREE.Mesh(g, agua); c.position.set(x, suelo(x, z) + 0.022, z); c.name = 'charco'; scene.add(c);
    }
  }

  // ================================================================== EL PUESTO DE CONTROL (x en [-2,4, 2,4])
  {
    // el porton: dos hojas de tubo con malla soldada, cerradas con cadena y candado, sobre su carril; concertina encima
    const P = M4.PUESTO;
    for (const [x0, x1, z] of [[-P, 0.05, -0.035], [-0.05, P, 0.035]]) {
      const h = 2.35, y0 = 0.08;
      for (const xx of [x0, x1]) cajaE('aceroOsc', xx - 0.03, xx + 0.03, y0, y0 + h, z - 0.03, z + 0.03, { tinta: 0.006 });
      for (const yy of [y0, y0 + h / 2, y0 + h - 0.06]) cajaE('aceroOsc', x0, x1, yy, yy + 0.06, z - 0.03, z + 0.03, { tinta: 0.006 });
      barra('aceroOsc', V(x0 + 0.03, y0 + 0.06, z), V(x1 - 0.03, y0 + h / 2, z), 0.04, { tinta: 0.004 });
      const malla = new THREE.PlaneGeometry(x1 - x0 - 0.06, h - 0.1);
      const uv = malla.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 0.15, uv.getY(i) * h / 0.15);
      malla.translate((x0 + x1) / 2, y0 + h / 2, z);
      L.meter('rejilla', malla);
      for (const xx of [x0 + 0.3, x1 - 0.3]) cilindro('aceroOsc', V(xx, 0.08, z - 0.06), V(xx, 0.08, z + 0.06), 0.07, 12, 0.005);
      concertina(L, V(x0, y0 + h + 0.02, z), V(x1, y0 + h + 0.02, z), 0.26);
    }
    cajaE('aceroOsc', -P - 1.5, P, 0, 0.03, -0.09, 0.09, { tinta: 0.004 });          // el carril
    for (let k = 0; k < 7; k++) cilindro('aceroOsc', V(0.02, 1.22 - k * 0.055, 0.0), V(0.02 + (k % 2) * 0.006, 1.22 - (k + 1) * 0.055, 0.0), 0.012, 5, 0);   // la cadena
    cajaE('acero', -0.04, 0.08, 0.82, 0.92, -0.06, 0.06, { tinta: 0.004 });          // el candado
    caja2(-P, P, -0.1, 0.1);
    L.senal(3, V(-1.2, 1.55, 0.0), V(0, 0, 1), 0.42, 0.42);
    L.senal(5, V(1.2, 1.55, 0.072), V(0, 0, 1), 0.42, 0.42);
    L.senal(5, V(-1.2, 1.55, -0.072), V(0, 0, -1), 0.42, 0.42);
    // la pluma: poste con contrapeso, el brazo a franjas y la horquilla donde apoya
    const zp = 3.2;
    cajaE('aceroOsc', -3.65, -3.35, 0, 1.0, zp - 0.15, zp + 0.15, { tinta: 0.01 });
    cajaE('aceroOsc', -3.9, -3.55, 0.82, 1.18, zp - 0.12, zp + 0.12, { tinta: 0.008 });   // el contrapeso
    for (let k = 0; k < 16; k++) {
      const x0 = -3.45 + k * 0.42, x1 = Math.min(3.05, x0 + 0.42);
      if (x0 >= 3.05) break;
      cajaE(k % 2 ? 'aceroOsc' : 'pintura', x0, x1, 1.08, 1.16, zp - 0.04, zp + 0.04, { tinta: k === 0 ? 0.006 : 0 });
    }
    L.tinta(new THREE.BoxGeometry(6.5, 0.08, 0.08).translate(-0.2, 1.12, zp), 0.006);
    cajaE('aceroOsc', 3.1, 3.18, 0, 1.08, zp - 0.04, zp + 0.04, { tinta: 0.006 });
    for (const dz of [-0.07, 0.07]) cajaE('aceroOsc', 3.06, 3.22, 1.08, 1.2, zp + dz - 0.015, zp + dz + 0.015, { tinta: 0 });
    choques.circulos.push({ x: -3.6, z: zp, r: 0.28 }, { x: 3.14, z: zp, r: 0.1 });
    // la caseta del puesto X-3 (casetas.js): puerta a la carretera, ventana al porton y otra adentro, foco en la cubierta
    const K = { x0: 3.7, x1: 5.9, z0: 1.9, z1: 4.1, alto: 2.4 };
    caseta({ cajaE: (...a) => cajaE(...a), barra: (...a) => barra(...a), cilindro: (...a) => cilindro(...a), senal: L.senal }, {
      x0: K.x0, x1: K.x1, z0: K.z0, z1: K.z1, y0: 0, alto: K.alto, codigo: 0, rejas: true,
      puerta: { lado: '-x', u: 1.5, mano: 'izq' },
      ventanas: [{ lado: '-z', u: 1.1, ancho: 1.3, v0: 1.0, v1: 1.75 }, { lado: '-x', u: 0.5, ancho: 0.6, v0: 1.05, v1: 1.7 }, { lado: '+z', u: 1.2, ancho: 1.0, v0: 1.0, v1: 1.7 }],
      camara: ['-z', true], cuadro: ['+x', 0.6], aire: [5.3, 3.6], canalon: '+x', foco: [K.x0 + 0.35, K.z0 + 0.35, 0, -1],
    });
    caja2(K.x0 - 0.15, K.x1 + 0.15, K.z0 - 0.15, K.z1 + 0.15);
    // el nido de sacos al otro lado, abierto hacia dentro
    const lista = [];
    muroSacos(lista, V(-7.7, 0, 1.75), V(-4.9, 0, 1.75), 0, 7, 2);
    muroSacos(lista, V(-7.55, 0, 2.05), V(-7.55, 0, 3.9), 0, 7, 2);
    muroSacos(lista, V(-5.05, 0, 2.05), V(-5.05, 0, 3.4), 0, 7, 2);
    // los sacos que cierran las rendijas del bloque caido y los del bloque torcido
    muroSacos(lista, V(xc - 1.4, 0, 0.95), V(xc + 1.4, 0, 0.95), 0, 4, 1);
    muroSacos(lista, V(xBloque(M4.TORCIDO) - 0.7, 0, 0.95), V(xBloque(M4.TORCIDO) + 0.7, 0, 0.95), 0, 3, 1);
    const tSacos = sacos(lista, toon('#ffffff', { map: tSaco }));
    tSacos.material.vertexColors = false;
    tSacos.name = 'sacos';
    scene.add(tSacos);
    caja2(-7.9, -4.7, 1.5, 2.0, 0.92); caja2(-7.8, -7.3, 2.0, 4.05, 0.92); caja2(-5.3, -4.8, 2.0, 3.55, 0.92);
    caja2(xc - 1.4, xc + 1.4, 0.75, 1.15, 0.52);
    caja2(xBloque(M4.TORCIDO) - 0.7, xBloque(M4.TORCIDO) + 0.7, 0.75, 1.15, 0.39);
    // la chicane de gaviones en la carretera
    for (const [x0, z] of [[-3.15, 12.2], [0.95, 15.6]]) {
      for (let k = 0; k < 2; k++) gavion(L, x0 + 0.55 + k * 1.1, 0, z, 1.06, 1.37, 1.06, (r() - 0.5) * 0.04);
      caja2(x0, x0 + 2.2, z - 0.55, z + 0.55);
    }
    // el mastil de los focos (6,8 m) con su escalera, la caja, el generador y el cable por el suelo
    const mx = -4.25, mz = 1.45;
    cilindro('aceroOsc', V(mx, 0, mz), V(mx, 6.8, mz), 0.11, 12, 0.012, null, 0.075);
    cajaE('aceroOsc', mx - 0.3, mx + 0.3, 0, 0.05, mz - 0.3, mz + 0.3, { tinta: 0.006 });
    for (let y = 0.6; y < 6.3; y += 0.32) barra('acero', V(mx - 0.14, y, mz + 0.12), V(mx + 0.14, y, mz + 0.12), 0.022, { tinta: 0 });
    barra('aceroOsc', V(mx - 0.8, 6.65, mz), V(mx + 0.8, 6.65, mz), 0.08, { tinta: 0.006 });
    const cabezas = [];
    for (const dx of [-0.65, 0.65]) {
      const a = V(mx + dx, 6.55, mz - 0.05), dir = V(dx * 0.6, -0.45, -1).normalize();
      const b = a.clone().addScaledVector(dir, 0.32);
      cajaE('aceroOsc', a.x - 0.03, a.x + 0.03, 6.55, 6.65, a.z - 0.03, a.z + 0.03, { tinta: 0 });
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir);
      caja('aceroOsc', a.x + dir.x * 0.12, a.y + dir.y * 0.12, a.z + dir.z * 0.12, 0.46, 0.34, 0.2, { q, tinta: 0.008 });
      caja('focoLuz', a.x + dir.x * 0.225, a.y + dir.y * 0.225, a.z + dir.z * 0.225, 0.4, 0.28, 0.01, { q, tinta: 0 });
      for (let k = 0; k < 5; k++) caja('aceroOsc', a.x + dir.x * 0.04, a.y + dir.y * 0.04 - 0.12 + k * 0.06, a.z + dir.z * 0.04, 0.5, 0.02, 0.06, { q, tinta: 0 });
      cabezas.push({ p: b, dir });
    }
    cajaE('aceroOsc', mx + 0.1, mx + 0.4, 1.1, 1.55, mz - 0.1, mz + 0.12, { tinta: 0.006 });
    // el generador: bancada con ruedas, carcasa con las rejillas, el cuadro con su tapa, el escape y el bidon de gasoil
    cajaE('aceroOsc', -6.45, -5.25, 0.12, 0.2, 4.55, 5.35, { tinta: 0.006 });
    for (const [x, z] of [[-6.3, 4.6], [-6.3, 5.3], [-5.4, 4.6], [-5.4, 5.3]]) cilindro('goma', V(x, 0.11, z - 0.04), V(x, 0.11, z + 0.04), 0.11, 12, 0.005);
    cajaE('pintura', -6.4, -5.3, 0.2, 0.78, 4.6, 5.3, { tinta: 0.01, color: col('#7d8a6c') });
    for (let k = 0; k < 7; k++) cajaE('aceroOsc', -6.38 + k * 0.05, -6.36 + k * 0.05, 0.3, 0.68, 4.585, 4.6, { tinta: 0 });
    for (let k = 0; k < 7; k++) cajaE('aceroOsc', -5.75 + k * 0.05, -5.73 + k * 0.05, 0.3, 0.68, 5.3, 5.315, { tinta: 0 });
    cajaE('aceroOsc', -5.3, -5.27, 0.32, 0.66, 4.75, 5.15, { tinta: 0.004 });
    cajaE('negro', -5.27, -5.265, 0.4, 0.5, 4.8, 4.9, { tinta: 0 });
    cajaE('ambar', -5.27, -5.262, 0.56, 0.58, 4.82, 4.85, { tinta: 0 });
    cilindro('aceroOsc', V(-6.25, 0.78, 4.75), V(-6.25, 1.25, 4.75), 0.035, 8, 0.005);
    cilindro('aceroOsc', V(-6.25, 1.25, 4.75), V(-6.3, 1.32, 4.75), 0.035, 8, 0.004);
    bidon(L, -6.9, 0, 5.0, { fila: 2, semilla: 21 });
    choques.circulos.push({ x: -6.9, z: 5.0, r: 0.3 });
    caja2(-6.5, -5.2, 4.5, 5.4, 0.78);
    cuerda(L, [V(-5.4, 0.3, 4.6), V(-5.0, 0.02, 3.6), V(-4.6, 0.02, 2.5), V(mx + 0.2, 0.02, mz + 0.4), V(mx + 0.2, 1.1, mz + 0.13)], 0.018, 'goma');
    choques.circulos.push({ x: mx, z: mz, r: 0.18 });
    // bidones con arena y un par de conos junto a la caseta
    for (const [x, z, f] of [[6.3, 1.7, 1], [6.35, 2.35, 1], [3.2, 4.9, 0]]) { bidon(L, x, 0, z, { fila: f, semilla: x * 10 | 0 }); choques.circulos.push({ x, z, r: 0.3 }); }
    M4.cabezas = cabezas;
  }

  // ================================================================== SALTADERO 1: el coche, las ruedas y la escalera de trastos
  const ESCALON = [];                         // [x0, x1, z0, z1, top]: lo que se pisa, para los choques
  {
    // dos ruedas apiladas delante del morro
    for (let k = 0; k < 2; k++) {
      const g = new THREE.TorusGeometry(0.24, 0.1, 10, 20).rotateX(Math.PI / 2).scale(1, 1.05, 1).translate(-17.42, 0.105 + k * 0.205, 1.75);
      L.meter('goma', g); L.tinta(g, 0.008);
    }
    ESCALON.push([-17.78, -17.06, 1.4, 2.1, 0.41]);
    // el coche, contra el pie del muro, con la rueda de atras pinchada
    coche(L, -17.0, 0, 0.86, { color: col('#7c868c'), pinchada: 1 });
    ESCALON.push([-17.0, -15.75, 0.86, 2.46, 0.84], [-15.75, -15.4, 0.86, 2.46, 1.1], [-15.4, -13.85, 0.86, 2.46, 1.37], [-13.85, -13.1, 0.86, 2.46, 0.95]);
    // la escalera de trastos sobre el pie, entre el coche y el muro, subiendo a lo largo del muro hasta 3,56
    const Z0 = 0.17, Z1 = 0.84;
    const pila = [
      { x0: -15.35, x1: -13.9, top: 1.8, cosas: [['caja', 0.62, '#7d6b55'], ['caja', 0.53, '#6a5b49'], ['pale', 0.144]] },
      { x0: -13.9, x1: -13.2, top: 2.24, cosas: [['nevera', 1.59], ['pale', 0.144]] },
      { x0: -13.2, x1: -12.5, top: 2.68, cosas: [['bidon', 0.88, 0], ['bidon', 0.88, 2], ['caja', 0.42, '#86745c']] },
      { x0: -12.5, x1: -11.8, top: 3.12, cosas: [['sacos', 0.6], ['bidon', 0.88, 1], ['caja', 0.62, '#6f5f4c'], ['caja', 0.52, '#7b6a55']] },
      { x0: -11.8, x1: -11.1, top: 3.56, cosas: [['bidon', 0.88, 3], ['bidon', 0.88, 0], ['caja', 0.62, '#806e58'], ['caja', 0.53, '#6d5d4b'], ['pale', 0.144]] },
    ];
    const listaS = [];
    for (const p of pila) {
      let y = T.ALTO_PIE;
      const cx = (p.x0 + p.x1) / 2, cz = (Z0 + Z1) / 2 + 0.03;
      for (const [tipo, h, extra] of p.cosas) {
        const dx = (r() - 0.5) * 0.06, dz = (r() - 0.5) * 0.05;
        if (tipo === 'caja') cajaMadera(L, p.x0 + 0.03 + dx, p.x1 - 0.03 + dx, y, y + h, Z0 + 0.04 + dz, Z1 - 0.02 + dz, { color: col(extra), picto: r() < 0.6 ? Math.floor(r() * 3) : null });
        // un pale (1,2 x 0,8) solo cabe a lo largo del muro en el escalon ancho; en los estrechos, una tapa de tablas
        else if (tipo === 'pale' && p.x1 - p.x0 > 1.1) pale(L, cx, y, cz, (r() - 0.5) * 0.06, col('#9a8a72'));
        else if (tipo === 'pale') cajaMadera(L, p.x0 + 0.02, p.x1 - 0.02, y, y + h, Z0 + 0.03, Z1 - 0.01, { color: col('#958670') });
        else if (tipo === 'bidon') bidon(L, cx + dx, y, cz + dz, { fila: extra, semilla: (y * 100) | 0 });
        else if (tipo === 'nevera') nevera(L, p.x0 + 0.04, p.x1 - 0.04, y, y + h, Z0 + 0.04, Z1 - 0.02, 1);
        else if (tipo === 'sacos') for (let l = 0; l < 4; l++) for (const s of [-1, 1]) listaS.push(l % 2 ? { x: cx, y: y + 0.075 + l * 0.15, z: cz + s * 0.17, giro: 0 } : { x: cx + s * 0.17, y: y + 0.075 + l * 0.15, z: cz, giro: Math.PI / 2 });
        y += h;
      }
      ESCALON.push([p.x0, p.x1, Z0, Z1, p.top]);
    }
    // entre el coche y el muro, por delante de la pila, sacos sobre el pie (si no, quedaba una zanja de 47 cm)
    for (let l = 0; l < 3; l++) for (let x = -16.95 + (l % 2) * 0.3; x < -15.45; x += 0.56) listaS.push({ x: x + 0.28, y: T.ALTO_PIE + 0.075 + l * 0.15, z: 0.52, giro: 0 });
    ESCALON.push([-17.0, -15.35, 0.17, 0.84, T.ALTO_PIE + 0.45]);
    const ms = sacos(listaS, toon('#ffffff', { map: tSaco })); ms.material.vertexColors = false; scene.add(ms);
    // atado a los agujeros de izado: una cuerda que abraza la pila y dos tablones de riostra
    cuerda(L, [V(-11.7, 3.7, 0.12), V(-11.9, 3.3, 0.85), V(-12.8, 2.9, 0.88), V(-13.7, 2.1, 0.88), V(-14.5, 1.85, 0.6), V(-14.75, 3.65, 0.12)], 0.012);
    barra('madera', V(-13.0, 0.03, 1.15), V(-11.4, 3.1, 0.9), 0.1, { tinta: 0.008, color: col('#8b7a62') });
    // una alfombra vieja doblada sobre la tapa del muro, donde se pasa
    {
      const pts = [[0.155, 3.05], [0.13, 3.6], [0.125, 3.97], [0.07, 4.035], [-0.07, 4.035], [-0.125, 3.97], [-0.135, 3.5], [-0.16, 2.95]];
      const pos = [], uv = [];
      const x0 = -11.85, x1 = -10.85, nx = 10;
      for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < nx; k++) {
        const xa = x0 + (x1 - x0) * k / nx, xb = x0 + (x1 - x0) * (k + 1) / nx;
        const ola = (xx, j) => (pts[j][1] < 3.9 ? 0.012 * Math.sin(xx * 9 + j) : 0);
        const A = [xa, pts[i][1], pts[i][0] + ola(xa, i)], B = [xb, pts[i][1], pts[i][0] + ola(xb, i)], C = [xb, pts[i + 1][1], pts[i + 1][0] + ola(xb, i + 1)], D = [xa, pts[i + 1][1], pts[i + 1][0] + ola(xa, i + 1)];
        pos.push(...A, ...B, ...C, ...A, ...C, ...D);
        const va = i / (pts.length - 1), vb = (i + 1) / (pts.length - 1), ua = k / nx, ub = (k + 1) / nx;
        uv.push(ua, va, ub, va, ub, vb, ua, va, ub, vb, ua, vb);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      L.meter('alfombra', g);
    }
    // FUERA: tres tablones de andamio por encima del foso (si se cae, al agua) y la concertina cortada y apartada
    const xt = -11.45;
    for (const dx of [-0.21, 0, 0.21]) {
      const za = -1.05, zb = -4.95, ya = suelo(xt, za) + 0.04, yb = suelo(xt, zb) + 0.04;
      const a = V(xt + dx, ya, za), b = V(xt + dx + (r() - 0.5) * 0.06, yb, zb);
      const d = b.clone().sub(a), q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, -1), d.clone().normalize());
      caja('madera', (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, 0.2, 0.04, d.length(), { q, tinta: 0.006, color: col('#958670') });
    }
    {
      const za = -1.05, zb = -4.95, ya = suelo(xt, za) + 0.06, yb = suelo(xt, zb) + 0.06;
      TABLAS.push({ x0: xt - 0.33, x1: xt + 0.33, z0: zb, z1: za, h: (z) => ya + (yb - ya) * (z - za) / (zb - za) });
    }
  }
  for (const [x0, x1, z0, z1, top] of ESCALON) caja2(x0, x1, z0, z1, top);

  // ================================================================== SALTADERO 2: bidones, pales y una cuerda de nudos
  {
    const x = SALT2;
    bidon(L, x - 0.6, 0, 1.25, { fila: 1, semilla: 3 }); bidon(L, x + 0.05, 0, 1.15, { fila: 3, semilla: 4 }); bidon(L, x - 0.3, 0.88, 1.2, { fila: 2, semilla: 5 });
    pale(L, x + 0.9, 0, 1.6, 0.2); pale(L, x + 0.9, 0.144, 1.62, 0.15);
    choques.circulos.push({ x: x - 0.6, z: 1.25, r: 0.3 }, { x: x + 0.05, z: 1.15, r: 0.3 });
    caja2(x + 0.3, x + 1.5, 1.15, 2.05, 0.29);
    // la cuerda: pasa por el agujero de izado, vuelve por encima de la tapa y cuelga hasta el suelo con nudos
    const xa = xBloque(16) + 0.3;
    cuerda(L, [V(xa, 3.7, 0.14), V(xa, 3.7, -0.14), V(xa + 0.02, 3.85, -0.13), V(xa + 0.02, 4.03, -0.05), V(xa + 0.01, 4.03, 0.06), V(xa, 3.85, 0.13), V(xa, 3.7, 0.15)], 0.014);
    const c = cuerda(L, [V(xa, 3.68, 0.15), V(xa + 0.01, 2.5, 0.152), V(xa + 0.02, 1.2, 0.16), V(xa + 0.03, 0.53, 0.2), V(xa + 0.05, 0.52, 0.75), V(xa + 0.1, 0.05, 0.95), V(xa + 0.4, 0.02, 1.25), V(xa + 0.1, 0.02, 1.4)], 0.014);
    for (let t = 0.05; t < 0.6; t += 0.07) { const p = c.getPointAt(t); const g = new THREE.SphereGeometry(0.03, 8, 6).scale(1, 1.3, 1).translate(p.x, p.y, p.z); L.meter('cuerda', g); }
  }

  // ================================================================== EXTRAMUROS: la chabola, la hoguera y lo de la gente
  const hoguera = V(-19.6, 0, 4.1);
  {
    // la chabola contra el muro: chapas apoyadas en la tapa de un pale, con neumaticos encima para que no vuelen
    const x0 = -25.6, x1 = -21.6;
    for (let k = 0; k < 5; k++) {
      const xa = x0 + 0.1 + k * 0.82;
      const p0 = V(xa + 0.45, 0.02, 2.95 + (r() - 0.5) * 0.1), p1 = V(xa + 0.45 + (r() - 0.5) * 0.05, 2.65 + (r() - 0.5) * 0.08, 0.2);
      chapaGrecada(L, p0, p1, 0.95, V(0, 1, 0.6), col('#ffffff').setScalar(0.85 + r() * 0.25));
    }
    barra('madera', V(x0, 2.5, 0.35), V(x1, 2.52, 0.35), 0.1, { tinta: 0.008, color: col('#7a6b58') });
    for (const [x, z] of [[-24.6, 1.4], [-22.8, 1.9]]) { const g = new THREE.TorusGeometry(0.26, 0.1, 8, 16).rotateX(Math.PI / 2 + 0.85).translate(x, 2.0 - (z - 1.4) * 0.8, z); L.meter('goma', g); L.tinta(g, 0.008); }
    // los costados: un pale de pie y la lona azul que hace de puerta
    cajaE('madera', x0 - 0.05, x0 + 0.05, 0, 1.2, 0.85, 2.85, { tinta: 0.008, color: col('#8a7a63') });
    for (let k = 0; k < 6; k++) cajaE('madera', x0 - 0.07, x0 + 0.07, 0.1 + k * 0.2, 0.18 + k * 0.2, 0.85, 2.85, { tinta: 0, color: col('#7b6c57') });
    {
      const g = new THREE.PlaneGeometry(2.0, 2.3, 12, 8);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i); p.setZ(i, 0.06 * Math.sin(u * 5 + v) * (1.15 - v / 2.3)); }
      g.computeVertexNormals();
      g.rotateY(Math.PI / 2).translate(x1 + 0.08, 1.12, 1.85);
      L.meter('lona', g);
    }
    // lo oscuro de dentro: un prisma bajo la pendiente de las chapas (una caja las atravesaba)
    {
      const f = new THREE.Shape([new THREE.Vector2(0.85, 0.01), new THREE.Vector2(2.75, 0.01), new THREE.Vector2(0.85, 1.96)]);
      const g = new THREE.ExtrudeGeometry(f, { depth: x1 - x0 - 0.2, bevelEnabled: false });
      g.rotateY(-Math.PI / 2).translate(x1 - 0.02, 0, 0);
      L.meter('negro', g);
    }
    caja2(x0 - 0.1, x1 + 0.1, 0.8, 3.0);
    // la hoguera en un bidon agujereado, con una parrilla y un cazo; asientos alrededor
    bidon(L, hoguera.x, 0, hoguera.z, { fila: 3, mat: 'fuego', tapa: false, semilla: 9 });
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI; barra('aceroOsc', V(hoguera.x - 0.3, 0.9, hoguera.z - 0.27 + k * 0.09), V(hoguera.x + 0.3, 0.9, hoguera.z - 0.27 + k * 0.09), 0.012, { tinta: 0 }); }
    cilindro('aceroOsc', V(hoguera.x + 0.08, 0.91, hoguera.z), V(hoguera.x + 0.08, 1.04, hoguera.z), 0.11, 14, 0.006);
    barra('aceroOsc', V(hoguera.x + 0.19, 1.0, hoguera.z), V(hoguera.x + 0.42, 1.03, hoguera.z + 0.05), 0.02, { tinta: 0 });
    choques.circulos.push({ x: hoguera.x, z: hoguera.z, r: 0.32 });
    cajaMadera(L, hoguera.x - 1.5, hoguera.x - 1.0, 0, 0.42, hoguera.z - 0.3, hoguera.z + 0.22, { color: col('#7a6852'), picto: 1 });
    bidon(L, hoguera.x + 0.9, 0, hoguera.z + 1.0, { fila: 0, semilla: 11 });
    const neu = new THREE.TorusGeometry(0.26, 0.1, 8, 16).rotateX(Math.PI / 2).translate(hoguera.x + 0.3, 0.1, hoguera.z - 1.25); L.meter('goma', neu); L.tinta(neu, 0.008);
    choques.circulos.push({ x: hoguera.x - 1.25, z: hoguera.z - 0.04, r: 0.3 }, { x: hoguera.x + 0.9, z: hoguera.z + 1.0, r: 0.3 });
    // la cuerda de tender, de la chabola a un palo, con la ropa
    cilindro('madera', V(-17.4, 0, 6.6), V(-17.4, 1.95, 6.6), 0.035, 6, 0.006, col('#6b5e4e'));
    cilindro('madera', V(-21.35, 0, 3.15), V(-21.35, 2.0, 3.15), 0.04, 6, 0.006, col('#6b5e4e'));
    choques.circulos.push({ x: -17.4, z: 6.6, r: 0.06 }, { x: -21.35, z: 3.15, r: 0.06 });
    cable(L, V(-21.35, 1.95, 3.15), V(-17.4, 1.9, 6.6), 0.16, 0.007);
    M4.ropa = [];
    for (const [t, w, h, c] of [[0.2, 0.42, 0.55, '#7d8790'], [0.38, 0.5, 0.4, '#6b5a4e'], [0.58, 0.38, 0.62, '#8f8b80'], [0.78, 0.55, 0.35, '#4e5966']]) {
      const a = V(-21.35, 1.95, 3.15).lerp(V(-17.4, 1.9, 6.6), t); a.y -= 4 * 0.16 * t * (1 - t);
      M4.ropa.push({ p: a, w, h, c: col(c) });
    }
    // un colchon contra el muro, bolsas de basura, garrafas, un pale tirado
    caja('tela', -27.4, 0.95, 0.55, 0.9, 1.85, 0.16, { q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0.06, 0)), tinta: 0.01, color: col('#8c8370') });
    for (const [x, z, s] of [[-26.6, 1.3, 0.34], [-26.2, 1.05, 0.3], [-20.8, 1.2, 0.36], [-16.4, 3.6, 0.28], [7.4, 1.25, 0.32]]) {
      const g = new THREE.SphereGeometry(s, 10, 7);
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, Math.max(y, -s * 0.55)); p.setX(i, p.getX(i) * (1 + 0.15 * Math.sin(i))); }
      g.computeVertexNormals(); g.translate(x, s * 0.55, z);
      L.meter('negro', g); L.tinta(g, 0.008);
    }
    for (const [x, z, a] of [[-23.9, 3.4, 0.3], [-18.3, 2.9, -0.6]]) cajaE('pintura', x - 0.12, x + 0.12, 0, 0.32, z - 0.08, z + 0.08, { tinta: 0.006, color: col(a > 0 ? '#5f6d5b' : '#8a8f8a') });
    pale(L, -23.0, 0, 5.4, 0.5, col('#8a7a63'));
    caja2(-23.6, -22.4, 4.9, 5.9, 0.15);
  }

  // ================================================================== FUERA: concertina, erizos, arboles secos, torres
  {
    // la concertina por el borde de fuera del foso, cortada en el saltadero y en la carretera; piquetes cada 4 m
    const zc = -5.0;
    const tramos = [[-46, -12.25], [-10.65, -5.4], [5.4, 46]];
    for (const [a, b] of tramos) {
      for (let x = a; x < b; x += 6) {
        const x2 = Math.min(b, x + 6);
        concertina(L, V(x, 0, zc + Math.sin(x) * 0.08), V(x2, 0, zc + Math.sin(x2) * 0.08), 0.44, suelo);
      }
      for (let x = a; x <= b; x += 4) { const y = suelo(x, zc); barra('oxido', V(x, y - 0.1, zc - 0.05), V(x, y + 1.0, zc - 0.05), 0.03, { tinta: 0.004 }); }
      caja2(a, b, zc - 0.48, zc + 0.48);
    }
    // los extremos cortados del saltadero: el alambre apartado y aplastado
    concertina(L, V(-12.25, 0, -5.0), V(-12.7, 0, -6.1), 0.3, suelo);
    concertina(L, V(-10.65, 0, -5.0), V(-10.2, 0, -6.0), 0.28, suelo);
    // el caballo de frisa en la carretera: un bastidor en X con concertina y una rueda
    {
      const z = -9.2, y = suelo(0, z);
      for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) for (const s of [-1, 1]) barra('oxido', V(x - 0.1, y + 0.02, z - s * 0.55), V(x + 0.1, y + 1.15, z + s * 0.55), 0.06, { tinta: 0.006 });
      barra('oxido', V(-3.0, y + 0.6, z), V(3.0, y + 0.6, z), 0.07, { tinta: 0.006 });
      concertina(L, V(-3.0, y + 0.18, z), V(3.0, y + 0.18, z), 0.42);
      cilindro('goma', V(3.1, y + 0.25, z - 0.05), V(3.1, y + 0.25, z + 0.05), 0.25, 14, 0.006);
      caja2(-3.2, 3.2, z - 0.6, z + 0.6);
    }
    // erizos checos por el campo y junto a la carretera
    for (const [x, z, g] of [[-5.6, -11.5, 0.3], [5.2, -12.6, 1.1], [-7.4, -17.8, 2.0], [7.8, -19.2, 0.7], [-1.2, -21.5, 1.6], [14.5, -14.2, 0.2], [-16.5, -13.0, 2.4]]) {
      erizo(L, x, suelo(x, z), z, g);
      choques.circulos.push({ x, z, r: 0.62 });
    }
    // arboles secos: fuera, y alguno dentro
    [[-21, -14, 7.5, 3], [-34, -22, 9, 5], [18, -24, 8, 7], [31, -15, 6.5, 9], [44, -33, 10, 11], [-48, -40, 11, 13], [6, -46, 9, 15], [-62, 18, 8, 17], [38, 21, 7, 19], [-6, 34, 9.5, 21]]
      .forEach(([x, z, h, s]) => { arbolSeco(L, x, suelo(x, z), z, h, s); choques.circulos.push({ x, z, r: 0.25 }); });
    // las torres de alta tension, fuera, y sus cables que se pierden en la bruma
    const ta = torreta(L, -38, suelo(-38, -72), -72, 0.1), tb = torreta(L, 46, suelo(46, -88), -88, 0.15);
    for (let k = 0; k < ta.length; k++) {
      cable(L, ta[k], tb[k], 3.2, 0.02);
      cable(L, ta[k], ta[k].clone().add(V(-90, -6, 25)), 4.0, 0.02);
    }
    // un coche quemado en la carretera, fuera
    coche(L, -0.6, suelo(0, -27), -28.6, { quemado: true, ancho: 1.6 });
    choques.cajas.push({ x: 1.35, z: -27.8, hx: 2.0, hz: 0.85, ang: 0 });
  }

  // ================================================================== LEJOS: ruinas de Extramuros y EL MURO GRANDE
  {
    // casas destrozadas: muros con huecos y sin tejado (siluetas en la bruma)
    const casa = (x, z, w, d, h, s) => {
      const rr = azar(s);
      for (const [ax, az, bx, bz] of [[x, z, x + w, z], [x + w, z, x + w, z + d], [x + w, z + d, x, z + d], [x, z + d, x, z]]) {
        const lx = bx - ax, lz = bz - az, L2 = Math.hypot(lx, lz), ux = lx / L2, uz = lz / L2;
        for (let t = 0; t < L2 - 0.1; t += 1.5) {
          const roto = rr() < 0.3 ? rr() * h * 0.7 : 0, hh = h - roto;
          const hueco = rr() < 0.55;
          const t1 = Math.min(L2, t + 1.5);
          const p0 = [ax + ux * t, az + uz * t], p1 = [ax + ux * t1, az + uz * t1];
          const seg = (y0, y1, a = 0, b = 1) => cajaE('lejos', Math.min(p0[0] + ux * (t1 - t) * a, p0[0] + ux * (t1 - t) * b) - 0.15 * Math.abs(uz), Math.max(p0[0] + ux * (t1 - t) * a, p0[0] + ux * (t1 - t) * b) + 0.15 * Math.abs(uz), y0, y1,
            Math.min(p0[1] + uz * (t1 - t) * a, p0[1] + uz * (t1 - t) * b) - 0.15 * Math.abs(ux), Math.max(p0[1] + uz * (t1 - t) * a, p0[1] + uz * (t1 - t) * b) + 0.15 * Math.abs(ux), { tinta: 0 });
          if (hueco && hh > 2) { seg(0, 0.9); seg(2.0, hh); seg(0.9, 2.0, 0, 0.25); seg(0.9, 2.0, 0.75, 1); } else seg(0, Math.max(0.4, hh));
          void p1;
        }
      }
    };
    casa(-34, 36, 9, 7, 6.5, 1); casa(18, 44, 11, 8, 8.5, 2); casa(-9, 58, 7, 9, 5.5, 3); casa(42, 62, 12, 9, 9.5, 4); casa(-56, 66, 10, 8, 7, 5);
    // el muro grande a 300 m (40 m de alto), en arco, con sus torres de sensores y una fila de luces arriba
    const RM = 450, CZ = 300 + RM;
    const luces = [];
    for (let x = -460; x < 460; x += 20) {
      const za = CZ - Math.sqrt(Math.max(0, RM * RM - x * x)), zb = CZ - Math.sqrt(Math.max(0, RM * RM - (x + 20) ** 2));
      const g = new THREE.BoxGeometry(Math.hypot(20, zb - za) + 0.5, 42, 8);
      g.rotateY(-Math.atan2(zb - za, 20)).translate(x + 10, 19, (za + zb) / 2 + 4);
      L.meter('lejos', g);
      if (Math.round(x) % 40 === 0) luces.push(V(x + 10, 40.6, (za + zb) / 2 - 1));
    }
    for (const x of [-330, -220, -110, 0, 110, 220, 330]) {
      const z = CZ - Math.sqrt(RM * RM - x * x);
      cajaE('lejos', x - 2.5, x + 2.5, 0, 52, z - 2, z + 4, { tinta: 0 });
      cajaE('lejos', x - 4, x + 4, 50, 54, z - 3, z + 5, { tinta: 0 });
      luces.push(V(x, 54.5, z - 3.2));
    }
    M4.lucesLejos = luces;
  }

  // ================================================================== construir los lotes
  // las pintadas (no llevan color por vertice) van en su propia malla
  const mPint = new THREE.Mesh(mergeG(calco), M.pintadas);
  mPint.name = 'pintadas'; mPint.receiveShadow = true; mPint.renderOrder = 2;
  scene.add(mPint);
  const mallas = L.construir(scene, M, ['tinta', 'pintadas', 'picto', 'ventana', 'ambar', 'negro', 'focoLuz', 'vidrio', 'interiorPared', 'interiorBajo', 'interiorTecho', 'mueble', 'pantalla', 'pantallaApagada', 'plano', 'senal', 'lejos', 'alambre']);
  if (mallas.lejos) { mallas.lejos.receiveShadow = false; mallas.lejos.castShadow = false; }

  // ---- la ropa tendida (se mece)
  const tRopa = texturaRopa();
  const ropa = M4.ropa.map(({ p, w, h, c }, i) => {
    const g = new THREE.PlaneGeometry(w, h, 4, 4).translate(0, -h / 2, 0);
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (i % 4 + uv.getX(k)) / 4);
    const m = new THREE.Mesh(g, toon(c, { side: THREE.DoubleSide, vertexColors: false, map: tRopa, alphaTest: 0.5 }));
    m.position.copy(p); m.rotation.y = -0.72; m.castShadow = true;
    scene.add(m);
    return m;
  });

  // ================================================================== HIERBA SECA (matas de tarjetas cruzadas)
  const hierba = crearHierba();
  scene.add(hierba);
  function crearHierba() {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
    const c = cv.getContext('2d'), rh = azar(808);
    c.clearRect(0, 0, 256, 256);
    for (let k = 0; k < 70; k++) {
      const x0 = 30 + rh() * 196, h = 90 + rh() * 160, curva = (rh() - 0.5) * 60, g = 110 + rh() * 60;
      c.strokeStyle = `rgb(${g},${g * 0.96},${g * 0.78})`; c.lineWidth = 1.5 + rh() * 2.5;
      c.beginPath(); c.moveTo(x0, 256); c.quadraticCurveTo(x0 + curva * 0.3, 256 - h * 0.6, x0 + curva, 256 - h); c.stroke();
    }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const base = new THREE.PlaneGeometry(0.5, 0.38).translate(0, 0.19, 0);
    const g = mergeG([base.clone(), base.clone().rotateY(Math.PI / 3), base.clone().rotateY(-Math.PI / 3)]);
    const mat = new THREE.MeshToonMaterial({ map: tx, gradientMap: gradiente, alphaTest: 0.45, side: THREE.DoubleSide, color: '#b9b29a' });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = U.uT;
      sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float vaiven = sin(uT * 1.7 + ip.x * 0.37 + ip.z * 0.21) * 0.6 + sin(uT * 3.1 + ip.x) * 0.25;
        transformed.x += vaiven * 0.05 * uv.y * uv.y; transformed.z += vaiven * 0.03 * uv.y * uv.y;`);
    };
    const sitios = [];
    for (let n = 0; n < 9000 && sitios.length < 5200; n++) {
      const x = (rh() - 0.5) * 110, z = -1.4 - rh() * 40;
      const ff = fondoFoso(-z, x), ax = Math.abs(x);
      if (ax < 4.2 || ff > 0.05) continue;
      if (ruido(x * 0.3, z * 0.3) < 0.32 && rh() < 0.7) continue;
      if (Math.abs(z + 5) < 0.6) continue;
      sitios.push([x, z]);
    }
    for (let n = 0; n < 3000 && sitios.length < 6400; n++) {
      const x = (rh() - 0.5) * 110, z = 0.85 + rh() * 22;
      if (Math.abs(x) < 4.5 || Math.abs(z - 8) < 2.2) continue;
      if (z > 2.2 && rh() < 0.75) continue;
      if (x > -27 && x < -10 && z < 7) continue;
      sitios.push([x, z]);
    }
    const im = new THREE.InstancedMesh(g, mat, sitios.length);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), c2 = new THREE.Color();
    sitios.forEach(([x, z], i) => {
      q.setFromAxisAngle(V(0, 1, 0), rh() * 6.28);
      const s = 0.6 + rh() * 0.9;
      mm.compose(V(x, suelo(x, z) - 0.02, z), q, V(s, s * (0.7 + rh() * 0.6), s));
      im.setMatrixAt(i, mm);
      im.setColorAt(i, c2.setRGB(0.75 + rh() * 0.35, 0.75 + rh() * 0.3, 0.65 + rh() * 0.25));
    });
    im.receiveShadow = true;
    im.name = 'hierba';
    return im;
  }

  // ================================================================== EL FUEGO del bidon: llamas, brasas y humo
  const fuego = crearFuego(hoguera.clone().setY(0.88));
  scene.add(fuego.grupo);
  function crearFuego(p) {
    const grupo = new THREE.Group();
    const uf = { uT: U.uT, uRuido: U.uRuido };
    const mat = new THREE.ShaderMaterial({
      uniforms: uf, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'varying vec2 vUv; uniform float uT; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy; gl_Position = projectionMatrix * mv; }',
      fragmentShader: /* glsl */`
        varying vec2 vUv; uniform float uT; uniform sampler2D uRuido;
        void main() {
          vec2 q = vUv;
          float n = texture2D(uRuido, vec2(q.x * 0.6 + 0.3, q.y * 0.5 - uT * 0.55)).r;
          float n2 = texture2D(uRuido, vec2(q.x * 1.3, q.y * 1.1 - uT * 1.2) + 0.4).r;
          float ancho = (1.0 - q.y) * 0.42 + 0.04;
          float x = abs(q.x - 0.5 + (n - 0.5) * 0.25 * q.y);
          float forma = smoothstep(ancho, ancho * 0.25, x) * smoothstep(1.0, 0.25, q.y + (n2 - 0.5) * 0.5) * smoothstep(0.0, 0.08, q.y);
          float k = forma * (0.45 + 0.8 * n2) * smoothstep(0.0, 0.5, forma);
          vec3 c = mix(vec3(0.75, 0.2, 0.04), vec3(1.0, 0.72, 0.4), smoothstep(0.45, 1.1, k));
          gl_FragColor = vec4(c * k * 1.25, 1.0);
        }`,
    });
    for (const [dx, dz, w, h] of [[0, 0, 0.5, 0.72], [0.06, 0.04, 0.36, 0.55], [-0.07, -0.03, 0.32, 0.48]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), mat);
      m.position.set(p.x + dx, p.y - 0.02, p.z + dz); m.frustumCulled = false; m.renderOrder = 6;
      grupo.add(m);
    }
    // brasas que suben
    const NB = 70, bp = new Float32Array(NB * 3), bv = [];
    for (let i = 0; i < NB; i++) { bv.push({ t: Math.random() * 3, v: V((Math.random() - 0.5) * 0.3, 0.7 + Math.random() * 0.8, (Math.random() - 0.5) * 0.3), p: V() }); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    const brasas = new THREE.Points(bg, new THREE.PointsMaterial({ color: '#ffb15c', size: 0.02, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    brasas.frustumCulled = false; grupo.add(brasas);
    // humo: volutas grandes y blandas que suben y se abren
    const cvh = document.createElement('canvas'); cvh.width = cvh.height = 128;
    const ch = cvh.getContext('2d'), gr = ch.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ch.fillStyle = gr; ch.fillRect(0, 0, 128, 128);
    const th = new THREE.CanvasTexture(cvh);
    const humos = [];
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: th, color: '#4a4f55', transparent: true, opacity: 0, depthWrite: false }));
      s.userData = { t: i / 12 * 6, giro: Math.random() * 6 };
      humos.push(s); grupo.add(s);
    }
    const luz = new THREE.PointLight('#ff9d55', 9, 11, 2);
    luz.position.set(p.x, p.y + 0.45, p.z);
    grupo.add(luz);
    function actualizar(t, dt) {
      for (let i = 0; i < NB; i++) {
        const b = bv[i]; b.t += dt;
        if (b.t > 1.6 + (i % 5) * 0.3) { b.t = 0; b.p.set(p.x + (Math.random() - 0.5) * 0.3, p.y + 0.1, p.z + (Math.random() - 0.5) * 0.3); b.v.set((Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.9, (Math.random() - 0.5) * 0.3); }
        b.v.x += Math.sin(t * 3 + i) * dt * 0.6; b.p.addScaledVector(b.v, dt);
        bp[i * 3] = b.p.x; bp[i * 3 + 1] = b.p.y; bp[i * 3 + 2] = b.p.z;
      }
      bg.attributes.position.needsUpdate = true;
      for (const s of humos) {
        s.userData.t += dt; const k = (s.userData.t % 6) / 6;
        s.position.set(p.x + Math.sin(k * 3 + s.userData.giro) * 0.3 + k * 1.2, p.y + 0.6 + k * 4.2, p.z + k * 0.9);
        const e = 0.4 + k * 2.6; s.scale.set(e, e, 1);
        s.material.opacity = 0.22 * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (1 - k * 0.5);
        s.material.rotation = s.userData.giro + k;
      }
      luz.intensity = 9 * (0.78 + 0.22 * Math.sin(t * 17.3) * Math.sin(t * 6.1 + 1) + 0.08 * Math.sin(t * 41));
      luz.position.x = p.x + Math.sin(t * 9.1) * 0.04;
    }
    return { grupo, actualizar, luz };
  }

  // ================================================================== CIELO Y LUCES
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uArriba: { value: col('#2c3540') }, uHorizonte: { value: col('#6c7884') }, uCiudad: { value: col('#9a8e7d') }, uFrio: { value: col('#6c7884') } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uArriba, uHorizonte, uCiudad, uFrio; varying vec3 vD;
      void main(){
        float h = clamp(vD.y, 0.0, 1.0);
        // el horizonte: calido hacia la ciudad (+z, detras del muro grande), frio hacia fuera
        vec3 hz = mix(uFrio, uHorizonte, smoothstep(-0.8, 0.2, vD.z));
        // (el horizonte es el color de la bruma: si no, la linea donde acaba el suelo de lejos se veia; el resplandor de
        // la ciudad va justo encima del horizonte)
        hz = mix(hz, uCiudad, smoothstep(0.35, 0.95, vD.z) * smoothstep(0.0, 0.035, h) * (1.0 - smoothstep(0.03, 0.25, h)));
        vec3 c = mix(hz, uArriba, pow(h, 0.55));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  cielo.renderOrder = -10; cielo.frustumCulled = false; cielo.name = 'cielo';
  scene.add(cielo);
  // las luces del muro grande: puntos que atraviesan la bruma
  {
    const g = new THREE.BufferGeometry().setFromPoints(M4.lucesLejos);
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffd9a8', size: 3, sizeAttenuation: false, transparent: true, opacity: 0.75, fog: false, depthWrite: false }));
    p.name = 'lucesLejos';
    scene.add(p);
  }
  const hemi = new THREE.HemisphereLight('#94a2b0', '#2b2d2f', 1.3);
  const luna = new THREE.DirectionalLight('#c9d3de', 1.15);
  luna.position.set(-22, 40, 30); luna.target.position.set(0, 0, 0);
  luna.castShadow = true;
  luna.shadow.mapSize.set(2048, 2048);
  Object.assign(luna.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 140 });
  luna.shadow.bias = -0.0004; luna.shadow.normalBias = 0.03;
  // dentro de la caseta, el aplique de su puerta y la vela de la chabola
  const luzCaseta = new THREE.PointLight('#ffd6a6', 3, 5, 2); luzCaseta.position.set(4.8, 1.6, 3.0);
  const aplique = new THREE.PointLight('#ffd2a0', 2.4, 6, 2); aplique.position.set(3.45, 2.3, 3.4);
  const vela = new THREE.PointLight('#ffb070', 0.9, 3, 2); vela.position.set(-22.2, 0.5, 1.6);
  scene.add(hemi, luna, luna.target, luzCaseta, aplique, vela);
  // los FOCOS del mastil: miran fuera, por encima del muro, al foso y al campo
  const focos = M4.cabezas.map((c, k) => {
    const s = new THREE.SpotLight('#e4ebf2', 46, 60, 0.42, 0.55, 1.4);
    s.position.copy(c.p);
    s.target.position.copy(c.p.clone().addScaledVector(c.dir, 20));
    s.castShadow = k === 0;
    if (s.castShadow) { s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0006; s.shadow.camera.near = 0.5; s.shadow.camera.far = 60; }
    scene.add(s, s.target);
    return s;
  });
  // (la bruma de lejos la hace niebla4.js hasta 1,5 km; esta solo queda por si se apaga la neblina con la N)
  scene.fog = new THREE.FogExp2(col('#6c7884'), 0.0009);

  // ================================================================== lo que se pisa y por donde se va
  // ALTURA: el suelo, lo que se pisa (con ytop) y las tablas por encima del foso (solo si se viene por arriba)
  const solidos = choques.cajas.filter((b) => b.ytop != null);
  const estado = { y: 0, x: 0, z: 0, suelo: true };
  function altura(x, z) {
    let h = suelo(x, z);
    for (const b of solidos) if (Math.abs(x - b.x) <= b.hx && Math.abs(z - b.z) <= b.hz && b.ytop > h) h = b.ytop;
    for (const t of TABLAS) if (x >= t.x0 && x <= t.x1 && z >= Math.min(t.z0, t.z1) && z <= Math.max(t.z0, t.z1)) { const ht = t.h(z); if (ht > h && estado.y >= ht - 0.25) h = ht; }
    return h;
  }
  // LIMITAR: no se sube por una cuesta de mas de 42 grados (los taludes del foso: si se cae dentro, se sale por el
  // terraplen de la carretera, o por las tablas no) y no se sale del trozo hecho
  const B = M4.BORDE;
  function limitar(p) {
    p.x = Math.max(B.x0, Math.min(B.x1, p.x)); p.z = Math.max(B.z0, Math.min(B.z1, p.z));
    if (!estado.suelo) return;
    const ok = (x, z) => {
      const d = Math.hypot(x - estado.x, z - estado.z);
      if (d < 1e-5) return true;
      const dy = suelo(x, z) - suelo(estado.x, estado.z);
      return !(dy > 0.004 && dy / d > 0.9 && altura(x, z) - suelo(x, z) < 0.01);
    };
    if (ok(p.x, p.z)) return;
    if (ok(p.x, estado.z)) { p.z = estado.z; return; }
    if (ok(estado.x, p.z)) { p.x = estado.x; return; }
    p.x = estado.x; p.z = estado.z;
  }

  // ================================================================== por fotograma
  const _v = new THREE.Vector3();
  function actualizar(t, dt, heroe, cam) {
    U.uT.value = t;
    const hp = heroe.pos;
    // la sombra de la luna sigue al 18
    luna.target.position.set(hp.x, 0, hp.z);
    luna.position.set(hp.x - 22, 40, hp.z + 30);
    fuego.actualizar(t, dt);
    ropa.forEach((m, i) => { m.rotation.x = Math.sin(t * 1.3 + i * 1.7) * 0.12 + Math.sin(t * 2.9 + i) * 0.05; });
    vela.intensity = 0.9 * (0.85 + 0.15 * Math.sin(t * 11 + 2) * Math.sin(t * 4.3));
    // los reflejos del agua: la hoguera, la caseta y los dos focos
    const LP = aguaU.uLP.value, LC = aguaU.uLC.value;
    LP[0].copy(fuego.luz.position); LC[0].set(1.0, 0.55, 0.25).multiplyScalar(fuego.luz.intensity / 9);
    LP[1].copy(aplique.position); LC[1].set(1.0, 0.8, 0.6);
    LP[2].copy(focos[0].position); LC[2].set(2.2, 2.3, 2.4);
    LP[3].copy(focos[1].position); LC[3].set(2.2, 2.3, 2.4);
    void cam; void _v;
  }

  return {
    altura, choques, limitar, borde: 1e4, estado, suelo,
    salida: { x: -8.2, z: 5.4, giro: Math.PI },
    actualizar, M, mallas, luces: { hemi, luna, fuego: fuego.luz, luzCaseta, aplique, vela, focos },
    // lo que alumbra la neblina (niebla4.js): luces de punto y los dos focos
    lucesNiebla: [
      { p: fuego.luz.position, color: col('#ff9d55'), i: 0.5, tiembla: true },
      { p: aplique.position, color: col('#ffd2a0'), i: 0.12 },
      { p: luzCaseta.position, color: col('#ffd6a6'), i: 0.08 },
      { p: vela.position, color: col('#ffb070'), i: 0.03 },
    ],
    focosNiebla: focos.map((s) => ({ p: s.position, dir: s.target.position.clone().sub(s.position).normalize(), cos0: Math.cos(0.42), cos1: Math.cos(0.42 * (1 - 0.55)), color: col('#e4ebf2'), i: 1.7 })),
    TABLAS, ESCALON,
  };
}

function interp(perfil, z) {
  if (z <= perfil[0][0]) return perfil[0][1];
  for (let i = 1; i < perfil.length; i++) if (z <= perfil[i][0]) { const [z0, y0] = perfil[i - 1], [z1, y1] = perfil[i]; return y0 + (y1 - y0) * (z - z0) / (z1 - z0); }
  return perfil[perfil.length - 1][1];
}
function mergeG(gs) {
  // une geometrias con position/normal/uv (sin color)
  let n = 0; for (const g of gs) n += (g.index ? g.index.count : g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (let g of gs) {
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += c;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return m;
}

// la ropa tendida: cuatro prendas en una tira (camisa, toalla, pantalon, trapo), con su tela y sus pinzas
function texturaRopa() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
  const c = cv.getContext('2d'); c.clearRect(0, 0, 1024, 256);
  const r = azar(33);
  const tela = (x0) => { for (let n = 0; n < 900; n++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.08})`; c.fillRect(x0 + r() * 256, r() * 256, 2, 1); } };
  c.fillStyle = '#d8d6cf';
  // camisa: hombros, mangas y faldon
  c.beginPath(); c.moveTo(60, 8); c.lineTo(196, 8); c.lineTo(250, 70); c.lineTo(222, 92); c.lineTo(196, 72); c.lineTo(196, 250); c.lineTo(60, 250); c.lineTo(60, 72); c.lineTo(34, 92); c.lineTo(6, 70); c.closePath(); c.fill();
  c.fillStyle = '#bdbab2'; c.fillRect(124, 8, 8, 242); tela(0);
  // toalla con dos rayas
  c.fillStyle = '#d6d2c8'; c.fillRect(256 + 16, 6, 224, 244); c.fillStyle = '#9da6ae'; c.fillRect(256 + 16, 200, 224, 14); c.fillRect(256 + 16, 222, 224, 6); tela(256);
  // pantalon
  c.fillStyle = '#d4d1ca'; c.beginPath(); c.moveTo(512 + 40, 6); c.lineTo(512 + 216, 6); c.lineTo(512 + 230, 250); c.lineTo(512 + 142, 250); c.lineTo(512 + 128, 90); c.lineTo(512 + 114, 250); c.lineTo(512 + 26, 250); c.closePath(); c.fill(); tela(512);
  // trapo con el borde roto
  c.fillStyle = '#cfccc4'; c.beginPath(); c.moveTo(768 + 20, 6); c.lineTo(768 + 236, 6);
  for (let k = 0; k <= 10; k++) c.lineTo(768 + 236 - k * 21.6, 200 + r() * 50);
  c.closePath(); c.fill(); tela(768);
  // pinzas
  c.fillStyle = '#5b5148'; for (const x of [70, 186, 290, 470, 560, 710, 800, 1000]) c.fillRect(x - 6, 0, 12, 22);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// la malla soldada del porton (alfa)
function texturaMalla() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, 64, 64); c.fillStyle = '#fff';
  c.fillRect(0, 0, 64, 5); c.fillRect(0, 0, 5, 64);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// los agujeros del bidon de la hoguera: puntos que brillan (el mapa de emision; en la fila 3 de la textura del bidon)
function texturaAgujerosFuego() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
  const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
  const r = azar(9);
  for (let k = 0; k < 70; k++) {
    const x = r() * 512, y = 384 + 16 + r() * 100;
    const g = c.createRadialGradient(x, y, 0, x, y, 6);
    g.addColorStop(0, 'rgba(255,190,110,1)'); g.addColorStop(0.5, 'rgba(255,120,40,.8)'); g.addColorStop(1, 'rgba(120,40,10,0)');
    c.fillStyle = g; c.fillRect(x - 6, y - 6, 12, 12);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// una alfombra vieja: cenefa y rombos desteñidos
function texturaAlfombra() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#6c4a43'; c.fillRect(0, 0, 256, 256);
  c.fillStyle = '#3e4652'; c.fillRect(0, 0, 256, 26); c.fillRect(0, 230, 256, 26);
  c.strokeStyle = '#a99a7c'; c.lineWidth = 6;
  for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(32 + k * 64, 60); c.lineTo(64 + k * 64, 128); c.lineTo(32 + k * 64, 196); c.lineTo(k * 64, 128); c.closePath(); c.stroke(); }
  const r = azar(12);
  for (let n = 0; n < 2400; n++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.12})`; c.fillRect(r() * 256, r() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// la tira de senales del puesto (ocho casillas, como la de mundo3d.js y sin palabras): 0 el codigo X-3, 3 peligro, 4
// el rayo del cuadro, 5 la mano de alto, 6 franjas, 7 camara
function texturaSenales4() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128;
  const c = cv.getContext('2d');
  const placa = (i, fondo) => { c.fillStyle = fondo; c.fillRect(i * 128 + 4, 4, 120, 120); c.strokeStyle = '#1b1d20'; c.lineWidth = 5; c.strokeRect(i * 128 + 9, 9, 110, 110); };
  const texto = (i, t, tam, y = 64) => { c.fillStyle = '#16181b'; c.font = `bold ${tam}px Bahnschrift, Arial Narrow, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, i * 128 + 64, y); };
  const triangulo = (i) => { c.fillStyle = '#cdb766'; c.beginPath(); c.moveTo(i * 128 + 64, 16); c.lineTo(i * 128 + 116, 108); c.lineTo(i * 128 + 12, 108); c.closePath(); c.fill(); c.lineWidth = 7; c.strokeStyle = '#16181b'; c.stroke(); };
  for (const i of [0, 1, 2]) { placa(i, '#c3c6c2'); texto(i, 'X-3', 50); }
  c.fillStyle = '#c3c6c2'; c.fillRect(3 * 128, 0, 128, 128); triangulo(3); texto(3, '!', 58, 76);
  c.fillStyle = '#c3c6c2'; c.fillRect(4 * 128, 0, 128, 128); triangulo(4);
  c.fillStyle = '#16181b'; c.beginPath(); c.moveTo(4 * 128 + 70, 40); c.lineTo(4 * 128 + 52, 74); c.lineTo(4 * 128 + 64, 74); c.lineTo(4 * 128 + 56, 100); c.lineTo(4 * 128 + 78, 64); c.lineTo(4 * 128 + 66, 64); c.closePath(); c.fill();
  // la mano de alto en un circulo
  c.fillStyle = '#c3c6c2'; c.fillRect(5 * 128, 0, 128, 128);
  c.fillStyle = '#7d3a33'; c.beginPath(); c.arc(5 * 128 + 64, 64, 56, 0, 7); c.fill();
  c.fillStyle = '#e8e4da';
  c.beginPath(); c.ellipse(5 * 128 + 64, 76, 22, 24, 0, 0, 7); c.fill();
  for (const [dx, h] of [[-16, 34], [-5, 42], [6, 42], [17, 34]]) c.fillRect(5 * 128 + 64 + dx - 4, 70 - h, 9, h);
  c.save(); c.translate(5 * 128 + 40, 70); c.rotate(-0.6); c.fillRect(-4, -26, 9, 28); c.restore();
  c.save(); c.beginPath(); c.rect(6 * 128, 0, 128, 128); c.clip(); c.fillStyle = '#cdb766'; c.fillRect(6 * 128, 0, 128, 128); c.fillStyle = '#16181b';
  for (let k = -2; k < 6; k++) { c.beginPath(); c.moveTo(6 * 128 + k * 40, 128); c.lineTo(6 * 128 + k * 40 + 20, 128); c.lineTo(6 * 128 + k * 40 + 148, 0); c.lineTo(6 * 128 + k * 40 + 128, 0); c.closePath(); c.fill(); }
  c.restore();
  placa(7, '#c3c6c2');
  c.fillStyle = '#16181b'; c.fillRect(7 * 128 + 30, 50, 56, 30); c.fillRect(7 * 128 + 86, 56, 14, 18); c.fillRect(7 * 128 + 50, 80, 8, 24); c.fillRect(7 * 128 + 38, 100, 32, 6);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
