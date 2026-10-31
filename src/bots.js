import * as THREE from 'three';
import { COLORS, CONFIG } from './config.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const TEAMS = {
  enemy: {
    armor: 0x8b929b, dark: 0x4a4f56, accent: 0xd96f1e, visor: 0xff7a1a,
    flame: 0xff7a1a, boltColor: 0xffa63d, boltTeam: 'enemy',
  },
  ally: {
    armor: 0x6e6478, dark: 0x3c3744, accent: 0x7a4fd0, visor: 0x35e0d0,
    flame: 0x35e0d0, boltColor: 0xff5fc4, boltTeam: 'ally',
  },
};

export function buildBotMesh(teamKey) {
  const T = TEAMS[teamKey];
  const g = new THREE.Group();
  const armorMat = new THREE.MeshStandardMaterial({ color: T.armor, roughness: 0.55, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: T.dark, roughness: 0.5, metalness: 0.45 });
  const accentMat = new THREE.MeshStandardMaterial({ color: T.accent, roughness: 0.45, metalness: 0.4 });
  const visorMat = new THREE.MeshStandardMaterial({ color: T.visor, emissive: T.visor, emissiveIntensity: 2.4 });
  const flameMat = new THREE.MeshBasicMaterial({
    color: T.flame, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });

  const parts = {};
  const cast = (m) => { m.castShadow = true; return m; };

  // legs
  parts.legL = new THREE.Group();
  const legL = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.5, 3, 8), darkMat));
  legL.position.y = -0.3;
  parts.legL.add(legL);
  parts.legL.position.set(0.15, 0.82, 0);
  parts.legR = parts.legL.clone();
  parts.legR.position.x = -0.15;
  g.add(parts.legL, parts.legR);

  // torso
  parts.torso = cast(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), armorMat));
  parts.torso.position.y = 1.12;
  g.add(parts.torso);
  const chest = cast(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.1), accentMat));
  chest.position.set(0, 1.2, 0.17);
  g.add(chest);
  for (const s of [-1, 1]) {
    const pad = cast(new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), accentMat));
    pad.position.set(s * 0.31, 1.4, 0);
    g.add(pad);
  }

  // head
  parts.head = cast(new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 10), armorMat));
  parts.head.position.y = 1.68;
  g.add(parts.head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.06), visorMat);
  visor.position.set(0, 0.01, 0.14);
  parts.head.add(visor);

  // arms
  parts.armL = new THREE.Group();
  const armLMesh = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 3, 8), armorMat));
  armLMesh.position.y = -0.26;
  parts.armL.add(armLMesh);
  parts.armL.position.set(0.32, 1.36, 0);
  parts.armR = parts.armL.clone();
  parts.armR.position.x = -0.32;
  g.add(parts.armL, parts.armR);

  // gun (in right hand, pointing +Z)
  parts.gun = new THREE.Group();
  const gunBody = cast(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.5), darkMat));
  parts.gun.add(gunBody);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), darkMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.38;
  parts.gun.add(barrel);
  const cell = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.14), accentMat);
  cell.position.set(0, -0.09, 0.05);
  parts.gun.add(cell);
  parts.gun.position.set(-0.32, 1.12, 0.32);
  g.add(parts.gun);

  // jetpack
  parts.pack = new THREE.Group();
  const packBody = cast(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.18), darkMat));
  parts.pack.add(packBody);
  for (const s of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.14, 8), darkMat);
    nozzle.position.set(s * 0.11, -0.3, 0);
    parts.pack.add(nozzle);
  }
  parts.pack.position.set(0, 1.18, -0.26);
  g.add(parts.pack);

  // flame cones (visible only when thrusting)
  parts.flames = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.55, 8, 1, true), flameMat);
    f.position.set(s * 0.11, -0.62, 0);
    f.rotation.x = Math.PI;
    f.visible = false;
    parts.pack.add(f);
    parts.flames.push(f);
  }

  return { group: g, parts };
}

