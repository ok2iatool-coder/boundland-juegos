// LAS CASETAS DE SEGURIDAD (las dos garitas del muro y la caseta de la plataforma), con el mismo constructor: estructura
// de perfiles con postes en las esquinas, zocalo y remate, CHAPA GRECADA (una costilla cada 11 cm, partida en los huecos),
// ventanas con marco, parteluz, vierteaguas, visera y cristal que deja ver DENTRO (mesa, pantallas, silla, emisora,
// estanteria con archivadores, plano en la pared y el fluorescente, todo en materiales sin sombra que parecen encendidos),
// puerta con marco, bisagras, manilla, ventanuco y chapa de patada, aplique sobre la puerta, cuadro electrico con sus
// tubos, placa con el codigo del puesto, y en la cubierta canalon y bajante, aire acondicionado, antena con parabolica,
// camara en una esquina y, si se pide, foco buscador o rotativo.
//
// Las caras: '+x' es la pared en x = x1 (mira a +x), '-x' en x0, '+z' en z1, '-z' en z0. En cada pared `u` va a lo largo
// (desde x0 o z0) y `v` en altura desde el suelo de la caseta; `d` es lo que sale hacia fuera desde la cara (la pared
// ocupa d de -E a 0).
import * as THREE from 'three';

const E = 0.06;                       // grueso de la pared

