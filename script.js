// ゲーム開始時の道の長さ
const INITIAL_PATH_LENGTH = 7;

// ゲームの状態管理
const state = {
  hp: 100, // 主人公の体力
  position: 0, // 現在の距離（進んだマス数）
  pathLength: INITIAL_PATH_LENGTH, // 現在の道の長さ
  heroMemories: 0, // 主人公の思い出数
  bossMemories: 0, // ボスの思い出数
  bossDodges: 0, // ボス思い出による回避残数
  visitedMemories: new Set(), // 取得済みイベント管理
  bossHp: 50, // ボスの体力（簡単にクリアできるよう調整）
  gameOver: false, // ゲーム終了フラグ
  prompt: "", // 選択肢表示用テキスト
};

// 初期イベント配置（横道）
const INITIAL_SIDE_MEMORIES_DEF = {
  1: [{ id: "h1", type: "hero" }],
  2: [{ id: "b1", type: "boss" }],
  3: [
    { id: "h2", type: "hero" },
    { id: "b2", type: "boss" },
  ],
  4: [{ id: "h3", type: "hero" }],
  5: [{ id: "b3", type: "boss" }],
};

// 横道イベント管理
let sideMemories = {};
let extraEventCounter = 0;
// ボスの思い出ストーリー管理（周回をまたいで保持、一度見たら二度と出ない）
let bossMemoryStories = [];
let bossMemoryStoryIndex = 0;
let bossMemoryStoriesInitialized = false;

// ボスの思い出ストーリーをJSONから読み込む（初回のみ）
async function loadBossMemories() {
  if (bossMemoryStoriesInitialized) return;
  try {
    const res = await fetch("boss_memories.json");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    bossMemoryStories = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("boss_memories.json の読み込みに失敗しました", e);
    bossMemoryStories = [];
  }
  bossMemoryStoriesInitialized = true;
}

// エンディングデータ管理
let endingsData = [];

// エンディングデータをJSONから読み込む
async function loadEndingsData() {
  try {
    const res = await fetch("寄り道/ed.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    endingsData = Array.isArray(data.endings) ? data.endings : [];
  } catch (e) {
    console.error("ed.json の読み込みに失敗しました", e);
    endingsData = [];
  }
}

// IDでエンディングデータを取得するヘルパー
function getEnding(id) {
  return endingsData.find((e) => e.id === id) || null;
}

// 横道イベント初期化
function initSideMemories() {
  sideMemories = {};
  extraEventCounter = 0;
  for (const [pos, events] of Object.entries(INITIAL_SIDE_MEMORIES_DEF)) {
    sideMemories[Number(pos)] = events.map((e) => ({ ...e }));
  }
}

// 寄り道でイベントを追加
function addExtraEvent() {
  const start = state.position + 1;
  const end = state.pathLength - 2;
  if (start > end) return;
  const pos = start + Math.floor(Math.random() * (end - start + 1));
  extraEventCounter += 1;
  // ストーリーを全て見尽くしていたらボスの思い出は追加しない
  const canAddBoss = bossMemoryStoryIndex < bossMemoryStories.length;
  const type = canAddBoss && Math.random() < 0.5 ? "boss" : "hero";
  if (!sideMemories[pos]) sideMemories[pos] = [];
  sideMemories[pos].push({ id: `extra_${extraEventCounter}`, type });
}

// ランダムイベント（敵・味方）発生
function maybeRandomEvent(trigger) {
  // trigger: "move" or "memory"
  if (Math.random() < 0.33) {
    // 1/3の確率でイベント発生
    const eventType = Math.random() < 0.5 ? "enemy" : "friend";
    if (eventType === "enemy") {
      // 敵イベント: HP減少
      const dmg = 10 + Math.floor(Math.random() * 11); // 10~20
      state.hp = Math.max(0, state.hp - dmg);
      setPrompt(`敵が現れた！主人公は${dmg}ダメージを受けた。`);
      if (state.hp <= 0) {
        finishGameOver();
        return true;
      }
    } else {
      // 味方イベント: HP回復 or 思い出追加
      if (Math.random() < 0.5) {
        const heal = 15 + Math.floor(Math.random() * 11); // 15~25
        state.hp = Math.min(120, state.hp + heal);
        setPrompt(`味方が現れた！主人公のHPが${heal}回復した。`);
      } else {
        state.heroMemories += 1;
        setPrompt(`味方が現れた！主人公の思い出が増えた。`);
      }
    }
    renderAll();
    return true;
  }
  return false;
}

const promptEl = document.getElementById("prompt");
const bossStoryListEl = document.getElementById("boss-story-list");
const hpEl = document.getElementById("hp");
const distanceEl = document.getElementById("distance");
const heroMemoryCountEl = document.getElementById("hero-memory-count");
const bossMemoryCountEl = document.getElementById("boss-memory-count");
const resultPanelEl = document.getElementById("result-panel");
const resultTitleEl = document.getElementById("result-title");
const resultTextEl = document.getElementById("result-text");
const resultHpEl = document.getElementById("result-hp");
const resultHeroMemoryEl = document.getElementById("result-hero-memory");
const resultBossMemoryEl = document.getElementById("result-boss-memory");

const forwardBtn = document.getElementById("forward-btn");
const fightBtn = document.getElementById("fight-btn");
const reconcileBtn = document.getElementById("reconcile-btn");
const restartBtn = document.getElementById("restart-btn");
const resultRestartBtn = document.getElementById("result-restart-btn");
const memoryButtonsEl = document.getElementById("memory-buttons");

function setPrompt(text) {
  state.prompt = text;
  promptEl.textContent = text;
}

function getEndingText(clearedBy) {
  let endingId;
  if (state.bossMemories >= 100 && clearedBy === "reconcile") {
    endingId = 1;
  } else if (state.bossMemories >= 100 && clearedBy === "battle") {
    endingId = 6;
  } else if (state.bossMemories === 0 && clearedBy === "battle") {
    endingId = 5;
  } else if (state.bossMemories < 100 && clearedBy === "battle") {
    endingId = 3;
  } else if (state.bossMemories < 100 && clearedBy === "reconcile") {
    endingId = 4;
  }

  const ending = endingId ? getEnding(endingId) : null;
  if (ending) {
    const extra = (endingId === 3 || endingId === 4) ? `（ボス思い出: ${state.bossMemories}/100）` : "";
    return ending.text + extra;
  }

  // フォールバック
  const routeTone = clearedBy === "battle" ? "剣を交えて決着をつけた。" : "戦わず言葉で決着をつけた。";
  return `${routeTone} 物語は無事に幕を閉じた。`;
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
    btn.textContent = memory.type === "hero" ? "横道へ進む: 主人公の思い出" : "横道へ進む: ボスの思い出";
    btn.addEventListener("click", () => collectMemory(memory));
    memoryButtonsEl.appendChild(btn);
  });
}

