// 「솜재페 자리 맡기」 규칙 — 화면과 떨어진 순수 로직. 게임(index.html)과 자동 대전(sim.js, node)이 같은 파일을 쓴다.
//
// 한 줄 규칙: 내 돗자리 밖으로 나가면 끈이 따라오고, 돌아오면 끈으로 두른 안쪽이 전부 내 돗자리가 된다.
//            밖에 있는 동안 누가 내 끈을 밟으면 '꽈당' — 끈을 잃고 잠깐 넘어졌다가 내 돗자리에서 다시 시작.
//            공연 시작(2분)에 가장 넓게 차지한 주민이 1등.
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
  };

  // 컴퓨터 주민 성격 — 문서 docs/MAT_기획서.md §4
  //  loop: 한 번 나갈 때 두르는 크기 / caution: 끈이 위험하면 일찍 돌아오는 정도 / chase: 남의 끈 노리는 거리
  //  wander: 엉뚱하게 꺾을 확률 / rest: 집에서 드러누울 확률 / acorn: 도토리 쫓는 거리 / speedK: 걸음 빠르기
  const PERSONA = {
    ramda:      { loop:[9,16], caution:0, chase:5, wander:0.02, rest:0,    acorn:0,  speedK:1.05 },
    bookgeo:    { loop:[3,6],  caution:4, chase:2, wander:0,    rest:0,    acorn:0,  speedK:0.9  },
    boneul:     { loop:[4,9],  caution:2, chase:3, wander:0.02, rest:0.05, acorn:0,  speedK:1    },
    migae:      { loop:[4,10], caution:1, chase:3, wander:0.14, rest:0,    acorn:0,  speedK:1    },
    lachilchin: { loop:[5,10], caution:2, chase:2, wander:0.02, rest:0,    acorn:8,  speedK:0.92 },
    kkito:      { loop:[5,10], caution:2, chase:9, wander:0.02, rest:0,    acorn:0,  speedK:1    },
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

    function stampBase(id, cx, cy){
      const r = o.base;
      for(let y=cy-r;y<=cy+r;y++) for(let x=cx-r;x<=cx+r;x++) if(inb(x,y)){ const c = idx(x,y);
        if(trail[c] >= 0){ const q = g.players[trail[c]]; if(q) clearTrail(q); }
        owner[c] = id; }
    }
    // 여섯 명을 원 위에 고르게 세운다
    const order = OWNERS.map((_,i)=>i).sort(() => rng() - 0.5);
    for(let k=0;k<6;k++){
      const id = order[k], a = (k/6)*Math.PI*2 + rng()*0.3, R = N*0.32;
      const x = Math.round(N/2 + Math.cos(a)*R), y = Math.round(N/2 + Math.sin(a)*R);
      const p = { id, key: OWNERS[id], bot: id !== me, x, y, px: x, py: y, dir: (rng()*4)|0, want: null,
        acc: 0, trail: [], stun: 0, area: 0, best: 0, kos: 0, trips: 0, acorns: 0,
        ps: PERSONA[OWNERS[id]], plan: [], mode: 'home', rest: 0 };
      g.players[id] = p;
    }
    for(const p of g.players) stampBase(p.id, p.x, p.y);

    function countAreas(){
      for(const p of g.players) p.area = 0;
      for(let c=0;c<N*N;c++) if(owner[c] >= 0) g.players[owner[c]].area++;
      for(const p of g.players) p.best = Math.max(p.best, p.area);
    }
    function clearTrail(p){ for(const c of p.trail) if(trail[c] === p.id) trail[c] = -1; p.trail = []; }

    // 끈으로 두른 안쪽 채우기 — 잔디밭 가장자리에서 '내 땅이 아닌 칸'으로 퍼져 닿지 못한 칸이 안쪽
    function capture(p){
      for(const c of p.trail){ owner[c] = p.id; trail[c] = -1; }
      const n = p.trail.length; p.trail = [];
      const seen = new Uint8Array(N*N), st = [];
      for(let i=0;i<N;i++) for(const [x,y] of [[i,0],[i,N-1],[0,i],[N-1,i]]){ const c = idx(x,y); if(!seen[c] && owner[c] !== p.id){ seen[c]=1; st.push(c); } }
      while(st.length){ const c = st.pop(), x = c%N, y = (c/N)|0;
        for(const [dx,dy] of DIRS){ const nx=x+dx, ny=y+dy; if(!inb(nx,ny)) continue; const d = idx(nx,ny);
          if(!seen[d] && owner[d] !== p.id){ seen[d]=1; st.push(d); } } }
      let gained = n;
      for(let c=0;c<N*N;c++) if(!seen[c] && owner[c] !== p.id){ owner[c] = p.id; gained++; if(trail[c] === p.id) trail[c] = -1; }
      countAreas();
      g.events.push({ t:'capture', id:p.id, n:gained });
      // 땅을 다 빼앗긴 주민은 꽈당 처리 후 새 자리
      for(const q of g.players) if(q !== p && q.area === 0 && !q.stun) trip(q, p);
    }

    function trip(q, by){
      clearTrail(q); q.stun = o.stun; q.trips++; q.plan = []; q.mode = 'home';
      if(by && by !== q) by.kos++;
      g.events.push({ t:'trip', id:q.id, by: by ? by.id : -1, x:q.x, y:q.y });
    }
    // 넘어졌다 일어나면 가장 가까운 내 돗자리 칸으로. 돗자리가 없으면 빈 곳에 새로 편다
    function respawn(q){
      let best = -1, bd = 1e9;
      for(let c=0;c<N*N;c++) if(owner[c] === q.id){ const d = Math.abs(c%N - q.x) + Math.abs(((c/N)|0) - q.y); if(d < bd){ bd = d; best = c; } }
      if(best < 0){
        let bx = 0, by = 0, bs = -1;
        for(let k=0;k<40;k++){ const x = 3 + ((rng()*(N-6))|0), y = 3 + ((rng()*(N-6))|0);
          let free = 0; for(let yy=y-2;yy<=y+2;yy++) for(let xx=x-2;xx<=x+2;xx++) if(owner[idx(xx,yy)] < 0) free++;
          if(free > bs){ bs = free; bx = x; by = y; } }
        stampBase(q.id, bx, by); countAreas(); q.x = bx; q.y = by;
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
      if(trail[c] === p.id){ trip(p, null); return; }          // 내 끈을 밟음
      p.px = p.x; p.py = p.y; p.x = nx; p.y = ny;
      // 남의 끈 밟기 / 밖에 나와 있는 주민과 부딪힘
      if(trail[c] >= 0 && trail[c] !== p.id){ const q = g.players[trail[c]]; if(!q.stun) trip(q, p); }
      for(const q of g.players) if(q !== p && !q.stun && q.x === nx && q.y === ny && q.trail.length && owner[c] !== q.id) trip(q, p);
      if(p.stun) return;
      if(owner[c] === p.id){ if(p.trail.length) capture(p); }
      else { trail[c] = p.id; p.trail.push(c); }
      const ai = g.acorns.findIndex(a => a.x === nx && a.y === ny);
      if(ai >= 0){ g.acorns.splice(ai,1); p.acorns++; g.events.push({ t:'acorn', id:p.id, x:nx, y:ny }); dropAcorn(); }
    }

    // ── 컴퓨터 주민 ──
    // 내 돗자리에서 각 칸까지 거리 (내 끈은 못 지나감)
    function homeDist(p){
      const D = new Int16Array(N*N).fill(-1), q = [];
      for(let c=0;c<N*N;c++) if(owner[c] === p.id){ D[c] = 0; q.push(c); }
      for(let h=0; h<q.length; h++){ const c = q[h], x = c%N, y = (c/N)|0;
        for(const [dx,dy] of DIRS){ const nx=x+dx, ny=y+dy; if(!inb(nx,ny)) continue; const d = idx(nx,ny);
          if(D[d] < 0 && trail[d] !== p.id){ D[d] = D[c] + 1; q.push(d); } } }
      return D;
    }
    const okDir = (p, d) => { const nx = p.x + DIRS[d][0], ny = p.y + DIRS[d][1]; return inb(nx,ny) && trail[idx(nx,ny)] !== p.id && d !== (p.dir+2)%4; };
    function toward(p, tx, ty){
      let best = -1, bd = 1e9;
      for(let d=0;d<4;d++){ if(!okDir(p,d)) continue; const nx = p.x+DIRS[d][0], ny = p.y+DIRS[d][1]; const v = Math.abs(nx-tx)+Math.abs(ny-ty) + rng()*0.3; if(v < bd){ bd = v; best = d; } }
      return best;
    }
    function decide(p){
      const s = p.ps, here = idx(p.x,p.y), home = owner[here] === p.id;
      const D = homeDist(p), dh = D[here] < 0 ? 99 : D[here];
      const goHome = () => { let best = -1, bv = 1e9; for(let d=0;d<4;d++){ if(!okDir(p,d)) continue; const v = D[idx(p.x+DIRS[d][0], p.y+DIRS[d][1])]; if(v >= 0 && v < bv){ bv = v; best = d; } } return best; };
      if(home){
        p.mode = 'home';
        if(s.rest && rng() < s.rest){ p.rest = 0.8 + rng()*1.2; return; }
        // 나갈 계획: d 방향으로 a칸 → 꺾어 b칸 → 돌아오기
        if(!p.plan.length){
          let cx = 0, cy = 0, n = 0; for(let c=0;c<N*N;c++) if(owner[c] === p.id){ cx += c%N; cy += (c/N)|0; n++; }
          cx /= n; cy /= n;
          let d = Math.abs(p.x-cx) > Math.abs(p.y-cy) ? (p.x > cx ? 0 : 2) : (p.y > cy ? 1 : 3);
          if(rng() < 0.35) d = (d + (rng()<0.5?1:3)) % 4;
          const a = s.loop[0] + ((rng()*(s.loop[1]-s.loop[0]+1))|0), b = s.loop[0] + ((rng()*(s.loop[1]-s.loop[0]+1))|0);
          const turn = rng() < 0.5 ? 1 : 3;
          p.plan = [[d, a], [(d+turn)%4, b], [(d+2)%4, a + 2]];
        }
      } else {
        // 위험: 다른 주민 머리가 내 끈 가까이 있으면 돌아간다
        let threat = 99;
        if(p.trail.length) for(const q of g.players){ if(q === p || q.stun) continue;
          for(let k=0;k<p.trail.length;k+=2){ const c = p.trail[k]; const d = Math.abs(c%N - q.x) + Math.abs(((c/N)|0) - q.y); if(d < threat) threat = d; } }
        if(p.mode !== 'return' && threat <= dh + s.caution) { p.mode = 'return'; p.plan = []; }
      }
      // 남의 끈 노리기 (집에서 멀지 않을 때)
      if(s.chase && dh <= 6){
        let tgt = null, td = s.chase + 1;
        for(const q of g.players){ if(q === p || q.stun || !q.trail.length) continue;
          for(const c of q.trail){ const d = Math.abs(c%N - p.x) + Math.abs(((c/N)|0) - p.y); if(d < td){ td = d; tgt = c; } } }
        if(tgt != null){ const d = toward(p, tgt%N, (tgt/N)|0); if(d >= 0){ p.dir = d; return; } }
      }
      // 도토리 (할머니)
      if(s.acorn && dh <= 3){
        let tgt = null, td = s.acorn + 1;
        for(const a of g.acorns){ const d = Math.abs(a.x-p.x) + Math.abs(a.y-p.y); if(d < td){ td = d; tgt = a; } }
        if(tgt){ const d = toward(p, tgt.x, tgt.y); if(d >= 0){ p.dir = d; return; } }
      }
      if(p.mode === 'return' || (!home && !p.plan.length)){ const d = goHome(); if(d >= 0) p.dir = d; return; }
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

    g.update = function(dt){
      if(g.over) return;
      g.t += dt;
      for(const p of g.players){
        if(p.stun){ p.stun -= dt; if(p.stun <= 0){ p.stun = 0; respawn(p); } continue; }
        if(p.rest > 0){ p.rest -= dt; continue; }
        p.acc += o.speed * (p.bot ? p.ps.speedK : 1) * dt;
        while(p.acc >= 1 && !p.stun){
          p.acc -= 1;
          if(p.bot) decide(p);
          else if(p.want != null){ if(p.want !== (p.dir+2)%4 || owner[idx(p.x,p.y)] === p.id && !p.trail.length) p.dir = p.want; }
          if(p.rest > 0) break;
          step(p);
        }
      }
      if(g.t >= o.time){ g.t = o.time; g.over = true; }
    };
    g.ranking = () => g.players.slice().sort((a,b) => b.area - a.area);
    g.pct = p => p.area / (N*N) * 100;
    countAreas();
    return g;
  }

  root.MatCore = { OWNERS, DIRS, DEFAULTS, PERSONA, Game, mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
