// ─── Canvas ───────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const container = document.getElementById('gameContainer');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ─── 定数 ─────────────────────────────────────────────────────────────────────
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const PLAYER_SPEED = 4;
const BULLET_SPEED = 8;
const ENEMY_SPEED = 1.5;
const FLOOR_H = 48;
const COLORS = {
  bg: '#0a0a1a',
  floor: '#1a3a5c',
  floorTop: '#2a5f9e',
  player: '#00ff88',
  playerDark: '#00aa55',
  bullet: '#ffff00',
  enemy: '#ff4444',
  enemyDark: '#aa2222',
  ui: '#ffffff',
  score: '#ffff00',
  star: '#ffffff'
};

// ─── 状態管理 ─────────────────────────────────────────────────────────────────
const GameState = {
  START: 'start',
  PLAYING: 'playing',
  GAMEOVER: 'gameover'
};
let state = GameState.START;

// ─── ゲームオブジェクト ───────────────────────────────────────────────────────
let player, bullets, enemies, stars, score, lives, frame, enemyTimer;

function initGame() {
  player = {
    x: 80,
    y: 0,
    w: 24,
    h: 32,
    vx: 0,
    vy: 0,
    onGround: false,
    dir: 1,
    shootCooldown: 0,
    invincible: 0
  };
  player.y = canvas.height - FLOOR_H - player.h;

  bullets = [];
  enemies = [];
  stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * (canvas.height * 0.7),
    r: Math.random() * 1.5 + 0.5,
    blink: Math.random() * Math.PI * 2
  }));
  score = 0;
  lives = 3;
  frame = 0;
  enemyTimer = 0;
}

// ─── 入力 ─────────────────────────────────────────────────────────────────────
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const keys = {};

document.addEventListener('keydown', e => { keys[e.code] = true; });
document.addEventListener('keyup', e => { keys[e.code] = false; });

// モバイルボタン
function bindBtn(id, code) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('touchstart', e => { e.preventDefault(); keys[code] = true; }, { passive: false });
  btn.addEventListener('touchend', e => { e.preventDefault(); keys[code] = false; }, { passive: false });
  btn.addEventListener('mousedown', () => keys[code] = true);
  btn.addEventListener('mouseup', () => keys[code] = false);
}
bindBtn('btnLeft', 'ArrowLeft');
bindBtn('btnRight', 'ArrowRight');
bindBtn('btnJump', 'ArrowUp');
bindBtn('btnShoot', 'Space');

function isDown(...codes) {
  return codes.some(c => keys[c]);
}

// ─── Audio ────────────────────────────────────────────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playSound(freq, dur, type = 'square', vol = 0.2) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + dur);
}

// ─── 更新 ─────────────────────────────────────────────────────────────────────
function update(dt) {
  frame++;

  const floorY = canvas.height - FLOOR_H;

  // プレイヤー移動
  player.vx = 0;
  if (isDown('ArrowLeft', 'KeyA')) { player.vx = -PLAYER_SPEED; player.dir = -1; }
  if (isDown('ArrowRight', 'KeyD')) { player.vx = PLAYER_SPEED; player.dir = 1; }

  // ジャンプ
  if (isDown('ArrowUp', 'KeyW', 'Space') && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
    playSound(300, 0.1, 'square', 0.15);
  }

  // 射撃
  if (player.shootCooldown > 0) player.shootCooldown--;
  if (isDown('ShiftLeft', 'ShiftRight', 'KeyZ') && player.shootCooldown === 0) {
    bullets.push({ x: player.x + (player.dir > 0 ? player.w : 0), y: player.y + player.h / 2, vx: BULLET_SPEED * player.dir });
    player.shootCooldown = 15;
    playSound(800, 0.08, 'square', 0.1);
  }

  // 重力・位置更新
  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;

  // 床
  if (player.y + player.h >= floorY) {
    player.y = floorY - player.h;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  // 画面端
  player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));

  // 無敵時間
  if (player.invincible > 0) player.invincible--;

  // 弾更新
  bullets = bullets.filter(b => {
    b.x += b.vx;
    return b.x > 0 && b.x < canvas.width;
  });

  // 敵スポーン
  enemyTimer++;
  const spawnInterval = Math.max(60, 120 - Math.floor(score / 5));
  if (enemyTimer >= spawnInterval) {
    enemyTimer = 0;
    const fromRight = Math.random() > 0.5;
    enemies.push({
      x: fromRight ? canvas.width + 16 : -48,
      y: floorY - 32,
      w: 32,
      h: 32,
      vx: fromRight ? -ENEMY_SPEED : ENEMY_SPEED,
      hp: 1
    });
  }

  // 敵更新
  enemies = enemies.filter(e => {
    e.x += e.vx;

    // 弾との当たり判定
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
        bullets.splice(i, 1);
        e.hp--;
        if (e.hp <= 0) {
          score++;
          playSound(440, 0.15, 'sawtooth', 0.2);
          return false;
        }
      }
    }

    // プレイヤーとの当たり判定
    if (player.invincible === 0) {
      if (
        player.x < e.x + e.w && player.x + player.w > e.x &&
        player.y < e.y + e.h && player.y + player.h > e.y
      ) {
        lives--;
        player.invincible = 90;
        playSound(150, 0.3, 'sawtooth', 0.3);
        if (lives <= 0) {
          state = GameState.GAMEOVER;
        }
      }
    }

    // 画面外
    return e.x > -64 && e.x < canvas.width + 64;
  });

  // 星のまたたき
  stars.forEach(s => s.blink += 0.05);
}

