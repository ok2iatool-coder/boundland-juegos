// Interfaz dentro del mundo (GDD): la ampolla del Proyecto Ceniza con 7 dosis, el papel de Varga con
// su letra y sus dibujos a lapiz, el aviso con una mano dibujada. Todo en pixeles de pantalla.
import { J } from './sim/constantes.js';
import { NOTAS, NIVELES } from './sim/niveles.js';

export const LETRA = '"Ink Free", "Segoe Print", "Bradley Hand", cursive';
export const SERIF = 'Georgia, "Times New Roman", serif';

export const TXT = {
  en: {
    nota: 'Read', daga: 'Take', linea: 'Take', frasco: 'Rest', palanca: 'Pull', hack1: 'Draw', hack2: 'Unlock', hack3: 'Turn the rings', cerrar: 'E / Esc  close',
    pausa: 'PAUSED', seguir: 'Resume', reiniciar: 'Restart from last circle', niveles: 'Levels', salir: 'Title screen',
    habilidad: { gancho: 'CARGO HOOK', daga: 'DAGGER', tele: 'TELEPORT', zorro: 'FOX FORM', doble: 'DOUBLE JUMP', fragmento: 'AMPOULE SHARD' },
    habSub: {
      gancho: 'E near a bolt head · W / S climb · SPACE let go', daga: 'LEFT CLICK / J strike · W / S + strike up / down',
      tele: 'Double tap A or D', zorro: 'F change form · hold strike: Sunikel',
      doble: 'SPACE in the air', fragmento: 'Four of them make one more dose',
    },
  },
  es: {
    nota: 'Leer', daga: 'Coger', linea: 'Coger', frasco: 'Descansar', palanca: 'Tirar', hack1: 'Dibujar', hack2: 'Abrir', hack3: 'Girar los anillos', cerrar: 'E / Esc  cerrar',
    pausa: 'PAUSA', seguir: 'Seguir', reiniciar: 'Volver al último círculo', niveles: 'Niveles', salir: 'Pantalla de título',
    habilidad: { gancho: 'GANCHO DE CARGA', daga: 'DAGA', tele: 'TELETRANSPORTE', zorro: 'FORMA ZORRO', doble: 'DOBLE SALTO', fragmento: 'FRAGMENTO DE AMPOLLA' },
    habSub: {
      gancho: 'E junto a una cabeza de tornillo · W / S trepar · ESPACIO soltar', daga: 'CLIC IZQ. / J golpear · W / S + golpe arriba / abajo',
      tele: 'Doble toque de A o D', zorro: 'F cambiar de forma · mantener golpe: Sunikel',
      doble: 'ESPACIO en el aire', fragmento: 'Cuatro dan una dosis más',
    },
  },
};

