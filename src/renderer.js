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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
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
    this.ambientLight = new THREE.HemisphereLight("#ffcf9a", "#1b2730", 1.05);
    this.sunLight = new THREE.DirectionalLight("#ffd89a", 1.55);
    this.sunLight.position.set(14, 24, 9);
    this.fillLight = new THREE.DirectionalLight("#7db8ff", 0.45);
    this.fillLight.position.set(-15, 11, 10);
    this.rimLight = new THREE.DirectionalLight("#7cffdf", 1.05);
    this.rimLight.position.set(-10, 10, -14);
    this.heroLight = new THREE.PointLight("#8effd3", 1.4, 14, 2);
    this.heroLight.position.set(0, 2.2, 0);
    this.scene.add(this.ambientLight, this.sunLight, this.fillLight, this.rimLight, this.heroLight);
  }

  setupAtmosphere() {
    this.floorGlow = new THREE.Mesh(
      new THREE.CircleGeometry(6, 40),
      new THREE.MeshBasicMaterial({
        color: "#ffb768",
        transparent: true,
        opacity: 0.14,
      })
    );
    this.floorGlow.rotation.x = -Math.PI / 2;
    this.floorGlow.position.set(0, 0.02, 0);
    this.fxRoot.add(this.floorGlow);

    this.heroLightGlow = new THREE.Mesh(
      new THREE.CircleGeometry(2.8, 40),
      new THREE.MeshBasicMaterial({
        color: "#8effd3",
        transparent: true,
        opacity: 0.08,
      })
    );
    this.heroLightGlow.rotation.x = -Math.PI / 2;
    this.heroLightGlow.position.set(0, 0.03, 0);
    this.fxRoot.add(this.heroLightGlow);

    this.sunHalo = new THREE.Mesh(
      new THREE.CircleGeometry(10, 48),
      new THREE.MeshBasicMaterial({
        color: "#ffd493",
        transparent: true,
        opacity: 0.08,
      })
    );
    this.sunHalo.position.set(0, 9, -24);
    this.fxRoot.add(this.sunHalo);
  }

  setupDynamicObjects() {
    this.dynamic = {
      player: this.createLaptop("player"),
      playerShadow: this.createPlayerShadow(),
      interactionRing: this.createInteractionRing(),
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
    this.scene.add(this.dynamic.playerShadow, this.dynamic.interactionRing);
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
    const playerX = this.toWorldX(game.player.x + game.player.w / 2);
    const playerZ = this.toWorldZ(game.player.y + game.player.h / 2);
    const titleMode = game.mode === "title";
    const targetX = titleMode ? playerX + 3.4 : this.toWorldX(game.camera.x + VIEW_WIDTH / 2);
    const targetZ = titleMode ? playerZ - 0.6 : this.toWorldZ(game.camera.y + VIEW_HEIGHT / 2);
    const y = game.mode === "ending" || game.mode === "win" ? 17 : titleMode ? 15.6 : 18;
    const cameraOffsetX = titleMode ? -6.2 : -4;
    const cameraOffsetZ = titleMode ? 11.4 : 13;
    this.camera.position.set(targetX + cameraOffsetX, y, targetZ + cameraOffsetZ);
    this.camera.lookAt(targetX, titleMode ? 0.75 : 0, targetZ);
    this.floorGlow.material.color.set(palette.lamp);
    this.floorGlow.position.set(titleMode ? playerX + 0.25 : targetX, 0.02, titleMode ? playerZ : targetZ);
    this.sunHalo.material.color.set(palette.lamp);
    this.sunHalo.position.set(targetX + (titleMode ? 9.4 : 11), game.mode === "ending" || game.mode === "win" ? 10.5 : titleMode ? 8.2 : 8.8, targetZ - (titleMode ? 18.5 : 21));
  }

  updateDynamicObjects(game) {
    const pulse = 0.5 + (Math.sin(game.time * 4.4) + 1) * 0.5;
    const playerX = this.toWorldX(game.player.x + game.player.w / 2);
    const playerZ = this.toWorldZ(game.player.y + game.player.h / 2);
    const titleMode = game.mode === "title";
    this.heroLight.position.set(playerX + (titleMode ? 0.15 : 0.3), game.mode === "ending" || game.mode === "win" ? 2.6 : titleMode ? 2.75 : 2.2, playerZ + (titleMode ? -0.05 : 0.15));
    this.heroLightGlow.position.set(playerX + (titleMode ? 0.05 : 0.15), 0.03, playerZ + (titleMode ? -0.04 : 0.05));
    this.heroLight.intensity =
      game.mode === "boot"
        ? 1.75 + pulse * 0.35
        : titleMode
          ? 2.1 + pulse * 0.42
          : game.mode === "ending" || game.mode === "win"
            ? 1.15 + pulse * 0.18
            : 1.35 + pulse * 0.22;
    this.heroLight.distance = game.mode === "ending" || game.mode === "win" ? 12 : titleMode ? 16 : 14;
    this.heroLightGlow.material.opacity =
      game.mode === "boot"
        ? 0.16 + pulse * 0.06
        : titleMode
          ? 0.2 + pulse * 0.07
          : game.mode === "ending" || game.mode === "win"
            ? 0.1 + pulse * 0.03
            : 0.12 + pulse * 0.04;
    if (game.mode === "ending" || game.mode === "win") {
      this.updateLaptop(this.dynamic.player, game.player, game.player.mood, true);
      this.dynamic.player.group.scale.setScalar(1.08);
      this.dynamic.playerShadow.position.set(playerX, 0.04, playerZ);
      this.dynamic.playerShadow.scale.set(1.15, 1, 1.15);
      this.dynamic.playerShadow.material.opacity = 0.24 + pulse * 0.08;
      this.dynamic.interactionRing.visible = false;
      return;
    }

    this.updateLaptop(this.dynamic.player, game.player, titleMode ? "heroic" : game.player.mood);
    this.dynamic.player.group.scale.setScalar(titleMode ? 1.6 : 1);
    this.dynamic.player.group.position.y = titleMode ? 0.08 : 0;
    this.dynamic.playerShadow.position.set(playerX + (titleMode ? -0.08 : 0), 0.04, playerZ + (titleMode ? -0.03 : 0));
    this.dynamic.playerShadow.scale.set(titleMode ? 1.95 : 1.3, 1, titleMode ? 1.72 : 1.22);
    this.dynamic.playerShadow.material.opacity = titleMode ? 0.34 + pulse * 0.1 : 0.26 + pulse * 0.08;

    if (game.interactionFocus) {
      const focus = game.interactionFocus;
      this.dynamic.interactionRing.visible = true;
      this.dynamic.interactionRing.position.set(
        this.toWorldX(focus.x + focus.w / 2),
        0.06,
        this.toWorldZ(focus.y + focus.h / 2)
      );
      const scaleX = Math.max(0.85, focus.w / WORLD_SCALE);
      const scaleZ = Math.max(0.85, focus.h / WORLD_SCALE);
      this.dynamic.interactionRing.scale.set(scaleX, 1, scaleZ);
      this.dynamic.interactionRing.material.opacity = 0.28 + pulse * 0.2;
    } else {
      this.dynamic.interactionRing.visible = false;
    }

    if (game.act.socket) {
      this.positionBox(this.dynamic.socket, game.act.socket, 0.4);
      this.dynamic.socket.visible = true;
      this.dynamic.socket.material.color.set(
        game.progress.batterySocketPowered ? "#63ffd1" : "#203138"
      );
      this.dynamic.socket.material.emissive?.set?.(game.progress.batterySocketPowered ? "#2ee2b3" : "#0f1518");
      this.dynamic.socket.material.emissiveIntensity = game.progress.batterySocketPowered ? 0.48 + pulse * 0.16 : 0.08 + pulse * 0.12;
    } else {
      this.dynamic.socket.visible = false;
    }

    if (game.act.battery) {
      this.positionBox(this.dynamic.battery, game.act.battery, 0.34 + Math.sin(game.time * 3.8) * 0.04);
      this.dynamic.battery.visible = !game.progress.batterySocketPowered || game.mode === "play";
      this.dynamic.battery.material.color.set(
        game.progress.batterySocketPowered ? "#72ffd7" : "#ff8c62"
      );
      this.dynamic.battery.material.emissive?.set?.(game.progress.batterySocketPowered ? "#2ccfb0" : "#7a2a12");
      this.dynamic.battery.material.emissiveIntensity = game.progress.batterySocketPowered ? 0.42 : 0.18 + pulse * 0.14;
      this.dynamic.battery.rotation.y = Math.sin(game.time * 2.2) * 0.2;
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
    this.scene.fog.near = game.mode === "ending" || game.mode === "win" ? 20 : 14;
    this.scene.fog.far = game.mode === "ending" || game.mode === "win" ? 72 : 54;
    this.ambientLight.color.set(palette.lamp);
    this.ambientLight.groundColor.set(game.mode === "ending" || game.mode === "win" ? "#38444c" : "#182226");
    this.ambientLight.intensity = game.mode === "ending" || game.mode === "win" ? 1.2 : 1.05;
    this.sunLight.color.set(palette.lamp);
    this.sunLight.intensity = game.mode === "ending" || game.mode === "win" ? 1.35 : 1.55;
    this.fillLight.color.set(game.mode === "ending" || game.mode === "win" ? "#bfd7ff" : "#7db8ff");
    this.fillLight.intensity = game.mode === "ending" || game.mode === "win" ? 0.3 : 0.45;
    this.rimLight.color.set(palette.accent);
    this.rimLight.intensity = game.mode === "ending" || game.mode === "win" ? 0.75 : 1.05;
    this.heroLight.color.set(palette.accent);
    this.floorGlow.material.opacity = game.mode === "ending" || game.mode === "win" ? 0.16 : 0.18;
    this.heroLightGlow.material.color.set(palette.accent);
    this.sunHalo.material.opacity = game.mode === "ending" || game.mode === "win" ? 0.12 : 0.08;
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

  createPlayerShadow() {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.68, 28),
      new THREE.MeshBasicMaterial({
        color: "#10191d",
        transparent: true,
        opacity: 0.3,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    return shadow;
  }

  createInteractionRing() {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.9, 32),
      new THREE.MeshBasicMaterial({
        color: "#8effd3",
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    return ring;
  }

  createLaptop(kind) {
    const group = new THREE.Group();
    const isPlayer = kind === "player";
    const shellColor = isPlayer ? "#c8d1cb" : "#7a8792";
    const shellAccent = isPlayer ? "#e7d9b1" : "#8d98a1";
    const lidColor = isPlayer ? "#60737d" : "#505d67";
    const screenColor = isPlayer ? "#b9fff0" : "#c6ffe7";

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.26, 0.82),
      new THREE.MeshStandardMaterial({
        color: shellColor,
        roughness: 0.5,
        metalness: 0.18,
        emissive: isPlayer ? "#182226" : "#0b0f11",
        emissiveIntensity: isPlayer ? 0.2 : 0.05,
      })
    );
    base.position.y = 0.18;

    const keyboardPlate = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.035, 0.58),
      new THREE.MeshStandardMaterial({
        color: isPlayer ? "#9ca7ac" : "#7f8a93",
        roughness: 0.86,
        metalness: 0.08,
      })
    );
    keyboardPlate.position.set(0, 0.33, 0.02);

    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(0.94, 0.7, 0.12),
      new THREE.MeshStandardMaterial({
        color: lidColor,
        roughness: 0.58,
        metalness: 0.16,
      })
    );
    lid.position.set(0.02, 0.6, -0.25);
    lid.rotation.x = -0.92;
    lid.rotation.z = isPlayer ? 0.045 : 0;

    const screenBezel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.74, 0.44),
      new THREE.MeshStandardMaterial({
        color: isPlayer ? "#172227" : "#192126",
        roughness: 0.9,
        metalness: 0.04,
      })
    );
    screenBezel.position.set(0.02, 0.61, -0.182);
    screenBezel.rotation.x = -0.92;
    screenBezel.rotation.z = lid.rotation.z;

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.34),
      new THREE.MeshBasicMaterial({ color: screenColor })
    );
    screen.position.set(0.02, 0.61, -0.172);
    screen.rotation.x = -0.92;
    screen.rotation.z = lid.rotation.z;

    const screenGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.4),
      new THREE.MeshBasicMaterial({
        color: isPlayer ? "#8effd3" : "#d5ffe8",
        transparent: true,
        opacity: isPlayer ? 0.14 : 0.07,
      })
    );
    screenGlow.position.set(0.02, 0.61, -0.19);
    screenGlow.rotation.x = -0.92;
    screenGlow.rotation.z = lid.rotation.z;

    const hingeLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshStandardMaterial({ color: lidColor, roughness: 0.65, metalness: 0.18 })
    );
    const hingeRight = hingeLeft.clone();
    hingeLeft.position.set(-0.28, 0.31, -0.27);
    hingeRight.position.set(0.28, 0.31, -0.27);

    const powerLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 12, 12),
      new THREE.MeshBasicMaterial({
        color: isPlayer ? "#8effd3" : "#ffd37d",
      })
    );
    powerLed.position.set(0.44, 0.29, 0.34);

    const badge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.09),
      new THREE.MeshBasicMaterial({ color: shellAccent })
    );
    badge.position.set(-0.33, 0.315, 0.29);
    badge.rotation.x = -Math.PI / 2;
    badge.rotation.z = isPlayer ? -0.18 : 0;

    const chippedCorner = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.04, 0.12),
      new THREE.MeshStandardMaterial({
        color: isPlayer ? "#88949a" : "#6f7a82",
        roughness: 0.78,
        metalness: 0.1,
      })
    );
    chippedCorner.position.set(0.47, 0.315, -0.27);
    chippedCorner.rotation.z = 0.48;

    const leftEye = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.08),
      new THREE.MeshBasicMaterial({ color: "#122628" })
    );
    const rightEye = leftEye.clone();
    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.03),
      new THREE.MeshBasicMaterial({ color: "#122628" })
    );
    leftEye.position.set(-0.1, 0.615, -0.165);
    rightEye.position.set(0.14, 0.615, -0.165);
    mouth.position.set(0.02, 0.535, -0.16);
    leftEye.rotation.x = rightEye.rotation.x = mouth.rotation.x = -0.92;
    leftEye.rotation.z = rightEye.rotation.z = mouth.rotation.z = lid.rotation.z;

    const antennaGlow = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.3, 24),
      new THREE.MeshBasicMaterial({
        color: isPlayer ? "#8effd3" : "#ffd37d",
        transparent: true,
        opacity: isPlayer ? 0.32 : 0.14,
        side: THREE.DoubleSide,
      })
    );
    antennaGlow.rotation.x = -Math.PI / 2;
    antennaGlow.position.set(0, 0.04, 0.02);

    group.add(
      base,
      keyboardPlate,
      lid,
      screenBezel,
      screen,
      screenGlow,
      hingeLeft,
      hingeRight,
      powerLed,
      badge,
      chippedCorner,
      leftEye,
      rightEye,
      mouth,
      antennaGlow
    );
    group.userData = {
      leftEye,
      rightEye,
      mouth,
      base,
      lid,
      screen,
      screenGlow,
      antennaGlow,
      powerLed,
      badge,
      chippedCorner,
    };
    return {
      group,
      leftEye,
      rightEye,
      mouth,
      base,
      lid,
      screen,
      screenGlow,
      antennaGlow,
      powerLed,
      badge,
      chippedCorner,
    };
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
    const heroic = mood === "heroic";
    const determined = mood === "determined";
    model.group.position.set(x, 0, z);
    model.group.rotation.y = noTilt ? 0 : source.facing === -1 ? Math.PI * 0.08 : -Math.PI * 0.08;
    model.group.rotation.z = noTilt ? 0 : heroic ? 0.03 : determined ? 0.015 : 0;

    if (model.screen) {
      model.screen.material.color.set(heroic ? "#e4fff6" : determined ? "#c8fff1" : "#a8ffea");
    }
    if (model.screenGlow?.material) {
      model.screenGlow.material.opacity = heroic ? 0.24 : determined ? 0.19 : 0.13;
      model.screenGlow.material.color.set(heroic ? "#b8fff0" : "#8effd3");
    }
    if (model.base?.material) {
      model.base.material.emissiveIntensity = heroic ? 0.34 : determined ? 0.28 : 0.2;
      model.base.material.color.set(heroic ? "#d3dbd5" : determined ? "#c8d1cb" : "#bcc5c8");
    }
    if (model.lid?.material) {
      model.lid.material.color.set(heroic ? "#738892" : determined ? "#657a83" : "#5d7079");
    }
    if (model.antennaGlow?.material) {
      model.antennaGlow.material.opacity = heroic ? 0.52 : determined ? 0.42 : 0.28;
      model.antennaGlow.scale.setScalar(heroic ? 1.14 : determined ? 1.08 : 1);
    }
    if (model.powerLed?.material) {
      model.powerLed.material.color.set(heroic ? "#d8fff3" : determined ? "#8effd3" : "#7de8ca");
      model.powerLed.scale.setScalar(heroic ? 1.3 : determined ? 1.15 : 1);
    }
    if (model.badge) {
      model.badge.visible = true;
    }
    if (model.chippedCorner) {
      model.chippedCorner.rotation.y = heroic ? 0.2 : 0;
    }

    if (!model.leftEye) {
      return;
    }

    const eyeScaleY = determined || heroic ? 0.45 : 1;
    model.leftEye.scale.y = eyeScaleY;
    model.rightEye.scale.y = eyeScaleY;
    model.mouth.scale.x = heroic ? 1.4 : determined ? 1.2 : 1;
    model.mouth.position.y = mood === "curious" ? 0.535 : 0.5;
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
