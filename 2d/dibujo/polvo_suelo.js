// El polvo que levanta el 18 del suelo (al correr, saltar, caer y derrapar), simulado en Blender con
// Mantaflow (boundland/blender/polvo/): un gas pesado que rueda, se enrosca, baja y se deshace, con granos de
// arena que saltan. Llega como hojas de 30 fotogramas en blanco sobre transparente; aqui se tinen con el
// polvo de cada zona (una vez por color) y se dibujan colocadas en el pie, volteadas segun hacia donde va.
// Las variantes empujan hacia -X (hacia atras de quien corre hacia +X).
const RAIZ = 'img/polvo/';
const U_POR_M = 64;

const S = { listo: false, v: {}, tintes: new Map() };
fetch(RAIZ + 'polvo.json').then((r) => r.json())
  .then((meta) => Promise.all(Object.entries(meta).map(([id, m]) => cargar(RAIZ + id + '.webp').then((img) => { S.v[id] = { m, img }; }))))
  .then(() => { S.listo = true; })
  .catch((e) => console.warn('polvo del suelo: sin hojas', e));

export const polvoSueloListo = () => S.listo;
export const vidaBocanada = (id) => S.v[id].m.cuadros / S.v[id].m.fps;

// la hoja tenida con el color del polvo de la zona (multiplicar y devolverle su transparencia)
function tenida(id, color) {
  const k = id + color;
  let cv = S.tintes.get(k);
  if (cv) return cv;
  const { img } = S.v[id];
  cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const c = cv.getContext('2d');
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = 'multiply'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height);
  c.globalCompositeOperation = 'destination-in'; c.drawImage(img, 0, 0);
  S.tintes.set(k, cv);
  return cv;
}

// q: { var, x, y (el pie en el suelo; en 'cae_techo', el techo), flip (1 = el polvo sale hacia -X), escala, a, color, t }
export function dibujarBocanada(c, q) {
  const s = S.v[q.var];
  if (!s) return;
  const m = s.m, k = Math.min(m.cuadros - 1, Math.floor(q.t * m.fps));
  const e = (U_POR_M / m.pxPorMetro) * q.escala;
  c.save();
  c.translate(q.x, q.y);
  c.scale(e * q.flip, e);
  // se apaga en el ultimo tercio de su vida: el ultimo fotograma aun tiene polvo y antes desaparecia de golpe
  const k0 = q.t / q.vida;
  c.globalAlpha = q.a * Math.min(1, (1 - k0) / 0.35);
  c.drawImage(tenida(q.var, q.color), (k % m.cols) * m.w, Math.floor(k / m.cols) * m.h, m.w, m.h, -m.anclaX, -m.anclaY, m.w, m.h);
  c.restore();
}

function cargar(url) {
  return new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = mal; im.src = url; });
}
