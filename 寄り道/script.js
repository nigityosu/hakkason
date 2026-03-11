const MAIN_PATH_LENGTH = 7;

const state = {
  hp: 100,
  position: 0,
  heroMemories: 0,
  bossMemories: 0,
  visitedMemories: new Set(),
  bossHp: 80,
  gameOver: false,
};

const sideMemories = {
  1: [{ id: "h1", type: "hero", label: "主人公の思い出A" }],
  2: [{ id: "b1", type: "boss", label: "ボスの思い出A" }],
  3: [
    { id: "h2", type: "hero", label: "主人公の思い出B" },
    { id: "b2", type: "boss", label: "ボスの思い出B" },
  ],
  4: [{ id: "h3", type: "hero", label: "主人公の思い出C" }],
  5: [{ id: "b3", type: "boss", label: "ボスの思い出C" }],
};

const hpEl = document.getElementById("hp");
const heroMemoryCountEl = document.getElementById("hero-memory-count");
const bossMemoryCountEl = document.getElementById("boss-memory-count");
const locationEl = document.getElementById("location");
const mapEl = document.getElementById("map");
const logEl = document.getElementById("log");
const endingPanelEl = document.getElementById("ending-panel");
const endingTextEl = document.getElementById("ending-text");

const forwardBtn = document.getElementById("forward-btn");
const fightBtn = document.getElementById("fight-btn");
const reconcileBtn = document.getElementById("reconcile-btn");
const restartBtn = document.getElementById("restart-btn");
const memoryButtonsEl = document.getElementById("memory-buttons");

function appendLog(text) {
  const line = document.createElement("div");
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function getEndingText(clearedBy) {
  const heroTone = state.heroMemories >= 2 ? "主人公は思い出に支えられ、穏やかな強さを取り戻した。" : "主人公は不安を抱えながらも前を向いた。";
  const bossTone = state.bossMemories >= 2 ? "ボスの心の背景を深く知れたことで、結末はやさしくほどけた。" : "ボスの事情を少しだけ知り、複雑な余韻が残った。";
  const routeTone = clearedBy === "battle" ? "剣を交えて決着をつけた。" : "戦わず言葉で決着をつけた。";
  return `${routeTone} ${heroTone} ${bossTone}`;
}

function renderMap() {
  mapEl.innerHTML = "";

  for (let i = 0; i < MAIN_PATH_LENGTH; i += 1) {
    const node = document.createElement("div");
    node.className = "node main";
    node.textContent = i === MAIN_PATH_LENGTH - 1 ? "ボス" : `道${i + 1}`;

    if (i === MAIN_PATH_LENGTH - 1) {
      node.classList.add("boss");
    }

    if (state.position === i && !state.gameOver) {
      node.classList.add("player");
    }

    mapEl.appendChild(node);
  }
}

function renderMemoryButtons() {
  memoryButtonsEl.innerHTML = "";
  if (state.gameOver) {
    return;
  }

  const memoriesAtPosition = sideMemories[state.position] || [];
  const available = memoriesAtPosition.filter((m) => !state.visitedMemories.has(m.id));

  available.forEach((memory) => {
    const btn = document.createElement("button");
    btn.textContent = `寄り道: ${memory.label}`;
    btn.addEventListener("click", () => collectMemory(memory));
    memoryButtonsEl.appendChild(btn);
  });
}

function updateControls() {
  const atBoss = state.position === MAIN_PATH_LENGTH - 1;
  const canMove = state.position < MAIN_PATH_LENGTH - 1 && !state.gameOver;

  forwardBtn.disabled = !canMove;
  fightBtn.disabled = !atBoss || state.gameOver;
  reconcileBtn.disabled = !atBoss || state.gameOver || state.bossMemories < 1;
}

function renderStatus() {
  hpEl.textContent = String(state.hp);
  heroMemoryCountEl.textContent = String(state.heroMemories);
  bossMemoryCountEl.textContent = String(state.bossMemories);

  if (state.gameOver) {
    locationEl.textContent = "物語の終わり";
  } else if (state.position === MAIN_PATH_LENGTH - 1) {
    locationEl.textContent = "ボスの前";
  } else {
    locationEl.textContent = `道${state.position + 1}`;
  }
}

function renderAll() {
  renderStatus();
  renderMap();
  renderMemoryButtons();
  updateControls();
}

function collectMemory(memory) {
  if (state.visitedMemories.has(memory.id) || state.gameOver) {
    return;
  }

  state.visitedMemories.add(memory.id);

  if (memory.type === "hero") {
    state.heroMemories += 1;
    state.hp = Math.min(120, state.hp + 25);
    appendLog(`${memory.label}を見つけた。HPが25回復した。`);
  } else {
    state.bossMemories += 1;
    appendLog(`${memory.label}を見つけた。ボスの心情を少し理解した。`);
  }

  renderAll();
}

function moveForward() {
  if (state.gameOver || state.position >= MAIN_PATH_LENGTH - 1) {
    return;
  }

  state.position += 1;
  appendLog(`道を進んだ。現在地: 道${state.position + 1}`);

  if (state.position === MAIN_PATH_LENGTH - 1) {
    appendLog("ボスにたどり着いた。戦うか、和解を試みるか選べる。");
  }

  renderAll();
}

function fightBoss() {
  if (state.gameOver || state.position !== MAIN_PATH_LENGTH - 1) {
    return;
  }

  state.bossHp -= 50;
  appendLog("主人公の攻撃。ボスに50ダメージ。\n");

  if (state.bossHp <= 0) {
    clearGame("battle");
    return;
  }

  state.hp -= 10;
  appendLog("ボスの反撃。主人公は10ダメージを受けた。");

  if (state.hp <= 0) {
    state.gameOver = true;
    appendLog("力尽きたが、ボスはとどめを刺さなかった。やり直して結末を探そう。");
    updateControls();
    renderStatus();
    return;
  }

  renderAll();
}

function reconcileBoss() {
  if (state.gameOver || state.position !== MAIN_PATH_LENGTH - 1 || state.bossMemories < 1) {
    return;
  }

  appendLog("集めたボスの思い出を語り、対話を試みた。");
  clearGame("reconcile");
}

function clearGame(clearedBy) {
  state.gameOver = true;
  appendLog(clearedBy === "battle" ? "ボスを倒した。" : "ボスと和解した。");

  endingTextEl.textContent = getEndingText(clearedBy);
  endingPanelEl.hidden = false;
  renderAll();
}

function resetGame() {
  state.hp = 100;
  state.position = 0;
  state.heroMemories = 0;
  state.bossMemories = 0;
  state.visitedMemories = new Set();
  state.bossHp = 80;
  state.gameOver = false;

  logEl.innerHTML = "";
  endingPanelEl.hidden = true;
  endingTextEl.textContent = "";

  appendLog("旅をはじめた。まっすぐ進むか、寄り道するか選ぼう。");
  renderAll();
}

forwardBtn.addEventListener("click", moveForward);
fightBtn.addEventListener("click", fightBoss);
reconcileBtn.addEventListener("click", reconcileBoss);
restartBtn.addEventListener("click", resetGame);

resetGame();
