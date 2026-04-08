import * as THREE from "three";

const PLAYER_HW = 0.34;
const PLAYER_HH = 0.56;
const MOVE = 6.2;
const GRAVITY = -32;
const JUMP_V = 11.5;
const MAX_FALL = 22;
const COYOTE = 0.08;
const JUMP_BUFFER = 0.1;
const ROUTER_REACH = 1.15;
const KILL_Y = -3.8;

/**
 * @typedef {{ minX: number; maxX: number; minY: number; maxY: number }} AABB
 * @typedef {{ minX: number; maxX: number; minY: number; maxY: number }} ExitZone
 */

const LEVELS = [
  {
    name: "Level 1 — First hop",
    hint:
      "← → or A D · Space jump · Reach the green door · Stand by the router to open the wall",
    spawn: { x: -6.2, y: -0.46 },
    platforms: [
      { minX: -14, maxX: 16, minY: -2.05, maxY: -1.02, color: 0x3a3848 },
    ],
    barrier: { minX: 3.55, maxX: 4.25, minY: -1.02, maxY: 1.35, color: 0x554f66 },
    routers: [{ x: -0.8, y: -0.85 }],
    exit: { minX: 9.35, maxX: 11.05, minY: -1.2, maxY: 1.2, centerX: 10.2 },
    afterRouterHud: "Wall open — head for the green door",
    winTitle: "Online!",
    winSub:
      "The router cleared the firewall. Ready for the backbone closet?",
    nextIsFinal: false,
  },
  {
    name: "Level 2 — Dual uplink",
    hint:
      "← → · Space jump · Ping BOTH routers (floor + shelf) — then run for the door",
    spawn: { x: -11, y: -0.46 },
    platforms: [
      { minX: -16, maxX: 18, minY: -2.05, maxY: -1.02, color: 0x353042 },
      { minX: 4.2, maxX: 7.4, minY: 0.15, maxY: 0.58, color: 0x4a4558 },
    ],
    barrier: { minX: 7.85, maxX: 8.55, minY: -1.02, maxY: 1.45, color: 0x4a3d55 },
    routers: [
      { x: -4.2, y: -0.85 },
      { x: 5.8, y: 0.76 },
    ],
    exit: { minX: 13.4, maxX: 15.1, minY: -1.25, maxY: 1.35, centerX: 14.25 },
    afterRouterHud: "Both links up — sprint to the Wi‑Fi door",
    winTitle: "Backbone!",
    winSub:
      "Two routers, one path. Your moving computer cleared the IT closet.",
    nextIsFinal: false,
  },
  {
    name: "Level 3 — Full stack",
    hint:
      "Dodge the glitch · Grab USB · Hit BOTH sync pads within 0.5s · Door opens ~8s — ride the moving slab to the exit",
    spawn: { x: -11.5, y: -0.46 },
    platforms: [
      { minX: -18, maxX: 3.2, minY: -2.05, maxY: -1.02, color: 0x302838 },
      { minX: 9, maxX: 22, minY: -2.05, maxY: -1.02, color: 0x302838 },
    ],
    barrier: { minX: 3.35, maxX: 4.05, minY: -1.02, maxY: 1.35, color: 0x553355 },
    timedBarrierSec: 8,
    routers: [],
    syncPlates: [
      { cx: -3.4, cy: -0.46, r: 0.55 },
      { cx: -0.2, cy: -0.46, r: 0.55 },
    ],
    usb: { cx: -7.9, cy: -0.46 },
    glitch: { minX: -9.6, maxX: -6.8, y: -0.46, half: 0.3 },
    movingPlatform: {
      centerX: 6.25,
      amplitude: 1.05,
      speed: 1.15,
      halfW: 0.68,
      minY: -2.05,
      maxY: -1.02,
    },
    exit: {
      minX: 16.2,
      maxX: 17.85,
      minY: -1.25,
      maxY: 1.25,
      centerX: 17,
    },
    requiresUsb: true,
    afterSyncHud: "~8s left — jump on the green slab, then the door",
    winTitle: "Admin!",
    winSub:
      "Timed link, sync, USB, moving deck, glitch dodge — that’s shipping.",
    nextIsFinal: true,
  },
];

let keys = { left: false, right: false, jump: false };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010008);
scene.fog = new THREE.Fog(0x020010, 18, 52);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

