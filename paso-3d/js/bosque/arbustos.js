// LOS ARBUSTOS del bosque 3D (2026-10-23, pedido «agrega los arbustos actualizados con mas hojas»): el laurel y el boj de
// escuela/obras/arbusto (copiados en web/modelo/), todo hojas dibujadas, en vez de las matas de bolas (geoMata). Cada
// especie trae tres LOD (LOD0..2 en el .glb) con cinco mallas (Hojas, Masa, Ramas, Suelo, Tinta) y los atributos de viento
// (_flex, _aleteo, _fase). Aqui van INSTANCIADOS: una InstancedMesh por especie, LOD y malla, y cada arbusto se reparte al
// LOD que le toca por su distancia a la camara (se rehace al moverse la camara un metro). El viento es el del visor de la
// obra (web/index.html), con la fase y la direccion sacadas de la instancia para que no gire con ella.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ESPECIES = { laurel: 'modelo/arbusto.glb', boj: 'modelo/arbusto_boj.glb' };
const DIST = [12, 28];                 // de LOD0 a LOD1 y de LOD1 a LOD2 (en el visor de la obra, 11 y 26 a escala 1)

const RUIDO = `
  float ah3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float aruido(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(ah3(i), ah3(i + vec3(1, 0, 0)), f.x), mix(ah3(i + vec3(0, 1, 0)), ah3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(ah3(i + vec3(0, 0, 1)), ah3(i + vec3(1, 0, 1)), f.x), mix(ah3(i + vec3(0, 1, 1)), ah3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }`;
// el desplazamiento de la obra, en el marco del arbusto: la direccion del viento se pasa al marco de la instancia
// (giro y escala uniforme) para que todos se inclinen hacia el mismo lado, y la fase lleva el sitio de la instancia
const VIENTO_GLSL = `
  attribute float _flex; attribute float _aleteo; attribute float _fase;
  uniform float uT; uniform float uViento; uniform vec2 uDir;
  vec3 viento(vec3 p, vec3 n) {
    vec2 w = vec2(0.0); vec3 d = vec3(uDir.x, 0.0, uDir.y);
    #ifdef USE_INSTANCING
      w = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      d = transpose(mat3(instanceMatrix)) * d; d /= max(dot(d, d), 1e-6);
    #endif
    float ola = sin(uT * 1.6 + _fase * 6.283 + (p.x + w.x) * 0.5) * 0.65 + sin(uT * 2.7 + _fase * 11.0 + w.y * 0.3) * 0.35;
    float racha = 0.5 + 0.5 * sin(uT * 0.37 + (w.x * 0.82 + w.y * 0.57) * 0.08);
    float a = _flex * uViento * (0.018 + 0.03 * racha);
    vec3 o = d * (ola + 0.6 * racha) * a;
    o.y -= abs(ola) * a * 0.25;
    o += n * sin(uT * 10.0 + _fase * 40.0 + p.y * 17.0) * _aleteo * uViento * 0.007;
    return o;
  }`;

