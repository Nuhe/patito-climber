import { formatTime, getTimes, saveTime } from './leaderboard.js';

const canvas = document.querySelector('#game');
const screen = canvas.getContext('2d');
const pixelCanvas = document.createElement('canvas');
pixelCanvas.width = canvas.width / 2;
pixelCanvas.height = canvas.height / 2;
const ctx = pixelCanvas.getContext('2d');
screen.imageSmoothingEnabled = false;
const overlay = document.querySelector('#overlay');
const panel = document.querySelector('#overlay-panel');
const timerEl = document.querySelector('#timer');
const heightEl = document.querySelector('#height');
const starsEl = document.querySelector('#stars');
const boardEl = document.querySelector('#leaderboard');
const boardNote = document.querySelector('#board-note');
const soundButton = document.querySelector('#sound-button');
const W = canvas.width;
const H = canvas.height;
const WORLD_BOTTOM = 2670;
const SUMMIT = 120;
const START_X = 450;
const keys = new Set();
let audioContext;
let soundOn = true;
let mode = 'title';
let player;
let platforms = [];
let stars = [];
let enemies = [];
let raptors = [];
let effects = [];
let camera = WORLD_BOTTOM - 470;
let starsCollected = 0;
let bestY = WORLD_BOTTOM;
let elapsed = 0;
let runStartedAt = 0;
let lastTime = 0;
let pendingTime = null;
let submitting = false;

const rand = (seed) => {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};
const random = rand(20261005);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function beep(frequency = 440, duration = 0.1, type = 'sine', gain = 0.04) {
  if (!soundOn) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.7), audioContext.currentTime + duration);
    volume.gain.setValueAtTime(gain, audioContext.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(volume).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is optional. */ }
}

soundButton.addEventListener('click', () => {
  soundOn = !soundOn;
  soundButton.textContent = `♫ Sonido: ${soundOn ? 'sí' : 'no'}`;
});

function makeWorld() {
  platforms = [{ x: 0, y: WORLD_BOTTOM, w: W, h: 40, ground: true }];
  stars = [];
  enemies = [];
  raptors = [];
  const rowYs = [];
  for (let y = WORLD_BOTTOM - 112; y >= 190; y -= 112) rowYs.push(y);
  rowYs.forEach((y, row) => {
    const shift = row % 2 ? 80 : 0;
    for (let x = -shift; x < W; x += 215) {
      const width = 143 + (row % 3) * 10;
      if (x + width < 20 || x > W - 20) continue;
      const column = Math.floor((x + shift) / 215);
      const fragile = row > 0 && (row + column * 2) % 5 === 0;
      platforms.push({ x, y, w: width, h: 22, ground: false, fragile, crackTime: null, broken: false });
      if ((row + Math.floor((x + shift) / 215)) % 3 === 0 && x > 0 && x + width < W) {
        stars.push({ x: x + width / 2, y: y - 46, taken: false, phase: random() * 6.28 });
      }
    }
    if (row > 1 && row % 3 === 1) {
      const candidates = platforms.filter((p) => p.y === y && p.x > 40 && p.x + p.w < W - 20);
      const platform = candidates[(row * 7) % candidates.length];
      if (platform) enemies.push({ x: platform.x + platform.w / 2, y: y - 21, min: platform.x + 20, max: platform.x + platform.w - 20, direction: row % 2 ? 1 : -1, alive: true, phase: random() * 6 });
    }
  });
  platforms.push({ x: 345, y: 150, w: 210, h: 25, summit: true });
  for (const [index, y] of [2470, 2030, 1590, 1150, 710, 360].entries()) {
    raptors.push({
      x: index % 2 ? W + 50 : -50,
      y,
      baseY: y,
      speed: (index % 2 ? -1 : 1) * (118 + index * 8),
      phase: index * 1.7,
      alive: true,
    });
  }
}

function reset() {
  makeWorld();
  player = { x: START_X, y: WORLD_BOTTOM - 39, vx: 0, vy: 0, w: 34, h: 39, facing: 1, grounded: true, attack: 0, attackCooldown: 0, jumpHeld: false };
  effects = [];
  camera = WORLD_BOTTOM - 470;
  starsCollected = 0;
  bestY = WORLD_BOTTOM;
  elapsed = 0;
  pendingTime = null;
  updateHud();
}

