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
    cardMax: 2,         // 친구 도움 카드를 한 번에 들고 있을 수 있는 수
    cardStart: 1,       // 판을 시작할 때 받는 카드 수
    earnEvery: 3,       // 짐 주인 보너스 이만큼마다 카드 한 장 (봇: 1·1이면 한 판이 두 배로 길어져 줄임)
  };

  // ── 친구 도움 카드 (v1.1) ── 짐 주인 보너스를 받으면 그 친구 카드가 한 장 생긴다
  //  kkito 돌려 놓기 · migae 바꿔 오기 · lachilchin 되돌리기 · ramda 단추로 바꾸기 · boneul 한 줄 치우기 · bookgeo 다음 정리 두 배
  const CARD = {
    kkito:      { n:'돌려 놓기',   d:'상자 하나를 90도 돌려요',            pick:true },
    migae:      { n:'바꿔 오기',   d:'아래 상자를 새로 받아 와요',          pick:false },
    lachilchin: { n:'되돌리기',    d:'방금 놓은 상자를 되돌려요',           pick:false },
    ramda:      { n:'단추로 바꾸기', d:'상자 하나를 한 칸짜리 단추로 바꿔요', pick:true },
    boneul:     { n:'한 줄 치우기', d:'가장 꽉 찬 줄을 굴러서 치워요',       pick:false },
    bookgeo:    { n:'향수 한 방울', d:'다음 정리 점수가 두 배',              pick:false },
  };
  // 조각을 90도 돌린 모양 — 같은 모양이 목록에 있으면 그걸 쓴다
  const keyOf = cells => cells.map(([r,c])=>r*10+c).sort((a,b)=>a-b).join(',');
  function rotateShape(s){
    let cells = s.cells.map(([r,c]) => [c, s.h-1-r]);
    const k = keyOf(cells), hit = SHAPES.find(x => keyOf(x.cells) === k);
    if(hit) return hit;
    let h=0, wd=0; for(const [r,c] of cells){ h=Math.max(h,r+1); wd=Math.max(wd,c+1); }
    return { k: s.k+'r', cells, w:0, h, wd, n: cells.length };
  }

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
      score: 0, combo: 0, miss: 0, over: false, stuck: false, placed: 0,
      cards: {}, boost: false, prev: null,
      st: { lines: 0, clears: 0, maxCombo: 0, maxMulti: 0, clearAll: 0, owner: 0, ownerBy: {}, fromClear: 0, fromBonus: 0, deals: 0, cardsGot: 0, cardsUsed: 0, saved: 0 },
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
    g.cardCount = () => Object.values(g.cards).reduce((a,v)=>a+v, 0);
    g.addCard = function(k){ if(g.cardCount() >= o.cardMax) return false; g.cards[k] = (g.cards[k]||0) + 1; g.st.cardsGot++; return true; };
    // 이 카드를 지금 쓸 수 있나 (막혔을 때 살릴 수 있는지도 같이 본다)
    g.canUse = function(k, i){
      if(!g.cards[k]) return false;
      const tray = g.tray.map((p,j)=>[p,j]).filter(([p])=>p);
      if(k === 'kkito')      return i == null ? tray.some(([p]) => rotateShape(p.s).k !== p.s.k) : !!g.tray[i] && rotateShape(g.tray[i].s).k !== g.tray[i].s.k;
      if(k === 'ramda')      return i == null ? tray.some(([p]) => p.s.n > 1) : !!g.tray[i] && g.tray[i].s.n > 1;
      if(k === 'lachilchin') return !!g.prev;
      if(k === 'migae')      return tray.length > 0;
      if(k === 'boneul')     return g.board.some(v => v >= 0);
      if(k === 'bookgeo')    return !g.boost;
      return false;
    };
    // 막혔을 때 이 카드로 살아날 수 있나
    g.rescues = function(k){
      if(!g.cards[k]) return false;
      if(k === 'kkito') return g.tray.some(p => p && fitsAnywhere(g.board, rotateShape(p.s)));
      if(k === 'ramda') return g.board.some(v => v < 0);
      return k === 'lachilchin' ? !!g.prev : (k === 'migae' || k === 'boneul');
    };
    g.checkOver = function(){
      const left = g.tray.filter(Boolean);
      g.stuck = left.length > 0 && !left.some(p => fitsAnywhere(g.board, p.s));
      // 막혔어도 살릴 카드가 있으면 아직 끝이 아니다
      g.over = g.stuck && !OWNERS.some(k => g.rescues(k));
      return g.over;
    };
    g.giveUp = function(){ g.over = true; };
    g.useCard = function(k, i){
      if(!g.canUse(k, i)) return null;
      const res = { k };
      if(k === 'kkito'){ g.tray[i] = { s: rotateShape(g.tray[i].s), owner: g.tray[i].owner }; }
      else if(k === 'ramda'){ g.tray[i] = { s: SHAPES[0], owner: 3 }; }
      else if(k === 'lachilchin'){ const p = JSON.parse(g.prev); Object.assign(g, restoreState(p)); g.prev = null; res.undo = true; }
      else if(k === 'migae'){
        const idx = g.tray.map((p,j)=>p?j:-1).filter(j=>j>=0);
        for(let t=0;t<30;t++){ for(const j of idx) g.tray[j] = piece(pick()); if(g.tray.some(p => p && fitsAnywhere(g.board, p.s))) break; }
      }
      else if(k === 'boneul'){
        let best = null, bc = -1;
        for(let r=0;r<N;r++){ let c=0; for(let x=0;x<N;x++) if(g.board[r*N+x] >= 0) c++; if(c > bc){ bc = c; best = ['r', r]; } }
        for(let x=0;x<N;x++){ let c=0; for(let r=0;r<N;r++) if(g.board[r*N+x] >= 0) c++; if(c > bc){ bc = c; best = ['c', x]; } }
        res.removed = []; res.line = best;
        for(let j=0;j<N;j++){ const at = best[0]==='r' ? best[1]*N+j : j*N+best[1]; if(g.board[at] >= 0){ res.removed.push([Math.floor(at/N), at%N, g.board[at]]); g.board[at] = -1; } }
      }
      else if(k === 'bookgeo'){ g.boost = true; }
      g.cards[k]--; if(!g.cards[k]) delete g.cards[k];
      g.st.cardsUsed++; if(g.stuck) g.st.saved++;
      if(k !== 'lachilchin') g.prev = null;
      g.checkOver();
      res.over = g.over;
      return res;
    };
    const stateOf = () => ({ b:g.board.slice(), t:g.tray.map(p => p ? [p.s.k, p.owner, p.s.k.endsWith('r') ? p.s.cells : null] : null),
      s:g.score, co:g.combo, mi:g.miss, pl:g.placed, st:JSON.parse(JSON.stringify(g.st)), ca:Object.assign({}, g.cards), bo:g.boost });
    const restoreState = d => ({ board:d.b, tray:d.t.map(x => x ? { s: shapeFrom(x), owner:x[1] } : null),
      score:d.s, combo:d.co, miss:d.mi, placed:d.pl, st:d.st, cards:d.ca||{}, boost:!!d.bo });
    // i번째 조각을 (r0,c0)에 놓는다. 결과: 지운 줄·얻은 점수·연속 등 (연출용)
    g.place = function(i, r0, c0){
      const p = g.tray[i];
      if(!p || g.over || !fits(g.board, p.s, r0, c0)) return null;
      g.prev = JSON.stringify(stateOf());
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
        if(g.boost){ g.st.fromBonus += clr; clr *= 2; g.boost = false; res.boost = true; }   // 북거씨 향수
        // 짐 주인 줄 earnEvery번마다 그 친구 카드 한 장
        for(const w of res.ownerLines){ g.ownerN = (g.ownerN||0) + 1;
          if(g.ownerN % o.earnEvery === 0 && g.addCard(OWNERS[w])) (res.newCards = res.newCards || []).push(OWNERS[w]); }
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
    g.snapshot = () => JSON.stringify(stateOf());
    g.deal();
    for(let i=0;i<o.cardStart;i++) g.addCard(OWNERS[(rng()*OWNERS.length)|0]);
    return g;
  }
  function shapeFrom(x){
    if(x[2]){ let h=0, wd=0; for(const [r,c] of x[2]){ h=Math.max(h,r+1); wd=Math.max(wd,c+1); } return { k:x[0], cells:x[2], w:0, h, wd, n:x[2].length }; }
    return SHAPES.find(s=>s.k===x[0]) || SHAPES[0];
  }
  function restore(json, seed, opt){
    const d = JSON.parse(json), g = Game(seed, opt);
    g.board = d.b; g.tray = d.t.map(x => x ? { s: shapeFrom(x), owner: x[1] } : null);
    g.score = d.s; g.combo = d.co; g.miss = d.mi; g.placed = d.pl; g.st = d.st;
    g.cards = d.ca || {}; g.boost = !!d.bo;
    if(!g.tray.some(Boolean)) g.deal(); else g.checkOver();
    return g;
  }

  root.BoxCore = { N, OWNERS, SHAPES, DEFAULTS, CARD, rotateShape, Game, restore, fits, spots, fitsAnywhere, linesAfter, mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
