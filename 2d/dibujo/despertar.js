// EL DESPERTAR (2026-10-19). El aspecto de la imagen promocional del despertar (steam/salida/promo/capsula18_rotura.png,
// render de Blender de escuela/obras/capsula18 con `--momento rotura`) llevado a todos los niveles. Lo que la define,
// MEDIDO en la imagen (luminancia mediana 0,145, saturacion mediana 0,30, el 83 % de los pixeles frios en el tono 216,
// lo calido solo el 2,8 % en el tono 33 con saturacion 0,32, el borde a 0,2 de la luz del centro):
//   - azul pizarra oscuro y desaturado en todo; lo UNICO calido es lo que brilla (lamparas de llama o de casa, el frasco,
//     el 18), un ambar palido (tono 30-40, saturacion <= 0,5) que no se confunde con el naranja de la Podredumbre
//     (tono 20-28, saturacion >= 0,75: dibujo/paletas.js COLOR.podre);
//   - el acabado de escuela/obras/capsula18/acabado.py: resplandor de lo que pasa de 0,7 a dos radios, vineta ovalada que
//     enfria y apaga los bordes, sombras un punto azules y grano fino;
//   - bruma con haces que entran desde arriba, motas ambar flotando junto a lo calido, luz por escalones (toon).
// Este modulo es la capa COMUN; lo que va POR ZONA es la tabla ZONAS_D (la paleta de hk.js y la luz de paletas.js
// llevadas al pizarra, y cuanto pesa cada efecto). Se apaga con ?estilo=hk (el juego como antes del 2026-10-19).
import { PALETAS } from './hk.js';
import { ZONAS, COLOR } from './paletas.js';
import { hex, rgba, hash } from './tinta.js';

const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams('');
export const ACTIVO = qs.get('estilo') !== 'hk';

// ---------------------------------------------------------------- la receta (acabado.py, con sus cifras)
export const RECETA = {
  resplandor: { umbral: 0.7, radios: [0.006, 0.03], pesos: [0.22, 0.42] },        // radios en fraccion del ancho
  vineta: { cx: 0.5, cy: 0.46, ax: 0.62, ay: 0.78, d0: 0.35, ancho: 0.75, pot: 1.6, fuerza: 0.82, frio: [0.55, 0.68, 0.85], enfria: 0.25 },
  viraje: [-0.006, 0, 0.012],       // lo que se suma a las sombras (r, g, b)
  grano: 0.012,                      // desviacion tipica
  ambar: '#ffcb8f',                  // tono 33, saturacion 0,44: el calido de la imagen (las motas, el bokeh)
  negro: '#07090c',                  // lo mas oscuro de la imagen es pizarra, no negro (su banda baja: 13, 16, 21, ya con la vineta)
};

