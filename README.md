# SPACEPORT SHOWDOWN — 5v5 Arena FPS

A first-person sci-fi arena shooter built with **Three.js + Vite**, deployable to **Vercel** as a static site.
Recreated from a 15-second gameplay prompt: a ranked 5v5 team-elimination round on a sunny cliffside
spaceport above a red-rock desert canyon.

![style](https://img.shields.io/badge/render-Three.js%20WebGL2-35e0d0)

## The round (mapped to the source footage)

| Beat | In game |
| --- | --- |
| Strafe out from a hover-crate, drop the enemy at the hangar entrance | Hangar door slides open with a teal glow at round start; first enemy patrols the entrance |
| Wide-swing around the shuttle, two-tap the enemy behind the landing gear | Cargo dropship on the west pad with four solid landing-gear legs to play around |
| Shoot the fuel canister beside the enemy on the catwalk | Explosive canisters chain-detonate: orange fireball + blue energy ring |
| Jetpack up to a higher pad, swap energy cells mid-air | East elevated pad, steam-hiss reload, thruster fuel that sputters when empty |
| Two enemies rocket up; tap one mid-air | Pusher squad hunts you with jetpacks when you take high ground |
| Sticky grenade on the radar dish, pink-white shockwave | Plasma grenades stick to anything and launch bots off ledges |
| Two enemies push across the glass sky bridge; boost sideways, glass cracks | Breakable bridge panels crack, then shatter under fire |
| Round won — inspect the rifle, coils pulsing | Auto inspect-flip animation + round-win sting on a full squad wipe |

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | Move / strafe |
| Mouse | Aim · **LMB** fire plasma |
| `Space` | Jump · hold = jetpack boost (teal thrusters) |
| `R` | Swap energy cell (steam hiss) |
| `G` | Plasma grenade (sticky, 3 per round) |
| `F` | Inspect rifle (flip animation, coils pulse) |
| `Esc` | Release mouse / pause |

HUD is intentionally off — only a small green crosshair, exactly like the footage. Damage and boost
feedback is delivered through vignettes and audio instead.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production bundle in dist/
npm run preview  # serve the production build
```

## Deploy to Vercel

**Option A — Dashboard / Git:** push this folder to a GitHub repo, then *New Project → Import*.
Vercel auto-detects Vite (`vercel.json` pins it): build `vite build`, output `dist`.

**Option B — CLI:**

```bash
npm i -g vercel
vercel        # preview deployment
vercel --prod # production
```

No environment variables, no server functions — the game is 100% client-side.

## Tech notes

- **Three.js r180** (ES modules via Vite), ACES filmic tone mapping, PMREM sky environment for PBR,
  hard PCF noon shadows, UnrealBloom for energy FX, MSAA render target.
- **Procedural everything** — deck grating, hazard stripes, weapon screen, glass cracks and all particle
  sprites are canvas-generated; all sound (plasma bursts, laser zaps, jetpack whoosh, footsteps on
  metal/glass, explosion booms, grenade beeps, steam hiss, canyon wind, round-win sting) is synthesized
  with the Web Audio API. Zero binary assets.
- **Performance** — instanced plasma bolts, single-draw-call particle pools (~1,800 particles), AABB
  collision with swept segment raycasts for projectiles, pooled lights/decals/rings.
- `?demo=1` starts an automatic cinematic orbit of a live round (bots fight, no player) — handy for
  screenshots and streams.

## Project structure

```
index.html            overlay UI (menu, end screen, crosshair, vignettes)
src/main.js           boot, post-processing pipeline, input, loop
src/config.js         tuning constants + palette
src/world.js          map: canyon, deck, hangar, pads, shuttle, sky bridge, radar tower…
src/player.js         movement, jetpack, viewmodel, weapons, grenades
src/bots.js           grey-orange enemies & purple allies: AI, combat, ragdolls
src/effects.js        particles, bolts, shockwaves, decals
src/audio.js          Web Audio synth engine
src/game.js           round logic, director, damage resolution
```
