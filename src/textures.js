import * as THREE from 'three';

// Procedural canvas textures — no external assets needed.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

/** Dark grey perforated metal grating for the main deck. */
export function deckTexture() {
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#4a5058';
  g.fillRect(0, 0, 512, 512);
  // subtle plate variation
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
  }
  // grid lines every 64px
  g.strokeStyle = 'rgba(20,24,28,0.9)';
  g.lineWidth = 4;
  for (let i = 0; i <= 512; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
  }
  // perforation dots inside each cell
  g.fillStyle = 'rgba(18,22,26,0.55)';
  for (let x = 8; x < 512; x += 16) {
    for (let y = 8; y < 512; y += 16) {
      g.beginPath(); g.arc(x + ((y / 16) % 2) * 4, y, 2.2, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** White panel wall for hangars. */
export function panelWallTexture() {
  const [c, g] = makeCanvas(512, 256);
  g.fillStyle = '#f1f3f5';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(120,130,140,0.5)';
  g.lineWidth = 3;
  for (let x = 0; x <= 512; x += 128) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke();
  }
  for (let y = 0; y <= 256; y += 86) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
  }
  g.fillStyle = 'rgba(0,0,0,0.04)';
  for (let i = 0; i < 300; i++) {
    g.fillRect(Math.random() * 512, Math.random() * 256, 6, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Hazard stripes for fuel canisters. */
export function hazardTexture() {
  const [c, g] = makeCanvas(256, 64);
  g.fillStyle = '#d98836';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#26282c';
  for (let x = -64; x < 256 + 64; x += 48) {
    g.beginPath();
    g.moveTo(x, 64); g.lineTo(x + 24, 0); g.lineTo(x + 44, 0); g.lineTo(x + 20, 64);
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Weapon side display: dark screen with a glowing warning triangle. */
export function gunScreenTexture() {
  const [c, g] = makeCanvas(128, 64);
  g.fillStyle = '#0c1014';
  g.fillRect(0, 0, 128, 64);
  g.strokeStyle = '#ff3fae';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(64, 12); g.lineTo(80, 44); g.lineTo(48, 44); g.closePath(); g.stroke();
  g.fillStyle = '#ff3fae';
  g.fillRect(62, 24, 4, 10);
  g.fillRect(62, 37, 4, 4);
  g.strokeStyle = 'rgba(53,224,208,0.7)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(6, 56); g.lineTo(122, 56); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft radial sprite for particles / glows. */
export function glowSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const [c, g] = makeCanvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Star-ish spark streak sprite. */
export function sparkSprite() {
  const [c, g] = makeCanvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,240,200,0.85)');
  grad.addColorStop(1, 'rgba(255,200,80,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Glass crack decal texture (white fracture lines, transparent bg). */
export function crackTexture() {
  const [c, g] = makeCanvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.translate(128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
    g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(0, 0);
    let r = 0;
    let x = 0, y = 0;
    for (let s = 0; s < 5; s++) {
      r += 18 + Math.random() * 16;
      x = Math.cos(a + (Math.random() - 0.5) * 0.5) * r;
      y = Math.sin(a + (Math.random() - 0.5) * 0.5) * r;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const r1 = 20 + Math.random() * 40;
    const r2 = r1 + 18 + Math.random() * 30;
    g.beginPath();
    g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Scorch mark decal. */
export function scorchTexture() {
  const [c, g] = makeCanvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 60);
  grad.addColorStop(0, 'rgba(10,10,12,0.85)');
  grad.addColorStop(0.6, 'rgba(20,18,16,0.4)');
  grad.addColorStop(1, 'rgba(20,18,16,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
