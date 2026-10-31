// In-game HUD: minimap, health, fuel, ammo, timer, kill feed, hit marker, mission tracker, pause.
import { CONFIG } from './config.js';
import { MISSIONS } from './missions.js';
import { addReward, renderProfile } from './lobby.js';

export class Hud {
  constructor(ctx, dom, settings) {
    this.ctx = ctx; this.dom = dom; this.settings = settings;
    this.seen = new Map(); this.kills = 0; this.prevState = 'menu'; this.frame = 0; this.tick = 0;

    const el = document.createElement('div');
    el.id = 'hud'; el.className = 'off';
    el.innerHTML = `
      <div class="h-tl">
        <div class="mm"><canvas id="mm" width="120" height="120"></canvas><span class="mm-n">N</span></div>
        <div class="bars">
          <div class="bar hp"><i id="hpFill"></i><span id="hpTxt">100</span></div>
          <div class="bar fuel"><i id="fuelFill"></i><span>JET</span></div>
        </div>
        <div class="m-track" id="mTrack"></div>
      </div>
      <div class="h-tc">
        <div class="pill"><span>HOSTILES <b id="hEn">5</b></span><span class="tm" id="hTime">0:00</span><span>KILLS <b id="hKills">0</b></span></div>
        <div class="obj">OBJECTIVE · ELIMINATE THE GREY-ORANGE SQUAD</div>
      </div>
      <div class="h-tr">
        <button class="hud-btn" id="hPause" data-tb="pause">II</button>
        <div id="feed"></div>
      </div>
      <div class="h-bc">
        <div class="wname">PLASMA RIFLE <em>AR-7</em></div>
        <div class="ammo"><b id="hAmmo">24</b><span>/ ${CONFIG.MAG_SIZE}</span><u id="hGren">GRN ×3</u></div>
        <div class="rld" id="hRld"><i></i><span>RELOADING</span></div>
      </div>
      <div id="hitm"><i></i><i></i><i></i><i></i></div>`;
    document.body.appendChild(el);
    const $ = (id) => el.querySelector('#' + id);
    this.e = { hud: el, hp: $('hpFill'), hpT: $('hpTxt'), fuel: $('fuelFill'), en: $('hEn'), time: $('hTime'),
      kills: $('hKills'), feed: $('feed'), ammo: $('hAmmo'), gren: $('hGren'), rld: $('hRld'), hitm: $('hitm'), mm: $('mm'), mTrack: $('mTrack') };
    this.mmc = this.e.mm.getContext('2d');

    // hit marker follows the crosshair's hit/kill flash
    new MutationObserver(() => {
      const c = dom.crosshair.classList;
      if (c.contains('hit') || c.contains('kill')) {
        const h = this.e.hitm;
        h.classList.toggle('kill', c.contains('kill'));
        h.classList.remove('on'); void h.offsetWidth; h.classList.add('on');
      }
    }).observe(dom.crosshair, { attributes: true, attributeFilter: ['class'] });

    // pause
    const pm = document.createElement('div');
    pm.className = 'ks-modal'; pm.id = 'pauseModal';
    pm.innerHTML = `<div class="ks-card"><h2>Paused</h2>
      <button class="btn-main" id="pResume">Resume</button>
      <button class="btn-alt" id="pSet">Settings</button>
      <button class="btn-alt" id="pExit">Exit to lobby</button></div>`;
    document.body.appendChild(pm);
    const openPause = () => {
      if (ctx.game.state !== 'live') return;
      ctx.game.paused = true; pm.classList.add('open');
      if (document.pointerLockElement) document.exitPointerLock();
    };
    const resume = () => {
      pm.classList.remove('open'); ctx.game.paused = false;
      if (!('ontouchstart' in window)) { try { ctx.renderer.domElement.requestPointerLock(); } catch (e) { /* ignore */ } }
    };
    this.e.hud.querySelector('#hPause').addEventListener('click', openPause);
    window.addEventListener('ks-pause', openPause);
    pm.querySelector('#pResume').addEventListener('click', resume);
    pm.querySelector('#pSet').addEventListener('click', () => settings.open());
    pm.querySelector('#pExit').addEventListener('click', () => location.reload());
  }

