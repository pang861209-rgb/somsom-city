// 「당근빌라 창고 정리」 규칙 — 화면과 떨어진 순수 로직.
// 게임(index.html)과 자동 플레이 봇(node)이 같은 파일을 쓴다. 그래서 봇으로 잰 숫자가 곧 게임의 숫자다.
(function(root){
  const N = 8;                    // 선반 8×8
  const OWNERS = ['kkito','migae','lachilchin','ramda','boneul','bookgeo'];

  // ── 조각 ── [행, 열] 칸 목록과 나올 비중(w)
  const RAW = [
    ['1',      [[0,0]], 2],
    ['2h',     [[0,0],[0,1]], 3], ['2v', [[0,0],[1,0]], 3],
    ['3h',     [[0,0],[0,1],[0,2]], 3], ['3v', [[0,0],[1,0],[2,0]], 3],
    ['4h',     [[0,0],[0,1],[0,2],[0,3]], 2], ['4v', [[0,0],[1,0],[2,0],[3,0]], 2],
    ['5h',     [[0,0],[0,1],[0,2],[0,3],[0,4]], 1], ['5v', [[0,0],[1,0],[2,0],[3,0],[4,0]], 1],
    ['sq2',    [[0,0],[0,1],[1,0],[1,1]], 4],
    ['sq3',    [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]], 1.5],
    ['r23',    [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]], 1.5], ['r32', [[0,0],[0,1],[1,0],[1,1],[2,0],[2,1]], 1.5],
    ['l3a',    [[0,0],[1,0],[1,1]], 2], ['l3b', [[0,0],[0,1],[1,0]], 2],
    ['l3c',    [[0,0],[0,1],[1,1]], 2], ['l3d', [[0,1],[1,0],[1,1]], 2],
    ['l4a',    [[0,0],[1,0],[2,0],[2,1]], 1], ['l4b', [[0,1],[1,1],[2,0],[2,1]], 1],
    ['l4c',    [[0,0],[0,1],[1,0],[2,0]], 1], ['l4d', [[0,0],[0,1],[1,1],[2,1]], 1],
    ['l4e',    [[0,0],[0,1],[0,2],[1,0]], 1], ['l4f', [[0,0],[0,1],[0,2],[1,2]], 1],
    ['l4g',    [[0,0],[1,0],[1,1],[1,2]], 1], ['l4h', [[0,2],[1,0],[1,1],[1,2]], 1],
    ['ta',     [[0,0],[0,1],[0,2],[1,1]], 1], ['tb', [[0,1],[1,0],[1,1],[1,2]], 1],
    ['tc',     [[0,0],[1,0],[1,1],[2,0]], 1], ['td', [[0,1],[1,0],[1,1],[2,1]], 1],
    ['sa',     [[0,1],[0,2],[1,0],[1,1]], 1], ['sb', [[0,0],[0,1],[1,1],[1,2]], 1],
    ['sc',     [[0,0],[1,0],[1,1],[2,1]], 1], ['sd', [[0,1],[1,0],[1,1],[2,0]], 1],
    ['bla',    [[0,0],[1,0],[2,0],[2,1],[2,2]], 1], ['blb', [[0,0],[0,1],[0,2],[1,0],[2,0]], 1],
    ['blc',    [[0,0],[0,1],[0,2],[1,2],[2,2]], 1], ['bld', [[0,2],[1,2],[2,0],[2,1],[2,2]], 1],
  ];
  const SHAPES = RAW.map(([k, cells, w]) => {
    let h = 0, wd = 0; for(const [r,c] of cells){ h = Math.max(h, r+1); wd = Math.max(wd, c+1); }
    return { k, cells, w, h, wd, n: cells.length };
  });

  // 기본 설정 — 봇으로 맞춘 값 (docs/BLOCK_기획서.md)
  const DEFAULTS = {
    assist: 2,          // 새 조각 세 개 중 둘은 반드시 들어가게 다시 뽑는다
    helpStart: 0.8,     // 이 확률로 세 개 중 하나를 "줄을 지울 수 있는 조각"으로 (처음 → ramp조각째)
    helpEnd: 0.4,
    bigStart: 0.4,      // 5칸 이상 조각의 비중 배율 (처음 → ramp조각째)
    bigEnd: 1.1,
    ramp: 120,
    ownerMin: 6,        // 한 줄 8칸 중 같은 주인 짐이 이만큼이면 짐 주인 보너스
    comboKeep: 3,       // 이만큼 연달아 못 지우면 연속이 끊긴다
  };

  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

  function fits(b, s, r0, c0){
    if(r0 < 0 || c0 < 0 || r0 + s.h > N || c0 + s.wd > N) return false;
    for(const [r,c] of s.cells) if(b[(r0+r)*N + c0+c] >= 0) return false;
    return true;
  }
  function spots(b, s){ const out = []; for(let r=0;r<=N-s.h;r++) for(let c=0;c<=N-s.wd;c++) if(fits(b,s,r,c)) out.push([r,c]); return out; }
  function fitsAnywhere(b, s){ for(let r=0;r<=N-s.h;r++) for(let c=0;c<=N-s.wd;c++) if(fits(b,s,r,c)) return true; return false; }
  // 놓으면 지워질 줄 (놓기 전에 미리 보기용으로도 쓴다)
  function linesAfter(b, s, r0, c0){
    const t = b.slice(); for(const [r,c] of s.cells) t[(r0+r)*N + c0+c] = 9;
    const rows = [], cols = [];
    for(let r=0;r<N;r++){ let f=true; for(let c=0;c<N;c++) if(t[r*N+c] < 0){ f=false; break; } if(f) rows.push(r); }
    for(let c=0;c<N;c++){ let f=true; for(let r=0;r<N;r++) if(t[r*N+c] < 0){ f=false; break; } if(f) cols.push(c); }
    return { rows, cols };
  }
  function clearsSomething(b, s){
    for(const [r,c] of spots(b, s)){ const L = linesAfter(b, s, r, c); if(L.rows.length + L.cols.length) return true; }
    return false;
  }

  function Game(seed, opt){
    const o = Object.assign({}, DEFAULTS, opt || {});
    const rng = mulberry32(seed >>> 0);
    const W0 = SHAPES.map(s => (o.w && o.w[s.k] != null) ? o.w[s.k] : s.w);
    // 판이 길어질수록 큰 조각(5칸 이상)이 잦아지고 도움이 줄어든다 — 초반은 너그럽게, 후반은 조이게
    const ramp = () => Math.min(1, g.placed / o.ramp);
    const bigF = () => o.bigStart + (o.bigEnd - o.bigStart) * ramp();
    const helpNow = () => o.helpStart + (o.helpEnd - o.helpStart) * ramp();
    const g = {
      o, board: new Array(N*N).fill(-1), tray: [null,null,null],
      score: 0, combo: 0, miss: 0, over: false, placed: 0,
      st: { lines: 0, clears: 0, maxCombo: 0, maxMulti: 0, clearAll: 0, owner: 0, ownerBy: {}, fromClear: 0, fromBonus: 0, deals: 0 },
    };
    const pick = () => {
      const f = bigF(), W = W0.map((w,i) => SHAPES[i].n >= 5 ? w*f : w), tot = W.reduce((a,v)=>a+v,0);
      let r = rng()*tot; for(let i=0;i<SHAPES.length;i++){ r -= W[i]; if(r <= 0) return SHAPES[i]; } return SHAPES[0]; };
    const piece = s => ({ s, owner: (rng()*OWNERS.length)|0 });
    g.deal = function(){
      let set = [piece(pick()), piece(pick()), piece(pick())];
      if(o.assist){
        const need = o.assist >= 2 ? 2 : 1;
        for(let k=0; k<30 && set.filter(p => fitsAnywhere(g.board, p.s)).length < need; k++) set = [piece(pick()), piece(pick()), piece(pick())];
      }
      if(rng() < helpNow() && !set.some(p => clearsSomething(g.board, p.s))){
        for(let k=0; k<40; k++){ const s = pick(); if(clearsSomething(g.board, s)){ set[(rng()*3)|0] = piece(s); break; } }
      }
      g.tray = set; g.st.deals++;
      g.checkOver();
    };
    g.checkOver = function(){
      const left = g.tray.filter(Boolean);
      g.over = left.length > 0 && !left.some(p => fitsAnywhere(g.board, p.s));
      return g.over;
    };
    // i번째 조각을 (r0,c0)에 놓는다. 결과: 지운 줄·얻은 점수·연속 등 (연출용)
    g.place = function(i, r0, c0){
      const p = g.tray[i];
      if(!p || g.over || !fits(g.board, p.s, r0, c0)) return null;
      for(const [r,c] of p.s.cells) g.board[(r0+r)*N + c0+c] = p.owner;
      g.tray[i] = null; g.placed++;
      let gained = p.s.n;                              // 놓은 칸마다 1점
      const L = linesAfter(g.board, {cells:[],h:0,wd:0}, 0, 0);
      const nL = L.rows.length + L.cols.length;
      const res = { owner: p.owner, cells: p.s.cells.map(([r,c]) => [r0+r, c0+c]), rows: L.rows, cols: L.cols,
                    nL, gained: 0, combo: 0, ownerLines: [], clearAll: false, removed: [] };
      if(nL){
        g.combo++; g.miss = 0;
        const mul = Math.min(8, 1 + 0.5*(g.combo-1));
        // 짐 주인 보너스 — 한 줄에 같은 주인 짐이 ownerMin칸 이상
        const lineCells = [];
        for(const r of L.rows){ const cs=[]; for(let c=0;c<N;c++) cs.push([r,c]); lineCells.push(cs); }
        for(const c of L.cols){ const cs=[]; for(let r=0;r<N;r++) cs.push([r,c]); lineCells.push(cs); }
        for(const cs of lineCells){
          const cnt = {}; for(const [r,c] of cs){ const w = g.board[r*N+c]; cnt[w] = (cnt[w]||0) + 1; }
          for(const w in cnt) if(cnt[w] >= o.ownerMin){ res.ownerLines.push(+w); g.st.owner++; g.st.ownerBy[OWNERS[w]] = (g.st.ownerBy[OWNERS[w]]||0)+1; }
        }
        const base = 10 * nL * (nL+1) / 2;
        const bonus = res.ownerLines.length ? base * res.ownerLines.length / nL : 0;
        const kill = new Set(); for(const cs of lineCells) for(const [r,c] of cs) kill.add(r*N+c);
        for(const k of kill){ res.removed.push([Math.floor(k/N), k%N, g.board[k]]); g.board[k] = -1; }
        let clr = Math.round((base + bonus) * mul);
        g.st.fromBonus += Math.round(bonus * mul);
        if(g.board.every(v => v < 0)){ res.clearAll = true; g.st.clearAll++; const cb = Math.round(300*mul); clr += cb; g.st.fromBonus += cb; }
        gained += clr; g.st.fromClear += clr;
        g.st.lines += nL; g.st.clears++; g.st.maxMulti = Math.max(g.st.maxMulti, nL);
        g.st.maxCombo = Math.max(g.st.maxCombo, g.combo);
        res.combo = g.combo; res.mul = mul;
      } else {
        g.miss++; if(g.miss >= o.comboKeep){ g.combo = 0; }
        res.combo = g.combo;
      }
      g.score += gained; res.gained = gained;
      if(!g.tray.some(Boolean)) g.deal(); else g.checkOver();
      res.over = g.over;
      return res;
    };
    // 이어하기 — 저장/복원 (난수 상태는 저장하지 않으므로 복원 후 조각은 새 씨앗으로 뽑는다)
    g.snapshot = () => JSON.stringify({ b:g.board, t:g.tray.map(p => p ? [p.s.k, p.owner] : null),
      s:g.score, co:g.combo, mi:g.miss, pl:g.placed, st:g.st });
    g.deal();
    return g;
  }
  function restore(json, seed, opt){
    const d = JSON.parse(json), g = Game(seed, opt);
    g.board = d.b; g.tray = d.t.map(x => x ? { s: SHAPES.find(s=>s.k===x[0]), owner: x[1] } : null);
    g.score = d.s; g.combo = d.co; g.miss = d.mi; g.placed = d.pl; g.st = d.st;
    if(!g.tray.some(Boolean)) g.deal(); else g.checkOver();
    return g;
  }

  root.BoxCore = { N, OWNERS, SHAPES, DEFAULTS, Game, restore, fits, spots, fitsAnywhere, linesAfter, mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