function updateHud() {
  timerEl.textContent = formatTime(Math.round(elapsed * 1000));
  heightEl.textContent = `${String(Math.floor((WORLD_BOTTOM - bestY) / 10)).padStart(3, '0')} m`;
  starsEl.textContent = `★ ${String(starsCollected).padStart(2, '0')}`;
}

function showTitle() {
  mode = 'title';
  overlay.classList.remove('hidden');
  panel.innerHTML = `<div class="overlay-icon duck-badge"><span class="duck-head"></span><span class="duck-beak"></span><span class="duck-eye"></span></div><h2>¡A la cima!</h2><p>Llegá lo más rápido posible. El hielo agrietado se rompe; perderás si tocás el fondo de la pantalla o un enemigo.</p><button type="button" class="primary-button" id="start-button">JUGAR AHORA</button>`;
  document.querySelector('#start-button').addEventListener('click', start);
}

function start() {
  if (submitting) return;
  reset();
  runStartedAt = performance.now();
  mode = 'playing';
  overlay.classList.add('hidden');
  beep(600, 0.15);
}

function finish(won, reason = 'Tocaste el borde inferior de la pantalla.') {
  if (mode !== 'playing') return;
  mode = 'finished';
  if (won) beep(900, 0.25, 'triangle');
  else beep(180, 0.35, 'sawtooth', 0.025);
  updateHud();
  pendingTime = won ? Math.max(1, Math.round(elapsed * 1000)) : null;
  overlay.classList.remove('hidden');
  if (!won) {
    panel.innerHTML = `<div class="overlay-icon">❄</div><h2>Fin del intento</h2><p>${reason} Tu tiempo fue ${formatTime(Math.round(elapsed * 1000))}. Solo las partidas completadas entran al ranking.</p><button class="primary-button" id="again-button" type="button">REINTENTAR</button>`;
    document.querySelector('#again-button').addEventListener('click', start);
    return;
  }
  panel.innerHTML = `<div class="overlay-icon">★</div><h2>¡Llegaste a la cima!</h2><p>Terminaste la montaña en:</p><div class="result">${formatTime(pendingTime)}</div><p>Escribí hasta 3 letras para el ranking de tiempos.</p><form id="score-form"><div class="name-row"><input id="player-name" maxlength="3" minlength="1" pattern="[A-Za-z]{1,3}" autocomplete="off" autocapitalize="characters" aria-label="Iniciales, hasta tres letras" placeholder="ABC" required /><button class="primary-button" type="submit">GUARDAR</button></div><p class="inline-error" id="save-error" role="alert"></p></form><button class="small-button" id="skip-button" type="button">Jugar de nuevo</button>`;
  document.querySelector('#score-form').addEventListener('submit', submitTime);
  document.querySelector('#skip-button').addEventListener('click', start);
  document.querySelector('#player-name').focus();
}

async function submitTime(event) {
  event.preventDefault();
  if (submitting || pendingTime === null) return;
  const input = document.querySelector('#player-name');
  const name = input.value.trim().toUpperCase();
  const error = document.querySelector('#save-error');
  if (!/^[A-Z]{1,3}$/.test(name)) { error.textContent = 'Usá de 1 a 3 letras, sin números.'; return; }
  submitting = true;
  const button = document.querySelector('#score-form button');
  const skipButton = document.querySelector('#skip-button');
  button.disabled = true;
  skipButton.disabled = true;
  button.textContent = 'GUARDANDO…';
  error.textContent = '';
  try {
    const savedTime = pendingTime;
    await saveTime(name, savedTime);
    pendingTime = null;
    await refreshBoard();
    panel.innerHTML = `<div class="overlay-icon">★</div><h2>¡Tiempo guardado!</h2><p><strong>${name}</strong> completó el nivel en ${formatTime(savedTime)}.</p><button type="button" class="primary-button" id="again-button">JUGAR DE NUEVO</button>`;
    document.querySelector('#again-button').addEventListener('click', start);
    beep(760, 0.16);
  } catch (e) {
    error.textContent = `${e.message} Probá otra vez.`;
    button.disabled = false;
    skipButton.disabled = false;
    button.textContent = 'GUARDAR';
  } finally { submitting = false; }
}

