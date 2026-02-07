export const GRID_SIZE = 30;

export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const TILE = {
  WALL: "wall",
  FLOOR: "floor",
  EXIT: "exit",
};

const MAX_HP = 6;
const START_AMMO = 8;
const VISION_RADIUS = 7;
const LOG_LIMIT = 6;

const PLAYER_SPEED = 5.4; // cells per second
const BULLET_SPEED = 4.0;
const PLAYER_FIRE_COOLDOWN = 0.22;

const ENEMY_MOVE_COOLDOWN = [0.5, 0.9];
const ENEMY_FIRE_COOLDOWN = [0.6, 1.2];

const ITEM = {
  AMMO: "ammo",
  REPAIR: "repair",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function inBounds(x, y, size) {
  return x >= 0 && y >= 0 && x < size && y < size;
}

function createGrid(size, valueFactory) {
  const grid = [];
  for (let y = 0; y < size; y += 1) {
    const row = [];
    for (let x = 0; x < size; x += 1) {
      row.push(typeof valueFactory === "function" ? valueFactory(x, y) : valueFactory);
    }
    grid.push(row);
  }
  return grid;
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomPick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function addLog(state, message) {
  if (!message) return;
  state.log.unshift(message);
  state.log = state.log.slice(0, LOG_LIMIT);
}

function isWalkable(tile) {
  return tile === TILE.FLOOR || tile === TILE.EXIT;
}

function cellCenter(cell) {
  return { x: cell.x + 0.5, y: cell.y + 0.5 };
}

function posToCell(pos) {
  return { x: Math.floor(pos.x), y: Math.floor(pos.y) };
}

function generateCityTiles(size, rng) {
  const tiles = createGrid(size, TILE.WALL);
  const road = 2;
  const block = 5;
  const span = road + block;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const isRoad = x % span < road || y % span < road;
      if (isRoad) tiles[y][x] = TILE.FLOOR;
    }
  }

  const plazas = Math.max(3, Math.floor(size / 8));
  for (let i = 0; i < plazas; i += 1) {
    const w = randomInt(rng, 3, 6);
    const h = randomInt(rng, 3, 6);
    const rx = randomInt(rng, 1, size - w - 2);
    const ry = randomInt(rng, 1, size - h - 2);
    for (let yy = ry; yy < ry + h; yy += 1) {
      for (let xx = rx; xx < rx + w; xx += 1) {
        tiles[yy][xx] = TILE.FLOOR;
      }
    }
  }

  const alleyCount = Math.max(6, Math.floor(size / 2));
  for (let i = 0; i < alleyCount; i += 1) {
    let x = randomInt(rng, 1, size - 2);
    let y = randomInt(rng, 1, size - 2);
    const steps = randomInt(rng, 8, 18);
    for (let s = 0; s < steps; s += 1) {
      tiles[y][x] = TILE.FLOOR;
      const dir = randomPick(rng, Object.values(DIRECTIONS));
      x = clamp(x + dir.x, 1, size - 2);
      y = clamp(y + dir.y, 1, size - 2);
    }
  }

  for (let i = 0; i < size; i += 1) {
    tiles[0][i] = TILE.WALL;
    tiles[size - 1][i] = TILE.WALL;
    tiles[i][0] = TILE.WALL;
    tiles[i][size - 1] = TILE.WALL;
  }

  return tiles;
}

function collectFloorCells(tiles) {
  const cells = [];
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles.length; x += 1) {
      if (tiles[y][x] === TILE.FLOOR) cells.push({ x, y });
    }
  }
  return cells;
}

