// LA VIDA DEL BOSQUE (21-10, «mejora los detalles mucho mas, hazlo mas bonito, ambiente 0 tenebroso»): lo que hace
// que el bosque del mapa por defecto se vea vivo y alegre en vez de neblinoso y apagado.
//   - FLORES a rodales (margarita, boton de oro, clavelina y nomeolvides; cada rodal de una) y un CLARO soleado lleno
//   - SETAS rojas con lunares al pie de los arboles
//   - ARBUSTOS redondos con flores
//   - HIEDRA con flores colgando de las columnas y del arco
//   - MARIPOSAS que revolotean alrededor del 18
//   - VIENTO: la hierba, los helechos y las flores se mecen (un uniforme de tiempo compartido, `meceMaterial`)
// Todo instanciado y con la misma semilla que el resto del mapa: sale igual en cada carga.
import * as THREE from 'three';
import * as T from './texturas.js';

// el viento: un solo uniforme de tiempo para todos los materiales que se mecen
const uT = { value: 0 };
export function meceMaterial(mat, fuerza = 0.08) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ipos = instanceMatrix[3].xyz;
      #else
        vec3 ipos = vec3(0.0);
      #endif
      float vk = max(position.y, 0.0);
      float racha = 0.6 + 0.4 * sin(uT * 0.35 + ipos.x * 0.04);
      transformed.x += sin(uT * 1.7 + ipos.x * 0.45 + ipos.z * 0.3) * ${fuerza.toFixed(3)} * racha * vk;
      transformed.z += cos(uT * 1.3 + ipos.z * 0.5 + ipos.x * 0.2) * ${(fuerza * 0.6).toFixed(3)} * racha * vk;`);
  };
  mat.customProgramCacheKey = () => 'mece' + fuerza;
  return mat;
}

// dos planos cruzados (una mata vista de cualquier lado), con la base en y = 0, UV de u0 a u1
function cruz(ancho, alto, u0 = 0, u1 = 1) {
  const vs = [], uvs = [], idx = [];
  for (const a of [0, Math.PI / 2]) {
    const c = Math.cos(a) * ancho / 2, s = Math.sin(a) * ancho / 2, b = vs.length / 3;
    vs.push(-c, 0, -s, c, 0, s, c, alto, s, -c, alto, -s);
    uvs.push(u0, 0, u1, 0, u1, 1, u0, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  // normales hacia arriba: la mata se alumbra como el suelo y no sale negra por detras
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(vs.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}

export function crearVida({ grupo, r, altura, distCamino, ANCHO_CAMINO, LADO, claro, arboles, columnas, arco, choques }) {
  const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), eY = new THREE.Vector3(0, 1, 0);
  const fueraCamino = (x, z, margen) => distCamino(x, z).d > ANCHO_CAMINO / 2 + margen;
  const dentro = (x, z) => Math.abs(x) < LADO && Math.abs(z) < LADO;
  const info = {};

  // ---------------- flores ----------------
  {
    const tex = T.flores();
    const porTipo = [[], [], [], []];
    const poner = (k, x, z, s) => { if (dentro(x, z) && fueraCamino(x, z, 0.15)) porTipo[k].push([x, z, s]); };
    // rodales: cada uno de una flor
    for (let i = 0; i < 170; i++) {
      const cx = (r() * 2 - 1) * LADO, cz = (r() * 2 - 1) * LADO;
      if (!fueraCamino(cx, cz, 0.6)) continue;
      const k = Math.floor(r() * 4), n = 10 + Math.floor(r() * 30), rad = 0.7 + r() * 2;
      for (let j = 0; j < n; j++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad;
        poner(k, cx + Math.cos(a) * d, cz + Math.sin(a) * d, 0.75 + r() * 0.5);
      }
    }
    // a lo largo del camino, en la orilla
    for (let i = 0; i < 700; i++) {
      const x = (r() * 2 - 1) * LADO, z = (r() * 2 - 1) * LADO, d = distCamino(x, z).d;
      if (d > ANCHO_CAMINO / 2 + 0.2 && d < ANCHO_CAMINO / 2 + 1.6) poner(Math.floor(r() * 4), x, z, 0.7 + r() * 0.4);
    }
    // el claro: lleno
    // el claro: a manchas de un color, con el borde comido y cada vez menos flores hacia fuera (un disco lleno de
    // margaritas parecia un parterre)
    const borde = (a) => claro.r * (1 + 0.22 * Math.sin(a * 3 + 1) + 0.12 * Math.sin(a * 7 + 4));
    for (let m = 0; m < 46; m++) {
      const a0 = r() * Math.PI * 2, d0 = Math.sqrt(r()) * borde(a0), cx = claro.x + Math.cos(a0) * d0, cz = claro.z + Math.sin(a0) * d0;
      const k = Math.floor(r() * 4), n = 14 + Math.floor(r() * 22);
      for (let j = 0; j < n; j++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (0.6 + r() * 1.3), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        const ang = Math.atan2(z - claro.z, x - claro.x), f = Math.hypot(x - claro.x, z - claro.z) / borde(ang);
        if (r() < Math.pow(f, 3)) continue;
        poner(k, x, z, 0.8 + r() * 0.5);
      }
    }
    const ALTO = [0.42, 0.34, 0.36, 0.26];
    porTipo.forEach((lista, k) => {
      const mat = meceMaterial(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }), 0.12);
      const im = new THREE.InstancedMesh(cruz(ALTO[k] * 1.1, ALTO[k], k / 4 + 0.002, (k + 1) / 4 - 0.002), mat, lista.length);
      lista.forEach(([x, z, s], i) => {
        q.setFromAxisAngle(eY, r() * Math.PI);
        im.setMatrixAt(i, mt.compose(v3.set(x, altura(x, z) - 0.02, z), q, s3.set(s, s, s)));
      });
      im.receiveShadow = true;
      im.name = 'flores_' + k;
      grupo.add(im);
    });
    info.flores = porTipo.reduce((a, l) => a + l.length, 0);
  }

  // ---------------- setas ----------------
  {
    const sombrero = new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    sombrero.scale(1, 0.62, 1);
    const pie = new THREE.CylinderGeometry(0.32, 0.4, 1, 8, 1, true).translate(0, 0.5, 0);
    const lista = [];
    for (const a of arboles) {
      if (r() > 0.32) continue;
      const n = 2 + Math.floor(r() * 5), ang0 = r() * Math.PI * 2;
      for (let j = 0; j < n; j++) {
        const ang = ang0 + (r() - 0.5) * 1.4, d = a.rb * 1.4 + 0.15 + r() * 0.7;
        const x = a.x + Math.cos(ang) * d, z = a.z + Math.sin(ang) * d;
        if (fueraCamino(x, z, 0.3)) lista.push([x, z, 0.05 + r() * 0.07]);
      }
    }
    const imS = new THREE.InstancedMesh(sombrero, new THREE.MeshLambertMaterial({ map: T.seta() }), lista.length);
    const imP = new THREE.InstancedMesh(pie, new THREE.MeshLambertMaterial({ color: 0xf1e7cf }), lista.length);
    lista.forEach(([x, z, s], i) => {
      const y = altura(x, z), alto = s * (1.1 + r() * 0.8);
      q.setFromAxisAngle(eY, r() * 6.28);
      imP.setMatrixAt(i, mt.compose(v3.set(x, y - 0.01, z), q, s3.set(s * 0.6, alto, s * 0.6)));
      imS.setMatrixAt(i, mt.compose(v3.set(x, y + alto - s * 0.05, z), q, s3.set(s, s, s)));
    });
    imS.castShadow = imP.castShadow = true;
    imS.receiveShadow = imP.receiveShadow = true;
    grupo.add(imS, imP);
    info.setas = lista.length;
  }

  // ---------------- arbustos en flor ----------------
  {
    const bola = new THREE.IcosahedronGeometry(1, 2);
    const bp = bola.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const k = 1 + 0.14 * Math.sin(bp.getX(i) * 6.1) * Math.cos(bp.getY(i) * 5.3 + bp.getZ(i) * 4.7);
      bp.setXYZ(i, bp.getX(i) * k, Math.max(bp.getY(i) * k, -0.35), bp.getZ(i) * k);
    }
    bola.computeVertexNormals();
    const texH = T.hojas('#5f8a36');
    texH.repeat.set(1.5, 1.5);
    const bolas = [], floresB = [];
    let n = 0, intentos = 0;
    while (n < 80 && intentos++ < 3000) {
      const x = (r() * 2 - 1) * LADO, z = (r() * 2 - 1) * LADO;
      if (!fueraCamino(x, z, 1.4)) continue;
      if (Math.hypot(x - claro.x, z - claro.z) < claro.r - 1) continue;
      if (arboles.some((a) => Math.hypot(a.x - x, a.z - z) < a.rb + 1.2)) continue;
      const y = altura(x, z), tam = 0.45 + r() * 0.45, color = r() < 0.5 ? 2 : 0;
      for (let k = 0; k < 3 + Math.floor(r() * 3); k++) {
        const bx = x + (r() - 0.5) * tam * 1.6, bz = z + (r() - 0.5) * tam * 1.6, rad = tam * (0.6 + r() * 0.5);
        bolas.push([bx, y + rad * 0.55, bz, rad]);
        for (let f = 0; f < 6; f++) {
          const a = r() * Math.PI * 2, el = 0.2 + r() * 1.1;
          floresB.push([bx + Math.cos(a) * Math.cos(el) * rad * 0.95, y + rad * 0.55 + Math.sin(el) * rad * 0.62 * 0.95, bz + Math.sin(a) * Math.cos(el) * rad * 0.95, color]);
        }
      }
      choques.circulos.push({ x, z, r: tam * 1.1 });
      n++;
    }
    const im = new THREE.InstancedMesh(bola, new THREE.MeshLambertMaterial({ map: texH }), bolas.length);
    const col = new THREE.Color();
    bolas.forEach(([x, y, z, s], i) => {
      q.setFromAxisAngle(eY, r() * 6.28);
      im.setMatrixAt(i, mt.compose(v3.set(x, y, z), q, s3.set(s, s * 0.62, s)));
      im.setColorAt(i, col.setHSL(0.24 + r() * 0.05, 0.45 + r() * 0.15, 0.5 + r() * 0.1));
    });
    im.castShadow = im.receiveShadow = true;
    grupo.add(im);
    // sus flores: pequenas cruces del atlas (margarita o clavelina), sin viento
    const tex = T.flores();
    for (const k of [0, 2]) {
      const lista = floresB.filter((f) => f[3] === k);
      const m = new THREE.InstancedMesh(cruz(0.16, 0.14, k / 4 + 0.002, (k + 1) / 4 - 0.002), new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }), lista.length);
      lista.forEach(([x, y, z], i) => { q.setFromAxisAngle(eY, r() * 6.28); m.setMatrixAt(i, mt.compose(v3.set(x, y - 0.06, z), q, s3.set(1, 1, 1))); });
      grupo.add(m);
    }
    info.arbustos = n;
  }

  // ---------------- hiedra en las columnas y en el arco ----------------
  {
    const tex = T.hiedra();
    const tiras = [];        // [x, y (arriba), z, ancho, largo, giro]
    for (const c of columnas) {
      if (c.yTop - c.y0 < 2) continue;
      const caras = [0, 1, 2, 3].sort(() => r() - 0.5).slice(0, 1 + Math.floor(r() * 2));
      for (const f of caras) {
        const a = c.giro + f * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a), d = c.lado / 2 + 0.025;
        const tx = Math.cos(a), tz = -Math.sin(a), off = (r() - 0.5) * c.lado * 0.4;
        tiras.push([c.x + nx * d + tx * off, c.yTop + 0.05, c.z + nz * d + tz * off, 0.35 + r() * 0.25, Math.min(c.yTop - c.y0 - 0.3, 1.2 + r() * 1.6), a]);
      }
    }
    if (arco) {
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (0.12 + r() * 0.76), rx = Math.cos(a) * arco.vano, ry = Math.sin(a) * arco.vano;
        tiras.push([arco.x + arco.nx * rx, arco.hb + ry - 0.2, arco.z + arco.nz * rx, 0.35 + r() * 0.2, 0.7 + r() * 1.1, arco.giro + Math.PI / 2]);
      }
    }
    const g = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
    const im = new THREE.InstancedMesh(g, meceMaterial(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide }), -0.02), tiras.length);
    tiras.forEach(([x, y, z, w, l, a], i) => {
      q.setFromAxisAngle(eY, a);
      im.setMatrixAt(i, mt.compose(v3.set(x, y, z), q, s3.set(w, l, 1)));
    });
    im.castShadow = true;
    grupo.add(im);
    info.hiedra = tiras.length;
  }

  // ---------------- mariposas ----------------
  const MAR = 28;
  const mar = [];
  const alas = [];
  {
    const tex = T.mariposa();
    for (let k = 0; k < 4; k++) {
      // un ala: plano tumbado que sale hacia +x desde el cuerpo (el ala izquierda es la misma en espejo)
      const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / 4);
      const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
      const n = Math.ceil(MAR / 4);
      const izq = new THREE.InstancedMesh(g, mat, n), der = new THREE.InstancedMesh(g, mat, n);
      izq.frustumCulled = der.frustumCulled = false;
      grupo.add(izq, der);
      alas.push({ izq, der });
    }
    for (let i = 0; i < MAR; i++) mar.push({ x: 0, y: 1, z: 0, rumbo: r() * 6.28, fase: r() * 6.28, vel: 0.6 + r() * 0.6, alto: 0.5 + r() * 1.4, tam: 0.05 + r() * 0.03, listo: false, giro: (r() - 0.5) * 2 });
  }
  const mIzq = new THREE.Matrix4(), rot = new THREE.Matrix4(), aleteo = new THREE.Matrix4(), esp = new THREE.Matrix4().makeScale(-1, 1, 1);
  function actualizar(t, dt, foco) {
    uT.value = t;
    // las mariposas viven a menos de 16 m del 18: la que se aleja vuelve a nacer delante de el
    mar.forEach((m, i) => {
      if (!m.listo || Math.hypot(m.x - foco.x, m.z - foco.z) > 16) {
        const a = r() * 6.28, d = 3 + r() * 11;
        m.x = foco.x + Math.cos(a) * d; m.z = foco.z + Math.sin(a) * d; m.listo = true;
        m.y = altura(m.x, m.z) + m.alto;
      }
      m.giro += (r() - 0.5) * 4 * dt;
      m.giro *= 0.98;
      m.rumbo += m.giro * dt;
      m.x += Math.sin(m.rumbo) * m.vel * dt;
      m.z += Math.cos(m.rumbo) * m.vel * dt;
      const suelo = altura(m.x, m.z) + m.alto;
      m.y += (suelo + 0.25 * Math.sin(t * 2.3 + m.fase) - m.y) * Math.min(1, 2 * dt);
      const ang = 0.15 + 0.95 * (0.5 + 0.5 * Math.sin(t * 16 + m.fase));
      const k = i % 4, j = (i - k) / 4, A = alas[k];
      rot.compose(v3.set(m.x, m.y, m.z), q.setFromAxisAngle(eY, m.rumbo), s3.set(m.tam, m.tam, m.tam));
      aleteo.makeRotationZ(ang);
      A.der.setMatrixAt(j, mt.multiplyMatrices(rot, aleteo));
      aleteo.makeRotationZ(-ang);
      A.izq.setMatrixAt(j, mIzq.multiplyMatrices(rot, aleteo).multiply(esp));
    });
    for (const A of alas) { A.izq.instanceMatrix.needsUpdate = true; A.der.instanceMatrix.needsUpdate = true; }
  }
  info.mariposas = MAR;
  return { actualizar, info };
}