async function refreshBoard() {
  try {
    const rows = await getTimes();
    boardEl.replaceChildren();
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'board-empty';
      li.textContent = '¡Todavía no hay tiempos! Sé el primero.';
      boardEl.append(li);
    }
    rows.forEach((row, i) => {
      const li = document.createElement('li');
      const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = String(i + 1).padStart(2, '0');
      const name = document.createElement('span'); name.textContent = row.name;
      const value = document.createElement('span'); value.className = 'score-value'; value.textContent = formatTime(row.time_ms);
      li.append(rank, name, value); boardEl.append(li);
    });
    boardNote.textContent = 'Gana quien complete la montaña en menos tiempo.';
  } catch (e) {
    boardEl.innerHTML = '<li class="board-empty">El ranking de tiempos todavía no está disponible.</li>';
    boardNote.textContent = 'Ejecutá supabase_tiempos.sql en Supabase para activarlo.';
  }
}

function sparkle(x, y, color = '#fff4ad', count = 9) {
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2;
    effects.push({ x, y, vx: Math.cos(angle) * (70 + random() * 110), vy: Math.sin(angle) * (70 + random() * 110), life: 0.55, color });
  }
}

function update(dt, timestamp) {
  elapsed = Math.max(0, (timestamp - runStartedAt) / 1000);
  timerEl.textContent = formatTime(Math.round(elapsed * 1000));
  if (elapsed >= 3600) { finish(false, 'Se terminó el tiempo límite de una hora.'); return; }
  for (const platform of platforms) {
    if (!platform.fragile || platform.crackTime === null || platform.broken) continue;
    platform.crackTime -= dt;
    if (platform.crackTime <= 0) {
      platform.broken = true;
      sparkle(platform.x + platform.w / 2, platform.y + 8, '#bde9e7', 12);
      beep(125, 0.16, 'square', 0.025);
    }
  }
  const left = keys.has('left');
  const right = keys.has('right');
  const jump = keys.has('jump');
  const attack = keys.has('attack');
  player.vx = (Number(right) - Number(left)) * 290;
  if (player.vx) player.facing = Math.sign(player.vx);
  if (jump && !player.jumpHeld && player.grounded) {
    player.vy = -680;
    player.grounded = false;
    beep(480, 0.09, 'triangle');
  }
  player.jumpHeld = jump;
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.attack = Math.max(0, player.attack - dt);
  if (attack && player.attackCooldown === 0) {
    player.attack = 0.32;
    player.attackCooldown = 0.55;
    beep(290, 0.08, 'triangle');
  }
  const previousBottom = player.y + player.h;
  player.vy = Math.min(850, player.vy + 1650 * dt);
  player.x = clamp(player.x + player.vx * dt, 0, W - player.w);
  player.y += player.vy * dt;
  player.grounded = false;
  if (player.vy >= 0) {
    for (const p of platforms) {
      if (p.broken) continue;
      if (previousBottom <= p.y + 9 && player.y + player.h >= p.y && player.x + player.w > p.x + 5 && player.x < p.x + p.w - 5) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
        if (p.fragile && p.crackTime === null) p.crackTime = 0.72;
        break;
      }
    }
  }
  const centerX = player.x + player.w / 2;
  const centerY = player.y + player.h / 2;
  for (const star of stars) {
    if (!star.taken && Math.hypot(centerX - star.x, centerY - star.y) < 31) {
      star.taken = true; starsCollected++; sparkle(star.x, star.y); beep(840, 0.16, 'sine'); updateHud();
    }
  }
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.x += enemy.direction * 70 * dt;
    if (enemy.x < enemy.min || enemy.x > enemy.max) enemy.direction *= -1;
  }
  for (const raptor of raptors) {
    if (!raptor.alive) continue;
    raptor.x += raptor.speed * dt;
    if (raptor.speed > 0 && raptor.x > W + 55) raptor.x = -55;
    if (raptor.speed < 0 && raptor.x < -55) raptor.x = W + 55;
    raptor.y = raptor.baseY + Math.sin(elapsed * 1.5 + raptor.phase) * 59;
  }
  for (const enemy of [...enemies, ...raptors]) {
    if (!enemy.alive) continue;
    const raptor = 'baseY' in enemy;
    const distance = Math.hypot(centerX - enemy.x, centerY - enemy.y);
    if (player.attack > 0 && distance < (raptor ? 75 : 70)) {
      enemy.alive = false;
      sparkle(enemy.x, enemy.y, raptor ? '#ffdb86' : '#b6f8ff', 12);
      beep(raptor ? 520 : 710, 0.13, 'square', 0.02);
    } else if (distance < (raptor ? 34 : 31)) {
      finish(false, raptor ? 'Te alcanzó un ave rapaz.' : 'Te alcanzó un búho.');
      return;
    }
  }
  if (player.y < bestY - 10) {
    bestY = player.y;
    updateHud();
  }
  const desiredCamera = clamp(player.y - 270, 0, WORLD_BOTTOM - 470);
  camera = Math.min(camera, camera + (desiredCamera - camera) * Math.min(1, dt * 4));
  if (player.y + player.h >= camera + H) { finish(false); return; }
  if (player.y < SUMMIT && player.x + player.w > 360 && player.x < 540) { finish(true); return; }
  effects = effects.filter((effect) => effect.life > 0);
  for (const effect of effects) { effect.x += effect.vx * dt; effect.y += effect.vy * dt; effect.vy += 180 * dt; effect.life -= dt; }
}

