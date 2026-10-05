import { getScores, saveScore } from './leaderboard.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#overlay');
const panel = document.querySelector('#overlay-panel');
const scoreEl = document.querySelector('#score');
const heightEl = document.querySelector('#height');
const livesEl = document.querySelector('#lives');
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
let effects = [];
let camera = WORLD_BOTTOM - 470;
let score = 0;
let lives = 3;
let bestY = WORLD_BOTTOM;
let elapsed = 0;
let lastTime = 0;
let pendingScore = null;
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
  const rowYs = [];
  for (let y = WORLD_BOTTOM - 112; y >= 190; y -= 112) rowYs.push(y);
  rowYs.forEach((y, row) => {
    const shift = row % 2 ? 80 : 0;
    for (let x = -shift; x < W; x += 215) {
      const width = 143 + (row % 3) * 10;
      if (x + width < 20 || x > W - 20) continue;
      platforms.push({ x, y, w: width, h: 22, ground: false });
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
}

function reset() {
  makeWorld();
  player = { x: START_X, y: WORLD_BOTTOM - 39, vx: 0, vy: 0, w: 34, h: 39, facing: 1, grounded: true, invincible: 0, attack: 0, attackCooldown: 0, jumpHeld: false };
  effects = [];
  camera = WORLD_BOTTOM - 470;
  score = 0;
  lives = 3;
  bestY = WORLD_BOTTOM;
  elapsed = 0;
  pendingScore = null;
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(score).padStart(6, '0');
  heightEl.textContent = `${String(Math.floor((WORLD_BOTTOM - bestY) / 10)).padStart(3, '0')} m`;
  livesEl.textContent = '♥ '.repeat(lives).trim() || '—';
}

function showTitle() {
  mode = 'title';
  overlay.classList.remove('hidden');
  panel.innerHTML = `<div class="overlay-icon duck-badge"><span class="duck-head"></span><span class="duck-beak"></span><span class="duck-eye"></span></div><h2>¡A la cima!</h2><p>Ayuda al patito a escalar la montaña helada. Recolecta estrellas y usa el aletazo para espantar guardianes.</p><button type="button" class="primary-button" id="start-button">JUGAR AHORA</button>`;
  document.querySelector('#start-button').addEventListener('click', start);
}

function start() {
  reset();
  mode = 'playing';
  overlay.classList.add('hidden');
  beep(600, 0.15);
}

function finish(won) {
  if (mode !== 'playing') return;
  mode = 'finished';
  if (won) { score += 1000 + Math.max(0, 500 - Math.floor(elapsed * 3)); beep(900, 0.25, 'triangle'); }
  else beep(180, 0.35, 'sawtooth', 0.025);
  updateHud();
  pendingScore = score;
  overlay.classList.remove('hidden');
  panel.innerHTML = `<div class="overlay-icon">${won ? '★' : '❄'}</div><h2>${won ? '¡Llegaste a la cima!' : 'Fin de la aventura'}</h2><p>${won ? '¡El patito conquistó la montaña!' : 'La montaña puede esperar. Tu marca ya merece un lugar.'}</p><div class="result">${score.toLocaleString('es-AR')} puntos</div><p>Escribí hasta 3 letras para el ranking global.</p><form id="score-form"><div class="name-row"><input id="player-name" maxlength="3" minlength="1" pattern="[A-Za-z]{1,3}" autocomplete="off" autocapitalize="characters" aria-label="Iniciales, hasta tres letras" placeholder="ABC" required /><button class="primary-button" type="submit">GUARDAR</button></div><p class="inline-error" id="save-error" role="alert"></p></form><button class="small-button" id="skip-button" type="button">Jugar de nuevo</button>`;
  document.querySelector('#score-form').addEventListener('submit', submitScore);
  document.querySelector('#skip-button').addEventListener('click', start);
  document.querySelector('#player-name').focus();
}

async function submitScore(event) {
  event.preventDefault();
  if (submitting || pendingScore === null) return;
  const input = document.querySelector('#player-name');
  const name = input.value.trim().toUpperCase();
  const error = document.querySelector('#save-error');
  if (!/^[A-Z]{1,3}$/.test(name)) { error.textContent = 'Usá de 1 a 3 letras, sin números.'; return; }
  submitting = true;
  const button = document.querySelector('#score-form button');
  button.disabled = true;
  button.textContent = 'GUARDANDO…';
  error.textContent = '';
  try {
    await saveScore(name, pendingScore);
    pendingScore = null;
    await refreshBoard();
    panel.innerHTML = `<div class="overlay-icon">★</div><h2>¡Marca guardada!</h2><p><strong>${name}</strong> sumó ${score.toLocaleString('es-AR')} puntos al ranking global.</p><button type="button" class="primary-button" id="again-button">JUGAR DE NUEVO</button>`;
    document.querySelector('#again-button').addEventListener('click', start);
    beep(760, 0.16);
  } catch (e) {
    error.textContent = `${e.message} Probá otra vez.`;
    button.disabled = false;
    button.textContent = 'GUARDAR';
  } finally { submitting = false; }
}

async function refreshBoard() {
  try {
    const rows = await getScores();
    boardEl.replaceChildren();
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'board-empty';
      li.textContent = '¡Todavía no hay marcas! Sé el primero.';
      boardEl.append(li);
    }
    rows.forEach((row, i) => {
      const li = document.createElement('li');
      const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = String(i + 1).padStart(2, '0');
      const name = document.createElement('span'); name.textContent = row.name;
      const value = document.createElement('span'); value.className = 'score-value'; value.textContent = Number(row.score).toLocaleString('es-AR');
      li.append(rank, name, value); boardEl.append(li);
    });
    boardNote.textContent = 'Las marcas se comparten entre todos los jugadores.';
  } catch (e) {
    boardEl.innerHTML = '<li class="board-empty">El ranking todavía no está disponible.</li>';
    boardNote.textContent = 'Ejecutá supabase.sql en tu proyecto para activarlo.';
  }
}

function loseLife() {
  lives--;
  beep(170, 0.25, 'sawtooth', 0.025);
  if (lives <= 0) { finish(false); return; }
  player.x = START_X;
  player.y = WORLD_BOTTOM - player.h;
  player.vx = 0;
  player.vy = 0;
  player.invincible = 2.5;
  camera = WORLD_BOTTOM - 470;
  updateHud();
}

function sparkle(x, y, color = '#fff4ad', count = 9) {
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2;
    effects.push({ x, y, vx: Math.cos(angle) * (70 + random() * 110), vy: Math.sin(angle) * (70 + random() * 110), life: 0.55, color });
  }
}

