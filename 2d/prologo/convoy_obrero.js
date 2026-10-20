// Hilo aparte para sintetizar el sonido del convoy (~0,8 s de calculo) y el banco de golpes, voces y ecos del prologo
// (sonidos_banco.js, ~0,5 s): asi no da un tiron al empezar el prologo.
import { tanque, convoy } from './tanque_sintesis.js';
import { banco } from './sonidos_banco.js';

self.onmessage = (e) => {
  const sr = e.data.sr, tq = tanque(6, sr), cv = convoy(6, sr), b = banco(sr);
  const pasar = [tq.buffer, cv.buffer];
  const recoger = (v) => { if (Array.isArray(v)) v.forEach(recoger); else if (v instanceof Float32Array) pasar.push(v.buffer); else { if (v.l.length) pasar.push(v.l.buffer); if (v.r.length) pasar.push(v.r.buffer); } };
  Object.values(b).forEach(recoger);
  self.postMessage({ sr, tanque: tq, convoy: cv, banco: b }, pasar);
};
