// DinoX - Endless runner simples com skins e perks
// Salva estado em localStorage para moedas, skins compradas e perks

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const coinsEl = document.getElementById('coins');
  const btnJump = document.getElementById('btn-jump');
  const btnShop = document.getElementById('btn-shop');
  const btnPause = document.getElementById('btn-pause');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalClose = document.getElementById('modal-close');

  // layout responsivo do canvas
  function fitCanvas(){
    const w = Math.min(window.innerWidth * 0.96, 900);
    const h = Math.round(w * 0.55);
    canvas.width = w;
    canvas.height = h;
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // Estado do jogo e persistência
  const saveKey = 'dinox_save_v1';
  const defaultState = {
    coins: 0,
    best: 0,
    ownedSkins: ['classic'],
    activeSkin: 'classic',
    ownedPerks: { doubleJump: false, shield: false, magnet: false, speed: false },
  };
  let state = loadState();

  function loadState(){
    try{
      const raw = localStorage.getItem(saveKey);
      if(!raw) return {...defaultState};
      const obj = JSON.parse(raw);
      return {...defaultState, ...obj};
    }catch(e){ return {...defaultState};}
  }
  function saveState(){ localStorage.setItem(saveKey, JSON.stringify(state)); updateUI(); }

  // Skins definidas (simples: cor principal + detalhe)
  const SKINS = {
    classic: { name: 'Clássico', color: '#2b2b2b', accent: '#fff' },
    lava: { name: 'Lava', color: '#7a1600', accent: '#ff7a24' },
    cyan: { name: 'Ciano', color: '#083f56', accent: '#6be8ff' },
    stealth: { name: 'Stealth', color: '#0b1220', accent: '#6f6f6f' },
    lime: { name: 'Verde Neon', color: '#133d11', accent: '#a8ff6a' }
  };

  // Perks info: price and description
  const PERK_DEFS = {
    doubleJump: { name: 'Double Jump', price: 150, desc: 'Pula de novo no ar' },
    shield: { name: 'Shield', price: 200, desc: 'Proteção contra 1 obstáculo' },
    magnet: { name: 'Magnet', price: 120, desc: 'Atração de moedas por 5s' },
    speed: { name: 'Speed Boost', price: 180, desc: 'Acelera por 5s (maior risco)' }
  };

  // Jogo — variáveis
  let running = true, paused = false, lastTime = 0;
  let score = 0, speed = 4, gravity = 0.8;
  const groundH = 60;
  const player = { x: 80, y: 0, w: 46, h: 46, vy: 0, onGround: false, jumpsLeft: 1, alive: true, shield: false };
  let obstacles = [], coins = [], spawnTimer = 0, coinTimer = 0;
  let gameOver = false;

  // Helpers
  function rand(min, max){ return Math.random()*(max-min)+min; }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  // Input
  function jump(){
    if(!player.alive) return;
    // If double jump perk owned and active, allow two jumps
    const doubleOwned = state.ownedPerks.doubleJump;
    if(player.onGround || (doubleOwned && player.jumpsLeft > 0)){
      player.vy = -12;
      player.onGround = false;
      if(!player.onGround) player.jumpsLeft--;
      playFX('jump');
    }
  }
  btnJump.addEventListener('click', ()=> jump());
  canvas.addEventListener('touchstart', (e)=>{ e.preventDefault(); jump(); });
  document.addEventListener('keydown', (e)=> { if(e.code==='Space') jump(); if(e.code==='KeyS') openShop(); if(e.code==='KeyP') togglePause(); });

  btnShop.addEventListener('click', openShop);
  btnPause.addEventListener('click', togglePause);
  modalClose.addEventListener('click', ()=> { modal.classList.add('hidden'); });

  function togglePause(){
    paused = !paused;
    btnPause.textContent = paused ? 'Continuar' : 'Pausa';
    if(!paused) requestAnimationFrame(loop);
  }

  // Sound placeholders (no audio to keep simple)
  function playFX(name){ /* pode adicionar áudio aqui */ }

  // Spawning
  function spawnObstacle(){
    const h = Math.round(rand(28, 80));
    const w = Math.round(rand(22, 44));
    obstacles.push({ x: canvas.width + 20, y: canvas.height - groundH - h, w, h, passed:false });
  }
  function spawnCoin(){
    const y = Math.round(rand(canvas.height - groundH - 120, canvas.height - groundH - 40));
    coins.push({ x: canvas.width + 20, y, r: 10, collected:false });
  }

  // Main loop
  function loop(ts){
    if(!running || paused) { lastTime = ts; return; }
    if(!lastTime) lastTime = ts;
    const dt = Math.min(40, ts - lastTime);
    lastTime = ts;

    // increase difficulty slowly
    score += Math.floor((speed * dt)/30);
    score = Math.max(score,0);

    // spawn
    spawnTimer -= dt;
    if(spawnTimer <= 0){
      spawnTimer = rand(650 - score/6, 1400 - score/8);
      spawnObstacle();
    }
    coinTimer -= dt;
    if(coinTimer <= 0){
      coinTimer = rand(700, 1600);
      spawnCoin();
    }

    // update player physics
    player.vy += gravity * (1 + (state.ownedPerks.speed ? 0.02 : 0));
    player.y += player.vy;
    if(player.y + player.h >= canvas.height - groundH){
      player.y = canvas.height - groundH - player.h;
      player.vy = 0;
      player.onGround = true;
      player.jumpsLeft = state.ownedPerks.doubleJump ? 1 : 0; // if no double jump, jumpsLeft stays 0 (single)
    } else {
      player.onGround = false;
    }

    // move obstacles and coins
    const realSpeed = speed + (state.ownedPerks.speed ? 2 : 0);
    for(let o of obstacles){
      o.x -= realSpeed;
      // collision
      if(!o.passed && o.x + o.w < player.x){
        o.passed = true;
        // reward small score
        score += 5;
        // slight speed up
        speed = Math.min(12, speed + 0.02);
      }
      if(!player.shield && rectIntersect(player, o) && player.alive){
        if(state.ownedPerks.shield && player.shield){ // if shield active
          player.shield = false;
          // consume shield
        } else {
          player.alive = false;
          gameOver = true;
          playFX('die');
        }
      }
    }
    for(let c of coins){
      // magnet perk: attract
      if(state.ownedPerks.magnet){
        const dx = (player.x+player.w/2) - c.x;
        const dy = (player.y+player.h/2) - c.y;
        const dist = Math.hypot(dx,dy);
        if(dist < 160){
          c.x += dx/dist * 6;
          c.y += dy/dist * 6;
        }
      }
      c.x -= realSpeed;
      if(!c.collected && circleRectIntersect(c, player)){
        c.collected = true;
        state.coins += 1;
        playFX('coin');
      }
    }

    // remove out-of-screen
    obstacles = obstacles.filter(o => o.x + o.w > -30);
    coins = coins.filter(c => c.x > -30 && !c.collected);

    // render
    render();

    // update UI
    updateUI();

    if(gameOver){
      // Save best
      state.best = Math.max(state.best, score);
      saveState();
      showGameOver();
      return;
    }
    requestAnimationFrame(loop);
  }

  function rectIntersect(a,b){
    return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
  }
  function circleRectIntersect(circle, rect){
    const cx = circle.x;
    const cy = circle.y;
    const rx = rect.x;
    const ry = rect.y;
    const rw = rect.w;
    const rh = rect.h;
    const nearestX = Math.max(rx, Math.min(cx, rx+rw));
    const nearestY = Math.max(ry, Math.min(cy, ry+rh));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return (dx*dx + dy*dy) <= (circle.r*circle.r);
  }

  // Render everything
  function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // sky gradient handled by CSS background of canvas
    // ground
    ctx.fillStyle = '#6b4f2a';
    ctx.fillRect(0, canvas.height - groundH, canvas.width, groundH);

    // draw obstacles
    ctx.fillStyle = '#333';
    for(let o of obstacles){
      ctx.fillStyle = '#5c3a1e';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(o.x, o.y + o.h - 6, o.w, 4);
    }

    // draw coins
    for(let c of coins){
      ctx.beginPath();
      ctx.fillStyle = '#ffd24a';
      ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.stroke();
    }

    // draw player with skin
    const skin = SKINS[state.activeSkin] || SKINS.classic;
    drawPlayer(player.x, player.y, player.w, player.h, skin);

    // If shield active show aura
    if(player.shield){
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(120,200,255,0.55)';
      ctx.lineWidth = 6;
      ctx.strokeRect(player.x-6, player.y-6, player.w+12, player.h+12);
    }
  }

  function drawPlayer(x,y,w,h, skin){
    // body
    ctx.fillStyle = skin.color;
    roundRect(ctx, x, y, w, h, 8, true, false);
    // eye
    ctx.fillStyle = skin.accent;
    ctx.fillRect(x + w*0.6, y + h*0.28, w*0.12, h*0.12);
    // stripe
    ctx.fillStyle = shadeHex(skin.accent, -10);
    ctx.fillRect(x + 6, y + h - 12, w-12, 6);
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke){
    if (typeof r === 'number') r = {tl: r, tr: r, br: r, bl: r};
    ctx.beginPath();
    ctx.moveTo(x + r.tl, y);
    ctx.lineTo(x + w - r.tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    ctx.lineTo(x + w, y + h - r.br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    ctx.lineTo(x + r.bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    ctx.lineTo(x, y + r.tl);
    ctx.quadraticCurveTo(x, y, x + r.tl, y);
    ctx.closePath();
    if(fill) ctx.fill();
    if(stroke) ctx.stroke();
  }

  function shadeHex(hex, percent){
    // percent negative to darken, positive to lighten
    const num = parseInt(hex.replace('#',''),16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = clamp(r,0,255); g = clamp(g,0,255); b = clamp(b,0,255);
    return '#' + ( (1<<24) + (r<<16) + (g<<8) + b ).toString(16).slice(1);
  }

  // UI updates
  function updateUI(){
    scoreEl.textContent = `Score: ${score}`;
    coinsEl.textContent = `Moedas: ${state.coins}`;
  }

  // Shop / Modal
  function openShop(){
    paused = true;
    modal.classList.remove('hidden');
    modalTitle.textContent = 'Loja — Skins & Perks';
    modalBody.innerHTML = '';

    // skins
    const sTitle = document.createElement('div'); sTitle.className='small'; sTitle.textContent='Skins';
    modalBody.appendChild(sTitle);
    for(const key of Object.keys(SKINS)){
      const def = SKINS[key];
      const it = document.createElement('div'); it.className='item';
      const meta = document.createElement('div'); meta.className='meta';
      const sw = document.createElement('div'); sw.className='skin-swatch';
      sw.style.background = def.color;
      sw.textContent = def.name[0];
      meta.appendChild(sw);
      const txt = document.createElement('div'); txt.innerHTML = `<div style="font-weight:800">${def.name}</div><div class="small">Skin ${key}</div>`;
      meta.appendChild(txt);
      it.appendChild(meta);
      const controls = document.createElement('div');
      if(state.ownedSkins.includes(key)){
        const activeBtn = document.createElement('button'); activeBtn.textContent = (state.activeSkin===key? 'Ativa':'Ativar');
        activeBtn.className='btn-buy';
        activeBtn.onclick = ()=> { state.activeSkin = key; saveState(); modal.classList.add('hidden'); paused=false; }
        controls.appendChild(activeBtn);
      } else {
        const price = 80;
        const buyBtn = document.createElement('button'); buyBtn.textContent = `Comprar ${price}`;
        buyBtn.className='btn-buy';
        buyBtn.onclick = ()=> {
          if(state.coins >= price){
            state.coins -= price; state.ownedSkins.push(key); state.activeSkin = key; saveState(); modal.classList.add('hidden'); paused=false;
          } else alert('Moedas insuficientes.');
        };
        controls.appendChild(buyBtn);
      }
      it.appendChild(controls);
      modalBody.appendChild(it);
    }

    // perks
    const pTitle = document.createElement('div'); pTitle.className='small'; pTitle.textContent='Perks (um por jogo)';
    pTitle.style.marginTop='8px';
    modalBody.appendChild(pTitle);
    for(const k of Object.keys(PERK_DEFS)){
      const def = PERK_DEFS[k];
      const it = document.createElement('div'); it.className='item';
      const meta = document.createElement('div'); meta.className='meta';
      const txt = document.createElement('div'); txt.innerHTML = `<div style="font-weight:800">${def.name}</div><div class="small">${def.desc}</div>`;
      meta.appendChild(txt);
      it.appendChild(meta);
      const controls = document.createElement('div');
      if(state.ownedPerks[k]){
        const activeBtn = document.createElement('button'); activeBtn.textContent = 'Comprado'; activeBtn.disabled = true; activeBtn.className='btn-buy';
        controls.appendChild(activeBtn);
      } else {
        const buyBtn = document.createElement('button'); buyBtn.textContent = `Comprar ${def.price}`; buyBtn.className='btn-buy';
        buyBtn.onclick = ()=> {
          if(state.coins >= def.price){
            state.coins -= def.price; state.ownedPerks[k] = true; saveState(); modal.classList.add('hidden'); paused=false;
          } else alert('Moedas insuficientes.');
        };
        controls.appendChild(buyBtn);
      }
      it.appendChild(controls);
      modalBody.appendChild(it);
    }

    const note = document.createElement('div'); note.className='footer-note'; note.textContent = 'As perks são permanentes mas aplicadas por jogo (consumíveis em partidas).';
    modalBody.appendChild(note);
  }

  // Start a new run
  function startRun(){
    // reset variables for run
    score = 0; speed = 4; gameOver = false;
    obstacles = []; coins = [];
    spawnTimer = 900; coinTimer = 700;
    player.y = canvas.height - groundH - player.h;
    player.vy = 0; player.alive = true; player.onGround = true;
    player.shield = state.ownedPerks.shield ? true : false; // shield perk gives starting shield
    // magnet and speed perks: are active for limited time when used via "usePerk" if you want - here we'll treat as passive purchase enabling per-run usage
    // start loop
    paused = false;
    requestAnimationFrame(loop);
  }

  // Game over display simple
  function showGameOver(){
    paused = true;
    modalTitle.textContent = 'Game Over';
    modalBody.innerHTML = `<div style="font-weight:900;font-size:18px">Score: ${score}</div><div class="small">Melhor: ${state.best}</div>
      <div style="margin-top:10px">
        <button id="btn-retry" class="btn-buy">Jogar de novo</button>
        <button id="btn-menu" style="margin-left:8px" class="btn-buy">Loja</button>
      </div>`;
    modal.classList.remove('hidden');
    document.getElementById('btn-retry').onclick = ()=> { modal.classList.add('hidden'); startRun(); };
    document.getElementById('btn-menu').onclick = ()=> { openShop(); };
  }

  // Boot
  function init(){
    // set initial player pos on responsive canvas
    player.y = canvas.height - groundH - player.h;
    updateUI();
    // Place initial coin buffer
    for(let i=0;i<3;i++) spawnCoin();
    // Bind modal close behaviour
    modal.addEventListener('click', (e)=>{ if(e.target === modal){ modal.classList.add('hidden'); paused=false; }});
    startRun();
  }

  // Start
  init();

  // Extras: simple save autosave loop
  setInterval(saveState, 2500);

})();
