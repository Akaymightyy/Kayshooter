import * as THREE from 'three';
import { COLORS, CONFIG } from './config.js';
import { gunScreenTexture, glowSprite } from './textures.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export class Player {
  constructor(ctx) {
    this.ctx = ctx; // { scene, camera, world, fx, audio, game, dom }
    this.pos = V3(-8, 0.01, 14);
    this.vel = V3(0, 0, 0);
    this.yaw = Math.PI;      // facing -Z initially (toward hangar side after turn)
    this.pitch = 0;
    this.alive = true;
    this.hp = CONFIG.PLAYER_HP;
    this.fuel = CONFIG.JET_MAX_FUEL;
    this.ammo = CONFIG.MAG_SIZE;
    this.grenades = CONFIG.GRENADES;
    this.grounded = true;
    this.lastDamageT = 99;
    this.regenT = 0;

    // input
    this.keys = {};
    this.mouseDown = false;
    this.fireCooldown = 0;
    this.reloadT = -1;
    this.inspectT = -1;
    this.boosting = false;
    this.sputtered = false;
    this.jetHandle = null;

    // camera feel
    this.walkCycle = 0;
    this.recoil = 0;
    this.recoilPitch = 0;
    this.swayX = 0; this.swayY = 0;
    this.landDip = 0;
    this.shake = 0;
    this.stepDist = 0;
    this.fov = CONFIG.FOV;

    // viewmodel
    this._buildViewmodel();

    // grenades in flight
    this.grenadesLive = [];
  }

  // ---------------- viewmodel ----------------
  _buildViewmodel() {
    const chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.62, envMapIntensity: 0.45 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.45, metalness: 0.7 });
    const glove = new THREE.MeshStandardMaterial({ color: 0x5e3fb8, roughness: 0.62, metalness: 0.12 });
    const gloveDark = new THREE.MeshStandardMaterial({ color: 0x4a2f96, roughness: 0.6, metalness: 0.15 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: COLORS.pink, emissive: COLORS.pink, emissiveIntensity: 2.6, toneMapped: false });
    const tealMat = new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 2.0, toneMapped: false });

    this.rig = new THREE.Group();
    this.gunGroup = new THREE.Group();
    this.rig.add(this.gunGroup);

    // --- rifle body ---
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.12, 0.52), chrome);
    this.gunGroup.add(receiver);
    const under = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.4), dark);
    under.position.set(0, -0.07, 0.02);
    this.gunGroup.add(under);
    // barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.34, 12), chrome);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.012, -0.42);
    this.gunGroup.add(barrel);
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 12), dark);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(0, 0.012, -0.28);
    this.gunGroup.add(shroud);
    // muzzle
    const muzzleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.09, 12), dark);
    muzzleMesh.rotation.x = Math.PI / 2;
    muzzleMesh.position.set(0, 0.012, -0.55);
    this.gunGroup.add(muzzleMesh);
    const muzzleGlow = new THREE.Mesh(new THREE.CircleGeometry(0.034, 12), tealMat);
    muzzleGlow.rotation.y = Math.PI;
    muzzleGlow.position.set(0, 0.012, -0.596);
    this.gunGroup.add(muzzleGlow);
    // stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.22), chrome);
    stock.position.set(0, -0.01, 0.33);
    stock.rotation.x = 0.08;
    this.gunGroup.add(stock);
    // top rail + handle
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.4), dark);
    rail.position.set(0, 0.075, -0.05);
    this.gunGroup.add(rail);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.1), dark);
    handle.position.set(0, 0.1, 0.06);
    this.gunGroup.add(handle);
    // grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.07), dark);
    grip.position.set(0, -0.12, 0.14);
    grip.rotation.x = 0.32;
    this.gunGroup.add(grip);
    // side screen
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.04),
      new THREE.MeshBasicMaterial({ map: gunScreenTexture(), toneMapped: false }));
    screen.position.set(0.039, 0.02, 0.05);
    screen.rotation.y = Math.PI / 2;
    this.gunGroup.add(screen);
    const screenL = screen.clone();
    screenL.position.x = -0.039;
    screenL.rotation.y = -Math.PI / 2;
    this.gunGroup.add(screenL);

    // --- energy cell (mag) with hot-pink + teal coils ---
    this.magGroup = new THREE.Group();
    const cellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.17, 12), dark);
    cellBody.rotation.z = Math.PI / 2;
    this.magGroup.add(cellBody);
    this.coilMats = [];
    for (let i = 0; i < 5; i++) {
      const isPink = i % 2 === 0;
      const mat = (isPink ? pinkMat : tealMat).clone();
      this.coilMats.push(mat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.011, 8, 18), mat);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = -0.06 + i * 0.03;
      this.magGroup.add(ring);
    }
    this.magGroup.position.set(0, -0.115, -0.05);
    this.gunGroup.add(this.magGroup);

    // --- purple gloves ---
    const mkHand = (scale, rot) => {
      const h = new THREE.Group();
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), glove);
      palm.scale.set(1.15, 0.8, 1.4);
      h.add(palm);
      for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.05, 2, 6), glove);
        f.position.set(-0.032 + i * 0.032, 0.01, -0.075);
        f.rotation.x = 1.25;
        h.add(f);
      }
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.04, 2, 6), glove);
      thumb.position.set(scale > 0 ? 0.045 : -0.045, 0.02, -0.03);
      thumb.rotation.z = scale > 0 ? -0.7 : 0.7;
      thumb.rotation.x = 0.5;
      h.add(thumb);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.09, 10), gloveDark);
      cuff.rotation.x = Math.PI / 2 - 0.5;
      cuff.position.set(0, -0.02, 0.1);
      h.add(cuff);
      h.position.z = 0.09;
      return h;
    };
    this.handR = mkHand(1);
    this.handR.position.set(0.005, -0.115, 0.16);
    this.handR.rotation.z = 0.15;
    this.gunGroup.add(this.handR);
    this.handL = mkHand(-1);
    this.handL.position.set(-0.005, -0.075, -0.22);
    this.handL.rotation.set(0.5, 0, 0.1);
    this.gunGroup.add(this.handL);
    // forearms angled off-screen
    const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 3, 8), gloveDark);
    armR.position.set(0.1, -0.22, 0.38);
    armR.rotation.set(1.15, 0.1, -0.35);
    this.gunGroup.add(armR);
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 3, 8), gloveDark);
    armL.position.set(-0.12, -0.18, -0.05);
    armL.rotation.set(1.35, -0.15, 0.3);
    this.gunGroup.add(armL);

    // muzzle anchor
    this.muzzleAnchor = new THREE.Object3D();
    this.muzzleAnchor.position.set(0, 0.012, -0.62);
    this.gunGroup.add(this.muzzleAnchor);

    // muzzle light
    this.muzzleLight = new THREE.PointLight(COLORS.pink, 0, 7, 2.0);
    this.muzzleLight.position.set(0, 0, -0.7);
    this.gunGroup.add(this.muzzleLight);

    // jet flames at lower frame edges (attached to camera rig)
    this.jetCones = [];
    const coneGeo = new THREE.ConeGeometry(0.09, 0.55, 10, 1, true);
    for (const s of [-1, 1]) {
      const m = new THREE.MeshBasicMaterial({
        color: COLORS.teal, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      });
      const cone = new THREE.Mesh(coneGeo, m);
      cone.position.set(s * 0.42, -0.52, -0.75);
      cone.rotation.x = 2.35;
      cone.rotation.z = s * 0.18;
      cone.visible = false;
      this.rig.add(cone);
      this.jetCones.push(cone);
    }

    // base transform
    this.rig.position.set(0.26, -0.28, -0.5);
    this.rig.rotation.set(0, -0.06, 0);
  }

  // ---------------- input ----------------
  onKey(code, down) {
    this.keys[code] = down;
    if (!down) return;
    if (code === 'KeyR') this.startReload();
    if (code === 'KeyF') this.startInspect();
    if (code === 'KeyG') this.throwGrenade();
  }

  look(dx, dy) {
    if (!this.alive) return;
    this.yaw -= dx * 0.0021;
    this.pitch -= dy * 0.0021;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    this.swayX += dx * 0.00045;
    this.swayY += dy * 0.00045;
    this.swayX = THREE.MathUtils.clamp(this.swayX, -0.06, 0.06);
    this.swayY = THREE.MathUtils.clamp(this.swayY, -0.06, 0.06);
  }

  get forward() {
    return new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
  }

  startReload() {
    if (this.reloadT >= 0 || this.inspectT >= 0 || !this.alive) return;
    if (this.ammo >= CONFIG.MAG_SIZE) return;
    this.reloadT = 0;
  }

  startInspect() {
    if (this.inspectT >= 0 || this.reloadT >= 0 || !this.alive) return;
    this.inspectT = 0;
  }

  // ---------------- grenades ----------------
  throwGrenade() {
    if (!this.alive || this.grenades <= 0) return;
    this.grenades--;
    const mesh = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.4, metalness: 0.7 })
    );
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 10, 8),
      new THREE.MeshStandardMaterial({ color: COLORS.pink, emissive: COLORS.pink, emissiveIntensity: 2.2, toneMapped: false })
    );
    core.position.y = 0.02;
    mesh.add(shell, core);
    const spawn = this.eyePos().addScaledVector(this.forward, 0.5);
    mesh.position.copy(spawn);
    this.ctx.scene.add(mesh);
    const vel = this.forward.clone().multiplyScalar(17).add(V3(0, 4.2, 0)).addScaledVector(this.vel, 0.5);
    this.grenadesLive.push({
      mesh, vel, stuck: false, fuse: 0, beeps: 0, spin: Math.random() * 6,
    });
    this.ctx.audio.throwWhoosh();
  }

  _updateGrenades(dt) {
    const world = this.ctx.world;
    for (let i = this.grenadesLive.length - 1; i >= 0; i--) {
      const g = this.grenadesLive[i];
      g.fuse += dt;
      if (!g.stuck) {
        g.vel.y -= CONFIG.GRAVITY * dt;
        const step = g.vel.clone().multiplyScalar(dt);
        const next = g.mesh.position.clone().add(step);
        // stick to any collider
        let stuck = false;
        for (const c of world.colliders) {
          if (c.gone) continue;
          if (next.x > c.min.x - 0.08 && next.x < c.max.x + 0.08 &&
              next.y > c.min.y - 0.08 && next.y < c.max.y + 0.08 &&
              next.z > c.min.z - 0.08 && next.z < c.max.z + 0.08) {
            // pull back to surface
            stuck = true;
            break;
          }
        }
        if (stuck) {
          g.stuck = true;
          g.vel.set(0, 0, 0);
          this.ctx.fx.impact(g.mesh.position, V3(0, 1, 0), COLORS.pink);
        } else {
          g.mesh.position.copy(next);
          g.spin += dt * 9;
          g.mesh.rotation.x = g.spin;
          g.mesh.rotation.z = g.spin * 0.6;
        }
      }
      // beeps at 0.2 / 0.6 / 1.0
      const beepTimes = [0.2, 0.6, 1.0];
      while (g.beeps < 3 && g.fuse > beepTimes[g.beeps]) {
        this.ctx.audio.beep();
        g.beeps++;
        g.mesh.children[1].material.emissiveIntensity = 5;
      }
      g.mesh.children[1].material.emissiveIntensity += (2.2 - g.mesh.children[1].material.emissiveIntensity) * dt * 6;
      if (g.fuse >= CONFIG.GRENADE_FUSE) {
        this.ctx.game.explodeGrenade(g.mesh.position.clone());
        this.ctx.scene.remove(g.mesh);
        this.grenadesLive.splice(i, 1);
      }
    }
  }

  // ---------------- combat ----------------
  eyePos() {
    return V3(this.pos.x, this.pos.y + CONFIG.EYE_HEIGHT, this.pos.z);
  }

  fire() {
    if (!this.alive || this.fireCooldown > 0 || this.reloadT >= 0 || this.inspectT >= 0) return;
    if (this.ammo <= 0) {
      this.fireCooldown = 0.25;
      this.ctx.audio.beep();
      this.startReload();
      return;
    }
    this.ammo--;
    this.fireCooldown = CONFIG.FIRE_INTERVAL;
    const muzzleWorld = this.muzzleAnchor.getWorldPosition(new THREE.Vector3());
    // aim at a point 55m along the crosshair ray, then converge from muzzle
    const aim = this.eyePos().addScaledVector(this.forward, 55);
    const dir = aim.sub(muzzleWorld).normalize();
    dir.x += (Math.random() - 0.5) * 0.006;
    dir.y += (Math.random() - 0.5) * 0.006;
    dir.z += (Math.random() - 0.5) * 0.006;
    dir.normalize();
    this.ctx.fx.boltSystem.spawn(muzzleWorld, dir, 'player', CONFIG.BOLT_SPEED, CONFIG.BOLT_LIFE, 1);
    this.ctx.fx.muzzle(muzzleWorld, this.forward, COLORS.pinkHot);
    this.muzzleLight.intensity = 22;
    this.recoil = Math.min(1.6, this.recoil + 1.0);
    this.recoilPitch += 0.011 + Math.random() * 0.004;
    this.ctx.audio.plasma(0);
    this.ctx.game.onPlayerShot();
  }

  takeDamage(dmg, fromPos) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.lastDamageT = 0;
    const dom = this.ctx.dom;
    dom.dmgVignette.style.transition = 'none';
    dom.dmgVignette.style.opacity = String(Math.min(0.85, 0.3 + (1 - this.hp / 100) * 0.5));
    requestAnimationFrame(() => {
      dom.dmgVignette.style.transition = 'opacity .45s ease-out';
      dom.dmgVignette.style.opacity = String(Math.max(0, (1 - this.hp / 100) * 0.25));
    });
    this.shake = Math.min(1, this.shake + 0.25);
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.ctx.game.onPlayerDeath();
    }
  }

  // ---------------- physics ----------------
  _aabbOverlap(c, px, py, pz) {
    return (
      px + CONFIG.PLAYER_HALF > c.min.x && px - CONFIG.PLAYER_HALF < c.max.x &&
      py + CONFIG.PLAYER_HEIGHT > c.min.y && py < c.max.y &&
      pz + CONFIG.PLAYER_HALF > c.min.z && pz - CONFIG.PLAYER_HALF < c.max.z
    );
  }

  _headroomFree(px, py, pz) {
    for (const c of this.ctx.world.colliders) {
      if (c.gone) continue;
      if (this._aabbOverlap(c, px, py, pz)) return false;
    }
    return true;
  }

  _resolveAxis(axis) {
    const p = this.pos;
    for (const c of this.ctx.world.colliders) {
      if (c.gone) continue;
      if (!this._aabbOverlap(c, p.x, p.y, p.z)) continue;
      // try step-up
      const stepH = c.max.y - p.y;
      if (stepH > 0 && stepH <= 0.62 && this.vel.y <= 0.01 && this._headroomFree(p.x, c.max.y + 0.01, p.z)) {
        p.y = c.max.y + 0.001;
        this.grounded = true;
        this.vel.y = 0;
        continue;
      }
      if (axis === 'x') {
        if (this.vel.x > 0) p.x = c.min.x - CONFIG.PLAYER_HALF - 0.001;
        else if (this.vel.x < 0) p.x = c.max.x + CONFIG.PLAYER_HALF + 0.001;
        this.vel.x = 0;
      } else if (axis === 'z') {
        if (this.vel.z > 0) p.z = c.min.z - CONFIG.PLAYER_HALF - 0.001;
        else if (this.vel.z < 0) p.z = c.max.z + CONFIG.PLAYER_HALF + 0.001;
        this.vel.z = 0;
      } else {
        if (this.vel.y <= 0) {
          p.y = c.max.y + 0.001;
          this.vel.y = 0;
          this.grounded = true;
        } else {
          p.y = c.min.y - CONFIG.PLAYER_HEIGHT - 0.001;
          this.vel.y = 0;
        }
      }
    }
  }

  update(dt, t) {
    const world = this.ctx.world;
    const keys = this.keys;

    if (this.alive) {
      // ---- movement input ----
      const f = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
      const s = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
      const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
      let wishX = (-sinY * f + cosY * s);
      let wishZ = (-cosY * f - sinY * s);
      const wl = Math.hypot(wishX, wishZ);
      if (wl > 0.001) { wishX /= wl; wishZ /= wl; }

      const accel = this.grounded ? CONFIG.ACCEL_GROUND : CONFIG.ACCEL_AIR;
      if (this.grounded) {
        // friction
        const fr = Math.exp(-CONFIG.FRICTION * dt);
        this.vel.x *= fr; this.vel.z *= fr;
      }
      const speedCap = CONFIG.MOVE_SPEED;
      this.vel.x += wishX * accel * dt;
      this.vel.z += wishZ * accel * dt;
      const hSpeed = Math.hypot(this.vel.x, this.vel.z);
      if (hSpeed > speedCap && wl > 0.001) {
        const k = speedCap / hSpeed;
        this.vel.x *= k; this.vel.z *= k;
      }

      // ---- jetpack ----
      const wantBoost = !!keys['Space'] && !this.grounded && this.fuel > 0;
      if (wantBoost) {
        this.vel.y += CONFIG.JET_THRUST * dt;
        if (wl > 0.001) {
          this.vel.x += wishX * CONFIG.JET_LATERAL_ASSIST * dt;
          this.vel.z += wishZ * CONFIG.JET_LATERAL_ASSIST * dt;
        }
        this.vel.y = Math.min(this.vel.y, 13.5);
        this.fuel -= dt;
        if (this.fuel <= 0) {
          this.fuel = 0;
          if (!this.sputtered) {
            this.sputtered = true;
            this.ctx.audio.sputter();
          }
        }
      }
      this.boosting = wantBoost && this.fuel > 0;

      // jump edge
      if (keys['Space'] && this.grounded && !this._spaceLatch) {
        this.vel.y = CONFIG.JUMP_VEL;
        this.grounded = false;
      }
      this._spaceLatch = !!keys['Space'];

      // recharge on ground
      if (this.grounded) {
        this.fuel = Math.min(CONFIG.JET_MAX_FUEL, this.fuel + CONFIG.JET_RECHARGE_RATE * dt);
        if (this.fuel > 1.0) this.sputtered = false;
      }

      // ---- integrate + collide ----
      const wasGrounded = this.grounded;
      const prevVy = this.vel.y;
      this.grounded = false;

      this.pos.x += this.vel.x * dt;
      this._resolveAxis('x');
      this.pos.z += this.vel.z * dt;
      this._resolveAxis('z');
      this.vel.y -= CONFIG.GRAVITY * dt;
      this.pos.y += this.vel.y * dt;
      this._resolveAxis('y');

      if (!this.grounded) {
        // snap check (walking down small steps)
        const g = world.groundTop(this.pos.x, this.pos.z, this.pos.y + 0.05);
        if (g !== -Infinity && this.pos.y - g < 0.12 && this.vel.y <= 0) {
          this.pos.y = g + 0.001;
          this.vel.y = 0;
          this.grounded = true;
        }
      }

      // landing
      if (this.grounded && !wasGrounded) {
        this.landDip = Math.min(0.14, Math.abs(prevVy) * 0.014);
        const onGlass = this._onGlass();
        this.ctx.audio.footstep(onGlass, Math.min(1, Math.abs(prevVy) / 9));
      }

      // footsteps
      if (this.grounded && hSpeed > 1.5) {
        this.stepDist += hSpeed * dt;
        if (this.stepDist > 2.6) {
          this.stepDist = 0;
          this.ctx.audio.footstep(this._onGlass(), 0.7);
        }
      }

      // canyon fall
      if (this.pos.y < CONFIG.CANYON_KILL_Y && this.alive) {
        this.takeDamage(999, this.pos);
      }

      // regen
      this.lastDamageT += dt;
      if (this.lastDamageT > CONFIG.REGEN_DELAY && this.hp < CONFIG.PLAYER_HP) {
        this.hp = Math.min(CONFIG.PLAYER_HP, this.hp + CONFIG.REGEN_RATE * dt);
      }

      // ---- firing ----
      this.fireCooldown -= dt;
      if (this.mouseDown) this.fire();

      // ---- reload / inspect timelines ----
      if (this.reloadT >= 0) {
        this.reloadT += dt;
        if (this.reloadT > 0.38 && !this._reloadSteam) {
          this._reloadSteam = true;
          const m = this.magGroup.getWorldPosition(new THREE.Vector3());
          this.ctx.fx.steam(m, 8, 0.12);
          this.ctx.audio.steam(0.9);
        }
        if (this.reloadT >= CONFIG.RELOAD_TIME) {
          this.reloadT = -1;
          this._reloadSteam = false;
          this.ammo = CONFIG.MAG_SIZE;
        }
      }
      if (this.inspectT >= 0) {
        this.inspectT += dt;
        const T = 1.5;
        if (this.inspectT > 0.4 && !this._inspSteam1) {
          this._inspSteam1 = true;
          this.ctx.fx.steam(this.magGroup.getWorldPosition(new THREE.Vector3()), 6, 0.1);
          this.ctx.audio.steam(0.7);
        }
        if (this.inspectT > 0.95 && !this._inspSteam2) {
          this._inspSteam2 = true;
          this.ctx.fx.steam(this.magGroup.getWorldPosition(new THREE.Vector3()), 6, 0.1);
        }
        if (this.inspectT >= T) this.inspectT = -1;
      }
      this._updateGrenades(dt);
    }

    this._updateViewmodel(dt, t);
    this._updateCamera(dt, t);
  }

  _onGlass() {
    for (const c of this.ctx.world.colliders) {
      if (c.gone || !c.glass) continue;
      if (this.pos.x + 0.3 > c.min.x && this.pos.x - 0.3 < c.max.x &&
          this.pos.z + 0.3 > c.min.z && this.pos.z - 0.3 < c.max.z &&
          Math.abs(this.pos.y - c.max.y) < 0.15) return true;
    }
    return false;
  }

  _updateViewmodel(dt, t) {
    const rig = this.rig, gun = this.gunGroup;

    // spring sway back
    this.swayX += -this.swayX * Math.min(1, dt * 8);
    this.swayY += -this.swayY * Math.min(1, dt * 8);

    // walk bob
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    const speedK = this.grounded ? Math.min(1, hSpeed / CONFIG.MOVE_SPEED) : 0;
    this.walkCycle += dt * (4 + hSpeed * 1.05);
    const bobY = Math.sin(this.walkCycle * 2) * 0.011 * speedK;
    const bobX = Math.sin(this.walkCycle) * 0.007 * speedK;

    // recoil spring
    this.recoil += -this.recoil * Math.min(1, dt * 11);
    this.recoilPitch += -this.recoilPitch * Math.min(1, dt * 9);
    this.landDip += -this.landDip * Math.min(1, dt * 7);

    // base + offsets
    let px = 0.26 + bobX - this.swayX * 0.7;
    let py = -0.28 + bobY + this.swayY * 0.6 - this.landDip * 0.5 + (this.grounded ? 0 : THREE.MathUtils.clamp(-this.vel.y * 0.006, -0.05, 0.05));
    let pz = -0.5 + this.recoil * 0.055;
    let rx = this.recoil * 0.1 + this.swayY * 0.5;
    let ry = -0.06 - this.swayX * 0.8;
    let rz = 0;

    // reload anim
    if (this.reloadT >= 0) {
      const k = this.reloadT / CONFIG.RELOAD_TIME;
      const pull = Math.sin(Math.min(1, k * 1.25) * Math.PI);
      rx -= pull * 0.5;
      py -= pull * 0.08;
      rz += pull * 0.55;
      // mag slides out
      const magPhase = THREE.MathUtils.smoothstep(k, 0.05, 0.3) - THREE.MathUtils.smoothstep(k, 0.55, 0.85);
      this.magGroup.position.y = -0.115 - magPhase * 0.16;
      this.magGroup.rotation.z = magPhase * 0.9;
    } else if (this.inspectT >= 0) {
      const k = this.inspectT / 1.5;
      const flip = THREE.MathUtils.smoothstep(k, 0.05, 0.55) - THREE.MathUtils.smoothstep(k, 0.6, 1.0);
      const wave = Math.sin(flip * Math.PI);
      rz += flip * Math.PI * 2;         // full horizontal flip
      rx -= wave * 0.45;
      py += wave * 0.05;
      px -= wave * 0.06;
      ry += wave * 0.3;
      const pulse = 1 + wave * 2.6;
      for (const m of this.coilMats) m.emissiveIntensity = 2.3 * pulse;
    } else {
      this.magGroup.position.y += (-0.115 - this.magGroup.position.y) * Math.min(1, dt * 12);
      this.magGroup.rotation.z += (0 - this.magGroup.rotation.z) * Math.min(1, dt * 12);
      const pulse = 1 + Math.sin(t * 3.2) * 0.18 + this.recoil * 1.8;
      for (const m of this.coilMats) m.emissiveIntensity = 2.3 * pulse;
    }

    // jetpack sway
    if (this.boosting) {
      rz += THREE.MathUtils.clamp(this.vel.x * Math.cos(this.yaw) - this.vel.z * Math.sin(this.yaw), -6, 6) * 0.006;
      py -= 0.012;
    }

    rig.position.set(px, py, pz);
    rig.rotation.set(rx, ry, rz);

    // muzzle light decay
    this.muzzleLight.intensity += -this.muzzleLight.intensity * Math.min(1, dt * 22);

    // jet cones + particles
    const showFlames = this.boosting && this.alive;
    for (const c of this.jetCones) {
      c.visible = showFlames;
      if (showFlames) {
        c.scale.y = 0.75 + Math.random() * 0.5;
        c.material.opacity = 0.4 + Math.random() * 0.25;
      }
    }
    const dom = this.ctx.dom;
    dom.boostVignette.style.opacity = showFlames ? '1' : '0';

    if (showFlames && Math.random() < 0.75) {
      // world-space teal trail below/behind the player
      const back = this.forward.clone().multiplyScalar(-0.8);
      this.ctx.fx.jetFlame(
        V3(this.pos.x + back.x, this.pos.y + 0.35, this.pos.z + back.z),
        V3(0, -1, 0), COLORS.tealHot, 1.35
      );
    }
    if (this.jetHandle && !showFlames) {
      this.jetHandle.stop();
      this.jetHandle = null;
    }
    if (showFlames && !this.jetHandle) {
      this.jetHandle = this.ctx.audio.startJet('teal');
    }
  }

  _updateCamera(dt, t) {
    if (this.ctx.game && this.ctx.game.demoMode) return; // demo fly-cam owns the camera
    const cam = this.ctx.camera;
    // shake
    this.shake += -this.shake * Math.min(1, dt * 5);
    const sh = this.shake * this.shake;
    const bobY = this.alive ? Math.sin(this.walkCycle * 2) * 0.02 * (this.grounded ? Math.min(1, Math.hypot(this.vel.x, this.vel.z) / CONFIG.MOVE_SPEED) : 0) : 0;

    let ex = this.pos.x, ey = this.pos.y + CONFIG.EYE_HEIGHT + bobY - this.landDip, ez = this.pos.z;
    if (!this.alive) {
      // death tumble: settle toward ground
      ey = this.pos.y + 0.5;
    }
    cam.position.set(
      ex + (Math.random() - 0.5) * sh * 0.12,
      ey + (Math.random() - 0.5) * sh * 0.12,
      ez + (Math.random() - 0.5) * sh * 0.12
    );
    const roll = (this.grounded ? -this.vel.dot(V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))) * 0.0035 : 0)
      + (this.alive ? 0 : 0.55);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch + this.recoilPitch, this.yaw, roll);

    // FOV
    const targetFov = this.boosting ? CONFIG.FOV_BOOST : CONFIG.FOV;
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 7);
    if (Math.abs(cam.fov - this.fov) > 0.05) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }

  reset(x, z, yaw) {
    this.pos.set(x, 0.01, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.alive = true;
    this.hp = CONFIG.PLAYER_HP;
    this.fuel = CONFIG.JET_MAX_FUEL;
    this.ammo = CONFIG.MAG_SIZE;
    this.grenades = CONFIG.GRENADES;
    this.reloadT = -1;
    this.inspectT = -1;
    this.recoil = 0;
    this.recoilPitch = 0;
    this.shake = 0;
    this.lastDamageT = 99;
    this.sputtered = false;
    for (const g of this.grenadesLive) this.ctx.scene.remove(g.mesh);
    this.grenadesLive = [];
    this.ctx.dom.dmgVignette.style.opacity = '0';
  }
}
