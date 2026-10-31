// Shared constants & palette — tuned to match the reference footage.
export const COLORS = {
  skyTop: 0x2e7fd6,
  skyHorizon: 0xcfe9ff,
  sunColor: 0xfff3dd,
  fog: 0xd9ecff,

  deck: 0x4a5058,
  deckEdge: 0x363c44,
  padDark: 0x3a3f46,
  buildingWhite: 0xf1f3f5,
  buildingTrim: 0x565e66,
  shuttleWhite: 0xe8ecef,
  crateTan: 0xc9b48f,
  crateDark: 0x2e2f33,

  teal: 0x35e0d0,
  tealHot: 0x66fff0,
  pink: 0xff3fae,
  pinkHot: 0xff7ccf,
  white: 0xffffff,

  enemyGrey: 0x8b929b,
  enemyOrange: 0xd96f1e,
  enemyLaser: 0xffa63d,
  allyPurple: 0x7a4fd0,
  allyArmor: 0x6e6478,

  canyonRed: 0xb0603a,
  canyonDark: 0x8a4a30,
  canyonDeep: 0x6e3a26,
};

export const CONFIG = {
  FOV: 90,
  FOV_BOOST: 97,

  GRAVITY: 22,
  MOVE_SPEED: 8.2,
  ACCEL_GROUND: 60,
  ACCEL_AIR: 26,
  FRICTION: 9.0,

  JUMP_VEL: 7.4,
  JET_THRUST: 34,
  JET_MAX_FUEL: 3.4,
  JET_RECHARGE_RATE: 1.6, // x per second on ground
  JET_LATERAL_ASSIST: 6,

  PLAYER_HP: 100,
  PLAYER_HALF: 0.36,
  PLAYER_HEIGHT: 1.8,
  EYE_HEIGHT: 1.62,
  REGEN_DELAY: 4.0,
  REGEN_RATE: 22,

  BOLT_SPEED: 170,
  BOLT_LIFE: 1.4,
  FIRE_INTERVAL: 0.115,
  BOLT_DMG_BODY: 50,
  BOLT_DMG_HEAD: 100,

  LASER_DMG_PLAYER: 11,
  LASER_DMG_BOT: 16,

  MAG_SIZE: 24,
  RELOAD_TIME: 1.0,
  GRENADES: 3,

  CANISTER_HP: 30,
  CANISTER_RADIUS: 7.5,
  CANISTER_DMG: 130,
  CANISTER_IMPULSE: 17,

  GRENADE_RADIUS: 6.2,
  GRENADE_DMG: 110,
  GRENADE_IMPULSE: 15,
  GRENADE_FUSE: 1.7,

  BOT_HP: 100,
  ALLY_HP: 100,

  CANYON_KILL_Y: -26,
};
