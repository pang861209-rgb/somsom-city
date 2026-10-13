// 자동 대전 — node mat/sim.js [판수] [botLevel]
// 1) 여섯 주민 모두 컴퓨터: 성격별 균형
// 2) '보통 사람' 한 명 + 컴퓨터 다섯: 컴퓨터가 사람에게 충분히 위협이 되는지 (사람 1등 비율·꽈당 수)
//    보통 사람 = 0.25초마다 판단, 8~14칸 크기로 돌고, 끈이 위험하면 집으로, 위험할 때 기술 50%
require('./core.js');
const { Game, OWNERS, DIRS } = globalThis.MatCore;
const n = +process.argv[2] || 60, lvl = +process.argv[3] || 1;

function botsOnly(){
  const S = {}; OWNERS.forEach(k => S[k] = { pct: 0, win: 0, kos: 0, trips: 0 });
  for(let s=1;s<=n;s++){
    const g = Game(s*7919, null, { botLevel: lvl });
    while(!g.over){ g.update(1/30); g.events.length = 0; }
    const r = g.ranking(); S[r[0].key].win++;
    for(const p of g.players){ const v = S[p.key]; v.pct += g.pct(p); v.kos += p.kos; v.trips += p.trips; }
  }
  console.log('[컴퓨터끼리] 주민 평균차지% 1등% 꽈당시킴 꽈당당함');
  for(const k of OWNERS){ const v = S[k]; console.log(' ', k.padEnd(11), (v.pct/n).toFixed(1).padStart(5), (100*v.win/n).toFixed(0).padStart(4), (v.kos/n).toFixed(1).padStart(5), (v.trips/n).toFixed(1).padStart(5)); }
}

function proxyPlay(seed, pid){
  const g = Game(seed, pid, { botLevel: lvl }), me = g.players[pid], N = g.N, rng = globalThis.MatCore.mulberry32(seed ^ 0x51ed);
  let plan = [], think = 0;
  const own = (x,y) => g.owner[y*N+x] === pid;
  const nearestHome = () => { let b = null, bd = 1e9; for(let c=0;c<N*N;c++) if(g.owner[c] === pid){ const d = Math.abs(c%N-me.x)+Math.abs(((c/N)|0)-me.y); if(d < bd){ bd = d; b = c; } } return [b, bd]; };
  const safeDir = (tx, ty) => { let best = null, bv = 1e9; for(let d=0;d<4;d++){ if(d === (me.dir+2)%4) continue; const nx = me.x+DIRS[d][0], ny = me.y+DIRS[d][1];
      if(nx<0||ny<0||nx>=N||ny>=N) continue; if(g.trail[ny*N+nx] === pid) continue; const v = Math.abs(nx-tx)+Math.abs(ny-ty); if(v < bv){ bv = v; best = d; } } return best; };
  let lastStep = -1;
  while(!g.over){
    think -= 1/30;
    if(think <= 0 && !me.stun){ think = 0.25;
      const home = own(me.x, me.y), [hc, dh] = nearestHome(), dang = g.danger(me);
      if(!home && dang <= dh + 2){ plan = []; if(me.trail.length >= 5 && g.canSkill(me) && rng() < 0.5) g.useSkill(pid); if(hc != null){ const d = safeDir(hc%N, (hc/N)|0); if(d != null) g.setDir(d); } }
      else if(home && !plan.length){ const d = (rng()*4)|0, a = 8 + ((rng()*7)|0), b = 8 + ((rng()*7)|0), t = rng()<.5?1:3; plan = [[d,a],[(d+t)%4,b],[(d+2)%4,a+2]]; me.dir = d; g.setDir(d); lastStep = g.stepNo; }
    }
    // 계획은 칸 수만큼 걷고 꺾기 (사람이 화면을 밀듯)
    if(plan.length && !me.stun){ const cur = plan[0]; g.setDir(cur[0]);
      if(me._lx !== me.x || me._ly !== me.y){ me._lx = me.x; me._ly = me.y; if(!own(me.x, me.y) || me.trail.length) cur[1]--; if(cur[1] <= 0) plan.shift(); }
      if(!plan.length && !own(me.x, me.y)){ const [hc] = nearestHome(); if(hc != null){ const d = safeDir(hc%N, (hc/N)|0); if(d != null) g.setDir(d); } } }
    if(!plan.length && !me.stun && !own(me.x,me.y)){ const [hc] = nearestHome(); if(hc != null){ const d = safeDir(hc%N, (hc/N)|0); if(d != null) g.setDir(d); } }
    if(me.stun) plan = [];
    g.update(1/30); g.events.length = 0;
  }
  const r = g.ranking();
  return { place: r.indexOf(me) + 1, pct: g.pct(me), trips: me.trips, kos: me.kos, top: g.pct(r[0]) };
}
function vsProxy(){
  console.log('[보통 사람 vs 컴퓨터] 고른 주민 사람평균% 사람1등% 평균등수 꽈당당함 꽈당시킴 1등평균%');
  let all = { w:0, p:0, t:0, n:0 };
  for(let pid=0; pid<6; pid++){
    let w=0, pct=0, pl=0, tr=0, ko=0, top=0;
    const m = Math.max(10, Math.round(n/3));
    for(let s=1;s<=m;s++){ const r = proxyPlay(s*104729 + pid, pid); if(r.place === 1) w++; pct += r.pct; pl += r.place; tr += r.trips; ko += r.kos; top += r.top; }
    all.w += w; all.p += pl; all.t += tr; all.n += m;
    console.log(' ', OWNERS[pid].padEnd(11), (pct/m).toFixed(1).padStart(5), (100*w/m).toFixed(0).padStart(5), (pl/m).toFixed(1).padStart(6), (tr/m).toFixed(1).padStart(6), (ko/m).toFixed(1).padStart(6), (top/m).toFixed(1).padStart(7));
  }
  console.log('  전체: 사람 1등', (100*all.w/all.n).toFixed(0)+'%', '평균 등수', (all.p/all.n).toFixed(2), '판당 꽈당', (all.t/all.n).toFixed(1));
}
botsOnly(); vsProxy();
