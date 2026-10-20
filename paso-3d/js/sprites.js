// Las hojas del 18 (copiadas de boundland/web/img/sujeto, que salen de escuela/obras/sujeto18 por
// boundland/tools/sprites.py) y su dibujo, como dibujarSprite de boundland/web/dibujo/actores.js: los pies en (x, pie),
// px_por_metro de la hoja y el borde de luz blanca suave (GDD: el 18 es lo mas luminoso de la pantalla).
export async function cargarSprites(base = 'img/sujeto/') {
  const datos = await (await fetch(base + 'sujeto.json')).json();
  const hojas = {};
  await Promise.all(Object.keys(datos.anims).map((n) => new Promise((ok, mal) => {
    const im = new Image();
    im.onload = () => im.decode().then(() => { hojas[n] = im; ok(); }, ok);
    im.onerror = mal;
    im.src = base + n + '.webp';
  })));
  return { datos, hojas };
}

// fotograma de una animacion a un tiempo (bucle o se queda en el ultimo); fps puede escalarse con la velocidad
export function fotograma(S, anim, t, fps = null) {
  const a = S.datos.anims[anim];
  const n = Math.floor(t * (fps || a.fps));
  return a.bucle ? n % a.fotogramas : Math.min(a.fotogramas - 1, n);
}

// s = px por metro de la pantalla; cara = 1 mira a la derecha
export function dibujarSprite(c, S, anim, i, x, pie, cara, s, alfa = 1, brillo = 1) {
  const a = S.datos.anims[anim];
  const im = S.hojas[anim];
  if (!a || !im) return;
  const [fw, fh] = a.fotograma;
  const sx = (i % a.cols) * fw, sy = Math.floor(i / a.cols) * fh;
  const k = s / S.datos.px_por_metro;
  c.save();
  c.translate(x, pie);
  if (cara < 0) c.scale(-1, 1);
  c.globalAlpha = alfa;
  if (brillo > 0) {
    c.shadowColor = `rgba(255,246,228,${0.85 * brillo})`;
    c.shadowBlur = 0.14 * s;
  }
  c.drawImage(im, sx, sy, fw, fh, -a.pies[0] * k, -a.pies[1] * k, fw * k, fh * k);
  c.restore();
}
