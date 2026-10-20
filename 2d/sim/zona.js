// Lo propio de la zona conectada del laboratorio (sim/zona_lab.js), puro y sin DOM:
//  - FRASCOS DE RESERVA (el banco): E para meterse dentro; guarda, llena la ampolla y devuelve las motas.
//  - LA LUZ DEL 18 AL MORIR: se queda donde cayo con la esencia que llevaba. Mientras no se recoge, el 18 alumbra
//    la mitad y no guarda mas de 3 de esencia; si muere otra vez antes, la de antes se pierde.
//  - MOTAS DE ESENCIA en los rincones (aun no hay daga ni enemigos: la esencia sale de ahi).
//  - FRAGMENTO DE AMPOLLA (cuatro dan una dosis mas), LA PALANCA que abre la esclusa (el atajo), EL SUELO FALSO
//    de la celda del 17, las anillas que suben a una repisa y las zonas de gravedad cero.
//  - LO VISTO: el mapa a carboncillo solo dibuja las celdas de 2 x 2 casillas que el 18 ha tenido delante, sala
//    a sala (no ve a traves de las paredes). Y el rotulo de cada parte de la zona al entrar en ella.
import { J, T } from './constantes.js';
import { cx, cy, solapan } from './fisica.js';
import { AREAS, ANCHO, ALTO, salaEn } from './zona_lab.js';

export const CELDA = 2;                                   // casillas por celda de lo visto
export const VW = Math.ceil(ANCHO / CELDA), VH = Math.ceil(ALTO / CELDA);
export const MOTA = 2;                                    // esencia por mota
export const TOPE_SIN_LUZ = 3;                            // esencia maxima mientras la luz esta fuera
const VISTA_X = 17, VISTA_Y = 10;                         // media vista, en casillas (la pantalla es 32 x 18)

export const vidaMax = (fragmentos) => J.vida + Math.floor(fragmentos / 4);

// o.zl: lo que se lleva de una partida a la siguiente (al reaparecer o al cargar): banco, luz, fragmentos, visto, esencia
export function montarZona(E, o = {}) {
  const prev = o.zl || {};
  const z = E.zl = {
    banco: prev.banco ?? null,
    eco: prev.eco ? { ...prev.eco } : null,
    fragmentos: prev.fragmentos || 0,
    visto: prev.visto ? Uint8Array.from(prev.visto) : new Uint8Array(VW * VH),
    frascos: [], motas: [], fragmentos_: [], palanca: null, esclusa: null, falsos: [],
    sala: null, area: null, tVisto: 0, t: 0,
  };
  const H = E.hechos;
  for (const e of E.nivel.entidades) {
    const x = e.i * T + T / 2, pie = (e.j + 1) * T;
    switch (e.t) {
      case 'frasco': z.frascos.push({ id: e.id, x, pie }); break;
      case 'mota': { const id = 'mota:' + e.i + ',' + e.j; z.motas.push({ id, x, y: e.j * T + T / 2, cogida: H.has(id), fase: (e.i * 0.37 + e.j * 0.21) % 6.28 }); break; }
      case 'fragmento': { const id = 'fragmento:' + e.i + ',' + e.j; z.fragmentos_.push({ id, x, y: e.j * T + T / 2, cogido: H.has(id) }); break; }
      case 'palanca': z.palanca = { x, pie, tirada: H.has('esclusa') }; break;
      case 'esclusa': {
        const s = { x: e.i * T, y: e.j * T, w: e.w * T, h: e.h * T, activo: !H.has('esclusa'), firme: true, esclusa: true };
        z.esclusa = { s, abre: H.has('esclusa') ? 1 : 0 };
        E.mundo.solidos.push(s);
        break;
      }
      case 'falso': { const id = 'falso:' + e.i + ',' + e.j; z.falsos.push({ id, x: e.i * T, y: e.j * T, w: e.w * T, h: e.h * T, revelado: H.has(id), k: H.has(id) ? 1 : 0 }); break; }
      case 'hab': E.items.push({ tipo: e.h, x, pie, cogido: !!E.hab[e.h] }); break;
      case 'gz': E.zonas.push({ x: e.i * T, y: e.j * T, w: e.w * T, h: e.h * T }); break;
      case 'subir': {
        // una anilla del mapa que, trepada hasta arriba, deja en una repisa (la trampilla del archivo)
        const a = E.anclas.find((q) => q.fija && Math.abs(q.x() - x) < 1 && Math.abs(q.y() - (e.j * T + T / 2)) < 1);
        if (a) { const [ai, aj] = e.a; a.subir = () => ({ x: ai * T + 5, y: aj * T }); }
        break;
      }
    }
  }
  // la ampolla: siete dosis y una mas por cada cuatro fragmentos
  const p = E.p;
  p.vidaMax = vidaMax(z.fragmentos);
  p.vida = Math.min(p.vidaMax, o.vida ?? p.vidaMax);
  p.esencia = Math.min(tope(E), prev.esencia || 0);
  const s = salaEn(Math.floor(cx(p) / T), Math.floor(cy(p) / T));
  z.sala = s ? s.id : null; z.area = s ? s.area : null;
  marcarVisto(E);
  return z;
}

