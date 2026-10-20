// Los escalones del tono (toon) de todo el terreno: cuatro, para que las facetas se lean (el 18 va en dos)
import * as THREE from 'three';

export const TONO = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 175, 222, 255].flatMap((v) => [v, v, v, 255])), 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