// ---------------------------------------------------------------- por zona
// pal: lo que cambia de la paleta de hk.js; zona: lo que cambia de paletas.js (ambiente = color de la sombra en el mapa
// de luz); haz: los haces de bruma (color, fuerza, separacion en u); vineta: la fuerza (la imagen 0,82; jugando un
// poco menos: en el borde puede haber un enemigo); escalones: mezcla de la luz por escalones
const ZONAS_D = {
  laboratorio: {
    pal: { tinta: '#5a6c82', kFondo: 0.88, kMedio: 0.3, satFondo: 0.5, satMedio: 0.5, velo: '#1b2531', veloA: [0.12, 0.36], halo: '#7f93ab', haloA: 0.07, nivel: '#888e97' },
    haz: { color: '#c8dcf5', a: 0.2, sep: 760 }, vineta: 0.8,
  },
  lab: {
    pal: { tinta: '#58697f', kFondo: 0.88, kMedio: 0.3, satFondo: 0.5, satMedio: 0.5, velo: '#1a2430', veloA: [0.12, 0.36], halo: '#7c90a8', haloA: 0.07, nivel: '#838b94' },
    haz: { color: '#c8dcf5', a: 0.2, sep: 760 }, vineta: 0.8,
  },
  // el bosque de noche: verde gris frio (la luz de la luna entre los troncos) y las ventanas calidas
  linde: {
    pal: { tinta: '#4f7068', kFondo: 0.86, kMedio: 0.3, satFondo: 0.5, satMedio: 0.6, velo: '#18221f', veloA: [0.12, 0.36], halo: '#93aaa6', haloA: 0.07, nivel: '#545c5a' },
    zona: { ambiente: '#9aaeac' },
    haz: { color: '#cfe2e6', a: 0.22, sep: 680 }, vineta: 0.78, negro: '#070a0a',
  },
  ciudad: {
    pal: { tinta: '#58677e', kFondo: 0.88, kMedio: 0.3, satFondo: 0.5, satMedio: 0.6, velo: '#1a2331', veloA: [0.12, 0.36], halo: '#8496ad', haloA: 0.07, nivel: '#5a5f69' },
    zona: { ambiente: '#98a5b5' },
    haz: { color: '#cfdbec', a: 0.18, sep: 820 }, vineta: 0.78,
  },
  // la casa de Varga: el sepia pasa a un pizarra polvoriento; lo calido son sus lamparas
  casa: {
    pal: { tinta: '#5f6676', kFondo: 0.86, kMedio: 0.32, satFondo: 0.5, satMedio: 0.6, velo: '#1b1f28', veloA: [0.1, 0.32], halo: '#8a93a3', haloA: 0.07, nivel: '#80848d' },
    zona: { ambiente: '#99a1ad', niebla: '#3e4654', polvo: '#d6dde6' },
    haz: { color: '#cdd8e8', a: 0.035, sep: 720 }, vineta: 0.8,
  },
  plaza: {
    pal: { tinta: '#5d6a86', kFondo: 0.88, kMedio: 0.3, satFondo: 0.5, satMedio: 0.6, velo: '#1d2434', veloA: [0.12, 0.36], halo: '#8d9ab3', haloA: 0.07, nivel: '#5c616b' },
    zona: { ambiente: '#a2afc0' },
    haz: { color: '#d6e2f2', a: 0.2, sep: 700 }, vineta: 0.76,
  },
  hospital: {
    pal: { tinta: '#4c6b62', kFondo: 0.86, kMedio: 0.3, satFondo: 0.5, satMedio: 0.6, velo: '#18201f', veloA: [0.1, 0.32], halo: '#93aaa5', haloA: 0.07, nivel: '#848b8a' },
    haz: { color: '#cfe0e2', a: 0.04, sep: 760 }, vineta: 0.8, negro: '#070a09',
  },
};

// las luces de servicio son frias, como el fluorescente y la ventana de la imagen (lo calido queda para lo que arde o
// esta vivo: el farol de laton, las lamparas de la casa, las ventanas de El Linde, el frasco, el 18)
const LUZ_FRIA = { ventana: '#bccbde', ventanaHospital: '#9fb0c8', farola: '#dfe7f1' };

// La desaturacion de la paleta (satFondo, satMedio en hk.js) es un filtro SVG que baja la saturacion de TODO MENOS el
// naranja de la Podredumbre: con un saturate() a secas el orbe pasaba de naranja (tono 21, saturacion 0,6) a ambar
// (30 y 0,43) y se confundia con lo calido. Lo reconoce por rojo - azul: se respeta desde 0,52 y entero desde 0,72 (la
// Podredumbre, #e2792b, da 0,72; su claro #ffb46a, 0,58); el ambar de las lamparas (#ffcb8f) da 0,44 y se desatura
const filtrosDesat = new Set();
function filtroDesat(v) {
  const id = 'despertar-desat-' + Math.round(v * 100);
  if (typeof document === 'undefined' || !document.body) return `saturate(${v})`;
  if (!filtrosDesat.has(id)) {
    filtrosDesat.add(id);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
    svg.innerHTML = `<filter id="${id}" color-interpolation-filters="sRGB" x="0" y="0" width="1" height="1">
      <feColorMatrix in="SourceGraphic" type="saturate" values="${v}" result="gris"/>
      <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  5 0 -5 0 -2.6" result="naranja"/>
      <feComposite in="naranja" in2="SourceGraphic" operator="in" result="naranja2"/>
      <feComposite in="naranja2" in2="gris" operator="over"/></filter>`;
    document.body.appendChild(svg);
  }
  return `url(#${id})`;
}

