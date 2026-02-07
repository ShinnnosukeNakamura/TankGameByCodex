import {
  GRID_SIZE,
  TILE,
  createGame,
  createSeededRng,
  update,
} from "./gameLogic.js";
import {
  API_BASE_URL,
  LEADERBOARD_BOARD_ID,
  LEADERBOARD_LIMIT,
} from "./config.js";

const canvas = document.getElementById("board");
const scoreEl = document.getElementById("score");
const floorEl = document.getElementById("floor");
const hpEl = document.getElementById("hp");
const ammoEl = document.getElementById("ammo");
const overlay = document.getElementById("overlay");
const overlayMessage = document.getElementById("overlayMessage");
const scoreForm = document.getElementById("scoreForm");
const playerNameInput = document.getElementById("playerName");
const scoreStatus = document.getElementById("scoreStatus");
const logEl = document.getElementById("log");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const leaderboardList = document.getElementById("leaderboardList");
const refreshBoardBtn = document.getElementById("refreshBoardBtn");
const submitScoreBtn = document.getElementById("submitScoreBtn");

const ctx = canvas.getContext("2d");
const cellSize = canvas.width / GRID_SIZE;

const rng = createSeededRng(Date.now() % 100000);
let state = createGame({ gridSize: GRID_SIZE, rng });
let isPaused = false;
let lastTime = 0;
let hasSubmittedScore = false;

const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,
};

const COLORS = {
  wall: "#48413a",
  floor: "#f2ebe0",
  exit: "#d9b45c",
  roadLine: "rgba(90, 82, 73, 0.15)",
  player: "#2c5b52",
  turret: "#172623",
  enemy: "#8b2f2f",
  enemyTough: "#5b1d1d",
  ammo: "#2f6c8e",
  repair: "#4b7f45",
  bulletPlayer: "#ffd36a",
  bulletEnemy: "#ff8f6a",
  explosion: "rgba(255, 156, 72, 0.85)",
  fog: "rgba(24, 19, 14, 0.9)",
  fogSoft: "rgba(24, 19, 14, 0.5)",
};

const API_BASE = (API_BASE_URL || "").trim();
const BOARD_ID = (LEADERBOARD_BOARD_ID || "main").trim() || "main";
const LEADERBOARD_SIZE = Number.isFinite(LEADERBOARD_LIMIT)
  ? Math.max(1, Math.min(50, LEADERBOARD_LIMIT))
  : 10;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cellToPixel(pos) {
  return {
    x: pos.x * cellSize,
    y: pos.y * cellSize,
  };
}

function drawTile(x, y, tile) {
  const isVisible = state.visible?.[y]?.[x];
  const isSeen = state.seen?.[y]?.[x];

  if (!isSeen) {
    ctx.fillStyle = COLORS.fog;
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    return;
  }

  if (tile === TILE.WALL) ctx.fillStyle = COLORS.wall;
  if (tile === TILE.FLOOR) ctx.fillStyle = COLORS.floor;
  if (tile === TILE.EXIT) ctx.fillStyle = COLORS.exit;

  ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

  if (tile === TILE.FLOOR && (x % 7 === 0 || y % 7 === 0)) {
    ctx.fillStyle = COLORS.roadLine;
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  }

  if (!isVisible) {
    ctx.fillStyle = COLORS.fogSoft;
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  }
}

function drawBoard() {
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      drawTile(x, y, state.tiles[y][x]);
    }
  }
}

function drawItems() {
  state.items.forEach((item) => {
    if (!state.visible[item.y]?.[item.x]) return;
    ctx.fillStyle = item.type === "ammo" ? COLORS.ammo : COLORS.repair;
    ctx.fillRect(
      item.x * cellSize + cellSize * 0.22,
      item.y * cellSize + cellSize * 0.22,
      cellSize * 0.56,
      cellSize * 0.56
    );
  });
}

function drawTank(pos, dir, bodyColor, turretColor) {
  const center = cellToPixel(pos);
  const size = cellSize * 0.7;
  ctx.fillStyle = bodyColor;
  ctx.fillRect(center.x - size / 2, center.y - size / 2, size, size);

  ctx.strokeStyle = turretColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  if (dir === "up") ctx.lineTo(center.x, center.y - size * 0.6);
  if (dir === "down") ctx.lineTo(center.x, center.y + size * 0.6);
  if (dir === "left") ctx.lineTo(center.x - size * 0.6, center.y);
  if (dir === "right") ctx.lineTo(center.x + size * 0.6, center.y);
  ctx.stroke();
}

function drawEnemies() {
  state.enemies.forEach((enemy) => {
    const cell = { x: Math.floor(enemy.x), y: Math.floor(enemy.y) };
    if (!state.visible[cell.y]?.[cell.x]) return;
    const color = enemy.hp > 1 ? COLORS.enemyTough : COLORS.enemy;
    drawTank(enemy, enemy.dir, color, "#2a0d0d");
  });
}

