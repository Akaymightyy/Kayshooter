import * as THREE from 'three';
import { glowSprite, sparkSprite, scorchTexture } from './textures.js';
import { COLORS } from './config.js';

// ---------- math helpers (shared) ----------
export function segBox(p0, p1, min, max) {
  // slab method; returns t in [0,1] or -1
  let tmin = 0, tmax = 1;
  const d = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
  const ax = ['x', 'y', 'z'];
  for (let i = 0; i < 3; i++) {
    const a = ax[i];
    const o = p0[a], dd = d[a];
    if (Math.abs(dd) < 1e-9) {
      if (o < min[a] || o > max[a]) return -1;
    } else {
      let t1 = (min[a] - o) / dd, t2 = (max[a] - o) / dd;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

export function segSphere(p0, p1, c, r) {
  const d = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
  const f = { x: p0.x - c.x, y: p0.y - c.y, z: p0.z - c.z };
  const a = d.x * d.x + d.y * d.y + d.z * d.z;
  if (a < 1e-9) return (f.x * f.x + f.y * f.y + f.z * f.z) <= r * r ? 0 : -1;
  const b = 2 * (f.x * d.x + f.y * d.y + f.z * d.z);
  const cc = f.x * f.x + f.y * f.y + f.z * f.z - r * r;
  let disc = b * b - 4 * a * cc;
  if (disc < 0) return -1;
  disc = Math.sqrt(disc);
  const t = (-b - disc) / (2 * a);
  if (t >= 0 && t <= 1) return t;
  if (cc <= 0) return 0;
  return -1;
}

// ---------- particle system (single draw call per texture) ----------
class ParticleSystem {
  constructor(scene, map, capacity, blending) {
    this.cap = capacity;
    this.alive = 0;
    this.parts = new Array(capacity);
    for (let i = 0; i < capacity; i++) this.parts[i] = {};

    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending,
      uniforms: { uMap: { value: map } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        varying float vAlpha; varying vec3 vColor;
        void main() {
          vAlpha = aAlpha; vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(aSize * (260.0 / max(-mv.z, 0.1)), 240.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap; varying float vAlpha; varying vec3 vColor;
        void main() {
          float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vColor, a);
        }`,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
    this.geo = geo;
  }

  spawn(o) {
    if (this.alive >= this.cap) return;
    const p = this.parts[this.alive++];
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.life = 0; p.maxLife = o.life || 1;
    p.size0 = o.size0 ?? 1; p.size1 = o.size1 ?? p.size0;
    const c0 = o.c0 || [1, 1, 1], c1 = o.c1 || c0;
    p.c0 = c0; p.c1 = c1;
    p.a0 = o.a0 ?? 1; p.a1 = o.a1 ?? 0;
    p.gravity = o.gravity || 0;
    p.drag = o.drag ?? 1;
  }

  update(dt) {
    const { pos, col, size, alpha, parts } = this;
    let n = this.alive;
    for (let i = 0; i < n; ) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        // swap-remove
        n--;
        const last = parts[n];
        parts[n] = p; parts[i] = last;
        continue;
      }
      const k = p.life / p.maxLife;
      const dragF = Math.pow(p.drag, dt * 60);
      p.vx *= dragF; p.vz *= dragF;
      p.vy = p.vy * dragF + p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const i3 = i * 3;
      pos[i3] = p.x; pos[i3 + 1] = p.y; pos[i3 + 2] = p.z;
      col[i3] = p.c0[0] + (p.c1[0] - p.c0[0]) * k;
      col[i3 + 1] = p.c0[1] + (p.c1[1] - p.c0[1]) * k;
      col[i3 + 2] = p.c0[2] + (p.c1[2] - p.c0[2]) * k;
      size[i] = p.size0 + (p.size1 - p.size0) * k;
      alpha[i] = p.a0 + (p.a1 - p.a0) * k;
      i++;
    }
    this.alive = n;
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

// ---------- plasma / laser bolts ----------
export class BoltSystem {
  constructor(scene, collide) {
    this.collide = collide; // (p0, p1, team) => hit | null
    this.cap = 64;
    this.bolts = [];
    const geo = new THREE.CapsuleGeometry(0.055, 1.0, 3, 8);
    geo.rotateX(Math.PI / 2); // axis -> Z
    this.dummy = new THREE.Object3D();

    this.meshes = {
      player: new THREE.InstancedMesh(geo,
        new THREE.MeshBasicMaterial({ color: 0xff5fc4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), this.cap),
      ally: new THREE.InstancedMesh(geo,
        new THREE.MeshBasicMaterial({ color: 0xc98fd8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), this.cap),
      enemy: new THREE.InstancedMesh(geo,
        new THREE.MeshBasicMaterial({ color: 0xffa63d, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), this.cap),
    };
    for (const k in this.meshes) {
      this.meshes[k].frustumCulled = false;
      this.meshes[k].count = 0;
      this.meshes[k].renderOrder = 5;
      scene.add(this.meshes[k]);
    }
    for (let i = 0; i < this.cap; i++) this.bolts.push({ active: false });
  }

  spawn(pos, dir, team, speed, life, trail) {
    for (const b of this.bolts) {
      if (b.active) continue;
      b.active = true;
      b.pos = pos.clone();
      b.dir = dir.clone().normalize();
      b.team = team;
      b.speed = speed;
      b.life = 0;
      b.maxLife = life;
      b.trail = trail || 0;
      return b;
    }
    return null;
  }

  update(dt, fx) {
    for (const k in this.meshes) this.meshes[k].count = 0;
    for (const b of this.bolts) {
      if (!b.active) continue;
      b.life += dt;
      const p0 = b.pos;
      const step = b.speed * dt;
      const p1 = { x: p0.x + b.dir.x * step, y: p0.y + b.dir.y * step, z: p0.z + b.dir.z * step };
      const hit = this.collide(p0, p1, b.team);
      if (hit) {
        b.active = false;
        this.onHit && this.onHit(hit, b, fx);
        continue;
      }
      if (b.life >= b.maxLife) { b.active = false; continue; }
      p0.x = p1.x; p0.y = p1.y; p0.z = p1.z;

      if (b.trail > 0) {
        b.trailT = (b.trailT || 0) - dt;
        if (b.trailT <= 0) {
          b.trailT = 0.018;
          const c = b.team === 'player' ? [1.0, 0.35, 0.75] : [1.0, 0.62, 0.22];
          fx.glow.spawn({
            x: p0.x, y: p0.y, z: p0.z,
            vx: 0, vy: 0, vz: 0,
            life: 0.16, size0: 0.34, size1: 0.05,
            c0: c, c1: c, a0: 0.5, a1: 0, gravity: 0,
          });
        }
      }

      const mesh = this.meshes[b.team];
      const idx = mesh.count;
      if (idx < this.cap) {
        const d = this.dummy;
        d.position.set(p0.x, p0.y, p0.z);
        d.lookAt(p0.x + b.dir.x, p0.y + b.dir.y, p0.z + b.dir.z);
        d.scale.set(1, 1, b.team === 'player' ? 1.35 : 1.1);
        d.updateMatrix();
        mesh.setMatrixAt(idx, d.matrix);
        mesh.count++;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const k in this.meshes) this.meshes[k].instanceMatrix.needsUpdate = true;
  }
}

// ---------- main effects manager ----------
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.glow = new ParticleSystem(scene, glowSprite(), 900, THREE.AdditiveBlending);
    this.spark = new ParticleSystem(scene, sparkSprite(), 500, THREE.AdditiveBlending);
    this.smoke = new ParticleSystem(scene, glowSprite('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'), 400, THREE.NormalBlending);

    // shockwave rings
    this.rings = [];
    const ringGeo = new THREE.TorusGeometry(1, 0.045, 8, 48);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false,
      }));
      m.visible = false;
      m.renderOrder = 7;
      scene.add(m);
      this.rings.push({ mesh: m, life: 0, maxLife: 1, maxR: 5, horizontal: true });
    }

    // shock spheres
    this.shells = [];
    const shellGeo = new THREE.SphereGeometry(1, 24, 16);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      }));
      m.visible = false;
      m.renderOrder = 7;
      scene.add(m);
      this.shells.push({ mesh: m, life: 0, maxLife: 1, maxR: 6 });
    }

    // pooled flash lights
    this.lights = [];
    for (let i = 0; i < 5; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 26, 1.8);
      l.visible = false;
      scene.add(l);
      this.lights.push({ light: l, life: 0, maxLife: 1, base: 0 });
    }

    // scorch decals
    this.decals = [];
    const dGeo = new THREE.PlaneGeometry(1, 1);
    const dMat = new THREE.MeshBasicMaterial({
      map: scorchTexture(), transparent: true, opacity: 0, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(dGeo, dMat.clone());
      m.visible = false;
      m.renderOrder = 2;
      scene.add(m);
      this.decals.push({ mesh: m, life: 0 });
    }
    this.decalIdx = 0;

    this.boltSystem = null; // wired by game
  }

  _ring(pos, color, maxR, life, horizontal = true) {
    for (const r of this.rings) {
      if (r.mesh.visible) continue;
      r.mesh.visible = true;
      r.mesh.position.copy(pos);
      r.mesh.material.color.set(color);
      r.mesh.scale.set(0.1, 0.1, 0.1);
      r.life = 0; r.maxLife = life; r.maxR = maxR; r.horizontal = horizontal;
      if (!horizontal) r.mesh.rotation.set(0, 0, 0);
      else r.mesh.rotation.x = Math.PI / 2;
      return;
    }
  }

  _shell(pos, color, maxR, life) {
    for (const s of this.shells) {
      if (s.mesh.visible) continue;
      s.mesh.visible = true;
      s.mesh.position.copy(pos);
      s.mesh.material.color.set(color);
      s.mesh.scale.setScalar(0.1);
      s.life = 0; s.maxLife = life; s.maxR = maxR;
      return;
    }
  }

  _flash(pos, color, intensity, life, dist = 26) {
    for (const l of this.lights) {
      if (l.light.visible) continue;
      l.light.visible = true;
      l.light.position.copy(pos);
      l.light.color.set(color);
      l.light.intensity = intensity;
      l.light.distance = dist;
      l.base = intensity;
      l.life = 0; l.maxLife = life;
      return;
    }
  }

  _decal(pos, size) {
    const d = this.decals[this.decalIdx];
    this.decalIdx = (this.decalIdx + 1) % this.decals.length;
    d.mesh.visible = true;
    d.mesh.position.set(pos.x, pos.y + 0.03, pos.z);
    d.mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    d.mesh.scale.setScalar(size);
    d.mesh.material.opacity = 0.75;
    d.life = 0;
  }

  /** Small-arms impact: sparks + puff + optional floor scorch. */
  impact(pos, normal, colorHex) {
    const c = new THREE.Color(colorHex);
    const refl = normal.clone().multiplyScalar(-1);
    for (let i = 0; i < 7; i++) {
      const s = 5 + Math.random() * 9;
      this.spark.spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx: (refl.x + (Math.random() - 0.5) * 1.6) * s,
        vy: (refl.y + (Math.random() - 0.3) * 1.6) * s,
        vz: (refl.z + (Math.random() - 0.5) * 1.6) * s,
        life: 0.22 + Math.random() * 0.2, size0: 0.16, size1: 0.02,
        c0: [1, 0.9, 0.6], c1: [c.r, c.g, c.b], a0: 1, a1: 0,
        gravity: -14, drag: 0.985,
      });
    }
    this.glow.spawn({
      x: pos.x, y: pos.y, z: pos.z, life: 0.1,
      size0: 0.6, size1: 0.2, c0: [c.r, c.g, c.b], c1: [c.r, c.g, c.b], a0: 0.9, a1: 0,
    });
    this.smoke.spawn({
      x: pos.x, y: pos.y, z: pos.z,
      vx: (Math.random() - 0.5), vy: 0.8 + Math.random(), vz: (Math.random() - 0.5),
      life: 0.7, size0: 0.3, size1: 0.9, c0: [0.55, 0.55, 0.55], c1: [0.4, 0.4, 0.4], a0: 0.4, a1: 0, drag: 0.94,
    });
    if (normal.y > 0.72) this._decal(pos, 0.5 + Math.random() * 0.25);
  }

  /** Muzzle flash burst. */
  muzzle(pos, dir, colorHex) {
    const c = new THREE.Color(colorHex);
    this.glow.spawn({
      x: pos.x, y: pos.y, z: pos.z, life: 0.055,
      size0: 0.85, size1: 0.1, c0: [1, 0.95, 1], c1: [c.r, c.g, c.b], a0: 1, a1: 0,
    });
    for (let i = 0; i < 3; i++) {
      this.spark.spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx: dir.x * 14 + (Math.random() - 0.5) * 6,
        vy: dir.y * 14 + (Math.random() - 0.5) * 6,
        vz: dir.z * 14 + (Math.random() - 0.5) * 6,
        life: 0.1, size0: 0.12, size1: 0.01,
        c0: [1, 0.8, 0.95], c1: [c.r, c.g, c.b], a0: 1, a1: 0, gravity: 0,
      });
    }
  }

  /** Big explosion. kind: 'orange' (fuel) | 'pink' (grenade). */
  explosion(pos, kind, radius) {
    const isPink = kind === 'pink';
    const core = isPink ? [1, 0.8, 0.92] : [1, 0.78, 0.5];
    const mid = isPink ? [1, 0.35, 0.75] : [1, 0.45, 0.12];
    const smokeC = isPink ? [0.75, 0.6, 0.7] : [0.35, 0.3, 0.28];

    // fireball
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1);
      const s = (isPink ? 4.5 : 6) + Math.random() * (isPink ? 8 : 11);
      this.glow.spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.sin(b) * Math.cos(a) * s, vy: Math.abs(Math.cos(b)) * s * (isPink ? 1 : 0.8), vz: Math.sin(b) * Math.sin(a) * s,
        life: 0.32 + Math.random() * 0.4, size0: radius * 0.34, size1: radius * 0.8,
        c0: core, c1: mid, a0: 0.75, a1: 0, gravity: isPink ? -2 : -5, drag: 0.9,
      });
    }
    // sparks streaks
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1);
      const s = 10 + Math.random() * 18;
      this.spark.spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.sin(b) * Math.cos(a) * s, vy: Math.abs(Math.cos(b)) * s, vz: Math.sin(b) * Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.3, size0: 0.22, size1: 0.03,
        c0: [1, 0.95, 0.8], c1: mid, a0: 1, a1: 0, gravity: -16, drag: 0.99,
      });
    }
    // smoke column
    for (let i = 0; i < 12; i++) {
      this.smoke.spawn({
        x: pos.x + (Math.random() - 0.5) * 1.6, y: pos.y + Math.random() * 0.8, z: pos.z + (Math.random() - 0.5) * 1.6,
        vx: (Math.random() - 0.5) * 2, vy: 1.5 + Math.random() * 2.4, vz: (Math.random() - 0.5) * 2,
        life: 1.1 + Math.random() * 0.7, size0: radius * 0.35, size1: radius * 1.5,
        c0: smokeC, c1: [0.25, 0.24, 0.24], a0: 0.55, a1: 0, drag: 0.955, gravity: 0.6,
      });
    }
    // shockwave shell + ring
    this._shell(pos, isPink ? 0xfff0ff : 0xffc890, radius * 1.5, 0.3);
    this._ring(pos, isPink ? 0xff7cd0 : 0x4fa8ff, radius * 1.7, 0.5);
    if (isPink) this._ring(pos, 0xffffff, radius * 1.2, 0.32);
    this._flash(pos, isPink ? 0xffd7f2 : 0xffa050, 110, 0.35, 40);
    this._decal(pos, radius * 0.55);
  }

  /** Steam puff (reload / venting). */
  steam(pos, count = 9, spread = 0.3) {
    for (let i = 0; i < count; i++) {
      this.smoke.spawn({
        x: pos.x + (Math.random() - 0.5) * spread,
        y: pos.y + (Math.random() - 0.5) * spread,
        z: pos.z + (Math.random() - 0.5) * spread,
        vx: (Math.random() - 0.5) * 0.7, vy: 0.9 + Math.random() * 0.9, vz: (Math.random() - 0.5) * 0.7,
        life: 0.5 + Math.random() * 0.4, size0: 0.14, size1: 0.65,
        c0: [0.95, 0.97, 1], c1: [0.85, 0.9, 0.95], a0: 0.55, a1: 0, drag: 0.93,
      });
    }
  }

  /** Glass panel shatter. */
  glassBurst(pos, sizeX, sizeZ) {
    for (let i = 0; i < 22; i++) {
      this.spark.spawn({
        x: pos.x + (Math.random() - 0.5) * sizeX, y: pos.y, z: pos.z + (Math.random() - 0.5) * sizeZ,
        vx: (Math.random() - 0.5) * 4, vy: Math.random() * 2.2, vz: (Math.random() - 0.5) * 4,
        life: 0.7 + Math.random() * 0.5, size0: 0.14, size1: 0.03,
        c0: [0.75, 0.92, 1], c1: [0.6, 0.8, 0.95], a0: 0.95, a1: 0, gravity: -16, drag: 0.995,
      });
    }
    this.glow.spawn({
      x: pos.x, y: pos.y, z: pos.z, life: 0.15, size0: sizeX * 0.5, size1: 0.2,
      c0: [0.8, 0.95, 1], c1: [0.8, 0.95, 1], a0: 0.5, a1: 0,
    });
  }

  /** Jetpack flame burst particles (world-space). */
  jetFlame(pos, dir, colorHex, scale = 1) {
    const c = new THREE.Color(colorHex);
    this.glow.spawn({
      x: pos.x + (Math.random() - 0.5) * 0.08, y: pos.y, z: pos.z + (Math.random() - 0.5) * 0.08,
      vx: dir.x * 2 + (Math.random() - 0.5), vy: dir.y * 2 + (Math.random() - 0.5), vz: dir.z * 2 + (Math.random() - 0.5),
      life: 0.14 + Math.random() * 0.1, size0: 0.32 * scale, size1: 0.05,
      c0: [1, 0.9, 0.7], c1: [c.r, c.g, c.b], a0: 0.9, a1: 0, gravity: 0,
    });
  }

  killEffect(pos) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 8;
      this.spark.spawn({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * s, vy: Math.random() * 7, vz: Math.sin(a) * s,
        life: 0.3 + Math.random() * 0.3, size0: 0.2, size1: 0.02,
        c0: [1, 0.85, 0.5], c1: [1, 0.4, 0.15], a0: 1, a1: 0, gravity: -18, drag: 0.99,
      });
    }
    this.glow.spawn({
      x: pos.x, y: pos.y, z: pos.z, life: 0.18, size0: 1.4, size1: 0.4,
      c0: [1, 0.7, 0.4], c1: [1, 0.4, 0.2], a0: 0.9, a1: 0,
    });
  }

  update(dt) {
    this.glow.update(dt);
    this.spark.update(dt);
    this.smoke.update(dt);

    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.life += dt;
      const k = r.life / r.maxLife;
      if (k >= 1) { r.mesh.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 2.4);
      const s = Math.max(0.05, r.maxR * e);
      r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = (1 - k) * 0.85;
    }

    for (const s of this.shells) {
      if (!s.mesh.visible) continue;
      s.life += dt;
      const k = s.life / s.maxLife;
      if (k >= 1) { s.mesh.visible = false; continue; }
      s.mesh.scale.setScalar(Math.max(0.05, s.maxR * (1 - Math.pow(1 - k, 2))));
      s.mesh.material.opacity = (1 - k) * 0.22;
    }

    for (const l of this.lights) {
      if (!l.light.visible) continue;
      l.life += dt;
      const k = l.life / l.maxLife;
      if (k >= 1) { l.light.visible = false; l.light.intensity = 0; continue; }
      l.light.intensity = l.base * (1 - k) * (1 - k);
    }

    for (const d of this.decals) {
      if (!d.mesh.visible) continue;
      d.life += dt;
      if (d.life > 14) { d.mesh.visible = false; continue; }
      if (d.life > 10) d.mesh.material.opacity = 0.75 * (1 - (d.life - 10) / 4);
    }
  }
}