// k: lo que presta mundo3d.js (cajaE, barra, cilindro, senal) ; c: { x0, x1, z0, z1, y0, alto, ventanas, puerta, codigo,
// rejas, foco, rotativo, cuadro: lado, camara: [lado, extremo] }
export function caseta(k, c) {
  const { cajaE, barra, cilindro, senal } = k;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const { x0, x1, z0, z1, y0, alto } = c;
  const LX = x1 - x0, LZ = z1 - z0, y1 = y0 + alto;
  const largo = (s) => (s[1] === 'x' ? LZ : LX);
  // una caja en coordenadas de pared
  function bloque(mat, s, u0, u1, v0, v1, d0, d1, tinta = 0) {
    if (u1 - u0 < 1e-4 || v1 - v0 < 1e-4) return;
    const Y0 = y0 + v0, Y1 = y0 + v1;
    if (s === '+x') cajaE(mat, x1 + d0, x1 + d1, Y0, Y1, z0 + u0, z0 + u1, { tinta });
    else if (s === '-x') cajaE(mat, x0 - d1, x0 - d0, Y0, Y1, z0 + u0, z0 + u1, { tinta });
    else if (s === '+z') cajaE(mat, x0 + u0, x0 + u1, Y0, Y1, z1 + d0, z1 + d1, { tinta });
    else cajaE(mat, x0 + u0, x0 + u1, Y0, Y1, z0 - d1, z0 - d0, { tinta });
  }
  // un punto en coordenadas de pared
  function punto(s, u, v, d) {
    if (s === '+x') return V(x1 + d, y0 + v, z0 + u);
    if (s === '-x') return V(x0 - d, y0 + v, z0 + u);
    if (s === '+z') return V(x0 + u, y0 + v, z1 + d);
    return V(x0 + u, y0 + v, z0 - d);
  }
  const normal = (s) => ({ '+x': V(1, 0, 0), '-x': V(-1, 0, 0), '+z': V(0, 0, 1), '-z': V(0, 0, -1) })[s];
  // los huecos de cada pared
  const huecos = { '+x': [], '-x': [], '+z': [], '-z': [] };
  for (const w of c.ventanas || []) huecos[w.lado].push({ ...w, u0: w.u - w.ancho / 2, u1: w.u + w.ancho / 2, v0: w.v0, v1: w.v1, tipo: 'ventana' });
  if (c.puerta) { const p = c.puerta; huecos[p.lado].push({ ...p, u0: p.u - 0.45, u1: p.u + 0.45, v0: 0, v1: 2.0, tipo: 'puerta' }); }
  for (const s of Object.keys(huecos)) huecos[s].sort((a, b) => a.u0 - b.u0);
  // una pared con sus huecos, como cajas (de d0 a d1)
  function pared(mat, s, d0, d1, v0 = 0, v1 = alto, tinta = 0) {
    let u = 0;
    for (const h of huecos[s]) {
      bloque(mat, s, u, h.u0, v0, v1, d0, d1, tinta);
      bloque(mat, s, h.u0, h.u1, v0, Math.min(v1, h.v0), d0, d1, tinta);
      bloque(mat, s, h.u0, h.u1, Math.max(v0, h.v1), v1, d0, d1, tinta);
      u = h.u1;
    }
    bloque(mat, s, u, largo(s), v0, v1, d0, d1, tinta);
  }

  // ---- estructura y piel
  for (const s of ['+x', '-x', '+z', '-z']) {
    pared('chapa', s, -E, 0, 0, alto, 0.012);
    // la chapa grecada: costillas que se parten en los huecos (no en el zocalo ni en el remate)
    for (let u = 0.07; u < largo(s) - 0.05; u += 0.11) {
      let v = 0.16;
      for (const h of huecos[s]) {
        if (u < h.u0 - 0.03 || u > h.u1 + 0.03) continue;
        bloque('chapa', s, u - 0.017, u + 0.017, v, h.v0 - 0.05, 0, 0.022);
        v = Math.max(v, h.v1 + 0.05);
      }
      bloque('chapa', s, u - 0.017, u + 0.017, v, alto - 0.18, 0, 0.022);
    }
    bloque('aceroOsc', s, -0.02, largo(s) + 0.02, 0, 0.15, 0, 0.035, 0.008);                    // zocalo
    bloque('acero', s, -0.03, largo(s) + 0.03, alto - 0.18, alto, 0, 0.04, 0.008);               // remate
    pared('interiorPared', s, -E - 0.012, -E, 0.9, alto - 0.05);                                  // el forro de dentro
    pared('interiorBajo', s, -E - 0.012, -E, 0.03, 0.9);
  }
  for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) cajaE('aceroOsc', x - 0.05, x + 0.05, y0, y1, z - 0.05, z + 0.05, { tinta: 0.01 });
  cajaE('interiorBajo', x0 + E, x1 - E, y0, y0 + 0.03, z0 + E, z1 - E, { tinta: 0 });            // suelo
  cajaE('interiorTecho', x0 + E, x1 - E, y1 - 0.03, y1, z0 + E, z1 - E, { tinta: 0 });           // techo

  // ---- ventanas y puerta
  for (const s of Object.keys(huecos)) for (const h of huecos[s]) {
    if (h.tipo === 'ventana') {
      const w = h.u1 - h.u0;
      for (const [a, b, p, q] of [[h.u0 - 0.05, h.u0, h.v0, h.v1], [h.u1, h.u1 + 0.05, h.v0, h.v1], [h.u0 - 0.05, h.u1 + 0.05, h.v1, h.v1 + 0.05], [h.u0 - 0.05, h.u1 + 0.05, h.v0 - 0.04, h.v0]])
        bloque('aceroOsc', s, a, b, p, q, -E - 0.01, 0.035, 0.006);
      const partes = w > 1.4 ? 3 : w > 0.8 ? 2 : 1;
      for (let i = 1; i < partes; i++) { const u = h.u0 + w * i / partes; bloque('aceroOsc', s, u - 0.022, u + 0.022, h.v0, h.v1, -E, 0.02, 0.004); }
      bloque('aceroOsc', s, h.u0, h.u1, (h.v0 + h.v1) / 2 - 0.015, (h.v0 + h.v1) / 2 + 0.015, -E, 0.012, 0);   // travesano
      bloque('vidrio', s, h.u0, h.u1, h.v0, h.v1, -E * 0.55, -E * 0.45);
      bloque('acero', s, h.u0 - 0.09, h.u1 + 0.09, h.v0 - 0.08, h.v0 - 0.04, 0, 0.09, 0.006);              // vierteaguas
      if (h.visera !== false) {
        bloque('aceroOsc', s, h.u0 - 0.12, h.u1 + 0.12, h.v1 + 0.12, h.v1 + 0.15, 0, 0.32, 0.006);
        for (const u of [h.u0 - 0.06, h.u1 + 0.06]) barra('aceroOsc', punto(s, u, h.v1 + 0.12, 0.3), punto(s, u, h.v1 - 0.12, 0.01), 0.02, { tinta: 0 });
      }
      if (c.rejas) {
        for (let u = h.u0 + 0.08; u < h.u1 - 0.04; u += 0.11) cilindro('aceroOsc', punto(s, u, h.v0, 0.05), punto(s, u, h.v1, 0.05), 0.009, 5, 0);
        for (const v of [h.v0 + 0.06, h.v1 - 0.06]) bloque('aceroOsc', s, h.u0, h.u1, v - 0.015, v + 0.015, 0.04, 0.062, 0.003);
      }
    } else {
      for (const [a, b, p, q] of [[h.u0 - 0.07, h.u0, 0, h.v1], [h.u1, h.u1 + 0.07, 0, h.v1], [h.u0 - 0.07, h.u1 + 0.07, h.v1, h.v1 + 0.07]])
        bloque('aceroOsc', s, a, b, p, q, -E - 0.01, 0.04, 0.007);
      bloque('puerta', s, h.u0 + 0.005, h.u1 - 0.005, 0.005, h.v1 - 0.005, -0.045, -0.012, 0.004);           // la hoja
      for (const [a, b, p, q] of [[0.1, 0.8, 0.12, 0.16], [0.1, 0.8, 1.05, 1.09]]) bloque('aceroOsc', s, h.u0 + a, h.u0 + b, p, q, -0.012, -0.004, 0);   // refuerzos
      bloque('vidrio', s, h.u0 + 0.3, h.u1 - 0.3, 1.35, 1.75, -0.012, -0.006);                            // ventanuco
      bloque('aceroOsc', s, h.u0 + 0.26, h.u1 - 0.26, 1.31, 1.35, -0.012, -0.002, 0);
      bloque('aceroOsc', s, h.u0 + 0.26, h.u1 - 0.26, 1.75, 1.79, -0.012, -0.002, 0);
      bloque('acero', s, h.u0 + 0.02, h.u1 - 0.02, 0.02, 0.28, -0.012, -0.004, 0);                          // chapa de patada
      const um = h.mano === 'izq' ? h.u0 + 0.1 : h.u1 - 0.1, uh = h.mano === 'izq' ? h.u1 - 0.015 : h.u0 + 0.015;
      bloque('acero', s, um - 0.03, um + 0.03, 0.92, 1.12, -0.012, 0.0, 0);                                // escudo
      barra('acero', punto(s, um, 1.05, 0.005), punto(s, um + (h.mano === 'izq' ? 0.11 : -0.11), 1.05, 0.04), 0.022, { tinta: 0 });   // manilla
      for (const v of [0.25, 1.0, 1.75]) bloque('aceroOsc', s, uh - 0.02, uh + 0.02, v, v + 0.12, -0.012, 0.012, 0);   // bisagras
      // el aplique sobre la puerta, encendido
      bloque('aceroOsc', s, h.u - 0.11, h.u + 0.11, h.v1 + 0.16, h.v1 + 0.32, 0, 0.1, 0.006);
      bloque('ambar', s, h.u - 0.09, h.u + 0.09, h.v1 + 0.14, h.v1 + 0.16, 0.012, 0.09, 0);
      const pl = c.placaEn;
      if (c.codigo != null) senal(c.codigo, pl ? punto(pl[0], pl[1], pl[2], 0.026) : punto(s, h.u + 0.34, h.v1 + 0.24, 0.026), normal(pl ? pl[0] : s), 0.2, 0.2);
    }
  }

  // ---- dentro: la mesa bajo la ventana grande, pantallas, silla, emisora, estanteria, plano, fluorescente
  const vg = (c.ventanas || []).reduce((a, b) => (!a || b.ancho > a.ancho ? b : a), null);
  if (vg) {
    const s = vg.lado;
    bloque('mueble', s, vg.u - vg.ancho / 2, vg.u + vg.ancho / 2, 0.72, 0.76, -E - 0.6, -E - 0.012);           // tablero
    for (const u of [vg.u - vg.ancho / 2 + 0.05, vg.u + vg.ancho / 2 - 0.05]) bloque('mueble', s, u - 0.03, u + 0.03, 0, 0.72, -E - 0.58, -E - 0.5);
    for (const [du, ancho] of [[-0.32, 0.42], [0.18, 0.38]]) {                                                  // pantallas
      bloque('mueble', s, vg.u + du - ancho / 2, vg.u + du + ancho / 2, 0.8, 1.1, -E - 0.5, -E - 0.42);
      bloque('pantalla', s, vg.u + du - ancho / 2 + 0.025, vg.u + du + ancho / 2 - 0.025, 0.83, 1.07, -E - 0.52, -E - 0.5);
      bloque('mueble', s, vg.u + du - 0.03, vg.u + du + 0.03, 0.76, 0.8, -E - 0.48, -E - 0.44);
    }
    bloque('mueble', s, vg.u + 0.45, vg.u + 0.72, 0.76, 0.88, -E - 0.35, -E - 0.1);                             // emisora
    bloque('ambar', s, vg.u + 0.48, vg.u + 0.52, 0.82, 0.85, -E - 0.36, -E - 0.35);
    // la silla
    const cs = punto(s, vg.u - 0.1, 0, -E - 0.95), n = normal(s);
    cajaE('mueble', cs.x - 0.22, cs.x + 0.22, y0 + 0.44, y0 + 0.5, cs.z - 0.22, cs.z + 0.22, { tinta: 0 });
    const re = cs.clone().addScaledVector(n, -0.22);
    cajaE('mueble', re.x - (n.x ? 0.03 : 0.2), re.x + (n.x ? 0.03 : 0.2), y0 + 0.5, y0 + 0.95, re.z - (n.z ? 0.03 : 0.2), re.z + (n.z ? 0.03 : 0.2), { tinta: 0 });
    cajaE('mueble', cs.x - 0.025, cs.x + 0.025, y0, y0 + 0.44, cs.z - 0.025, cs.z + 0.025, { tinta: 0 });
    // estanteria con archivadores y plano en la pared de enfrente
    const op = { '+x': '-x', '-x': '+x', '+z': '-z', '-z': '+z' }[s], uo = largo(op) / 2;
    bloque('mueble', op, uo - 0.5, uo + 0.5, 1.45, 1.48, -E - 0.3, -E - 0.012);
    bloque('mueble', op, uo - 0.5, uo + 0.5, 1.05, 1.08, -E - 0.3, -E - 0.012);
    const tonos = ['mueble', 'interiorBajo', 'pantallaApagada'];
    for (let i = 0; i < 7; i++) bloque(tonos[i % 3], op, uo - 0.46 + i * 0.075, uo - 0.4 + i * 0.075, 1.08, 1.38 - (i % 2) * 0.04, -E - 0.26, -E - 0.04);
    bloque('plano', op, uo - 0.42, uo + 0.42, 1.6, 2.1, -E - 0.02, -E - 0.012);
    // el fluorescente
    cajaE('ambar', (x0 + x1) / 2 - (LX > LZ ? 0.45 : 0.06), (x0 + x1) / 2 + (LX > LZ ? 0.45 : 0.06), y1 - 0.06, y1 - 0.03, (z0 + z1) / 2 - (LX > LZ ? 0.06 : 0.45), (z0 + z1) / 2 + (LX > LZ ? 0.06 : 0.45), { tinta: 0 });
  }

  // ---- la cubierta: forjado que vuela, peto, canalon con su bajante y lo que va encima
  const vu = 0.14;
  cajaE('aceroOsc', x0 - vu, x1 + vu, y1, y1 + 0.1, z0 - vu, z1 + vu, { tinta: 0.014 });
  for (const [a, b, p, q] of [[x0 - vu, x1 + vu, z0 - vu, z0 - vu + 0.05], [x0 - vu, x1 + vu, z1 + vu - 0.05, z1 + vu], [x0 - vu, x0 - vu + 0.05, z0 - vu, z1 + vu], [x1 + vu - 0.05, x1 + vu, z0 - vu, z1 + vu]])
    cajaE('acero', a, b, y1 + 0.1, y1 + 0.17, p, q, { tinta: 0.005 });
  const sc = c.canalon || '+z';
  bloque('aceroOsc', sc, -vu, largo(sc) + vu, alto + 0.0, alto + 0.08, vu, vu + 0.09, 0.005);
  const ub = largo(sc) + vu - 0.06;
  cilindro('aceroOsc', punto(sc, ub, alto, vu + 0.045), punto(sc, ub, 0.25, vu + 0.045), 0.035, 8, 0.005);
  cilindro('aceroOsc', punto(sc, ub, 0.25, vu + 0.045), punto(sc, ub, 0.08, vu + 0.2), 0.035, 8, 0.005);
  for (const v of [0.6, 1.4, 2.0]) if (v < alto) bloque('acero', sc, ub - 0.05, ub + 0.05, v, v + 0.04, 0, vu + 0.08, 0);
  // aire acondicionado
  const ac = c.aire || [x0 + 0.55, z1 - 0.45];
  cajaE('acero', ac[0] - 0.38, ac[0] + 0.38, y1 + 0.1, y1 + 0.52, ac[1] - 0.28, ac[1] + 0.28, { tinta: 0.01 });
  cilindro('aceroOsc', V(ac[0], y1 + 0.52, ac[1]), V(ac[0], y1 + 0.54, ac[1]), 0.22, 14, 0.006);
  cilindro('negro', V(ac[0], y1 + 0.54, ac[1]), V(ac[0], y1 + 0.545, ac[1]), 0.18, 14, 0);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; barra('acero', V(ac[0] - Math.cos(a) * 0.2, y1 + 0.548, ac[1] - Math.sin(a) * 0.2), V(ac[0] + Math.cos(a) * 0.2, y1 + 0.548, ac[1] + Math.sin(a) * 0.2), 0.012, { tinta: 0 }); }
  for (let i = 0; i < 6; i++) cajaE('aceroOsc', ac[0] - 0.38, ac[0] - 0.36, y1 + 0.16 + i * 0.055, y1 + 0.19 + i * 0.055, ac[1] - 0.25, ac[1] + 0.25, { tinta: 0 });
  cilindro('acero', V(ac[0] + 0.3, y1 + 0.2, ac[1] - 0.28), V(ac[0] + 0.3, y1 + 0.1, ac[1] - 0.28), 0.02, 6, 0);
  // antena con su parabolica
  if (c.antena !== false) {
    const an = c.antenaEn || [x1 - 0.3, z0 + 0.3];
    cilindro('aceroOsc', V(an[0], y1 + 0.1, an[1]), V(an[0], y1 + 2.6, an[1]), 0.03, 8, 0.006);
    for (const h of [1.6, 2.2]) barra('acero', V(an[0], y1 + h, an[1] - 0.35), V(an[0], y1 + h, an[1] + 0.35), 0.018, { tinta: 0.003 });
    for (const h of [1.6, 2.2]) for (const d of [-0.35, 0.35]) barra('acero', V(an[0], y1 + h, an[1] + d), V(an[0], y1 + h - 0.3, an[1] + d), 0.01, { tinta: 0 });
    cilindro('acero', V(an[0], y1 + 2.6, an[1]), V(an[0], y1 + 3.5, an[1]), 0.008, 4, 0);
    const pd = V(an[0] - 0.05, y1 + 1.05, an[1] + 0.05), pd2 = pd.clone().add(V(-0.04, 0.03, 0.06));
    cilindro('acero', pd, pd2, 0.24, 14, 0.006);                                          // el plato
    barra('aceroOsc', pd2, pd2.clone().add(V(-0.18, 0.08, 0.26)), 0.015, { tinta: 0 });   // el brazo del LNB
    barra('aceroOsc', V(an[0], y1 + 1.0, an[1]), pd, 0.03, { tinta: 0 });
    for (let h = 0.3; h < 2.4; h += 0.5) barra('negro', V(an[0] + 0.04, y1 + h, an[1]), V(an[0] + 0.04, y1 + h + 0.5, an[1]), 0.012, { tinta: 0 });   // el cable
  }
  // la camara en una esquina, bajo el alero, mirando hacia fuera
  if (c.camara) {
    const [s, extremo] = c.camara, u = extremo ? largo(s) - 0.05 : 0.05, n = normal(s);
    const a = punto(s, u, alto - 0.25, 0.04), b = punto(s, u, alto - 0.25, 0.35);
    barra('aceroOsc', a, b, 0.035, { tinta: 0.004 });
    const ojo = b.clone().addScaledVector(n, 0.05).add(V(0, -0.08, 0)), mira = ojo.clone().addScaledVector(n, 0.32).add(V(0, -0.14, 0));
    barra('acero', ojo, mira, 0.1, { tinta: 0.008 });
    barra('aceroOsc', ojo.clone().add(V(0, 0.07, 0)), mira.clone().addScaledVector(n, 0.05).add(V(0, 0.07, 0)), 0.13, { tinta: 0.005 });
    cilindro('negro', mira, mira.clone().addScaledVector(mira.clone().sub(ojo).normalize(), 0.012), 0.035, 10, 0);
  }
  // el foco buscador (garitas) o el rotativo (caseta)
  if (c.foco) {
    const [fx, fz, dx, dz] = c.foco;
    cilindro('aceroOsc', V(fx, y1 + 0.1, fz), V(fx, y1 + 0.55, fz), 0.05, 8, 0.006);
    barra('aceroOsc', V(fx - dz * 0.2, y1 + 0.55, fz + dx * 0.2), V(fx + dz * 0.2, y1 + 0.55, fz - dx * 0.2), 0.04, { tinta: 0.004 });
    const p = V(fx, y1 + 0.66, fz), q = p.clone().add(V(dx * 0.32, -0.08, dz * 0.32));
    cilindro('aceroOsc', p.clone().add(V(-dx * 0.08, 0.02, -dz * 0.08)), q, 0.16, 14, 0.008);
    cilindro('focoLuz', q, q.clone().add(V(dx * 0.012, -0.003, dz * 0.012)), 0.14, 14, 0);
    for (let i = 0; i < 4; i++) cilindro('aceroOsc', p.clone().add(V(-dx * 0.02 * i, 0.14, -dz * 0.02 * i)), p.clone().add(V(-dx * 0.02 * i, 0.19, -dz * 0.02 * i)), 0.012, 4, 0);
  }
  if (c.rotativo) {
    const [rx, rz] = c.rotativo;
    cilindro('aceroOsc', V(rx, y1 + 0.1, rz), V(rx, y1 + 0.16, rz), 0.09, 10, 0.005);
    cilindro('ambar', V(rx, y1 + 0.16, rz), V(rx, y1 + 0.3, rz), 0.065, 10, 0.004);
  }
  // el cuadro electrico en una pared, con su placa de peligro y los tubos al suelo y a la cubierta
  if (c.cuadro) {
    const [s, u] = c.cuadro;
    bloque('aceroOsc', s, u - 0.22, u + 0.22, 0.75, 1.45, 0, 0.18, 0.01);
    bloque('negro', s, u - 0.005, u + 0.005, 0.78, 1.42, 0.18, 0.183, 0);
    bloque('acero', s, u + 0.12, u + 0.16, 1.05, 1.15, 0.18, 0.2, 0);
    senal(4, punto(s, u - 0.1, 1.28, 0.185), normal(s), 0.12, 0.12);
    for (const du of [-0.12, 0, 0.12]) cilindro('aceroOsc', punto(s, u + du, 0.75, 0.08), punto(s, u + du, 0.0, 0.08), 0.022, 6, 0.004);
    cilindro('aceroOsc', punto(s, u - 0.15, 1.45, 0.07), punto(s, u - 0.15, alto - 0.02, 0.07), 0.028, 6, 0.004);
    for (let v = 1.7; v < alto - 0.1; v += 0.4) bloque('acero', s, u - 0.19, u - 0.11, v, v + 0.03, 0, 0.11, 0);
  }
}
