// LAS LUCES DE EL LINDE para el mapa de luz del juego (dibujo/luz.js), como las lamparas de los niveles de antes:
// la zona tiene penumbra (`oscuro` en dibujo/paletas.js) y la escena se enciende donde hay luz. Salen de las piezas
// del mapa (linde/nivel.js), en u del juego (y hacia abajo):
//   claros del dosel     soles altos y tenues cada ~17 m: la luz que baja entre las copas
//   cabana               la puerta abierta y el farol del poste (la cabana 3D, linde/casa3d.js), que tiemblan
//   granja, casas        sus ventanas encendidas
//   capsulas             la ventana de cada capsula de la aldea
//   setas                el arbol de las setas brilla al pie (crema verdoso)
//   cascada, autobus     el agua que recoge luz y la trampilla abierta del techo del autobus
import { T } from '../sim/constantes.js';
import { piezasDelLinde } from './nivel.js';

const CALIDA = '#ffc878', DIA = '#fff0c8';

export function lucesLinde(E) {
  const L = [], P = piezasDelLinde(E.nivel).piezas, suelo = (p) => (p.j1 + 1) * T;
  const de = (n) => P.filter((p) => p.pieza === n);
  const tiembla = (k, a = 0.08) => (t) => 1 - a + a * Math.sin(t * 7.3 + k) * Math.sin(t * 2.9 + k * 1.7);
  // claros del dosel: soles anchos colgados de lo alto, conos que bajan (no en el tunel del arbol colosal)
  for (let x = 6 * T; x < E.m.ancho - 4 * T; x += 17 * 64) L.push({ x, y: 1 * T, r: 430, color: DIA, cono: true, fuerza: () => 0.26 });
  for (const p of de('cabana')) {
    const X = (p.i0 + 0.5) * T, y = suelo(p);
    // (de modelo/cabana3d.json: puerta, ventana redonda y farol, a la escala de la casa 3D, 79 u por metro del modelo)
    L.push({ x: X - 65, y: y - 69, r: 230, color: CALIDA, fuerza: (t) => 0.85 * tiembla(1)(t) });
    L.push({ x: X + 15, y: y - 78, r: 150, color: CALIDA, fuerza: () => 0.5 });
    L.push({ x: X - 187, y: y - 83, r: 150, color: CALIDA, fuerza: (t) => 0.6 * tiembla(3, 0.12)(t) });
  }
  for (const p of de('granja')) L.push({ x: (p.i0 + 0.5) * T + 30, y: suelo(p) - 80, r: 230, color: CALIDA, fuerza: () => 0.62 });
  for (const p of de('casa')) if (p.i0 % 2 === 0) L.push({ x: (p.i0 + 0.5) * T + 20, y: 19 * T - 90, r: 210, color: CALIDA, fuerza: () => 0.5 });
  for (const p of de('plataforma')) L.push({ x: ((p.i0 + p.i1 + 1) / 2) * T, y: p.j0 * T - 60, r: 190, color: CALIDA, fuerza: (t) => 0.5 * tiembla(p.i0, 0.06)(t) });
  for (const p of de('arbol')) if (p.setas) for (const dx of [-70, 80]) L.push({ x: (p.i0 + 0.5) * T + dx, y: suelo(p) - 14, r: 150, color: '#d8eab0', fuerza: () => 0.42 });
  // la camara de raices de debajo del arbol colosal: setas que brillan poco (para que se vea en la penumbra)
  for (const p of de('tronco_hueco')) L.push({ x: (p.i0 + p.i1 + 1) / 2 * T, y: (p.j1 + 6) * T, r: 170, color: '#d8eab0', fuerza: () => 0.38 });
  for (const p of de('cascada')) L.push({ x: (p.i0 + 1) * T, y: 18 * T, r: 200, color: '#e8eedc', fuerza: () => 0.3 });
  for (const p of de('autobus')) L.push({ x: ((p.i0 + p.i1 + 1) / 2) * T - 20, y: p.j0 * T + 20, r: 190, color: DIA, cono: true, fuerza: () => 0.45 });
  return L;
}
