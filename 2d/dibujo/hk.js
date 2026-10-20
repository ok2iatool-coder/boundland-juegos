// ESTILO HOLLOW KNIGHT (2026-10-18). Lo que hace que Hollow Knight se lea como Hollow Knight no es el detalle sino
// el orden de los valores: el FONDO brilla (capas de siluetas que se aclaran y se aplanan con la distancia, metidas
// en la bruma de la zona), lo JUGABLE es lo mas oscuro (roca casi negra con el canto encendido), el primer plano es
// silueta negra, y cada zona es de UN color. Antes el mapa de luz oscurecia todo por igual y el fondo se hundia en
// el negro con el terreno.
// Por eso el fotograma se compone en dos partes (main.js):
//   fondo    se pinta en su propio lienzo, con un VELO de bruma despues de cada capa (lo lejano queda debajo de
//            mas velos: mas claro y mas plano) y el color de la zona; NO recibe la penumbra (tiene su propia luz)
//   delante  terreno, decorado y personajes, en el lienzo del juego sobre transparente: se tinen con el color de
//            la zona y despues se multiplican por el mapa de luz (dibujo/luz.js), SOLO donde hay algo pintado
//            (`componer`); luego el fondo se pone debajo (`ponerFondo`)
// Asi las lamparas tinen de su color lo de delante (el naranja de la Podredumbre vuelve con su luz) y el 18, blanco,
// sigue blanco: el modo 'color' conserva la luminancia.
import { rgba } from './tinta.js';

// por zona: tinta (el color de la zona), kFondo / kMedio (cuanto tine al fondo y a lo de delante), velo (la bruma
// entre capas, su color y su espesor arriba y abajo), halo (la luz del fondo, en una banda baja, con 'screen') y nivel
// (opcional: el fondo multiplicado por este color; en las zonas pintadas claras, para que no quede en pastel)
export const PALETAS = {   // (dibujo/despertar.js las lleva al azul pizarra de la imagen del despertar)
  // el laboratorio y sus pasillos: azul pizarra (como las Encrucijadas Olvidadas)
  laboratorio: { tinta: '#4a6d96', kFondo: 0.7, kMedio: 0.35, velo: '#2c4058', veloA: [0.1, 0.3], halo: '#8aa6c6', haloA: 0.3 },
  lab: { tinta: '#456a92', kFondo: 0.7, kMedio: 0.35, velo: '#2a3e56', veloA: [0.1, 0.3], halo: '#86a2c2', haloA: 0.3 },
  // El Linde: verde de bosque con la luz dorada del GDD (como la Senda Verde)
  linde: { tinta: '#3f8250', kFondo: 0.62, kMedio: 0.3, velo: '#3c5a3a', veloA: [0.08, 0.3], halo: '#d9e3a2', haloA: 0.18, nivel: '#c6d0b6' },
  // la ciudad: azul hondo (como la Ciudad de Lagrimas)
  ciudad: { tinta: '#3e5f90', kFondo: 0.72, kMedio: 0.38, velo: '#2a3f5e', veloA: [0.1, 0.32], halo: '#9db6d6', haloA: 0.2, nivel: '#bcc4d2' },
  // la casa de Varga: sepia de interior
  casa: { tinta: '#7c5c3d', kFondo: 0.6, kMedio: 0.3, velo: '#3e3022', veloA: [0.08, 0.26], halo: '#e3c294', haloA: 0.22 },
  // la plaza que flota: azul lavanda palido
  plaza: { tinta: '#5f6d99', kFondo: 0.7, kMedio: 0.32, velo: '#36405c', veloA: [0.12, 0.34], halo: '#c3cde4', haloA: 0.12, nivel: '#9aa3bb' },
  // el hospital: gris verdoso enfermo
  hospital: { tinta: '#4f706a', kFondo: 0.65, kMedio: 0.32, velo: '#2f423f', veloA: [0.08, 0.28], halo: '#b6ccc6', haloA: 0.24 },
};

