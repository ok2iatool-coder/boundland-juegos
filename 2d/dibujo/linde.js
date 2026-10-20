// El nivel 6, EL LINDE: su terreno es el de casillas de todos los niveles (terreno.js, con la paleta del bosque) y
// lo de mas lo pinta un hilo aparte (linde/obrero.js) con las piezas del concepto (web/concepto_linde.html):
//   fondo    tres capas de parallax, como el fondo de los otros niveles (Fondo), pero del bosque
//   piezas   el decorado del mapa (linde/nivel.js), en el mundo: 'fondo' detras del terreno (arboles con sus
//            ramas, chatarra, aldea, casas...), 'sobre' encima del terreno (el autobus macizo de las afueras) y
//            'delante' delante del 18 (el agua, para que el que cae se hunda en ella)
//   frente   el primer plano en silueta, que corre 1,25 veces el mundo
// Se empieza a pintar al entrar en el nivel 5 (o directamente en el 6): mientras no esta, el nivel espera.
// El hilo NO se cierra: con la tarjeta grafica, las ImageBitmap que pinto viven en su contexto y al cerrarlo se
// quedan vacias (en Chrome sin ventana, que pinta en la CPU, no pasa).

import { TINTA } from './tinta.js';

let obrero = null, hecho = null, progreso = 0, fallo = null;

// La TABLA PODRIDA del Linde (las 'x' del mapa, que pinta main.js cada fotograma y caen al pisarlas): un tablon
// viejo de canto como los del tablado de la aldea (linde/atrezo.js), astillado por un extremo, con su parte
// podrida, dos clavos y una raja. Antes era una caja parda lisa que flotaba. En u del mundo.
export function tablaPodrida(c, x, y, w, h, sem) {
  const r = (k) => (((Math.sin(sem * 12.9898 + k * 78.233) * 43758.5453) % 1) + 1) % 1;
  const borde = () => { c.beginPath(); c.moveTo(x, y + 1); c.lineTo(x + w - 3, y); c.lineTo(x + w, y + h * 0.45); c.lineTo(x + w - 4, y + h * 0.6); c.lineTo(x + w - 1, y + h); c.lineTo(x + 1, y + h); c.closePath(); };
  c.save();
  borde(); c.fillStyle = ['#4a3f2e', '#3d3427', '#57492f'][Math.floor(r(1) * 3)]; c.fill();
  c.save(); c.clip();
  c.fillStyle = 'rgba(15,13,9,.45)'; c.fillRect(x, y + h * 0.65, w, h * 0.35);
  c.fillStyle = 'rgba(192,163,116,.85)'; c.fillRect(x + 1, y, w - 2, 1.4);
  c.strokeStyle = 'rgba(15,13,9,.6)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + 3, y + h * 0.4); c.lineTo(x + w * (0.5 + r(2) * 0.3), y + h * 0.45); c.stroke();
  c.fillStyle = 'rgba(30,26,16,.55)'; c.fillRect(x + w * (0.2 + r(3) * 0.5), y + 1, 3, h - 2);
  c.restore();
  c.fillStyle = '#0f0d09'; c.fillRect(x + 4, y + 3, 1.6, 1.6); c.fillRect(x + w - 8, y + 3, 1.6, 1.6);
  borde(); c.strokeStyle = TINTA; c.lineWidth = 1.4; c.stroke();
  c.restore();
}

export function prepararLinde() {
  if (obrero) return;
  obrero = new Worker(new URL('../linde/obrero.js', import.meta.url), { type: 'module' });
  obrero.onmessage = (e) => {
    const m = e.data;
    if (m.error) { fallo = m.error; console.error('El Linde no se ha podido pintar:', m.error); return; }
    if (m.progreso !== undefined) { progreso = m.progreso; return; }
    if (m.capas) { hecho = m; progreso = 1; console.log(`El Linde pintado en ${m.ms} ms`); }
  };
  obrero.onerror = (e) => { fallo = e.message || 'error en el hilo del Linde'; console.error(fallo); };
  obrero.postMessage('pinta');
}
export const lindeListo = () => !!hecho;
export const lindeProgreso = () => progreso;
export const lindeFallo = () => fallo;

// el fondo, en pantalla (como Fondo.dibujar: el contexto sin transformar). Por encima del mapa no sube.
export const lindeFondo = {
  E: null,
  preparar() {},
  dibujar(ctx, cam, s, trasCapa = null) {
    if (!hecho) return;
    for (const c of hecho.capas) { ctx.drawImage(c.bmp, -cam.x * c.f * s, -Math.max(0, cam.y) * c.fy * s, c.w * s, c.h * s); if (trasCapa) trasCapa(ctx, c.f); }
  },
};

// las piezas de una capa ('fondo', 'sobre' o 'delante'), en el mundo (el contexto ya lleva la camara)
// jugador: el 18 (las piezas con `funde`, como la carroceria del autobus, se desvanecen cuando esta dentro)
export function dibujarLindeDecorado(ctx, cam, capa, jugador = null) {
  if (!hecho) return;
  for (const p of hecho.piezas) {
    if (p.capa !== capa || p.x > cam.x + cam.w || p.x + p.w < cam.x || p.y > cam.y + cam.h || p.y + p.h < cam.y) continue;
    if (p.funde) {
      const jx = jugador ? jugador.x + jugador.w / 2 : cam.x + cam.w / 2, dentro = jx > p.funde[0] - 12 && jx < p.funde[1] + 12;
      p.alfa = (p.alfa ?? 1) + ((dentro ? 0.14 : 1) - (p.alfa ?? 1)) * 0.12;
      ctx.globalAlpha = p.alfa; ctx.drawImage(p.bmp, p.x, p.y, p.w, p.h); ctx.globalAlpha = 1;
      continue;
    }
    ctx.drawImage(p.bmp, p.x, p.y, p.w, p.h);
  }
}

// el primer plano, en pantalla: en horizontal corre 1,25 veces lo que el mundo (centrado en el nivel), en
// vertical va con el mundo
export function dibujarLindeFrente(ctx, cam, s, anchoNivel) {
  if (!hecho) return;
  const fr = hecho.frente, W = ctx.canvas.width, H = ctx.canvas.height, bw = fr.bmp.width, bh = fr.bmp.height;
  const x = cam.x * fr.f - (fr.f - 1) * (anchoNivel - cam.w) / 2;
  ctx.drawImage(fr.bmp, ((x - fr.x) / fr.w) * bw, ((cam.y - fr.y) / fr.h) * bh, (W / s / fr.w) * bw, (H / s / fr.h) * bh, 0, 0, W, H);
}

// mientras se pinta: fondo negro con una barra de tinta
export function dibujarEsperaLinde(ctx, W, H, u, leng) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0a0c'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(240,232,214,.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${22 * u}px Georgia, serif`;
  ctx.fillText(fallo ? (leng === 'es' ? 'No se ha podido pintar el bosque' : 'The forest could not be painted') : leng === 'es' ? 'El bosque se está pintando' : 'Painting the forest', W / 2, H / 2 - 18 * u);
  const bw = 260 * u, bx = W / 2 - bw / 2, by = H / 2 + 12 * u;
  ctx.strokeStyle = 'rgba(240,232,214,.5)'; ctx.lineWidth = Math.max(1, u); ctx.strokeRect(bx, by, bw, 6 * u);
  ctx.fillStyle = 'rgba(240,232,214,.85)'; ctx.fillRect(bx, by, bw * progreso, 6 * u);
}
