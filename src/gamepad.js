// Gamepad support: left stick = move, right stick = look, RT fire, A jump/jet,
// X reload, Y grenade, Start = pause. Plugs into the same player APIs as touch.
export function initGamepad(player, game) {
  let activePad = -1;
  const prev = {};

  window.addEventListener('gamepadconnected', (e) => { activePad = e.gamepad.index; });

  function update(dt) {
    if (typeof navigator.getGamepads !== 'function') return;
    const pads = navigator.getGamepads();
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) { player.touchMove = null; return; }
    activePad = gp.index;

    const dz = (v, d = 0.16) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));
    const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const edge = (i) => { const now = btn(i); const was = !!prev[i]; prev[i] = now; return now && !was; };

    // movement (left stick)
    const lx = dz(gp.axes[0] || 0);
    const ly = dz(gp.axes[1] || 0);
    player.touchMove = { x: lx, y: -ly };

    // look (right stick, frame-rate scaled)
    const rx = dz(gp.axes[2] || 0, 0.12);
    const ry = dz(gp.axes[3] || 0, 0.12);
    if (rx || ry) player.look(rx * dt * 1500, ry * dt * 1200);

    // actions
    player.mouseDown = btn(7) || btn(5);            // RT / RB
    if (btn(0)) player.onKey('Space', true); else if (prev._sp) { player.onKey('Space', false); prev._sp = false; }
    if (btn(0)) prev._sp = true;
    if (edge(2)) player.onKey('KeyR', true);        // X reload
    if (edge(3)) player.onKey('KeyG', true);        // Y grenade
    if (edge(9)) window.dispatchEvent(new Event('ks-pause')); // Start
  }

  return { update };
}