const tope = (E) => (E.zl && E.zl.eco ? TOPE_SIN_LUZ : J.esenciaMax);

// lo que se lleva a la partida siguiente (reaparecer, guardar)
export function estadoZona(E) {
  const z = E.zl;
  return { banco: z.banco, eco: z.eco ? { ...z.eco } : null, fragmentos: z.fragmentos, visto: z.visto, esencia: E.p.esencia };
}

// donde se reaparece: el ultimo frasco en el que descanso (o el frasco roto del principio)
export function lugarBanco(E) {
  const f = E.zl.frascos.find((q) => q.id === E.zl.banco);
  return f ? { x: f.x, pie: f.pie } : E.inicio;
}

// ---------------------------------------------------------------- E: frascos y palanca
export function interactuarZona(E, cerca, ev) {
  const p = E.p, z = E.zl;
  for (const f of z.frascos) if (cerca(f.x, f.pie, 40)) return { tipo: 'frasco', hacer: () => descansar(E, f, ev) };
  const pa = z.palanca;
  if (pa && !pa.tirada && cerca(pa.x, pa.pie, 40)) return {
    tipo: 'palanca', hacer: () => {
      pa.tirada = true; E.hechos.add('esclusa');
      z.esclusa.s.activo = false;
      ev.push({ t: 'palanca', x: pa.x, y: pa.pie });
      ev.push({ t: 'esclusa_abre', x: z.esclusa.s.x + z.esclusa.s.w / 2, y: z.esclusa.s.y + z.esclusa.s.h });
    },
  };
  return null;
}

function descansar(E, f, ev) {
  const p = E.p, z = E.zl;
  E.estado = 'banco'; z.banco = f.id; z.enFrasco = f;
  p.x = f.x - p.w / 2; p.y = f.pie - p.h; p.vx = 0; p.vy = 0;
  p.vida = p.vidaMax; p.cuerda = null; p.trepa = false;
  // al descansar vuelven las motas (como los enemigos en Hollow Knight al sentarse en un banco)
  for (const m of z.motas) if (m.cogida) { m.cogida = false; E.hechos.delete(m.id); }
  ev.push({ t: 'banco', x: f.x, y: f.pie, id: f.id, vida: p.vida });
}

// ---------------------------------------------------------------- antes del paso: dentro del frasco
// devuelve true si se queda con el paso (el 18 descansa)
export function pasoZonaAntes(E, inp, ed, ev, dt) {
  E.zl.t += dt;
  if (E.estado !== 'banco') return false;
  const p = E.p;
  p.vx = 0; p.vy = 0;
  if (p.pose !== 'reposo') { p.pose = 'reposo'; p.tPose = 0; } else p.tPose += dt;
  if (ed.izq || ed.der || ed.salto || ed.accion || ed.arriba || ed.abajo) {
    E.estado = 'jugando'; E.zl.enFrasco = null;
    ev.push({ t: 'banco_sale', x: cx(p), y: p.y + p.h });
  }
  return true;
}

