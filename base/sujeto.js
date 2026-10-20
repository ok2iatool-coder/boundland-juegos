// El Sujeto 18 dentro del 3D: sus hojas de sprites (renderizadas de su modelo de Blender) en un plano que
// mira a la camara, como los personajes de Octopath o Paper Mario.
// - En las camaras bajas (plano 2D, lateral) usa las hojas de PERFIL del juego.
// - En el diorama usa las hojas vistas DESDE ARRIBA (39 grados, la altura de esa camara) en cinco angulos
//   (de frente, tres cuartos, de lado, tres cuartos de espaldas, de espaldas); las otras tres direcciones son
//   esas en espejo. El plano se inclina hacia la camara para que el dibujo salga tal cual se renderizo.
// Proyecta su sombra recortada y, si algo lo tapa, se ve su silueta a traves.
import * as THREE from 'three';

const PERFIL = ['reposo2', 'andar', 'correr'];
const AZIMUTS = [0, 45, 90, 135, 180];

async function hojas(base, json, nombres) {
  const datos = await (await fetch(base + json)).json();
  const ppm = datos.px_por_metro;
  const cargador = new THREE.TextureLoader();
  const anims = {};
  await Promise.all(nombres.filter((n) => datos.anims[n]).map(async (nombre) => {
    const a = datos.anims[nombre];
    const tex = await cargador.loadAsync(`${base}${nombre}.webp`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
    const W = tex.image.width, H = tex.image.height;
    const [fw, fh] = a.fotograma, [px, py] = a.pies;
    tex.repeat.set(fw / W, fh / H);
    const w = fw / ppm, h = fh / ppm;
    const geo = new THREE.PlaneGeometry(w, h);
    geo.translate(-(-w / 2 + px / ppm), -(h / 2 - py / ppm), 0);        // los pies del dibujo en el origen
    anims[nombre] = { ...a, tex, geo, W, H };
  }));
  return anims;
}

export async function cargarSujeto(escena) {
  const perfil = await hojas('./sujeto/', 'sujeto.json', PERFIL);
  let dir = {};
  try { dir = await hojas('./sujeto/dir/', 'dirs.json', PERFIL.flatMap((n) => AZIMUTS.map((a) => `${n}_d${String(a).padStart(3, '0')}`))); } catch { /* sin hojas desde arriba: todo de perfil */ }
  const anims = { ...perfil, ...dir };

  const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
  const cuerpo = new THREE.Mesh(perfil.reposo2.geo, mat);
  cuerpo.castShadow = true;
  cuerpo.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.3 });
  cuerpo.renderOrder = 2;
  // silueta a traves de lo que lo tapa (una tienda, una torre)
  const silMat = new THREE.MeshBasicMaterial({ color: '#f4eadb', transparent: true, opacity: 0.32, alphaTest: 0.3, depthFunc: THREE.GreaterDepth, depthWrite: false, side: THREE.DoubleSide });
  const silueta = new THREE.Mesh(perfil.reposo2.geo, silMat);
  silueta.renderOrder = 3;
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.32, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  const grupo = new THREE.Group();
  grupo.rotation.order = 'YXZ';
  grupo.add(cuerpo, silueta);
  escena.add(grupo, sombra);

  let actual = null, t = 0, base = null;
  return {
    grupo,
    tieneDirecciones: Object.keys(dir).length > 0,
    // anim: reposo2 / andar / correr; az: hacia donde anda EN PANTALLA (0 hacia la camara, 90 a la derecha,
    // 180 alejandose, negativo a la izquierda); pitch de la camara para elegir juego de hojas e inclinar
    poner(anim, x, z, yaw, pitch, az, dt) {
      const desdeArriba = pitch > 0.3 && this.tieneDirecciones;
      let nombre = anim, espejo = false;
      if (desdeArriba) {
        const a = Math.round(Math.abs(az) / 45) * 45;
        nombre = `${anim}_d${String(Math.min(180, a)).padStart(3, '0')}`;
        espejo = az < 0;
      } else espejo = az < 0;
      const a = anims[nombre] || anims[anim];
      if (actual !== nombre) {
        actual = nombre;
        if (base !== anim) t = 0;              // cambiar de direccion no reinicia el paso
        base = anim;
        cuerpo.geometry = silueta.geometry = a.geo; mat.map = silMat.map = a.tex; cuerpo.customDepthMaterial.map = a.tex;
        mat.needsUpdate = silMat.needsUpdate = true; cuerpo.customDepthMaterial.needsUpdate = true;
      }
      t += dt;
      const i = Math.floor(t * a.fps) % a.fotogramas;
      const col = i % a.cols, fila = Math.floor(i / a.cols);
      a.tex.offset.set((col * a.fotograma[0]) / a.W, 1 - ((fila + 1) * a.fotograma[1]) / a.H);
      grupo.position.set(x, 0, z);
      grupo.rotation.y = yaw;
      grupo.rotation.x = desdeArriba ? -pitch : 0;
      grupo.scale.x = espejo ? -1 : 1;
      sombra.position.set(x, 0.02, z);
    },
  };
}
