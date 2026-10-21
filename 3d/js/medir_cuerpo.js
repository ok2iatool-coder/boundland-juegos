// MIDE el movimiento del CUERPO del 18 (no la capa) en la parcela, fotograma a fotograma a 60 fps y siempre desde el
// mismo arranque: cuanto PATINA el pie apoyado (lo que se mueve en horizontal un pie que esta pisando), si corre en el
// sitio contra una roca, si FLOTA al bajar el otero, cuanto sube el salto y como aterriza.
// Uso: `await (await import('/js/medir_cuerpo.js')).medir(__dbg)`
import * as THREE from 'three';

const FPS = 60, DT = 1 / FPS;
const PIES = ['ball_l', 'ball_r', 'foot_l', 'foot_r'];

// la direccion del mundo hacia la que hay que mirar para que W lleve a (dx, dz)
const yawHacia = (dx, dz) => Math.atan2(-dx, -dz);

export async function medir(D, { escenas = null } = {}) {
  const H = D.heroe, M = D.mundo;
  const huesos = {};
  H.raiz.traverse((o) => { if (o.isBone) huesos[o.name] = o; });
  const p = new THREE.Vector3();
  D.congelar(true);

  function arrancar(x, z, giro) {
    D.soltar();
    D.ir(x, z);
    H.vel.set(0, 0); H.vy = 0; H.suelo = true; H.saltando = 0; H.gesto = null;
    if (giro != null) H.giro = giro;
    if (H.reiniciarCuerpo) H.reiniciarCuerpo();
    H.poner('reposo', 0);
    D.avanzar(DT, 40);
  }

  // corre un guion [[segundos, teclas, {saltar, yaw}]] y devuelve las medidas por tramo
  function correr(nombre, guion) {
    const r = { nombre, tramos: [] };
    let antes = null, prevPies = null;
    for (const [seg, teclas, op = {}] of guion) {
      const t = { teclas: teclas.join('+') || 'nada', fot: 0, deslizAp_mm: [], realV: [], clipV: [], correEnSitio: 0,
        flota_mm: 0, flotaFot: 0, alturaMax: 0, yawMax: 0, estados: {} };
      if (op.yaw != null) D.camara(op.yaw);
      D.soltar(); if (teclas.length) D.pulsar(...teclas);
      const n = Math.round(seg * FPS);
      for (let f = 0; f < n; f++) {
        if (op.saltar && f === 0) D.saltar();
        const g0 = H.giro;
        D.avanzar(DT, 1);
        t.fot++;
        const pos = H.pos.clone();
        const v = antes ? Math.hypot(pos.x - antes.x, pos.z - antes.z) / DT : 0;
        antes = pos;
        t.realV.push(v);
        t.estados[H.estado] = (t.estados[H.estado] || 0) + 1;
        // corre/anda en el sitio: el clip de moverse puesto y el cuerpo casi quieto
        if ((H.estado === 'correr' && v < 0.4) || (H.estado === 'andar' && v < 0.08)) t.correEnSitio++;
        // flota: en el suelo (sin saltar) y el cuerpo por encima del suelo
        const hueco = H.pos.y - M.altura(H.pos.x, H.pos.z);
        if (!H.saltando && hueco > 0.005) { t.flotaFot++; t.flota_mm = Math.max(t.flota_mm, hueco * 1000); }
        t.alturaMax = Math.max(t.alturaMax, hueco);
        let dg = H.giro - g0; dg = Math.atan2(Math.sin(dg), Math.cos(dg));
        t.yawMax = Math.max(t.yawMax, Math.abs(dg) / DT * 180 / Math.PI);
        // pies: lo que se mueve en horizontal un pie apoyado (a menos de 2,5 cm del suelo y bajando o quieto)
        const ahora = PIES.map((n) => {
          const b = huesos[n];
          b.getWorldPosition(p);
          return { x: p.x, y: p.y, z: p.z, g: M.altura(p.x, p.z) };
        });
        // solo la punta (ball) y solo cuando esta pisando de verdad: a menos de 1,2 cm del suelo en los dos fotogramas
        // (con 2,5 cm entraban el despegue y la llegada, cuando el pie aun va deprisa)
        if (prevPies && H.suelo) {
          ahora.slice(0, 2).forEach((a, i) => {
            const b = prevPies[i];
            const alto = Math.max(a.y - a.g, b.y - b.g);
            if (alto < 0.012) t.deslizAp_mm.push(Math.hypot(a.x - b.x, a.z - b.z) * 1000);
          });
        }
        t.flexMin = Math.min(t.flexMin ?? 0, H.flex ? H.flex.y : 0);
        t.inclMax = Math.max(t.inclMax ?? 0, Math.abs(H.inclina || 0) * 180 / Math.PI);
        prevPies = ahora;
      }
      r.tramos.push(t);
    }
    // resumen
    const q = (a, k) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(k * s.length))]; };
    const med = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
    r.tramos = r.tramos.map((t) => ({
      teclas: t.teclas, fot: t.fot,
      pieApoyado_mm_por_fot: { media: +med(t.deslizAp_mm).toFixed(2), p90: +q(t.deslizAp_mm, 0.9).toFixed(2), n: t.deslizAp_mm.length },
      v_media: +med(t.realV).toFixed(2), v_max: +Math.max(0, ...t.realV).toFixed(2),
      correEnSitio: t.correEnSitio, flotaFot: t.flotaFot, flota_mm: +t.flota_mm.toFixed(1),
      salto_m: +t.alturaMax.toFixed(3), giroMax_gs: Math.round(t.yawMax), estados: t.estados,
      flexion_mm: Math.round((t.flexMin || 0) * 1000), inclinaMax_g: +(t.inclMax || 0).toFixed(1),
    }));
    return r;
  }

  const roca = M.choques.circulos.reduce((a, b) => (b.r > a.r ? b : a));   // la roca grande del otero
  const TODAS = {
    // en llano: arrancar, correr, frenar; andar; media vuelta
    llano: () => { arrancar(2, 6, 0); return correr('llano', [
      [0.6, ['KeyW'], { yaw: yawHacia(0, -1) }], [1.2, ['KeyW']], [0.8, []],
      [1.0, ['KeyW', 'ShiftLeft']], [0.6, []],
      [0.8, ['KeyW']], [0.7, ['KeyS']], [0.8, []]]); },
    // contra la roca grande, corriendo de frente durante 1,5 s
    roca: () => { arrancar(roca.x + 2.6, roca.z + 0.3); return correr('roca', [
      [2.0, ['KeyW'], { yaw: yawHacia(roca.x - (roca.x + 2.6), roca.z - (roca.z + 0.3)) }], [0.6, []]]); },
    // bajar el otero corriendo desde lo alto (al lado de la roca) hacia fuera
    bajada: () => { arrancar(-4.6 + 1.2, -4.4 - 1.0); const dx = 1, dz = -0.3;
      return correr('bajada', [[1.6, ['KeyW'], { yaw: yawHacia(dx, dz) }], [0.6, []]]); },
    // subirlo
    subida: () => { arrancar(-4.6 + 3.6, -4.4 - 1.0); return correr('subida', [[1.6, ['KeyW'], { yaw: yawHacia(-1, 0.3) }], [0.5, []]]); },
    // saltos: parado y corriendo
    salto: () => { arrancar(2, 6, 0); return correr('salto', [
      [1.0, [], { saltar: true }], [0.8, ['KeyW'], { yaw: yawHacia(0, -1) }], [1.0, ['KeyW'], { saltar: true }], [0.8, []]]); },
  };
  const out = {};
  for (const k of escenas || Object.keys(TODAS)) out[k] = TODAS[k]();
  D.soltar();
  D.congelar(false);
  return out;
}