  feed(text, cls) {
    const d = document.createElement('div');
    d.className = 'fi ' + (cls || ''); d.textContent = text;
    this.e.feed.prepend(d);
    while (this.e.feed.children.length > 4) this.e.feed.lastChild.remove();
    setTimeout(() => d.remove(), 4200);
  }

  update(dt) {
    const { game, player } = this.ctx;
    const live = game.state === 'live';
    this.e.hud.classList.toggle('off', !live);

    if (live && this.prevState !== 'live') { this.kills = 0; this.seen.clear(); this.e.feed.innerHTML = ''; }
    if (!live && this.prevState === 'live') {
      const won = !this.dom.endOverlay.classList.contains('lost');
      const r = addReward(won); renderProfile();
      const el = document.getElementById('endReward');
      if (el) el.textContent = `+${r.credits} CREDITS  ·  +${r.xp} XP`;
    }
    this.prevState = game.state;
    if (!live) return;

    // kill feed from bot deaths
    let en = 0;
    for (const b of game.bots) {
      if (b.team === 'enemy' && b.alive) en++;
      const was = this.seen.get(b);
      if (was === undefined) this.seen.set(b, b.alive);
      else if (was && !b.alive) {
        this.seen.set(b, false);
        if (b.team === 'enemy') { this.kills++; this.feed(`HOSTILE ${b.name} ELIMINATED`, 'kill'); }
        else this.feed(`ALLY ${b.name} DOWN`, 'down');
      }
    }
    const e = this.e;
    e.en.textContent = en; e.kills.textContent = this.kills;
    const t = Math.floor(game.roundT);
    e.time.textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');

    const hp = Math.max(0, player.hp) / CONFIG.PLAYER_HP;
    e.hp.style.width = (hp * 100) + '%';
    e.hp.style.background = hp < 0.3 ? 'var(--red)' : 'var(--olive-hi)';
    e.hpT.textContent = Math.ceil(Math.max(0, player.hp));
    e.fuel.style.width = Math.max(0, player.fuel / CONFIG.JET_MAX_FUEL) * 100 + '%';
    e.ammo.textContent = player.ammo;
    e.ammo.classList.toggle('low', player.ammo <= 6);
    e.gren.textContent = 'GRN ×' + player.grenades;
    e.rld.classList.toggle('on', player.reloadT >= 0);
    if (player.reloadT >= 0) e.rld.firstElementChild.style.width = Math.min(100, player.reloadT / CONFIG.RELOAD_TIME * 100) + '%';

    if ((this.frame++ & 1) === 0) this.minimap(game, player);
    if ((this.frame & 15) === 0) this.missionTrack();
  }

  missionTrack() {
    const ms = this.ctx.missions;
    if (!ms) return;
    const rows = MISSIONS.filter((m) => !ms.done[m.id]).slice(0, 2).map((m) => {
      const cur = Math.min(m.prog(ms.round), m.target);
      return `<div class="mi"><span>◆ ${m.name}</span><b>${cur}/${m.target}</b></div>`;
    }).join('');
    if (this._mRows !== rows) { this.e.mTrack.innerHTML = rows; this._mRows = rows; }
  }

  minimap(game, player) {
    const c = this.mmc, S = 120, s = 0.9, y = player.yaw, cs = Math.cos(y), sn = Math.sin(y);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, S, S);
    c.save();
    c.beginPath(); c.arc(60, 60, 59, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(8,10,9,.78)'; c.fillRect(0, 0, S, S);
    c.setTransform(s * cs, s * sn, -s * sn, s * cs,
      60 - s * (player.pos.x * cs - player.pos.z * sn), 60 - s * (player.pos.x * sn + player.pos.z * cs));
    c.fillStyle = 'rgba(205,210,215,.3)'; c.fillRect(-60, -45, 120, 90);
    c.strokeStyle = 'rgba(220,224,228,.75)'; c.lineWidth = 1 / s; c.strokeRect(-60, -45, 120, 90);
    for (const b of game.bots) {
      if (!b.alive) continue;
      c.fillStyle = b.team === 'enemy' ? '#ff5a2a' : '#8fd05a';
      c.beginPath(); c.arc(b.pos.x, b.pos.z, 2.6 / s * 0.9, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(60, 52); c.lineTo(65, 66); c.lineTo(60, 63); c.lineTo(55, 66); c.closePath(); c.fill();
  }
}