function drawPlayer() {
  drawTank(state.player, state.player.dir, COLORS.player, COLORS.turret);
}

function drawBullets() {
  state.bullets.forEach((bullet) => {
    const cell = { x: Math.floor(bullet.x), y: Math.floor(bullet.y) };
    if (!state.visible[cell.y]?.[cell.x]) return;
    const color = bullet.owner === "player" ? COLORS.bulletPlayer : COLORS.bulletEnemy;
    const center = cellToPixel(bullet);
    const speed = Math.hypot(bullet.vx, bullet.vy) || 1;
    const trail = cellSize * 0.65;
    const tx = (bullet.vx / speed) * trail;
    const ty = (bullet.vy / speed) * trail;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(center.x - tx, center.y - ty);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawExplosions() {
  state.explosions.forEach((explosion) => {
    const cell = { x: Math.floor(explosion.x), y: Math.floor(explosion.y) };
    if (!state.visible[cell.y]?.[cell.x]) return;
    const t = clamp(explosion.life / 0.35, 0, 1);
    const center = cellToPixel(explosion);
    const radius = cellSize * (0.15 + (1 - t) * 0.5);
    ctx.fillStyle = `rgba(255, 156, 72, ${0.9 * t})`;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  floorEl.textContent = String(state.floor);
  hpEl.textContent = String(state.player.hp);
  ammoEl.textContent = String(state.player.ammo);

  logEl.innerHTML = "";
  state.log.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    logEl.appendChild(li);
  });
}

function updateOverlay() {
  if (state.isGameOver) {
    overlayMessage.textContent = hasSubmittedScore
      ? "戦車が大破しました。スコアを登録しました。Restartで再挑戦。"
      : "戦車が大破しました。スコアを登録してからRestartで再挑戦。";
    overlay.classList.add("is-visible");
    overlay.classList.add("is-gameover");
    if (!hasSubmittedScore && playerNameInput) {
      playerNameInput.focus();
    }
    return;
  }
  if (isPaused) {
    overlayMessage.textContent = "一時停止";
    overlay.classList.add("is-visible");
    overlay.classList.remove("is-gameover");
    return;
  }
  overlay.classList.remove("is-visible");
  overlay.classList.remove("is-gameover");
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  drawItems();
  drawExplosions();
  drawBullets();
  drawEnemies();
  drawPlayer();
  updateHud();
  updateOverlay();
}

function getInput() {
  let moveX = 0;
  let moveY = 0;
  if (keys.left) moveX -= 1;
  if (keys.right) moveX += 1;
  if (keys.up) moveY -= 1;
  if (keys.down) moveY += 1;

  return {
    moveX,
    moveY,
    fire: keys.fire,
  };
}

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const deltaMs = timestamp - lastTime;
  const dt = clamp(deltaMs / 1000, 0, 0.05);
  lastTime = timestamp;

  if (!isPaused && !state.isGameOver) {
    state = update(state, getInput(), dt, rng);
  }

  render();
  window.requestAnimationFrame(gameLoop);
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  if (key === "p") {
    togglePause();
    return;
  }
  if (key === "r") {
    restart();
    return;
  }

  if (key === " " || key === "spacebar") {
    event.preventDefault();
    keys.fire = true;
    return;
  }

  if (key === "arrowup" || key === "w") keys.up = true;
  if (key === "arrowdown" || key === "s") keys.down = true;
  if (key === "arrowleft" || key === "a") keys.left = true;
  if (key === "arrowright" || key === "d") keys.right = true;
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase();
  if (key === " " || key === "spacebar") {
    keys.fire = false;
    return;
  }

  if (key === "arrowup" || key === "w") keys.up = false;
  if (key === "arrowdown" || key === "s") keys.down = false;
  if (key === "arrowleft" || key === "a") keys.left = false;
  if (key === "arrowright" || key === "d") keys.right = false;
}

function togglePause() {
  if (state.isGameOver) return;
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? "再開" : "一時停止";
}

function restart() {
  state = createGame({ gridSize: GRID_SIZE, rng });
  isPaused = false;
  pauseBtn.textContent = "一時停止";
  resetScoreSubmission();
}

function resetScoreSubmission() {
  hasSubmittedScore = false;
  if (scoreForm) scoreForm.reset();
  setScoreStatus("");
  if (submitScoreBtn) submitScoreBtn.disabled = false;
}

function setScoreStatus(message, kind = "") {
  if (!scoreStatus) return;
  scoreStatus.textContent = message;
  scoreStatus.className = "score-form__status";
  if (kind) scoreStatus.classList.add(`is-${kind}`);
}

function buildApiUrl(path) {
  if (!API_BASE) return path;
  return API_BASE.endsWith("/") ? `${API_BASE.slice(0, -1)}${path}` : `${API_BASE}${path}`;
}

function setLeaderboardMessage(message) {
  if (!leaderboardList) return;
  leaderboardList.innerHTML = "";
  const item = document.createElement("li");
  item.className = "leaderboard__item";
  const rank = document.createElement("span");
  rank.className = "leaderboard__rank";
  rank.textContent = "-";
  const name = document.createElement("span");
  name.className = "leaderboard__name";
  name.textContent = message;
  const score = document.createElement("span");
  score.className = "leaderboard__score";
  score.textContent = "";
  item.appendChild(rank);
  item.appendChild(name);
  item.appendChild(score);
  leaderboardList.appendChild(item);
}

async function loadLeaderboard() {
  if (!API_BASE) {
    setLeaderboardMessage("API未設定");
    if (refreshBoardBtn) refreshBoardBtn.disabled = true;
    return;
  }

  try {
    if (refreshBoardBtn) refreshBoardBtn.disabled = true;
    const url = buildApiUrl(
      `/leaderboard?limit=${LEADERBOARD_SIZE}&boardId=${encodeURIComponent(BOARD_ID)}`
    );
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`Leaderboard load failed (${res.status})`);
    }
    const data = await res.json();
    renderLeaderboard(Array.isArray(data.items) ? data.items : []);
  } catch (error) {
    console.error(error);
    setLeaderboardMessage("読み込みに失敗しました");
  } finally {
    if (refreshBoardBtn) refreshBoardBtn.disabled = false;
  }
}