export class EstiloHK {
  constructor() {
    this.fondo = document.createElement('canvas');
    this.tmp = document.createElement('canvas');
    this.p = null;
    // entre capa y capa del fondo (los fondos lo llaman con el contexto del fondo y el parallax de la capa)
    this.velo = (c) => {
      const p = this.p, H = c.canvas.height, W = c.canvas.width;
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba(p.velo, p.veloA[0])); g.addColorStop(0.6, rgba(p.velo, (p.veloA[0] + p.veloA[1]) / 2)); g.addColorStop(1, rgba(p.velo, p.veloA[1]));
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
    };
  }

  // la paleta de la zona (null: la zona se pinta como siempre)
  zona(nombre) { this.p = PALETAS[nombre] || null; return this.p; }

  // el lienzo del fondo, limpio y del tamano de la pantalla
  lienzoFondo(W, H) {
    for (const c of [this.fondo, this.tmp]) if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const f = this.fondo.getContext('2d');
    f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-over'; f.globalAlpha = 1; f.filter = 'none';
    f.clearRect(0, 0, W, H);
    return f;
  }

  // el fondo ya pintado: el color de la zona y su luz, una banda baja que brilla (la bruma a contraluz)
  gradarFondo() {
    const p = this.p, c = this.fondo.getContext('2d'), W = this.fondo.width, H = this.fondo.height;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'color'; c.globalAlpha = p.kFondo; c.fillStyle = p.tinta; c.fillRect(0, 0, W, H);
    c.globalAlpha = 1;
    if (p.nivel) { c.globalCompositeOperation = 'multiply'; c.fillStyle = p.nivel; c.fillRect(0, 0, W, H); }
    // (el despertar, dibujo/despertar.js) menos saturado: 'color' guarda el croma y en lo oscuro la saturacion se dispara;
    // saturate() lo escala con la luminancia, como en la imagen (0,3 en todos los valores)
    if (p.satFondo != null) {
      const t = this.tmp.getContext('2d');
      t.setTransform(1, 0, 0, 1, 0, 0); t.globalAlpha = 1; t.globalCompositeOperation = 'copy'; t.drawImage(this.fondo, 0, 0);
      c.globalCompositeOperation = 'copy'; c.filter = typeof p.satFondo === 'string' ? p.satFondo : `saturate(${p.satFondo})`; c.drawImage(this.tmp, 0, 0); c.filter = 'none';
    }
    c.globalCompositeOperation = 'screen';
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgba(p.halo, p.haloA * 0.15)); g.addColorStop(0.62, rgba(p.halo, p.haloA)); g.addColorStop(1, rgba(p.halo, p.haloA * 0.45));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.restore();
  }

  // lo de delante (pintado sobre transparente en ctx): tinta de la zona y luz, solo donde hay algo pintado
  componer(ctx, luz) {
    const p = this.p, W = ctx.canvas.width, H = ctx.canvas.height, t = this.tmp;
    if (t.width !== W || t.height !== H) { t.width = W; t.height = H; }
    const c = t.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.imageSmoothingEnabled = true;
    c.globalCompositeOperation = 'copy';
    if (p.satMedio != null) c.filter = typeof p.satMedio === 'string' ? p.satMedio : `saturate(${p.satMedio})`;     // (el despertar: ver gradarFondo)
    c.drawImage(ctx.canvas, 0, 0); c.filter = 'none';
    c.globalCompositeOperation = 'color'; c.globalAlpha = p.kMedio; c.fillStyle = p.tinta; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    c.globalCompositeOperation = 'multiply'; c.drawImage(luz, 0, 0, W, H);
    // (los modos de mezcla pintan tambien donde no habia nada: se recorta a lo que habia)
    c.globalCompositeOperation = 'destination-in'; c.drawImage(ctx.canvas, 0, 0);
    ctx.globalCompositeOperation = 'copy'; ctx.drawImage(t, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  // el fondo, debajo de todo lo demas
  ponerFondo(ctx) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-over'; ctx.drawImage(this.fondo, 0, 0);
    ctx.restore();
  }
}
