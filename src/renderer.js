import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PALETTES } from "./levels.js";

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;
const WORLD_SCALE = 34;

const color = (value) => new THREE.Color(value);

export class ObsoleteRenderer {
  constructor({ mount }) {
    this.mount = mount;
    this.world = { width: VIEW_WIDTH, height: VIEW_HEIGHT };
    this.loader = new GLTFLoader();
    this.assetManifest = null;
    this.assetModels = new Map();
    this.scene = new THREE.Scene();
    this.scene.background = color(PALETTES.yard.skyTop);
    this.scene.fog = new THREE.Fog(PALETTES.yard.skyBottom, 18, 62);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    this.mount.appendChild(this.renderer.domElement);

    this.camera = new THREE.OrthographicCamera(-14, 14, 8, -8, 0.1, 200);
    this.camera.position.set(0, 18, 16);
    this.camera.lookAt(0, 0, 0);

    this.worldRoot = new THREE.Group();
    this.fxRoot = new THREE.Group();
    this.scene.add(this.worldRoot, this.fxRoot);

    this.setupLights();
    this.setupAtmosphere();
    this.setupDynamicObjects();
    this.loadStarterAssets();
    this.handleResize();
    this.markDirty();
  }

  async loadStarterAssets() {
    try {
      const response = await fetch("/obsolete-assets.json");
      if (!response.ok) {
        return;
      }

      this.assetManifest = await response.json();
      const entries = Object.entries(this.assetManifest.props || {});
      await Promise.all(
        entries.map(async ([key, path]) => {
          const gltf = await this.loader.loadAsync(path);
          this.assetModels.set(key, gltf.scene);
        })
      );
      this.markDirty();
    } catch {
      // Fallback to primitive props when starter assets are unavailable.
    }
  }

  setupLights() {
    this.ambientLight = new THREE.HemisphereLight("#ffcf9a", "#1b2730", 1.25);
    this.sunLight = new THREE.DirectionalLight("#ffd89a", 1.1);
    this.sunLight.position.set(12, 22, 8);
    this.rimLight = new THREE.DirectionalLight("#7cffdf", 0.75);
    this.rimLight.position.set(-10, 10, -14);
    this.scene.add(this.ambientLight, this.sunLight, this.rimLight);
  }

  setupAtmosphere() {
    this.floorGlow = new THREE.Mesh(
      new THREE.CircleGeometry(6, 40),
      new THREE.MeshBasicMaterial({
        color: "#ffb768",
        transparent: true,
        opacity: 0.08,
      })
    );
    this.floorGlow.rotation.x = -Math.PI / 2;
    this.floorGlow.position.set(0, 0.02, 0);
    this.fxRoot.add(this.floorGlow);
  }

  setupDynamicObjects() {
    this.dynamic = {
      player: this.createLaptop("player"),
      battery: this.createBattery(),
      socket: this.createSocket(),
      gateConsole: this.createConsole("DISK"),
      finalConsole: this.createConsole("POST"),
      exitArch: this.createExitArch(),
      checkpoint: this.createCheckpointBeacon(),
      sparks: [],
      gates: [],
      hazards: [],
      items: [],
      fragments: [],
      npcs: [],
      solids: [],
      decor: [],
      conveyors: [],
      endingScrap: [],
    };

    this.scene.add(this.dynamic.player.group);
    this.scene.add(
      this.dynamic.battery,
      this.dynamic.socket,
      this.dynamic.gateConsole,
      this.dynamic.finalConsole,
      this.dynamic.exitArch,
      this.dynamic.checkpoint
    );
  }

  markDirty() {
    this.needsWorldRebuild = true;
  }

  handleResize() {
    const width = this.mount.clientWidth || VIEW_WIDTH;
    const height = this.mount.clientHeight || VIEW_HEIGHT;
    this.renderer.setSize(width, height, false);

    const aspect = width / height;
    const viewSize = 12;
    this.camera.left = -viewSize * aspect;
    this.camera.right = viewSize * aspect;
    this.camera.top = viewSize;
    this.camera.bottom = -viewSize;
    this.camera.updateProjectionMatrix();
  }

