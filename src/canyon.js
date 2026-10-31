import * as THREE from 'three';

// Procedural red-rock canyon: layered strata, jagged cliffs, far mesas.
// Deck footprint (see world.js): 120 x 90, top at y = 0.
const HX = 60, HZ = 45;

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s / 0.97;
}
function ridged(x, y, o = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < o; i++) { s += a * (1 - Math.abs(vnoise(x * f, y * f) * 2 - 1)); f *= 2.1; a *= 0.5; }
  return s / 0.94;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function canyonHeight(x, z) {
  const dx = Math.max(Math.abs(x) - HX, 0), dz = Math.max(Math.abs(z) - HZ, 0);
  const d = Math.hypot(dx, dz);

  // canyon floor with winding river-bed dips
  const floor = -96 + fbm(x * 0.01 + 7.3, z * 0.01 - 2.1, 4) * 16
    - ridged(x * 0.006 + 1.7, z * 0.006 + 4.2, 3) * 14;

  // mesas / buttes: ridged noise, thresholded and terraced into flat caps
  const r = ridged(x * 0.011 + 11.0, z * 0.011 + 5.0, 4);
  let butte = sstep(0.52, 0.78, r);
  butte = Math.floor(butte * 6 + 0.5) / 6 * 0.35 + butte * 0.65; // soft terraces
  const farMask = sstep(70, 190, d);
  let h = floor + butte * (120 + fbm(x * 0.02, z * 0.02, 3) * 40) * (0.35 + 0.65 * farMask);

  // jagged cliff face dropping from the deck rim
  const wob = (fbm(x * 0.06 + 2.0, z * 0.06 + 9.0, 4) - 0.5) * 0.55
    + (ridged(x * 0.13, z * 0.13, 3) - 0.5) * 0.25;
  const t = sstep(0, 1, d / 34 + wob * sstep(0, 14, d));
  h = -1.8 + (h + 1.8) * t;

  // gullies and rock ribs on steep parts
  h += (ridged(x * 0.09 + 3.0, z * 0.09, 3) - 0.5) * 9 * t * (1 - sstep(0.85, 1, t));
  return h;
}

export function buildCanyon(scene) {
  const SIZE = 1500, SEG = 200;
  const n = SEG + 1;
  const pos = new Float32Array(n * n * 3);
  const idx = [];
  // non-uniform grid: dense near the deck, coarse at the horizon (single mesh, no seams)
  const warp = (u) => Math.sign(u) * (0.12 * Math.abs(u) + 0.88 * Math.abs(u) ** 3) * SIZE * 0.5;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = warp((i / SEG) * 2 - 1), z = warp((j / SEG) * 2 - 1);
      const k = (j * n + i) * 3;
      pos[k] = x; pos[k + 1] = canyonHeight(x, z); pos[k + 2] = z;
    }
  }
  for (let j = 0; j < SEG; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = j * n + i, b = a + 1, c = a + n, e = c + 1;
      idx.push(a, c, b, b, c, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  // vertex colours: sandy on flats, deep red on cliffs, noise patches
  const nor = geo.attributes.normal;
  const col = new Float32Array(n * n * 3);
  const sand = new THREE.Color(0xd9a46a), orange = new THREE.Color(0xc0653a);
  const red = new THREE.Color(0x8e3f27), dark = new THREE.Color(0x6a2e20);
  const c = new THREE.Color();
  for (let v = 0; v < n * n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const slope = 1 - nor.getY(v);                 // 0 flat .. 1 vertical
    const patch = fbm(x * 0.05 + 40, z * 0.05, 3);
    c.copy(sand).lerp(orange, sstep(0.05, 0.35, slope) * 0.9);
    c.lerp(red, sstep(0.35, 0.8, slope) * 0.8);
    c.lerp(dark, sstep(0.5, 0.65, patch) * 0.35 * (0.4 + slope));
    c.multiplyScalar(0.82 + 0.3 * sstep(-100, 20, y));   // higher = brighter
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float st  = sin(vWPos.y * 1.35 + sin(vWPos.x * 0.07) * 1.6 + sin(vWPos.z * 0.09) * 1.6) * 0.5 + 0.5;
        float st2 = sin(vWPos.y * 5.3 + sin(vWPos.x * 0.31 + vWPos.z * 0.27) * 2.0) * 0.5 + 0.5;
        diffuseColor.rgb *= 0.80 + 0.20 * st + 0.10 * st2;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.0, 0.76, 0.62), step(0.74, st));`);
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}