function renderLeaderboard(items) {
  if (!leaderboardList) return;
  leaderboardList.innerHTML = "";
  if (!items.length) {
    setLeaderboardMessage("まだ記録がありません");
    return;
  }

  items.forEach((item, index) => {
    const entry = document.createElement("li");
    entry.className = "leaderboard__item";

    const rank = document.createElement("span");
    rank.className = "leaderboard__rank";
    rank.textContent = String(index + 1);

    const name = document.createElement("span");
    name.className = "leaderboard__name";
    name.textContent = item.name || "名無し";

    const score = document.createElement("span");
    score.className = "leaderboard__score";
    const floorLabel = Number.isFinite(item.floor) ? ` / F${item.floor}` : "";
    score.textContent = `${item.score ?? 0}${floorLabel}`;

    entry.appendChild(rank);
    entry.appendChild(name);
    entry.appendChild(score);
    leaderboardList.appendChild(entry);
  });
}

async function handleScoreSubmit(event) {
  event.preventDefault();
  if (!API_BASE) {
    setScoreStatus("API未設定のため登録できません。", "error");
    return;
  }
  if (hasSubmittedScore) {
    setScoreStatus("このプレイは登録済みです。");
    return;
  }
  const rawName = playerNameInput?.value ?? "";
  const trimmed = rawName.trim();
  if (!trimmed) {
    setScoreStatus("名前を入力してください。", "error");
    return;
  }

  const payload = {
    name: trimmed.slice(0, 8),
    score: state.score,
    floor: state.floor,
    boardId: BOARD_ID,
  };

  try {
    if (submitScoreBtn) submitScoreBtn.disabled = true;
    setScoreStatus("送信中...", "");
    const res = await fetch(buildApiUrl("/leaderboard"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Score submit failed (${res.status})`);
    }
    hasSubmittedScore = true;
    if (submitScoreBtn) submitScoreBtn.disabled = true;
    setScoreStatus("登録しました。", "success");
    await loadLeaderboard();
  } catch (error) {
    console.error(error);
    if (submitScoreBtn) submitScoreBtn.disabled = false;
    setScoreStatus("登録に失敗しました。", "error");
  }
}

pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", restart);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
if (scoreForm) scoreForm.addEventListener("submit", handleScoreSubmit);
if (refreshBoardBtn) refreshBoardBtn.addEventListener("click", loadLeaderboard);

const actionButtons = Array.from(document.querySelectorAll("[data-action]"));
actionButtons.forEach((btn) => {
  const action = btn.dataset.action;
  const press = () => {
    if (action === "move-up") keys.up = true;
    if (action === "move-down") keys.down = true;
    if (action === "move-left") keys.left = true;
    if (action === "move-right") keys.right = true;
    if (action === "fire") keys.fire = true;
  };
  const release = () => {
    if (action === "move-up") keys.up = false;
    if (action === "move-down") keys.down = false;
    if (action === "move-left") keys.left = false;
    if (action === "move-right") keys.right = false;
    if (action === "fire") keys.fire = false;
  };

  btn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    press();
  });
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointerleave", release);
  btn.addEventListener("pointercancel", release);
});

render();
resetScoreSubmission();
loadLeaderboard();
window.requestAnimationFrame(gameLoop);