// ---------------------------------------------------------------- ampolla
export function ampolla(c, u, vida, t, grieta, zorro, max = J.vida) {
  const x0 = 40 * u, y0 = 34 * u, w = 168 * u, h = 26 * u;
  c.save();
  // cuello y tapon
  c.fillStyle = '#0b0a0c'; c.strokeStyle = 'rgba(235,228,214,.9)'; c.lineWidth = 2 * u;
  c.beginPath(); c.roundRect(x0 - 16 * u, y0 + 7 * u, 16 * u, 12 * u, 3 * u); c.fill(); c.stroke();
  c.fillStyle = '#2b2b30'; c.fillRect(x0 - 26 * u, y0 + 5 * u, 10 * u, 16 * u);
  c.strokeRect(x0 - 26 * u, y0 + 5 * u, 10 * u, 16 * u);
  // cuerpo de cristal
  c.fillStyle = 'rgba(12,12,16,.55)';
  c.beginPath(); c.roundRect(x0, y0, w, h, 13 * u); c.fill();
  const dw = (w - 14 * u) / max;
  for (let k = 0; k < max; k++) {
    const lleno = k < vida;
    const x = x0 + 7 * u + k * dw;
    if (lleno) {
      c.shadowColor = zorro ? 'rgba(200,232,255,.9)' : 'rgba(255,246,228,.9)'; c.shadowBlur = 10 * u;
      const g = c.createLinearGradient(0, y0, 0, y0 + h);
      g.addColorStop(0, zorro ? '#eef7ff' : '#fffaf0'); g.addColorStop(1, zorro ? '#b9dcf6' : '#e9dcc4');
      c.fillStyle = g;
      const ola = Math.sin(t * 3 + k) * 1.2 * u;
      c.beginPath(); c.roundRect(x + 2 * u, y0 + 6 * u + ola, dw - 4 * u, h - 11 * u - ola, 3 * u); c.fill();
    } else {
      c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,.05)';
      c.beginPath(); c.roundRect(x + 2 * u, y0 + 6 * u, dw - 4 * u, h - 11 * u, 3 * u); c.fill();
    }
  }
  c.shadowBlur = 0;
  c.strokeStyle = 'rgba(235,228,214,.92)'; c.lineWidth = 2.2 * u;
  c.beginPath(); c.roundRect(x0, y0, w, h, 13 * u); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2 * u;
  c.beginPath(); c.moveTo(x0 + 14 * u, y0 + 4 * u); c.lineTo(x0 + w - 18 * u, y0 + 4 * u); c.stroke();
  // grietas: una por dosis perdida, y la mas reciente brilla
  const perdidas = max - vida;
  for (let k = 0; k < perdidas; k++) {
    const x = x0 + w - 20 * u - k * dw;
    c.strokeStyle = k === 0 && grieta > 0 ? `rgba(255,255,255,${0.4 + grieta})` : 'rgba(235,228,214,.6)'; c.lineWidth = 1 * u;
    c.beginPath(); c.moveTo(x, y0 + 2 * u); c.lineTo(x - 4 * u, y0 + 10 * u); c.lineTo(x + 2 * u, y0 + 15 * u); c.lineTo(x - 3 * u, y0 + h - 2 * u); c.stroke();
  }
  c.restore();
}

// ---------------------------------------------------------------- fragmentos de ampolla (zona conectada)
// Junto al tapon: cuatro esquirlas en corro; las que lleva, llenas. Cuatro dan una dosis mas.
export function fragmentos(c, u, n, t) {
  const cx = 228 * u, cy = 47 * u;
  c.save();
  for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 2 + k * Math.PI / 2, x = cx + Math.cos(a) * 6 * u, y = cy + Math.sin(a) * 6 * u;
    c.save(); c.translate(x, y); c.rotate(a + Math.PI / 4);
    c.beginPath(); c.moveTo(0, -5 * u); c.lineTo(4 * u, 0); c.lineTo(0, 5 * u); c.lineTo(-3 * u, 0); c.closePath();
    const lleno = k < n % 4;
    if (lleno) { c.shadowColor = 'rgba(255,246,228,.9)'; c.shadowBlur = 6 * u; c.fillStyle = '#fffaf0'; c.fill(); c.shadowBlur = 0; }
    c.strokeStyle = 'rgba(235,228,214,.7)'; c.lineWidth = 1 * u; c.stroke();
    c.restore();
  }
  c.restore();
}