/** Distance of photo plane from camera; fills the frustum exactly at this Z. */
const BG_PLANE_DIST = 58;
/** Lower = more sky at top of photo; higher = more beach/water (try 0.45–0.65). */
const BG_TEXTURE_BAND = 0.56;
/** @type {THREE.Mesh | null} */
let bgPhotoMesh = null;

function resizePhotoBackground() {
  if (!bgPhotoMesh) return;
  const vFov = (camera.fov * Math.PI) / 180;
  const hh = 2 * Math.tan(vFov / 2) * BG_PLANE_DIST;
  const ww = hh * camera.aspect;
  bgPhotoMesh.scale.set(ww, hh, 1);
}

/**
 * Full-screen billboards behind the level, sampling the lower part of the texture
 * so sand/water (beach) stay visible instead of only sky.
 */
function setupPhotoBackground(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;

  const uniforms = {
    map: { value: tex },
    /** Fraction of image height taken from the bottom (beach + sea + horizon). */
    uBand: { value: BG_TEXTURE_BAND },
    /** 0 = sample from texture bottom upward; tweak if beach flips. */
    uAnchorBottom: { value: 1.0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float uBand;
      uniform float uAnchorBottom;
      varying vec2 vUv;
      void main() {
        float ty;
        if (uAnchorBottom > 0.5) {
          ty = vUv.y * uBand;
        } else {
          ty = 1.0 - (1.0 - vUv.y) * uBand;
        }
        ty = clamp(ty, 0.001, 0.999);
        gl_FragColor = texture2D(map, vec2(vUv.x, ty));
      }
    `,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });

  bgPhotoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  bgPhotoMesh.frustumCulled = false;
  bgPhotoMesh.renderOrder = -3000;
  bgPhotoMesh.position.z = -BG_PLANE_DIST;
  camera.add(bgPhotoMesh);
  resizePhotoBackground();
  scene.fog.color.setHex(0x6aa6c8);
}

const bgTexLoader = new THREE.TextureLoader();
bgTexLoader.load(
  "/bg/tropical.png",
  (tex) => {
    setupPhotoBackground(tex);
  },
  undefined,
  () => {
    console.warn(
      "[bg] Missing public/bg/tropical.png — using solid color. Add your image there."
    );
  }
);

const SAVER_BOUNDS = { minX: -21, maxX: 21, minY: -12, maxY: 12 };
const MYSTIFY_COLORS = [
  0x00ffcc, 0xff33ee, 0xffff00, 0x44ff66, 0xff8800, 0x33aaff, 0xff6699,
];

function addScreensaver90s() {
  const bgRoot = new THREE.Group();
  bgRoot.name = "screensaver90s";
  bgRoot.position.set(0, 0, -36);
  bgRoot.frustumCulled = false;
  camera.add(bgRoot);

  /** @type {{ pts: { x: number; y: number; vx: number; vy: number }[]; geo: THREE.BufferGeometry }[]} */
  const polygons = [];

  for (let i = 0; i < 7; i++) {
    const n = 4 + (i % 4);
    const pts = [];
    const w = SAVER_BOUNDS.maxX - SAVER_BOUNDS.minX;
    const h = SAVER_BOUNDS.maxY - SAVER_BOUNDS.minY;
    const spd = 5 + i * 0.85;
    for (let j = 0; j < n; j++) {
      pts.push({
        x: (Math.random() - 0.5) * w * 0.82,
        y: (Math.random() - 0.5) * h * 0.82,
        vx: (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random()) * spd,
        vy: (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random()) * spd,
      });
    }
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(n * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: MYSTIFY_COLORS[i % MYSTIFY_COLORS.length],
      transparent: true,
      opacity: 0.78,
      fog: false,
    });
    const line = new THREE.LineLoop(geo, mat);
    line.frustumCulled = false;
    bgRoot.add(line);
    polygons.push({ pts, geo });
  }

  const starGeo = new THREE.BufferGeometry();
  const starCount = 220;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 50;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 32;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 4;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xaabbdd,
    size: 0.07,
    transparent: true,
    opacity: 0.45,
    fog: false,
    sizeAttenuation: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.position.z = -2;
  bgRoot.add(stars);

  return function updateScreensaver90s(dt) {
    for (const poly of polygons) {
      for (const pt of poly.pts) {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.x <= SAVER_BOUNDS.minX) {
          pt.x = SAVER_BOUNDS.minX;
          pt.vx *= -1;
        } else if (pt.x >= SAVER_BOUNDS.maxX) {
          pt.x = SAVER_BOUNDS.maxX;
          pt.vx *= -1;
        }
        if (pt.y <= SAVER_BOUNDS.minY) {
          pt.y = SAVER_BOUNDS.minY;
          pt.vy *= -1;
        } else if (pt.y >= SAVER_BOUNDS.maxY) {
          pt.y = SAVER_BOUNDS.maxY;
          pt.vy *= -1;
        }
      }
      const pos = poly.geo.attributes.position.array;
      const n = poly.pts.length;
      for (let i = 0; i < n; i++) {
        pos[i * 3] = poly.pts[i].x;
        pos[i * 3 + 1] = poly.pts[i].y;
        pos[i * 3 + 2] = 0;
      }
      poly.geo.attributes.position.needsUpdate = true;
    }
    stars.rotation.z += dt * 0.03;
  };
}

const updateScreensaver90s = addScreensaver90s();

scene.add(camera);

scene.add(new THREE.AmbientLight(0x9ab0e0, 0.45));
const sun = new THREE.DirectionalLight(0xffffff, 1.05);
sun.position.set(8, 18, 10);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(2048);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x6688cc, 0.35);
fill.position.set(-6, 6, -4);
scene.add(fill);

function deskGround() {
  const g = new THREE.PlaneGeometry(80, 24);
  const m = new THREE.MeshStandardMaterial({
    color: 0x2a2638,
    roughness: 0.85,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -2.35;
  mesh.receiveShadow = true;
  scene.add(mesh);
}
deskGround();

function addPlatformMesh(minX, maxX, minY, maxY, color, z = 0) {
  const w = maxX - minX;
  const h = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const geo = new THREE.BoxGeometry(w, h, 0.65);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.65,
    metalness: 0.12,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, cy, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function createRouterGroup() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.35, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x2c2c34, roughness: 0.5 })
  );
  body.castShadow = true;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.035, 12, 24),
    new THREE.MeshStandardMaterial({
      color: 0x44dd88,
      emissive: 0x114422,
      emissiveIntensity: 0.6,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.22;
  const blink = new THREE.PointLight(0x55ff99, 0.35, 3);
  blink.position.set(0, 0.25, 0.2);
  g.add(body, ring, blink);
  return g;
}

function createExitGroup(centerX) {
  const g = new THREE.Group();
  g.position.set(centerX, -0.15, 0);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 1.35, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x1e3d28, roughness: 0.4 })
  );
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 1.05),
    new THREE.MeshStandardMaterial({
      color: 0x33ff88,
      emissive: 0x22cc66,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.92,
    })
  );
  glow.position.z = 0.11;
  g.add(frame, glow);
  return g;
}

/** @type {THREE.Mesh[]} */
let levelMeshes = [];
/** @type {THREE.Group[]} */
let routerGroups = [];
/** @type {THREE.Mesh | null} */
let barrierMesh = null;
/** @type {THREE.Group | null} */
let exitGroup = null;
/** @type {THREE.Group | null} */
let usbGroup = null;
/** @type {THREE.Mesh | null} */
let glitchMesh = null;
/** @type {THREE.Mesh[]} */
let syncPlateMeshes = [];
/**
 * @type {null | {
 *   mesh: THREE.Mesh;
 *   x: number;
 *   phase: number;
 *   rect: AABB;
 *   centerX: number;
 *   amplitude: number;
 *   speed: number;
 *   halfW: number;
 * }}
 */
let movingPlatform = null;

let glitchX = 0;
let glitchVx = 4;
let hasUsb = false;
let syncDone = false;
let lastSeenA = -1e9;
let lastSeenB = -1e9;
let levelElapsed = 0;
let timedBarrierTimer = 0;

let levelIndex = 0;
/** @type {AABB[]} */
let platformRects = [];
let routerAllOn = false;
/** @type {boolean[]} */
let routerActivated = [];

function disposeLevelContent() {
  for (const m of levelMeshes) {
    scene.remove(m);
    m.geometry.dispose();
    if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
    else m.material.dispose();
  }
  levelMeshes = [];
  barrierMesh = null;
  for (const g of routerGroups) {
    scene.remove(g);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((x) => x.dispose());
        else o.material.dispose();
      }
    });
  }
  routerGroups = [];
  if (exitGroup) {
    scene.remove(exitGroup);
    exitGroup.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((x) => x.dispose());
        else o.material.dispose();
      }
    });
    exitGroup = null;
  }
  if (usbGroup) {
    scene.remove(usbGroup);
    usbGroup.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((x) => x.dispose());
        else o.material.dispose();
      }
    });
    usbGroup = null;
  }
  if (glitchMesh) {
    scene.remove(glitchMesh);
    glitchMesh.geometry.dispose();
    if (Array.isArray(glitchMesh.material))
      glitchMesh.material.forEach((x) => x.dispose());
    else glitchMesh.material.dispose();
    glitchMesh = null;
  }
  for (const m of syncPlateMeshes) {
    scene.remove(m);
    m.geometry.dispose();
    if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
    else m.material.dispose();
  }
  syncPlateMeshes = [];
  if (movingPlatform) {
    scene.remove(movingPlatform.mesh);
    movingPlatform.mesh.geometry.dispose();
    if (Array.isArray(movingPlatform.mesh.material))
      movingPlatform.mesh.material.forEach((x) => x.dispose());
    else movingPlatform.mesh.material.dispose();
    movingPlatform = null;
  }
}

function rebuildPlatformRects() {
  const L = LEVELS[levelIndex];
  /** @type {AABB[]} */
  const p = L.platforms.map((b) => ({
    minX: b.minX,
    maxX: b.maxX,
    minY: b.minY,
    maxY: b.maxY,
  }));
  if (movingPlatform) {
    p.push(movingPlatform.rect);
  }
  if (L.barrier) {
    let block = true;
    if (L.timedBarrierSec != null) {
      block = timedBarrierTimer <= 0;
    } else if (L.routers && L.routers.length > 0) {
      block = !routerAllOn;
    }
    if (block) {
      p.push({
        minX: L.barrier.minX,
        maxX: L.barrier.maxX,
        minY: L.barrier.minY,
        maxY: L.barrier.maxY,
      });
    }
  }
  platformRects = p;
}

function loadLevel(idx) {
  disposeLevelContent();
  levelIndex = idx;
  const L = LEVELS[levelIndex];
  routerAllOn = !(L.routers && L.routers.length > 0);
  routerActivated = (L.routers || []).map(() => false);

  hasUsb = false;
  syncDone = false;
  lastSeenA = -1e9;
  lastSeenB = -1e9;
  levelElapsed = 0;
  timedBarrierTimer = 0;
  glitchVx = 4;

  for (const p of L.platforms) {
    const mesh = addPlatformMesh(
      p.minX,
      p.maxX,
      p.minY,
      p.maxY,
      p.color ?? 0x3a3848
    );
    levelMeshes.push(mesh);
  }

  if (L.barrier) {
    barrierMesh = addPlatformMesh(
      L.barrier.minX,
      L.barrier.maxX,
      L.barrier.minY,
      L.barrier.maxY,
      L.barrier.color ?? 0x554f66
    );
    levelMeshes.push(barrierMesh);
  }

  if (L.routers) {
    for (const r of L.routers) {
      const rg = createRouterGroup();
      rg.position.set(r.x, r.y, 0);
      scene.add(rg);
      routerGroups.push(rg);
    }
  }

  if (L.syncPlates) {
    for (const sp of L.syncPlates) {
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(sp.r, sp.r, 0.07, 28),
        new THREE.MeshStandardMaterial({
          color: 0x6644cc,
          emissive: 0x221144,
          emissiveIntensity: 0.45,
          roughness: 0.5,
        })
      );
      disc.rotation.x = Math.PI / 2;
      disc.position.set(sp.cx, -1.04, 0);
      disc.receiveShadow = true;
      scene.add(disc);
      syncPlateMeshes.push(disc);
    }
  }

  if (L.usb) {
    usbGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.1, 0.48),
      new THREE.MeshStandardMaterial({
        color: 0xd4a82a,
        metalness: 0.55,
        roughness: 0.35,
      })
    );
    body.castShadow = true;
    const tip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.06, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.4 })
    );
    tip.position.set(0, 0, 0.26);
    usbGroup.add(body, tip);
    usbGroup.position.set(L.usb.cx, L.usb.cy + 0.12, 0);
    scene.add(usbGroup);
  }

  if (L.glitch) {
    const g = L.glitch;
    const s = g.half * 2;
    glitchMesh = new THREE.Mesh(
      new THREE.BoxGeometry(s, s, 0.45),
      new THREE.MeshStandardMaterial({
        color: 0xff1a44,
        emissive: 0x660022,
        emissiveIntensity: 0.65,
        transparent: true,
        opacity: 0.9,
      })
    );
    glitchMesh.castShadow = true;
    glitchX = (g.minX + g.maxX) / 2;
    glitchMesh.position.set(glitchX, g.y, 0);
    scene.add(glitchMesh);
  }

  if (L.movingPlatform) {
    const mp = L.movingPlatform;
    const w = mp.halfW * 2;
    const h = mp.maxY - mp.minY;
    const geo = new THREE.BoxGeometry(w, h, 0.65);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2d8a5e,
      roughness: 0.55,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(mp.centerX, (mp.minY + mp.maxY) / 2, 0);
    scene.add(mesh);
    movingPlatform = {
      mesh,
      x: mp.centerX,
      phase: 0,
      rect: {
        minX: mp.centerX - mp.halfW,
        maxX: mp.centerX + mp.halfW,
        minY: mp.minY,
        maxY: mp.maxY,
      },
      centerX: mp.centerX,
      amplitude: mp.amplitude,
      speed: mp.speed,
      halfW: mp.halfW,
    };
  }

  exitGroup = createExitGroup(L.exit.centerX);
  scene.add(exitGroup);

  rebuildPlatformRects();

  hudGoal.textContent = L.name;
  hudHint.textContent = L.hint;

  px = L.spawn.x;
  py = L.spawn.y;
  vx = 0;
  vy = 0;
  groundedLast = true;
  camera.position.set(L.spawn.x + 1.2, 2.1, 11);
  camera.lookAt(L.spawn.x + 0.5, -0.2, 0);
}

function makeComputer() {
  const g = new THREE.Group();
  const bezel = new THREE.MeshStandardMaterial({
    color: 0x2a2a32,
    roughness: 0.45,
    metalness: 0.25,
  });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x1a3a50,
    emissive: 0x3399cc,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.12), bezel);
  monitor.position.set(0, 0.28, 0);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.38, 0.02), screenMat);
  face.position.set(0, 0.28, 0.08);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.1), bezel);
  neck.position.set(0, -0.02, 0);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.45), bezel);
  base.position.set(0, -0.14, 0.06);
  const keyGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.03, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0x334455,
      emissive: 0x223344,
      emissiveIntensity: 0.3,
    })
  );
  keyGlow.position.set(0, -0.18, 0.18);
  for (const m of [monitor, face, neck, base, keyGlow]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

const computer = makeComputer();
scene.add(computer);

let px = 0;
let py = 0;
let vx = 0;
let vy = 0;
let coyote = 0;
let jumpBuf = 0;
let won = false;
let fell = false;
let groundedLast = true;

const winEl = document.getElementById("win");
const winTitleEl = document.getElementById("win-title");
const winSub = document.getElementById("win-sub");
const playAgainBtn = document.getElementById("play-again");
const gameoverEl = document.getElementById("gameover");
const restartBtn = document.getElementById("restart");
const hudGoal = document.getElementById("score");
const hudHint = document.getElementById("hint");

function setKeys(code, down) {
  if (code === "ArrowLeft" || code === "KeyA") keys.left = down;
  if (code === "ArrowRight" || code === "KeyD") keys.right = down;
  if (code === "ArrowUp" || code === "KeyW" || code === "Space")
    keys.jump = down;
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (won && (e.code === "KeyR" || e.code === "Space")) {
    e.preventDefault();
    handleWinAction();
    return;
  }
  if (fell && (e.code === "KeyR" || e.code === "Space")) {
    e.preventDefault();
    respawn();
    return;
  }
  if (e.code === "Space") e.preventDefault();
  setKeys(e.code, true);
});
window.addEventListener("keyup", (e) => setKeys(e.code, false));

function rectsOverlap(a, b) {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY
  );
}

function playerRect() {
  return {
    minX: px - PLAYER_HW,
    maxX: px + PLAYER_HW,
    minY: py - PLAYER_HH,
    maxY: py + PLAYER_HH,
  };
}

function routerPinged(i) {
  const L = LEVELS[levelIndex];
  const r = L.routers[i];
  const dist = Math.hypot(px - r.x, py - r.y);
  return dist < ROUTER_REACH * 1.35 && groundedLast;
}

function tryRouter() {
  const L = LEVELS[levelIndex];
  if (!L.routers || L.routers.length === 0) return;
  if (routerAllOn) return;
  for (let i = 0; i < L.routers.length; i++) {
    if (routerActivated[i]) continue;
    if (routerPinged(i)) routerActivated[i] = true;
  }
  const need = L.routers.length;
  if (routerActivated.filter(Boolean).length >= need) {
    routerAllOn = true;
    if (barrierMesh) barrierMesh.visible = false;
    rebuildPlatformRects();
    hudGoal.textContent = L.afterRouterHud;
  }
}

function playerStandsOnMovingPlatform() {
  if (!movingPlatform) return false;
  const r = movingPlatform.rect;
  const feet = py - PLAYER_HH;
  return (
    px + PLAYER_HW > r.minX + EPS &&
    px - PLAYER_HW < r.maxX - EPS &&
    feet <= r.maxY + 0.07 &&
    feet >= r.maxY - 0.1
  );
}

function checkWin() {
  if (won) return;
  const L = LEVELS[levelIndex];
  if (L.requiresUsb && !hasUsb) return;
  const ex = L.exit;
  if (
    px > ex.minX &&
    px < ex.maxX &&
    py > ex.minY &&
    py < ex.maxY
  ) {
    won = true;
    winEl.hidden = false;
    const L = LEVELS[levelIndex];
    winTitleEl.textContent = L.winTitle;
    winSub.textContent = L.winSub;
    playAgainBtn.textContent = L.nextIsFinal ? "Play again" : "Next level";
  }
}

function handleWinAction() {
  const L = LEVELS[levelIndex];
  if (!L.nextIsFinal) {
    winEl.hidden = true;
    won = false;
    loadLevel(levelIndex + 1);
  } else {
    resetFullGame();
  }
}

function respawn() {
  const L = LEVELS[levelIndex];
  px = L.spawn.x;
  py = L.spawn.y;
  vx = 0;
  vy = 0;
  fell = false;
  groundedLast = true;
  gameoverEl.hidden = true;
}

function resetFullGame() {
  won = false;
  fell = false;
  groundedLast = true;
  winEl.hidden = true;
  gameoverEl.hidden = true;
  loadLevel(0);
}

restartBtn.addEventListener("click", respawn);
playAgainBtn.addEventListener("click", handleWinAction);

const EPS = 0.015;

function physicsStep(dt) {
  if (won || fell) return;

  const L = LEVELS[levelIndex];
  levelElapsed += dt;

  if (movingPlatform) {
    const prevX = movingPlatform.x;
    movingPlatform.phase += dt * movingPlatform.speed;
    movingPlatform.x =
      movingPlatform.centerX +
      Math.sin(movingPlatform.phase) * movingPlatform.amplitude;
    const platDx = movingPlatform.x - prevX;
    movingPlatform.mesh.position.x = movingPlatform.x;
    const hw = movingPlatform.halfW;
    movingPlatform.rect.minX = movingPlatform.x - hw;
    movingPlatform.rect.maxX = movingPlatform.x + hw;
    if (groundedLast && playerStandsOnMovingPlatform()) {
      px += platDx;
    }
  }

  if (L.glitch && glitchMesh) {
    const g = L.glitch;
    glitchX += glitchVx * dt;
    if (glitchX > g.maxX - g.half) {
      glitchX = g.maxX - g.half;
      glitchVx *= -1;
    }
    if (glitchX < g.minX + g.half) {
      glitchX = g.minX + g.half;
      glitchVx *= -1;
    }
    glitchMesh.position.x = glitchX;
    const gr = {
      minX: glitchX - g.half,
      maxX: glitchX + g.half,
      minY: g.y - g.half,
      maxY: g.y + g.half,
    };
    if (rectsOverlap(playerRect(), gr)) {
      respawn();
      return;
    }
  }

  if (L.usb && usbGroup && usbGroup.visible && !hasUsb) {
    const u = L.usb;
    const usbR = {
      minX: u.cx - 0.38,
      maxX: u.cx + 0.38,
      minY: u.cy - 0.3,
      maxY: u.cy + 0.35,
    };
    if (rectsOverlap(playerRect(), usbR)) {
      hasUsb = true;
      usbGroup.visible = false;
      hudGoal.textContent = "USB acquired — sync both pads (<0.5s)";
    }
  }

  if (L.syncPlates && !syncDone) {
    const t = levelElapsed;
    const [a, b] = L.syncPlates;
    if (Math.hypot(px - a.cx, py - a.cy) < a.r) lastSeenA = t;
    if (Math.hypot(px - b.cx, py - b.cy) < b.r) lastSeenB = t;
    if (
      lastSeenA > -1e8 &&
      lastSeenB > -1e8 &&
      Math.abs(lastSeenA - lastSeenB) < 0.5
    ) {
      syncDone = true;
      timedBarrierTimer = L.timedBarrierSec ?? 8;
      if (barrierMesh) barrierMesh.visible = false;
      hudGoal.textContent = L.afterSyncHud ?? "Go!";
    }
  }

  if (L.timedBarrierSec != null && syncDone && timedBarrierTimer > 0) {
    timedBarrierTimer -= dt;
    if (timedBarrierTimer <= 0) {
      if (barrierMesh) barrierMesh.visible = true;
      rebuildPlatformRects();
      const br = L.barrier;
      if (br && rectsOverlap(playerRect(), br)) {
        respawn();
        return;
      }
    }
  }

  rebuildPlatformRects();

  let ax = 0;
  if (keys.left) ax -= 1;
  if (keys.right) ax += 1;
  vx = ax * MOVE;

  jumpBuf = Math.max(0, jumpBuf - dt);
  if (keys.jump) jumpBuf = JUMP_BUFFER;

  if (groundedLast) coyote = COYOTE;
  else coyote = Math.max(0, coyote - dt);

  if ((groundedLast || coyote > 0) && jumpBuf > 0 && keys.jump) {
    vy = JUMP_V;
    jumpBuf = 0;
    coyote = 0;
    groundedLast = false;
  }

  vy = Math.max(-MAX_FALL, vy + GRAVITY * dt);

  let grounded = false;

  const dx = vx * dt;
  px += dx;
  let r = playerRect();
  for (const b of platformRects) {
    if (!rectsOverlap(r, b)) continue;
    if (dx > EPS) px = b.minX - PLAYER_HW - EPS;
    else if (dx < -EPS) px = b.maxX + PLAYER_HW + EPS;
    else {
      const cx = (b.minX + b.maxX) / 2;
      px = px < cx ? b.minX - PLAYER_HW - EPS : b.maxX + PLAYER_HW + EPS;
    }
    r = playerRect();
  }

  const dy = vy * dt;
  py += dy;
  r = playerRect();
  for (const b of platformRects) {
    if (!rectsOverlap(r, b)) continue;
    if (dy > EPS) {
      py = b.minY - PLAYER_HH - EPS;
      vy = 0;
    } else {
      py = b.maxY + PLAYER_HH + EPS;
      vy = 0;
      grounded = true;
    }
    r = playerRect();
  }

  groundedLast = grounded;

  tryRouter();
  checkWin();

  if (py < KILL_Y) {
    fell = true;
    gameoverEl.hidden = false;
  }

  computer.position.set(px, py, 0);
  computer.rotation.z = THREE.MathUtils.lerp(
    computer.rotation.z,
    -vx * 0.04,
    1 - Math.pow(0.001, dt)
  );

  const targetCamX = px + 1.2;
  camera.position.x += (targetCamX - camera.position.x) * (1 - Math.pow(0.0002, dt));
  camera.position.y = 2.1;
  camera.position.z = 11;
  camera.lookAt(px + 0.5, -0.2, 0);

  for (const rg of routerGroups) {
    rg.rotation.y += dt * 0.7;
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  physicsStep(dt);
  updateScreensaver90s(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

loadLevel(0);

requestAnimationFrame(loop);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizePhotoBackground();
});