const _ray = new THREE.Raycaster();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class Bot {
  constructor(ctx, teamKey, x, y, z, name) {
    this.ctx = ctx; // { scene, world, fx, audio, game }
    this.team = teamKey;
    this.T = TEAMS[teamKey];
    this.name = name;
    this.hp = teamKey === 'enemy' ? CONFIG.BOT_HP : CONFIG.ALLY_HP;
    this.alive = true;
    this.pos = V3(x, y, z);
    this.vel = V3(0, 0, 0);
    this.yaw = 0;
    this.aimPitch = 0;
    this.grounded = false;
    this.state = 'patrol';
    this.patrolPts = [];
    this.patrolIdx = 0;
    this.waitT = 0;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 1 + Math.random() * 2;
    this.burstLeft = 0;
    this.nextFireT = 1 + Math.random() * 1.5;
    this.losT = 0;
    this.hasLOS = false;
    this.target = null;
    this.fuel = 4;
    this.thrusting = false;
    this.walkPhase = Math.random() * 10;
    this.speed = 3.4 + Math.random() * 0.8;
    this.isPusher = false;
    this.pushPath = null;
    this.pushIdx = 0;
    this.deadT = 0;

    const built = buildBotMesh(teamKey);
    this.group = built.group;
    this.parts = built.parts;
    this.ragdoll = null;
    ctx.scene.add(this.group);
    this.group.position.copy(this.pos);
  }

  get eyePos() { return _v1.set(this.pos.x, this.pos.y + 1.62, this.pos.z); }
  get chestPos() { return _v2.set(this.pos.x, this.pos.y + 1.15, this.pos.z); }

  hitSpheres() {
    return [
      { c: { x: this.pos.x, y: this.pos.y + 1.66, z: this.pos.z }, r: 0.23, head: true },
      { c: { x: this.pos.x, y: this.pos.y + 1.1, z: this.pos.z }, r: 0.45, head: false },
      { c: { x: this.pos.x, y: this.pos.y + 0.45, z: this.pos.z }, r: 0.38, head: false },
    ];
  }

  takeDamage(dmg, hitPos, fromPlayer, head, kickDir) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.ctx.fx.impact(hitPos, V3(0, 0.4, 0.9).normalize(), this.T.accent);
    if (this.hp <= 0) this.die(fromPlayer, kickDir);
  }

  die(fromPlayer, kickDir) {
    if (!this.alive) return;
    this.alive = false;
    this.deadT = 0;
    this.ctx.fx.killEffect(this.chestPos.clone());
    this._makeRagdoll(fromPlayer, kickDir);
    this.ctx.game.onBotDeath(this, fromPlayer);
  }

  _makeRagdoll(fromPlayer, kickDir) {
    let dir;
    if (kickDir) dir = _v1.copy(kickDir);
    else if (fromPlayer) dir = _v1.copy(this.ctx.player.pos).sub(this.pos).normalize();
    else dir = _v1.set(1, 0, 0);
    const kick = V3(dir.x * 4.5 + (Math.random() - 0.5) * 2, 3.5 + Math.random() * 2, dir.z * 4.5 + (Math.random() - 0.5) * 2);
    this.ragdoll = [];
    const grab = (obj, velScale = 1, isLimb = true) => {
      const wp = new THREE.Vector3();
      obj.getWorldPosition(wp);
      const wq = new THREE.Quaternion();
      obj.getWorldQuaternion(wq);
      const ws = new THREE.Vector3();
      obj.getWorldScale(ws);
      this.ctx.scene.attach(obj);
      this.ragdoll.push({
        obj,
        vel: V3(kick.x * velScale + (Math.random() - 0.5) * 3, kick.y * velScale + Math.random() * 2, kick.z * velScale + (Math.random() - 0.5) * 3),
        angVel: V3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9),
        radius: isLimb ? 0.22 : 0.3,
        bounced: false,
      });
    };
    grab(this.parts.head, 1.2);
    grab(this.parts.torso, 1, false);
    grab(this.parts.armL, 1.4);
    grab(this.parts.armR, 1.4);
    grab(this.parts.legL, 0.9);
    grab(this.parts.legR, 0.9);
    grab(this.parts.gun, 1.6);
    grab(this.parts.pack, 0.8);
    this.ctx.scene.remove(this.group);
  }

  _updateRagdoll(dt) {
    this.deadT += dt;
    let allStill = true;
    for (const r of this.ragdoll) {
      r.vel.y -= CONFIG.GRAVITY * dt * 0.9;
      r.obj.position.addScaledVector(r.vel, dt);
      r.obj.rotation.x += r.angVel.x * dt;
      r.obj.rotation.y += r.angVel.y * dt;
      r.obj.rotation.z += r.angVel.z * dt;
      const ground = this.ctx.world.groundTop(r.obj.position.x, r.obj.position.z, r.obj.position.y + 0.5);
      const floor = ground === -Infinity ? CONFIG.CANYON_KILL_Y - 20 : ground + r.radius;
      if (r.obj.position.y < floor) {
        r.obj.position.y = floor;
        if (r.vel.y < -2.5 && !r.bounced) {
          r.bounced = true;
          const d = this.pos.distanceTo(this.ctx.player.pos);
          this.ctx.audio.bodyFall(Math.max(0.15, 1 - d / 30));
        }
        r.vel.y *= -0.32;
        r.vel.x *= 0.6; r.vel.z *= 0.6;
        r.angVel.multiplyScalar(0.5);
      }
      if (r.vel.lengthSq() > 0.05) allStill = false;
    }
    // fade out near the end
    if (this.deadT > 6) {
      const k = Math.max(0, 1 - (this.deadT - 6) / 1.2);
      for (const r of this.ragdoll) r.obj.scale.setScalar(Math.max(0.001, k));
      if (k <= 0) this.ctx.game.removeBot(this);
    } else if (allStill && this.deadT > 2) {
      // keep bodies readable for a while (esports footage vibe), remove after 7.2s total
      if (this.deadT > 7.2) this.ctx.game.removeBot(this);
    }
  }

  _canSee(targetPos) {
    const eye = V3(this.pos.x, this.pos.y + 1.6, this.pos.z);
    const dir = targetPos.clone().sub(eye);
    const dist = dir.length();
    if (dist < 0.5) return true;
    dir.normalize();
    _ray.set(eye, dir);
    _ray.far = dist - 0.4;
    const hits = _ray.intersectObjects(this.ctx.world.losMeshes, false);
    return hits.length === 0;
  }

  _pickTarget() {
    const game = this.ctx.game;
    const cands = [];
    if (this.team === 'enemy') {
      const pl = this.ctx.player;
      if (pl.alive) cands.push({ pos: pl.eyePos().clone(), obj: pl, isPlayer: true });
      for (const b of game.bots) if (b.alive && b.team === 'ally') cands.push({ pos: b.chestPos.clone(), obj: b, isPlayer: false });
    } else {
      for (const b of game.bots) if (b.alive && b.team === 'enemy') cands.push({ pos: b.chestPos.clone(), obj: b, isPlayer: false });
    }
    let best = null, bestD = Infinity;
    for (const c of cands) {
      const d = this.pos.distanceTo(c.pos);
      if (d < bestD && d < 55 && this._canSee(c.pos)) { best = c; bestD = d; }
    }
    return best;
  }

  _fireAt(targetPos, isPlayerTarget, dt) {
    this.nextFireT -= dt;
    if (this.nextFireT > 0) return;
    if (this.burstLeft <= 0) {
      this.burstLeft = 3;
      this.nextFireT = 1.1 + Math.random() * 0.9;
      return;
    }
    this.nextFireT = 0.11;
    this.burstLeft--;
    if (this.burstLeft === 0) this.nextFireT = 1.2 + Math.random() * 1.0;

    const muzzleWorld = new THREE.Vector3();
    this.parts.gun.getWorldPosition(muzzleWorld);
    muzzleWorld.addScaledVector(new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 0.55);

    const dist = muzzleWorld.distanceTo(targetPos);
    const err = (0.016 + dist * 0.00075) * (isPlayerTarget ? 1 : 0.85);
    const dir = targetPos.clone().sub(muzzleWorld).normalize();
    dir.x += (Math.random() - 0.5) * err * 2;
    dir.y += (Math.random() - 0.5) * err * 2;
    dir.z += (Math.random() - 0.5) * err * 2;
    dir.normalize();

    this.ctx.fx.boltSystem.spawn(muzzleWorld, dir, this.T.boltTeam, 120, 1.6, 0);
    this.ctx.fx.muzzle(muzzleWorld, dir, this.T.boltColor);
    const { pan, vol } = this.ctx.game.spatial(muzzleWorld);
    this.ctx.audio.laser(pan, vol);
  }

  _moveToward(pt, dt, speedMul = 1) {
    const dx = pt.x - this.pos.x;
    const dz = pt.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    let mx = 0, mz = 0;
    if (d > 0.6) {
      mx = (dx / d) * this.speed * speedMul;
      mz = (dz / d) * this.speed * speedMul;
      this.yaw = Math.atan2(dx, dz);
    }
    // jetpack if point is higher
    const ground = this.ctx.world.groundTop(this.pos.x, this.pos.z, this.pos.y + 1.2);
    const gHere = ground === -Infinity ? -100 : ground;
    if (pt.y > gHere + 0.6 && this.fuel > 0 && d < 6) {
      this.vel.y += 30 * dt;
      this.fuel -= dt;
      this.thrusting = true;
    } else {
      this.thrusting = false;
    }
    this.vel.x = mx; this.vel.z = mz;
    return d;
  }

  _applyPhysics(dt) {
    this.vel.y -= CONFIG.GRAVITY * dt;
    this.pos.addScaledVector(this.vel, dt);
    const ground = this.ctx.world.groundTop(this.pos.x, this.pos.z, this.pos.y + 1.4);
    if (ground !== -Infinity && this.pos.y <= ground) {
      // only land if we were above it
      if (this.vel.y <= 0) {
        this.pos.y = ground;
        this.vel.y = 0;
        this.grounded = true;
        if (this.fuel < 4) this.fuel = Math.min(4, this.fuel + dt * CONFIG.JET_RECHARGE_RATE);
      }
    } else {
      this.grounded = false;
    }
    if (this.grounded) this.fuel = Math.min(4, this.fuel + dt * CONFIG.JET_RECHARGE_RATE * 1.3);

    if (this.pos.y < CONFIG.CANYON_KILL_Y) {
      if (this.alive) { this.alive = false; this.ctx.game.onBotDeath(this, false, true); this.ctx.game.removeBot(this); }
    }
  }

  _animate(dt, moving) {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.walkPhase += dt * (moving ? 9 : 2);
    const sw = moving ? Math.sin(this.walkPhase) * 0.55 : Math.sin(this.walkPhase) * 0.04;
    this.parts.legL.rotation.x = sw;
    this.parts.legR.rotation.x = -sw;
    this.parts.armL.rotation.x = -sw * 0.5;
    if (this.target) {
      const dy = this.target.pos.y + 1.2 - (this.pos.y + 1.15);
      const dxz = Math.hypot(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z);
      this.aimPitch = Math.atan2(dy, dxz);
      this.parts.armR.rotation.x = -Math.PI / 2 - this.aimPitch * 0.8;
      this.parts.gun.rotation.x = -this.aimPitch;
    } else {
      this.parts.armR.rotation.x = -0.35;
      this.parts.gun.rotation.x = 0;
    }
    // flames
    for (const f of this.parts.flames) {
      f.visible = this.thrusting;
      if (this.thrusting) f.scale.y = 0.8 + Math.random() * 0.6;
    }
    if (this.thrusting && Math.random() < 0.85) {
      const wp = new THREE.Vector3();
      this.parts.pack.getWorldPosition(wp);
      wp.y -= 0.45;
      this.ctx.fx.jetFlame(wp, V3(0, -1, 0), this.T.flame, 1.1);
    }
    this.thrusting = false;
  }

  update(dt) {
    if (!this.alive) {
      if (this.ragdoll) this._updateRagdoll(dt);
      return;
    }
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.28 + Math.random() * 0.2;
      this.target = this._pickTarget();
      this.hasLOS = !!this.target;
    }

    let moving = false;

    if (this.target) {
      const tp = this.target.pos;
      const dx = tp.x - this.pos.x, dz = tp.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      // face target
      this.yaw = Math.atan2(dx, dz);
      // strafe + range keeping
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = 1.2 + Math.random() * 2.2;
        this.strafeDir = Math.random() < 0.5 ? 1 : -1;
      }
      const sx = Math.cos(this.yaw) * this.strafeDir;
      const sz = -Math.sin(this.yaw) * this.strafeDir;
      let adv = 0;
      if (dist > 24) adv = 1;
      else if (dist < 9) adv = -0.8;
      const spd = this.speed;
      this.vel.x = (sx * 0.75 + (dx / dist) * adv) * spd;
      this.vel.z = (sz * 0.75 + (dz / dist) * adv) * spd;
      moving = Math.abs(this.vel.x) + Math.abs(this.vel.z) > 0.4;
      this._fireAt(V3(tp.x, tp.y + (this.target.isPlayer ? -0.25 : 0.05), tp.z), this.target.isPlayer, dt);
    } else if (this.pushPath && this.pushIdx < this.pushPath.length) {
      const pt = this.pushPath[this.pushIdx];
      const d = this._moveToward(pt, dt);
      moving = d > 0.8;
      if (d < 1.0 && Math.abs(pt.y - this.pos.y) < 1.2) this.pushIdx++;
      if (this.pushIdx >= this.pushPath.length) this.pushPath = null;
    } else if (this.patrolPts.length > 1) {
      const pt = this.patrolPts[this.patrolIdx];
      const d = this._moveToward(pt, dt, 0.55);
      moving = d > 0.8;
      if (d < 1.0) {
        this.patrolIdx = (this.patrolIdx + 1) % this.patrolPts.length;
      }
    }

    // separation from other bots
    for (const b of this.ctx.game.bots) {
      if (b === this || !b.alive) continue;
      const dx = this.pos.x - b.pos.x, dz = this.pos.z - b.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1.2 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        this.pos.x += (dx / d) * (1.1 - d) * dt * 3;
        this.pos.z += (dz / d) * (1.1 - d) * dt * 3;
      }
    }

    this._applyPhysics(dt);
    this._animate(dt, moving);
  }

  startPush(path) {
    this.isPusher = true;
    this.pushPath = path;
    this.pushIdx = 0;
  }
}
