import * as THREE from 'three';
import { CONFIG, COLORS } from './config.js';
import { Bot } from './bots.js';
import { segBox, segSphere } from './effects.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export class Game {
  constructor(ctx) {
    this.ctx = ctx; // { scene, camera, world, fx, audio, player, dom, renderer }
    this.state = 'menu'; // menu | live | end
    this.paused = false;
    this.time = 0;
    this.roundT = 0;
    this.demoMode = new URLSearchParams(location.search).has('demo');

    this.bots = [];
    this.pendingBooms = [];
    this.shakeEvents = 0;
  }

  /** Wire the bolt system with this game's collision resolver. */
  initBolts(BoltSystemClass) {
    this.boltSystem = new BoltSystemClass(this.ctx.scene, (p0, p1, team) => this.resolveBolt(p0, p1, team));
    this.ctx.fx.boltSystem = this.boltSystem;
    this.boltSystem.onHit = (hit, bolt, fx) => this.onBoltHit(hit, bolt);
  }

  // ================= round flow =================
  startRound() {
    const { world, player } = this.ctx;
    this.state = 'live';
    this.roundT = 0;
    this.time = 0;
    this.pendingBooms = [];

    // clear old bots
    for (const b of this.bots) this.removeBot(b, true);
    this.bots = [];

    // reset world dynamics
    world.resetDynamic();

    // player (facing the hangar across the deck)
    player.reset(-8, 14, 0.34);

    // ---- enemies (grey-orange) ----
    const mk = (team, x, y, z, name, pts) => {
      const b = new Bot(this.ctx, team, x, y, z, name);
      b.patrolPts = pts;
      this.bots.push(b);
      return b;
    };
    // beat 1: hangar entrance
    mk('enemy', -25, 0, -27.5, 'E-1', [V3(-30, 0, -28), V3(-20, 0, -28)]);
    // beat 2: behind shuttle landing gear
    mk('enemy', -34.2, 0.5, 6.2, 'E-2', [V3(-33.5, 0.5, 6), V3(-35.2, 0.5, 9.5)]);
    // beat 3: catwalk beside the fuel canister
    mk('enemy', 8, 4.2, 41, 'E-3', [V3(6, 4.2, 41), V3(12, 4.2, 41)]);
    // beat 5/7: pushers waiting on the east pad
    this.pusher1 = mk('enemy', 35, 5, -10, 'E-4', []);
    this.pusher2 = mk('enemy', 41, 5, -14, 'E-5', []);
    this.pushersStarted = false;

    // ---- allies (purple) ----
    mk('ally', -14, 0, 10, 'A-1', [V3(-14, 0, 10), V3(-24, 0, -6), V3(-25, 0, -22)]);
    mk('ally', -18, 0, 16, 'A-2', [V3(-18, 0, 16), V3(-30, 0, 2), V3(-36, 0.5, 4)]);
    mk('ally', 0, 0, 22, 'A-3', [V3(0, 0, 22), V3(2, 0, 6), V3(3, 0, -8)]);
    mk('ally', -4, 0, 27, 'A-4', [V3(-4, 0, 27), V3(8, 0, 32), V3(16, 0, 30)]);

    // open hangar door shortly after start (teal glow beat)
    setTimeout(() => { if (this.state === 'live') this.ctx.world.openHangarDoor(); }, 600);

    this.ctx.dom.crosshair.classList.add('on');
  }

  endRound(won) {
    if (this.state !== 'live') return;
    this.state = 'end';
    const dom = this.ctx.dom;
    dom.crosshair.classList.remove('on');
    if (document.pointerLockElement) document.exitPointerLock();
    if (won) {
      dom.endOverlay.classList.remove('lost');
      dom.endBadge.textContent = 'Full squad wipe';
      dom.endTitle.textContent = 'ROUND WON';
      dom.endSub.textContent = 'Flawless execution, operator';
      this.ctx.audio.winSting();
      if (this.ctx.player.alive) this.ctx.player.startInspect();
    } else {
      dom.endOverlay.classList.add('lost');
      dom.endBadge.textContent = 'You were eliminated';
      dom.endTitle.textContent = 'ROUND LOST';
      dom.endSub.textContent = 'The grey-orange squad holds the rim';
      this.ctx.audio.loseSting();
    }
    setTimeout(() => dom.endOverlay.classList.remove('hidden'), won ? 900 : 1400);
  }

  // ================= director =================
  updateDirector(dt) {
    this.roundT += dt;
    const player = this.ctx.player;

    // trigger the pusher beat: player jets up, or timer, or few enemies left
    if (!this.pushersStarted) {
      const playerHigh = player.alive && player.pos.y > 2.5;
      const late = this.roundT > 14;
      const thin = this.enemiesAlive() <= 2;
      if ((playerHigh && this.roundT > 6) || late || thin) {
        this.pushersStarted = true;
        this._startPushers();
      }
    } else {
      // keep pushers hunting the player across the map
      for (const p of [this.pusher1, this.pusher2]) {
        if (!p || !p.alive) continue;
        if (!p.target && (!p.pushPath || p.pushIdx >= p.pushPath.length)) {
          if (player.alive) {
            p.pushPath = [V3(player.pos.x, player.pos.y, player.pos.z)];
            p.pushIdx = 0;
          }
        }
      }
    }
  }

  _startPushers() {
    // if the player is up high, they rocket straight up on jetpacks;
    // otherwise they push across the glass sky bridge to the deck
    const player = this.ctx.player;
    const viaBridge = [
      V3(28, 5, -10), V3(20, 5, -10), V3(13, 5, -10), V3(9, 0, -8), V3(2, 0, 0),
    ];
    for (const p of [this.pusher1, this.pusher2]) {
      if (!p || !p.alive) continue;
      if (player.alive && player.pos.y > 2.5) {
        p.pushPath = [V3(player.pos.x, player.pos.y + 0.5, player.pos.z)];
        p.pushIdx = 0;
      } else {
        p.startPush(viaBridge.map(v => v.clone()));
      }
    }
  }

  enemiesAlive() {
    let n = 0;
    for (const b of this.bots) if (b.alive && b.team === 'enemy') n++;
    return n;
  }

  // ================= bolt resolution =================
  resolveBolt(p0, p1, team) {
    const world = this.ctx.world;
    let bestT = Infinity;
    let hit = null;

    // static colliders
    for (const c of world.colliders) {
      if (c.gone) continue;
      const t = segBox(p0, p1, c.min, c.max);
      if (t >= 0 && t < bestT) {
        bestT = t;
        hit = { t, collider: c };
      }
    }

    // targets
    const wantTeams = team === 'enemy' ? ['ally'] : ['enemy'];
    for (const b of this.bots) {
      if (!b.alive || !wantTeams.includes(b.team)) continue;
      for (const s of b.hitSpheres()) {
        const t = segSphere(p0, p1, s.c, s.r);
        if (t >= 0 && t < bestT) {
          bestT = t;
          hit = { t, bot: b, head: s.head };
        }
      }
    }

    // the player (skipped in demo fly-cam mode)
    if (team === 'enemy' && this.ctx.player.alive && !this.demoMode) {
      const pl = this.ctx.player;
      const spheres = [
        { c: { x: pl.pos.x, y: pl.pos.y + 1.62, z: pl.pos.z }, r: 0.24, head: true },
        { c: { x: pl.pos.x, y: pl.pos.y + 1.05, z: pl.pos.z }, r: 0.46, head: false },
        { c: { x: pl.pos.x, y: pl.pos.y + 0.45, z: pl.pos.z }, r: 0.4, head: false },
      ];
      for (const s of spheres) {
        const t = segSphere(p0, p1, s.c, s.r);
        if (t >= 0 && t < bestT) {
          bestT = t;
          hit = { t, playerHit: true, head: s.head };
        }
      }
    }

    if (!hit) return null;
    const k = hit.t;
    hit.point = V3(p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k, p0.z + (p1.z - p0.z) * k);
    // approximate normal (from AABB face or sphere)
    if (hit.collider) {
      const c = hit.collider;
      const dx = Math.min(Math.abs(hit.point.x - c.min.x), Math.abs(hit.point.x - c.max.x));
      const dy = Math.min(Math.abs(hit.point.y - c.min.y), Math.abs(hit.point.y - c.max.y));
      const dz = Math.min(Math.abs(hit.point.z - c.min.z), Math.abs(hit.point.z - c.max.z));
      if (dx <= dy && dx <= dz) hit.normal = V3(hit.point.x > (c.min.x + c.max.x) / 2 ? 1 : -1, 0, 0);
      else if (dy <= dz) hit.normal = V3(0, hit.point.y > (c.min.y + c.max.y) / 2 ? 1 : -1, 0);
      else hit.normal = V3(0, 0, hit.point.z > (c.min.z + c.max.z) / 2 ? 1 : -1);
    } else if (hit.bot) {
      hit.normal = V3(p0.x - hit.point.x, p0.y - hit.point.y, p0.z - hit.point.z).normalize();
    } else {
      hit.normal = V3(0, 1, 0);
    }
    return hit;
  }

  onBoltHit(hit, bolt) {
    const fx = this.ctx.fx;
    const audio = this.ctx.audio;
    const { pan, vol } = this.spatial(hit.point);

    if (hit.bot) {
      const dmg = bolt.team === 'enemy' ? CONFIG.LASER_DMG_BOT : (hit.head ? CONFIG.BOLT_DMG_HEAD : CONFIG.BOLT_DMG_BODY);
      const byPlayer = bolt.team === 'player';
      fx.impact(hit.point, hit.normal, hit.bot.T.accent);
      audio.impactSizzle(pan, vol);
      if (byPlayer) this.flashCrosshair(hit.head ? 'kill' : 'hit');
      hit.bot.takeDamage(dmg, hit.point, byPlayer, hit.head);
      return;
    }
    if (hit.playerHit) {
      fx.impact(hit.point, hit.normal, COLORS.enemyLaser);
      audio.impactSizzle(0, 0.8);
      this.ctx.player.takeDamage(CONFIG.LASER_DMG_PLAYER * (hit.head ? 1.8 : 1), hit.point);
      return;
    }
    // world hits
    const c = hit.collider;
    if (c && c.canister && c.canister.alive) {
      c.canister.hp -= bolt.team === 'player' ? 30 : 12;
      fx.impact(hit.point, hit.normal, 0xff8830);
      audio.impactSizzle(pan, vol);
      if (c.canister.hp <= 0) this.explodeCanister(c.canister);
      return;
    }
    if (c && c.glassPanel && c.glassPanel.alive) {
      const panel = c.glassPanel;
      panel.hp -= bolt.team === 'player' ? 36 : 20;
      fx.impact(hit.point, hit.normal, 0xbfe8ff);
      audio.glassCrack();
      if (panel.hp <= 0) {
        this.shatterPanel(panel);
      } else {
        panel.crack.material.opacity = (1 - panel.hp / 70) * 0.9;
      }
      return;
    }
    fx.impact(hit.point, hit.normal, 0xd8dcdf);
    audio.impactSizzle(pan, vol);
    if (Math.random() < 0.3) audio.ricochet(pan);
  }

  flashCrosshair(kind) {
    const ch = this.ctx.dom.crosshair;
    ch.classList.add(kind);
    clearTimeout(this._chT);
    this._chT = setTimeout(() => ch.classList.remove('hit', 'kill'), kind === 'kill' ? 160 : 90);
  }

  shatterPanel(panel) {
    panel.alive = false;
    panel.collider.gone = true;
    panel.mesh.visible = false;
    panel.crack.visible = false;
    this.ctx.fx.glassBurst(panel.pos, panel.size.x, panel.size.z);
    const { vol } = this.spatial(panel.pos);
    this.ctx.audio.glassShatter(vol);
  }

  // ================= explosions =================
  explodeCanister(can) {
    if (!can.alive) return;
    can.alive = false;
    can.collider.gone = true;
    can.grp.visible = false;
    this.ctx.fx.explosion(can.pos, 'orange', CONFIG.CANISTER_RADIUS);
    this.ctx.audio.explosion(this.spatial(can.pos).vol);
    this._radiusDamage(can.pos, CONFIG.CANISTER_RADIUS, CONFIG.CANISTER_DMG, CONFIG.CANISTER_IMPULSE, true);
    this.ctx.player.shake = Math.min(1.4, this.ctx.player.shake + 0.55);
    // chain other canisters
    for (const other of this.ctx.world.canisters) {
      if (!other.alive) continue;
      if (other.pos.distanceTo(can.pos) < CONFIG.CANISTER_RADIUS) {
        this.pendingBooms.push({ t: 0.16, fn: () => this.explodeCanister(other) });
      }
    }
    // shatter nearby glass
    for (const panel of this.ctx.world.glassPanels) {
      if (panel.alive && panel.pos.distanceTo(can.pos) < CONFIG.CANISTER_RADIUS + 1) this.shatterPanel(panel);
    }
  }

  explodeGrenade(pos) {
    this.ctx.fx.explosion(pos, 'pink', CONFIG.GRENADE_RADIUS);
    this.ctx.audio.explosion(this.spatial(pos).vol);
    this._radiusDamage(pos, CONFIG.GRENADE_RADIUS, CONFIG.GRENADE_DMG, CONFIG.GRENADE_IMPULSE, true);
    this.ctx.player.shake = Math.min(1.4, this.ctx.player.shake + 0.5);
    // self damage reduced (disabled in demo mode)
    const d = pos.distanceTo(this.ctx.player.eyePos());
    if (d < CONFIG.GRENADE_RADIUS && this.ctx.player.alive && !this.demoMode) {
      this.ctx.player.takeDamage(40 * (1 - d / CONFIG.GRENADE_RADIUS), pos);
    }
    for (const panel of this.ctx.world.glassPanels) {
      if (panel.alive && panel.pos.distanceTo(pos) < CONFIG.GRENADE_RADIUS + 1.5) this.shatterPanel(panel);
    }
    for (const other of this.ctx.world.canisters) {
      if (other.alive && other.pos.distanceTo(pos) < CONFIG.GRENADE_RADIUS) {
        this.pendingBooms.push({ t: 0.14, fn: () => this.explodeCanister(other) });
      }
    }
  }

  _radiusDamage(pos, radius, dmg, impulse, launch) {
    for (const b of this.bots) {
      if (!b.alive) continue;
      const d = b.chestPos.distanceTo(pos);
      if (d > radius) continue;
      const falloff = 1 - d / radius;
      const dir = b.chestPos.clone().sub(pos).normalize();
      if (dir.y < 0.35) dir.y = 0.35 + Math.random() * 0.3; // launch upward
      dir.normalize();
      b.vel.addScaledVector(dir, impulse * falloff);
      b.vel.y += impulse * 0.45 * falloff;
      b.takeDamage(dmg * falloff, b.chestPos.clone(), true, false, dir);
    }
  }

  // ================= events =================
  onBotDeath(bot, byPlayer, silent) {
    if (!silent) {
      const { pan, vol } = this.spatial(bot.pos);
      this.ctx.audio.impactSizzle(pan, vol * 0.7);
    }
    if (byPlayer) {
      this.flashCrosshair('kill');
      this.ctx.audio.killTick();
    }
    if (this.enemiesAlive() === 0 && this.state === 'live') {
      setTimeout(() => this.endRound(true), 700);
    }
  }

  onPlayerDeath() {
    this.ctx.audio.bodyFall(1);
    setTimeout(() => this.endRound(false), 600);
  }

  onPlayerShot() { /* reserved for analytics */ }

  removeBot(bot, immediate) {
    const idx = this.bots.indexOf(bot);
    if (idx >= 0) this.bots.splice(idx, 1);
    if (bot.ragdoll) for (const r of bot.ragdoll) this.ctx.scene.remove(r.obj);
    this.ctx.scene.remove(bot.group);
  }

  /** Stereo pan + volume for a world position, relative to the camera. */
  spatial(pos) {
    const cam = this.ctx.camera;
    const d = pos.distanceTo(cam.position);
    const vol = Math.max(0.05, 1 - d / 55);
    const dir = pos.clone().sub(cam.position).normalize();
    const right = V3(Math.cos(this.ctx.player.yaw), 0, -Math.sin(this.ctx.player.yaw));
    const pan = THREE.MathUtils.clamp(dir.dot(right) * 0.8, -0.9, 0.9);
    return { pan, vol };
  }

  // ================= main update =================
  update(dt) {
    if (this.paused) return;
    this.time += dt;

    // pending chain explosions
    for (let i = this.pendingBooms.length - 1; i >= 0; i--) {
      const pb = this.pendingBooms[i];
      pb.t -= dt;
      if (pb.t <= 0) {
        this.pendingBooms.splice(i, 1);
        pb.fn();
      }
    }

    this.ctx.world.update(dt, this.time);
    this.ctx.player.update(dt, this.time);
    for (const b of this.bots) b.update(dt);
    this.ctx.fx.boltSystem.update(dt, this.ctx.fx);
    this.ctx.fx.update(dt);

    if (this.state === 'live') this.updateDirector(dt);
  }
}