export function crearArbustos(grupo, sitios, gradiente, enCapa) {
  const U = { uT: { value: 0 }, uViento: { value: 1 }, uDir: { value: new THREE.Vector2(0.82, 0.57).normalize() } };
  function conViento(m, { moteado = false, unaCara = false, corteza = false, suave = false } = {}) {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = VIENTO_GLSL + '\nvarying vec3 vPosA;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n vPosA = position; transformed += viento(position, normal);');
      let f = 'varying vec3 vPosA;\n' + RUIDO + '\n' + sh.fragmentShader;
      // hojas de dos caras con la normal de la masa: por detras, la MISMA normal (al reves salian negras)
      if (unaCara) f = f.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal);');
      if (moteado) f = f.replace('#include <color_fragment>', `#include <color_fragment>
        float n = aruido(vPosA * 3.2), n2 = aruido(vPosA * 8.5 + 5.0);
        diffuseColor.rgb *= 0.76 + 0.38 * n + 0.22 * (n2 - 0.5);`);
      if (suave) f = f.replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 0.84 + 0.3 * aruido(vPosA * 2.6);`);
      if (corteza) f = f.replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 0.86 + 0.28 * aruido(vec3(vPosA.x * 40.0, vPosA.y * 9.0, vPosA.z * 40.0));`);
      sh.fragmentShader = f;
    };
    m.customProgramCacheKey = () => ['arbusto', moteado, unaCara, corteza, suave].join();
    return m;
  }
  const M = {
    Hojas: conViento(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradiente, side: THREE.DoubleSide, alphaTest: 0.5 }), { suave: true, unaCara: true }),
    Masa: conViento(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradiente }), { moteado: true }),
    Corteza: conViento(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradiente }), { corteza: true }),
    Suelo: conViento(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradiente, side: THREE.DoubleSide }), { unaCara: true }),
    Tinta: conViento(new THREE.MeshBasicMaterial({ color: '#0b0a0c' })),
  };

  // los sitios por especie, con su matriz ya hecha
  const porEspecie = { laurel: [], boj: [] };
  const q = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (const a of sitios) {
    const m = new THREE.Matrix4().compose(v.set(a.x, a.y, a.z), q.setFromAxisAngle(eje, a.giro), s.setScalar(a.escala));
    porEspecie[a.especie].push({ x: a.x, z: a.z, m });
  }
  const capas = [];            // { esp, k, mallas: [InstancedMesh] }
  let listo = false, ultimo = null;
  const info = { arbustos: sitios.length, laurel: porEspecie.laurel.length, boj: porEspecie.boj.length, tris: [] };

  const promesa = Promise.all(Object.entries(ESPECIES).map(async ([esp, url]) => {
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.updateMatrixWorld(true);
    const n = porEspecie[esp].length;
    for (let k = 0; k < 3; k++) {
      const raiz = gltf.scene.getObjectByName('LOD' + k);
      const mallas = [];
      let tris = 0;
      raiz.traverse((o) => {
        if (!o.isMesh) return;
        const nombre = o.material.name;
        // la hoja dibujada del .glb (textura.py), recortada por su alfa
        if (nombre === 'Hojas' && o.material.map && !M.Hojas.map) { M.Hojas.map = o.material.map; M.Hojas.needsUpdate = true; }
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);       // el arbusto con su pie en el origen
        tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
        const im = new THREE.InstancedMesh(g, M[nombre] || M.Masa, Math.max(1, n));
        im.count = 0; im.frustumCulled = false;
        im.castShadow = k < 2 && nombre !== 'Tinta' && nombre !== 'Suelo';
        im.receiveShadow = nombre !== 'Tinta';
        im.name = `arbusto_${esp}_LOD${k}_${nombre}`;
        grupo.add(enCapa(im));
        mallas.push(im);
      });
      info.tris.push({ esp, k, tris });
      capas.push({ esp, k, mallas });
    }
  })).then(() => { listo = true; ultimo = null; return true; },
    (e) => { console.error('los arbustos no se han podido cargar:', e); return false; });

  // reparte cada arbusto al LOD de su distancia (solo si la camara se ha movido un metro desde la ultima vez)
  function repartir(cam) {
    for (const [esp, lista] of Object.entries(porEspecie)) {
      const de = capas.filter((c) => c.esp === esp).sort((a, b) => a.k - b.k);
      const cuenta = [0, 0, 0];
      for (const a of lista) {
        const d = Math.hypot(a.x - cam.x, a.z - cam.z);
        const k = d < DIST[0] ? 0 : d < DIST[1] ? 1 : 2;
        for (const im of de[k].mallas) im.setMatrixAt(cuenta[k], a.m);
        cuenta[k]++;
      }
      for (const c of de) for (const im of c.mallas) { im.count = cuenta[c.k]; im.instanceMatrix.needsUpdate = true; }
    }
  }
  function actualizar(cam, t) {
    U.uT.value = t;
    if (!listo) return;
    if (ultimo && Math.hypot(cam.x - ultimo.x, cam.z - ultimo.z) < 1) return;
    ultimo = { x: cam.x, z: cam.z };
    repartir(cam);
  }
  return { actualizar, promesa, info, get listo() { return listo; } };
}
