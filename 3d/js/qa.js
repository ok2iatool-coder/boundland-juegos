// AUDITORIA automatica del juego (para buscar fallos con numeros): __dbg.qa() devuelve un informe.
//   - suelo: el camino no puede quedar por debajo del terreno (la hierba asomaria entre las piedras)
//   - pies: el heroe pisa el suelo en todo el mapa (ni flota ni se hunde)
//   - choques: andar contra cada tronco, columna y muro desde 8 lados; cuanto se mete
//   - transiciones: correr, frenar, saltar, aterrizar, gestos y gestos interrumpidos: nunca sin clip activo (pose de
//     reposo del esqueleto, la "T"), pesos que suman 1, estado coherente
//   - tela: en todos los clips y con saltos de tiempo: sin NaN, sin eslabones estirados, sin particulas dentro de las
//     piernas o del tronco
//   - camara: nunca bajo el suelo ni dentro de un obstaculo, recorriendo el mapa con giros
//   - reves: el 18 pintado por una cara y por las dos; si cambia, se ve tela del reves o el casco de tinta
import * as THREE from 'three';

export async function auditar(d) {
  const H = d.heroe, M = d.mundo, informe = {};
  const altura = M.altura, puntoCamino = M.puntoCamino;   // los del mapa en que se este
  // ceder el hilo sin setTimeout: con la pestana oculta Chrome lo frena a uno por minuto y la auditoria tardaba media hora
  const espera = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  d.congelar(true);

  // ---------- 1) el camino frente al terreno ----------
  {
    // las cintas de camino (userData.caminoCortes = vertices por fila; o, sin indice, triangulos sueltos)
    const cintas = [];
    d.scene.traverse((o) => { if (o.isMesh && o.userData.caminoCortes) cintas.push(o); });
    let peor = 0, malos = 0, n = 0;
    const probar = (x, z, yc) => {
      const dy = (M.alturaTerreno || altura)(x, z) - yc;
      n++;
      if (dy > 0) { malos++; peor = Math.max(peor, dy); }
    };
    for (const cam of cintas) {
      const pos = cam.geometry.attributes.position;
      if (cam.geometry.index) {
        // filas de vertices: a lo ancho la cinta es recta entre vecinos; el terreno no puede pasar por encima
        const w = cam.userData.caminoCortes;
        for (let i = 0; i + w <= pos.count; i += w) {
          for (let m = 0; m + 1 < w; m++) {
            for (const k of [0.25, 0.5, 0.75]) {
              const a = i + m, b = i + m + 1;
              probar(pos.getX(a) * (1 - k) + pos.getX(b) * k, pos.getZ(a) * (1 - k) + pos.getZ(b) * k, pos.getY(a) * (1 - k) + pos.getY(b) * k);
            }
          }
        }
      } else {
        // triangulos sueltos: el centro y los puntos medios de cada lado
        for (let i = 0; i + 2 < pos.count; i += 3) {
          const p = [0, 1, 2].map((k) => [pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)]);
          probar((p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][2] + p[1][2] + p[2][2]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3);
          for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) probar((p[a][0] + p[b][0]) / 2, (p[a][2] + p[b][2]) / 2, (p[a][1] + p[b][1]) / 2);
        }
      }
    }
    informe.camino = { muestras: n, terrenoPorEncima: malos, peor_mm: +(peor * 1000).toFixed(1) };
  }

  // ---------- 2) pies en el suelo por todo el mapa ----------
  {
    const huesos = {};
    H.raiz.traverse((o) => { if (o.isBone) huesos[o.name] = o; });
    const v = new THREE.Vector3();
    let peor = 0, n = 0;
    // el 18 PARADO antes de medir (si venia corriendo, los primeros 30 fotogramas median un pie en el aire)
    d.soltar();
    d.avanzar(1 / 60, 90);
    for (let t = 0.02; t < 0.98; t += 0.06) {
      for (const lado of [-4, 0, 4]) {
        const p = puntoCamino(t);
        const x = p.x - p.tz * lado, z = p.z + p.tx * lado;
        d.ir(x, z); d.avanzar(1 / 60, 30);
        for (const b of ['ball_l', 'ball_r']) {
          v.setFromMatrixPosition(huesos[b].matrixWorld);
          // la cabeza del hueso de la punta del pie esta a 12 mm del suelo en reposo
          const err = v.y - 0.012 - altura(v.x, v.z);
          peor = Math.max(peor, Math.abs(err)); n++;
        }
      }
    }
    informe.pies = { muestras: n, peor_mm: +(peor * 1000).toFixed(1) };
  }

  // ---------- 3) choques ----------
  {
    const obst = [...M.choques.circulos.filter((c) => Math.abs(c.x) < 50 && Math.abs(c.z) < 50).slice(0, 40),
      ...M.choques.cajas.map((c) => ({ ...c, caja: true }))];
    let peor = 0, peorQue = null;
    for (const o of obst) {
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2, dist = (o.caja ? Math.max(o.hx, o.hz) : o.r) + 1.2;
        d.ir(o.x + Math.cos(a) * dist, o.z + Math.sin(a) * dist); d.avanzar(1 / 60, 2);
        // camara detras del heroe mirando al obstaculo y W
        d.camara(Math.atan2(Math.cos(a), Math.sin(a)), 0.2, 3); d.pulsar('KeyW'); d.avanzar(1 / 60, 70); d.soltar();
        const px = H.pos.x, pz = H.pos.z;
        let pen;
        if (o.caja) {
          const ca = Math.cos(o.ang), sa = Math.sin(o.ang);
          const lx = (px - o.x) * ca + (pz - o.z) * sa, lz = -(px - o.x) * sa + (pz - o.z) * ca;
          const dx = Math.max(0, Math.abs(lx) - o.hx), dz = Math.max(0, Math.abs(lz) - o.hz);
          pen = 0.24 - Math.hypot(dx, dz);
        } else pen = o.r + 0.24 - Math.hypot(px - o.x, pz - o.z);
        if (pen > peor) { peor = pen; peorQue = { x: o.x.toFixed(1), z: o.z.toFixed(1), caja: !!o.caja }; }
      }
      await espera();
    }
    informe.choques = { obstaculos: obst.length, peorPenetracion_mm: +(Math.max(0, peor) * 1000).toFixed(1), donde: peorQue };
  }

  // ---------- 4) transiciones de animacion ----------
  {
    const p = puntoCamino(0.3);
    d.ir(p.x, p.z); d.avanzar(1 / 60, 30);
    const fallos = [];
    const mira = (que) => {
      const acs = Object.values(H.acciones);
      const suma = acs.reduce((s, a) => s + (a.isRunning() || a.enabled ? a.getEffectiveWeight() : 0), 0);
      if (suma < 0.5) fallos.push(`${que}: pesos ${suma.toFixed(2)} (pose de reposo asomando)`);
    };
    const pasos = [
      ['correr', () => { d.pulsar('KeyW'); }, 60], ['frenar', () => { d.soltar(); }, 40],
      ['saltar parado', () => { d.saltar(); }, 70], ['saltar corriendo', () => { d.pulsar('KeyW'); d.saltar(); }, 70],
      ['aterrizar y parar', () => { d.soltar(); }, 40],
      ...[1, 2, 3, 4].map((g) => [`gesto ${g}`, () => { d.gesto(g); }, 50]),
      ['gesto interrumpido', () => { d.gesto(1); d.avanzar(1 / 60, 10); d.pulsar('KeyW'); }, 40],
      ['saltar en gesto', () => { d.soltar(); d.avanzar(1 / 60, 30); d.gesto(2); d.avanzar(1 / 60, 10); d.saltar(); }, 70],
      ['andar', () => { d.soltar(); d.pulsar('KeyW', 'ShiftLeft'); }, 60], ['parar', () => { d.soltar(); }, 60],
    ];
    for (const [que, fn, n] of pasos) {
      fn();
      for (let i = 0; i < n; i++) { d.avanzar(1 / 60, 1); mira(que); }
    }
    d.soltar(); d.avanzar(1 / 60, 60);
    informe.transiciones = { fallos: [...new Set(fallos)].slice(0, 12), estadoFinal: H.estado };
  }

  // ---------- 5) la tela ----------
  {
    const T = H.tela;
    // dentro: la particula metida en el cuerpo (capsulas de brazos y piernas y el tronco medido de tela.js) mas de 2 mm
    // por debajo de su superficie, mas alla de lo que la mete el propio clip
    let nan = 0, estirado = 0, dentro = 0, peorDentro = 0, muestras = 0;
    const revisar = () => {
      for (const c of T.cadenas) {
        for (let i = 0; i < c.P.length; i++) {
          if (!isFinite(c.P[i].x + c.P[i].y + c.P[i].z)) nan++;
          if (i && Math.abs(c.P[i].distanceTo(c.P[i - 1]) - c.L[i - 1]) > 0.002) estirado++;
          if (c.tipo !== 'capa' || !i) continue;
          const k = T.penetracion(c, i);
          peorDentro = Math.max(peorDentro, k);
          if (k > 0.002) dentro++;
        }
      }
      muestras++;
    };
    // vuelta al reposo: cuanto se aparta cada pano de su pose del clip, parado, antes y despues de todo lo demas (si
    // despues es mayor, se ha quedado ENGANCHADO: detras de un brazo, en la rendija de la mochila, doblado...)
    // (las particulas apoyadas en el suelo no cuentan: en una cuesta el bajo de la capa descansa en la ladera y se
    // aparta de su pose sin estar enganchado)
    const desvio = () => Object.fromEntries(T.cadenas.filter((c) => c.tipo === 'capa').map((c) => [c.bs[0].name,
      Math.max(0, ...c.P.map((P, i) => (P.y - altura(P.x, P.z) < 0.03 ? 0 : P.distanceTo(c.A[i]))))]));
    const p = puntoCamino(0.5);
    d.ir(p.x, p.z); d.avanzar(1 / 60, 240);
    const antes = desvio();
    d.pulsar('KeyW'); for (let i = 0; i < 120; i++) { d.avanzar(1 / 60, 1); revisar(); }
    d.saltar(); for (let i = 0; i < 70; i++) { d.avanzar(1 / 60, 1); revisar(); }
    d.soltar(); for (let i = 0; i < 60; i++) { d.avanzar(1 / 60, 1); revisar(); }
    for (const g of [1, 2, 3, 4]) { d.gesto(g); for (let i = 0; i < 100; i++) { d.avanzar(1 / 60, 1); revisar(); } }
    // saltar corriendo y giros bruscos de camara corriendo (el 18 da la vuelta)
    d.pulsar('KeyW'); for (let i = 0; i < 60; i++) { d.avanzar(1 / 60, 1); revisar(); }
    d.saltar(); for (let i = 0; i < 70; i++) { d.avanzar(1 / 60, 1); revisar(); }
    for (const giro of [2.5, -2.0]) { d.camara(d.C.yaw + giro); for (let i = 0; i < 50; i++) { d.avanzar(1 / 60, 1); revisar(); } }
    d.soltar(); for (let i = 0; i < 30; i++) { d.avanzar(1 / 60, 1); revisar(); }
    // saltos de tiempo (la pestana se queda en segundo plano): 0,1 s de golpe corriendo
    d.pulsar('KeyW'); for (let i = 0; i < 20; i++) { d.avanzar(0.1, 1); revisar(); } d.soltar();
    d.soltar(); d.avanzar(1 / 60, 240);
    const despues = desvio();
    const enganchados = Object.keys(antes).filter((k) => despues[k] > antes[k] + 0.03).map((k) => `${k} ${Math.round(despues[k] * 1000)} mm`);
    informe.tela = { muestras, nan, eslabonesEstirados: estirado, particulasDentroDelCuerpo: dentro, peorDentro_mm: +(peorDentro * 1000).toFixed(1), enganchados };
  }

  // ---------- 6) camara ----------
  {
    let bajoSuelo = 0, enObstaculo = 0, n = 0;
    for (let t = 0.05; t < 0.95; t += 0.1) {
      const p = puntoCamino(t);
      d.ir(p.x, p.z); d.avanzar(1 / 60, 5);
      for (let k = 0; k < 12; k++) {
        for (const pitch of [-0.2, 0.3, 1.1]) {
          d.camara(k / 12 * Math.PI * 2, pitch, 4); d.avanzar(1 / 60, 2); n++;
          const c = d.cam.position;
          if (c.y < altura(c.x, c.z) + 0.05) bajoSuelo++;
          if (M.choques.circulos.some((o) => Math.hypot(c.x - o.x, c.z - o.z) < o.r)) enObstaculo++;
        }
      }
      await espera();
    }
    informe.camara = { tomas: n, bajoSuelo, dentroDeObstaculo: enObstaculo };
  }

  // ---------- 7) tela del reves ----------
  // el 18 pintado por una cara y por las dos desde 24 vistas: donde cambia, se esta viendo una cara por detras (tela
  // del reves o el casco de tinta asomando: asi salio la capa negra detras de la mochila). Pixeles que cambian.
  {
    const p = puntoCamino(0.3);
    d.ir(p.x, p.z); d.soltar(); d.avanzar(1 / 60, 40);
    const gl = d.renderer.getContext(), W = gl.drawingBufferWidth, Hh = gl.drawingBufferHeight;
    const mats = [];
    H.raiz.traverse((o) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.isMeshToonMaterial) mats.push(m); }); });
    const lado0 = mats.map((m) => m.side);
    const poner = (s) => mats.forEach((m) => { m.side = s; m.needsUpdate = true; });
    const leer = () => { d.renderer.render(d.scene, d.cam); const b = new Uint8Array(W * Hh * 4); gl.readPixels(0, 0, W, Hh, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
    let peor = 0, suma = 0, vistas = 0;
    for (const pitch of [0.25, 1.0, -0.15]) {
      for (let k = 0; k < 8; k++) {
        d.camara(k / 8 * Math.PI * 2, pitch, 2.0); d.avanzar(1 / 60, 1);
        poner(THREE.FrontSide); const a = leer(); poner(THREE.DoubleSide); const b = leer();
        let n = 0;
        for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++;
        peor = Math.max(peor, n); suma += n; vistas++;
      }
      await espera();
    }
    mats.forEach((m, i) => { m.side = lado0[i]; m.needsUpdate = true; });
    informe.reves = { vistas, pixelesMedio: Math.round(suma / vistas), pixelesPeor: peor, lienzo: `${W}x${Hh}` };
  }
  d.camara(null, 0.28, 3.4);
  return informe;
}