if (ACTIVO) {
  for (const [k, d] of Object.entries(ZONAS_D)) {
    if (PALETAS[k] && d.pal) {
      Object.assign(PALETAS[k], d.pal);
      for (const c of ['satFondo', 'satMedio']) if (typeof PALETAS[k][c] === 'number') PALETAS[k][c] = filtroDesat(PALETAS[k][c]);
    }
    if (ZONAS[k] && d.zona) Object.assign(ZONAS[k], d.zona);
  }
}

// lo calido y lo de la Podredumbre por el color de la lampara
function tono(color) {
  const [r, g, b] = hex(color).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 1e-4) return { h: 0, s: 0, v: mx };
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s: d / mx, v: mx };
}
// el mismo valor, en el tono del ambar y con al menos 0,46 de saturacion (sin pasar de 0,5)
function ambar(color) {
  const t = tono(color), v = t.v * 255, sat = Math.min(0.5, Math.max(0.46, t.s)), h = 34;
  const b = v * (1 - sat), g = b + (v - b) * (h / 60);
  return `rgb(${Math.round(v)},${Math.round(g)},${Math.round(b)})`;
}
export const esPodre = (color) => { const t = tono(color); return t.h >= 12 && t.h < 30 && t.s >= 0.6; };
export const esCalida = (color) => { const t = tono(color); return !esPodre(color) && t.h >= 20 && t.h <= 55 && t.s >= 0.16; };

export class Despertar {
  constructor() {
    this.activo = ACTIVO;
    this.d = null;
    this.cv = {};          // lienzos de trabajo por nombre
    this.vinetas = new Map();          // la vineta por tamano y fuerza (vinetaDe)
    this.grano = null;
    this.hazSpr = new Map();
    if (this.activo && typeof document !== 'undefined') this.filtroEscalones();
  }