function update(dt) {
  elapsed += dt;
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
  player.invincible = Math.max(0, player.invincible - dt);
  if (attack && player.attackCooldown === 0) {
    player.attack = 0.23;
    player.attackCooldown = 0.48;
    beep(290, 0.08, 'triangle');
  }
  const previousBottom = player.y + player.h;
  player.vy = Math.min(850, player.vy + 1650 * dt);
  player.x = clamp(player.x + player.vx * dt, 0, W - player.w);
  player.y += player.vy * dt;
  player.grounded = false;
  if (player.vy >= 0) {
    for (const p of platforms) {
      if (previousBottom <= p.y + 9 && player.y + player.h >= p.y && player.x + player.w > p.x + 5 && player.x < p.x + p.w - 5) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.grounded = true;
      }
    }
  }
  const centerX = player.x + player.w / 2;
  const centerY = player.y + player.h / 2;
  for (const star of stars) {
    if (!star.taken && Math.hypot(centerX - star.x, centerY - star.y) < 31) {
      star.taken = true; score += 150; sparkle(star.x, star.y); beep(840, 0.16, 'sine'); updateHud();
    }
  }
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.x += enemy.direction * 70 * dt;
    if (enemy.x < enemy.min || enemy.x > enemy.max) enemy.direction *= -1;
    const distance = Math.hypot(centerX - enemy.x, centerY - enemy.y);
    if (player.attack > 0 && distance < 70) {
      enemy.alive = false; score += 100; sparkle(enemy.x, enemy.y, '#b6f8ff'); beep(710, 0.13, 'square', 0.02); updateHud();
    } else if (distance < 31 && player.invincible === 0) {
      player.invincible = 1.4;
      player.vy = -340;
      player.vx = centerX < enemy.x ? -230 : 230;
      lives--;
      beep(160, 0.2, 'sawtooth', 0.025);
      if (lives <= 0) { finish(false); return; }
      updateHud();
    }
  }
  if (player.y < bestY - 10) {
    const oldBand = Math.floor((WORLD_BOTTOM - bestY) / 100);
    bestY = player.y;
    const newBand = Math.floor((WORLD_BOTTOM - bestY) / 100);
    if (newBand > oldBand) score += (newBand - oldBand) * 20;
    updateHud();
  }
  const desiredCamera = clamp(player.y - 270, 0, WORLD_BOTTOM - 470);
  camera += (desiredCamera - camera) * Math.min(1, dt * 4);
  if (player.y > camera + H + 50 || player.y > WORLD_BOTTOM + 80) { loseLife(); return; }
  if (player.y < SUMMIT && player.x + player.w > 360 && player.x < 540) { finish(true); return; }
  effects = effects.filter((effect) => effect.life > 0);
  for (const effect of effects) { effect.x += effect.vx * dt; effect.y += effect.vy * dt; effect.vy += 180 * dt; effect.life -= dt; }
}