// ---------------------------------------------------------------- esencia (bajo la ampolla)
// Seis gotas: cada acierto llena una (el desvio dos). Con tres se puede curar una dosis manteniendo Q;
// mientras se cura, las tres que se van a gastar laten y se vacian de abajo arriba.
export function esencia(c, u, n, cura, curaT, coste, max, t) {
  const x0 = 46 * u, y0 = 74 * u, paso = 15 * u;
  c.save();
  for (let k = 0; k < max; k++) {
    const x = x0 + k * paso + (k >= coste ? 6 * u : 0), y = y0;
    const llena = k < n;
    const gota = () => { c.beginPath(); c.moveTo(x, y - 6 * u); c.quadraticCurveTo(x + 5 * u, y, x + 4.2 * u, y + 2.5 * u); c.arc(x, y + 2.5 * u, 4.2 * u, 0, Math.PI); c.quadraticCurveTo(x - 5 * u, y, x, y - 6 * u); };
    gota();
    if (llena) {
      const gasta = cura > 0 && k >= n - coste;
      const late = gasta ? 0.5 + 0.5 * Math.sin(t * 18) : 0;
      c.shadowColor = 'rgba(255,246,228,.9)'; c.shadowBlur = (6 + late * 8) * u;
      c.fillStyle = gasta ? `rgba(255,250,240,${0.75 + late * 0.25})` : '#f3ead8'; c.fill();
      c.shadowBlur = 0;
      if (gasta) {
        // se vacia de arriba abajo segun avanza la cura
        const k2 = Math.min(1, cura / curaT);
        c.save(); gota(); c.clip(); c.fillStyle = 'rgba(11,10,12,.75)'; c.fillRect(x - 6 * u, y - 7 * u, 12 * u, 14 * u * k2); c.restore();
      }
    } else { c.fillStyle = 'rgba(255,255,255,.06)'; c.fill(); }
    c.strokeStyle = 'rgba(235,228,214,.8)'; c.lineWidth = 1.2 * u; gota(); c.stroke();
  }
  // con tres o mas, la marca de que se puede curar
  if (n >= coste) {
    c.fillStyle = `rgba(235,228,214,${0.55 + 0.2 * Math.sin(t * 3)})`; c.font = `${10 * u}px ${SERIF}`; c.textAlign = 'left';
    c.fillText('Q', x0 + max * paso + 12 * u, y0 + 5 * u);
  }
  c.restore();
}

// ---------------------------------------------------------------- cartela del nivel
export function cartela(c, W, H, u, nivel, leng, k) {
  if (k <= 0) return;
  c.save();
  c.globalAlpha = k;
  c.textAlign = 'center'; c.fillStyle = '#efe8da';
  c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = 12 * u;
  const y = H * 0.28;
  c.font = `italic ${14 * u}px ${SERIF}`; c.fillText(nivel.sub[leng], W / 2, y);
  c.font = `${46 * u}px ${SERIF}`;
  espaciado(c, nivel.titulo[leng], W / 2, y + 56 * u, 4 * u);
  c.shadowBlur = 0;
  // ornamento: linea con el circulo de Varga en medio
  c.strokeStyle = '#efe8da'; c.lineWidth = 1.2 * u;
  const L = 200 * u;
  c.beginPath(); c.moveTo(W / 2 - L, y + 78 * u); c.quadraticCurveTo(W / 2 - L * 0.4, y + 72 * u, W / 2 - 14 * u, y + 78 * u); c.stroke();
  c.beginPath(); c.moveTo(W / 2 + L, y + 78 * u); c.quadraticCurveTo(W / 2 + L * 0.4, y + 72 * u, W / 2 + 14 * u, y + 78 * u); c.stroke();
  c.beginPath(); c.arc(W / 2, y + 78 * u, 6 * u, 0.3, Math.PI * 2 - 0.1); c.stroke();
  if (!nivel.zonaLab) { c.font = `${11 * u}px ${SERIF}`; c.globalAlpha = k * 0.6; c.fillText(String(nivel.id).padStart(2, '0') + ' / ' + String(NIVELES.length).padStart(2, '0'), W / 2, y + 102 * u); }
  c.restore();
}

export function espaciado(c, txt, x, y, sp) {
  const w = c.measureText(txt).width + sp * (txt.length - 1);
  let xx = x - w / 2;
  const al = c.textAlign; c.textAlign = 'left';
  for (const ch of txt) { c.fillText(ch, xx, y); xx += c.measureText(ch).width + sp; }
  c.textAlign = al;
}

