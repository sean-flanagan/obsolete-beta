import { AudioSystem } from "./audio.js";
import { ObsoleteGame } from "./game.js";
import { ObsoleteRenderer } from "./renderer.js";

const sceneMount = document.getElementById("sceneMount");
const ui = {
  statusAct: document.getElementById("statusAct"),
  statusHint: document.getElementById("statusHint"),
  memoryCount: document.getElementById("memoryCount"),
  batteryCells: [...document.querySelectorAll(".battery-meter__cell")],
  dialogueSpeaker: document.getElementById("dialogueSpeaker"),
  dialogueText: document.getElementById("dialogueText"),
  titleScreen: document.getElementById("titleScreen"),
  bootScreen: document.getElementById("bootScreen"),
  bootLines: document.getElementById("bootLines"),
  banner: document.getElementById("banner"),
  objectivePanel: document.getElementById("objectivePanel"),
  objectiveTitle: document.getElementById("objectiveTitle"),
  objectiveBody: document.getElementById("objectiveBody"),
  interactionPrompt: document.getElementById("interactionPrompt"),
  miniGamePanel: document.getElementById("miniGamePanel"),
  miniGameTitle: document.getElementById("miniGameTitle"),
  miniGameMessage: document.getElementById("miniGameMessage"),
  miniGameKeys: document.getElementById("miniGameKeys"),
  winScreen: document.getElementById("winScreen"),
  winSummary: document.getElementById("winSummary"),
  startButton: document.getElementById("startButton"),
  restartButton: document.getElementById("restartButton"),
};

const audio = new AudioSystem();
const renderer = new ObsoleteRenderer({ mount: sceneMount });
const game = new ObsoleteGame({
  audio,
  renderer,
  ui,
});

window.addEventListener("keydown", (event) => game.handleKeyDown(event));
window.addEventListener("keyup", (event) => game.handleKeyUp(event));
window.addEventListener("resize", () => renderer.handleResize());

ui.startButton.addEventListener("click", () => game.beginBoot());
ui.restartButton.addEventListener("click", () => game.reset());

window.render_game_to_text = () => game.renderGameToText();
window.advanceTime = (ms) => game.advanceTime(ms);

game.start();