function block(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function drawBackground(time) {
  block(0, 0, W, H, '#376f98');
  block(0, 166, W, 190, '#4e8db1');
  block(0, 356, W, H - 356, '#6aa7bf');
  block(698, 52, 94, 94, '#f4d888');
  block(710, 40, 70, 118, '#f4d888');
  block(686, 64, 118, 70, '#f4d888');
  block(716, 58, 60, 80, '#ffe7a1');
  const offset = Math.round(camera * 0.055) % 66;
  for (let x = -40; x < W + 70; x += 16) {
    const farPeak = Math.min(Math.abs(x - 160), Math.abs(x - 502), Math.abs(x - 838));
    const nearPeak = Math.min(Math.abs(x - 58), Math.abs(x - 358), Math.abs(x - 686));
    block(x, 335 + farPeak * 0.72 + offset, 16, H, '#94c5d4');
    block(x, 396 + nearPeak * 0.62 + offset, 16, H, '#6aabc0');
  }
  for (const [x, y] of [[72, 126], [340, 78], [588, 196]]) {
    const cloudY = y + Math.round(camera * 0.025) % 40;
    block(x, cloudY, 74, 10, '#d3ebdf');
    block(x + 16, cloudY - 12, 46, 12, '#d3ebdf');
    block(x + 26, cloudY - 20, 28, 8, '#d3ebdf');
  }
  const snowRand = rand(97531);
  for (let i = 0; i < 65; i++) {
    const x = Math.floor(snowRand() * W / 4) * 4;
    const y = Math.floor(((snowRand() * H + time * (8 + i % 5 * 5)) % H) / 4) * 4;
    block(x, y, i % 4 ? 3 : 5, i % 4 ? 3 : 5, '#d8f0e5');
  }
}

function drawPlatform(p) {
  if (p.broken) return;
  const y = p.y - camera;
  if (y < -40 || y > H + 20) return;
  if (p.ground) {
    block(0, y, W, 10, '#f1f3dc');
    block(0, y + 10, W, 10, '#aed5d2');
    block(0, y + 20, W, 48, '#477fa4');
    for (let x = 20; x < W; x += 74) block(x, y + 26, 27, 5, '#69a9be');
    return;
  }
  const warning = p.fragile && p.crackTime !== null && p.crackTime < 0.36;
  block(p.x, y + 6, p.w, 19, p.fragile ? '#315e7e' : '#275578');
  block(p.x + 4, y + 9, p.w - 8, 12, p.fragile ? '#66a9b8' : '#438aa9');
  block(p.x, y, p.w, 9, warning ? '#ffd38a' : '#d8e9d8');
  block(p.x + 7, y, p.w - 14, 4, warning ? '#fff0b0' : '#fff4df');
  for (let x = p.x + 27; x < p.x + p.w - 12; x += 44) block(x, y + 14, 5, 7, '#8ac5ca');
  if (p.fragile) {
    const crack = warning ? '#b45d63' : '#336f8e';
    block(p.x + p.w * 0.34, y + 2, 5, 8, crack);
    block(p.x + p.w * 0.34 + 5, y + 9, 9, 4, crack);
    block(p.x + p.w * 0.34 + 10, y + 13, 5, 7, crack);
    block(p.x + p.w * 0.7, y + 5, 5, 10, crack);
    block(p.x + p.w * 0.7 - 7, y + 12, 9, 4, crack);
  }
  if (p.summit) {
    block(p.x + p.w / 2, y - 91, 7, 91, '#3e5471');
    block(p.x + p.w / 2 + 7, y - 91, 54, 11, '#f49b65');
    block(p.x + p.w / 2 + 7, y - 80, 42, 10, '#f6b56f');
    block(p.x + p.w / 2 + 7, y - 70, 28, 10, '#f4d481');
  }
}

function drawStar(star, time) {
  if (star.taken) return;
  const x = Math.round(star.x);
  const y = Math.round(star.y - camera + Math.sin(time * 3 + star.phase) * 4);
  if (y < -30 || y > H + 30) return;
  block(x - 4, y - 17, 8, 34, '#f5cf78');
  block(x - 17, y - 4, 34, 8, '#f5cf78');
  block(x - 11, y - 11, 22, 22, '#ffe69a');
  block(x - 4, y - 4, 8, 8, '#fff5ca');
}

function drawEnemy(enemy, time) {
  if (!enemy.alive) return;
  const y = enemy.y - camera + Math.round(Math.sin(time * 4 + enemy.phase) * 3);
  if (y < -35 || y > H + 35) return;
  const x = Math.round(enemy.x);
  block(x - 16, y - 15, 32, 31, '#40466f');
  block(x - 13, y - 20, 10, 9, '#40466f');
  block(x + 3, y - 20, 10, 9, '#40466f');
  block(x - 12, y - 9, 9, 9, '#e8eddc');
  block(x + 3, y - 9, 9, 9, '#e8eddc');
  block(x - 7 + enemy.direction * 2, y - 5, 4, 4, '#1c294e');
  block(x + 7 + enemy.direction * 2, y - 5, 4, 4, '#1c294e');
  block(x - 4, y + 3, 8, 6, '#ecaa69');
  block(x - 12, y + 16, 5, 5, '#ecaa69');
  block(x + 7, y + 16, 5, 5, '#ecaa69');
}

function drawRaptor(raptor, time) {
  if (!raptor.alive) return;
  const y = raptor.y - camera;
  if (y < -55 || y > H + 55) return;
  ctx.save();
  ctx.translate(Math.round(raptor.x), Math.round(y));
  ctx.scale(Math.sign(raptor.speed), 1);
  const wingUp = Math.sin(time * 12 + raptor.phase) > 0;
  block(-23, -7, 42, 18, '#674d55');
  block(-18, -4, 28, 11, '#a87962');
  block(12, -12, 17, 13, '#674d55');
  block(24, -6, 15, 5, '#f4bd6a');
  block(17, -8, 5, 5, '#fff5d4');
  block(19, -6, 3, 3, '#172844');
  block(-32, -4, 12, 7, '#674d55');
  block(-40, 1, 13, 5, '#674d55');
  if (wingUp) {
    block(-13, -25, 21, 19, '#4c3e58');
    block(-18, -36, 11, 15, '#4c3e58');
    block(-23, -29, 8, 18, '#8a645d');
    block(-8, -20, 12, 6, '#bc8b69');
  } else {
    block(-14, 5, 24, 14, '#4c3e58');
    block(-20, 15, 13, 13, '#4c3e58');
    block(-7, 14, 14, 7, '#bc8b69');
  }
  block(-8, 11, 5, 10, '#e1ad6f');
  block(5, 11, 5, 10, '#e1ad6f');
  ctx.restore();
}

function drawDuck(time) {
  if (!player) return;
  const x = player.x + player.w / 2;
  const y = player.y - camera + player.h / 2 + (player.grounded && player.vx ? Math.round(Math.sin(time * 12) * 2) : 0);
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(player.facing, 1);
  block(-12, 17, 9, 6, '#e8945b');
  block(5, 17, 9, 6, '#e8945b');
  block(-16, -4, 32, 22, '#e5a65c');
  block(-12, -7, 27, 23, '#ffe18a');
  block(-13, -26, 27, 25, '#ffe18a');
  block(-10, -30, 21, 5, '#ffe18a');
  block(12, -17, 16, 7, '#ef9c57');
  block(12, -10, 12, 4, '#d88351');
  block(6, -21, 5, 5, '#20334c');
  block(8, -22, 2, 2, '#fff8dd');
  block(9, -9, 5, 4, '#f6aa98');
  const attackFrame = player.attack > 0 ? Math.min(2, Math.floor((1 - player.attack / 0.32) * 3)) : -1;
  if (attackFrame === 0) {
    block(-24, -17, 16, 7, '#ffe18a');
    block(-28, -28, 10, 17, '#fff0aa');
    block(-23, -33, 6, 10, '#fff0aa');
  } else if (attackFrame === 1) {
    block(-15, -4, 31, 11, '#f9c675');
    block(13, -8, 25, 13, '#ffe799');
    block(34, -4, 12, 5, '#fff4c0');
    block(48, -17, 6, 6, '#fff4c0');
    block(53, -7, 9, 7, '#fff4c0');
    block(45, 9, 7, 6, '#fff4c0');
  } else if (attackFrame === 2) {
    block(-14, 2, 29, 10, '#f9c675');
    block(12, 8, 22, 9, '#ffe799');
    block(35, 12, 8, 5, '#fff4c0');
  } else {
    block(-19, 0, 17, 10, '#f5bf73');
    block(-16, 2, 11, 5, '#fff0aa');
  }
  ctx.restore();
}

function draw(time) {
  ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
  drawBackground(time);
  for (const platform of platforms) drawPlatform(platform);
  for (const star of stars) drawStar(star, time);
  for (const enemy of enemies) drawEnemy(enemy, time);
  for (const raptor of raptors) drawRaptor(raptor, time);
  drawDuck(time);
  for (const effect of effects) {
    ctx.globalAlpha = clamp(effect.life * 2, 0, 1);
    block(effect.x, effect.y - camera, 6, 6, effect.color);
  }
  ctx.globalAlpha = 1;
  if (mode === 'playing') {
    block(16, 16, 191, 29, '#183c60');
    block(19, 19, 185, 23, '#285777');
    ctx.fillStyle = '#fff2ce'; ctx.font = 'bold 14px monospace';
    ctx.fillText('^ LLEGA A LA CIMA', 27, 36);
  }
  screen.drawImage(pixelCanvas, 0, 0, W, H);
}

function frame(timestamp) {
  const dt = Math.min(0.033, (timestamp - (lastTime || timestamp)) / 1000);
  lastTime = timestamp;
  if (mode === 'playing') update(dt, timestamp);
  draw(timestamp / 1000);
  requestAnimationFrame(frame);
}

function controlFromKey(key) {
  const k = key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') return 'left';
  if (k === 'arrowright' || k === 'd') return 'right';
  if (k === 'arrowup' || k === 'w' || k === ' ') return 'jump';
  if (k === 'x' || k === 'j') return 'attack';
  return null;
}
window.addEventListener('keydown', (event) => {
  if (document.activeElement?.tagName === 'INPUT') return;
  const control = controlFromKey(event.key);
  if (control) { event.preventDefault(); keys.add(control); }
  if (event.key === 'Enter' && mode === 'title') start();
});
window.addEventListener('keyup', (event) => {
  const control = controlFromKey(event.key);
  if (control) keys.delete(control);
});
window.addEventListener('blur', () => keys.clear());
document.querySelectorAll('[data-control]').forEach((button) => {
  const control = button.dataset.control;
  const release = (event) => { event.preventDefault(); keys.delete(control); button.classList.remove('pressed'); };
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); keys.add(control); button.classList.add('pressed'); });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
});

reset();
showTitle();
refreshBoard();
requestAnimationFrame(frame);
