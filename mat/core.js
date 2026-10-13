// 「솜재페 자리 맡기」 규칙 — 화면과 떨어진 순수 로직. 게임(index.html)과 자동 대전(sim.js, node)이 같은 파일을 쓴다.
//
// 한 줄 규칙: 내 돗자리 밖으로 나가면 끈이 따라오고, 돌아오면 끈으로 두른 안쪽이 전부 내 돗자리가 된다.
//            밖에 있는 동안 누가 내 끈을 밟으면 '꽈당' — 끈을 잃고 잠깐 넘어졌다가 내 돗자리에서 다시 시작.
//            공연 시작(2분)에 가장 넓게 차지한 주민이 1등.
// v2 (10/13): 주민마다 고유 기술 1개(버튼), 컴퓨터 주민이 남의 끈 — 특히 사람의 끈 — 을 적극적으로 노림.
(function(root){
  const OWNERS = ['kkito','migae','lachilchin','ramda','boneul','bookgeo'];
  const DIRS = [[1,0],[0,1],[-1,0],[0,-1]];   // 오른쪽·아래·왼쪽·위

  const DEFAULTS = {
    N: 48,             // 잔디밭 한 변 칸 수
    time: 120,         // 한 판 2분
    speed: 6.5,        // 초당 칸
    stun: 1.6,         // 꽈당 후 넘어져 있는 시간
    base: 2,           // 시작 돗자리 반지름 (2면 5×5)
    acorns: 6,         // 잔디밭에 떨어져 있는 도토리 수
    skillStart: 4,     // 판 시작 뒤 기술을 처음 쓸 수 있을 때까지 초
    botLevel: 1,       // 컴퓨터 실력 배율 (사냥 거리·욕심). 1 = 기본
  };

  // 주민 기술 — 설정에서 가져옴 (docs/MAT_기획서.md §4)
  const SKILL = {
    ramda:      { n:'질주',   d:'2.5초 동안 아주 빨라져요',                 cd:14 },
    bookgeo:    { n:'등딱지', d:'3초 동안 내 끈을 밟혀도 안 넘어져요',       cd:16 },
    lachilchin: { n:'실타래', d:'지금 자리에서 내 돗자리까지 끈을 바로 이어요', cd:22 },
    kkito:      { n:'쫑긋',   d:'가까운 주민들이 놀라 3초 동안 느려져요',     cd:15 },
    boneul:     { n:'털썩',   d:'그 자리에 드러누워 둘레를 내 돗자리로',      cd:20 },
    migae:      { n:'개미굴', d:'2.5초 동안 땅속으로. 끈 없이 다니고 안 넘어져요', cd:16 },
  };

  // 컴퓨터 주민 성격
  //  loop: 한 번 나갈 때 두르는 크기 / caution: 위험하면 일찍 돌아오는 여유 / hunt: 남의 끈을 노리는 거리 / greed: 위험해도 버티는 정도
  //  wander: 엉뚱하게 꺾을 확률 / rest: 집에서 드러누울 확률 / acorn: 도토리 쫓는 거리 / speedK: 걸음 빠르기
  const PERSONA = {
    ramda:      { loop:[10,20], caution:0, hunt:10, greed:2, wander:0.01, rest:0,    acorn:0,  speedK:1    },
    bookgeo:    { loop:[7,13],  caution:2, hunt:6,  greed:0, wander:0,    rest:0,    acorn:0,  speedK:0.97 },
    boneul:     { loop:[8,15],  caution:1, hunt:7,  greed:1, wander:0.01, rest:0.012, acorn:0, speedK:1    },
    migae:      { loop:[7,15],  caution:1, hunt:9,  greed:1, wander:0.08, rest:0,    acorn:0,  speedK:1.06 },
    lachilchin: { loop:[7,13],  caution:2, hunt:6,  greed:1, wander:0.01, rest:0,    acorn:8,  speedK:0.93 },
    kkito:      { loop:[7,14],  caution:1, hunt:14, greed:1, wander:0.01, rest:0,    acorn:0,  speedK:1    },
  };

  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

  // me: 플레이어가 고른 주민 번호(0~5). null이면 여섯 모두 컴퓨터 (자동 대전용)
  function Game(seed, me, opt){
    const o = Object.assign({}, DEFAULTS, opt || {});
    const N = o.N, rng = mulberry32(seed >>> 0);
    const owner = new Int8Array(N*N).fill(-1), trail = new Int8Array(N*N).fill(-1);
    const g = { o, N, owner, trail, t: 0, over: false, players: [], acorns: [], events: [] };
    const idx = (x,y) => y*N + x;
    const inb = (x,y) => x >= 0 && y >= 0 && x < N && y < N;
    const man = (c, x, y) => Math.abs(c%N - x) + Math.abs(((c/N)|0) - y);

    // 여섯 명을 원 위에 고르게 세운다
    const order = OWNERS.map((_,i)=>i).sort(() => rng() - 0.5);
    for(let k=0;k<6;k++){
      const id = order[k], a = (k/6)*Math.PI*2 + rng()*0.3, R = N*0.32;
      const x = Math.round(N/2 + Math.cos(a)*R), y = Math.round(N/2 + Math.sin(a)*R);
      const p = { id, key: OWNERS[id], bot: id !== me, x, y, px: x, py: y, dir: (rng()*4)|0, want: null,
        acc: 0, trail: [], stun: 0, area: 0, best: 0, kos: 0, trips: 0, acorns: 0, maxCap: 0,
        ps: PERSONA[OWNERS[id]], plan: [], mode: 'home', rest: 0,
        cool: o.skillStart, boost: 0, shell: 0, slow: 0, under: 0, skills: 0 };
      g.players[id] = p;
    }
    function stampArea(id, cx, cy, r, by){
      for(let y=cy-r;y<=cy+r;y++) for(let x=cx-r;x<=cx+r;x++) if(inb(x,y)){ const c = idx(x,y);
        if(trail[c] >= 0 && trail[c] !== id){ const q = g.players[trail[c]]; if(q && !q.stun) trip(q, by || null); }
        if(trail[c] === id) trail[c] = -1;
        owner[c] = id; }
    }
    for(const p of g.players) stampArea(p.id, p.x, p.y, o.base);

    function countAreas(){
      for(const p of g.players) p.area = 0;
      for(let c=0;c<N*N;c++) if(owner[c] >= 0) g.players[owner[c]].area++;
      for(const p of g.players) p.best = Math.max(p.best, p.area);
    }
    function clearTrail(p){ for(const c of p.trail) if(trail[c] === p.id) trail[c] = -1; p.trail = []; }

    // 끈으로 두른 안쪽 채우기 — 잔디밭 가장자리에서 '내 땅이 아닌 칸'으로 퍼져 닿지 못한 칸이 안쪽
    function capture(p){
      for(const c of p.trail){ owner[c] = p.id; if(trail[c] === p.id) trail[c] = -1; }
      const n = p.trail.length; p.trail = [];
      const seen = new Uint8Array(N*N), st = [];
      for(let i=0;i<N;i++) for(const [x,y] of [[i,0],[i,N-1],[0,i],[N-1,i]]){ const c = idx(x,y); if(!seen[c] && owner[c] !== p.id){ seen[c]=1; st.push(c); } }
      while(st.length){ const c = st.pop(), x = c%N, y = (c/N)|0;
        for(const [dx,dy] of DIRS){ const nx=x+dx, ny=y+dy; if(!inb(nx,ny)) continue; const d = idx(nx,ny);
          if(!seen[d] && owner[d] !== p.id){ seen[d]=1; st.push(d); } } }
      let gained = n;
      for(let c=0;c<N*N;c++) if(!seen[c] && owner[c] !== p.id){ owner[c] = p.id; gained++; if(trail[c] === p.id) trail[c] = -1; }
      countAreas();
      p.maxCap = Math.max(p.maxCap, gained);
      g.events.push({ t:'capture', id:p.id, n:gained });
      // 땅을 다 빼앗긴 주민은 꽈당 처리 후 새 자리
      for(const q of g.players) if(q !== p && q.area === 0 && !q.stun) trip(q, p);
    }

    function trip(q, by){
      clearTrail(q); q.stun = o.stun; q.trips++; q.plan = []; q.mode = 'home'; q.boost = 0; q.shell = 0; q.under = 0;
      if(by && by !== q) by.kos++;
      g.events.push({ t:'trip', id:q.id, by: by ? by.id : -1, x:q.x, y:q.y });
    }
    // 넘어졌다 일어나면 가장 가까운 내 돗자리 칸으로. 돗자리가 없으면 빈 곳에 새로 편다
    function respawn(q){
      let best = -1, bd = 1e9;
      for(let c=0;c<N*N;c++) if(owner[c] === q.id){ const d = man(c, q.x, q.y); if(d < bd){ bd = d; best = c; } }
      if(best < 0){
        let bx = 0, by = 0, bs = -1;
        for(let k=0;k<40;k++){ const x = 3 + ((rng()*(N-6))|0), y = 3 + ((rng()*(N-6))|0);
          let free = 0; for(let yy=y-2;yy<=y+2;yy++) for(let xx=x-2;xx<=x+2;xx++) if(owner[idx(xx,yy)] < 0) free++;
          if(free > bs){ bs = free; bx = x; by = y; } }
        stampArea(q.id, bx, by, o.base); countAreas(); q.x = bx; q.y = by;
      } else { q.x = best % N; q.y = (best/N)|0; }
      q.px = q.x; q.py = q.y; q.acc = 0;
    }

    function dropAcorn(){ for(let k=0;k<30;k++){ const x=(rng()*N)|0, y=(rng()*N)|0; if(!g.acorns.some(a=>a.x===x&&a.y===y)){ g.acorns.push({x,y}); return; } } }
    for(let i=0;i<o.acorns;i++) dropAcorn();

    // 한 칸 이동
    function step(p){
      const [dx,dy] = DIRS[p.dir], nx = p.x + dx, ny = p.y + dy;
      if(!inb(nx,ny)){ p.acc = 0; return; }
      const c = idx(nx,ny);
      if(trail[c] === p.id && !p.under){ trip(p, null); return; }          // 내 끈을 밟음
      p.px = p.x; p.py = p.y; p.x = nx; p.y = ny;
      if(!p.under){
        // 남의 끈 밟기 (북거씨 등딱지 중이면 안 넘어짐)
        if(trail[c] >= 0 && trail[c] !== p.id){ const q = g.players[trail[c]]; if(!q.stun && !q.shell) trip(q, p); }
        // 밖에 나와 있는 주민과 부딪힘
        for(const q of g.players) if(q !== p && !q.stun && !q.under && !q.shell && q.x === nx && q.y === ny && q.trail.length && owner[c] !== q.id) trip(q, p);
      }
      if(p.stun) return;
      if(owner[c] === p.id){ if(p.trail.length) capture(p); }
      else if(!p.under){ trail[c] = p.id; p.trail.push(c); }
      const ai = g.acorns.findIndex(a => a.x === nx && a.y === ny);
      if(ai >= 0){ g.acorns.splice(ai,1); p.acorns++; g.events.push({ t:'acorn', id:p.id, x:nx, y:ny }); dropAcorn(); }
    }

    // ── 내 돗자리에서 각 칸까지 거리 (내 끈은 못 지나감) — 판마다 한 번에 몰아서 계산 ──
    function homeDist(p){
      const D = new Int16Array(N*N).fill(-1), q = [];
      for(let c=0;c<N*N;c++) if(owner[c] === p.id){ D[c] = 0; q.push(c); }
      for(let h=0; h<q.length; h++){ const c = q[h], x = c%N, y = (c/N)|0;
        for(const [dx,dy] of DIRS){ const nx=x+dx, ny=y+dy; if(!inb(nx,ny)) continue; const d = idx(nx,ny);
          if(D[d] < 0 && trail[d] !== p.id){ D[d] = D[c] + 1; q.push(d); } } }
      return D;
    }

    // ── 기술 ──
    g.canSkill = p => !p.stun && p.cool <= 0 && !g.over;
    g.useSkill = function(id){
      const p = g.players[id]; if(!g.canSkill(p)) return false;
      const k = p.key;
      if(k === 'ramda') p.boost = 2.5;
      else if(k === 'bookgeo') p.shell = 3;
      else if(k === 'migae') p.under = 2.5;
      else if(k === 'kkito'){ for(const q of g.players) if(q !== p && !q.stun && Math.abs(q.x-p.x) + Math.abs(q.y-p.y) <= 9) q.slow = 3; }
      else if(k === 'boneul'){
        p.rest = 1.0;
        stampArea(p.id, p.x, p.y, 2, p);
        if(p.trail.length) capture(p); else countAreas();
      }
      else if(k === 'lachilchin'){
        if(!p.trail.length || owner[idx(p.x,p.y)] === p.id) return false;
        // 지금 자리에서 가장 가까운 내 돗자리까지 실을 이어 그 길까지 끈으로 친다
        // 지금 선 칸은 내 끈이라 거리표에 없음 — 옆 칸 중 가장 가까운 곳에서 출발
        const D = homeDist(p); let cx = p.x, cy = p.y, guard = 0, near = 1e9;
        for(const [dx,dy] of DIRS){ const nx = cx+dx, ny = cy+dy; if(inb(nx,ny) && D[idx(nx,ny)] >= 0) near = Math.min(near, D[idx(nx,ny)]); }
        if(near > 24) return false;
        const path = [idx(cx,cy)];
        while(owner[idx(cx,cy)] !== p.id && guard++ < 60){
          let best = null, bv = 1e9;
          for(const [dx,dy] of DIRS){ const nx = cx+dx, ny = cy+dy; if(!inb(nx,ny)) continue; const v = D[idx(nx,ny)]; if(v >= 0 && v < bv){ bv = v; best = [nx,ny]; } }
          if(!best) break; cx = best[0]; cy = best[1]; const c = idx(cx,cy); path.push(c);
          if(owner[c] !== p.id){ if(trail[c] >= 0 && trail[c] !== p.id){ const q = g.players[trail[c]]; if(!q.stun && !q.shell) trip(q, p); } trail[c] = p.id; p.trail.push(c); }
        }
        p.yarn = path;
        capture(p);
      }
      p.cool = SKILL[k].cd; p.skills++;
      g.events.push({ t:'skill', id:p.id, k, x:p.x, y:p.y, path: k === 'lachilchin' ? p.yarn : null });
      return true;
    };

    // ── 컴퓨터 주민 ──
    const okDir = (p, d) => { const nx = p.x + DIRS[d][0], ny = p.y + DIRS[d][1]; return inb(nx,ny) && (p.under || trail[idx(nx,ny)] !== p.id) && d !== (p.dir+2)%4; };
    function toward(p, tx, ty){
      let best = -1, bd = 1e9;
      for(let d=0;d<4;d++){ if(!okDir(p,d)) continue; const nx = p.x+DIRS[d][0], ny = p.y+DIRS[d][1]; const v = Math.abs(nx-tx)+Math.abs(ny-ty) + rng()*0.3; if(v < bd){ bd = v; best = d; } }
      return best;
    }
    let HD = null, hdT = -1;                     // 모든 주민의 집까지 거리 — 같은 걸음 안에서는 다시 안 셈
    function dists(){ if(hdT !== g.stepNo){ HD = g.players.map(homeDist); hdT = g.stepNo; } return HD; }
    // 다른 주민 머리 중 내 끈에 가장 가까운 거리
    function threatOf(p){ if(!p.trail.length || p.shell) return 99; let m = 99;
      for(const q of g.players){ if(q === p || q.stun || q.under) continue;
        for(let k=0;k<p.trail.length;k++){ const d = man(p.trail[k], q.x, q.y); if(d < m) m = d; } }
      return m; }
    function botSkill(p, ctx){
      if(p.cool > 0 || p.stun) return;
      const k = p.key, tl = p.trail.length;
      if(k === 'ramda'   && ((ctx.hunting && ctx.huntD > 3) || (ctx.returning && ctx.dh > 5))) g.useSkill(p.id);
      else if(k === 'bookgeo' && tl >= 4 && ctx.threat <= 5) g.useSkill(p.id);
      else if(k === 'lachilchin' && tl >= 8 && ctx.threat <= ctx.dh + 1) g.useSkill(p.id);
      else if(k === 'kkito' && ((ctx.hunting && ctx.huntD <= 6) || (tl && ctx.threat <= 4))) g.useSkill(p.id);
      else if(k === 'boneul' && tl >= 3) g.useSkill(p.id);
      else if(k === 'migae' && ((tl >= 4 && ctx.threat <= 4) || (ctx.returning && ctx.dh > 6))) g.useSkill(p.id);
    }
    function decide(p){
      const s = p.ps, L = o.botLevel, here = idx(p.x,p.y), home = owner[here] === p.id;
      const AD = dists(), D = AD[p.id], dh = D[here] < 0 ? 99 : D[here];
      const goHome = () => { let best = -1, bv = 1e9; for(let d=0;d<4;d++){ if(!okDir(p,d)) continue; const v = D[idx(p.x+DIRS[d][0], p.y+DIRS[d][1])]; if(v >= 0 && v < bv){ bv = v; best = d; } } return best; };
      const threat = threatOf(p);
      // 사냥: 남의 끈 중 '그 주민이 집에 닿기 전에 내가 먼저 밟을 수 있는' 칸. 사람의 끈을 더 좋아함
      let hunt = null, huntD = 99, bestScore = -1e9;
      const range = s.hunt * L;
      for(const q of g.players){ if(q === p || q.stun || q.shell || q.under || !q.trail.length) continue;
        const qh = AD[q.id][idx(q.x,q.y)]; const qHome = qh < 0 ? 30 : qh;
        for(let k=0;k<q.trail.length;k++){ const c = q.trail[k], d = man(c, p.x, p.y); if(d > range) continue;
          const lead = qHome + 1 - d;                         // 양수면 내가 먼저 닿음
          if(lead < -1) continue;
          const score = lead*2 - d*0.5 + (q.bot ? 0 : 6*L) + q.trail.length*0.15;
          if(score > bestScore){ bestScore = score; hunt = c; huntD = d; } } }
      // 내 끈이 길면 사냥보다 귀가가 먼저 (욕심 많은 주민은 덜 신경 씀)
      if(hunt != null && p.trail.length > 6 + s.greed*4 && threat <= dh + 2) hunt = null;
      const ctx = { threat, dh, hunting: hunt != null, huntD, returning: p.mode === 'return' };
      botSkill(p, ctx);
      if(hunt != null){ const d = toward(p, hunt%N, (hunt/N)|0); if(d >= 0){ p.dir = d; p.mode = 'hunt'; return; } }
      if(p.mode === 'hunt') p.mode = home ? 'home' : 'return';

      if(home){
        p.mode = 'home';
        if(s.rest && rng() < s.rest){ p.rest = 0.8 + rng()*1.0; return; }
        if(!p.plan.length){
          // 나갈 방향: 가장 가까운 남의 머리에서 먼 쪽, 남의 돗자리를 파고드는 쪽을 더 좋아함
          let best = 0, bv = -1e9;
          for(let d=0; d<4; d++){ const ex = p.x + DIRS[d][0]*6, ey = p.y + DIRS[d][1]*6; if(!inb(Math.max(0,Math.min(N-1,ex)), Math.max(0,Math.min(N-1,ey)))) continue;
            let near = 99; for(const q of g.players){ if(q === p || q.stun) continue; near = Math.min(near, Math.abs(q.x-ex) + Math.abs(q.y-ey)); }
            const edge = Math.min(ex, ey, N-1-ex, N-1-ey);
            const v = Math.min(near, 14) + (edge < 2 ? -8 : 0) + rng()*4;
            if(v > bv){ bv = v; best = d; } }
          // 안전할수록 크게
          let safe = 99; for(const q of g.players){ if(q === p || q.stun) continue; safe = Math.min(safe, Math.abs(q.x-p.x) + Math.abs(q.y-p.y)); }
          const lo = s.loop[0], hi = Math.max(lo, Math.min(s.loop[1], Math.round(safe*0.55*L + s.greed*2)));
          const a = lo + ((rng()*(hi-lo+1))|0), b = lo + ((rng()*(hi-lo+1))|0);
          const turn = rng() < 0.5 ? 1 : 3;
          p.plan = [[best, a], [(best+turn)%4, b], [(best+2)%4, a + 2]];
        }
      } else if(p.mode !== 'return' && threat <= dh + s.caution - s.greed + 1) { p.mode = 'return'; p.plan = []; }
      // 도토리 (할머니)
      if(s.acorn && dh <= 3){
        let tgt = null, td = s.acorn + 1;
        for(const a of g.acorns){ const d = Math.abs(a.x-p.x) + Math.abs(a.y-p.y); if(d < td){ td = d; tgt = a; } }
        if(tgt){ const d = toward(p, tgt.x, tgt.y); if(d >= 0){ p.dir = d; return; } }
      }
      if(p.mode === 'return' || (!home && !p.plan.length)){ p.mode = 'return'; const d = goHome(); if(d >= 0) p.dir = d; return; }
      if(s.wander && !home && rng() < s.wander){ const ds = [0,1,2,3].filter(d => okDir(p,d)); if(ds.length){ p.dir = ds[(rng()*ds.length)|0]; return; } }
      if(p.plan.length){
        const cur = p.plan[0];
        if(okDir(p, cur[0]) || (home && cur[0] === (p.dir+2)%4)){ p.dir = cur[0]; if(!home || p.trail.length) cur[1]--; if(cur[1] <= 0) p.plan.shift(); }
        else { p.plan = []; p.mode = 'return'; const d = goHome(); if(d >= 0) p.dir = d; }
        if(!home && p.mode !== 'return' && !p.plan.length) p.mode = 'return';
      }
    }

    // 사람 조작: 원하는 방향 (반대 방향으로 바로 꺾기는 무시 — 내 끈을 밟는 사고 방지)
    g.setDir = function(d){ const me = g.players.find(p => !p.bot); if(me) me.want = d; };
    g.stepNo = 0;

    g.update = function(dt){
      if(g.over) return;
      g.t += dt;
      for(const p of g.players){
        if(g.t > o.skillStart || p.cool > o.skillStart) p.cool = Math.max(0, p.cool - dt);
        p.boost = Math.max(0, p.boost - dt); p.shell = Math.max(0, p.shell - dt); p.slow = Math.max(0, p.slow - dt);
        if(p.under > 0){ p.under = Math.max(0, p.under - dt); if(!p.under) g.events.push({ t:'surface', id:p.id }); }
        if(p.stun){ p.stun -= dt; if(p.stun <= 0){ p.stun = 0; respawn(p); } continue; }
        if(p.rest > 0){ p.rest -= dt; continue; }
        const sp = (p.bot ? p.ps.speedK : 1) * (p.boost ? 1.6 : 1) * (p.slow ? 0.5 : 1);
        p.acc += o.speed * sp * dt;
        while(p.acc >= 1 && !p.stun){
          p.acc -= 1; g.stepNo++;
          if(p.bot) decide(p);
          else if(p.want != null){ if(p.want !== (p.dir+2)%4 || owner[idx(p.x,p.y)] === p.id && !p.trail.length) p.dir = p.want; }
          if(p.rest > 0) break;
          step(p);
        }
      }
      if(g.t >= o.time){ g.t = o.time; g.over = true; }
    };
    // 내 끈이 얼마나 위험한가: 가장 가까운 다른 주민 머리에서 내 끈까지 칸 수 (끈이 없으면 Infinity)
    g.danger = function(p){
      if(!p.trail.length || p.shell) return Infinity; let m = Infinity;
      for(const q of g.players){ if(q === p || q.stun || q.under) continue;
        for(const c of p.trail){ const d = man(c, q.x, q.y); if(d < m) m = d; } }
      return m;
    };
    g.ranking = () => g.players.slice().sort((a,b) => b.area - a.area);
    g.pct = p => p.area / (N*N) * 100;
    countAreas();
    return g;
  }

  root.MatCore = { OWNERS, DIRS, DEFAULTS, PERSONA, SKILL, Game, mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
