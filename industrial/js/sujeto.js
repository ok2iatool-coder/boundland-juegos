// El SUJETO 18: sus hojas de sprites de perfil (las del juego, renderizadas de su modelo de Blender) en un plano
// que mira a la camara, con los pies en el origen. reposo2 / andar / correr; mira a la derecha o a la izquierda.
import * as THREE from 'three';

export async function cargarSujeto() {
  const datos = await (await fetch('./sujeto/sujeto.json')).json(), ppm = datos.px_por_metro;
  const cargador = new THREE.TextureLoader(), anims = {};
  for (const nombre of ['reposo2', 'andar', 'correr']) {
    const a = datos.anims[nombre], tex = await cargador.loadAsync(`./sujeto/${nombre}.webp`);
    tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
    const W = tex.image.width, H = tex.image.height, [fw, fh] = a.fotograma, [px, py] = a.pies;
    tex.repeat.set(fw / W, fh / H);
    const w = fw / ppm, h = fh / ppm, geo = new THREE.PlaneGeometry(w, h);
    geo.translate(-(-w / 2 + px / ppm), -(h / 2 - py / ppm), 0);
    anims[nombre] = { ...a, tex, geo, W, H };
  }
  // el 18 es lo mas luminoso: un poco por encima del blanco, para que el bloom lo encienda apenas
  const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.3, fog: false, color: new THREE.Color(1.25, 1.22, 1.16) });
  const cuerpo = new THREE.Mesh(anims.reposo2.geo, mat); cuerpo.renderOrder = 5;
  // el halo de luz que lleva (suma, muy suave)
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main() { float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.93, 0.82) * 0.09 * pow(max(0.0, 1.0 - r), 2.0), 1.0); }' }));
  halo.position.set(0, 0.6, -0.05);
  const grupo = new THREE.Group(); grupo.add(halo, cuerpo);
  let actual = null, t = 0;
  return {
    grupo,
    poner(nombre, dt, cara) {
      const a = anims[nombre];
      if (actual !== a) { actual = a; t = 0; mat.map = a.tex; mat.needsUpdate = true; cuerpo.geometry = a.geo; }
      t += dt;
      const f = Math.floor(t * a.fps) % a.fotogramas, col = f % a.cols, fila = Math.floor(f / a.cols);
      a.tex.offset.set((col * a.fotograma[0]) / a.W, 1 - ((fila + 1) * a.fotograma[1]) / a.H);
      cuerpo.scale.x = cara;
    },
  };
}