// ---------------------------------------------------------------- despues del paso
export function pasoZonaDespues(E, ev, dt) {
  const p = E.p, z = E.zl;
  // murio en este paso: la luz se queda donde cayo (si fue al cristal o al vacio, en el ultimo suelo firme)
  if (ev.some((e) => e.t === 'muere_18')) {
    const enPeligro = ev.some((e) => e.t === 'peligro');
    const x = enPeligro ? p.seguro.x + p.w / 2 : cx(p), y = enPeligro ? p.seguro.y + p.h / 2 : cy(p);
    if (z.eco) ev.push({ t: 'eco_pierde', x: z.eco.x, y: z.eco.y });
    z.eco = { x, y, esencia: p.esencia };
    p.esencia = 0;
    ev.push({ t: 'eco_deja', x, y });
    return;
  }
  if (p.muerto) return;
  const pc = { x: cx(p), y: cy(p) };
  // la luz perdida: tocarla la devuelve
  if (z.eco && Math.hypot(z.eco.x - pc.x, z.eco.y - pc.y) < 36) {
    p.esencia = Math.min(J.esenciaMax, p.esencia + z.eco.esencia);
    ev.push({ t: 'eco_recoge', x: z.eco.x, y: z.eco.y, esencia: z.eco.esencia });
    z.eco = null;
  }
  for (const m of z.motas) {
    if (m.cogida || Math.hypot(m.x - pc.x, m.y - pc.y) > 30) continue;
    m.cogida = true; E.hechos.add(m.id);
    p.esencia = Math.min(tope(E), p.esencia + MOTA);
    ev.push({ t: 'mota', x: m.x, y: m.y, esencia: p.esencia });
  }
  for (const f of z.fragmentos_) {
    if (f.cogido || Math.hypot(f.x - pc.x, f.y - pc.y) > 32) continue;
    f.cogido = true; E.hechos.add(f.id); z.fragmentos++;
    const antes = p.vidaMax;
    p.vidaMax = vidaMax(z.fragmentos);
    if (p.vidaMax > antes) p.vida = p.vidaMax;
    ev.push({ t: 'fragmento', x: f.x, y: f.y, n: z.fragmentos, dosis: p.vidaMax > antes });
  }
  for (const f of z.falsos) {
    if (!f.revelado && solapan(f, p)) { f.revelado = true; E.hechos.add(f.id); ev.push({ t: 'falso', x: f.x + f.w / 2, y: f.y }); }
    if (f.revelado && f.k < 1) f.k = Math.min(1, f.k + dt * 2.2);
  }
  if (z.esclusa) z.esclusa.abre = z.esclusa.s.activo ? 0 : Math.min(1, z.esclusa.abre + dt / 1.2);
  // lo visto (cada 6 pasos) y el rotulo al entrar en otra parte de la zona
  if ((z.tVisto += dt) > 0.1) { z.tVisto = 0; marcarVisto(E); }
  const s = salaEn(Math.floor(pc.x / T), Math.floor(pc.y / T));
  if (s && s.id !== z.sala) {
    z.sala = s.id;
    if (s.area !== z.area) { z.area = s.area; ev.push({ t: 'area', area: s.area, ...AREAS[s.area] }); }
    ev.push({ t: 'sala', sala: s.id });
  }
}

// marca lo que el 18 tiene delante, sin salirse de su sala (las paredes tapan)
export function marcarVisto(E) {
  const p = E.p, z = E.zl;
  const i0 = Math.floor(cx(p) / T), j0 = Math.floor(cy(p) / T);
  const s = salaEn(i0, j0);
  if (!s) return;
  const a = Math.max(s.x, i0 - VISTA_X), b = Math.min(s.x + s.w - 1, i0 + VISTA_X);
  const c = Math.max(s.y, j0 - VISTA_Y), d = Math.min(s.y + s.h - 1, j0 + VISTA_Y);
  for (let j = Math.floor(c / CELDA); j <= Math.floor(d / CELDA); j++) for (let i = Math.floor(a / CELDA); i <= Math.floor(b / CELDA); i++) z.visto[j * VW + i] = 1;
}

// cuanto de una sala se ha visto (0..1), para el mapa
export function vistoDeSala(z, s) {
  let n = 0, v = 0;
  for (let j = Math.floor(s.y / CELDA); j <= Math.floor((s.y + s.h - 1) / CELDA); j++) for (let i = Math.floor(s.x / CELDA); i <= Math.floor((s.x + s.w - 1) / CELDA); i++) { n++; if (z.visto[j * VW + i]) v++; }
  return n ? v / n : 0;
}