  lienzo(n, w, h) {
    let c = this.cv[n];
    if (!c) c = this.cv[n] = document.createElement('canvas');
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  zona(nombre) { this.d = this.activo ? ZONAS_D[nombre] || ZONAS_D.lab : null; return this.d; }

  // las luces del nivel, una vez al cargar: ventanas y farolas, frias
  ajustarLuces(luces, zona) {
    if (!this.activo) return luces;
    for (const L of luces) {
      if (L.spr?.id === 'ventana') L.color = zona === 'hospital' ? LUZ_FRIA.ventanaHospital : LUZ_FRIA.ventana;
      else if (L.spr?.id === 'farola') L.color = LUZ_FRIA.farola;
      // lo calido, al ambar de la imagen (tono 34, saturacion 0,5 como mucho): sobre el pizarra desaturado un blanco
      // calido se leia gris
      if (esCalida(L.color)) { L.color = ambar(L.color); if (L.calida === undefined) L.calidaD = true; }
    }
    return luces;
  }

  // ---------------------------------------------------------------- luz por escalones (toon)
  // un filtro SVG de umbrales (feComponentTransfer discreto) para el mapa de luz de luz.js: a un cuarto de resolucion
  // y emborronado despues, los escalones quedan con el borde blando, como el toon del 18
  filtroEscalones() {
    if (document.getElementById('despertar-filtros')) return;
    const n = 6, tabla = Array.from({ length: n }, (_, k) => (k / (n - 1)).toFixed(3)).join(' ');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'despertar-filtros'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = `<filter id="despertar-escalones" color-interpolation-filters="sRGB"><feComponentTransfer>
      <feFuncR type="discrete" tableValues="${tabla}"/><feFuncG type="discrete" tableValues="${tabla}"/><feFuncB type="discrete" tableValues="${tabla}"/>
      </feComponentTransfer></filter>`;
    document.body.appendChild(svg);
  }

  // el mapa de luz (lienzo pequeno, ya con oclusion y canto) pasa a escalones, mezclado con el de antes
  escalonar(cv, mezcla = 0.55) {
    if (!this.activo || !this.d) return;
    const t = this.lienzo('esc', cv.width, cv.height), c = t.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'copy'; c.globalAlpha = 1;
    c.filter = 'url(#despertar-escalones)'; c.drawImage(cv, 0, 0); c.filter = 'none';
    const o = cv.getContext('2d');
    o.save(); o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.globalAlpha = this.d.escalones ?? mezcla;
    o.drawImage(t, 0, 0); o.restore();
  }

  // ---------------------------------------------------------------- haces de bruma (en el lienzo del fondo)
  // columnas de luz que bajan desde arriba en diagonal, como la del techo roto de la imagen: van en el aire de detras
  // (el terreno y lo de delante las tapan), con algo de parallax y respirando despacio
  sprHaz(color) {
    let s = this.hazSpr.get(color);
    if (s) return s;
    const w = 220, h = 900;
    s = document.createElement('canvas'); s.width = w; s.height = h;
    const c = s.getContext('2d');
    const [r, g, b] = hex(color);
    c.filter = 'blur(14px)';
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, `rgba(${r},${g},${b},0.9)`); gr.addColorStop(0.35, `rgba(${r},${g},${b},0.45)`); gr.addColorStop(0.8, `rgba(${r},${g},${b},0.1)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = gr;
    c.beginPath(); c.moveTo(w * 0.42, 0); c.lineTo(w * 0.58, 0); c.lineTo(w * 0.86, h); c.lineTo(w * 0.14, h); c.closePath(); c.fill();
    // hebras mas claras dentro (el polvo que cruza la columna)
    for (let k = 0; k < 3; k++) {
      const x0 = w * (0.45 + k * 0.05), x1 = w * (0.3 + k * 0.2);
      const g2 = c.createLinearGradient(0, 0, 0, h * 0.8);
      g2.addColorStop(0, `rgba(${r},${g},${b},0.5)`); g2.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.strokeStyle = g2; c.lineWidth = 6 + k * 3;
      c.beginPath(); c.moveTo(x0, 0); c.lineTo(x1, h * 0.8); c.stroke();
    }
    c.filter = 'none';
    this.hazSpr.set(color, s);
    return s;
  }

  hacesBruma(c, cam, s, t, W, H) {
    const d = this.d; if (!d || !d.haz) return;
    const { color, a, sep } = d.haz, P = 0.32;          // parallax: entre el fondo lejano y el mundo
    const spr = this.sprHaz(color);
    const vw = W / s, x0 = cam.x * P;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'screen';
    for (let k = Math.floor((x0 - 600) / sep); k <= Math.floor((x0 + vw + 600) / sep); k++) {
      if (hash(k, 7, 19) < 0.35) continue;                // no todos los huecos tienen haz
      const X = k * sep + hash(k, 8, 19) * sep * 0.6;
      const sx = (X - x0) * s;
      const vida = 0.65 + 0.35 * Math.sin(t * (0.18 + hash(k, 9, 19) * 0.2) + k * 2.3);
      const ancho = (0.6 + hash(k, 10, 19) * 0.7) * s * 1.3, alto = H * 1.15;
      c.globalAlpha = Math.min(1, 2.1 * a * vida * (0.55 + 0.45 * hash(k, 11, 19)));
      c.translate(sx, -H * 0.04); c.rotate(-0.2 - hash(k, 12, 19) * 0.12);
      c.drawImage(spr, -spr.width * ancho / 2, 0, spr.width * ancho, alto);
      c.setTransform(1, 0, 0, 1, 0, 0);
    }
    c.restore();
  }

  // ---------------------------------------------------------------- resplandor (acabado.py, paso 1)
  // lo que pasa de 0,7 de luminancia, por su color, emborronado a dos radios y sumado. El umbral es de LUMINANCIA:
  // un umbral por canal satura lo calido hacia el naranja (de (1, 0,8, 0,5) dejaria (1, 0,33, 0))
  resplandor(ctx, lienzo, W, H, k = 1) {
    const R = RECETA.resplandor;
    const w4 = Math.ceil(W / 4), h4 = Math.ceil(H / 4), w8 = Math.ceil(W / 8), h8 = Math.ceil(H / 8);
    const a = this.lienzo('bA', w4, h4), m = this.lienzo('bM', w4, h4), b1 = this.lienzo('b1', w4, h4), b2 = this.lienzo('b2', w8, h8);
    const ca = a.getContext('2d'), cm = m.getContext('2d'), c1 = b1.getContext('2d'), c2 = b2.getContext('2d');
    for (const c of [ca, cm, c1, c2]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.imageSmoothingEnabled = true; }
    ca.globalCompositeOperation = 'copy'; ca.filter = 'none'; ca.drawImage(lienzo, 0, 0, w4, h4);
    // mascara: (lum - u) / (1 - u) con brightness(br) y contrast(cc), que hacen cc (br v - 0,5) + 0,5:
    // cc br = 1 / (1 - u) y 0,5 - 0,5 cc = -u / (1 - u), asi que cc = (1 + u) / (1 - u) y br = 1 / (1 + u)
    const u = R.umbral, cc = (1 + u) / (1 - u), br = 1 / (1 + u);
    cm.globalCompositeOperation = 'copy'; cm.filter = `grayscale(1) brightness(${br.toFixed(4)}) contrast(${cc.toFixed(4)})`;
    cm.drawImage(a, 0, 0); cm.filter = 'none';
    ca.globalCompositeOperation = 'multiply'; ca.drawImage(m, 0, 0);
    c1.globalCompositeOperation = 'copy'; c1.filter = `blur(${(W * R.radios[0] / 4).toFixed(2)}px)`; c1.drawImage(a, 0, 0); c1.filter = 'none';
    c2.globalCompositeOperation = 'copy'; c2.filter = `blur(${(W * R.radios[1] / 8).toFixed(2)}px)`; c2.drawImage(a, 0, 0, w8, h8); c2.filter = 'none';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = R.pesos[0] * k; ctx.drawImage(b1, 0, 0, W, H);
    ctx.globalAlpha = R.pesos[1] * k; ctx.drawImage(b2, 0, 0, W, H);
    ctx.restore();
  }

  // ---------------------------------------------------------------- etalonaje frio (sustituye al de main.js)
  // arriba hacia la luz fria de la zona, abajo hacia su masa; sin el calido de lado a lado: lo calido es lo que brilla
  etalonaje(ctx, W, H, zona) {
    const d = this.d; if (!d) return;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgba(d.haz.color, 0.05)); g.addColorStop(0.55, rgba(d.pal.velo, 0.06)); g.addColorStop(1, rgba(zona.masa, 0.3));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  // ---------------------------------------------------------------- motas
  // polvo frio y palido en todo el nivel; junto a lo calido, motas AMBAR y algun bokeh (disco desenfocado), como las de
  // la capsula de la imagen; junto a la Podredumbre, esporas de su naranja
  motas(ctx, s, cx, cy, vw, vh, t, luces, extra = []) {
    const d = this.d; if (!d) return;
    ctx.save(); ctx.setTransform(s, 0, 0, s, -cx * s, -cy * s); ctx.globalCompositeOperation = 'lighter';
    const frio = d.haz.color;
    const C = 150;
    for (let i = Math.floor(cx / C) - 1; i <= Math.floor((cx + vw) / C) + 1; i++) {
      for (let j = Math.floor(cy / C) - 1; j <= Math.floor((cy + vh) / C) + 1; j++) {
        const h = hash(i, j, 41); if (h > 0.5) continue;
        const h2 = hash(i, j, 42), h3 = hash(i, j, 43);
        const sube = (t * (6 + h3 * 10) + h2 * C) % C;
        const x = i * C + h2 * C + Math.sin(t * (0.3 + h3 * 0.4) + h * 20) * 18;
        const y = j * C + C - sube;
        const vida = Math.sin((sube / C) * Math.PI);
        const a = vida * (0.22 + 0.22 * Math.sin(t * 2 + h * 40));
        if (a < 0.03) continue;
        const r = 0.8 + h3 * 1.2;
        ctx.fillStyle = rgba(frio, a); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
    }
    // alrededor de cada luz calida (o de la Podredumbre) que se ve
    const fuentes = extra.slice();
    for (const L of luces) {
      if (!(L.calida || L.calidaD || esPodre(L.color))) continue;
      if (L.x < cx - L.r || L.x > cx + vw + L.r || L.y < cy - L.r || L.y > cy + vh + L.r) continue;
      const f = L.fuerza ? L.fuerza(t) : L.f ?? 1; if (f < 0.15) continue;
      fuentes.push({ x: L.x, y: L.y + (L.cono ? L.r * 0.3 : 0), r: L.r * (L.cono ? 0.7 : 0.8), f, podre: esPodre(L.color), sem: Math.round(L.x * 3 + L.y) });
    }
    for (const F of fuentes) {
      const n = Math.min(28, Math.max(8, Math.round(F.r / 12)));
      const col = F.podre ? COLOR.podre : RECETA.ambar;
      for (let k = 0; k < n; k++) {
        const h1 = hash(F.sem, k, 51), h2 = hash(F.sem, k, 52), h3 = hash(F.sem, k, 53);
        const ciclo = 5 + h3 * 6, fase = ((t / ciclo) + h1) % 1;              // cada mota sube y se apaga en su ciclo
        const x = F.x + (h2 - 0.5) * F.r * 1.3 + Math.sin(t * (0.4 + h1) + k) * 9;
        const y = F.y + F.r * 0.45 - fase * F.r * 0.9;
        const dd = Math.hypot((x - F.x) / F.r, (y - F.y) / F.r);
        const a = Math.sin(fase * Math.PI) * Math.max(0, 1 - dd) * F.f * (F.podre ? 0.55 : 0.8);
        if (a < 0.02) continue;
        if (k % 4 === 0) {
          // bokeh: un disco blando, grande y tenue
          const R = 4 + h1 * 5;
          const g = ctx.createRadialGradient(x, y, 0, x, y, R);
          g.addColorStop(0, rgba(col, a * 0.3)); g.addColorStop(0.7, rgba(col, a * 0.34)); g.addColorStop(0.86, rgba(col, a * 0.16)); g.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
        } else {
          const r = 1.1 + h2 * 1.9;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
          g.addColorStop(0, rgba(col, a)); g.addColorStop(0.35, rgba(col, a * 0.6)); g.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = g; ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
        }
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- acabado final (acabado.py, pasos 2 a 4)
  // vineta ovalada que enfria y apaga los bordes, sombras un punto azules y grano. Encima de todo el mundo y debajo de
  // la interfaz
  // foco: donde esta el 18 en la pantalla (0-1): la vineta se centra en el, como en la imagen se centra en la capsula,
  // y lo sigue con suavidad sin irse mas de un cuarto de pantalla del centro (si no, medio cuadro se apaga)
  acabado(ctx, W, H, t, foco = null) {
    const d = this.d; if (!d) return;
    const V = RECETA.vineta, kV = d.vineta ?? V.fuerza;
    const vineta = this.vinetaDe(W, H, kV);
    const meta = foco ? [Math.max(0.27, Math.min(0.73, foco[0])), Math.max(0.3, Math.min(0.66, foco[1] + 0.06))] : [V.cx, V.cy];
    const dt = this.tVineta === undefined ? 9 : t - this.tVineta;
    this.tVineta = t;
    if (!this.focoV || dt > 0.5 || dt < 0) this.focoV = meta.slice();     // (un salto de tiempo: un nivel nuevo, una foto)
    else { const k = 1 - Math.exp(-dt * 2.2); this.focoV[0] += (meta[0] - this.focoV[0]) * k; this.focoV[1] += (meta[1] - this.focoV[1]) * k; }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true;
    // (el lienzo de la vineta mide el doble que la pantalla con el centro en medio: se corre hasta el foco)
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(vineta, (this.focoV[0] - 1) * W, (this.focoV[1] - 1) * H, W * 2, H * 2);
    // los negros, a pizarra ('screen' casi no toca lo claro)
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = d.negro || RECETA.negro; ctx.fillRect(0, 0, W, H);
    // grano (con el viraje dentro): se suma un ruido de media m y se resta m con 'difference' (|x - m| = x - m si x >= m;
    // el negro puro queda con un grano de la mitad). Lo restado por canal lleva el viraje: menos rojo, mas azul
    if (!this.grano) this.hacerGrano();
    const fr = Math.floor(t * 24);                                   // el grano cambia a 24 fps, como el de la pelicula
    const ox = Math.floor(hash(fr, 1, 61) * 256), oy = Math.floor(hash(fr, 2, 61) * 256);
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(-ox, -oy); ctx.fillStyle = this.grano.patron; ctx.fillRect(ox, oy, W, H); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'difference';
    const m = this.grano.media, vr = RECETA.viraje;
    const q = (v) => Math.max(0, Math.round((m - v) * 255));
    ctx.fillStyle = `rgb(${q(vr[0])},${q(vr[1])},${q(vr[2])})`; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // LA VINETA, guardada por tamano y fuerza (2026-10-20): cada zona trae su fuerza y el prologo pasa de la calle al
  // subsuelo y al laboratorio; rehacerla entera (518.000 pixeles con pow e hypot a 1920) daba tirones de 50-66 ms en
  // cada cambio. Ahora la forma (v por pixel) se calcula una vez por tamano y cada fuerza solo la colorea (~4 ms), y
  // las ya hechas se guardan.
  vinetaDe(W, H, k) {
    const clave = W + 'x' + H + ':' + k;
    this.vinetas = this.vinetas || new Map();
    let cv = this.vinetas.get(clave);
    if (cv) return cv;
    const V = RECETA.vineta, w = Math.ceil(W / 4), h = Math.ceil(H / 4), n = w * 2 * h * 2;
    if (!this.formaV || this.formaV.clave !== W + 'x' + H) {
      const f = new Float32Array(n);
      for (let y = 0; y < h * 2; y++) for (let x = 0; x < w * 2; x++) {
        const dd = Math.hypot((x / w - 1) / V.ax, (y / h - 1) / V.ay);
        f[y * w * 2 + x] = Math.pow(Math.max(0, Math.min(1, (dd - V.d0) / V.ancho)), V.pot);
      }
      this.formaV = { clave: W + 'x' + H, f };
    }
    cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2;
    const c = cv.getContext('2d'), img = c.createImageData(w * 2, h * 2), d = img.data, f = this.formaV.f;
    const e0 = V.enfria * (1 - V.frio[0]), e1 = V.enfria * (1 - V.frio[1]), e2 = V.enfria * (1 - V.frio[2]);
    for (let p = 0, o = 0; p < n; p++, o += 4) {
      const v = f[p], a = 255 * (1 - k * v);
      d[o] = a * (1 - e0 * v) + 0.5; d[o + 1] = a * (1 - e1 * v) + 0.5; d[o + 2] = a * (1 - e2 * v) + 0.5; d[o + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    if (this.vinetas.size > 8) this.vinetas.delete(this.vinetas.keys().next().value);
    this.vinetas.set(clave, cv);
    return cv;
  }

  hacerGrano() {
    const n = 256, cv = this.lienzo('grano', n, n), c = cv.getContext('2d'), img = c.createImageData(n, n);
    const sd = RECETA.grano * 255, media = 2 * RECETA.grano;      // el ruido va de 0 a 4 sd: media 2 sd
    let s = 18;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let k = 0; k < n * n; k++) {
      // normal por Box-Muller, desplazada a la media y recortada a [0, 4 sd]
      const z = Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
      const v = Math.max(0, Math.min(255, Math.round(media * 255 + z * sd)));
      img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = v; img.data[k * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    this.grano = { patron: c.createPattern(cv, 'repeat'), media };
  }
}

// una sola, la comparten main.js y luz.js
export const despertar = new Despertar();
