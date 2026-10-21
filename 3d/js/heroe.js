// El 18: el .glb de escuela/obras/sujeto18_3d (piel, 51 huesos, 8 clips) con el acabado de tinta del visor
// (MeshToonMaterial con el color horneado en dos escalones y el casco de tinta que trae el .glb) y su CONTROL en
// tercera persona: andar / correr relativos a la camara, salto, gestos, gravedad y choques en planta.
//
// Velocidades: los ciclos se midieron en Blender (lo que retrocede el pie apoyado): andar ~0,27 m/s y correr
// ~1,37 m/s a velocidad 1. En el juego se aceleran y el personaje avanza justo lo que pide su clip, asi no patina.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { crearTela } from './tela.js';
import { crearTela as crearTelaCadenas } from './tela_cadenas.js';

// lo que avanza el cuerpo en UN ciclo de cada clip a velocidad 1 (velocidad del pie apoyado x duracion), medido otra vez
// en el clip el 2026-10-21: andar 0,27 m/s x 1 s; correr 1,358 m/s (el pie apoyado, a 1 cm del suelo) x 0,6 s. Los dos
// clips apoyan el pie izquierdo en el mismo punto del ciclo (0,54), asi que se mezclan EN FASE
const ZANCADA = { andar: 0.27 * 1.0, correr: 1.358 * 0.6 };
const ANDAR = { v: 0.45 };
const CORRER = { v: 1.8 };
const ESCALON = 0.3;           // lo que se sube andando (las cajas con `ytop`: el pie del muro exterior, los trastos)
const TREPA = 0.36;            // en el aire, un borde (caja con `ytop`) hasta esto por encima de los pies se agarra y se sube
const RADIO = 0.24;            // planta del 18 para los choques (la capa abierta mide ~0,5 m)
const GRAVEDAD = 9.8;
const SALTO_V = 3.3;           // m/s hacia arriba: ~0,55 m de salto
// CUERPO (2026-10-21): aceleraciones y giro con tope, no un lerp que llega igual de deprisa a todo
const ACEL = 6;                // m/s2 al arrancar: de parado a correr en 0,3 s
const FRENA = 10;              // m/s2 al frenar
const ACEL_AIRE = 2.5;         // lo que se corrige en el aire
const GIRO_PARADO = 12, GIRO_CORRIENDO = 7;   // rad/s (690 y 400 grados/s; antes 30 grados en un fotograma)
const COYOTE = 0.1;            // s que aun se puede saltar despues de dejar el suelo
const RECUERDA_SALTO = 0.12;   // s que se recuerda un salto pedido un pelin antes de tocar el suelo
const CORTE_SALTO = 0.45;      // al soltar el espacio subiendo, la velocidad hacia arriba se queda en esto
const INCLINA_MAX = 0.2, CABECEA_MAX = 0.12;  // rad: el cuerpo se tumba hacia dentro en las curvas y con el empuje
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
    // el cuerpo: rapidez sobre el suelo en la direccion en que mira, fase del paso, inclinaciones y el amortiguado
    // de las rodillas al caer
    rapidez: 0, fase: 0, inclina: 0, cabecea: 0, coyote: 0, pedido: 0, sostenido: false,
    flex: { y: 0, v: 0 },
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
        return new THREE.MeshToonMaterial({ map: m.map, gradientMap: escalones, side: m.side });
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
    // reposo, andar y correr suenan siempre y se MEZCLAN por la velocidad (pesos puestos a mano en `pesos()`); andar y
    // correr no avanzan solos: su tiempo sale de la fase del paso, que avanza con lo que anda el cuerpo
    for (const n of ['reposo', 'andar', 'correr']) { H.acciones[n].play(); H.acciones[n].setEffectiveWeight(n === 'reposo' ? 1 : 0); }
    H.acciones.andar.timeScale = H.acciones.correr.timeScale = 0;
    H.mixer.addEventListener('finished', (e) => {
      if (e.action === H.acciones.salto) H.saltando = 0;
      if (H.gesto && e.action === H.acciones[H.gesto]) { H.gesto = null; poner(null); }
    });
    // fisica de la capa y de la capucha (tela.js); P la enciende y la apaga para comparar con el clip
    // ?tela=cadenas: la fisica de antes (siete cadenas sueltas), para comparar con la malla
    H.tela = (/[?&]tela=cadenas/.test(location.search) ? crearTelaCadenas : crearTela)(raiz, mundo.altura, mundo.choques);
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

  // ANIMACION por pesos (2026-10-21). Antes se cambiaba de clip por umbrales (andar por debajo de 1,1 m/s, correr por
  // encima) y cada clip iba a su velocidad fija: al arrancar, el clip de correr iba a tope con el cuerpo aun a 0,8 m/s
  // y el pie apoyado patinaba 18 mm por fotograma (medir_cuerpo.js). Ahora:
  //   - la LOCOMOCION es una mezcla de reposo, andar y correr segun la rapidez, y la fase del paso avanza lo que anda el
  //     cuerpo dividido por la zancada (mezclada con los mismos pesos): el pie apoyado se queda donde pisa a cualquier
  //     velocidad, tambien arrancando, frenando o contra una roca.
  //   - un clip de UNA VEZ (salto, gestos) entra encima con su fundido y, al acabar, se funde de vuelta a la mezcla.
  let unaVez = null, fundido = 0.22;
  const pesoUna = {};             // peso de cada clip de una vez (sube el activo, bajan los demas)
  const LOCO = ['reposo', 'andar', 'correr'];
  // n = nombre de un clip de una vez, o null para volver a la locomocion
  function poner(n, f = 0.22) {
    if (LOCO.includes(n)) n = null;
    if (n === unaVez) return;
    fundido = Math.max(0.01, f);
    unaVez = n;
    if (n && H.acciones[n]) {
      const a = H.acciones[n];
      a.reset(); a.enabled = true; a.play();
      pesoUna[n] = pesoUna[n] || 0;
    }
  }
  const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function pesos(dt) {
    // los de una vez
    let suma = 0;
    for (const n of Object.keys(pesoUna)) {
      const meta = n === unaVez ? 1 : 0;
      const w = pesoUna[n] + Math.sign(meta - pesoUna[n]) * Math.min(Math.abs(meta - pesoUna[n]), dt / fundido);
      pesoUna[n] = w;
      const a = H.acciones[n];
      if (w <= 0 && n !== unaVez) { a.stop(); delete pesoUna[n]; continue; }
      a.setEffectiveWeight(w);
      suma += w;
    }
    // la locomocion con lo que quede. Girando en el sitio tambien da pasos (lo que recorre un pie a 12 cm del eje): sin
    // ellos los pies rotaban pegados al suelo
    const resto = Math.max(0, 1 - suma), v = H.rapidez + Math.abs(H.giroV || 0) * 0.12;
    const mueve = suave(0.03, 0.15, v), corre = suave(ANDAR.v, 1.1, v);
    const meta = { reposo: 1 - mueve, andar: mueve * (1 - corre), correr: mueve * corre };
    // los pesos van hacia los de la velocidad en unas decimas: al parar de andar (de 0,45 a 0 en 0,05 s) la pose
    // saltaba a la de reposo de un fotograma al siguiente y los pies con ella (17 mm por fotograma)
    const w = H.wLoco || (H.wLoco = { reposo: 1, andar: 0, correr: 0 });
    const k = Math.min(1, 12 * dt);
    for (const n of LOCO) { w[n] += (meta[n] - w[n]) * k; H.acciones[n].setEffectiveWeight(resto * w[n]); }
    // la fase del paso: lo que avanza el cuerpo entre la zancada de la mezcla
    const zancada = ZANCADA.andar + (ZANCADA.correr - ZANCADA.andar) * corre;
    H.fase = (H.fase + (v * dt) / zancada) % 1;
    H.acciones.andar.time = H.fase * H.clips.andar.duration;
    H.acciones.correr.time = H.fase * H.clips.correr.duration;
    H.estado = unaVez && pesoUna[unaVez] > 0.5 ? unaVez : (w.reposo > 0.5 ? 'reposo' : w.correr > w.andar ? 'correr' : 'andar');
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
      // una caja con `ytop` se pisa (el muro exterior: el pie de la T, la tapa, los trastos del saltadero): por encima de
      // su tapa no choca, y andando se sube sola si no pasa de un escalon
      if (b.ytop != null && H.pos.y >= b.ytop - (H.suelo ? ESCALON : 0.03)) continue;
      const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
      const lx = (p.x - b.x) * ca + (p.z - b.z) * sa, lz = -(p.x - b.x) * sa + (p.z - b.z) * ca;
      const cx = Math.max(-b.hx, Math.min(b.hx, lx)), cz = Math.max(-b.hz, Math.min(b.hz, lz));
      const dx = lx - cx, dz = lz - cz, d = Math.hypot(dx, dz);
      if (d < RADIO) {
        // AGARRARSE: en el aire, con el borde a menos de TREPA de los pies, el 18 se sube encima. El salto da 0,53 m y
        // la tapa del muro exterior queda a 0,44 del ultimo escalon del saltadero, que solo mide 0,67 de fondo: sin
        // carrerilla no llegaba nunca a meter el centro encima de los 30 cm del alma
        let nx, nz, pen;
        if (d > 1e-6) { nx = dx / d; nz = dz / d; pen = RADIO - d; }
        else {          // dentro de la caja: sale por el lado mas cercano
          const sx = b.hx - Math.abs(lx), sz = b.hz - Math.abs(lz);
          if (sx < sz) { nx = Math.sign(lx); nz = 0; pen = sx + RADIO; } else { nx = 0; nz = Math.sign(lz); pen = sz + RADIO; }
        }
        const wx = nx * ca - nz * sa, wz = nx * sa + nz * ca;
        // (solo yendo HACIA el borde: al bajarse por el otro lado el 18 cae rozandolo y lo volvia a subir)
        if (b.ytop != null && !H.suelo && H.pos.y >= b.ytop - TREPA && H.pos.y < b.ytop - 0.02 && H.vel.x * wx + H.vel.y * wz < -0.01) {
          const qx = Math.max(-b.hx + 0.03, Math.min(b.hx - 0.03, lx)), qz = Math.max(-b.hz + 0.03, Math.min(b.hz - 0.03, lz));
          p.x = b.x + qx * ca - qz * sa; p.z = b.z + qx * sa + qz * ca;
          H.pos.y = b.ytop; H.vy = 0; H.suelo = true;
          continue;
        }
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
    const pide = Math.min(1, quiere.length());
    if (H.gesto && pide > 0.03) { H.gesto = null; poner(null, 0.15); }
    const giro0 = H.giro, antesX = H.pos.x, antesZ = H.pos.z, rapidez0 = H.rapidez;
    if (H.suelo) {
      // EN EL SUELO el 18 corre hacia donde MIRA (asi el clip, que avanza hacia delante, casa con el cuerpo) y gira
      // hacia donde se le pide con un tope de giro. Si lo pedido queda muy atras frena para dar la vuelta, como una
      // persona, en vez de ir hacia atras con el clip de ir hacia delante (media vuelta: 22 mm de patinazo por fotograma)
      let fuera = 0;
      if (pide > 0.03) {
        let d = Math.atan2(dirX, dirZ) - H.giro;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        const tope = (GIRO_PARADO + (GIRO_CORRIENDO - GIRO_PARADO) * Math.min(1, H.rapidez / CORRER.v)) * dt;
        H.giro += Math.max(-tope, Math.min(tope, d));
        fuera = Math.abs(d);
      }
      // la cuesta: subiendo se va mas despacio, bajando un poco mas deprisa
      const fx = Math.sin(H.giro), fz = Math.cos(H.giro);
      const pend = (mundo.altura(H.pos.x + fx * 0.25, H.pos.z + fz * 0.25) - mundo.altura(H.pos.x - fx * 0.25, H.pos.z - fz * 0.25)) / 0.5;
      const cuesta = pend > 0 ? Math.max(0.55, 1 - 0.8 * pend) : Math.min(1.1, 1 - 0.25 * pend);
      const meta = vmax * pide * cuesta * Math.max(0, Math.cos(Math.min(fuera, Math.PI / 2)));
      const a = meta > H.rapidez ? ACEL : FRENA;
      H.rapidez += Math.max(-a * dt, Math.min(a * dt, meta - H.rapidez));
      H.vel.set(fx * H.rapidez, fz * H.rapidez);
    } else {
      // EN EL AIRE: lo que traia, con un poco de control; el cuerpo se va girando hacia donde va
      const meta = new THREE.Vector2(dirX, dirZ).multiplyScalar(vmax * pide);
      const dv = meta.sub(H.vel);
      if (pide > 0.03) dv.clampLength(0, ACEL_AIRE * dt); else dv.set(0, 0);
      H.vel.add(dv);
      if (H.vel.lengthSq() > 0.01) {
        let d = Math.atan2(H.vel.x, H.vel.y) - H.giro;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        H.giro += Math.max(-4 * dt, Math.min(4 * dt, d));
      }
    }
    // mover y chocar
    const p = { x: H.pos.x + H.vel.x * dt, z: H.pos.z + H.vel.y * dt };
    resolver(p);
    H.pos.x = p.x; H.pos.z = p.z;
    // lo que de verdad se ha movido: contra una roca la rapidez se queda en lo que avanza (antes el clip de correr
    // seguia a tope empujando la roca: 64 de 120 fotogramas corriendo en el sitio)
    const realX = (H.pos.x - antesX) / dt, realZ = (H.pos.z - antesZ) / dt;
    if (dt > 0) {
      // nunca mas deprisa de lo que iba: lo que empuja un choque al sacarlo de una roca no es velocidad (apareciendo
      // encima de la roca grande la sacada se volvia 21 m/s y salia disparado)
      const iba = H.vel.length();
      H.vel.set(realX, realZ);
      if (H.vel.length() > iba) H.vel.setLength(iba);
      if (H.suelo) H.rapidez = Math.max(0, Math.min(H.rapidez, realX * Math.sin(H.giro) + realZ * Math.cos(H.giro)));
    }
    // salto: se recuerda un instante (pulsado justo antes de tocar el suelo) y se perdona un instante (justo despues de
    // dejarlo); soltar el espacio subiendo lo corta
    H.pedido = entrada.saltar ? RECUERDA_SALTO : Math.max(0, H.pedido - dt);
    H.coyote = H.suelo ? COYOTE : Math.max(0, H.coyote - dt);
    const hs = mundo.altura(H.pos.x, H.pos.z);
    if (H.pedido > 0 && H.coyote > 0 && !H.saltando) {
      H.pedido = 0; H.coyote = 0;
      H.saltando = 1;
      H.gesto = null;
      H.vy = SALTO_V;
      H.suelo = false;
      H.sostenido = !!entrada.saltoSostenido;
      const a = H.acciones.salto;
      a.timeScale = 1.35;
      // el clip empieza agachado: entra ya en el despegue
      poner('salto', 0.08);
      a.time = 0.18;
    }
    if (H.sostenido && !entrada.saltoSostenido && H.vy > 0) { H.vy *= CORTE_SALTO; H.sostenido = false; }
    let aterriza = 0;
    if (!H.suelo) {
      H.vy -= GRAVEDAD * dt;
      H.pos.y += H.vy * dt;
      if (H.pos.y <= hs) {
        aterriza = -H.vy;
        // la caida (la hierba la recibe como una onda)
        if (H.vy < -1) H.caida = { n: (H.caida ? H.caida.n : 0) + 1, x: H.pos.x, z: H.pos.z, v: -H.vy };
        H.pos.y = hs; H.vy = 0; H.suelo = true;
        // lo que traia por el aire, en la direccion en que mira
        H.rapidez = Math.max(0, H.vel.x * Math.sin(H.giro) + H.vel.y * Math.cos(H.giro));
      }
    } else if (H.pos.y - hs > 0.03 + H.rapidez * dt * 1.2) {
      // el suelo se ha ido de golpe (un borde): a caer
      H.suelo = false; H.vy = 0;
    } else {
      // PEGADO AL SUELO: antes, al bajar el otero corriendo, la gravedad no alcanzaba a la cuesta y el 18 flotaba hasta
      // 11 mm, 21 fotogramas de 96 (y cada vez que tocaba se borraba lo que caia)
      H.pos.y = hs;
    }
    // gestos (solo parado y en el suelo)
    if (entrada.gesto && H.suelo && !H.saltando && H.rapidez < 0.05) {
      const n = GESTOS[entrada.gesto];
      if (n && H.acciones[n]) { H.gesto = n; poner(n, 0.2); }
    }
    if (H.saltando && H.suelo && H.acciones.salto.time > 1.0) { H.saltando = 0; poner(null, 0.15); }
    if (!H.saltando && !H.gesto && unaVez) poner(null, 0.15);
    // las rodillas recogen la caida: un muelle amortiguado que baja la cadera (los pies siguen en el suelo por la IK)
    if (aterriza > 0.5) H.flex.v -= Math.min(0.9, 0.16 * aterriza);
    H.flex.v += (-260 * H.flex.y - 2 * 0.55 * Math.sqrt(260) * H.flex.v) * dt;
    H.flex.y = Math.min(0, H.flex.y + H.flex.v * dt);
    if (H.flex.y === 0 && H.flex.v > 0) H.flex.v = 0;
    // INCLINACION: hacia dentro de la curva lo que pide la fuerza centripeta (tan = v * w / g) y hacia delante o atras
    // con el empuje (tan = a / g, a la mitad); nada en el aire
    let w = H.giro - giro0;
    w = Math.atan2(Math.sin(w), Math.cos(w)) / Math.max(dt, 1e-4);
    H.giroV = H.suelo ? w : 0;
    const metaI = H.suelo ? -Math.max(-INCLINA_MAX, Math.min(INCLINA_MAX, Math.atan(H.rapidez * w / GRAVEDAD))) : 0;
    const metaC = H.suelo ? Math.max(-CABECEA_MAX, Math.min(CABECEA_MAX, 0.5 * Math.atan((H.rapidez - rapidez0) / Math.max(dt, 1e-4) / GRAVEDAD))) : 0;
    H.inclina += (metaI - H.inclina) * Math.min(1, 8 * dt);
    H.cabecea += (metaC - H.cabecea) * Math.min(1, 6 * dt);
    pesos(dt);
    tocados.forEach((b, i) => b.quaternion.copy(guardadas[i]));
    H.mixer.update(dt);
    tocados.forEach((b, i) => guardadas[i].copy(b.quaternion));
    H.raiz.position.copy(H.pos);
    H.raiz.rotation.set(H.cabecea, H.giro, H.inclina, 'YXZ');
    pies(dt, aterriza > 0);
    if (H.fisica) H.tela.paso(dt); else H.tela.reiniciar();
  }

  // PIES EN LA CUESTA: el clip pisa un suelo plano a la altura del centro; en una loma un pie flotaba y el otro se
  // hundia (hasta 17 mm). Cada tobillo va a su suelo con la altura que le da el clip sobre el plano, el cuerpo baja lo
  // que pide el pie mas bajo, la rodilla se dobla (IK de dos huesos) y el pie apoyado se tumba con la pendiente.
  // En el aire se apaga poco a poco.
  H.ik = { peso: 0, pelvis: 0, clavo: [0, 1].map(() => ({ activo: false, w: 0, x: 0, z: 0 })) };
  function pies(dt, aterrizo) {
    const k = H.ik;
    // al tocar el suelo la IK entra deprisa: la flexion de la caida baja la cadera y sin IK los pies se hundirian
    k.peso += ((H.suelo ? 1 : 0) - k.peso) * Math.min(1, (aterrizo || H.flex.y < -0.002 ? 30 : 12) * dt);
    if (!H.piernas.length || k.peso < 1e-3) { k.pelvis *= 0.8; H.raiz.position.y += k.pelvis; return; }
    H.raiz.updateMatrixWorld(true);
    const datos = H.piernas.map(([, , pie, punta], i) => {
      const A = new THREE.Vector3().setFromMatrixPosition(pie.matrixWorld);
      const B = new THREE.Vector3().setFromMatrixPosition(punta.matrixWorld);
      const alto = A.y - H.pos.y;                                    // sobre el suelo plano del clip
      const e = 0.04, g = mundo.altura(A.x, A.z);
      const n = new THREE.Vector3(mundo.altura(A.x - e, A.z) - mundo.altura(A.x + e, A.z), 2 * e,
        mundo.altura(A.x, A.z - e) - mundo.altura(A.x, A.z + e)).normalize();
      const T = new THREE.Vector3(A.x, g, A.z).addScaledVector(n, alto);
      // apoyado = tobillo cerca de su altura de reposo
      const apoyo = 1 - Math.max(0, Math.min(1, (alto - H.tobilloReposo[i] - 0.01) / 0.05));
      return { A, B, T, n, apoyo, alto, punta: B.y - H.pos.y };
    });
    // PIE CLAVADO (2026-10-21): la PUNTA del pie que pisa se queda donde toco el suelo y la pierna la alcanza por IK
    // (el tobillo se mueve lo mismo que haga falta). El clip de andar rueda el pie de talon a punta y su punta avanza y
    // retrocede dentro del paso (0 a 0,46 m/s): a ninguna velocidad del cuerpo se quedaba quieta (4-6 mm por
    // fotograma). Clavar el TOBILLO no bastaba: al correr el pie gira sobre la punta al despegar y la punta seguia
    // resbalando. PISA mientras el tobillo esta abajo o la punta a menos de 1,8 cm; se suelta al levantarse los dos,
    // en el aire o si el clip se la lleva a mas de 8 cm, y al soltarla vuelve a la del clip en ~0,1 s. (Se probo a
    // pedir ademas que el pie del clip fuera casi quieto, para distinguir el pie que arrastra el clip de andar: salio
    // peor en todo, porque al cambiar de pose el clip mueve el pie apoyado y lo soltaba pisando)
    datos.forEach((d, i) => {
      const L = k.clavo[i];
      const pisa = H.suelo && (d.apoyo > 0.85 || d.punta < 0.018);
      const lejos = L.activo ? Math.hypot(d.B.x - L.x, d.B.z - L.z) : 0;
      if (L.activo && (!pisa || lejos > 0.08)) { L.activo = false; if (lejos > 0.3) L.w = 0; }
      else if (!L.activo && pisa && L.w < 0.05) { L.activo = true; L.x = d.B.x; L.z = d.B.z; }
      L.w += ((L.activo ? 1 : 0) - L.w) * Math.min(1, (L.activo ? 40 : 16) * dt);
      if (L.w > 1e-3) {
        const x = d.T.x + (L.x - d.B.x) * L.w, z = d.T.z + (L.z - d.B.z) * L.w;
        d.T.set(x, mundo.altura(x, z), z).addScaledVector(d.n, d.alto);
      }
    });
    // el cuerpo baja lo que pide el pie APOYADO mas bajo (un pie en el aire sobre una bajada no tira de la cadera: al
    // correr cuesta abajo el cuerpo botaba)
    const objetivo = Math.min(0.03, ...datos.map((d) => (d.T.y - d.A.y) * d.apoyo)) * k.peso;
    k.pelvis += (objetivo - k.pelvis) * Math.min(1, 15 * dt);
    const baja = k.pelvis + H.flex.y * k.peso;     // la cuesta y la flexion de la caida
    H.raiz.position.y += baja;
    H.raiz.updateMatrixWorld(true);
    H.piernas.forEach(([muslo, pierna, pie], i) => {
      const d = datos[i];
      d.A.y += baja;
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

  // el cuerpo quieto y derecho (al llevar al 18 a otro sitio y en las medidas: si no, conservaba la rapidez)
  H.reiniciarCuerpo = () => {
    H.vel.set(0, 0); H.rapidez = 0; H.inclina = 0; H.cabecea = 0; H.pedido = 0; H.coyote = 0;
    H.flex.y = 0; H.flex.v = 0; H.sostenido = false; H.giroV = 0;
    for (const L of H.ik.clavo) { L.activo = false; L.w = 0; }
  };
  H.paso = paso;
  H.poner = poner;
  H.cargado = promesa;
  return H;
}