function computeDistances(tiles, start) {
  const size = tiles.length;
  const dist = createGrid(size, () => null);
  const queue = [start];
  dist[start.y][start.x] = 0;

  while (queue.length) {
    const current = queue.shift();
    const base = dist[current.y][current.x];
    for (const dir of Object.values(DIRECTIONS)) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (!inBounds(nx, ny, size)) continue;
      if (!isWalkable(tiles[ny][nx])) continue;
      if (dist[ny][nx] !== null) continue;
      dist[ny][nx] = base + 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return dist;
}

function findFarthestCell(tiles, start) {
  const dist = computeDistances(tiles, start);
  let farthest = start;
  let maxDist = -1;
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles.length; x += 1) {
      const value = dist[y][x];
      if (value !== null && value > maxDist) {
        maxDist = value;
        farthest = { x, y };
      }
    }
  }
  return farthest;
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function generateLevel(size, rng, floor) {
  const tiles = generateCityTiles(size, rng);
  const floors = collectFloorCells(tiles);
  const start = floors.length ? randomPick(rng, floors) : { x: 1, y: 1 };
  const exit = findFarthestCell(tiles, start);

  tiles[exit.y][exit.x] = TILE.EXIT;

  const open = floors.filter(
    (cell) => !(cell.x === start.x && cell.y === start.y) && !(cell.x === exit.x && cell.y === exit.y)
  );

  const itemCount = Math.min(8, Math.max(4, Math.floor(size / 4)));
  const items = [];
  const itemTypes = [ITEM.AMMO, ITEM.REPAIR, ITEM.AMMO];
  while (items.length < itemCount && open.length) {
    const idx = Math.floor(rng() * open.length);
    const cell = open.splice(idx, 1)[0];
    if (distance(cell, start) < 4) continue;
    items.push({ ...cell, type: randomPick(rng, itemTypes) });
  }

  const enemyCount = Math.min(18, 5 + Math.floor(floor * 2.2));
  const enemies = [];
  while (enemies.length < enemyCount && open.length) {
    const idx = Math.floor(rng() * open.length);
    const cell = open.splice(idx, 1)[0];
    if (distance(cell, start) < 5) continue;
    const tough = rng() < 0.35;
    enemies.push({
      ...cellCenter(cell),
      dir: "down",
      hp: tough ? 2 : 1,
      type: tough ? "brute" : "scout",
      fireCooldown: randomRange(rng, ENEMY_FIRE_COOLDOWN),
      moveCooldown: randomRange(rng, ENEMY_MOVE_COOLDOWN),
    });
  }

  return { tiles, start, exit, items, enemies };
}

function randomRange(rng, range) {
  return rng() * (range[1] - range[0]) + range[0];
}

function updateVisibility(state) {
  const size = state.gridSize;
  const visible = createGrid(size, false);
  const playerCell = posToCell(state.player);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dist = Math.abs(x - playerCell.x) + Math.abs(y - playerCell.y);
      if (dist <= VISION_RADIUS) {
        visible[y][x] = true;
        state.seen[y][x] = true;
      }
    }
  }
  state.visible = visible;
}

function tileAt(state, pos) {
  const cell = posToCell(pos);
  if (!inBounds(cell.x, cell.y, state.gridSize)) return TILE.WALL;
  return state.tiles[cell.y][cell.x];
}

function isWalkableAt(state, pos) {
  return isWalkable(tileAt(state, pos));
}

function hasLineOfSight(state, from, to) {
  const fromCell = posToCell(from);
  const toCell = posToCell(to);
  if (fromCell.x !== toCell.x && fromCell.y !== toCell.y) return false;

  const dx = Math.sign(toCell.x - fromCell.x);
  const dy = Math.sign(toCell.y - fromCell.y);
  let x = fromCell.x + dx;
  let y = fromCell.y + dy;
  while (x !== toCell.x || y !== toCell.y) {
    if (!inBounds(x, y, state.gridSize)) return false;
    if (!isWalkable(state.tiles[y][x])) return false;
    x += dx;
    y += dy;
  }
  return true;
}

function enemyOccupied(enemies, pos, index = -1) {
  const cell = posToCell(pos);
  return enemies.some((enemy, idx) => {
    if (idx === index) return false;
    const other = posToCell(enemy);
    return other.x === cell.x && other.y === cell.y;
  });
}

function playerOccupied(state, pos) {
  const cell = posToCell(pos);
  const playerCell = posToCell(state.player);
  return cell.x === playerCell.x && cell.y === playerCell.y;
}

function spawnBullet(state, x, y, dir, owner) {
  state.bullets.push({
    x,
    y,
    vx: dir.x * BULLET_SPEED,
    vy: dir.y * BULLET_SPEED,
    owner,
  });
}

function applyItem(state) {
  const cell = posToCell(state.player);
  const idx = state.items.findIndex((item) => item.x === cell.x && item.y === cell.y);
  if (idx === -1) return;

  const item = state.items.splice(idx, 1)[0];
  if (item.type === ITEM.AMMO) {
    state.player.ammo += 4;
    addLog(state, "弾薬を補給した（+4）。");
  } else if (item.type === ITEM.REPAIR) {
    const before = state.player.hp;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 2);
    const healed = state.player.hp - before;
    if (healed > 0) addLog(state, `修理キットで${healed}回復。`);
  }
}

