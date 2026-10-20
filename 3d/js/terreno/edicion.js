// LO EDITADO A MANO en el mapa de terreno (el editor, tecla E): que se ha subido o bajado, que se ha pintado y que
// rocas se han quitado o puesto. Se guarda en web/datos/terreno_edicion.json (PUT /__edicion/terreno de serve.mjs) y se
// lee AL CARGAR este modulo (await de primer nivel): mundo.js lo importa, asi que el suelo, las rocas y la hierba ya se
// construyen con lo editado. Sin fichero (o en Node, en las pruebas) el terreno es el de relieve.js tal cual.
//
// El fichero solo guarda las DIFERENCIAS con el relieve original, en binario dentro del JSON (base64):
//   alturas: indices de vertice (Uint32) + cuanto se subio o bajo cada uno (Float32)
//   pintura: indices de celda (Uint32) + el material (Uint8, ver MATERIALES en relieve.js)
//   quitadas: numeros de las rocas originales quitadas; nuevas: [x, z, r, alto, giro, tipo, inclinaX, inclinaZ]
//   modelos: { archivo, x, z, y, giro, escala, solido } (el .glb esta en web/modelos/; modelos.js)
import { H, BASE, PINTURA, N, EXT, recalcularCurva } from './relieve.js';
import { ROCAS, N_ROCAS_ORIG, activarRoca, nuevaRoca, asentar, recalcularDistRoca } from './sitios.js';
import { MODELOS, nuevoModelo } from './modelos.js';

const URL_DATOS = new URL('../../datos/terreno_edicion.json', import.meta.url);
const URL_GUARDAR = '/__edicion/terreno';

function aB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function deB64(s) {
  const b = atob(s), u8 = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i);
  return u8;
}
const bytes = (ta) => new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength);

// lo que hay ahora, como el fichero
export function serializar() {
  const ai = [], ad = [];
  for (let k = 0; k < H.length; k++) { const d = H[k] - BASE[k]; if (Math.abs(d) > 1e-4) { ai.push(k); ad.push(d); } }
  const pi = [], pv = [];
  for (let c = 0; c < PINTURA.length; c++) if (PINTURA[c]) { pi.push(c); pv.push(PINTURA[c]); }
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return {
    version: 1, mapa: 'terreno', fecha: new Date().toISOString(),
    resumen: { vertices: ai.length, celdasPintadas: pi.length, modelos: MODELOS.filter((m) => !m.quitado).length },
    alturas: { i: aB64(bytes(new Uint32Array(ai))), d: aB64(bytes(new Float32Array(ad))) },
    pintura: { i: aB64(bytes(new Uint32Array(pi))), v: aB64(new Uint8Array(pv)) },
    quitadas: ROCAS.slice(0, N_ROCAS_ORIG).filter((o) => o.quitada).map((o) => o.id),
    nuevas: ROCAS.slice(N_ROCAS_ORIG).filter((o) => !o.quitada).map((o) => [o.x, o.z, o.r, o.alto, o.giro, o.tipo, o.inclina[0], o.inclina[1]].map(r3)),
    modelos: MODELOS.filter((m) => !m.quitado).map((m) => ({ archivo: m.archivo, x: r3(m.x), z: r3(m.z), y: r3(m.y), giro: r3(m.giro), escala: Math.round(m.escala * 1e4) / 1e4, solido: m.solido })),
  };
}

// poner el terreno como dice `d` (sin d: el original). Devuelve cuantas cosas cambio
export function aplicar(d = {}) {
  H.set(BASE);
  PINTURA.fill(0);
  const f = N + 1;
  let vertices = 0, celdas = 0;
  if (d.alturas && d.alturas.i) {
    const idx = new Uint32Array(deB64(d.alturas.i).buffer), del = new Float32Array(deB64(d.alturas.d).buffer);
    for (let n = 0; n < idx.length; n++) if (idx[n] < f * f) { H[idx[n]] = BASE[idx[n]] + del[n]; vertices++; }
  }
  if (d.pintura && d.pintura.i) {
    const idx = new Uint32Array(deB64(d.pintura.i).buffer), val = deB64(d.pintura.v);
    for (let n = 0; n < idx.length; n++) if (idx[n] < N * N) { PINTURA[idx[n]] = val[n]; celdas++; }
  }
  recalcularCurva(0, 0, N, N);
  // las rocas: las originales activas salvo las quitadas; las del editor de antes, fuera; las del fichero, nuevas
  const quitadas = new Set(d.quitadas || []);
  ROCAS.forEach((o, i) => activarRoca(o, i < N_ROCAS_ORIG && !quitadas.has(i)));
  const nuevas = (d.nuevas || []).map(([x, z, r, alto, giro, tipo, i0, i1]) => nuevaRoca({ x, z, r, alto, giro, tipo, inclina: [i0, i1] }));
  for (const o of ROCAS) if (!o.quitada) asentar(o);
  recalcularDistRoca(-EXT, -EXT, EXT, EXT);
  // los modelos: los de antes fuera, los del fichero dentro (modelos.js los carga y los pone al sincronizar)
  MODELOS.length = 0;
  for (const m of d.modelos || []) if (m.archivo) nuevoModelo(m);
  return { vertices, celdas, quitadas: quitadas.size, nuevas: nuevas.length, modelos: MODELOS.length };
}

export async function guardar() {
  const datos = serializar();
  const r = await fetch(URL_GUARDAR, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(datos) });
  if (!r.ok) throw new Error(`el servidor dijo ${r.status}: ${await r.text()}`);
  return { ...datos.resumen, quitadas: datos.quitadas.length, nuevas: datos.nuevas.length, ...(await r.json()) };
}

// al cargar: lo guardado, si lo hay
export let cargado = null;
if (typeof window !== 'undefined') {
  try {
    const r = await fetch(URL_DATOS, { cache: 'no-store' });
    if (r.ok && r.status !== 204) cargado = aplicar(await r.json());      // 204: aun no se ha guardado nada
  } catch (e) {
    console.warn('No se pudo leer lo editado del terreno:', e);
  }
}
