// COPIA de boundland-bosque3d/web/js/heroe.js con tres cambios para la prueba del paso de 2D a 3D: el 18 tiene brillo
// propio (H.brillo: en el conducto oscuro es lo unico que se ve, como en el 2D), la luz ambiente de fuera (hemisferio) se
// multiplica por H.exterior (dentro del conducto no le llega) y H.reiniciar() para __dbg.ir().
//
// El 18: el .glb de escuela/obras/sujeto18_3d (piel, rig de juego, 36 clips) con el acabado de tinta del visor
// (MeshToonMaterial con el color horneado en dos escalones y el casco de tinta que trae el .glb) y su CONTROL en
// tercera persona: andar / correr relativos a la camara, salto, gestos, gravedad y choques en planta.
//
// Velocidades: los ciclos se midieron en Blender (lo que retrocede el pie apoyado): andar ~0,27 m/s y correr
// ~1,37 m/s a velocidad 1. En el juego se aceleran y el personaje avanza justo lo que pide su clip, asi no patina.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { crearTela } from './tela.js';

// los ciclos del rig de juego (2026-10-23, escuela/obras/sujeto18_3d/salida/clips.json) ya van a la velocidad del juego:
// andar 0,45 m/s (zancada 0,27 m en 0,6 s) y correr 1,8 m/s (0,63 m en 0,35 s); antes iban a 0,27 y 1,37 y se aceleraban
const ANDAR = { v: 0.45, escala: 0.45 / 0.45 };
const CORRER = { v: 1.8, escala: 1.8 / 1.8 };
const RADIO = 0.24;            // planta del 18 para los choques (la capa abierta mide ~0,5 m)
const GRAVEDAD = 9.8;
const SALTO_V = 3.3;           // m/s hacia arriba: ~0,55 m de salto
const ESCALON = 0.3;           // lo que se sube andando (cajas con ytop)
const GESTOS = { 1: 'saludar', 2: 'mirar_arriba', 3: 'respingo', 4: 'bajar' };
const PIERNAS = [['thigh_l', 'calf_l', 'foot_l', 'ball_l'], ['thigh_r', 'calf_r', 'foot_r', 'ball_r']];

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
const ARRIBA = new THREE.Vector3(0, 1, 0);
const tocados = [];
let guardadas = null;

// gira un hueso en el MUNDO (q delante de su giro de mundo) y pone al dia su rama
function girarMundo(b, q) {
  b.getWorldQuaternion(q2);
  q2.premultiply(q);
  b.parent.getWorldQuaternion(q1);
  b.quaternion.copy(q1.invert().multiply(q2));
  b.updateMatrixWorld(true);
}

// IK de dos huesos: muslo (a) - pantorrilla (b) - tobillo (c) al objetivo T, doblando la rodilla en su propio plano
function ik2(muslo, pierna, pie, T) {
  const a = v1.setFromMatrixPosition(muslo.matrixWorld).clone();
  const b = v2.setFromMatrixPosition(pierna.matrixWorld).clone();
  const c = v3.setFromMatrixPosition(pie.matrixWorld).clone();
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
  const d = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, a.distanceTo(T)));
  const ba = a.clone().sub(b), bc = c.clone().sub(b);
  const actual = ba.angleTo(bc);
  const quiere = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2))));
  const eje = ba.clone().cross(bc);
  if (eje.lengthSq() < 1e-12) eje.set(1, 0, 0).applyQuaternion(muslo.getWorldQuaternion(q1));
  eje.normalize();
  girarMundo(pierna, new THREE.Quaternion().setFromAxisAngle(eje, quiere - actual));
  const c2 = v4.setFromMatrixPosition(pie.matrixWorld);
  girarMundo(muslo, new THREE.Quaternion().setFromUnitVectors(c2.sub(a).normalize(), T.clone().sub(a).normalize()));
}