  sync(game) {
    const worldKey = `${game.mode}:${game.mode === "ending" || game.mode === "win" ? "escape" : game.act.id}`;
    if (this.needsWorldRebuild || worldKey !== this.currentWorldKey) {
      this.rebuildWorld(game);
      this.currentWorldKey = worldKey;
      this.needsWorldRebuild = false;
    }

    this.applyPalette(game);
    this.updateCamera(game);
    this.updateDynamicObjects(game);
    this.renderer.render(this.scene, this.camera);
  }

  rebuildWorld(game) {
    this.clearGroup(this.worldRoot);

    this.dynamic.gates = [];
    this.dynamic.hazards = [];
    this.dynamic.items = [];
    this.dynamic.fragments = [];
    this.dynamic.npcs = [];
    this.dynamic.solids = [];
    this.dynamic.decor = [];
    this.dynamic.conveyors = [];
    this.dynamic.endingScrap = [];

    if (game.mode === "ending" || game.mode === "win") {
      this.buildEndingWorld();
      return;
    }

    this.buildActWorld(game);
  }

  buildActWorld(game) {
    this.world = { ...game.act.world };
    const palette = PALETTES.yard;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(
        game.act.world.width / WORLD_SCALE,
        game.act.world.height / WORLD_SCALE
      ),
      new THREE.MeshStandardMaterial({
        color: palette.metalDark,
        roughness: 0.95,
        metalness: 0.1,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = false;
    this.worldRoot.add(floor);

    const grid = new THREE.GridHelper(
      game.act.world.width / WORLD_SCALE,
      Math.round(game.act.world.width / 120),
      color("#4b3335"),
      color("#231a1e")
    );
    grid.position.y = 0.03;
    this.worldRoot.add(grid);

    for (const solid of game.act.solids) {
      const mesh = this.createScrapBlock(solid);
      this.dynamic.solids.push(mesh);
      this.worldRoot.add(mesh);
    }

    for (const decor of game.act.decor || []) {
      const mesh = this.createDecorMesh(decor);
      if (!mesh) continue;
      this.dynamic.decor.push(mesh);
      this.worldRoot.add(mesh);
    }

    for (const belt of game.act.conveyors || []) {
      const mesh = this.createConveyor(belt);
      this.dynamic.conveyors.push({ source: belt, mesh });
      this.worldRoot.add(mesh);
    }

    for (const npc of game.act.npcs || []) {
      const model = this.createNpc(npc);
      this.dynamic.npcs.push({ source: npc, model });
      this.worldRoot.add(model.group);
    }

    for (const gate of game.act.gates || []) {
      const mesh = this.createGate(gate);
      this.dynamic.gates.push({ source: gate, mesh });
      this.worldRoot.add(mesh);
    }

    for (const hazard of game.act.hazards || []) {
      const crusher = this.createCrusher(hazard);
      this.dynamic.hazards.push({ source: hazard, mesh: crusher });
      this.worldRoot.add(crusher);
    }

    for (const item of game.act.items || []) {
      const mesh = this.createPickup(item.kind || "pickup");
      this.dynamic.items.push({ source: item, mesh });
      this.worldRoot.add(mesh);
    }

    for (const fragment of game.act.fragments || []) {
      const mesh = this.createFragment();
      this.dynamic.fragments.push({ source: fragment, mesh });
      this.worldRoot.add(mesh);
    }

    if (game.act.socket) {
      this.worldRoot.add(this.dynamic.socket);
    }
    if (game.act.battery) {
      this.worldRoot.add(this.dynamic.battery);
    }
    if (game.act.gateConsole) {
      this.worldRoot.add(this.dynamic.gateConsole);
    }
    if (game.act.console) {
      this.worldRoot.add(this.dynamic.finalConsole);
    }
    this.worldRoot.add(this.dynamic.exitArch, this.dynamic.checkpoint);
  }

  buildEndingWorld() {
    this.world = { width: 2400, height: 920 };
    const skyPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 40),
      new THREE.MeshBasicMaterial({ color: "#4f6d8a" })
    );
    skyPlane.position.set(0, 12, -20);
    this.worldRoot.add(skyPlane);

    const sunrise = new THREE.Mesh(
      new THREE.CircleGeometry(5, 40),
      new THREE.MeshBasicMaterial({
        color: "#ffd493",
        transparent: true,
        opacity: 0.75,
      })
    );
    sunrise.position.set(14, 10, -18);
    this.worldRoot.add(sunrise);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 18),
      new THREE.MeshStandardMaterial({ color: "#4a4848", roughness: 1 })
    );
    road.rotation.x = -Math.PI / 2;
    this.worldRoot.add(road);

    for (let i = 0; i < 30; i += 1) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.04, 0.3),
        new THREE.MeshBasicMaterial({ color: "#f6d48c" })
      );
      stripe.position.set(-35 + i * 2.4, 0.03, 0);
      this.worldRoot.add(stripe);
      this.dynamic.endingScrap.push(stripe);
    }

    for (let i = 0; i < 18; i += 1) {
      const chunk = new THREE.Mesh(
        new THREE.BoxGeometry(1.2 + (i % 3) * 0.4, 0.6 + (i % 4) * 0.3, 0.9 + (i % 2) * 0.4),
        new THREE.MeshStandardMaterial({
          color: i % 2 ? "#6b5347" : "#3d3334",
          roughness: 1,
        })
      );
      chunk.position.set(-25 + i * 2.8, 0.3, -4.8 - (i % 3) * 1.2);
      this.worldRoot.add(chunk);
      this.dynamic.endingScrap.push(chunk);
    }
  }

  updateCamera(game) {
    const palette = game.mode === "ending" || game.mode === "win" ? PALETTES.dawn : PALETTES.yard;
    const targetX = this.toWorldX(game.camera.x + VIEW_WIDTH / 2);
    const targetZ = this.toWorldZ(game.camera.y + VIEW_HEIGHT / 2);
    const y = game.mode === "ending" || game.mode === "win" ? 17 : 18;
    this.camera.position.set(targetX - 4, y, targetZ + 13);
    this.camera.lookAt(targetX, 0, targetZ);
    this.floorGlow.material.color.set(palette.lamp);
    this.floorGlow.position.set(targetX, 0.02, targetZ);
  }

  updateDynamicObjects(game) {
    if (game.mode === "ending" || game.mode === "win") {
      this.updateLaptop(this.dynamic.player, game.player, game.player.mood, true);
      return;
    }

    this.updateLaptop(this.dynamic.player, game.player, game.player.mood);

    if (game.act.socket) {
      this.positionBox(this.dynamic.socket, game.act.socket, 0.4);
      this.dynamic.socket.visible = true;
      this.dynamic.socket.material.color.set(
        game.progress.batterySocketPowered ? "#63ffd1" : "#203138"
      );
    } else {
      this.dynamic.socket.visible = false;
    }

    if (game.act.battery) {
      this.positionBox(this.dynamic.battery, game.act.battery, 0.34);
      this.dynamic.battery.visible = !game.progress.batterySocketPowered || game.mode === "play";
      this.dynamic.battery.material.color.set(
        game.progress.batterySocketPowered ? "#72ffd7" : "#ff8c62"
      );
    } else {
      this.dynamic.battery.visible = false;
    }

    if (game.act.gateConsole) {
      this.positionBox(this.dynamic.gateConsole, game.act.gateConsole, 0.9);
      this.dynamic.gateConsole.visible = true;
    } else {
      this.dynamic.gateConsole.visible = false;
    }

    if (game.act.console) {
      this.positionBox(this.dynamic.finalConsole, game.act.console, 0.9);
      this.dynamic.finalConsole.visible = true;
    } else {
      this.dynamic.finalConsole.visible = false;
    }

    this.dynamic.gates.forEach(({ source, mesh }) => {
      mesh.visible = !game.progress[source.opensWith];
      this.positionBox(mesh, source, 2.2);
    });

    this.dynamic.hazards.forEach(({ source, mesh }) => {
      const rect = {
        x: source.x,
        y: source.y + (source.currentOffset || 0),
        w: source.w,
        h: source.h,
      };
      this.positionBox(mesh, rect, 2.4);
    });

    this.dynamic.items.forEach(({ source, mesh }) => {
      mesh.visible = !source.collected;
      mesh.position.set(this.toWorldX(source.x + source.w / 2), 0.8, this.toWorldZ(source.y + source.h / 2));
      mesh.rotation.y = game.time * 2;
    });

    this.dynamic.fragments.forEach(({ source, mesh }) => {
      mesh.visible = !source.collected;
      mesh.position.set(this.toWorldX(source.x), 0.95 + Math.sin(game.time * 4 + source.x) * 0.12, this.toWorldZ(source.y));
      mesh.rotation.y = game.time * 1.5;
    });

    this.dynamic.npcs.forEach(({ source, model }) => {
      this.updateLaptop(model, source, source.portrait === "modem" ? "wise" : "curious");
      model.group.position.y = 0.25;
    });

    this.dynamic.conveyors.forEach(({ source, mesh }) => {
      this.positionBox(mesh, source, 0.1);
      const stripes = mesh.userData.stripes || [];
      stripes.forEach((stripe, index) => {
        stripe.position.x = -source.w / WORLD_SCALE / 2 + ((index * 1.4 + game.time * 3.6) % 8);
      });
    });

    const exit = game.act.exitZone;
    if (exit) {
      this.dynamic.exitArch.visible = !exit.requires || game.progress[exit.requires];
      this.positionBox(this.dynamic.exitArch, exit, 1.8);
    } else {
      this.dynamic.exitArch.visible = false;
    }

    this.dynamic.checkpoint.visible = true;
    this.dynamic.checkpoint.position.set(
      this.toWorldX(game.activeCheckpoint.x),
      0.14,
      this.toWorldZ(game.activeCheckpoint.y)
    );
    this.dynamic.checkpoint.rotation.y = game.time;
    this.dynamic.checkpoint.material.opacity = 0.28 + Math.sin(game.time * 4) * 0.08;

    this.renderer.domElement.style.filter = `saturate(${game.mode === "boot" ? 1.15 : 1}) brightness(${1 + game.flash * 0.18})`;
    this.mount.style.transform = game.glitch > 0 ? `translateX(${Math.sin(game.time * 60) * game.glitch * 2}px)` : "";
  }

  applyPalette(game) {
    const palette = game.mode === "ending" || game.mode === "win" ? PALETTES.dawn : PALETTES.yard;
    this.scene.background = color(palette.skyTop);
    this.scene.fog.color.set(palette.skyBottom);
    this.ambientLight.color.set(palette.lamp);
    this.ambientLight.groundColor.set(game.mode === "ending" || game.mode === "win" ? "#38444c" : "#182226");
    this.sunLight.color.set(palette.lamp);
    this.rimLight.color.set(palette.accent);
  }

  clearGroup(group) {
    while (group.children.length) {
      group.remove(group.children[0]);
    }
  }

  createScrapBlock(rect) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(rect.w / WORLD_SCALE, 1.3, rect.h / WORLD_SCALE),
      new THREE.MeshStandardMaterial({
        color: "#44525c",
        roughness: 0.92,
        metalness: 0.18,
      })
    );
    this.positionBox(mesh, rect, 1.3);
    return mesh;
  }

  createDecorMesh(decor) {
    if (decor.starterProp) {
      const assetMesh = this.createStarterProp(decor);
      if (assetMesh) {
        return assetMesh;
      }
    }

    if (decor.type === "pile") {
      const group = new THREE.Group();
      for (let i = 0; i < 5; i += 1) {
        const piece = new THREE.Mesh(
          new THREE.BoxGeometry(0.9 + i * 0.12, 0.45 + i * 0.1, 0.9),
          new THREE.MeshStandardMaterial({
            color: i % 2 ? "#6a4c4f" : "#4f3c40",
            roughness: 1,
          })
        );
        piece.position.set(i * 0.32 - 0.8, piece.geometry.parameters.height / 2, (i % 2) * 0.22 - 0.12);
        piece.rotation.y = i * 0.5;
        group.add(piece);
      }
      return this.placeFreeform(group, decor);
    }

    if (decor.type === "crate") {
      return this.placeFreeform(
        new THREE.Mesh(
          new THREE.BoxGeometry(decor.w / WORLD_SCALE, 0.9, decor.h / WORLD_SCALE),
          new THREE.MeshStandardMaterial({ color: "#715c44", roughness: 1 })
        ),
        decor,
        0.45
      );
    }

    if (decor.type === "pipe") {
      return this.placeFreeform(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.2, decor.w / WORLD_SCALE, 12),
          new THREE.MeshStandardMaterial({ color: "#6e7378", roughness: 0.75, metalness: 0.35 })
        ),
        decor,
        0.35,
        (mesh) => {
          mesh.rotation.z = Math.PI / 2;
        }
      );
    }

    if (decor.type === "spark") {
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshBasicMaterial({ color: "#ffd37d" })
      );
      return this.placeFreeform(light, { ...decor, w: 10, h: 10 }, 1.6);
    }

    return null;
  }

  createStarterProp(decor) {
    const template = this.assetModels.get(decor.starterProp);
    if (!template) {
      return null;
    }

    const group = template.clone(true);
    group.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = false;
        node.receiveShadow = false;
      }
    });

    const scale = decor.propScale || 1;
    group.scale.setScalar(scale);
    group.rotation.y = decor.propRotationY || 0;
    const baseHeight = decor.propHeight ?? 0;
    group.position.set(
      this.toWorldX(decor.x + (decor.w || 0) / 2),
      baseHeight,
      this.toWorldZ(decor.y + (decor.h || 0) / 2)
    );
    return group;
  }

  placeFreeform(mesh, decor, height = 0.3, customizer) {
    mesh.position.set(
      this.toWorldX(decor.x + (decor.w || 0) / 2),
      height,
      this.toWorldZ(decor.y + (decor.h || 0) / 2)
    );
    if (customizer) customizer(mesh);
    return mesh;
  }

  createConveyor(rect) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(rect.w / WORLD_SCALE, 0.16, rect.h / WORLD_SCALE),
      new THREE.MeshStandardMaterial({ color: "#293239", roughness: 0.82, metalness: 0.2 })
    );
    group.add(base);

    const stripes = [];
    for (let i = 0; i < 6; i += 1) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.02, 0.08),
        new THREE.MeshBasicMaterial({ color: "#7af1c8" })
      );
      stripe.position.y = 0.1;
      stripe.position.z = 0.12;
      group.add(stripe);
      stripes.push(stripe);
    }
    group.userData.stripes = stripes;
    this.positionBox(group, rect, 0.08);
    return group;
  }

  createCrusher(rect) {
    const group = new THREE.Group();
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(rect.w / WORLD_SCALE, 2.2, rect.h / WORLD_SCALE),
      new THREE.MeshStandardMaterial({
        color: "#ff7c55",
        roughness: 0.65,
        metalness: 0.15,
      })
    );
    const piston = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 4.5, 0.22),
      new THREE.MeshStandardMaterial({ color: "#8f959b", roughness: 0.6, metalness: 0.5 })
    );
    piston.position.y = 1.2;
    group.add(arm, piston);
    this.positionBox(group, rect, 1.1);
    return group;
  }

  createGate(rect) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(rect.w / WORLD_SCALE, 2.4, rect.h / WORLD_SCALE),
      new THREE.MeshStandardMaterial({
        color: "#ef7c59",
        roughness: 0.8,
        metalness: 0.1,
      })
    );
    this.positionBox(mesh, rect, 1.2);
    return mesh;
  }

  createPickup(kind) {
    const colorValue = kind === "pickup" ? "#7e92ff" : "#8effd3";
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.14, 0.35),
      new THREE.MeshStandardMaterial({
        color: colorValue,
        roughness: 0.55,
        metalness: 0.4,
        emissive: colorValue,
        emissiveIntensity: 0.18,
      })
    );
  }

  createFragment() {
    return new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshStandardMaterial({
        color: "#ffd48a",
        roughness: 0.3,
        metalness: 0.3,
        emissive: "#ffd48a",
        emissiveIntensity: 0.35,
      })
    );
  }

  createBattery() {
    return new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.28, 0.6),
      new THREE.MeshStandardMaterial({
        color: "#ff8c62",
        roughness: 0.62,
        metalness: 0.2,
      })
    );
  }

  createSocket() {
    return new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.22, 1.1),
      new THREE.MeshStandardMaterial({
        color: "#203138",
        roughness: 0.88,
        metalness: 0.18,
      })
    );
  }

  createConsole(label) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.65, 1.1),
      new THREE.MeshStandardMaterial({ color: "#4a5963", roughness: 0.7, metalness: 0.24 })
    );
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.34),
      new THREE.MeshBasicMaterial({ color: "#9afce3" })
    );
    screen.position.set(0, 0.15, 0.57);
    const glyph = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.1),
      new THREE.MeshBasicMaterial({ color: "#0e1618" })
    );
    glyph.position.set(0, -0.1, 0.57);
    group.add(body, screen, glyph);
    group.userData.label = label;
    return group;
  }

  createExitArch() {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color: "#8effd3",
      transparent: true,
      opacity: 0.7,
    });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.1, 0.24), material);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.1, 0.24), material);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 0.24), material);
    left.position.x = -0.45;
    right.position.x = 0.45;
    top.position.y = 0.95;
    group.add(left, right, top);
    return group;
  }

  createCheckpointBeacon() {
    return new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.48, 24),
      new THREE.MeshBasicMaterial({
        color: "#ffd37d",
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })
    );
  }

  createLaptop(kind) {
    const group = new THREE.Group();
    const shellColor = kind === "player" ? "#8ea0aa" : "#7a8792";
    const screenColor = kind === "player" ? "#9afce3" : "#c6ffe7";

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.25, 0.78),
      new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.7, metalness: 0.12 })
    );
    base.position.y = 0.18;
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.62, 0.12),
      new THREE.MeshStandardMaterial({ color: "#505d67", roughness: 0.72, metalness: 0.1 })
    );
    lid.position.set(0, 0.56, -0.22);
    lid.rotation.x = -0.85;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.34),
      new THREE.MeshBasicMaterial({ color: screenColor })
    );
    screen.position.set(0, 0.6, -0.14);
    screen.rotation.x = -0.85;

    const leftEye = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.08),
      new THREE.MeshBasicMaterial({ color: "#122628" })
    );
    const rightEye = leftEye.clone();
    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.03),
      new THREE.MeshBasicMaterial({ color: "#122628" })
    );
    leftEye.position.set(-0.12, 0.61, -0.135);
    rightEye.position.set(0.12, 0.61, -0.135);
    mouth.position.set(0, 0.53, -0.13);
    leftEye.rotation.x = rightEye.rotation.x = mouth.rotation.x = -0.85;

    group.add(base, lid, screen, leftEye, rightEye, mouth);
    group.userData = { leftEye, rightEye, mouth };
    return { group, leftEye, rightEye, mouth };
  }

  createNpc(npc) {
    if (npc.portrait === "modem") {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.24, 0.58),
        new THREE.MeshStandardMaterial({ color: "#6c7f8b", roughness: 0.65, metalness: 0.22 })
      );
      body.position.y = 0.14;
      group.add(body);

      for (let i = 0; i < 3; i += 1) {
        const light = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: i === 0 ? "#ffd37d" : "#8effd3" })
        );
        light.position.set(-0.18 + i * 0.18, 0.31, 0.2);
        group.add(light);
      }

      group.position.set(this.toWorldX(npc.x + npc.w / 2), 0.2, this.toWorldZ(npc.y + npc.h / 2));
      return { group };
    }

    if (npc.portrait === "printer") {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.7, 0.9),
        new THREE.MeshStandardMaterial({ color: "#d4d7db", roughness: 0.9, metalness: 0.08 })
      );
      body.position.y = 0.35;
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.08, 0.54),
        new THREE.MeshStandardMaterial({ color: "#f2ede3", roughness: 1 })
      );
      tray.position.set(0, 0.78, -0.1);
      group.add(body, tray);
      group.position.set(this.toWorldX(npc.x + npc.w / 2), 0, this.toWorldZ(npc.y + npc.h / 2));
      return { group };
    }

    if (npc.portrait === "phone") {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.9, 0.22),
        new THREE.MeshStandardMaterial({ color: "#58607a", roughness: 0.7 })
      );
      body.position.y = 0.45;
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, 0.18),
        new THREE.MeshBasicMaterial({ color: "#cfffe5" })
      );
      screen.position.set(0, 0.65, 0.12);
      group.add(body, screen);
      group.position.set(this.toWorldX(npc.x + npc.w / 2), 0, this.toWorldZ(npc.y + npc.h / 2));
      return { group };
    }

    if (npc.portrait === "pet") {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 18, 14),
        new THREE.MeshStandardMaterial({ color: "#9870ad", roughness: 0.85 })
      );
      body.position.y = 0.42;
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.32, 0.24),
        new THREE.MeshBasicMaterial({ color: "#def6ff" })
      );
      screen.position.set(0, 0.46, 0.3);
      group.add(body, screen);
      group.position.set(this.toWorldX(npc.x + npc.w / 2), 0, this.toWorldZ(npc.y + npc.h / 2));
      return { group };
    }

    return this.createLaptop("npc");
  }

  updateLaptop(model, source, mood, noTilt = false) {
    const x = this.toWorldX(source.x + source.w / 2);
    const z = this.toWorldZ(source.y + source.h / 2);
    model.group.position.set(x, 0, z);
    model.group.rotation.y = noTilt ? 0 : source.facing === -1 ? Math.PI * 0.08 : -Math.PI * 0.08;

    if (!model.leftEye) {
      return;
    }

    const eyeScaleY = mood === "determined" || mood === "heroic" ? 0.45 : 1;
    model.leftEye.scale.y = eyeScaleY;
    model.rightEye.scale.y = eyeScaleY;
    model.mouth.scale.x = mood === "heroic" ? 1.4 : mood === "determined" ? 1.2 : 1;
    model.mouth.position.y = mood === "curious" ? 0.53 : 0.5;
  }

  positionBox(object, rect, height = 0.3) {
    object.position.set(
      this.toWorldX(rect.x + rect.w / 2),
      height,
      this.toWorldZ(rect.y + rect.h / 2)
    );
  }

  toWorldX(x) {
    return (x - this.world.width / 2) / WORLD_SCALE;
  }

  toWorldZ(y) {
    return (y - this.world.height / 2) / WORLD_SCALE;
  }
}
