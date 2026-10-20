// EL 18 DE CARTON: un plano de pie en el mundo 3D cuya textura es la CAPA DEL 18 (main.js), el mismo dibujo que veria
// el 2D, con su borde de luz y su penumbra (plano.pintar18). Desde que hay 3D el 18 es solo esto: en el 2D, con la
// camara 3D casada con la 2D, cae en los mismos pixeles; en el cambio no hay otro 18 con el que fundirse; cuando la
// camara gira se nota que es plano, y a mitad del giro se infla en el 18 de verdad (el .glb). Va en la capa 1 de three:
// se pinta en su propio render target y main.js lo pone ENCIMA de la vista rayada y de las bandas, que asi no lo cortan.
import * as THREE from 'three';

export const CAPA18 = 1;

export function crearCarton18(scene) {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 16;
  const t = new THREE.CanvasTexture(lienzo);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.004, side: THREE.DoubleSide, fog: false, depthWrite: true }));
  m.layers.set(CAPA18);
  m.renderOrder = 2;
  m.visible = false;
  scene.add(m);
  // el lienzo de la capa, a la medida pedida (al cambiar de medida la textura se vuelve a crear)
  function lienzoDe(w, h) {
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; t.dispose(); }
    return lienzo;
  }
  // el plano cubre de (x0, y1) arriba a la izquierda, ancho x alto metros, en z
  function poner(x0, y1, ancho, alto, z, alfa) {
    m.visible = alfa > 0.001;
    m.position.set(x0 + ancho / 2, y1 - alto / 2, z);
    m.scale.set(ancho, alto, 1);
    m.material.opacity = alfa;
    t.needsUpdate = true;
  }
  return { malla: m, lienzoDe, poner, texturas: [t] };
}