export function cargarHeroe(scene, mundo) {
  const H = {
    listo: false, raiz: null, mixer: null, clips: {}, acciones: {}, estado: 'reposo', gesto: null,
    pos: new THREE.Vector3(mundo.salida.x, 0, mundo.salida.z), vy: 0, suelo: true, giro: mundo.salida.giro,
    vel: new THREE.Vector2(), saltando: 0, tinta: [],
    brillo: { value: 0 }, exterior: { value: 1 }, materiales: [],
  };
  H.pos.y = mundo.altura(H.pos.x, H.pos.z);

  const escalones = new THREE.DataTexture(new Uint8Array([176, 176, 176, 255, 255, 255, 255, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  escalones.minFilter = escalones.magFilter = THREE.NearestFilter;
  escalones.needsUpdate = true;

  const promesa = new Promise((ok, mal) => new GLTFLoader().load('modelo/sujeto18_3d.glb', (gltf) => {
    const raiz = gltf.scene;
    raiz.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      o.castShadow = true;
      // recibe las sombras de los arboles y las ruinas (sin ellas, a la sombra de un tronco el 18 seguia
      // iluminado como pegado encima del fondo). El casco de tinta no: es la linea. Y la MASCARA tampoco: la capucha
      // le daba sombra y la cara salia gris; en el video la mascara es blanca siempre
      o.receiveShadow = !/^(cara|ojo|boca)/.test(o.name);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const nuevos = mats.map((m) => {
        if (/tinta/i.test(m.name)) {
          const t = new THREE.MeshBasicMaterial({ color: 0x1e1814, side: THREE.FrontSide });
          H.tinta.push(t);
          return t;
        }
        // por las DOS caras, como en el .glb (doubleSided): por una sola, donde la tela tiene la cara de dentro
        // asomando (pliegues muy cerrados) se veia a traves del 18 el casco de tinta, en manchas negras
        const t = new THREE.MeshToonMaterial({ map: m.map, gradientMap: escalones, side: m.side, emissive: 0xffffff, emissiveMap: m.map, emissiveIntensity: 1 });
        t.onBeforeCompile = (sh) => {
          sh.uniforms.uBrillo = H.brillo; sh.uniforms.uExterior = H.exterior;
          sh.fragmentShader = 'uniform float uBrillo;\nuniform float uExterior;\n' + sh.fragmentShader
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= uBrillo;')
            .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse *= uExterior;');
        };
        H.materiales.push(t);
        return t;
      });
      o.material = Array.isArray(o.material) ? nuevos : nuevos[0];
      if (/tinta/i.test(mats[0].name)) { o.castShadow = false; o.receiveShadow = false; }
    });
    H.raiz = raiz;
    scene.add(raiz);
    H.mixer = new THREE.AnimationMixer(raiz);
    for (const c of gltf.animations) {
      H.clips[c.name] = c;
      const a = H.mixer.clipAction(c);
      const bucle = ['reposo', 'andar', 'correr'].includes(c.name);
      a.setLoop(bucle ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = !bucle;
      H.acciones[c.name] = a;
    }
    H.acciones.andar.timeScale = ANDAR.escala;
    H.acciones.correr.timeScale = CORRER.escala;
    H.acciones.reposo.play();
    H.mixer.addEventListener('finished', (e) => {
      if (e.action === H.acciones.salto) H.saltando = 0;
      if (H.gesto && e.action === H.acciones[H.gesto]) { H.gesto = null; poner(locomocion()); }
    });
    // fisica de la capa y de la capucha (tela.js); P la enciende y la apaga para comparar con el clip
    H.tela = crearTela(raiz, mundo.altura, mundo.choques);
    H.fisica = !/[?&]sinfisica/.test(location.search);
    // piernas para los pies en la cuesta
    const huesos = {};
    raiz.traverse((o) => { if (o.isBone) huesos[o.name] = o; });
    H.piernas = PIERNAS.map((ns) => ns.map((n) => huesos[n])).filter((p) => p.every(Boolean));
    // los huesos que se tocan DESPUES del mezclador (tela e IK): el mezclador de three solo escribe un hueso si el
    // valor del clip cambia; sin restaurarlos, en un clip quieto se quedaba la pose de la fisica del fotograma
    // anterior y la tela tomaba su propia pose por la del clip (el muelle que le devuelve la forma no tiraba)
    tocados.push(...H.tela.cadenas.flatMap((c) => c.bs), ...H.piernas.flatMap((p) => p.slice(0, 3)));
    // altura del tobillo sobre el suelo en reposo (de pie, pie plano)
    raiz.position.set(0, 0, 0); raiz.rotation.set(0, 0, 0);
    H.mixer.update(0);
    raiz.updateMatrixWorld(true);
    H.tobilloReposo = H.piernas.map((p) => v1.setFromMatrixPosition(p[2].matrixWorld).y);
    guardadas = tocados.map((b) => b.quaternion.clone());   // lo ultimo que escribio el mezclador
    H.listo = true;
    ok(H);
  }, undefined, mal));

  let actual = 'reposo';
  function poner(n, fundido = 0.22) {
    if (n === actual || !H.acciones[n]) return;
    const nueva = H.acciones[n], vieja = H.acciones[actual];
    nueva.reset();
    nueva.enabled = true;
    nueva.setEffectiveWeight(1);
    nueva.play();
    vieja.crossFadeTo(nueva, fundido, false);
    actual = n;
    H.estado = n;
  }
  function locomocion() {
    const v = H.vel.length();
    return v > (ANDAR.v + CORRER.v) / 2 ? 'correr' : v > 0.08 ? 'andar' : 'reposo';
  }

  // choques en planta: circulo del 18 contra circulos y cajas giradas. Varias pasadas: entre dos obstaculos juntos
  // (un tronco al lado de un muro) sacarlo de uno lo metia en el otro (15 mm medidos)
  function resolver(p) {
    for (let it = 0; it < 4; it++) resolver1(p);
  }
  function resolver1(p) {
    for (const c of mundo.choques.circulos) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + RADIO;
      if (d < m && d > 1e-6) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
    }
    for (const b of mundo.choques.cajas) {
      // una caja con `ytop` se pisa (muro4: el pie de la T, los trastos del saltadero): por encima de su tapa no choca, y
      // andando se sube sola si no pasa de un escalon (30 cm)
      if (b.ytop != null && H.pos.y >= b.ytop - (H.suelo ? ESCALON : 0.03)) continue;
      const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
      const lx = (p.x - b.x) * ca + (p.z - b.z) * sa, lz = -(p.x - b.x) * sa + (p.z - b.z) * ca;
      const cx = Math.max(-b.hx, Math.min(b.hx, lx)), cz = Math.max(-b.hz, Math.min(b.hz, lz));
      const dx = lx - cx, dz = lz - cz, d = Math.hypot(dx, dz);
      if (d < RADIO) {
        let nx, nz, pen;
        if (d > 1e-6) { nx = dx / d; nz = dz / d; pen = RADIO - d; }
        else {          // dentro de la caja: sale por el lado mas cercano
          const sx = b.hx - Math.abs(lx), sz = b.hz - Math.abs(lz);
          if (sx < sz) { nx = Math.sign(lx); nz = 0; pen = sx + RADIO; } else { nx = 0; nz = Math.sign(lz); pen = sz + RADIO; }
        }
        const wx = nx * ca - nz * sa, wz = nx * sa + nz * ca;
        p.x += wx * pen; p.z += wz * pen;
      }
    }
    const L = mundo.borde ?? (mundo.LADO || 60) - 2;   // el borde del mapa en que este
    p.x = Math.max(-L, Math.min(L, p.x));
    p.z = Math.max(-L, Math.min(L, p.z));
    if (mundo.limitar) mundo.limitar(p);         // la forma del mapa si no es un cuadrado (la cuenca del muro)
  }

  // un paso de juego: entrada = { x, z } (adelante/derecha en ejes de camara, -1..1), correr, saltar, gesto
  function paso(dt, entrada, yawCam) {
    if (!H.listo) return;
    const quiere = new THREE.Vector2(entrada.x, entrada.z);
    if (quiere.lengthSq() > 1) quiere.normalize();
    // de ejes de camara a mundo: adelante = hacia donde mira la camara
    const s = Math.sin(yawCam), c = Math.cos(yawCam);
    const dirX = quiere.y * -s + quiere.x * c;
    const dirZ = quiere.y * -c - quiere.x * s;
    // por defecto corre (el mapa mide 120 m); con Mayus anda
    const vmax = entrada.andar ? ANDAR.v : CORRER.v;
    const objetivo = new THREE.Vector2(dirX, dirZ).multiplyScalar(vmax * Math.min(1, quiere.length()));
    if (H.gesto && objetivo.lengthSq() > 0.001) { H.gesto = null; }
    const acel = H.suelo ? 7 : 2;
    H.vel.lerp(objetivo, Math.min(1, acel * dt));
    if (H.vel.length() < 0.02 && objetivo.lengthSq() === 0) H.vel.set(0, 0);
    // giro hacia donde se mueve
    if (H.vel.lengthSq() > 0.004) {
      const g = Math.atan2(H.vel.x, H.vel.y);
      let d = g - H.giro;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      H.giro += d * Math.min(1, 10 * dt);
    }
    // mover y chocar
    const p = { x: H.pos.x + H.vel.x * dt, z: H.pos.z + H.vel.y * dt };
    resolver(p);
    H.pos.x = p.x; H.pos.z = p.z;
    // salto y gravedad
    const hs = mundo.altura(H.pos.x, H.pos.z);
    if (entrada.saltar && H.suelo && !H.saltando) {
      H.saltando = 1;
      H.gesto = null;
      H.vy = SALTO_V;
      H.suelo = false;
      const a = H.acciones.salto;
      a.timeScale = 1.35;
      // el clip empieza agachado: entra ya en el despegue
      poner('salto', 0.08);
      a.time = 0.18;
    }
    if (!H.suelo || H.pos.y > hs + 0.001) {
      H.vy -= GRAVEDAD * dt;
      H.pos.y += H.vy * dt;
      if (H.pos.y <= hs) {
        // la caida (la hierba la recibe como una onda)
        if (H.vy < -1) H.caida = { n: (H.caida ? H.caida.n : 0) + 1, x: H.pos.x, z: H.pos.z, v: -H.vy };
        H.pos.y = hs; H.vy = 0; H.suelo = true;
      }
    } else if (hs - H.pos.y > 0.05) {
      H.pos.y += (hs - H.pos.y) * Math.min(1, 22 * dt);     // un escalon: sube en un par de fotogramas, sin salto
    } else {
      H.pos.y = hs;
    }
    // gestos (solo parado y en el suelo)
    if (entrada.gesto && H.suelo && !H.saltando && H.vel.length() < 0.05) {
      const n = GESTOS[entrada.gesto];
      if (n && H.acciones[n]) { H.gesto = n; poner(n, 0.2); }
    }
    if (!H.saltando && !H.gesto) poner(locomocion());
    if (H.saltando && H.suelo && H.acciones.salto.time > 1.0) { H.saltando = 0; poner(locomocion(), 0.15); }
    tocados.forEach((b, i) => b.quaternion.copy(guardadas[i]));
    H.mixer.update(dt);
    tocados.forEach((b, i) => guardadas[i].copy(b.quaternion));
    H.raiz.position.copy(H.pos);
    H.raiz.rotation.y = H.giro;
    pies(dt);
    if (H.fisica) H.tela.paso(dt); else H.tela.reiniciar();
  }

  // PIES EN LA CUESTA: el clip pisa un suelo plano a la altura del centro; en una loma un pie flotaba y el otro se
  // hundia (hasta 17 mm). Cada tobillo va a su suelo con la altura que le da el clip sobre el plano, el cuerpo baja lo
  // que pide el pie mas bajo, la rodilla se dobla (IK de dos huesos) y el pie apoyado se tumba con la pendiente.
  // En el aire se apaga poco a poco.
  H.ik = { peso: 0, pelvis: 0 };
  function pies(dt) {
    const k = H.ik;
    k.peso += ((H.suelo ? 1 : 0) - k.peso) * Math.min(1, 12 * dt);
    if (!H.piernas.length || k.peso < 1e-3) { k.pelvis *= 0.8; H.raiz.position.y += k.pelvis; return; }
    H.raiz.updateMatrixWorld(true);
    const datos = H.piernas.map(([, , pie], i) => {
      const A = new THREE.Vector3().setFromMatrixPosition(pie.matrixWorld);
      const alto = A.y - H.pos.y;                                    // sobre el suelo plano del clip
      const e = 0.04, g = mundo.altura(A.x, A.z);
      const n = new THREE.Vector3(mundo.altura(A.x - e, A.z) - mundo.altura(A.x + e, A.z), 2 * e,
        mundo.altura(A.x, A.z - e) - mundo.altura(A.x, A.z + e)).normalize();
      const T = new THREE.Vector3(A.x, g, A.z).addScaledVector(n, alto);
      // apoyado = tobillo cerca de su altura de reposo
      const apoyo = 1 - Math.max(0, Math.min(1, (alto - H.tobilloReposo[i] - 0.01) / 0.05));
      return { A, T, n, apoyo };
    });
    // el cuerpo baja lo que pide el pie APOYADO mas bajo (un pie en el aire sobre una bajada no tira de la cadera: al
    // correr cuesta abajo el cuerpo botaba)
    const objetivo = Math.min(0.03, ...datos.map((d) => (d.T.y - d.A.y) * d.apoyo)) * k.peso;
    k.pelvis += (objetivo - k.pelvis) * Math.min(1, 15 * dt);
    H.raiz.position.y += k.pelvis;
    H.raiz.updateMatrixWorld(true);
    H.piernas.forEach(([muslo, pierna, pie], i) => {
      const d = datos[i];
      d.A.y += k.pelvis;
      // el pie conserva el giro que le da el clip (la IK gira la pierna y el pie lo heredaba: una punta se hundia
      // 20 mm) y solo se inclina lo que pide la pendiente
      const qPie = pie.getWorldQuaternion(new THREE.Quaternion());
      ik2(muslo, pierna, pie, d.A.clone().lerp(d.T, k.peso));
      const inc = new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(ARRIBA, d.n), k.peso * d.apoyo);
      pie.parent.getWorldQuaternion(q1);
      pie.quaternion.copy(q1.invert().multiply(inc.multiply(qPie)));
      pie.updateMatrixWorld(true);
    });
  }

  // LO QUE TOCA LA HIERBA (lo lee la fisica de la hierba de los mapas que la tengan): el 18 mide 1 m y la cadera le
  // queda a 22 cm, asi que media figura va metida en ella. Los pies la apartan y la PISAN (deja rastro), el cuerpo con
  // la capa la abre a lo ancho y el bajo de cada pano de la capa la roza. Fuerza segun lo metido que va (altura sobre el
  // suelo frente a ALTO_HIERBA); en el aire, nada.
  const ALTO_HIERBA = 0.3;
  const PIES = [['foot_l', 0.17], ['foot_r', 0.17], ['ball_l', 0.14], ['ball_r', 0.14]];
  const _p = new THREE.Vector3();
  let huesosContacto = null;
  H.contactos = (out = []) => {
    out.length = 0;
    if (!H.listo) return out;
    if (!huesosContacto) {
      huesosContacto = {};
      H.raiz.traverse((o) => { if (o.isBone) huesosContacto[o.name] = o; });
    }
    const metido = (y) => 1 - Math.max(0, Math.min(1, (y - mundo.altura(_p.x, _p.z)) / ALTO_HIERBA));
    for (const [n, r] of PIES) {
      const b = huesosContacto[n];
      if (!b) continue;
      _p.setFromMatrixPosition(b.matrixWorld);
      const f = metido(_p.y);
      const pisa = 1 - Math.max(0, Math.min(1, (_p.y - mundo.altura(_p.x, _p.z) - 0.03) / 0.06));
      if (f > 0) out.push({ id: n, x: _p.x, z: _p.z, r, fuerza: f, pisa });
    }
    const pel = huesosContacto.pelvis;
    if (pel) {
      _p.setFromMatrixPosition(pel.matrixWorld);
      const f = metido(_p.y - 0.18);           // el bajo de la capa va unos 18 cm por debajo de la cadera
      if (f > 0) out.push({ id: 'cuerpo', x: _p.x, z: _p.z, r: 0.34, fuerza: f, pisa: f });
    }
    if (H.tela && H.fisica) {
      for (const c of H.tela.cadenas) {
        if (c.tipo !== 'capa') continue;
        const p = c.P[c.P.length - 1];
        _p.copy(p);
        const f = metido(p.y);
        if (f > 0) out.push({ id: 'capa_' + c.bs[0].name, x: p.x, z: p.z, r: 0.11, fuerza: 0.8 * f, pisa: 0 });
      }
    }
    return out;
  };

  // de vuelta a la salida, de pie y quieto (para __dbg.ir y la R)
  H.reiniciar = (x, y, z, giro) => {
    H.pos.set(x, y, z); H.vel.set(0, 0); H.vy = 0; H.suelo = true; H.saltando = 0; H.gesto = null; H.giro = giro;
    H.ik.pelvis = 0;
    if (!H.listo) return;
    for (const a of Object.values(H.acciones)) { a.stop(); a.setEffectiveWeight(0); }
    actual = 'reposo';
    H.acciones.reposo.reset().setEffectiveWeight(1).play();
    H.estado = 'reposo';
    H.raiz.position.copy(H.pos); H.raiz.rotation.y = giro;
    H.mixer.update(0);
    H.tela.reiniciar();
  };
  H.paso = paso;
  H.poner = poner;
  H.cargado = promesa;
  return H;
}
