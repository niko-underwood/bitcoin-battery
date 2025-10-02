// Bitcoin Battery v3 — melting ice cube + converter + big BTC battery
(() => {
  const iceCube = document.getElementById('iceCube');
  const iceFill = document.getElementById('iceFill');
  const stackIllus = document.getElementById('stackIllus');
  const mailSlot = document.getElementById('mailSlot');
  const tubePath = document.getElementById('tubePath');
  const tubeSvg = document.querySelector('svg.tube');

  const savedCountEl = document.getElementById('savedCount');
  const burnedCountEl = document.getElementById('burnedCount');
  const streakCountEl = document.getElementById('streakCount');
  const spawnBtn = document.getElementById('spawnBtn');
  const resetBtn = document.getElementById('resetBtn');

  const canvas = document.getElementById('batteryCanvas');
  const ctx = canvas.getContext('2d');
  const chargeBar = document.getElementById('chargeBar');

  let saved = 0, melted = 0, streak = 0;

  // --- Ice cube melt model ---
  let iceLevel = 1.0; // 1.0 full, 0 empty
  let lastSpawn = 0;
  let spawnEveryMs = 2400;
  let meltRatePerSec = 0.02; // base melt rate
  let globalNow = performance.now();

  // Auto spill a bill from bottom as it melts
  function spawnBill(fromMelt = false){
    const el = document.createElement('div');
    el.className = 'bill';
    el.innerHTML = `<div class="seal"></div><div class="num">$1</div>
      <div class="progress"><span style="transform:scaleX(1)"></span></div>`;
    document.body.appendChild(el);

    // Start near bottom center of the ice cube to simulate falling out
    const r = iceCube.getBoundingClientRect();
    const x = r.left + r.width * (0.5 + (Math.random()-0.5)*0.25) - 75;
    const y = r.bottom - 20 - 35; // just above the tray
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.zIndex = 5 + Math.floor(Math.random()*100);

    const id = ++billId;
    const burnMs = Math.max(2500, 6500 - (streak * 150)); // tension with streak
    const bornAt = performance.now();

    const record = {id, el, bornAt, burnMs, grabbed:false};
    activeBills.set(id, record);

    makeDraggable(record);
  }

  function updateIceVisuals(){
    iceFill.style.height = `${Math.max(0, iceLevel) * 100}%`;
    // Stack illustration shrinks with ice level
    const stackScale = Math.max(0, iceLevel);
    stackIllus.style.transform = `scaleY(${stackScale})`;
  }

  // --- Converter (mailbox) geometry helper ---
  function getSlotRect() {
    const r = mailSlot.getBoundingClientRect();
    return {x:r.left, y:r.top, w:r.width, h:r.height};
  }

  // --- Dollar bills spawning & "melt" (fail) ---
  let billId = 0;
  const activeBills = new Map(); // id -> {el, bornAt, burnMs}

  function makeDraggable(record){
    const el = record.el;
    let offset = {x:0,y:0}, dragging = false;

    function getPoint(e){
      if(e.touches && e.touches[0]) return {x:e.touches[0].clientX, y:e.touches[0].clientY};
      return {x: e.clientX, y: e.clientY};
    }

    function onDown(e){
      record.grabbed = true;
      dragging = true;
      const p = getPoint(e);
      const r = el.getBoundingClientRect();
      offset.x = p.x - r.left; offset.y = p.y - r.top;
      el.setPointerCapture && el.setPointerCapture(e.pointerId || 1);
    }
    function onMove(e){
      if(!dragging) return;
      const p = getPoint(e);
      el.style.left = (p.x - offset.x) + 'px';
      el.style.top  = (p.y - offset.y) + 'px';
    }
    function onUp(e){
      if(!dragging) return;
      dragging = false;
      const slot = getSlotRect();
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      if(cx>slot.x && cx<slot.x+slot.w && cy>slot.y && cy<slot.y+slot.h){
        toCoin(record);
      }
    }
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function loseBill(id){
    const rec = activeBills.get(id);
    if(!rec) return;
    // melting animation
    rec.el.classList.add('melting');
    setTimeout(() => rec.el.remove(), 1100);
    activeBills.delete(id);
    melted++; streak = 0; updateStats();
  }

  function toCoin(rec){
    rec.el.remove();
    activeBills.delete(rec.id);

    const coin = document.createElement('div');
    coin.className = 'coin'; document.body.appendChild(coin);

    const path = tubePath;
    const len = path.getTotalLength();
    const startTime = performance.now(); const duration = 900;

    function step(now){
      const t = Math.max(0, Math.min(1, (now - startTime)/duration));
      const p = path.getPointAtLength(t * len);
      const svgRect = tubeSvg.getBoundingClientRect();
      coin.style.left = (svgRect.left + p.x - 13) + 'px';
      coin.style.top  = (svgRect.top + p.y - 13) + 'px';
      if(t < 1){ requestAnimationFrame(step); }
      else { coin.remove(); addBatteryCoin(); }
    }
    requestAnimationFrame(step);

    saved++; streak++; updateStats();
  }

  function updateStats(){
    savedCountEl.textContent = String(saved);
    burnedCountEl.textContent = String(melted);
    streakCountEl.textContent = String(streak);
    // Update charge bar width relative to coins in battery
    const fraction = Math.max(0, Math.min(1, saved / (saved + melted || 1)));
    chargeBar.style.setProperty('--w', (fraction*100).toFixed(1)+'%');
    chargeBar.style.setProperty('width', '100%');
    chargeBar.style.setProperty('--count', saved);
    chargeBar.style.setProperty('--melt', melted);
    chargeBar.style.setProperty('--streak', streak);
    // Use ::before width
    const bar = document.querySelector('.charge-bar::before');
  }

  // Progress bars & failure loop
  function tickBills(now){
    for(const [id, rec] of activeBills){
      const t = Math.max(0, Math.min(1, (now - rec.bornAt) / rec.burnMs));
      const bar = rec.el.querySelector('.progress > span');
      if(bar) bar.style.transform = `scaleX(${1 - t})`;
      if(t >= 1 && !rec.grabbed){
        loseBill(id);
      }
    }
  }

  // --- Battery physics (bouncing coins with hover avoidance) ---
  const coins = []; // {x,y,vx,vy,r}
  const mouse = {x:0,y:0, inside:false};
  const repelRadius = 60;

  canvas.addEventListener('mouseenter', ()=> mouse.inside=true);
  canvas.addEventListener('mouseleave', ()=> mouse.inside=false);
  canvas.addEventListener('mousemove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  function addBatteryCoin(){
    const r = 12;
    const x = 30 + Math.random() * (canvas.width - 60);
    const y = 30 + Math.random() * (canvas.height - 60);
    const speed = 2 + Math.random() * 1.8;
    const angle = Math.random() * Math.PI * 2;
    coins.push({x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, r});
  }

  function drawCoin(c){
    // gold circle
    const grd = ctx.createRadialGradient(c.x - c.r*0.3, c.y - c.r*0.3, c.r*0.2, c.x, c.y, c.r);
    grd.addColorStop(0, '#ffd79a'); grd.addColorStop(0.6, '#f7931a'); grd.addColorStop(1, '#b45309');
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.closePath(); ctx.fillStyle = grd; ctx.fill();
    // Bitcoin
    ctx.fillStyle = '#0b1020'; ctx.font = `${c.r*1.4}px system-ui, sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('₿', c.x, c.y+1);
  }

  function tickBattery(){
    ctx.clearRect(0,0,canvas.width, canvas.height);

    // subtle grid backdrop
    ctx.globalAlpha = 0.08;
    for(let x=0;x<canvas.width;x+=20){ ctx.fillRect(x,0,1,canvas.height); }
    for(let y=0;y<canvas.height;y+=20){ ctx.fillRect(0,y,canvas.width,1); }
    ctx.globalAlpha = 1;

    for(const c of coins){
      // repel from mouse
      if(mouse.inside){
        const dx = c.x - mouse.x, dy = c.y - mouse.y, d2 = dx*dx + dy*dy;
        const r = repelRadius + c.r;
        if(d2 < r*r){
          const d = Math.sqrt(d2) || 0.001; const ux = dx/d, uy = dy/d; const push = (r - d) * 0.12;
          c.vx += ux * push; c.vy += uy * push;
        }
      }
      // motion & wall bounces
      c.x += c.vx; c.y += c.vy;
      c.vx *= 0.996; c.vy *= 0.996;
      if(c.x - c.r < 10){ c.x = 10 + c.r; c.vx = Math.abs(c.vx); }
      if(c.x + c.r > canvas.width - 10){ c.x = canvas.width - 10 - c.r; c.vx = -Math.abs(c.vx); }
      if(c.y - c.r < 10){ c.y = 10 + c.r; c.vy = Math.abs(c.vy); }
      if(c.y + c.r > canvas.height - 10){ c.y = canvas.height - 10 - c.r; c.vy = -Math.abs(c.vy); }
      drawCoin(c);
    }

    // update charge bar ::before width using inline style (set on element style attribute)
    const ratio = Math.max(0, Math.min(1, coins.length / Math.max(1, coins.length + melted)));
    const bar = document.querySelector('.charge-bar');
    if(bar){
      bar.style.setProperty('--fill', (ratio*100).toFixed(1) + '%');
      bar.style.setProperty('background-position', 'left');
      bar.style.setProperty('position', 'relative');
      // emulate ::before fill by inset gradient element
      if(!bar.querySelector('.fill')){
        const f = document.createElement('div');
        f.className = 'fill';
        f.style.position = 'absolute'; f.style.left='0'; f.style.top='0'; f.style.bottom='0'; f.style.width='0';
        f.style.background = 'linear-gradient(90deg,#ffd79a,#f7931a)';
        bar.appendChild(f);
      }
      const f = bar.querySelector('.fill');
      f.style.width = (ratio*100).toFixed(1) + '%';
    }
  }

  // --- Main loop ---
  function loop(now){
    globalNow = now;
    // melting
    const dt = 16/1000; // approx per frame
    iceLevel = Math.max(0, iceLevel - meltRatePerSec * dt);
    updateIceVisuals();

    if(now - lastSpawn > spawnEveryMs && iceLevel > 0.02){
      spawnBill(true);
      lastSpawn = now;
      // slight reduction in stack for each spill
      iceLevel = Math.max(0, iceLevel - 0.03);
    }

    tickBills(now);
    tickBattery();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Controls
  spawnBtn.addEventListener('click', ()=> spawnBill(true));
  resetBtn.addEventListener('click', ()=> {
    for(const [,rec] of activeBills){ rec.el.remove(); }
    activeBills.clear();
    saved=0; melted=0; streak=0;
    iceLevel=1; updateIceVisuals();
    // clear coins
    coins.length = 0; updateStats();
  });

  // --- External helpers from v2 ---
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

})();