// ---------------------------------------------------------------- aviso con mano dibujada
export function aviso(c, x, y, u, txt, k) {
  c.save(); c.globalAlpha = k;
  c.translate(x, y);
  c.strokeStyle = '#efe8da'; c.lineWidth = 1.6 * u; c.lineCap = 'round'; c.lineJoin = 'round';
  // mano: palma y tres dedos, a lapiz
  c.beginPath();
  c.moveTo(-34 * u, 4 * u); c.quadraticCurveTo(-38 * u, -6 * u, -32 * u, -10 * u);
  c.lineTo(-32 * u, -20 * u); c.quadraticCurveTo(-29 * u, -23 * u, -27 * u, -20 * u); c.lineTo(-27 * u, -11 * u);
  c.lineTo(-26 * u, -22 * u); c.quadraticCurveTo(-23 * u, -25 * u, -21 * u, -22 * u); c.lineTo(-21 * u, -11 * u);
  c.lineTo(-20 * u, -19 * u); c.quadraticCurveTo(-17 * u, -21 * u, -15 * u, -18 * u); c.lineTo(-16 * u, -2 * u);
  c.quadraticCurveTo(-18 * u, 6 * u, -26 * u, 6 * u); c.closePath(); c.stroke();
  c.fillStyle = '#efe8da'; c.font = `${17 * u}px ${LETRA}`; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(txt, -6 * u, -6 * u);
  c.restore();
}