function advanceFloor(state, rng) {
  const nextFloor = state.floor + 1;
  const nextScore = state.score + 60;
  const nextAmmo = state.player.ammo + 2;
  const nextHp = Math.min(state.player.maxHp, state.player.hp + 1);

  const level = generateLevel(state.gridSize, rng, nextFloor);
  const nextState = {
    gridSize: state.gridSize,
    tiles: level.tiles,
    items: level.items,
    enemies: level.enemies,
    bullets: [],
    explosions: [],
    player: {
      ...cellCenter(level.start),
      dir: state.player.dir,
      hp: nextHp,
      maxHp: state.player.maxHp,
      ammo: nextAmmo,
      fireCooldown: 0,
      speed: state.player.speed,
    },
    floor: nextFloor,
    score: nextScore,
    isGameOver: false,
    seen: createGrid(state.gridSize, false),
    visible: createGrid(state.gridSize, false),
    log: [],
  };

  updateVisibility(nextState);
  addLog(nextState, `フロア${nextFloor}に到達。脱出ポイントを探せ。`);
  return nextState;
}

function damagePlayer(state, amount) {
  if (amount <= 0) return;
  state.player.hp = Math.max(0, state.player.hp - amount);
  if (state.player.hp === 0) {
    state.isGameOver = true;
    addLog(state, "戦車が大破した。");
  }
}

export function createGame({ gridSize = GRID_SIZE, rng = Math.random } = {}) {
  const level = generateLevel(gridSize, rng, 1);
  const state = {
    gridSize,
    tiles: level.tiles,
    items: level.items,
    enemies: level.enemies,
    bullets: [],
    explosions: [],
    player: {
      ...cellCenter(level.start),
      dir: "up",
      hp: MAX_HP,
      maxHp: MAX_HP,
      ammo: START_AMMO,
      fireCooldown: 0,
      speed: PLAYER_SPEED,
    },
    floor: 1,
    score: 0,
    isGameOver: false,
    seen: createGrid(gridSize, false),
    visible: createGrid(gridSize, false),
    log: [],
  };

  updateVisibility(state);
  addLog(state, "フロア1へ侵入。脱出ポイントを探せ。");
  return state;
}

