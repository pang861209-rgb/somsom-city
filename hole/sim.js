// 「구멍으로 쏙」 자동 대전 — 여섯 모두 컴퓨터. 사용: node hole/sim.js [판수]
const C = require('./core.js');
const N = +process.argv[2] || 40;
const stat = {}; C.OWNERS.forEach(k => stat[k] = { score: 0, win: 0, r: 0, gulp: 0, eaten: 0 });
let objsLeft = 0, stageEaten = 0, maxR = 0, firstStage = [];
const tierT = C.TYPES.map(() => []);
for(let s = 0; s < N; s++){
  const g = C.Game(s*7919 + 1, -1);
  const reached = C.TYPES.map(() => 0);
  while(!g.over){ g.update(1/30);
    for(const e of g.events) if(e.type === 'eat' && e.t === 8) firstStage.push(g.t);
    g.events.length = 0;
    const top = Math.max(...g.holes.map(h => h.r));
    C.TYPES.forEach((t, i) => { if(!reached[i] && t.r <= top*C.DEFAULTS.eatK){ reached[i] = 1; tierT[i].push(g.t); } });
  }
  const rk = g.ranking(); stat[rk[0].k].win++;
  for(const h of g.holes){ const st = stat[h.k]; st.score += h.score; st.r += h.r; st.gulp += h.holesEaten; st.eaten += h.timesEaten; maxR = Math.max(maxR, h.r); }
  objsLeft += g.objs.length; if(!g.objs.some(o => o.t === 8)) stageEaten++;
}
console.log('주민       평균점수  1등   끝크기  삼킴  삼켜짐');
for(const k of C.OWNERS){ const s = stat[k]; console.log(k.padEnd(11), (s.score/N).toFixed(0).padStart(6), (s.win/N*100).toFixed(0).padStart(5)+'%', (s.r/N).toFixed(0).padStart(6), (s.gulp/N).toFixed(1).padStart(5), (s.eaten/N).toFixed(1).padStart(6)); }
console.log('남은 물건', (objsLeft/N).toFixed(0), '/ 무대 먹힌 판', stageEaten, '/ 최대 크기', maxR.toFixed(0));
console.log('누군가 처음 삼킬 수 있게 된 시각(초):', C.TYPES.map((t, i) => t.n + ' ' + (tierT[i].length ? (tierT[i].reduce((a, b) => a + b, 0)/tierT[i].length).toFixed(0) + '(' + tierT[i].length + ')' : '-')).join(', '));