// ─── 描画 ─────────────────────────────────────────────────────────────────────
function draw() {
  const W = canvas.width;
  const H = canvas.height;
  const floorY = H - FLOOR_H;

  // 背景
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // 星
  stars.forEach(s => {
    const alpha = (Math.sin(s.blink) + 1) / 2;
    ctx.globalAlpha = alpha * 0.8 + 0.2;
    ctx.fillStyle = COLORS.star;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // 床
  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(0, floorY, W, FLOOR_H);
  ctx.fillStyle = COLORS.floorTop;
  ctx.fillRect(0, floorY, W, 4);

  // 弾
  bullets.forEach(b => {
    ctx.fillStyle = COLORS.bullet;
    ctx.fillRect(b.x - 4, b.y - 2, 8, 4);
  });

  // 敵
  enemies.forEach(e => {
    ctx.fillStyle = COLORS.enemy;
    ctx.fillRect(e.x, e.y, e.w, e.h);
    // 目
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(e.x + 6, e.y + 8, 6, 6);
    ctx.fillRect(e.x + 20, e.y + 8, 6, 6);
    // 口
    ctx.fillRect(e.x + 8, e.y + 20, 16, 4);
  });

  // プレイヤー（無敵中は点滅）
  const showPlayer = player.invincible === 0 || Math.floor(frame / 5) % 2 === 0;
  if (showPlayer) {
    // 体
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(player.x, player.y + 8, player.w, player.h - 8);
    // 頭
    ctx.fillStyle = COLORS.playerDark;
    ctx.fillRect(player.x + 4, player.y, player.w - 8, 12);
    // 目
    ctx.fillStyle = COLORS.bg;
    const eyeX = player.dir > 0 ? player.x + player.w - 8 : player.x + 4;
    ctx.fillRect(eyeX, player.y + 3, 4, 4);
  }

  // UI: スコア
  ctx.fillStyle = COLORS.score;
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`SCORE: ${score}`, 12, 32);

  // UI: ライフ
  ctx.fillStyle = COLORS.ui;
  ctx.font = 'bold 20px monospace';
  const lifeStr = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
  ctx.fillText(lifeStr, W - 120, 32);

  // スタート画面
  if (state === GameState.START) {
    drawOverlay('RETRO ACTION', 'Space / タップ でスタート');
  }

  // ゲームオーバー
  if (state === GameState.GAMEOVER) {
    drawOverlay(`GAME OVER`, `SCORE: ${score}  |  Space / タップ でリトライ`);
  }
}

function drawOverlay(title, sub) {
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = COLORS.score;
  ctx.font = `bold ${Math.min(48, W / 10)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, H / 2 - 20);

  ctx.fillStyle = COLORS.ui;
  ctx.font = `${Math.min(18, W / 25)}px monospace`;
  ctx.fillText(sub, W / 2, H / 2 + 24);
  ctx.textAlign = 'left';
}

// ─── ゲームループ ──────────────────────────────────────────────────────────────
let lastTime = 0;
function gameLoop(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (state === GameState.PLAYING) {
    update(dt);
  }
  draw();

  requestAnimationFrame(gameLoop);
}

// ─── 入力でゲーム開始・リトライ ───────────────────────────────────────────────
function tryStart() {
  if (state === GameState.START || state === GameState.GAMEOVER) {
    initGame();
    state = GameState.PLAYING;
  }
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space') tryStart();
});
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  tryStart();
}, { passive: false });
canvas.addEventListener('mousedown', tryStart);

// ─── 起動 ─────────────────────────────────────────────────────────────────────
initGame();
requestAnimationFrame(gameLoop);
