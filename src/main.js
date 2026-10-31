import { initTouch } from './touch.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { CONFIG } from './config.js';
import { World } from './world.js';
import { Effects, BoltSystem } from './effects.js';
import { SoundEngine } from './audio.js';
import { Player } from './player.js';
import { Game } from './game.js';

const dom = {
  crosshair: document.getElementById('crosshair'),
  dmgVignette: document.getElementById('dmgVignette'),
  boostVignette: document.getElementById('boostVignette'),
  menuOverlay: document.getElementById('menuOverlay'),
  endOverlay: document.getElementById('endOverlay'),
  endBadge: document.getElementById('endBadge'),
  endTitle: document.getElementById('endTitle'),
  endSub: document.getElementById('endSub'),
  startBtn: document.getElementById('startBtn'),
  againBtn: document.getElementById('againBtn'),
};

// ---------------- renderer / composer ----------------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // crisp, hard-edged noon shadows
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.FOV, window.innerWidth / window.innerHeight, 0.08, 1400);
camera.rotation.order = 'YXZ';
scene.add(camera);

const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  samples: 4,
  type: THREE.HalfFloatType,
});
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.52, 0.45, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------- game objects ----------------
const ctx = { scene, camera, renderer, dom };
ctx.audio = new SoundEngine();
ctx.world = new World(scene, renderer);
ctx.fx = new Effects(scene);
ctx.player = new Player(ctx);
camera.add(ctx.player.rig);
ctx.game = new Game(ctx);
ctx.game.initBolts(BoltSystem);

const world = ctx.world;
const player = ctx.player;
const game = ctx.game;
const audio = ctx.audio;
const demoMode = game.demoMode;
const touchMode = initTouch(player, game, dom);
if (demoMode) ctx.player.rig.visible = false;

// ---------------- flow ----------------
function startGame() {
  audio.init();
  audio.resume();
  audio.startWind();
  dom.menuOverlay.classList.add('hidden');
  dom.endOverlay.classList.add('hidden');
  game.paused = false;
  if (demoMode) return;
  if (touchMode) {
    try { document.documentElement.requestFullscreen().then(() => screen.orientation.lock('landscape')).catch(() => {}); } catch (e) { /* ignore */ }
  } else {
    try { renderer.domElement.requestPointerLock(); } catch (e) { /* ignore */ }
  }
  if (game.state === 'menu' || game.state === 'end') game.startRound();
}

dom.menuOverlay.addEventListener('click', startGame);
dom.endOverlay.addEventListener('click', startGame);

document.addEventListener('pointerlockchange', () => {
  if (demoMode || touchMode) return;
  const locked = document.pointerLockElement === renderer.domElement;
  if (!locked && game.state === 'live' && !game.paused) {
    game.paused = true;
    dom.menuOverlay.classList.remove('hidden');
  }
  if (locked) {
    game.paused = false;
    dom.menuOverlay.classList.add('hidden');
  }
});

// ---------------- input ----------------
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  if (game.paused || demoMode) return;
  player.onKey(e.code, true);
});
window.addEventListener('keyup', (e) => {
  if (demoMode) return;
  player.onKey(e.code, false);
});
window.addEventListener('mousedown', (e) => {
  if (demoMode) return;
  if (document.pointerLockElement === renderer.domElement && e.button === 0) player.mouseDown = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) player.mouseDown = false;
});
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === renderer.domElement) player.look(e.movementX, e.movementY);
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
});

// ---------------- demo (cinematic orbit for screenshots) ----------------
let demoAngle = 0;
function updateDemoCamera(dt) {
  demoAngle += dt * 0.12;
  const r = 46;
  const cx = Math.cos(demoAngle) * r;
  const cz = Math.sin(demoAngle) * r;
  const cy = 16 + Math.sin(demoAngle * 0.7) * 5;
  camera.position.set(cx, cy, cz);
  camera.lookAt(-4, 3, -2);
}

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let demoStarted = false;

function loop() {
  requestAnimationFrame(loop);
  let dt = Math.min(clock.getDelta(), 0.033);

  if (demoMode) {
    if (!demoStarted && clock.elapsedTime > 0.8) {
      demoStarted = true;
      game.startRound();
      dom.menuOverlay.classList.add('hidden');
      dom.crosshair.classList.remove('on');
    }
    updateDemoCamera(dt);
    game.update(dt);
  } else {
    game.update(dt);
  }

  composer.render();
}
loop();

// debug handle
window.__game = game;
