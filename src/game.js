import { ACTS, BOOT_LINES, CUTSCENES, MEMORY_FRAGMENTS } from "./levels.js";
import { getObjectiveFocus } from "./objective-focus.js";

const WIDTH = 960;
const HEIGHT = 540;
const PLAYER_SPEED = 220;
const INTERACT_RANGE = 80;
const MAX_INTEGRITY = 3;
const MINIGAME_RETRY_DELAY = 0.7;
const MINIGAME_SHOW_INTERVAL = 0.55;

const EFFECT_DECAY_RATES = {
  flash: 2.4,
  glitch: 1.8,
  impact: 2.8,
  powerSurge: 1.4,
  triumph: 0.9,
};

const PREVENTED_KEYS = new Set([
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  " ",
  "enter",
  "e",
  "f",
  "r",
]);

const MOVEMENT_KEYS = new Set([
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "w",
  "a",
  "s",
  "d",
]);

const WASD_TO_ARROW = {
  w: "arrowup",
  a: "arrowleft",
  s: "arrowdown",
  d: "arrowright",
};

const KEY_TO_DIRECTION = {
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const rectsOverlap = (a, b) =>
  a.x < b.x + b.w &&
  a.x + a.w > b.x &&
  a.y < b.y + b.h &&
  a.y + a.h > b.y;

const centerOf = (entity) => ({
  x: entity.x + entity.w / 2,
  y: entity.y + entity.h / 2,
});

const boundsOf = (entity) => ({
  x: entity.x,
  y: entity.y,
  w: entity.w,
  h: entity.h,
});

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const decay = (value, rate, delta) =>
  value > 0 ? Math.max(0, value - delta * rate) : value;

const axisFromKeys = (isDown, negative, positive) =>
  (isDown(positive[0]) || isDown(positive[1]) ? 1 : 0) -
  (isDown(negative[0]) || isDown(negative[1]) ? 1 : 0);

export class ObsoleteGame {
  constructor({ audio, renderer, ui }) {
    this.audio = audio;
    this.renderer = renderer;
    this.ui = ui;
    this.keys = new Set();
    this.lastTimestamp = 0;
    this.time = 0;
    this.camera = { x: 0, y: 0 };
    this.flash = 0;
    this.glitch = 0;
    this.impact = 0;
    this.powerSurge = 0;
    this.triumph = 0;
    this.banner = { text: "", timer: 0 };
    this.scheduledEvents = [];
    this.cutscene = null;
    this.interactionFocus = null;

    this.player = {
      x: 0,
      y: 0,
      w: 46,
      h: 34,
      facing: 1,
      mood: "curious",
    };

    this.dialogue = {
      speaker: "Scrap Heap",
      text: "Press Enter to boot up.",
      portrait: "laptop",
      timer: 0,
    };

    this.progress = this.createProgress();
    this.miniGame = this.createMiniGameState();
    this.reset();
  }

  createProgress() {
    return {
      integrity: MAX_INTEGRITY,
      fragments: [],
      hasFloppy: false,
      batterySocketPowered: false,
      act2GateOpen: false,
      diagnosticPassed: false,
      act1TalkedToMachine: false,
      act2UnderstoodGate: false,
    };
  }

  createMiniGameState() {
    return {
      active: false,
      round: 0,
      phase: "idle",
      sequence: [],
      showIndex: 0,
      showTimer: 0,
      inputIndex: 0,
      acceptedKeys: [],
      message: "Awaiting POST.",
    };
  }

  reset() {
    this.mode = "title";
    this.bootIndex = 0;
    this.bootTimer = 0;
    this.endingTimer = 0;
    this.time = 0;
    this.flash = 0;
    this.glitch = 0;
    this.impact = 0;
    this.powerSurge = 0;
    this.triumph = 0;
    this.scheduledEvents = [];
    this.cutscene = null;
    this.interactionFocus = null;
    this.progress = this.createProgress();
    this.player.mood = "curious";
    this.miniGame = this.createMiniGameState();
    this.loadAct(0);
    this.camera.x = 0;
    this.camera.y = 0;
    this.setDialogue("Scrap Heap", "Press Enter to boot up.", "laptop");
    this.setBanner("OBSOLETE", 1.8);
    this.updateStatus("Title Screen", "Press Enter to boot up.");
    this.render();
  }

  loadAct(index) {
    this.actIndex = index;
    this.act = deepClone(ACTS[index]);
    this.player.x = this.act.start.x;
    this.player.y = this.act.start.y;
    this.activeCheckpoint = {
      x: this.act.checkpoint.x,
      y: this.act.checkpoint.y,
      label: this.act.checkpoint.label,
    };
    this.updateStatus(this.act.label, this.act.hint);
    this.setBanner(this.act.label.toUpperCase(), 2.4);
    this.renderer.markDirty();
  }

  updateStatus(act, hint) {
    this.ui.statusAct.textContent = act;
    this.ui.statusHint.textContent = hint;
  }

  playerBounds() {
    return boundsOf(this.player);
  }

  getCurrentObjective() {
    const modeObjective = this.getModeObjective();
    if (modeObjective) return modeObjective;
    return this.getPlayObjective();
  }

  getModeObjective() {
    switch (this.mode) {
      case "title":
        return {
          title: "Boot up and get your bearings.",
          body: "Press Enter or click Boot Up to wake the laptop.",
        };
      case "boot":
        return {
          title: "Recovery BIOS is coming online.",
          body: "Wait for the surge to finish, then start moving.",
        };
      case "cutscene":
        return {
          title: "Watch the scene for your next goal.",
          body: "Press Enter, E, or Space to advance dialogue when you're ready.",
        };
      case "minigame":
        return {
          title: `Pass Diagnostic ${this.miniGame.round}/3.`,
          body:
            this.miniGame.phase === "input"
              ? "Repeat the shown sequence with Arrow Keys or WASD."
              : "Watch the sequence, then repeat it cleanly.",
        };
      case "ending":
        return {
          title: "Run for the sunrise.",
          body: "Keep moving right. You are out if you stay moving.",
        };
      case "win":
        return {
          title: "You escaped.",
          body: "Press Play Again or R to restart the prototype.",
        };
      default:
        return null;
    }
  }

  getPlayObjective() {
    const hasBatteryGoal =
      this.act.socket && this.act.battery && !this.progress.batterySocketPowered;
    if (hasBatteryGoal) {
      if (!this.progress.act1TalkedToMachine && (this.act.npcs || []).length) {
        return {
          title: "Find a powered machine and talk to it.",
          body: "Head toward the nearest glowing device and press E to get your bearings.",
        };
      }
      return {
        title: "Push the orange battery into the glowing socket.",
        body: "Walk into the battery to shove it, then line it up with the cyan socket to restore power.",
      };
    }

    if (this.act.gateConsole && !this.progress.act2GateOpen) {
      const needsFloppy =
        !this.progress.hasFloppy &&
        (this.act.items || []).some((item) => item.id === "floppy");
      if (needsFloppy) {
        return {
          title: "Find the floppy disk.",
          body: "Ride the conveyors, dodge the crushers, and grab the glowing disk before the gate console.",
        };
      }
      return {
        title: "Feed the floppy disk into the gate console.",
        body: "Approach the console near the exit gate and press E to unlock the route.",
      };
    }

    if (this.act.console && !this.progress.diagnosticPassed) {
      return {
        title: "Prove you still work.",
        body: "Reach the diagnostic console and pass all three memory-sequence rounds.",
      };
    }

    if (this.act.exitZone) {
      return {
        title: this.act.title || "The route is open.",
        body: this.act.hint || "Move through the route and keep going.",
      };
    }

    return {
      title: this.act.title || "Keep moving.",
      body: this.act.hint || "Push deeper into the yard.",
    };
  }

  getInteractionFocus() {
    if (this.mode !== "play") return null;

    const nearestNpc = this.findNearest(this.act.npcs || []);
    if (nearestNpc) {
      return {
        type: "npc",
        x: nearestNpc.x,
        y: nearestNpc.y,
        w: nearestNpc.w,
        h: nearestNpc.h,
        label: `Talk to ${nearestNpc.name}`,
        tone: nearestNpc.portrait === "modem" ? "guide" : "talk",
        highlightStyle: "beacon",
      };
    }

    if (
      this.act.socket &&
      this.isNearRect(this.act.socket, 120) &&
      !this.progress.batterySocketPowered
    ) {
      return {
        type: "socket",
        ...this.act.socket,
        label: "Align the battery with the socket",
        tone: "power",
        highlightStyle: "beam",
      };
    }

    if (this.act.gateConsole && this.isNearRect(this.act.gateConsole, INTERACT_RANGE)) {
      const hasFloppy = this.progress.hasFloppy;
      return {
        type: "gateConsole",
        ...this.act.gateConsole,
        label: hasFloppy ? "Use the gate console" : "Find the floppy disk first",
        tone: hasFloppy ? "power" : "warning",
        highlightStyle: hasFloppy ? "beam" : "ring",
      };
    }

    if (this.act.console && this.isNearRect(this.act.console, INTERACT_RANGE)) {
      const passed = this.progress.diagnosticPassed;
      return {
        type: "finalConsole",
        ...this.act.console,
        label: passed ? "Exit route unlocked" : "Start the diagnostic",
        tone: passed ? "exit" : "guide",
        highlightStyle: passed ? "beam" : "beacon",
      };
    }

    if (this.act.exitZone && this.isNearRect(this.act.exitZone, INTERACT_RANGE + 20)) {
      const canExit =
        !this.act.exitZone.requires || this.progress[this.act.exitZone.requires];
      return {
        type: "exit",
        ...this.act.exitZone,
        label: canExit ? "Step into the exit route" : "Restore power to open the route",
        tone: canExit ? "exit" : "warning",
        highlightStyle: canExit ? "beam" : "ring",
      };
    }

    return getObjectiveFocus({
      act: this.act,
      progress: this.progress,
      player: this.player,
    });
  }

  setDialogue(speaker, text, portrait = "laptop", duration = 5.2) {
    this.dialogue = { speaker, text, portrait, timer: duration };
  }

  setBanner(text, duration = 2) {
    this.banner = { text, timer: duration };
  }

  schedule(delay, callback) {
    this.scheduledEvents.push({ remaining: delay, callback });
  }

  tickScheduledEvents(delta) {
    if (!this.scheduledEvents.length) return;
    const ready = [];
    this.scheduledEvents = this.scheduledEvents.filter((event) => {
      event.remaining -= delta;
      if (event.remaining <= 0) {
        ready.push(event.callback);
        return false;
      }
      return true;
    });
    ready.forEach((callback) => callback());
  }

  start() {
    this.lastTimestamp = performance.now();
    window.requestAnimationFrame((timestamp) => this.frame(timestamp));
  }

  frame(timestamp) {
    const delta = Math.min(0.033, (timestamp - this.lastTimestamp) / 1000 || 0.016);
    this.lastTimestamp = timestamp;
    this.advance(delta);
    this.render();
    window.requestAnimationFrame((next) => this.frame(next));
  }

  advance(delta) {
    this.time += delta;
    this.tickScheduledEvents(delta);
    this.decayEffects(delta);

    switch (this.mode) {
      case "boot":
        this.updateBoot(delta);
        return;
      case "cutscene":
        this.updateCutscene(delta);
        return;
      case "play":
        this.updatePlay(delta);
        return;
      case "minigame":
        this.updateMiniGame(delta);
        return;
      case "ending":
        this.updateEnding(delta);
        return;
      default:
        return;
    }
  }

  decayEffects(delta) {
    for (const key in EFFECT_DECAY_RATES) {
      this[key] = decay(this[key], EFFECT_DECAY_RATES[key], delta);
    }
    if (this.banner.timer > 0) {
      this.banner.timer = Math.max(0, this.banner.timer - delta);
    }
    if (this.dialogue.timer > 0 && this.mode === "play") {
      this.dialogue.timer = Math.max(0, this.dialogue.timer - delta);
    }
  }

  advanceTime(ms) {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) {
      this.advance(1 / 60);
    }
    this.render();
  }

  updateBoot(delta) {
    this.bootTimer += delta;
    if (this.bootTimer < 0.8) return;

    this.bootTimer = 0;
    this.bootIndex += 1;
    this.flash = Math.max(this.flash, 0.42);
    this.powerSurge = Math.max(this.powerSurge, 0.62);
    this.glitch = Math.max(this.glitch, 0.12);

    if (this.bootIndex === 1) {
      this.audio.boot();
    }
    if (this.bootIndex < BOOT_LINES.length) {
      this.setBanner(BOOT_LINES[this.bootIndex - 1], 0.9);
    }
    if (this.bootIndex >= BOOT_LINES.length + 2) {
      this.finishBoot();
    }
  }

  finishBoot() {
    this.mode = "play";
    this.flash = Math.max(this.flash, 0.72);
    this.powerSurge = Math.max(this.powerSurge, 0.9);
    this.impact = Math.max(this.impact, 0.45);
    this.setBanner("BOOT COMPLETE", 1.6);
    this.setDialogue("Obsolete", "Okay. I am alive. That seems important.", "laptop", 5.5);
    this.updateStatus(this.act.label, this.act.hint);
    this.startCutscene("act1Wake");
  }

  updateCutscene(delta) {
    if (!this.cutscene) return;
    this.updateCamera(delta);
    this.cutscene.stepTimer -= delta;
    if (this.cutscene.stepTimer <= 0) {
      this.advanceCutscene();
    }
  }

  updatePlay(delta) {
    const axisX = axisFromKeys(
      (k) => this.isDown(k),
      ["arrowleft", "a"],
      ["arrowright", "d"],
    );
    const axisY = axisFromKeys(
      (k) => this.isDown(k),
      ["arrowup", "w"],
      ["arrowdown", "s"],
    );
    const length = Math.hypot(axisX, axisY) || 1;
    let moveX = (axisX / length) * PLAYER_SPEED;
    let moveY = (axisY / length) * PLAYER_SPEED;

    if (axisX !== 0) {
      this.player.facing = axisX > 0 ? 1 : -1;
    }

    const onConveyor = this.getConveyorAt(this.player);
    if (onConveyor) {
      moveX += onConveyor.forceX;
    }

    this.movePlayer(moveX * delta, 0);
    this.movePlayer(0, moveY * delta);

    if (axisX !== 0 || axisY !== 0) {
      this.audio.step(this.time * 1000);
    }

    this.updateCheckpoints();
    this.updateItems();
    this.updateHazards();
    this.updateCamera(delta);
    this.checkActInteractions();
    this.interactionFocus = this.getInteractionFocus();
  }

  updateMiniGame(delta) {
    this.updateCamera(delta);
    if (this.miniGame.phase !== "show") return;

    this.miniGame.showTimer -= delta;
    if (this.miniGame.showTimer > 0) return;

    this.miniGame.showIndex += 1;
    if (this.miniGame.showIndex >= this.miniGame.sequence.length) {
      this.miniGame.phase = "input";
      this.miniGame.inputIndex = 0;
      this.miniGame.acceptedKeys = [];
      this.miniGame.message = "Repeat the sequence with Arrow Keys or WASD.";
    } else {
      this.miniGame.showTimer = MINIGAME_SHOW_INTERVAL;
      this.audio.interact();
    }
  }

  updateEnding(delta) {
    this.endingTimer += delta;
    this.player.x += 120 * delta;
    this.player.y = 650 + Math.sin(this.endingTimer * 2.4) * 6;
    this.camera.x = clamp(this.player.x - WIDTH * 0.45, 0, 700);
    this.camera.y = 0;

    if (this.endingTimer > 5.8) {
      this.mode = "win";
      this.updateStatus("Escape Complete", "Press R to restart the prototype.");
      this.setBanner("YOU ARE NOT OBSOLETE", 4.5);
    }
  }

  updateCamera(delta) {
    const followFocus = this.mode === "cutscene" && this.cutscene?.focus;
    const target = followFocus ? this.cutscene.focus : this.player;
    const lerp = followFocus ? 3.8 : 5.5;

    const targetX = clamp(target.x - WIDTH / 2, 0, this.act.world.width - WIDTH);
    const targetY = clamp(target.y - HEIGHT / 2, 0, this.act.world.height - HEIGHT);
    const step = Math.min(1, delta * lerp);
    this.camera.x += (targetX - this.camera.x) * step;
    this.camera.y += (targetY - this.camera.y) * step;
  }

  movePlayer(dx, dy) {
    if (!dx && !dy) return;

    const next = {
      x: this.player.x + dx,
      y: this.player.y + dy,
      w: this.player.w,
      h: this.player.h,
    };

    const collision = this.getSolidCollision(next);
    if (!collision) {
      this.player.x = next.x;
      this.player.y = next.y;
      return;
    }

    const pushingBattery =
      this.act.battery &&
      this.act.socket &&
      !this.progress.batterySocketPowered &&
      rectsOverlap(next, this.act.battery) &&
      this.tryMoveBattery(dx, dy);
    if (pushingBattery) {
      this.player.x = next.x;
      this.player.y = next.y;
      return;
    }

    if (dx !== 0) {
      this.player.x = dx > 0 ? collision.x - this.player.w : collision.x + collision.w;
    }
    if (dy !== 0) {
      this.player.y = dy > 0 ? collision.y - this.player.h : collision.y + collision.h;
    }
  }

  getSolidCollision(rect, options = {}) {
    const gateRects = (this.act.gates || [])
      .filter((gate) => !this.progress[gate.opensWith])
      .map((gate) => boundsOf(gate));
    const solids = [...this.act.solids, ...gateRects];

    const batteryIsSolid =
      this.act.battery &&
      this.act.socket &&
      !this.progress.batterySocketPowered &&
      !options.ignoreBattery;
    if (batteryIsSolid) {
      solids.push(this.act.battery);
    }

    for (const solid of solids) {
      if (rectsOverlap(rect, solid)) {
        return solid;
      }
    }
    return null;
  }

  getConveyorAt(rect) {
    return (this.act.conveyors || []).find((belt) => rectsOverlap(rect, belt));
  }

  tryMoveBattery(dx, dy) {
    const battery = this.act.battery;
    const nextBattery = { ...battery, x: battery.x + dx, y: battery.y + dy };
    if (this.getSolidCollision(nextBattery, { ignoreBattery: true })) {
      return false;
    }

    battery.x = nextBattery.x;
    battery.y = nextBattery.y;

    if (rectsOverlap(battery, this.act.socket)) {
      this.snapBatteryIntoSocket();
    }
    return true;
  }

  snapBatteryIntoSocket() {
    const { battery, socket } = this.act;
    battery.x = socket.x + 8;
    battery.y = socket.y + 12;
    this.progress.batterySocketPowered = true;
    this.flash = 1;
    this.impact = 0.7;
    this.powerSurge = 1;
    this.audio.success();
    this.player.mood = "determined";
    this.setDialogue("Obsolete", "I still take a charge. Open, you rusted door.", "laptop", 5.5);
    this.setBanner("POWER RESTORED", 2.2);
    this.activeCheckpoint = { x: 1505, y: 590, label: "Checkpoint: gate restored." };
    this.startCutscene("act1Gate");
  }

  updateCheckpoints() {
    const playerRect = this.playerBounds();
    for (const checkpoint of this.act.checkpoints || []) {
      const trigger = {
        x: checkpoint.x - checkpoint.radius / 2,
        y: checkpoint.y - checkpoint.radius / 2,
        w: checkpoint.radius,
        h: checkpoint.radius,
      };
      if (!rectsOverlap(playerRect, trigger)) continue;
      if (this.activeCheckpoint.label === checkpoint.label) continue;

      this.activeCheckpoint = {
        x: checkpoint.x,
        y: checkpoint.y,
        label: checkpoint.label,
      };
      this.progress.integrity = MAX_INTEGRITY;
      this.setBanner("CHECKPOINT", 1.2);
      this.flash = Math.max(this.flash, 0.22);
      this.triumph = Math.max(this.triumph, 0.18);
      this.setDialogue("Scrap Heap", checkpoint.label, "laptop", 3.4);
    }
  }

  updateItems() {
    const playerRect = this.playerBounds();

    for (const fragment of this.act.fragments || []) {
      if (fragment.collected) continue;
      const pickupRect = { x: fragment.x - 13, y: fragment.y - 13, w: 26, h: 26 };
      if (!rectsOverlap(playerRect, pickupRect)) continue;

      fragment.collected = true;
      this.progress.fragments.push(fragment.id);
      this.flash = Math.max(this.flash, 0.24);
      this.triumph = Math.max(this.triumph, 0.25);
      this.setDialogue("Recovered File", fragment.text, "fragment", 3.8);
    }

    for (const item of this.act.items || []) {
      if (item.collected) continue;
      if (!rectsOverlap(playerRect, boundsOf(item))) continue;

      item.collected = true;
      if (item.id === "floppy") {
        this.collectFloppy(item);
      }
    }
  }

  collectFloppy(item) {
    this.progress.hasFloppy = true;
    this.audio.success();
    this.flash = Math.max(this.flash, 0.3);
    this.triumph = Math.max(this.triumph, 0.32);
    this.setDialogue("Obsolete", item.text, "laptop", 4.2);
    this.progress.act2UnderstoodGate = true;
    this.updateStatus(this.act.label, "You have a floppy disk. Feed it to the gate console.");
  }

  updateHazards() {
    const playerRect = this.playerBounds();

    for (const hazard of this.act.hazards || []) {
      const offset = ((Math.sin(this.time * hazard.speed + hazard.phase) + 1) / 2) * hazard.travel;
      hazard.currentOffset = offset;
      const hitbox = {
        x: hazard.x,
        y: hazard.y + offset,
        w: hazard.w,
        h: hazard.h,
      };

      if (rectsOverlap(playerRect, hitbox)) {
        this.takeDamage("Crusher arm says hello.");
        return;
      }
    }
  }

  takeDamage(message) {
    this.progress.integrity -= 1;
    this.glitch = 1;
    this.flash = 0.45;
    this.impact = 1;
    this.audio.zap();

    if (this.progress.integrity <= 0) {
      this.progress.integrity = MAX_INTEGRITY;
      this.setDialogue("Obsolete", "Nope. Rebooting resolve.", "laptop", 3.8);
    } else {
      this.setDialogue("Obsolete", "Ow. Still counts as progress.", "laptop", 3.4);
    }

    this.player.x = this.activeCheckpoint.x;
    this.player.y = this.activeCheckpoint.y;
    this.updateStatus(this.act.label, message);
  }

  checkActInteractions() {
    const exit = this.act.exitZone;
    if (!exit || !rectsOverlap(this.playerBounds(), exit)) return;
    if (exit.requires && !this.progress[exit.requires]) return;

    if (exit.toAct === "ending") {
      this.beginEnding();
      return;
    }

    this.loadAct(exit.toAct);
    this.setDialogue("Obsolete", this.getActIntroLine(exit.toAct), "laptop", 5.2);
    if (this.act.enterCutscene) {
      this.startCutscene(this.act.enterCutscene);
    }
  }

  getActIntroLine(actIndex) {
    return ACTS[actIndex]?.introLine || "Keep moving. The yard is not done with me yet.";
  }

  beginEnding() {
    this.mode = "ending";
    this.cutscene = null;
    this.endingTimer = 0;
    this.flash = 0.55;
    this.powerSurge = 0.7;
    this.triumph = 0.85;
    this.player.x = 160;
    this.player.y = 650;
    this.updateStatus("Final Escape", "Keep going, little machine.");
    this.setDialogue("Obsolete", "Sunrise. I remember sunlight.", "laptop", 5.8);
    this.setBanner("ESCAPE ROUTE OPEN", 2.4);
    this.renderer.markDirty();
  }

  beginBoot() {
    if (this.mode === "boot") return;
    this.mode = "boot";
    this.bootIndex = 0;
    this.bootTimer = 0;
    this.flash = 1;
    this.powerSurge = 1;
    this.impact = 0.25;
    this.glitch = 0.22;
    this.setBanner("RECOVERY VOLTAGE DETECTED", 1.9);
    this.setDialogue("Recovery BIOS", "Cold circuits wake. Hold together.", "console", 2.6);
    this.updateStatus("Boot Sequence", "An electrical surge crawls through the heap.");
  }

  interact() {
    if (this.mode === "title") {
      this.beginBoot();
      return;
    }
    if (this.mode === "win") {
      this.reset();
      return;
    }
    if (this.mode === "cutscene") {
      this.advanceCutscene();
      return;
    }
    if (this.mode !== "play") return;

    this.audio.interact();

    if (this.interactWithNpc()) return;
    if (this.interactWithGateConsole()) return;
    if (this.interactWithDiagnosticConsole()) return;
    if (this.interactWithSocket()) return;

    this.setDialogue("Obsolete", "Nothing here but rust, dust, and motive.", "laptop", 2.8);
  }

  interactWithNpc() {
    const targetNpc = this.findNearest(this.act.npcs || []);
    if (!targetNpc) return false;

    const index = targetNpc.index || 0;
    const line = targetNpc.lines[index];
    targetNpc.index = (index + 1) % targetNpc.lines.length;
    this.progress.act1TalkedToMachine =
      this.progress.act1TalkedToMachine || !!this.act.socket;
    this.progress.act2UnderstoodGate =
      this.progress.act2UnderstoodGate || !!this.act.gateConsole;
    this.setDialogue(targetNpc.name, line, targetNpc.portrait, 4.8);
    this.interactionFocus = this.getInteractionFocus();
    return true;
  }

  interactWithGateConsole() {
    if (!this.act.gateConsole) return false;
    if (!this.isNearRect(this.act.gateConsole, INTERACT_RANGE)) return false;

    if (!this.progress.hasFloppy) {
      this.audio.error();
      this.setDialogue(
        "Gate Console",
        "Insert boot media. Preferably something square and dusty.",
        "console",
        4.5,
      );
      return true;
    }

    this.progress.act2GateOpen = true;
    this.progress.act2UnderstoodGate = true;
    this.audio.success();
    this.flash = Math.max(this.flash, 0.45);
    this.impact = Math.max(this.impact, 0.45);
    this.powerSurge = Math.max(this.powerSurge, 0.7);
    this.setBanner("GATE UNLOCKED", 1.8);
    this.setDialogue("Gate Console", "Legacy media accepted. Route open.", "console", 4.2);
    return true;
  }

  interactWithDiagnosticConsole() {
    if (!this.act.console) return false;
    if (!this.isNearRect(this.act.console, INTERACT_RANGE)) return false;

    if (!this.progress.diagnosticPassed) {
      this.startMiniGame();
    } else {
      this.setDialogue("Diagnostic Console", "Utility verified. Exit route remains open.", "console", 4);
    }
    return true;
  }

  interactWithSocket() {
    if (!this.act.socket) return false;
    if (!this.isNearRect(this.act.socket, 100)) return false;
    if (this.progress.batterySocketPowered) return false;

    this.setDialogue("Socket", "Cold. Hungry. Missing one battery with ambition.", "console", 4);
    return true;
  }

  startMiniGame() {
    this.mode = "minigame";
    this.miniGame = this.createMiniGameState();
    this.miniGame.active = true;
    this.miniGame.round = 1;
    this.powerSurge = Math.max(this.powerSurge, 0.35);
    this.beginMiniGameRound();
    this.setDialogue("Diagnostic Console", "Prove functionality. No pressure, relic.", "console", 4.6);
  }

  beginMiniGameRound() {
    const pool = ["left", "up", "right", "down"];
    this.miniGame.sequence = Array.from(
      { length: this.miniGame.round + 2 },
      (_, index) => pool[(index + this.miniGame.round) % pool.length],
    );
    this.miniGame.phase = "show";
    this.miniGame.showIndex = 0;
    this.miniGame.showTimer = 0.7;
    this.miniGame.inputIndex = 0;
    this.miniGame.acceptedKeys = [];
    this.miniGame.message = `Diagnostic ${this.miniGame.round}/3: watch carefully.`;
    this.audio.interact();
  }

  scheduleMiniGameRound(delay = MINIGAME_RETRY_DELAY) {
    this.schedule(delay, () => {
      if (this.mode === "minigame") {
        this.beginMiniGameRound();
      }
    });
  }

  handleMiniGameInput(direction) {
    if (this.mode !== "minigame" || this.miniGame.phase !== "input") {
      return;
    }

    const expected = this.miniGame.sequence[this.miniGame.inputIndex];
    if (direction !== expected) {
      this.audio.error();
      this.glitch = 1;
      this.flash = 0.35;
      this.miniGame.message = "Sequence mismatch. Try the round again.";
      this.miniGame.phase = "retry";
      this.scheduleMiniGameRound();
      return;
    }

    this.audio.success();
    this.flash = Math.max(this.flash, 0.16);
    this.powerSurge = Math.max(this.powerSurge, 0.18);
    this.miniGame.acceptedKeys.push(direction);
    this.miniGame.inputIndex += 1;

    if (this.miniGame.inputIndex < this.miniGame.sequence.length) return;

    if (this.miniGame.round >= 3) {
      this.finishMiniGame();
      return;
    }

    this.miniGame.round += 1;
    this.miniGame.message = "Subsystem stable. Preparing next test.";
    this.miniGame.phase = "pause";
    this.scheduleMiniGameRound();
  }

  finishMiniGame() {
    this.progress.diagnosticPassed = true;
    this.mode = "play";
    this.cutscene = null;
    this.player.mood = "heroic";
    this.flash = 0.75;
    this.impact = 0.55;
    this.powerSurge = 0.9;
    this.triumph = 1;
    this.setBanner("UTILITY CONFIRMED", 2.4);
    this.setDialogue(
      "Diagnostic Console",
      "Result: alive, useful, impossible to decommission quietly.",
      "console",
      5.2,
    );
    this.audio.success();
    this.startCutscene("finalGate");
  }

  findNearest(list) {
    let nearest = null;
    let nearestDistance = Infinity;
    const playerCenter = centerOf(this.player);

    for (const entity of list) {
      const entityCenter = centerOf(entity);
      const distance = Math.hypot(
        playerCenter.x - entityCenter.x,
        playerCenter.y - entityCenter.y,
      );
      if (distance < INTERACT_RANGE && distance < nearestDistance) {
        nearest = entity;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  isNearRect(rect, range) {
    const point = centerOf(this.player);
    const dx = clamp(point.x, rect.x, rect.x + rect.w) - point.x;
    const dy = clamp(point.y, rect.y, rect.y + rect.h) - point.y;
    return Math.hypot(dx, dy) < range;
  }

  isDown(key) {
    return this.keys.has(key);
  }

  startCutscene(id) {
    const steps = CUTSCENES[id];
    if (!steps?.length) return;

    this.mode = "cutscene";
    this.cutscene = {
      id,
      index: -1,
      steps,
      stepTimer: 0,
      focus: null,
      returnHint: steps[steps.length - 1].hint || this.act.hint,
    };
    this.advanceCutscene();
  }

  advanceCutscene() {
    if (!this.cutscene) return;

    this.cutscene.index += 1;

    if (this.cutscene.index >= this.cutscene.steps.length) {
      const fallbackHint = this.cutscene.returnHint || this.act.hint;
      this.cutscene = null;
      this.mode = "play";
      this.updateStatus(this.act.label, fallbackHint);
      return;
    }

    const step = this.cutscene.steps[this.cutscene.index];
    this.cutscene.stepTimer = step.duration ?? 2;
    this.cutscene.focus = step.focus || null;

    if (step.speaker && step.text) {
      this.setDialogue(step.speaker, step.text, "console", this.cutscene.stepTimer + 0.1);
    }
    if (step.banner) {
      this.setBanner(step.banner, Math.max(this.cutscene.stepTimer, 1.2));
    }
    this.updateStatus(this.act.label, step.hint || "Cutscene. Press Enter, E, or Space to advance.");
  }

  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (PREVENTED_KEYS.has(key)) {
      event.preventDefault();
    }

    this.audio.unlock();

    if (key === "f") {
      this.toggleFullscreen();
      return;
    }
    if (key === "r") {
      this.reset();
      return;
    }
    if (key === "enter") {
      if (this.mode === "title") {
        this.beginBoot();
        return;
      }
      if (this.mode === "win") {
        this.reset();
        return;
      }
      if (this.mode === "cutscene") {
        this.advanceCutscene();
        return;
      }
    }

    if (WASD_TO_ARROW[key]) {
      this.keys.add(WASD_TO_ARROW[key]);
    }

    if (MOVEMENT_KEYS.has(key)) {
      this.keys.add(key);
      this.handleMiniGameInput(KEY_TO_DIRECTION[key]);
    }

    if (key === "e" || key === " ") {
      this.interact();
    }
  }

  handleKeyUp(event) {
    const key = event.key.toLowerCase();
    this.keys.delete(key);
    if (WASD_TO_ARROW[key]) {
      this.keys.delete(WASD_TO_ARROW[key]);
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  render() {
    this.updateUi();
    this.renderer.sync(this);
  }

  updateUi() {
    const objective = this.getCurrentObjective();
    this.ui.memoryCount.textContent = `${this.progress.fragments.length}/${MEMORY_FRAGMENTS.length} fragments`;
    this.ui.batteryCells.forEach((cell, index) => {
      cell.classList.toggle("is-active", index < this.progress.integrity);
    });

    this.ui.dialogueSpeaker.textContent = this.dialogue.speaker;
    this.ui.dialogueText.textContent = this.dialogue.text;
    this.ui.objectiveTitle.textContent = objective.title;
    this.ui.objectiveBody.textContent = objective.body;

    const prompt = this.mode === "play" ? this.interactionFocus?.label || "" : "";
    this.ui.interactionPrompt.textContent = prompt;
    this.ui.interactionPrompt.classList.toggle("is-hidden", !prompt);
    this.ui.interactionPrompt.dataset.tone = this.interactionFocus?.tone || "talk";

    this.ui.objectivePanel.classList.toggle("is-hidden", this.mode === "title");
    this.ui.titleScreen.classList.toggle("is-hidden", this.mode !== "title");
    this.ui.bootScreen.classList.toggle("is-hidden", this.mode !== "boot");
    this.ui.winScreen.classList.toggle("is-hidden", this.mode !== "win");
    this.ui.miniGamePanel.classList.toggle("is-hidden", this.mode !== "minigame");

    this.ui.bootLines.textContent = BOOT_LINES.slice(0, this.bootIndex).join("\n");

    const showBanner = this.banner.timer > 0 && this.banner.text;
    this.ui.banner.classList.toggle("is-hidden", !showBanner);
    this.ui.banner.textContent = this.banner.text;

    this.ui.winSummary.textContent = `Recovered memories: ${this.progress.fragments.length}/${MEMORY_FRAGMENTS.length}. Press Play Again or R to restart.`;

    this.ui.miniGameTitle.textContent =
      this.mode === "minigame"
        ? `Diagnostic ${this.miniGame.round}/3`
        : "Diagnostic 1/3";
    this.ui.miniGameMessage.textContent = this.miniGame.message;
    this.renderMiniGameKeys();
  }

  renderMiniGameKeys() {
    this.ui.miniGameKeys.innerHTML = "";
    const labels = this.miniGame.sequence.length ? this.miniGame.sequence : ["left", "up", "right"];
    labels.forEach((label, index) => {
      const key = document.createElement("div");
      key.className = "mini-key";
      if (this.miniGame.phase === "show" && index === this.miniGame.showIndex) {
        key.classList.add("is-showing");
      }
      if (index < this.miniGame.inputIndex) {
        key.classList.add("is-confirmed");
      }
      key.textContent = label.toUpperCase();
      this.ui.miniGameKeys.appendChild(key);
    });
  }

  renderGameToText() {
    const payload = {
      coordinateSystem: "origin top-left, x increases right, y increases down",
      mode: this.mode,
      act: this.mode === "ending" || this.mode === "win" ? "escape" : this.act.label,
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        w: this.player.w,
        h: this.player.h,
        integrity: this.progress.integrity,
      },
      objective: this.ui.statusHint.textContent,
      objectiveTitle: this.getCurrentObjective().title,
      interactionPrompt: this.interactionFocus?.label || "",
      interactionTone: this.interactionFocus?.tone || "",
      flags: {
        batterySocketPowered: this.progress.batterySocketPowered,
        hasFloppy: this.progress.hasFloppy,
        act2GateOpen: this.progress.act2GateOpen,
        diagnosticPassed: this.progress.diagnosticPassed,
      },
      checkpoint: this.activeCheckpoint,
      fragments: this.progress.fragments.length,
      nearbyNpcs: (this.act.npcs || []).map((npc) => ({
        id: npc.id,
        name: npc.name,
        x: npc.x,
        y: npc.y,
      })),
      hazards: (this.act.hazards || []).map((hazard) => ({
        id: hazard.id,
        x: hazard.x,
        y: hazard.y + Math.round(hazard.currentOffset || 0),
        w: hazard.w,
        h: hazard.h,
      })),
      miniGame:
        this.mode === "minigame"
          ? {
              round: this.miniGame.round,
              phase: this.miniGame.phase,
              sequenceLength: this.miniGame.sequence.length,
              inputIndex: this.miniGame.inputIndex,
              message: this.miniGame.message,
            }
          : null,
      dialogue: this.dialogue,
    };
    return JSON.stringify(payload);
  }
}
