import * as THREE from 'three';
import { COLORS } from './config.js';
import { buildCanyon } from './canyon.js';
import { deckTexture, panelWallTexture, hazardTexture, crackTexture, glowSprite } from './textures.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.colliders = [];       // { min, max, glass?, canister?, dynamic? }
    this.losMeshes = [];       // meshes for raycast LOS / bullet stops
    this.glassPanels = [];     // breakable bridge floor panels
    this.canisters = [];       // explosive fuel canisters
    this.hoverCrates = [];
    this.holoMats = [];
    this.time = 0;
    this.doorOpenT = -1;       // <0 = not started

    this._buildSkyEnvironment(renderer);
    this._buildLights();
    this._buildCanyon();
    this._buildDeck();
    this._buildHangar();
    this._buildWestPadAndShuttle();
    this._buildEastPad();
    this._buildSkyBridge();
    this._buildRadarTower();
    this._buildCatwalk();
    this._buildCrates();
    this._buildCanisters();
    this._buildContainers();
    this._buildUtilityBuilding();
    this._buildLightPoles();
    this._buildHoloSigns();
  }

  // ---------- colliders ----------
  addBoxCollider(cx, cy, cz, sx, sy, sz, opts = {}) {
    const c = {
      min: V3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
      max: V3(cx + sx / 2, cy + sy / 2, cz + sz / 2),
      ...opts,
    };
    this.colliders.push(c);
    return c;
  }

  /** Highest walkable surface under (x,z) at or below maxY. */
  groundTop(x, z, maxY) {
    let best = -Infinity;
    for (const c of this.colliders) {
      if (c.gone) continue;
      if (x >= c.min.x && x <= c.max.x && z >= c.min.z && z <= c.max.z) {
        if (c.max.y <= maxY + 0.01 && c.max.y > best) best = c.max.y;
      }
    }
    return best;
  }

  // ---------- sky / env ----------
  _buildSkyEnvironment(renderer) {
    // gradient dome
    const skyGeo = new THREE.SphereGeometry(900, 32, 18);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(COLORS.skyTop) },
        horizon: { value: new THREE.Color(COLORS.skyHorizon) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y;
          float t = smoothstep(-0.04, 0.42, h);
          vec3 col = mix(horizon, top, t);
          // sun-side warm tint
          col += vec3(0.10, 0.06, 0.0) * pow(max(0.0, 1.0 - abs(h)), 6.0);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // sun disc + halo sprite
    this.sunDir = V3(0.42, 0.82, 0.38).normalize();
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(255,248,230,1)', 'rgba(255,240,210,0)'),
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    halo.scale.set(150, 150, 1);
    halo.position.copy(this.sunDir).multiplyScalar(820);
    this.scene.add(halo);

    // environment map for PBR reflections (chrome rifle, glass, shuttles)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(skyGeo.clone(), skyMat.clone()));
    const groundDisc = new THREE.Mesh(
      new THREE.CircleGeometry(120, 24),
      new THREE.MeshBasicMaterial({ color: 0x6a4c3c })
    );
    groundDisc.rotation.x = -Math.PI / 2;
    groundDisc.position.y = -30;
    envScene.add(groundDisc);
    const sunBall = new THREE.Mesh(
      new THREE.SphereGeometry(30, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff6e0 })
    );
    sunBall.position.copy(this.sunDir).multiplyScalar(500);
    envScene.add(sunBall);
    this.envMap = pmrem.fromScene(envScene, 0.04).texture;
    this.scene.environment = this.envMap;
    this.scene.fog = new THREE.FogExp2(COLORS.fog, 0.00085);
  }

  _buildLights() {
    const sun = new THREE.DirectionalLight(COLORS.sunColor, 3.1);
    sun.position.copy(this.sunDir).multiplyScalar(140);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -85; sun.shadow.camera.right = 85;
    sun.shadow.camera.top = 85; sun.shadow.camera.bottom = -85;
    sun.shadow.camera.near = 20; sun.shadow.camera.far = 320;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 1;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    const hemi = new THREE.HemisphereLight(0xbfdfff, 0xc9a580, 0.85);
    this.scene.add(hemi);
  }

  // ---------- canyon ----------
  _buildCanyon() {
    buildCanyon(this.scene);
  }

  // ---------- main deck ----------
  _buildDeck() {
    const tex = deckTexture();
    tex.repeat.set(24, 18);
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.72, metalness: 0.35 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(120, 44, 90), mat);
    deck.position.set(0, -22, 0);
    deck.receiveShadow = true;
    deck.castShadow = false;
    this.scene.add(deck);
    this.losMeshes.push(deck);
    this.addBoxCollider(0, -22, 0, 120, 44, 90, { deck: true });

    // hazard-striped rim along deck edges (visual)
    const hz = hazardTexture();
    hz.repeat.set(30, 1);
    const rimMat = new THREE.MeshStandardMaterial({ map: hz, roughness: 0.8 });
    const rimGeo = new THREE.BoxGeometry(120, 0.12, 0.7);
    for (const [x, z] of [[0, 44.6], [0, -44.6]]) {
      const r = new THREE.Mesh(rimGeo, rimMat);
      r.position.set(x, 0.07, z);
      this.scene.add(r);
    }
    const rimGeo2 = new THREE.BoxGeometry(0.7, 0.12, 90);
    for (const [x, z] of [[-59.6, 0], [59.6, 0]]) {
      const r = new THREE.Mesh(rimGeo2, rimMat);
      r.position.set(x, 0.07, z);
      this.scene.add(r);
    }
  }

  // ---------- hangar ----------
  _buildHangar() {
    const tex = panelWallTexture();
    const white = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.12, envMapIntensity: 0.7 });
    const trim = new THREE.MeshStandardMaterial({ color: COLORS.buildingTrim, roughness: 0.55, metalness: 0.4 });
    const tealMat = new THREE.MeshStandardMaterial({
      color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 2.2, roughness: 0.4,
    });

    const cx = -25, cz = -35, w = 31, d = 19, h = 12;
    const g = new THREE.Group();

    const mkWall = (sx, sy, sz, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), white);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m); this.losMeshes.push(m);
      return m;
    };
    // left / right / back
    mkWall(1, h, d, cx - w / 2, h / 2, cz).material = white;
    mkWall(1, h, d, cx + w / 2, h / 2, cz);
    mkWall(w, h, 1, cx, h / 2, cz - d / 2);
    // front segments (door opening: x in [-30,-20], h 8)
    mkWall(10, h, 1, cx - 15.5, h / 2, cz + d / 2);
    mkWall(10, h, 1, cx + 15.5, h / 2, cz + d / 2);
    mkWall(11, 4, 1, cx, 10, cz + d / 2); // lintel

    // flat modern roof + crown
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 2.2, d + 1.4), white);
    roof.position.set(cx, h + 1.1, cz);
    roof.castShadow = true;
    g.add(roof); this.losMeshes.push(roof);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 0.9, 0.6), trim);
    crown.position.set(cx + 4, h + 2.6, cz);
    g.add(crown);
    // door pocket (hides the door as it retracts upward)
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(11.4, 4.8, 0.9), white);
    pocket.position.set(cx, 10.1, cz + d / 2);
    g.add(pocket);

    // teal trim strips around door
    const strip = (sx, sy, sz, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), tealMat);
      m.position.set(x, y, z); g.add(m);
    };
    strip(0.25, 8.4, 0.25, cx - 5.1, 4.2, cz + d / 2 + 0.08);
    strip(0.25, 8.4, 0.25, cx + 5.1, 4.2, cz + d / 2 + 0.08);
    strip(10.4, 0.25, 0.25, cx, 8.45, cz + d / 2 + 0.08);

    // dark interior backwall glow
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(w - 2, h - 2),
      new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.9 }));
    inner.position.set(cx, h / 2, cz - d / 2 + 0.6);
    inner.rotation.y = Math.PI;
    g.add(inner);

    // sliding door
    const doorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.2, transparent: true });
    const door = new THREE.Mesh(new THREE.BoxGeometry(10.6, 8, 0.5), doorMat);
    door.position.set(cx, 4, cz + d / 2);
    door.castShadow = true;
    g.add(door); this.losMeshes.push(door);
    const doorLight = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.3, 0.1), tealMat);
    doorLight.position.set(0, -3.7, 0.3);
    door.add(doorLight);
    this.door = { mesh: door, baseY: 4, collider: this.addBoxCollider(cx, 4, cz + d / 2, 10.6, 8, 0.5) };

    this.scene.add(g);
    // static colliders
    this.addBoxCollider(cx - w / 2, h / 2, cz, 1, h, d);
    this.addBoxCollider(cx + w / 2, h / 2, cz, 1, h, d);
    this.addBoxCollider(cx, h / 2, cz - d / 2, w, h, 1);
    this.addBoxCollider(cx - 15.5, h / 2, cz + d / 2, 10, h, 1);
    this.addBoxCollider(cx + 15.5, h / 2, cz + d / 2, 10, h, 1);
    this.addBoxCollider(cx, 10, cz + d / 2, 11, 4.6, 1.2);
    this.addBoxCollider(cx, h + 1.1, cz, w + 1.4, 2.2, d + 1.4); // roof solid
  }

  openHangarDoor() { if (this.doorOpenT < 0) this.doorOpenT = 0; }

  /** Restore all destructible/movable state for a fresh round. */
  resetDynamic() {
    // hangar door closed
    this.doorOpenT = -1;
    this.door.mesh.position.y = this.door.baseY;
    this.door.mesh.material.opacity = 1;
    const dc = this.door.collider;
    dc.min.y = this.door.baseY - 4; dc.max.y = this.door.baseY + 4; dc.gone = false;
    // fuel canisters
    for (const can of this.canisters) {
      can.alive = true; can.hp = 30;
      can.grp.visible = true;
      can.collider.gone = false;
    }
    // sky bridge glass
    for (const p of this.glassPanels) {
      p.alive = true; p.hp = 70;
      p.mesh.visible = true;
      p.crack.visible = true;
      p.crack.material.opacity = 0;
      p.collider.gone = false;
    }
  }

  // ---------- west landing pad + shuttle ----------
  _buildWestPadAndShuttle() {
    const padMat = new THREE.MeshStandardMaterial({ color: COLORS.padDark, roughness: 0.6, metalness: 0.45 });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(17, 0.5, 17), padMat);
    pad.position.set(-38, 0.25, 8);
    pad.receiveShadow = true;
    this.scene.add(pad); this.losMeshes.push(pad);
    this.addBoxCollider(-38, 0.25, 8, 17, 0.5, 17);

    // teal edge ring + yellow markings
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(8.2, 0.09, 8, 48),
      new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 2.4 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-38, 0.54, 8);
    this.scene.add(ring);
    this.edgeRings = [ring];

    const line = new THREE.Mesh(
      new THREE.RingGeometry(7.2, 7.45, 40),
      new THREE.MeshBasicMaterial({ color: 0xe8c93c, side: THREE.DoubleSide })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(-38, 0.512, 8);
    this.scene.add(line);

    // ---- cargo shuttle (original design) ----
    const hull = new THREE.MeshStandardMaterial({ color: COLORS.shuttleWhite, roughness: 0.32, metalness: 0.55, envMapIntensity: 1.0 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3c4147, roughness: 0.5, metalness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x18333e, roughness: 0.1, metalness: 0.6, envMapIntensity: 1.4,
    });
    const tealMat = new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 1.8 });

    const sh = new THREE.Group();
    sh.position.set(-38, 0.5, 8);
    // fuselage
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.7, 8.6, 6, 14), hull);
    body.rotation.z = Math.PI / 2;
    body.position.y = 2.5;
    body.castShadow = true;
    sh.add(body); this.losMeshes.push(body);
    // cockpit canopy
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.25, 12, 10), glassMat);
    canopy.scale.set(1.6, 0.7, 0.95);
    canopy.position.set(4.6, 2.9, 0);
    sh.add(canopy);
    // belly keel
    const keel = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 2.4), dark);
    keel.position.y = 1.35;
    sh.add(keel);
    // wings
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.28, 3.4), hull);
      wing.position.set(-0.6, 1.6, s * 2.6);
      wing.rotation.x = s * 0.14;
      wing.castShadow = true;
      sh.add(wing); this.losMeshes.push(wing);
      const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 2.2, 10), dark);
      nac.rotation.z = Math.PI / 2;
      nac.position.set(-2.4, 1.85, s * 2.9);
      sh.add(nac);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), tealMat);
      glow.rotation.y = -Math.PI / 2;
      glow.position.set(-3.55, 1.85, s * 2.9);
      sh.add(glow);
      // landing gear leg
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.7, 8), dark);
      leg.position.set(-2.6, 0.85, s * 2.4);
      leg.castShadow = true;
      sh.add(leg); this.losMeshes.push(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.7), dark);
      foot.position.set(-2.6, 0.07, s * 2.4);
      sh.add(foot);
    }
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.7, 8), dark);
      leg.position.set(3.4, 0.85, s * 1.2);
      leg.castShadow = true;
      sh.add(leg); this.losMeshes.push(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.7), dark);
      foot.position.set(3.4, 0.07, s * 1.2);
      sh.add(foot);
    }
    // tail fin
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.9, 0.22), hull);
    fin.position.set(-4.6, 3.6, 0);
    fin.rotation.z = 0.35;
    fin.castShadow = true;
    sh.add(fin);
    // teal spine accent
    const spine = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.06, 0.16), tealMat);
    spine.position.set(0.4, 4.15, 0);
    sh.add(spine);

    this.scene.add(sh);
    // colliders: hull + wings + 4 legs (cover!)
    this.addBoxCollider(-38, 2.5, 8, 11.5, 2.9, 3.6);
    this.addBoxCollider(-38.6, 1.6, 8, 4.6, 0.4, 7.2);
    for (const [lx, lz] of [[-40.6, 5.6], [-40.6, 10.4], [-34.6, 5.6], [-34.6, 10.4]]) {
      this.addBoxCollider(lx, 1.3, lz, 0.55, 1.7, 0.55);
    }
  }

  // ---------- east elevated pad ----------
  _buildEastPad() {
    const padMat = new THREE.MeshStandardMaterial({ color: COLORS.padDark, roughness: 0.6, metalness: 0.45 });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 18), padMat);
    pad.position.set(38, 4.75, -10);
    pad.castShadow = true; pad.receiveShadow = true;
    this.scene.add(pad); this.losMeshes.push(pad);
    this.addBoxCollider(38, 4.75, -10, 18, 0.5, 18);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(8.6, 0.09, 8, 48),
      new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 2.4 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(38, 5.04, -10);
    this.scene.add(ring);
    this.edgeRings.push(ring);

    // support pillars
    const pillMat = new THREE.MeshStandardMaterial({ color: 0x565c63, roughness: 0.6, metalness: 0.5 });
    for (const [px, pz] of [[31.5, -16.5], [44.5, -16.5], [31.5, -3.5], [44.5, -3.5]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.0, 4.5, 1.0), pillMat);
      p.position.set(px, 2.25, pz);
      p.castShadow = true;
      this.scene.add(p); this.losMeshes.push(p);
      this.addBoxCollider(px, 2.25, pz, 1.0, 4.5, 1.0);
    }
    // diagonal braces (visual)
    const braceMat = new THREE.MeshStandardMaterial({ color: 0x494f56, roughness: 0.6, metalness: 0.5 });
    for (const [ax, az, bx, bz] of [[31.5, -16.5, 44.5, -16.5], [31.5, -3.5, 44.5, -3.5], [31.5, -16.5, 31.5, -3.5], [44.5, -16.5, 44.5, -3.5]]) {
      const mid = V3((ax + bx) / 2, 2.25, (az + bz) / 2);
      const len = Math.hypot(bx - ax, bz - az);
      const br = new THREE.Mesh(new THREE.BoxGeometry(len, 0.28, 0.28), braceMat);
      br.position.copy(mid);
      br.rotation.y = Math.atan2(bz - az, bx - ax);
      this.scene.add(br);
    }

    // small radar dish on the pad
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0xdadfe3, roughness: 0.4, metalness: 0.6 }));
    pole.position.set(44, 6.5, -15);
    pole.castShadow = true;
    this.scene.add(pole);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.4),
      new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }));
    dish.position.set(44, 8.2, -15);
    dish.rotation.x = Math.PI * 0.62;
    dish.castShadow = true;
    this.scene.add(dish);
    this.smallDish = dish;
  }

  // ---------- glass sky bridge ----------
  _buildSkyBridge() {
    // access tower at deck level -> y5 platform at x=10..13.5 area
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x565c63, roughness: 0.55, metalness: 0.5 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.5, 6.5), towerMat);
    tower.position.set(9.5, 4.75, -10);
    tower.castShadow = true; tower.receiveShadow = true;
    this.scene.add(tower); this.losMeshes.push(tower);
    this.addBoxCollider(9.5, 4.75, -10, 6.5, 0.5, 6.5);
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.5, 1.6), towerMat);
    pillar.position.set(9.5, 2.25, -10);
    pillar.castShadow = true;
    this.scene.add(pillar); this.losMeshes.push(pillar);
    this.addBoxCollider(9.5, 2.25, -10, 1.6, 4.5, 1.6);

    // glass panels from x=13 to x=29 at y=5
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xbfe8ff, transparent: true, opacity: 0.26, roughness: 0.05,
      metalness: 0, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false,
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.5, metalness: 0.6 });
    const crackTex = crackTexture();

    const N = 6, x0 = 13, x1 = 28.6, segLen = (x1 - x0) / N;
    for (let i = 0; i < N; i++) {
      const cx = x0 + segLen * (i + 0.5);

      const floorPanel = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.14, 3), glassMat);
      floorPanel.position.set(cx, 4.93, -10);
      floorPanel.renderOrder = 3;
      this.scene.add(floorPanel);

      const col = this.addBoxCollider(cx, 4.93, -10, segLen, 0.14, 3, { glass: true });
      const panel = {
        mesh: floorPanel, collider: col, hp: 70, alive: true, crack: null,
        pos: V3(cx, 4.93, -10), size: V3(segLen, 0.14, 3),
      };
      col.glassPanel = panel;
      this.glassPanels.push(panel);

      // crack overlay (hidden until damaged)
      const crack = new THREE.Mesh(
        new THREE.PlaneGeometry(segLen * 0.9, 2.6),
        new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, opacity: 0, depthWrite: false })
      );
      crack.rotation.x = -Math.PI / 2;
      crack.position.set(cx, 5.012, -10);
      crack.renderOrder = 4;
      this.scene.add(crack);
      panel.crack = crack;

      // side glass walls
      for (const s of [-1, 1]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(segLen, 1.05, 0.08), glassMat);
        wall.position.set(cx, 5.55, -10 + s * 1.5);
        wall.renderOrder = 3;
        this.scene.add(wall);
        this.addBoxCollider(cx, 5.55, -10 + s * 1.5, segLen, 1.05, 0.08);
      }
      // top rail
      const rail = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.1, 0.12), frameMat);
      rail.position.set(cx, 6.1, -10 - 1.5);
      this.scene.add(rail);
      const rail2 = rail.clone();
      rail2.position.z = -10 + 1.5;
      this.scene.add(rail2);
    }
    // support struts under bridge (visual)
    for (let i = 1; i < N; i++) {
      const cx = x0 + segLen * i;
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.85, 0.18), frameMat);
      strut.position.set(cx, 2.5, -10);
      this.scene.add(strut);
    }
  }

  // ---------- radar dish tower (grenade set piece) ----------
  _buildRadarTower() {
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xeef1f3, roughness: 0.4, metalness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3c4147, roughness: 0.5, metalness: 0.6 });

    // base + mast
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 3.4), dark);
    base.position.set(-45, 0.6, -22);
    base.castShadow = true;
    g.add(base); this.losMeshes.push(base);
    this.addBoxCollider(-45, 0.6, -22, 3.4, 1.2, 3.4);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 12, 10), white);
    mast.position.set(-45, 7, -22);
    mast.castShadow = true;
    g.add(mast); this.losMeshes.push(mast);
    this.addBoxCollider(-45, 7, -22, 1.0, 12, 1.0);

    // yoke + dish
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), dark);
    yoke.position.set(-45, 13.4, -22);
    g.add(yoke);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2.6),
      new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.42, metalness: 0.25, side: THREE.DoubleSide })
    );
    dish.position.set(-45, 14.6, -22);
    dish.rotation.x = Math.PI * 0.68;
    dish.castShadow = true;
    g.add(dish); this.losMeshes.push(dish);
    // feed horn
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), dark);
    feed.position.set(-45, 15.9, -20.6);
    feed.rotation.x = Math.PI * 0.32;
    g.add(feed);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), dark);
    tip.position.set(-45, 16.4, -19.8);
    g.add(tip);

    // blinking beacon
    const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff3fae, emissive: 0xff3fae, emissiveIntensity: 3 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), beaconMat);
    beacon.position.set(-45, 13.2, -21.4);
    g.add(beacon);

    this.scene.add(g);
    this.radarDish = dish;
    this.radarBeacon = beaconMat;
    // AABB around dish so grenades stick + bolts stop
    this.addBoxCollider(-45, 15.2, -21.2, 5.6, 3.4, 3.4);
  }

  // ---------- south catwalk ----------
  _buildCatwalk() {
    const grateMat = new THREE.MeshStandardMaterial({ color: 0x535a62, roughness: 0.7, metalness: 0.45 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa2aa, roughness: 0.35, metalness: 0.7 });
    const colMat = new THREE.MeshStandardMaterial({ color: 0x565c63, roughness: 0.6, metalness: 0.5 });

    const y = 4.2, z = 41, x0 = -20, x1 = 28;
    const len = x1 - x0;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(len, 0.4, 2.6), grateMat);
    floor.position.set((x0 + x1) / 2, y - 0.2, z);
    floor.castShadow = true; floor.receiveShadow = true;
    this.scene.add(floor); this.losMeshes.push(floor);
    this.addBoxCollider((x0 + x1) / 2, y - 0.2, z, len, 0.4, 2.6);

    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.09), railMat);
      rail.position.set((x0 + x1) / 2, y + 0.85, z + s * 1.26);
      this.scene.add(rail);
      const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.16), railMat);
      top.position.set((x0 + x1) / 2, y + 1.32, z + s * 1.26);
      this.scene.add(top);
    }

    for (let x = x0 + 2; x <= x1 - 2; x += 8) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.42, y, 0.42), colMat);
      c.position.set(x, y / 2, z);
      c.castShadow = true;
      this.scene.add(c); this.losMeshes.push(c);
      this.addBoxCollider(x, y / 2, z, 0.42, y, 0.42);
    }
    // teal strip under catwalk edge
    const strip = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06),
      new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 1.6 }));
    strip.position.set((x0 + x1) / 2, y - 0.44, z - 1.32);
    this.scene.add(strip);
  }

  // ---------- hover crates ----------
  _buildCrates() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.crateTan, roughness: 0.65, metalness: 0.15 });
    const cornerMat = new THREE.MeshStandardMaterial({ color: COLORS.crateDark, roughness: 0.5, metalness: 0.4 });
    const glowMat = new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 2.2 });
    const positions = [
      [-8, 14], [-16, -2], [-12, -7.5], [-24, -19], [30, 3], [33, 7], [16, 35],
    ];
    for (const [x, z] of positions) {
      const grp = new THREE.Group();
      const size = 2.2;
      const body = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), bodyMat);
      body.castShadow = true; body.receiveShadow = true;
      grp.add(body); this.losMeshes.push(body);
      // black corner posts
      const cg = new THREE.BoxGeometry(0.3, size + 0.06, 0.3);
      for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const c = new THREE.Mesh(cg, cornerMat);
        c.position.set(sx * (size / 2 - 0.12), 0, sz * (size / 2 - 0.12));
        grp.add(c);
      }
      // teal underglow strip
      const strip = new THREE.Mesh(new THREE.BoxGeometry(size * 0.7, 0.08, size * 0.7), glowMat);
      strip.position.y = -size / 2 - 0.05;
      grp.add(strip);
      grp.position.set(x, 1.6, z);
      this.scene.add(grp);
      this.hoverCrates.push({ grp, baseY: 1.6, phase: Math.random() * Math.PI * 2 });
      this.addBoxCollider(x, 1.6, z, size, size, size);
    }
  }

  // ---------- fuel canisters ----------
  _buildCanisters() {
    const shellMat = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.5, metalness: 0.35 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.4, metalness: 0.7 });
    const positions = [
      [10, 41], [-6, 41], [26, 10], [-12, -23], [35.5, -15.5],
    ];
    for (const [x, z] of positions) {
      const top = this.groundTop(x, z, 50);
      const baseY = (top === -Infinity ? 0 : top);
      const grp = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.45, 14), shellMat.clone());
      shell.position.y = 0.72;
      shell.castShadow = true;
      grp.add(shell); this.losMeshes.push(shell);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.18, 14), capMat);
      cap.position.y = 1.52;
      grp.add(cap);
      const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.28, 8), capMat);
      valve.position.y = 1.7;
      grp.add(valve);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 16), capMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.1;
      grp.add(ring);
      grp.position.set(x, baseY, z);
      this.scene.add(grp);
      const col = this.addBoxCollider(x, baseY + 0.85, z, 1.1, 1.7, 1.1, { canister: true });
      const can = { grp, pos: V3(x, baseY + 0.9, z), hp: 30, alive: true, collider: col };
      col.canister = can;
      this.canisters.push(can);
    }
  }

  // ---------- stacked cargo containers ----------
  _buildContainers() {
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.crateTan, roughness: 0.7, metalness: 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: COLORS.crateDark, roughness: 0.55, metalness: 0.4 });
    const defs = [
      [-34, 1.3, 22, 6, 2.6, 2.6, 0], [-34, 3.9, 22, 6, 2.6, 2.6, 0],
      [-28.6, 1.3, 24.2, 2.6, 2.6, 6, 0], [-21, 1.3, 27.5, 6, 2.6, 2.6, 0.35],
    ];
    for (const [x, y, z, sx, sy, sz, ry] of defs) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), ry ? mat.clone() : mat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m); this.losMeshes.push(m);
      const corr = new THREE.Mesh(new THREE.BoxGeometry(sx * 1.01, sy * 0.9, sz * 1.01), dark);
      corr.position.set(x, y, z);
      corr.rotation.y = ry;
      corr.material = new THREE.MeshStandardMaterial({
        color: 0x000000, roughness: 0.8, wireframe: true, transparent: true, opacity: 0.18,
      });
      this.scene.add(corr);
      if (!ry) this.addBoxCollider(x, y, z, sx, sy, sz);
      else this.addBoxCollider(x, y, z, 5.6, 2.6, 5.6);
    }
  }

  // ---------- utility building ----------
  _buildUtilityBuilding() {
    const tex = panelWallTexture();
    const white = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.15 });
    const trim = new THREE.MeshStandardMaterial({ color: COLORS.buildingTrim, roughness: 0.55, metalness: 0.4 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(9, 4.4, 6.5), white);
    b.position.set(17, 2.2, 27);
    b.castShadow = true; b.receiveShadow = true;
    this.scene.add(b); this.losMeshes.push(b);
    this.addBoxCollider(17, 2.2, 27, 9, 4.4, 6.5);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.3, 7), trim);
    roof.position.set(17, 4.55, 27);
    this.scene.add(roof);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(9.05, 0.18, 0.06),
      new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 1.8 }));
    stripe.position.set(17, 3.6, 30.28);
    this.scene.add(stripe);
    // AC unit
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.4), trim);
    ac.position.set(15.5, 5.15, 27.5);
    ac.castShadow = true;
    this.scene.add(ac);
  }

  // ---------- light poles ----------
  _buildLightPoles() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x7d858d, roughness: 0.5, metalness: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 2.6 });
    for (const [x, z] of [[-20, 20], [18, 18], [-16, -12], [22, -24], [-50, -8]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 8), poleMat);
      p.position.set(x, 2.5, z);
      p.castShadow = true;
      this.scene.add(p); this.losMeshes.push(p);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), headMat);
      head.position.set(x, 5.05, z);
      this.scene.add(head);
      this.addBoxCollider(x, 2.5, z, 0.3, 5, 0.3);
    }
  }

  // ---------- holographic signs (abstract shapes only) ----------
  _buildHoloSigns() {
    const mkHolo = (x, y, z, ry, hue, size = 2.6) => {
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uHue: { value: new THREE.Color(hue) },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          uniform float uTime; uniform vec3 uHue; varying vec2 vUv;
          float sdBox(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.0))+min(max(d.x,d.y),0.0); }
          void main() {
            vec2 p = (vUv - 0.5) * vec2(1.6, 1.0);
            float a = 0.0;
            // rotating hex ring
            float ang = uTime * 0.7;
            mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
            vec2 q = R * p;
            float hex = abs(length(q) - 0.34) - 0.012;
            for (int i = 0; i < 6; i++) {
              float th = 3.14159/3.0*float(i) + uTime*0.7;
              vec2 c = vec2(cos(th), sin(th)) * 0.34;
              hex = min(hex, length(q - c) - 0.028);
            }
            a += smoothstep(0.006, 0.0, hex);
            // pulsing triangle
            vec2 t = R * R * p;
            t.y -= 0.02;
            float tri = abs(sdBox(t, vec2(0.10, 0.10)) - 0.06) - 0.008;
            a += smoothstep(0.005, 0.0, tri) * (0.6 + 0.4 * sin(uTime * 3.0));
            // scan bars
            float bar = step(0.5, fract(p.y * 9.0 - uTime * 0.8)) * step(abs(p.x), 0.05);
            a += bar * 0.35;
            // flicker + edge fade
            a *= 0.85 + 0.15 * sin(uTime * 23.0);
            float fade = smoothstep(0.8, 0.55, abs(vUv.x - 0.5)) * smoothstep(0.98, 0.8, abs(vUv.y - 0.5));
            gl_FragColor = vec4(uHue * a * fade * 1.6, a * fade);
          }`,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.62), mat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.renderOrder = 5;
      this.scene.add(m);
      // mount posts
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.5, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x3c4147, roughness: 0.5, metalness: 0.6 })
      );
      post.position.set(x, y - size * 0.42, z);
      post.rotation.y = ry;
      this.scene.add(post);
      this.holoMats.push(mat);
    };

    mkHolo(-25, 9.2, -25.3, 0, COLORS.teal, 3.2);        // hangar door top
    mkHolo(-14.5, 5.6, -25.2, 0.35, COLORS.pink, 2.2);   // hangar wall
    mkHolo(9.5, 6.4, -6.6, -0.2, COLORS.pink, 2.0);      // bridge tower
    mkHolo(29, 7.6, -2.8, -1.1, COLORS.teal, 2.2);       // east pad
  }

  // ---------- per-frame ----------
  update(dt, t) {
    this.time = t;
    for (const h of this.holoMats) h.uniforms.uTime.value = t;

    // hover crates bob
    for (const c of this.hoverCrates) {
      c.grp.position.y = c.baseY + Math.sin(t * 1.4 + c.phase) * 0.09;
    }

    // dishes track something far away
    if (this.radarDish) this.radarDish.rotation.z = Math.sin(t * 0.24) * 0.5;
    if (this.smallDish) this.smallDish.rotation.z = Math.cos(t * 0.3) * 0.4;
    if (this.radarBeacon) this.radarBeacon.emissiveIntensity = 2 + Math.sin(t * 4.4) * 1.6;

    // pad rings pulse gently
    if (this.edgeRings) {
      for (let i = 0; i < this.edgeRings.length; i++) {
        this.edgeRings[i].material.emissiveIntensity = 2.1 + Math.sin(t * 2 + i) * 0.5;
      }
    }

    // hangar door opening
    if (this.doorOpenT >= 0 && this.doorOpenT < 3) {
      this.doorOpenT += dt;
      const k = Math.min(1, this.doorOpenT / 2.4);
      const e = 1 - Math.pow(1 - k, 3);
      const y = this.door.baseY + e * 7.7;
      this.door.mesh.position.y = y;
      this.door.mesh.material.opacity = k < 0.55 ? 1 : Math.max(0, 1 - (k - 0.55) / 0.45);
      const c = this.door.collider;
      c.min.y = y - 4; c.max.y = y + 4;
      if (k >= 1) { c.gone = true; this.doorOpenT = 3; }
    }
  }
}