function updateControls() {
  const atBoss = state.position === state.pathLength - 1;
  const canMove = state.position < state.pathLength - 1 && !state.gameOver;
  // 100個回収後は進むことしかできない
  const forceForwardOnly = state.bossMemories >= 100 && !atBoss;

  forwardBtn.disabled = !canMove;
  fightBtn.disabled = forceForwardOnly || !atBoss || state.gameOver;
  reconcileBtn.disabled = forceForwardOnly || !atBoss || state.gameOver;
}

function renderResult() {
  resultPanelEl.hidden = !state.gameOver;

  if (!state.gameOver) {
    return;
  }

  resultHpEl.textContent = `${Math.max(0, state.hp)} / 120`;
  resultHeroMemoryEl.textContent = `${state.heroMemories}個`;
  resultBossMemoryEl.textContent = `${state.bossMemories}個`;
}

// ステータス表示（HPバー含む）
function renderStatus() {
  hpEl.textContent = `${state.hp} / 120`;
  distanceEl.textContent = `${state.position}マス`;
  heroMemoryCountEl.textContent = `${state.heroMemories}個`;
  bossMemoryCountEl.textContent = `${state.bossMemories}個`;
  // HPバー更新
  const hpBar = document.getElementById("hp-bar");
  const maxHp = 120; // HPの上限は120
  const percent = Math.max(0, Math.min(100, (state.hp / maxHp) * 100));
  hpBar.style.width = percent + "%";
}

// 取得済みボス思い出ストーリーを一覧表示
function renderBossMemoryStory() {
  bossStoryListEl.innerHTML = "";
  const count = Math.min(bossMemoryStoryIndex, bossMemoryStories.length);
  for (let i = 0; i < count; i++) {
    const story = bossMemoryStories[i];
    const li = document.createElement("li");
    li.innerHTML = `<strong>${story.title}</strong><br>${story.description}`;
    bossStoryListEl.appendChild(li);
  }
  bossStoryListEl.scrollTop = bossStoryListEl.scrollHeight;
}

function renderAll() {
  renderStatus();
  promptEl.textContent = state.prompt;
  renderMemoryButtons();
  updateControls();
  renderBossMemoryStory();
  renderResult();
}

// イベント取得時の処理
function collectMemory(memory) {
  if (state.visitedMemories.has(memory.id) || state.gameOver) {
    return;
  }

  state.visitedMemories.add(memory.id);

  if (memory.type === "hero") {
    state.heroMemories += 1;
    // 15%の確率でHP70回復、それ以外は25回復
    if (Math.random() < 0.15) {
      state.hp = Math.min(120, state.hp + 70);
      setPrompt("主人公の思い出を得た！幸運にもHPが70回復した。その分道が少し長くなった。次はどうする？");
    } else {
      state.hp = Math.min(120, state.hp + 25);
      setPrompt("主人公の思い出を得た。HPが25回復。その分道が少し長くなった。次はどうする？");
    }
  } else {
    state.bossMemories += 1;
    state.bossDodges += 1;
    // ボスの思い出ストーリーを流す（一度見たものは二度と出ない）
    if (bossMemoryStoryIndex < bossMemoryStories.length) {
      const story = bossMemoryStories[bossMemoryStoryIndex];
      setPrompt(`ボスの思い出: ${story.title}\n${story.description}\n寄り道により道が少し伸びた。次はどうする？`);
      bossMemoryStoryIndex += 1;
    } else {
      setPrompt("すべてのボスの思い出を見尽くした。寄り道により道が少し伸びた。次はどうする？");
    }
    // 100個回収したら進むことしかできなくする
    if (state.bossMemories >= 100) {
      // 全sideMemoriesを空にする（横道イベントすべて消去）
      for (const pos in sideMemories) {
        sideMemories[pos] = [];
      }
    }
  }

  state.pathLength += 1;
  addExtraEvent();
  if (maybeRandomEvent("memory")) return;
  renderAll();
}