// ---------------------------------------------------------------- la nota de Varga
export function nota(c, W, H, u, n, leng, k, t) {
  const datos = NOTAS[n];
  c.save();
  c.globalAlpha = k;
  c.fillStyle = 'rgba(2,2,4,.7)'; c.fillRect(0, 0, W, H);
  const w = Math.min(W - 40 * u, 640 * u), h = 300 * u;
  const x = (W - w) / 2, y = (H - h) / 2 + (1 - k) * 20 * u;
  c.translate(x + w / 2, y + h / 2); c.rotate(-0.012); c.translate(-w / 2, -h / 2);
  // papel amarillento con borde azul palido
  c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 30 * u;
  c.fillStyle = '#e6dcc2'; c.beginPath();
  c.moveTo(0, 4 * u); c.lineTo(w * 0.4, 0); c.lineTo(w, 3 * u); c.lineTo(w - 3 * u, h); c.lineTo(w * 0.6, h - 4 * u); c.lineTo(2 * u, h - 1 * u); c.closePath(); c.fill();
  c.shadowBlur = 0;
  const g = c.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(120,90,40,.25)');
  c.fillStyle = g; c.fill();
  c.fillStyle = '#a9cde6'; c.fillRect(0, 4 * u, 5 * u, h - 6 * u);
  // renglones
  c.strokeStyle = 'rgba(120,150,180,.18)'; c.lineWidth = 1 * u;
  for (let yy = 56 * u; yy < h - 30 * u; yy += 27 * u) { c.beginPath(); c.moveTo(24 * u, yy + 6 * u); c.lineTo(w * 0.62, yy + 6 * u); c.stroke(); }
  // texto con la letra de Varga
  c.fillStyle = '#2b2620'; c.font = `${18 * u}px ${LETRA}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  envolver(c, datos[leng], 30 * u, 56 * u, w * 0.6 - 30 * u, 27 * u);
  c.font = `${15 * u}px ${LETRA}`; c.fillStyle = 'rgba(43,38,32,.75)';
  c.fillText('— I. V.', 30 * u, h - 26 * u);
  // dibujo a lapiz al margen
  c.save(); c.translate(w * 0.81, h * 0.48); c.scale(u, u);
  dibujoNota(c, datos.dibujo, t);
  c.restore();
  c.fillStyle = 'rgba(43,38,32,.45)'; c.font = `${11 * u}px ${SERIF}`; c.textAlign = 'right';
  c.fillText(TXT[leng].cerrar, w - 18 * u, h - 14 * u);
  c.restore();
}

export function envolver(c, txt, x, y, w, lh) {
  const pal = txt.split(' ');
  let linea = '';
  for (const p of pal) {
    const prueba = linea ? linea + ' ' + p : p;
    if (c.measureText(prueba).width > w && linea) { c.fillText(linea, x, y); y += lh; linea = p; } else linea = prueba;
  }
  c.fillText(linea, x, y);
  return y;
}

// Dibujos a lapiz: trazos repetidos y algo temblones, como de grafito
function lapiz(c, fn, n = 2, a = 0.55) {
  for (let k = 0; k < n; k++) {
    c.save();
    c.translate((k - 0.5) * 0.9, (k % 2 - 0.5) * 0.8);
    c.strokeStyle = `rgba(55,55,60,${a - k * 0.15})`; c.lineWidth = 1.2; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); fn(); c.stroke();
    c.restore();
  }
}

function capucha(c, x, y, s = 1) {
  // el 18 a lapiz: capucha puntiaguda, cara palida, ojos pequenos
  lapiz(c, () => {
    c.moveTo(x - 14 * s, y + 10 * s); c.quadraticCurveTo(x - 18 * s, y - 14 * s, x - 30 * s, y - 34 * s);
    c.quadraticCurveTo(x + 4 * s, y - 26 * s, x + 14 * s, y - 6 * s); c.quadraticCurveTo(x + 16 * s, y + 6 * s, x + 10 * s, y + 12 * s);
    c.moveTo(x - 8 * s, y - 2 * s); c.quadraticCurveTo(x - 6 * s, y + 10 * s, x + 6 * s, y + 8 * s); c.quadraticCurveTo(x + 10 * s, y - 2 * s, x + 4 * s, y - 8 * s);
  });
  c.fillStyle = 'rgba(40,40,45,.8)'; c.fillRect(x - 2 * s, y - 2 * s, 1.6 * s, 3 * s); c.fillRect(x + 3 * s, y - 2 * s, 1.6 * s, 3 * s);
  lapiz(c, () => { c.moveTo(x - 14 * s, y + 10 * s); c.lineTo(x - 18 * s, y + 40 * s); c.lineTo(x + 14 * s, y + 40 * s); c.lineTo(x + 10 * s, y + 12 * s); });
}

function dibujoNota(c, tipo, t) {
  switch (tipo) {
    case 'frasco':
      lapiz(c, () => { c.rect(-34, -70, 68, 130); c.moveTo(-40, -76); c.lineTo(40, -76); c.moveTo(-40, 66); c.lineTo(40, 66); });
      for (let k = 0; k < 7; k++) lapiz(c, () => { c.moveTo(-30 + k * 9, 50); c.lineTo(-22 + k * 9, 30); }, 1, 0.25);
      capucha(c, 0, 0, 0.8);
      break;
    case 'frasco_abierto':
      lapiz(c, () => { c.moveTo(-30, 60); c.lineTo(-30, -70); c.lineTo(20, -70); c.moveTo(-36, -76); c.lineTo(26, -76); c.moveTo(-36, 66); c.lineTo(34, 66); });
      lapiz(c, () => { c.moveTo(20, -70); c.lineTo(58, -40); c.lineTo(58, 70); c.lineTo(20, 60); });
      lapiz(c, () => { c.moveTo(30, 0); c.lineTo(46, -8); c.moveTo(30, 10); c.lineTo(50, 12); }, 1, 0.3);
      c.fillStyle = 'rgba(40,40,45,.7)'; c.font = '14px ' + LETRA; c.fillText('17', -16, -40);
      break;
    case 'circulos':
      for (let k = 0; k < 3; k++) lapiz(c, () => { c.ellipse(-30 + k * 30, (k % 2) * 16 - 8, 14 + k * 2, 12 + (k % 2) * 3, k * 0.4, 0.2, Math.PI * 2 + 0.3); }, 3, 0.5);
      break;
    case 'lapiz':
      capucha(c, -14, 4, 1.1);
      lapiz(c, () => { c.moveTo(14, -54); c.lineTo(54, -20); c.lineTo(48, -14); c.lineTo(8, -48); c.closePath(); c.moveTo(54, -20); c.lineTo(62, -12); });
      lapiz(c, () => { c.moveTo(4, -6); c.lineTo(20, -30); }, 1, 0.25);
      break;
    case 'zorro':
      lapiz(c, () => {
        c.moveTo(-50, 20); c.quadraticCurveTo(-40, -6, -10, -6); c.lineTo(10, -8); c.lineTo(20, -30); c.lineTo(26, -10);
        c.lineTo(44, -6); c.lineTo(54, 2); c.lineTo(40, 6); c.quadraticCurveTo(30, 14, 20, 12); c.lineTo(18, 40);
        c.moveTo(-6, 10); c.lineTo(-10, 40); c.moveTo(-40, 14); c.quadraticCurveTo(-74, 0, -70, -26);
      });
      break;
    case 'mano':
      lapiz(c, () => {
        c.moveTo(-30, 60); c.lineTo(-30, 0); c.lineTo(-34, -40); c.moveTo(-30, 0); c.lineTo(-18, -50); c.moveTo(-18, 0); c.lineTo(-4, -52);
        c.moveTo(-6, 0); c.lineTo(10, -46); c.moveTo(4, 4); c.lineTo(28, -20); c.moveTo(-30, 60); c.lineTo(10, 60); c.lineTo(10, 4);
      });
      // el contorno de una pinza de insecto encima
      lapiz(c, () => { c.moveTo(-40, -10); c.quadraticCurveTo(-60, -70, 0, -80); c.quadraticCurveTo(40, -60, 20, -20); c.moveTo(-20, -30); c.quadraticCurveTo(-30, -60, 4, -66); }, 2, 0.35);
      break;
    case 'mapa':
      lapiz(c, () => { c.rect(-60, -60, 120, 120); });
      for (let k = 0; k < 9; k++) lapiz(c, () => { const x = -50 + (k % 3) * 40 + Math.sin(k) * 6, y = -40 + Math.floor(k / 3) * 34; c.moveTo(x, y + 14); c.lineTo(x + 7, y); c.lineTo(x + 14, y + 14); }, 1, 0.35);
      lapiz(c, () => { c.moveTo(-60, 40); c.quadraticCurveTo(-10, 20, 60, 46); }, 1, 0.3);
      c.save(); c.strokeStyle = 'rgba(80,110,140,.85)'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(14, -24); c.lineTo(32, -6); c.moveTo(32, -24); c.lineTo(14, -6); c.stroke(); c.restore();
      break;
    case 'tres':
      // la ultima hoja: tres figuras de la mano (no se ve en estos niveles)
      break;
  }
}

// ---------------------------------------------------------------- habilidad nueva
export function habilidad(c, W, H, u, h, leng, k) {
  if (k <= 0) return;
  c.save(); c.globalAlpha = Math.min(1, k * 2);
  c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, H * 0.62, W, 92 * u);
  c.textAlign = 'center'; c.fillStyle = '#fff4e2';
  c.shadowColor = 'rgba(255,246,228,.8)'; c.shadowBlur = 14 * u;
  c.font = `${28 * u}px ${SERIF}`; espaciado(c, TXT[leng].habilidad[h], W / 2, H * 0.62 + 40 * u, 3 * u);
  c.shadowBlur = 0;
  c.font = `${13 * u}px ${SERIF}`; c.fillStyle = 'rgba(239,232,218,.8)';
  c.fillText(TXT[leng].habSub[h], W / 2, H * 0.62 + 68 * u);
  c.restore();
}

// ---------------------------------------------------------------- pista de controles
export function pista(c, W, H, u, txt, k) {
  if (k <= 0) return;
  c.save(); c.globalAlpha = k * 0.85;
  c.fillStyle = '#efe8da'; c.font = `${14 * u}px ${SERIF}`; c.textAlign = 'center';
  c.shadowColor = 'rgba(0,0,0,.9)'; c.shadowBlur = 8 * u;
  c.fillText(txt, W / 2, 112 * u);
  c.restore();
}
