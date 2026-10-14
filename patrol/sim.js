// 「주민 원정」 자동 플레이 — 간단한 사람 흉내(골칫거리를 피하고 도토리를 주움). 사용: node patrol/sim.js [판수]
const C = require('./core.js');
const N = +process.argv[2] || 30;
let botT = 0;
function bot(g){
  botT -= 1/30; if(botT > 0) return; botT = 0.22;   // 사람처럼 0.22초마다 판단
  const p = g.p; let fx = 0, fy = 0, close = 0;
  for(const e of g.foes){ const dx = p.x - e.x, dy = p.y - e.y, d2 = dx*dx + dy*dy; if(d2 < 170*170){ const w = (e.r + 20)*(e.r + 20)/d2; fx += dx*w/Math.sqrt(d2); fy += dy*w/Math.sqrt(d2); if(d2 < 70*70) close++; } }
  let best = null, bd = 1e9; for(const m of g.gems){ const d = (m.x - p.x)**2 + (m.y - p.y)**2; if(d < bd){ bd = d; best = m; } }
  if(best && close < 3){ const d = Math.sqrt(bd) || 1; fx += (best.x - p.x)/d*0.8; fy += (best.y - p.y)/d*0.8; }
  // 한자리에 갇히지 않게 천천히 원 그리기
  fx += Math.cos(g.t*0.4)*0.35 + (Math.random() - 0.5)*0.8; fy += Math.sin(g.t*0.4)*0.35 + (Math.random() - 0.5)*0.8;
  g.setInput(fx, fy);
}
for(const hero of ['ramda','bookgeo']) for(const hl of [1,2,3,4,5]){
  let win = 0, t = 0, lv = 0, kills = 0, boss = 0, gain = 0; const ups = [];
  for(let s = 0; s < N; s++){
    const g = C.Game(s*7919 + 3, hero, hl); let firstUp = 0;
    while(!g.over){ if(g.chest){ g.openChest(); continue; } if(g.choices){ if(!firstUp) firstUp = g.t; const c = g.choices; let i = c.findIndex(o => C.SKILLS[o.id].kind === 'evo'); if(i < 0) i = c.findIndex(o => C.SKILLS[o.id].kind === 'atk'); g.choose(i < 0 ? 0 : i); continue; }
      bot(g); g.update(1/30); g.events.length = 0; }
    const r = g.result(); win += r.win; t += r.t; lv += r.lv; kills += r.kills; boss += r.boss; gain += C.heroGain(r); ups.push(firstUp);
  }
  console.log(`${hero.padEnd(8)} 주민Lv${hl}  성공 ${(win/N*100).toFixed(0).padStart(3)}%  평균생존 ${(t/N).toFixed(0).padStart(3)}초  판레벨 ${(lv/N).toFixed(1).padStart(4)}  처치 ${(kills/N).toFixed(0).padStart(4)}  보스처치 ${(boss/N*100).toFixed(0)}%  주민경험치 +${(gain/N).toFixed(0)}  첫레벨업 ${(ups.reduce((a,b)=>a+b,0)/N).toFixed(1)}초`);
}
