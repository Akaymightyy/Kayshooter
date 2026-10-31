import * as THREE from 'three';

// Procedural canvas textures — no external assets needed.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

/** Light weathered concrete for the main deck (tiles + seams, no grid). */
export function deckTexture() {
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#b2b7bb';
  g.fillRect(0, 0, 512, 512);
  // large soft tonal patches
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 30 + Math.random() * 90;
    const rg = g.createRadialGradient(x, y, 2, x, y, r);
    const light = Math.random() < 0.5;
    rg.addColorStop(0, light ? 'rgba(255,255,255,0.10)' : 'rgba(70,78,84,0.10)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // fine speckle (congregate noise)
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = Math.random() < 0.5
      ? `rgba(255,255,255,${Math.random() * 0.06})`
      : `rgba(60,66,72,${Math.random() * 0.06})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1.6, 1.6);
  }
  // scuffs / tyre marks
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = `rgba(80,86,92,${0.05 + Math.random() * 0.07})`;
    g.lineWidth = 2 + Math.random() * 5;
    g.beginPath();
    const sx = Math.random() * 512, sy = Math.random() * 512;
    g.moveTo(sx, sy);
    g.quadraticCurveTo(sx + (Math.random() - 0.5) * 160, sy + (Math.random() - 0.5) * 160, sx + (Math.random() - 0.5) * 260, sy + (Math.random() - 0.5) * 260);
    g.stroke();
  }
  // big panel seams every 128px (recessed, low contrast)
  g.fillStyle = 'rgba(60,68,74,0.55)';
  for (let i = 0; i <= 512; i += 128) {
    g.fillRect(i - 2, 0, 4, 512);
    g.fillRect(0, i - 2, 512, 4);
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i <= 512; i += 128) {
    g.fillRect(i + 2, 0, 1.5, 512);
    g.fillRect(0, i + 2, 512, 1.5);
  }
  // small expansion joints inside panels
  g.fillStyle = 'rgba(70,78,84,0.3)';
  for (let x = 0; x < 512; x += 128) {
    for (let y = 0; y < 512; y += 128) {
      g.fillRect(x + 64 - 1, y + 8, 2, 40);
      g.fillRect(x + 8, y + 64 - 1, 40, 2);
    }
  }
  // stain drips near seams
  for (let i = 0; i < 20; i++) {
    g.fillStyle = `rgba(60,66,72,${0.05 + Math.random() * 0.08})`;
    const sx = Math.floor(Math.random() * 4) * 128;
    g.fillRect(sx + Math.random() * 100, Math.random() * 400, 3 + Math.random() * 4, 30 + Math.random() * 80);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** White panel wall for hangars: deep seams, bolts, subtle grime. */
export function panelWallTexture() {
  const [c, g] = makeCanvas(512, 256);
  g.fillStyle = '#eef1f3';
  g.fillRect(0, 0, 512, 256);
  // panel shading (each panel slightly different)
  for (let x = 0; x < 512; x += 128) {
    for (let y = 0; y < 256; y += 86) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '150,160,170'},${0.03 + Math.random() * 0.04})`;
      g.fillRect(x + 2, y + 2, 124, 82);
    }
  }
  // seam shadow + highlight (recessed panel look)
  for (let x = 0; x <= 512; x += 128) {
    g.fillStyle = 'rgba(70,80,90,0.5)';
    g.fillRect(x - 2, 0, 4, 256);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(x + 2, 0, 2, 256);
  }
  for (let y = 0; y <= 256; y += 86) {
    g.fillStyle = 'rgba(70,80,90,0.45)';
    g.fillRect(0, y - 2, 512, 4);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillRect(0, y + 2, 512, 2);
  }
  // corner bolts at seam crossings
  for (let x = 0; x <= 512; x += 128) {
    for (let y = 0; y <= 256; y += 86) {
      for (const [bx, by] of [[x + 10, y + 10], [x + 118, y + 10], [x + 10, y + 76], [x + 118, y + 76]]) {
        if (bx > 512 || by > 256) continue;
        const rg = g.createRadialGradient(bx - 1, by - 1, 0.5, bx, by, 3.5);
        rg.addColorStop(0, '#cdd4d9');
        rg.addColorStop(1, 'rgba(90,100,110,0.7)');
        g.fillStyle = rg;
        g.beginPath(); g.arc(bx, by, 3, 0, Math.PI * 2); g.fill();
      }
    }
  }
  // grime specks
  g.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < 260; i++) {
    g.fillRect(Math.random() * 512, Math.random() * 256, 5, 2);
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

/** Weapon scope side display: teal HUD frame, pink reticle, charge bars. */
export function gunScreenTexture() {
  const [c, g] = makeCanvas(128, 64);
  g.fillStyle = '#05090c';
  g.fillRect(0, 0, 128, 64);
  // teal frame
  g.strokeStyle = 'rgba(53,224,208,0.9)';
  g.lineWidth = 2;
  g.strokeRect(3, 3, 122, 58);
  // pink reticle cross
  g.strokeStyle = '#ff3fae';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(64, 10); g.lineTo(64, 30); g.moveTo(46, 22); g.lineTo(82, 22);
  g.stroke();
  g.fillStyle = '#ff3fae';
  g.fillRect(62, 20, 4, 4);
  // charge bars
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i < 3 ? 'rgba(53,224,208,0.95)' : 'rgba(53,224,208,0.25)';
    g.fillRect(10 + i * 8, 44, 5, 12);
  }
  g.fillStyle = 'rgba(53,224,208,0.7)';
  g.font = 'bold 9px monospace';
  g.fillText('CHG 84%', 52, 53);
  // scanline
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = 6; y < 64; y += 4) g.fillRect(4, y, 120, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Dark-steel crate face: red X plate, riveted border, edge wear. */
export function crateTexture() {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#31363c';
  g.fillRect(0, 0, 256, 256);
  // metal speckle + grime
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  // bevelled edge: light top-left, dark bottom-right
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(4, 252); g.lineTo(4, 4); g.lineTo(252, 4); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.beginPath(); g.moveTo(252, 4); g.lineTo(252, 252); g.lineTo(4, 252); g.stroke();
  // inner raised plate
  g.fillStyle = '#3b4148';
  g.fillRect(42, 42, 172, 172);
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 4;
  g.strokeRect(42, 42, 172, 172);
  g.strokeStyle = 'rgba(255,255,255,0.1)';
  g.lineWidth = 2;
  g.strokeRect(46, 46, 164, 164);
  // bold red X
  g.strokeStyle = '#c22a20';
  g.lineWidth = 26;
  g.beginPath(); g.moveTo(64, 64); g.lineTo(192, 192); g.stroke();
  g.beginPath(); g.moveTo(192, 64); g.lineTo(64, 192); g.stroke();
  // X edge highlight
  g.strokeStyle = 'rgba(255,120,100,0.35)';
  g.lineWidth = 6;
  g.beginPath(); g.moveTo(64, 60); g.lineTo(192, 188); g.stroke();
  // rivets around the border
  for (let i = 0; i < 6; i++) {
    const p = 22 + i * 42;
    for (const [rx, ry] of [[p, 20], [p, 236], [20, p], [236, p]]) {
      const rg = g.createRadialGradient(rx - 1.5, ry - 1.5, 0.5, rx, ry, 5);
      rg.addColorStop(0, '#b9c0c7');
      rg.addColorStop(1, '#41474e');
      g.fillStyle = rg;
      g.beginPath(); g.arc(rx, ry, 4.5, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Dark-steel shipping container side: corrugation + red X door panel. */
export function containerTexture() {
  const [c, g] = makeCanvas(512, 256);
  g.fillStyle = '#2e3339';
  g.fillRect(0, 0, 512, 256);
  // corrugation bands
  for (let x = 0; x < 512; x += 32) {
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.fillRect(x + 4, 10, 10, 236);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(x + 20, 10, 10, 236);
    g.fillStyle = 'rgba(255,255,255,0.03)';
    g.fillRect(x + 14, 10, 4, 236);
  }
  // grime streaks
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
    const sx = Math.random() * 512;
    g.fillRect(sx, Math.random() * 100, 3 + Math.random() * 4, 60 + Math.random() * 150);
  }
  // top / bottom rails
  g.fillStyle = '#22262b';
  g.fillRect(0, 0, 512, 18);
  g.fillRect(0, 238, 512, 18);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(0, 18, 512, 2);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(0, 236, 512, 3);
  // red X door panel (center)
  g.fillStyle = '#3a4046';
  g.fillRect(196, 52, 120, 152);
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 4;
  g.strokeRect(196, 52, 120, 152);
  g.strokeStyle = '#c22a20';
  g.lineWidth = 18;
  g.beginPath(); g.moveTo(210, 66); g.lineTo(302, 190); g.stroke();
  g.beginPath(); g.moveTo(302, 66); g.lineTo(210, 190); g.stroke();
  // hinge + lock rods on the right
  for (const rx of [352, 380]) {
    g.fillStyle = '#1d2126';
    g.fillRect(rx, 24, 8, 208);
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(rx, 24, 3, 208);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
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

/** Glass crack decal texture — stage 1 hairline, 2 cracked, 3 severe web. */
export function crackTexture(stage = 2) {
  const [c, g] = makeCanvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.translate(128, 128);
  const rays = stage === 1 ? 5 : stage === 2 ? 9 : 13;
  const maxR = stage === 1 ? 70 : stage === 2 ? 110 : 126;
  // main radial fractures
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + Math.random() * 0.4;
    g.lineWidth = stage === 1 ? 2 : 2.5;
    g.beginPath(); g.moveTo(0, 0);
    let r = 0, x = 0, y = 0;
    for (let s = 0; s < 5; s++) {
      r += (maxR / 5) + Math.random() * 12;
      x = Math.cos(a + (Math.random() - 0.5) * 0.5) * Math.min(r, maxR);
      y = Math.sin(a + (Math.random() - 0.5) * 0.5) * Math.min(r, maxR);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // secondary connector cracks
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 1.2;
  const conns = stage === 1 ? 5 : stage === 2 ? 14 : 26;
  for (let i = 0; i < conns; i++) {
    const a = Math.random() * Math.PI * 2;
    const r1 = 14 + Math.random() * maxR * 0.55;
    const r2 = r1 + 14 + Math.random() * 34;
    g.beginPath();
    g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    g.stroke();
  }
  if (stage >= 3) {
    // impact web: concentric fracture rings + bright core
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    for (let ring = 0; ring < 3; ring++) {
      const rr = 34 + ring * 30;
      g.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 10) {
        const wobble = rr + (Math.random() - 0.5) * 12;
        const px = Math.cos(a) * wobble, py = Math.sin(a) * wobble;
        if (a === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
    }
    const rg = g.createRadialGradient(0, 0, 1, 0, 0, 16);
    rg.addColorStop(0, 'rgba(255,255,255,0.95)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill();
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
