// Phone controls: left-side joystick, right-side drag to look, on-screen buttons.
export function initTouch(player, game, dom) {
  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
  if (!isTouch) return false;

  const css = document.createElement('style');
  css.textContent = `
    html, body { touch-action: none; overscroll-behavior: none; -webkit-user-select: none; user-select: none; }
    #touchUI { position: fixed; inset: 0; z-index: 5; pointer-events: none; }
    #touchUI .tb { position: absolute; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font: 700 12px/1 system-ui, sans-serif; letter-spacing: .08em; color: #eafffb;
      background: rgba(18,22,20,.55); border: 2px solid rgba(163,185,85,.75); pointer-events: auto; backdrop-filter: blur(3px); }
    #touchUI .tb.on { background: rgba(255,106,26,.6); }
    #tbFire { right: 22px; bottom: 90px; width: 92px; height: 92px; border-color: #ff6a1a; font-size: 14px; box-shadow: 0 0 18px rgba(255,106,26,.35); }
    #tbJump { right: 130px; bottom: 40px; width: 70px; height: 70px; }
    #tbReload { right: 22px; bottom: 200px; width: 56px; height: 56px; }
    #tbGren { right: 92px; bottom: 150px; width: 52px; height: 52px; }
    #joyBase { position: absolute; width: 110px; height: 110px; margin: -55px 0 0 -55px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.35); background: rgba(255,255,255,.08); display: none; }
    #joyKnob { position: absolute; width: 46px; height: 46px; left: 32px; top: 32px; border-radius: 50%; background: rgba(163,185,85,.7); }
  `;
  document.head.appendChild(css);

  const ui = document.createElement('div');
  ui.id = 'touchUI';
  ui.innerHTML = `
    <div id="joyBase"><div id="joyKnob"></div></div>
    <div class="tb" id="tbFire" data-tb="fire">FIRE</div>
    <div class="tb" id="tbJump" data-tb="jump">JET</div>
    <div class="tb" id="tbReload" data-tb="reload">RLD</div>
    <div class="tb" id="tbGren" data-tb="gren">GRN</div>`;
  document.body.appendChild(ui);
  const joyBase = ui.querySelector('#joyBase'), joyKnob = ui.querySelector('#joyKnob');

  const roles = new Map();
  const live = () => dom.menuOverlay.classList.contains('hidden') && dom.endOverlay.classList.contains('hidden') && !document.querySelector('.ks-modal.open');
  const setMove = (f, b, l, r) => {
    player.onKey('KeyW', f); player.onKey('KeyS', b); player.onKey('KeyA', l); player.onKey('KeyD', r);
  };
  const press = (k, down) => {
    if (k === 'fire') player.mouseDown = down;
    else if (k === 'jump') player.onKey('Space', down);
    else if (k === 'reload' && down) player.onKey('KeyR', true);
    else if (k === 'gren' && down) player.onKey('KeyG', true);
    else if (k === 'pause' && down) window.dispatchEvent(new Event('ks-pause'));
  };

  window.addEventListener('touchstart', (e) => {
    if (!live()) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const btn = el && el.closest ? el.closest('[data-tb]') : null;
      if (btn) {
        roles.set(t.identifier, { type: 'btn', k: btn.dataset.tb, el: btn, lx: t.clientX, ly: t.clientY });
        btn.classList.add('on'); press(btn.dataset.tb, true);
      } else if (t.clientX < innerWidth * 0.45 && ![...roles.values()].some((r) => r.type === 'move')) {
        roles.set(t.identifier, { type: 'move', ox: t.clientX, oy: t.clientY });
        joyBase.style.display = 'block'; joyBase.style.left = t.clientX + 'px'; joyBase.style.top = t.clientY + 'px';
        joyKnob.style.transform = 'translate(0,0)';
      } else {
        roles.set(t.identifier, { type: 'look', lx: t.clientX, ly: t.clientY });
      }
    }
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!roles.size) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      const r = roles.get(t.identifier);
      if (!r) continue;
      if (r.type === 'move') {
        let dx = t.clientX - r.ox, dy = t.clientY - r.oy;
        const len = Math.hypot(dx, dy), max = 45;
        if (len > max) { dx = dx / len * max; dy = dy / len * max; }
        joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
        setMove(dy < -14, dy > 14, dx < -14, dx > 14);
      } else {
        player.look((t.clientX - r.lx) * 1.6, (t.clientY - r.ly) * 1.6);
        r.lx = t.clientX; r.ly = t.clientY;
      }
    }
  }, { passive: false });

  const end = (e) => {
    for (const t of e.changedTouches) {
      const r = roles.get(t.identifier);
      if (!r) continue;
      roles.delete(t.identifier);
      if (r.type === 'move') { setMove(false, false, false, false); joyBase.style.display = 'none'; }
      else if (r.type === 'btn') { r.el.classList.remove('on'); press(r.k, false); }
    }
  };
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);
  return true;
}
