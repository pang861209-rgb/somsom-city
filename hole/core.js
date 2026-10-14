// 「구멍으로 쏙」 규칙 — 화면과 떨어진 순수 로직. 게임(index.html)과 자동 대전(sim.js, node)이 같은 파일을 쓴다.
//
// 한 줄 규칙: 솜재페가 끝난 잔디밭. 내 구멍을 움직여 나보다 작은 물건을 삼키면 구멍이 커진다.
//            커질수록 더 큰 물건(의자 → 벤치 → 푸드트럭 → 무대)을 삼킬 수 있다. 나보다 충분히 작은 구멍도 삼킨다.
//            1분 뒤 가장 많이 치운 주민이 1등.
(function(root){
  const OWNERS = ['kkito','migae','lachilchin','ramda','boneul','bookgeo'];

  const DEFAULTS = {
    W: 1400, H: 1400,  // 잔디밭 크기 (단위: 구멍 처음 반지름이 16)
    time: 60,          // 한 판 1분
    r0: 12,            // 처음 구멍 반지름 (은행잎·종이컵·도시락만)
    grow: 0.22,        // 삼킨 물건 넓이 중 구멍이 커지는 비율
    eatK: 0.92,        // 물건 반지름이 구멍의 이 비율 이하면 삼킬 수 있음
    holeK: 1.25,       // 상대 구멍보다 이 배 이상 크면 삼킬 수 있음
    respawn: 1.5,      // 삼켜진 구멍이 다시 나오기까지 초
    keep: 0.7,         // 삼켜진 구멍이 다시 나올 때 남는 크기 비율
    shield: 2,         // 다시 나온 뒤 안 삼켜지는 초
    botLevel: 1,
  };

  // 물건 — 작은 것부터. r = 크기(반지름), 점수 = r²/25 (은행잎 1점 ~ 무대 256점)
  const TYPES = [
    { k:'leaf',  n:'은행잎',   r:5,  w:1.4, h:0.8, c:'#F2C230', e:'#A9821A', shape:'leaf' },
    { k:'cup',   n:'종이컵',   r:7,  w:1,   h:1,   c:'#F7F1E6', e:'#A39A8A', shape:'circle' },
    { k:'box',   n:'도시락',   r:10, w:1.3, h:0.9, c:'#E98A5B', e:'#9C5434', shape:'rect' },
    { k:'chair', n:'접이의자', r:14, w:1,   h:1,   c:'#6FA8DC', e:'#3F6E99', shape:'rect' },
    { k:'mat',   n:'돗자리',   r:20, w:1.5, h:1,   c:'#E06C75', e:'#93404A', shape:'mat' },
    { k:'bench', n:'벤치',     r:27, w:1.9, h:0.6, c:'#B07B4F', e:'#6E4A2C', shape:'rect' },
    { k:'truck', n:'푸드트럭', r:38, w:1.7, h:0.95,c:'#F3E3A0', e:'#9C8A45', shape:'truck' },
    { k:'tree',  n:'은행나무', r:52, w:1,   h:1,   c:'#F0B323', e:'#9A6E10', shape:'tree' },
    { k:'stage', n:'무대',     r:82, w:1.8, h:0.85,c:'#C84B3C', e:'#7A2A20', shape:'stage' },
  ];
  const TI = {}; TYPES.forEach((t, i) => TI[t.k] = i);

  // 성격: 사냥(작은 구멍 쫓기), 겁(큰 구멍 피하는 거리), 욕심(멀리 있는 큰 물건 선호), 손(판단 간격 초), 흔들림
  const PERSONA = {
    kkito:      { hunt:1.0, fear:1.0, greed:1.0, think:0.22, wander:0.15 },
    migae:      { hunt:0.8, fear:0.9, greed:0.8, think:0.18, wander:0.35 },
    lachilchin: { hunt:0.5, fear:1.2, greed:1.1, think:0.30, wander:0.15 },
    ramda:      { hunt:1.5, fear:0.7, greed:1.3, think:0.20, wander:0.10 },
    boneul:     { hunt:0.7, fear:1.0, greed:0.9, think:0.40, wander:0.10 },
    bookgeo:    { hunt:0.6, fear:1.5, greed:0.9, think:0.28, wander:0.10 },
  };

  function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function Game(seed, meId, opt){
    const P = Object.assign({}, DEFAULTS, opt || {});
    const rnd = mulberry32(seed >>> 0);
    const W = P.W, H = P.H;
    const objs = [];
    let oid = 0;
    function add(k, x, y, rot){
      const t = TYPES[TI[k]];
      if(x < t.r || y < t.r || x > W - t.r || y > H - t.r) return;
      // 큰 물건끼리는 겹치지 않게
      if(t.r >= 14) for(const o of objs){ if(o.r >= 14 && Math.hypot(o.x - x, o.y - y) < (o.r + t.r)*0.95) return; }
      objs.push({ id: oid++, t: TI[k], r: t.r, x, y, rot: rot || 0, fall: 0, by: -1, v: rnd() < 0.5 ? 0 : 1 });   // v: 같은 크기 안의 그림 종류 (은행잎 노랑/주황 등)
    }

    // ── 잔디밭 배치: 위쪽 가운데 무대, 그 앞 의자 줄, 가운데 돗자리, 길가 벤치, 아래 푸드트럭, 가장자리 은행나무 ──
    add('stage', W/2, 120);
    for(let row = 0; row < 4; row++) for(let c = 0; c < 9; c++)
      if(rnd() < 0.85) add('chair', W/2 + (c - 4)*40 + (row % 2)*8, 270 + row*42);
    add('tree', 90, 110); add('tree', W - 90, 110);
    add('tree', 70, H/2 - 60); add('tree', W - 70, H/2 + 40);
    add('tree', 110, H - 300); add('tree', W - 110, H - 330);
    add('tree', W/2 - 330, 170); add('tree', W/2 + 330, 170);
    for(let i = 0; i < 6; i++) add('truck', 160 + i*(W - 320)/5, H - 70);
    for(let i = 0; i < 4; i++){ add('bench', 230, 480 + i*170, Math.PI/2); add('bench', W - 230, 480 + i*170, Math.PI/2); }
    for(let i = 0; i < 4; i++) add('bench', 420 + i*190, H - 220);
    // 돗자리 + 둘레 소풍 짐
    for(let i = 0, n = 0; i < 200 && n < 22; i++){
      const x = 320 + rnd()*(W - 640), y = 470 + rnd()*(H - 760), before = objs.length;
      add('mat', x, y, (rnd() - 0.5)*0.6);
      if(objs.length > before){ n++;
        for(let j = 0; j < 3; j++){ const a = rnd()*7, d = 26 + rnd()*14; add(rnd() < 0.6 ? 'box' : 'cup', x + Math.cos(a)*d, y + Math.sin(a)*d, rnd()*3); } }
    }
    for(let i = 0; i < 60; i++) add('box', 60 + rnd()*(W - 120), 60 + rnd()*(H - 120), rnd()*3);
    for(let i = 0; i < 130; i++) add('cup', 40 + rnd()*(W - 80), 40 + rnd()*(H - 80));
    // 은행잎은 무더기로 — 쓸어 담는 맛
    for(let i = 0; i < 34; i++){ const cx = 50 + rnd()*(W - 100), cy = 50 + rnd()*(H - 100);
      for(let j = 0; j < 9; j++) add('leaf', cx + (rnd() - 0.5)*70, cy + (rnd() - 0.5)*70, rnd()*7); }

    // ── 구멍 6개: 가운데를 둘러 원형으로 ──
    const a0 = rnd()*Math.PI*2;
    const holes = OWNERS.map((k, i) => {
      const a = a0 + i*Math.PI*2/6;
      return { id: i, k, bot: i !== meId, x: W/2 + Math.cos(a)*420, y: H*0.58 + Math.sin(a)*380, r: P.r0, vx: 0, vy: 0, ax: 0, ay: 0,
        score: 0, dead: 0, shield: 0, combo: 0, comboT: 0, ate: TYPES.map(() => 0), holesEaten: 0, timesEaten: 0, think: rnd()*0.3, tx: 0, ty: 0, wob: rnd()*7 };
    });
    for(const h of holes){ const m = Math.hypot(W/2 - h.x, H/2 - h.y) || 1; h.ax = (W/2 - h.x)/m*0.01; h.ay = (H/2 - h.y)/m*0.01; }

    const g = { P, W, H, objs, holes, t: 0, over: false, events: [], meId, TYPES };

    const speedOf = h => 80 + h.r*1.5;
    const canEat = (h, o) => o.r <= h.r*P.eatK;

    function grow(h, area){ h.r = Math.sqrt(h.r*h.r + area*P.grow); }

    function spawnPoint(r){
      let best = null, bd = -1;
      for(let i = 0; i < 20; i++){ const x = 80 + rnd()*(W - 160), y = 260 + rnd()*(H - 400);
        let d = 1e9; for(const o of holes) if(!o.dead) d = Math.min(d, Math.hypot(o.x - x, o.y - y) - o.r);
        if(d > bd){ bd = d; best = [x, y]; } }
      return best;
    }

    // 컴퓨터 판단
    function decide(h){
      const pe = PERSONA[h.k], L = P.botLevel;
      let fx = 0, fy = 0, threat = 0;
      for(const o of holes){ if(o === h || o.dead) continue;
        const d = Math.hypot(o.x - h.x, o.y - h.y);
        if(o.r > h.r*P.holeK){ const R = (o.r + h.r)*1.2 + 140*pe.fear; if(d < R){ const w = (R - d)/R; fx -= (o.x - h.x)/d*w*3; fy -= (o.y - h.y)/d*w*3; threat = Math.max(threat, w); } }
      }
      let best = null, bs = 0;
      // 작은 구멍 사냥
      for(const o of holes){ if(o === h || o.dead || o.shield > 0 || !(h.r > o.r*P.holeK)) continue;
        const d = Math.hypot(o.x - h.x, o.y - h.y); if(d > 320*L) continue;
        const s = pe.hunt*L*(o.r*o.r/25 + 25)/(d + 60) * (o.bot ? 1 : 1.4);
        if(s > bs){ bs = s; best = o; } }
      // 물건: 점수/거리, 큰 물건 욕심
      const reach = 260 + h.r*4;
      for(const o of objs){ if(o.fall || !canEat(h, o)) continue;
        const dx = o.x - h.x, dy = o.y - h.y; if(Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
        const d = Math.hypot(dx, dy);
        const s = Math.pow(o.r*o.r/25, 0.7 + 0.15*pe.greed)/(d + 30 + h.r);
        if(s > bs){ bs = s; best = o; } }
      let tx, ty;
      if(best){ tx = best.x - h.x; ty = best.y - h.y; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m; }
      else { tx = W/2 - h.x; ty = H/2 - h.y; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m; }
      tx = tx*(1 - threat*0.8) + fx; ty = ty*(1 - threat*0.8) + fy;
      const a = Math.atan2(ty, tx) + (rnd() - 0.5)*pe.wander*2;
      h.ax = Math.cos(a); h.ay = Math.sin(a);
    }

    g.setInput = function(id, ax, ay){ const h = holes[id]; const m = Math.hypot(ax, ay); if(m > 1){ ax /= m; ay /= m; } h.ax = ax; h.ay = ay; };

    g.update = function(dt){
      if(g.over) return;
      g.t += dt;
      if(g.t >= P.time){ g.t = P.time; g.over = true; g.events.push({ type:'end' }); return; }
      for(const h of holes){
        if(h.dead){ h.dead -= dt; if(h.dead <= 0){ h.dead = 0; const [x, y] = spawnPoint(h.r); h.x = x; h.y = y; h.shield = P.shield; g.events.push({ type:'respawn', id: h.id }); } continue; }
        if(h.bot){ h.think -= dt; if(h.think <= 0){ h.think = PERSONA[h.k].think/P.botLevel; decide(h); } }
        const sp = speedOf(h);
        // 부드럽게 따라가는 속도
        const k = Math.min(1, dt*10);
        h.vx += (h.ax*sp - h.vx)*k; h.vy += (h.ay*sp - h.vy)*k;
        h.x = Math.max(h.r*0.6, Math.min(W - h.r*0.6, h.x + h.vx*dt));
        h.y = Math.max(h.r*0.6, Math.min(H - h.r*0.6, h.y + h.vy*dt));
        if(h.shield > 0) h.shield -= dt;
        if(h.comboT > 0){ h.comboT -= dt; if(h.comboT <= 0) h.combo = 0; }
      }
      // 물건: 끌려 들어가기 → 떨어지기
      for(let i = objs.length - 1; i >= 0; i--){
        const o = objs[i];
        if(o.fall){ o.fall += dt/0.32; const h = holes[o.by];
          if(!h.dead){ o.x += (h.x - o.x)*Math.min(1, dt*12); o.y += (h.y - o.y)*Math.min(1, dt*12); }
          if(o.fall >= 1) objs.splice(i, 1);
          continue; }
        let hit = null, hd = 1e9;
        for(const h of holes){ if(h.dead || !canEat(h, o)) continue;
          const d = Math.hypot(o.x - h.x, o.y - h.y);
          if(d < h.r + o.r*0.4 && d < hd){ hd = d; hit = h; } }
        if(!hit) continue;
        if(hd < hit.r - o.r*0.35){ // 쏙
          o.fall = 0.001; o.by = hit.id;
          const pts = Math.max(1, Math.round(o.r*o.r/25));
          hit.score += pts; hit.ate[o.t]++; grow(hit, o.r*o.r);
          hit.combo++; hit.comboT = 0.7;
          g.events.push({ type:'eat', id: hit.id, t: o.t, pts, x: o.x, y: o.y, combo: hit.combo });
        } else { // 가장자리에 걸림: 구멍 쪽으로 미끄러짐
          const dx = hit.x - o.x, dy = hit.y - o.y, m = hd || 1, s = (90 + hit.r*2)*dt;
          o.x += dx/m*s; o.y += dy/m*s; o.rot += dt*3*(o.id % 2 ? 1 : -1);
        }
      }
      // 구멍끼리
      for(const a of holes){ if(a.dead) continue;
        for(const b of holes){ if(a === b || b.dead || b.shield > 0 || !(a.r > b.r*P.holeK)) continue;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if(d < a.r - b.r*0.8){
            const pts = Math.round(b.r*b.r/25) + 10;
            a.score += pts; a.holesEaten++; grow(a, b.r*b.r*0.3);
            b.timesEaten++; b.dead = P.respawn; b.r = Math.max(P.r0, b.r*P.keep); b.combo = 0;
            g.events.push({ type:'gulp', id: a.id, victim: b.id, pts, x: b.x, y: b.y });
          } } }
    };

    g.ranking = () => holes.slice().sort((a, b) => b.score - a.score || a.id - b.id);
    // 다음에 삼킬 수 있게 되는 물건과 그까지 남은 정도(0~1)
    g.nextUnlock = function(id){
      const h = holes[id];
      for(let i = 0; i < TYPES.length; i++){ const need = TYPES[i].r/P.eatK;
        if(h.r < need){ const prev = i ? TYPES[i-1].r/P.eatK : P.r0; return { t: i, p: Math.max(0, Math.min(1, (h.r - prev)/(need - prev))) }; } }
      return null;
    };
    return g;
  }

  const api = { OWNERS, DEFAULTS, TYPES, PERSONA, Game, mulberry32 };
  if(typeof module !== 'undefined') module.exports = api; else root.HoleCore = api;
})(this);
