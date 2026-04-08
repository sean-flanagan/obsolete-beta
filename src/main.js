import * as THREE from "three";

const ARENA = { halfX: 4.2, playerY: -2.2, playerZ: 0, topY: 6 };
const PLAYER_SPEED = 8;
const BASE_FALL = 5;
const SPAWN_EVERY = 0.55;

let keys = { left: false, right: false };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a12);
scene.fog = new THREE.Fog(0x0a0a12, 12, 28);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.2, 10);
camera.lookAt(0, -0.5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const amb = new THREE.AmbientLight(0x8899cc, 0.6);
scene.add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 1.1);
dir.position.set(4, 10, 6);
scene.add(dir);

const groundGeo = new THREE.PlaneGeometry(24, 16);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a28,
  roughness: 0.9,
  metalness: 0.1,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = ARENA.playerY - 0.55;
scene.add(ground);

const playerGeo = new THREE.BoxGeometry(0.9, 0.45, 0.9);
const playerMat = new THREE.MeshStandardMaterial({
  color: 0x3dff8a,
  roughness: 0.35,
  metalness: 0.2,
});
const player = new THREE.Mesh(playerGeo, playerMat);
player.position.set(0, ARENA.playerY, ARENA.playerZ);
scene.add(player);

const obstacleGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
const obstacleMat = new THREE.MeshStandardMaterial({
  color: 0xff3355,
  roughness: 0.4,
  metalness: 0.15,
});

/** @type {{ mesh: THREE.Mesh; speed: number }[]} */
const obstacles = [];
let spawnTimer = 0;
let playing = true;
let elapsed = 0;

const scoreEl = document.getElementById("score");
const gameoverEl = document.getElementById("gameover");
const finalScoreEl = document.getElementById("final-score");
const restartBtn = document.getElementById("restart");

function setKeys(code, down) {
  if (code === "ArrowLeft" || code === "KeyA") keys.left = down;
  if (code === "ArrowRight" || code === "KeyD") keys.right = down;
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (!playing && (e.code === "KeyR" || e.code === "Space")) {
    e.preventDefault();
    resetGame();
    return;
  }
  setKeys(e.code, true);
});
window.addEventListener("keyup", (e) => setKeys(e.code, false));

function boxOverlap(a, b) {
  const ax = a.x,
    ay = a.y,
    az = a.z;
  const bx = b.x,
    by = b.y,
    bz = b.z;
  const hs = 0.45;
  return (
    Math.abs(ax - bx) < hs * 2 &&
    Math.abs(ay - by) < hs * 2 &&
    Math.abs(az - bz) < hs * 2
  );
}

function spawnObstacle() {
  const mesh = new THREE.Mesh(obstacleGeo, obstacleMat);
  const x = (Math.random() * 2 - 1) * ARENA.halfX;
  mesh.position.set(x, ARENA.topY, ARENA.playerZ);
  scene.add(mesh);
  obstacles.push({ mesh, speed: BASE_FALL + Math.random() * 2 + elapsed * 0.02 });
}

function resetGame() {
  for (const o of obstacles) {
    scene.remove(o.mesh);
  }
  obstacles.length = 0;
  player.position.x = 0;
  spawnTimer = 0;
  elapsed = 0;
  playing = true;
  gameoverEl.hidden = true;
}

restartBtn.addEventListener("click", resetGame);

function gameOver() {
  playing = false;
  finalScoreEl.textContent = `Score: ${Math.floor(elapsed * 12)}`;
  gameoverEl.hidden = false;
}

function tick(dt) {
  if (!playing) return;

  elapsed += dt;
  const score = Math.floor(elapsed * 12);
  scoreEl.textContent = `Score: ${score}`;

  let vx = 0;
  if (keys.left) vx -= 1;
  if (keys.right) vx += 1;
  player.position.x += vx * PLAYER_SPEED * dt;
  player.position.x = THREE.MathUtils.clamp(
    player.position.x,
    -ARENA.halfX,
    ARENA.halfX
  );

  spawnTimer += dt;
  if (spawnTimer >= SPAWN_EVERY) {
    spawnTimer = 0;
    spawnObstacle();
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.mesh.position.y -= o.speed * dt;
    if (o.mesh.position.y < ARENA.playerY - 4) {
      scene.remove(o.mesh);
      obstacles.splice(i, 1);
      continue;
    }
    if (
      boxOverlap(player.position, o.mesh.position) &&
      Math.abs(o.mesh.position.y - ARENA.playerY) < 0.55
    ) {
      gameOver();
      return;
    }
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  tick(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
