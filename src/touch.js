// Phone controls: analog left joystick, right-side drag to look, on-screen buttons, haptics.
export function initTouch(player, game, dom) {
  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches)
    || 'ontouchstart' in window
    || new URLSearchParams(location.search).has('touch'); // desktop preview of the phone UI
  if (!isTouch) return false;

  const css = document.createElement('style');
  css.textContent = `
    html, body { touch-action: none; overscroll-behavior: none; -webkit-user-select: none; user-select: none; }
    #touchUI { position: fixed; inset: 0; z-index: 5; pointer-events: none; transition: opacity .3s; }
    #touchUI.dim { opacity: 0; }
    #touchUI .tb { position: absolute; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font: 700 12px/1 system-ui, sans-serif; letter-spacing: .08em; color: #eafffb;
      background: rgba(18,22,20,.55); border: 2px solid rgba(163,185,85,.75); pointer-events: auto; backdrop-filter: blur(3px); }
    #touchUI .tb.on { background: rgba(255,106,26,.6); }
    #tbFire { right: 22px; bottom: 90px; width: 96px; height: 96px; border-color: #ff6a1a; font-size: 15px; box-shadow: 0 0 18px rgba(255,106,26,.35); }
    #tbJump { right: 132px; bottom: 42px; width: 72px; height: 72px; }
    #tbReload { right: 24px; bottom: 204px; width: 58px; height: 58px; }
    #tbGren { right: 96px; bottom: 156px; width: 54px; height: 54px; }
    #joyBase { position: absolute; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.35); background: rgba(255,255,255,.08); display: none; }
    #joyBase::after { content: ''; position: absolute; inset: 26px; border-radius: 50%; border: 1px dashed rgba(255,255,255,.18); }
    #joyKnob { position: absolute; width: 50px; height: 50px; left: 33px; top: 33px; border-radius: 50%;
      background: rgba(163,185,85,.75); box-shadow: 0 0 12px rgba(163,185,85,.5); }
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

  // hide the on-screen controls while menus are up
  const syncVis = () => {
    const live = dom.menuOverlay.classList.contains('hidden') && dom.endOverlay.classList.contains('hidden');
    ui.classList.toggle('dim', !live);
  };
  new MutationObserver(syncVis).observe(dom.menuOverlay, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(syncVis).observe(dom.endOverlay, { attributes: true, attributeFilter: ['class'] });
  syncVis();

  const roles = new Map();
  const live = () => dom.menuOverlay.classList.contains('hidden') && dom.endOverlay.classList.contains('hidden') && !document.querySelector('.ks-modal.open');
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* ignore */ } };
  const press = (k, down) => {
    if (k === 'fire') { player.mouseDown = down; if (down) buzz(8); }
    else if (k === 'jump') { player.onKey('Space', down); if (down) buzz(6); }
    else if (k === 'reload' && down) { player.onKey('KeyR', true); buzz(14); }
    else if (k === 'gren' && down) { player.onKey('KeyG', true); buzz(14); }
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
        const len = Math.hypot(dx, dy), max = 52;
        if (len > max) { dx = dx / len * max; dy = dy / len * max; }
        joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
        // analog vector with a small dead zone
        const dead = 0.14;
        let ax = dx / max, ay = dy / max;
        const mag = Math.hypot(ax, ay);
        if (mag < dead) { ax = 0; ay = 0; }
        else {
          const k = (mag - dead) / (1 - dead) / mag;
          ax *= k; ay *= k;
        }
        player.touchMove = { x: ax, y: -ay };
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
      if (r.type === 'move') {
        player.touchMove = { x: 0, y: 0 };
        joyBase.style.display = 'none';
      } else if (r.type === 'btn') { r.el.classList.remove('on'); press(r.k, false); }
    }
  };
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);
  return true;
}
