// Settings modal (graphics, sound, sensitivity) + pause modal. Saved on the phone.
const KEY = 'ks_settings_v1';
const QUALITY = { low: 0.65, med: 0.9, high: 1.35, ultra: 2.0 };

export function initSettings({ composer, bloom, audio, player, world, renderer }) {
  let s = { quality: 'med', bloom: true, shadows: true, glass: true, volume: 85, sens: 100 };
  try { s = { ...s, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { /* ignore */ }

  const applyShadows = () => {
    if (!renderer || !world) return;
    const on = !!s.shadows;
    renderer.shadowMap.enabled = on;
    if (world.sun) world.sun.castShadow = on;
    // force material recompile once
    world.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  };
  const applyGlass = () => {
    if (world && world.glassMat) world.setGlassQuality(!!s.glass);
  };

  const apply = () => {
    composer.setPixelRatio(QUALITY[s.quality] || 1);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloom.enabled = !!s.bloom;
    bloom.strength = s.quality === 'ultra' ? 0.62 : 0.52;
    if (audio.master) audio.master.gain.value = s.volume / 100;
    player.sens = s.sens / 100;
    applyShadows();
    applyGlass();
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } apply(); };

  const m = document.createElement('div');
  m.className = 'ks-modal'; m.id = 'settingsModal';
  m.innerHTML = `
    <div class="ks-card">
      <h2>Settings</h2>
      <div class="row"><label>Graphics</label>
        <div class="seg" id="sQuality"><button data-v="low">Low</button><button data-v="med">Med</button><button data-v="high">High</button><button data-v="ultra">Ultra 4K</button></div></div>
      <div class="row"><label>Real-time shadows</label>
        <div class="seg" id="sShadows"><button data-v="1">On</button><button data-v="0">Off</button></div></div>
      <div class="row"><label>Refraction glass</label>
        <div class="seg" id="sGlass"><button data-v="1">On</button><button data-v="0">Off</button></div></div>
      <div class="row"><label>Glow effects</label>
        <div class="seg" id="sBloom"><button data-v="1">On</button><button data-v="0">Off</button></div></div>
      <div class="row"><label>Volume <b id="sVolV"></b></label><input type="range" id="sVol" min="0" max="100" /></div>
      <div class="row"><label>Look sensitivity <b id="sSensV"></b></label><input type="range" id="sSens" min="40" max="220" /></div>
      <button class="btn-main" id="sClose">Done</button>
    </div>`;
  document.body.appendChild(m);
  const $ = (id) => m.querySelector('#' + id);
  const paint = () => {
    m.querySelectorAll('#sQuality button').forEach((b) => b.classList.toggle('on', b.dataset.v === s.quality));
    m.querySelectorAll('#sShadows button').forEach((b) => b.classList.toggle('on', (b.dataset.v === '1') === !!s.shadows));
    m.querySelectorAll('#sGlass button').forEach((b) => b.classList.toggle('on', (b.dataset.v === '1') === !!s.glass));
    m.querySelectorAll('#sBloom button').forEach((b) => b.classList.toggle('on', (b.dataset.v === '1') === !!s.bloom));
    $('sVol').value = s.volume; $('sVolV').textContent = s.volume + '%';
    $('sSens').value = s.sens; $('sSensV').textContent = s.sens + '%';
  };
  m.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'sClose') return close();
    if (b.parentElement.id === 'sQuality') s.quality = b.dataset.v;
    if (b.parentElement.id === 'sShadows') s.shadows = b.dataset.v === '1';
    if (b.parentElement.id === 'sGlass') s.glass = b.dataset.v === '1';
    if (b.parentElement.id === 'sBloom') s.bloom = b.dataset.v === '1';
    save(); paint();
  });
  $('sVol').addEventListener('input', (e) => { s.volume = +e.target.value; save(); paint(); });
  $('sSens').addEventListener('input', (e) => { s.sens = +e.target.value; save(); paint(); });

  const open = () => { paint(); m.classList.add('open'); };
  const close = () => m.classList.remove('open');
  paint(); apply();
  return { open, close, apply };
}
