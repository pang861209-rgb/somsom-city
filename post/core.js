// 「솜솜 우체국」 규칙 — 화면과 떨어진 순수 로직.
// 게임(index.html)과 자동 플레이 봇(bot.js, node)이 같은 파일을 쓴다. 그래서 봇으로 잰 숫자가 곧 게임의 숫자다.
//
// 한 줄 규칙: 편지 더미를 분류대 빈칸에 내려놓으면, 옆칸 맨 위가 같은 주민 편지일 때 한 곳으로 모인다.
//            같은 주민 편지가 맨 위에 10장 이상 모이면 배달 출발(사라짐). 빈칸이 없는데 놓을 더미가 남으면 끝.
(function(root){
  const OWNERS = ['kkito','migae','lachilchin','ramda','boneul','bookgeo'];
  // 육각 칸 6방향 (axial 좌표)
  const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];

  // 기본 설정 — 봇으로 맞춘 값 (docs/POST_기획서.md §5)
  const DEFAULTS = {
    R: 2,              // 분류대 반지름 — 2면 19칸
    goal: 10,          // 맨 위에 같은 편지가 이만큼 모이면 배달
    colorsStart: 5,    // 처음 섞여 나오는 주민 수 (4는 아무렇게 놓아도 오래 버텨 실력 차가 덜 드러남)
    colorsMax: 6,
    colorsEvery: 3,    // 배달 이만큼마다 주민 한 명씩 늘어남
    runMin: 1,         // 더미 안 한 주민 편지 덩어리의 장수
    runMax: 3,
    partsStart: 1.8,   // 한 더미에 섞이는 주민 덩어리 수의 상한 (처음) — 1.8이면 1~2덩어리, 2가 잦음
    partsEvery: 25,    // 이만큼 놓을 때마다 상한 +1 — 끝없이 섞여 나와 판이 반드시 끝난다
    partsMax: 5,
    assist: 0.5,       // 세 더미 중 하나를 "지금 판에 맨 위로 보이는 주민"으로 시작하게 할 확률
  };

  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

  function makeCells(R){
    const cells = [];
    for(let q=-R;q<=R;q++) for(let r=-R;r<=R;r++){ const s=-q-r; if(Math.abs(s)<=R) cells.push([q,r]); }
    const idx = {}; cells.forEach(([q,r],i) => idx[q+','+r] = i);
    const nb = cells.map(([q,r]) => DIRS.map(([dq,dr]) => idx[(q+dq)+','+(r+dr)]).filter(v => v != null));
    return { cells, nb };
  }

  const top = st => st.length ? st[st.length-1] : -1;
  // 맨 위에서부터 같은 편지가 몇 장 이어지나
  function topRun(st){ if(!st.length) return 0; const c = top(st); let n=0; for(let i=st.length-1;i>=0 && st[i]===c;i--) n++; return n; }

  function Game(seed, opt){
    const o = Object.assign({}, DEFAULTS, opt || {});
    const rng = mulberry32(seed >>> 0);
    const G = makeCells(o.R);
    const g = {
      o, cells: G.cells, nb: G.nb,
      board: G.cells.map(() => []), tray: [null,null,null],
      score: 0, over: false, placed: 0, delivered: 0,
      st: { sent: 0, sentBy: {}, maxChain: 0, maxSent: 0, fromSend: 0, deals: 0, letters: 0 },
    };
    const nColors = () => Math.min(o.colorsMax, o.colorsStart + Math.floor(g.delivered / o.colorsEvery));
    const randColor = (not) => { const n = nColors(); let c; for(let k=0;k<20;k++){ c = (rng()*n)|0; if(c !== not) break; } return c; };
    // 판 위 맨 위에 보이는 주민들
    const visibleTops = () => { const s = new Set(); for(const st of g.board) if(st.length) s.add(top(st)); return [...s]; };
    // 새 더미 — 주민 덩어리 여러 개를 쌓는다. 판이 길어질수록 덩어리 수가 늘어 잘 섞여 나온다
    function makeStack(topWant){
      const cap = Math.min(o.partsMax, o.partsStart + g.placed / o.partsEvery);
      const parts = 1 + Math.floor(rng() * cap);
      const st = []; let prev = -1;
      for(let j=0;j<parts;j++){
        const last = j === parts-1;
        const c = (last && topWant != null && topWant !== prev) ? topWant : randColor(prev);
        const n = o.runMin + ((rng() * (o.runMax - o.runMin + 1)) | 0);
        for(let i=0;i<n;i++) st.push(c); prev = c;
      }
      return st;
    }
    g.nColors = nColors;
    g.deal = function(){
      const tops = visibleTops();
      g.tray = [0,1,2].map(() => makeStack());
      if(tops.length && rng() < o.assist){ const i = (rng()*3)|0; g.tray[i] = makeStack(tops[(rng()*tops.length)|0]); }
      g.st.deals++;
      g.checkOver();
    };
    g.empties = () => g.board.map((s,i) => s.length ? -1 : i).filter(i => i >= 0);
    g.checkOver = function(){ g.over = g.tray.some(Boolean) && g.empties().length === 0; return g.over; };

    // 정리 — 놓은 칸에서 시작해 같은 편지를 한 곳으로 모으고, goal장 이상이면 배달.
    // 연출을 위해 한 걸음씩 기록(steps)을 남긴다: {t:'move', from, to, c, n} / {t:'send', at, c, n, chain}
    function settle(start, steps){
      const queue = [start], inQ = new Set([start]);
      let chain = 0, gained = 0, guard = 0;
      while(queue.length && guard++ < 400){
        const x = queue.shift(); inQ.delete(x);
        const sx = g.board[x]; if(!sx.length) continue;
        const c = top(sx);
        const mates = g.nb[x].filter(y => g.board[y].length && top(g.board[y]) === c);
        if(!mates.length) continue;
        // 모일 곳: 한 가지 편지로만 된 칸이 있으면 거기(가장 많이 쌓인 곳), 없으면 방금 움직인 칸
        const group = [x, ...mates];
        const pure = group.filter(i => topRun(g.board[i]) === g.board[i].length);
        const to = pure.length ? pure.sort((a,b) => g.board[b].length - g.board[a].length)[0] : x;
        const touched = new Set([to]);
        for(const from of group){ if(from === to) continue;
          const n = topRun(g.board[from]);
          for(let i=0;i<n;i++) g.board[to].push(g.board[from].pop());
          steps.push({ t:'move', from, to, c, n });
          touched.add(from);
        }
        // 배달
        const run = topRun(g.board[to]);
        if(run >= o.goal){
          chain++;
          for(let i=0;i<run;i++) g.board[to].pop();
          const pts = run * 10 * chain;
          gained += pts; g.delivered++;
          g.st.sent++; g.st.sentBy[OWNERS[c]] = (g.st.sentBy[OWNERS[c]]||0) + 1;
          g.st.maxSent = Math.max(g.st.maxSent, run); g.st.fromSend += pts;
          steps.push({ t:'send', at: to, c, n: run, chain, pts });
        }
        // 맨 위가 바뀐 칸들과 그 이웃을 다시 살핀다
        for(const i of touched){ if(g.board[i].length && !inQ.has(i)){ queue.push(i); inQ.add(i); }
          for(const y of g.nb[i]) if(g.board[y].length && !inQ.has(y) && top(g.board[y]) === top(g.board[i])){ queue.push(y); inQ.add(y); } }
      }
      g.st.maxChain = Math.max(g.st.maxChain, chain);
      return { chain, gained };
    }

    // i번째 더미를 칸 at에 놓는다. 결과: 움직임 기록·얻은 점수 (연출용)
    g.place = function(i, at){
      const st = g.tray[i];
      if(!st || g.over || g.board[at] == null || g.board[at].length) return null;
      g.board[at] = st.slice(); g.tray[i] = null; g.placed++; g.st.letters += st.length;
      const steps = [];
      const r = settle(at, steps);
      const gained = st.length + r.gained;    // 놓은 편지마다 1점 + 배달 점수
      g.score += gained;
      if(!g.tray.some(Boolean)) g.deal(); else g.checkOver();
      return { at, steps, chain: r.chain, gained, over: g.over };
    };
    // 봇·미리보기용: 놓아 보면 어떻게 되나 (판을 바꾸지 않음)
    g.peek = function(i, at){
      const save = { b: g.board.map(s => s.slice()), sc: g.score, d: g.delivered, st: JSON.stringify(g.st), tr: g.tray.slice(), pl: g.placed };
      const st = g.tray[i]; g.board[at] = st.slice();
      const steps = []; const r = settle(at, steps);
      const out = { chain: r.chain, gained: r.gained, steps, empties: g.board.filter(s => !s.length).length,
                    board: g.board.map(s => s.slice()) };
      g.board = save.b; g.score = save.sc; g.delivered = save.d; g.st = JSON.parse(save.st); g.tray = save.tr; g.placed = save.pl;
      return out;
    };
    g.snapshot = () => JSON.stringify({ b: g.board, t: g.tray, s: g.score, p: g.placed, d: g.delivered, st: g.st });
    g.deal();
    return g;
  }
  function restore(json, seed, opt){
    const d = JSON.parse(json), g = Game(seed, opt);
    g.board = d.b; g.tray = d.t; g.score = d.s; g.placed = d.p; g.delivered = d.d; g.st = d.st;
    if(!g.tray.some(Boolean)) g.deal(); else g.checkOver();
    return g;
  }

  root.PostCore = { OWNERS, DIRS, DEFAULTS, Game, restore, makeCells, top, topRun, mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