function moveForward() {
  if (state.gameOver || state.position >= state.pathLength - 1) {
    return;
  }

  state.position += 1;

  if (maybeRandomEvent("move")) return;

  if (state.position === state.pathLength - 1) {
    setPrompt("ボスの前に着いた。戦うか、和解するか選べる。");
  } else {
    setPrompt("まっすぐな道が続いている。どうする？");
  }

  renderAll();
}

function fightBoss() {
  if (state.gameOver || state.position !== state.pathLength - 1) {
    return;
  }

  state.bossHp -= 50;

  if (state.bossHp <= 0) {
    clearGame("battle");
    return;
  }

  if (state.bossDodges > 0) {
    state.bossDodges -= 1;
    setPrompt("ボスの記憶を思い出し、反撃をかわした。もう一度どうする？");
  } else {
    state.hp -= 10;
    setPrompt("反撃を受けた。痛みをこらえながら、次の行動を選ぶ。");
  }

  if (state.hp <= 0) {
    finishGameOver();
    return;
  }

  renderAll();
}

function reconcileBoss() {
  if (state.gameOver || state.position !== state.pathLength - 1) {
    return;
  }

  const successRate = state.bossMemories * 5;
  const roll = Math.random() * 100;

  if (roll < successRate) {
    clearGame("reconcile");
  } else {
    setPrompt(
      successRate === 0
        ? `和解を試みたが、ボスは耳を貸さなかった。ボスの思い出を集めると成功率が上がる（現在 ${successRate}%）。`
        : `和解を試みたが失敗した（成功率 ${successRate}%）。もう一度試みるか、戦うか選ぼう。`
    );
    renderAll();
  }
}

function clearGame(clearedBy) {
  state.gameOver = true;
  document.body.classList.add("game-over");
  
  // エンディングのタイトルを設定（ed.jsonから取得）
  let endingId;
  if (state.bossMemories >= 100 && clearedBy === "reconcile") {
    endingId = 1;
  } else if (state.bossMemories >= 100 && clearedBy === "battle") {
    endingId = 6;
  } else if (state.bossMemories === 0 && clearedBy === "battle") {
    endingId = 5;
  } else if (state.bossMemories < 100 && clearedBy === "battle") {
    endingId = 3;
  } else {
    endingId = 4;
  }
  const endingEntry = getEnding(endingId);
  const titleText = endingEntry
    ? endingEntry.title
    : (clearedBy === "battle" ? "ゲームクリア: ボスを倒した" : "ゲームクリア: ボスと和解した");
  
  resultTitleEl.textContent = titleText;
  resultTextEl.textContent = getEndingText(clearedBy);
  setPrompt("物語は結末にたどり着いた。resultを確認して、必要ならやり直せる。");
  renderAll();
}

function finishGameOver() {
  state.gameOver = true;
  document.body.classList.add("game-over");
  const gameOverEnding = getEnding(2);
  resultTitleEl.textContent = gameOverEnding ? gameOverEnding.title : "ゲームオーバー";
  resultTextEl.textContent = gameOverEnding ? gameOverEnding.text : "主人公の体力が尽きた。寄り道の選び方を変えると、別の結末にたどり着ける。";
  setPrompt("力尽きた。resultを確認して、やり直せる。");
  renderAll();
}

function resetGame() {
  state.hp = 100;
  state.position = 0;
  state.heroMemories = 0;
  state.bossMemories = 0;
  state.bossDodges = 0;
  state.visitedMemories = new Set();
  state.pathLength = INITIAL_PATH_LENGTH;
  state.bossHp = 50;
  state.gameOver = false;
  state.prompt = "旅をはじめた。まっすぐ進むか、横道へ進むか選ぼう。";
  resultPanelEl.hidden = true;
  resultTitleEl.textContent = "";
  resultTextEl.textContent = "";
  document.body.classList.remove("game-over");
  initSideMemories();
  renderAll();
}

forwardBtn.addEventListener("click", moveForward);
fightBtn.addEventListener("click", fightBoss);
reconcileBtn.addEventListener("click", reconcileBoss);
restartBtn.addEventListener("click", resetGame);
resultRestartBtn.addEventListener("click", resetGame);

// JSON読み込みの成否に関わらず、必ずゲームを開始する
async function initializeGame() {
  await Promise.all([loadBossMemories(), loadEndingsData()]);
  resetGame();
}

initializeGame();