export function update(state, input, dt, rng = Math.random) {
  if (state.isGameOver) return state;

  state.player.fireCooldown = Math.max(0, state.player.fireCooldown - dt);

  let moveX = input.moveX || 0;
  let moveY = input.moveY || 0;
  if (Math.abs(moveX) > 0 && Math.abs(moveY) > 0) {
    if (Math.abs(moveX) >= Math.abs(moveY)) {
      moveY = 0;
    } else {
      moveX = 0;
    }
  }

  const dx = moveX * state.player.speed * dt;
  const dy = moveY * state.player.speed * dt;

  if (dx !== 0) {
    const next = { x: state.player.x + dx, y: state.player.y };
    if (isWalkableAt(state, next) && !enemyOccupied(state.enemies, next)) {
      state.player.x = next.x;
      state.player.dir = dx > 0 ? "right" : "left";
    }
  }

  if (dy !== 0) {
    const next = { x: state.player.x, y: state.player.y + dy };
    if (isWalkableAt(state, next) && !enemyOccupied(state.enemies, next)) {
      state.player.y = next.y;
      state.player.dir = dy > 0 ? "down" : "up";
    }
  }

  const playerCell = posToCell(state.player);
  if (state.tiles[playerCell.y][playerCell.x] === TILE.EXIT) {
    return advanceFloor(state, rng);
  }

  applyItem(state);

  if (input.fire && state.player.fireCooldown <= 0) {
    if (state.player.ammo > 0) {
      const dir = DIRECTIONS[state.player.dir];
      spawnBullet(state, state.player.x, state.player.y, dir, "player");
      state.player.ammo -= 1;
      state.player.fireCooldown = PLAYER_FIRE_COOLDOWN;
    } else {
      addLog(state, "弾切れだ。");
      state.player.fireCooldown = PLAYER_FIRE_COOLDOWN;
    }
  }

  let incomingDamage = 0;

  state.enemies.forEach((enemy, index) => {
    enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt);
    enemy.moveCooldown = Math.max(0, enemy.moveCooldown - dt);

    if (enemy.fireCooldown <= 0 && hasLineOfSight(state, enemy, state.player)) {
      const fromCell = posToCell(enemy);
      const toCell = posToCell(state.player);
      const dir = {
        x: Math.sign(toCell.x - fromCell.x),
        y: Math.sign(toCell.y - fromCell.y),
      };
      if (dir.x !== 0 || dir.y !== 0) {
        spawnBullet(state, enemy.x, enemy.y, dir, "enemy");
        enemy.fireCooldown = randomRange(rng, ENEMY_FIRE_COOLDOWN);
      }
    }

    if (enemy.moveCooldown <= 0) {
      const targetCell = posToCell(state.player);
      const currentCell = posToCell(enemy);
      const dxCell = targetCell.x - currentCell.x;
      const dyCell = targetCell.y - currentCell.y;
      const primary = Math.abs(dxCell) >= Math.abs(dyCell)
        ? { x: Math.sign(dxCell), y: 0 }
        : { x: 0, y: Math.sign(dyCell) };
      const secondary = primary.x === 0
        ? { x: Math.sign(dxCell), y: 0 }
        : { x: 0, y: Math.sign(dyCell) };

      const choices = [primary, secondary, randomPick(rng, Object.values(DIRECTIONS))];
      for (const dir of choices) {
        if (dir.x === 0 && dir.y === 0) continue;
        const nextCell = { x: currentCell.x + dir.x, y: currentCell.y + dir.y };
        if (!inBounds(nextCell.x, nextCell.y, state.gridSize)) continue;
        if (!isWalkable(state.tiles[nextCell.y][nextCell.x])) continue;
        const nextPos = cellCenter(nextCell);
        if (enemyOccupied(state.enemies, nextPos, index)) continue;
        if (playerOccupied(state, nextPos)) continue;
        enemy.x = nextPos.x;
        enemy.y = nextPos.y;
        enemy.dir = dir.x > 0 ? "right" : dir.x < 0 ? "left" : dir.y > 0 ? "down" : "up";
        break;
      }
      enemy.moveCooldown = randomRange(rng, ENEMY_MOVE_COOLDOWN);
    }
  });

  const nextBullets = [];
  state.bullets.forEach((bullet) => {
    const nextPos = {
      x: bullet.x + bullet.vx * dt,
      y: bullet.y + bullet.vy * dt,
    };

    if (!inBounds(nextPos.x, nextPos.y, state.gridSize)) {
      return;
    }

    if (!isWalkableAt(state, nextPos)) {
      state.explosions.push({ x: nextPos.x, y: nextPos.y, life: 0.35 });
      return;
    }

    if (bullet.owner === "enemy") {
      const dxp = nextPos.x - state.player.x;
      const dyp = nextPos.y - state.player.y;
      if (dxp * dxp + dyp * dyp <= 0.16) {
        state.explosions.push({ x: nextPos.x, y: nextPos.y, life: 0.35 });
        incomingDamage += 1;
        return;
      }
    } else {
      const hitIndex = state.enemies.findIndex((enemy) => {
        const dxp = nextPos.x - enemy.x;
        const dyp = nextPos.y - enemy.y;
        return dxp * dxp + dyp * dyp <= 0.16;
      });

      if (hitIndex !== -1) {
        const enemy = state.enemies[hitIndex];
        enemy.hp -= 1;
        state.explosions.push({ x: nextPos.x, y: nextPos.y, life: 0.35 });
        if (enemy.hp <= 0) {
          state.enemies.splice(hitIndex, 1);
          state.score += 12;
          addLog(state, "敵戦車を撃破した（+12）。");
        } else {
          addLog(state, "敵に命中。装甲が削れた。");
        }
        return;
      }
    }

    nextBullets.push({ ...bullet, ...nextPos });
  });

  state.bullets = nextBullets;

  if (incomingDamage > 0) {
    damagePlayer(state, incomingDamage);
    addLog(state, `被弾 ${incomingDamage} ダメージ。`);
  }

  state.explosions = state.explosions
    .map((explosion) => ({ ...explosion, life: explosion.life - dt }))
    .filter((explosion) => explosion.life > 0);

  updateVisibility(state);
  return state;
}

export function createSeededRng(seed = 1) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return function rng() {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
