// LA CIUDAD (niveles 7 y 8): su terreno es el de casillas de todos los niveles (terreno.js) y lo demas lo pinta un
// hilo aparte (ciudad/obrero.js) con las piezas de la imagen de referencia, como El Linde (dibujo/linde.js):
//   fondo    cinco capas de parallax (como Fondo): cielo, ciudad gotica, paso elevado, plano medio y armazones
//   piezas   lo del mapa: 'fondo' detras del terreno (edificios de las salas, pilas, farolas, semaforos, coches,
//            barreras) y 'sobre' encima (la fachada del bloque, el tablero del paso elevado)
//   frente   el primer plano en silueta, que corre 1,25 veces el mundo
// Todo esta en el MUNDO COMUN de los dos niveles (ciudad/nivel.js): en el nivel 8 se pinta desplazado (E.comun).
// Se empieza a pintar al entrar en el nivel 6 (o directamente en el 7 o el 8): mientras no esta, el nivel espera.
// El hilo NO se cierra: con la tarjeta grafica, las ImageBitmap que pinto viven en su contexto.
import { desplazamiento } from '../ciudad/nivel.js';

let obrero = null, hecho = null, progreso = 0, fallo = null;

export function prepararCiudad() {
  if (obrero) return;
  obrero = new Worker(new URL('../ciudad/obrero.js', import.meta.url), { type: 'module' });
  obrero.onmessage = (e) => {
    const m = e.data;
    if (m.error) { fallo = m.error; console.error('La ciudad no se ha podido pintar:', m.error); return; }
    if (m.progreso !== undefined) { progreso = m.progreso; return; }
    if (m.capas) { hecho = m; progreso = 1; console.log(`La ciudad pintada en ${m.ms} ms`); }
  };
  obrero.onerror = (e) => { fallo = e.message || 'error en el hilo de la ciudad'; console.error(fallo); };
  obrero.postMessage('pinta');
}
export const ciudadListo = () => !!hecho;
// las capas del fondo (el prologo las usa de mascara: lo que tapa al gigante; prologo/prologo.js)
export const capasCiudad = () => (hecho ? hecho.capas : []);
export const ciudadFallo = () => fallo;

// el fondo, en pantalla (como Fondo.dibujar, con la camara ya en el mundo comun). Por encima del mapa no sube.
export const ciudadFondo = {
  E: null,
  preparar() {},
  dibujar(ctx, cam, s, trasCapa = null) {
    if (!hecho) return;
    for (const c of hecho.capas) { ctx.drawImage(c.bmp, -cam.x * c.f * s, -Math.max(0, cam.y) * c.fy * s, c.w * s, c.h * s); if (trasCapa) trasCapa(ctx, c.f); }
  },
};

// las lamparas de la ciudad en el mundo del nivel: lo que el hilo pinto encendido (orbes de la Podredumbre que
// laten despacio, ventanas). La zona esta en penumbra como los niveles de antes (dibujo/paletas.js)
export function lucesCiudad(E) {
  if (!hecho || !hecho.luces) return [];
  const { ox, oy } = desplazamiento(E);
  return hecho.luces.map(([x, y, r, color, f], k) => ({ x: x - ox, y: y - oy, r: Math.max(70, r), color, fuerza: (t) => f * (0.9 + 0.1 * Math.sin(t * 1.3 + k * 2.1)) }));
}

// las cajas de los edificios pintados (en el mundo del nivel, sin el margen de su lienzo): el prologo hace saltar
// trozos de sus fachadas con cada pisada del gigante (prologo/prologo.js, cascotes)
const MARGEN = { sala: [58, 22], bloque_fondo: [73, 22], bloque: [11, 15] };
export function edificiosCiudad(E) {
  if (!hecho) return [];
  const { ox, oy } = desplazamiento(E);
  return hecho.piezas.filter((p) => MARGEN[p.pieza]).map((p) => {
    const [mx, my] = MARGEN[p.pieza];
    return { x0: p.x - ox + mx, x1: p.x + p.w - ox - mx, y0: p.y - oy + my, y1: p.y + p.h - oy, pieza: p.pieza };
  });
}

// las piezas de una capa ('fondo' o 'sobre'), en el mundo del nivel (el contexto ya lleva su camara)
export function dibujarCiudadDecorado(ctx, cam, capa, E) {
  if (!hecho) return;
  const { ox, oy } = desplazamiento(E), x0 = cam.x + ox, y0 = cam.y + oy;
  ctx.save(); ctx.translate(-ox, -oy);
  for (const p of hecho.piezas) {
    if (p.capa !== capa || p.x > x0 + cam.w || p.x + p.w < x0 || p.y > y0 + cam.h || p.y + p.h < y0) continue;
    ctx.drawImage(p.bmp, p.x, p.y, p.w, p.h);
  }
  ctx.restore();
}

// el primer plano, en pantalla: en horizontal corre 1,25 veces lo que el mundo comun (centrado en el), en vertical
// va con el mundo
export function dibujarCiudadFrente(ctx, cam, s, E) {
  if (!hecho) return;
  const { ox, oy } = desplazamiento(E), ancho = E.comun ? E.comun.ancho : E.m.ancho;
  const fr = hecho.frente, W = ctx.canvas.width, H = ctx.canvas.height, bw = fr.bmp.width, bh = fr.bmp.height;
  const x = (cam.x + ox) * fr.f - (fr.f - 1) * (ancho - cam.w) / 2;
  ctx.drawImage(fr.bmp, ((x - fr.x) / fr.w) * bw, ((cam.y + oy - fr.y) / fr.h) * bh, (W / s / fr.w) * bw, (H / s / fr.h) * bh, 0, 0, W, H);
}

// mientras se pinta: fondo negro con una barra de tinta
export function dibujarEsperaCiudad(ctx, W, H, u, leng) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0a0c'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(240,232,214,.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${22 * u}px Georgia, serif`;
  ctx.fillText(fallo ? (leng === 'es' ? 'No se ha podido pintar la ciudad' : 'The city could not be painted') : leng === 'es' ? 'La ciudad se está pintando' : 'Painting the city', W / 2, H / 2 - 18 * u);
  const bw = 260 * u, bx = W / 2 - bw / 2, by = H / 2 + 12 * u;
  ctx.strokeStyle = 'rgba(240,232,214,.5)'; ctx.lineWidth = Math.max(1, u); ctx.strokeRect(bx, by, bw, 6 * u);
  ctx.fillStyle = 'rgba(240,232,214,.85)'; ctx.fillRect(bx, by, bw * progreso, 6 * u);
}