function roundedRect(x, y, w, h, radius, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}

function drawBackground(time) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#23557f'); sky.addColorStop(0.56, '#5998c2'); sky.addColorStop(1, '#b2dae6');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff5c9'; ctx.beginPath(); ctx.arc(747, 99, 39, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff20'; ctx.beginPath(); ctx.arc(747, 99, 58, 0, Math.PI * 2); ctx.fill();
  const offset = camera * 0.07;
  ctx.fillStyle = '#a2cee0';
  ctx.beginPath(); ctx.moveTo(0, 440 + offset % 80); ctx.lineTo(135, 232 + offset % 80); ctx.lineTo(275, 450 + offset % 80); ctx.lineTo(446, 197 + offset % 80); ctx.lineTo(650, 458 + offset % 80); ctx.lineTo(795, 255 + offset % 80); ctx.lineTo(900, 423 + offset % 80); ctx.lineTo(900, 600); ctx.lineTo(0, 600); ctx.fill();
  ctx.fillStyle = '#77b4d0';
  ctx.beginPath(); ctx.moveTo(0, 495 + offset % 110); ctx.lineTo(165, 334 + offset % 110); ctx.lineTo(342, 520 + offset % 110); ctx.lineTo(570, 288 + offset % 110); ctx.lineTo(770, 518 + offset % 110); ctx.lineTo(900, 390 + offset % 110); ctx.lineTo(900, 600); ctx.lineTo(0, 600); ctx.fill();
  const snowRand = rand(97531);
  ctx.fillStyle = '#ffffffa0';
  for (let i = 0; i < 70; i++) {
    const x = snowRand() * W;
    const y = (snowRand() * H + time * (10 + (i % 4) * 6)) % H;
    const r = 1 + (i % 3) * 0.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlatform(p) {
  const y = p.y - camera;
  if (y < -40 || y > H + 20) return;
  if (p.ground) {
    ctx.fillStyle = '#e6f8fa'; ctx.fillRect(0, y, W, 15);
    ctx.fillStyle = '#78a9c6'; ctx.fillRect(0, y + 15, W, 45);
    return;
  }
  roundedRect(p.x, y + 7, p.w, 18, 5, '#3d7ca4');
  roundedRect(p.x, y + 2, p.w, 12, 6, '#b6e5ef');
  roundedRect(p.x + 3, y, p.w - 6, 7, 5, '#f1ffff');
  ctx.fillStyle = '#72bbd3';
  for (let x = p.x + 25; x < p.x + p.w - 10; x += 52) ctx.fillRect(x, y + 13, 2, 9);
  if (p.summit) {
    ctx.fillStyle = '#71596e'; ctx.fillRect(p.x + p.w / 2, y - 95, 5, 95);
    ctx.fillStyle = '#ffdb78'; ctx.beginPath(); ctx.moveTo(p.x + p.w / 2 + 5, y - 94); ctx.lineTo(p.x + p.w / 2 + 68, y - 78); ctx.lineTo(p.x + p.w / 2 + 5, y - 60); ctx.fill();
  }
}

function drawStar(star, time) {
  if (star.taken) return;
  const y = star.y - camera + Math.sin(time * 3 + star.phase) * 4;
  if (y < -30 || y > H + 30) return;
  ctx.save(); ctx.translate(star.x, y); ctx.rotate(Math.sin(time * 2 + star.phase) * 0.13);
  ctx.shadowColor = '#ffed9e'; ctx.shadowBlur = 15; ctx.fillStyle = '#ffe27c';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? 8 : 18;
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const x = Math.cos(angle) * radius, yy = Math.sin(angle) * radius;
    if (i) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawEnemy(enemy, time) {
  if (!enemy.alive) return;
  const y = enemy.y - camera + Math.sin(time * 4 + enemy.phase) * 3;
  if (y < -35 || y > H + 35) return;
  ctx.save(); ctx.translate(enemy.x, y);
  ctx.fillStyle = '#5b5a90'; ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7774a6'; ctx.beginPath(); ctx.arc(-13, -14, 8, 0, Math.PI * 2); ctx.arc(13, -14, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e7eff7'; ctx.beginPath(); ctx.arc(-7, -3, 6, 0, Math.PI * 2); ctx.arc(7, -3, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#253454'; ctx.beginPath(); ctx.arc(-5 + enemy.direction, -3, 2, 0, Math.PI * 2); ctx.arc(9 + enemy.direction, -3, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffc377'; ctx.beginPath(); ctx.moveTo(-4, 5); ctx.lineTo(4, 5); ctx.lineTo(0, 11); ctx.fill();
  ctx.restore();
}

function drawDuck(time) {
  if (!player || (player.invincible > 0 && Math.floor(time * 12) % 2)) return;
  const x = player.x + player.w / 2;
  const y = player.y - camera + player.h / 2 + (player.grounded ? Math.sin(time * 10) * 1.5 : 0);
  ctx.save(); ctx.translate(x, y); ctx.scale(player.facing, 1);
  ctx.fillStyle = '#df9b61'; ctx.beginPath(); ctx.ellipse(-8, 22, 6, 3, 0, 0, 7); ctx.ellipse(10, 22, 6, 3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#f3c967'; ctx.beginPath(); ctx.ellipse(0, 4, 18, 17, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff0ad'; ctx.beginPath(); ctx.ellipse(-8, 6, 10, 8, -0.3, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe088'; ctx.beginPath(); ctx.arc(1, -13, 16, 0, 7); ctx.fill();
  ctx.fillStyle = '#fca65a'; ctx.beginPath(); ctx.moveTo(11, -10); ctx.lineTo(27, -6); ctx.lineTo(12, -2); ctx.fill();
  ctx.fillStyle = '#2d375a'; ctx.beginPath(); ctx.arc(7, -17, 2.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7.5, -17.7, 0.7, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff91a4'; ctx.beginPath(); ctx.arc(10, -10, 3, 0, 7); ctx.fill();
  ctx.fillStyle = '#f4d371'; ctx.beginPath(); ctx.ellipse(-14, 1, 9, 6, -0.25, 0, 7); ctx.fill();
  if (player.attack > 0) {
    ctx.strokeStyle = '#fff9c2'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 39, -1.15, 1.15); ctx.stroke();
    ctx.strokeStyle = '#ffffffa0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 48, -0.9, 0.8); ctx.stroke();
  }
  ctx.restore();
}

function draw(time) {
  drawBackground(time);
  for (const platform of platforms) drawPlatform(platform);
  for (const star of stars) drawStar(star, time);
  for (const enemy of enemies) drawEnemy(enemy, time);
  drawDuck(time);
  for (const effect of effects) {
    ctx.globalAlpha = clamp(effect.life * 2, 0, 1);
    ctx.fillStyle = effect.color;
    ctx.beginPath(); ctx.arc(effect.x, effect.y - camera, 3, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (mode === 'playing') {
    roundedRect(18, 17, 154, 29, 8, '#173c6488');
    ctx.fillStyle = '#eafaff'; ctx.font = 'bold 15px Outfit, sans-serif';
    ctx.fillText('↑  LLEGÁ A LA CIMA', 28, 37);
  }
}

function frame(timestamp) {
  const dt = Math.min(0.033, (timestamp - (lastTime || timestamp)) / 1000);
  lastTime = timestamp;
  if (mode === 'playing') update(dt);
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
