// 자동 대전 — node mat/sim.js [판수]
// 여섯 주민 모두 컴퓨터로 2분을 돌려, 성격별 차지 비율·꽈당 수가 한쪽으로 쏠리지 않는지 본다.
require('./core.js');
const { Game, OWNERS } = globalThis.MatCore;
const n = +process.argv[2] || 100;
const S = {}; OWNERS.forEach(k => S[k] = { pct: 0, win: 0, kos: 0, trips: 0, best: 0 });
let caps = 0;
for(let s=1;s<=n;s++){
  const g = Game(s*7919, null);
  while(!g.over){ g.update(1/30); caps += g.events.filter(e=>e.t==='capture').length; g.events.length = 0; }
  const r = g.ranking(); S[r[0].key].win++;
  for(const p of g.players){ const v = S[p.key]; v.pct += g.pct(p); v.kos += p.kos; v.trips += p.trips; v.best += p.best/(g.N*g.N)*100; }
}
console.log('주민       평균차지%  1등%  꽈당시킴  꽈당당함  판중최고%');
for(const k of OWNERS){ const v = S[k];
  console.log(k.padEnd(11), (v.pct/n).toFixed(1).padStart(7), (100*v.win/n).toFixed(0).padStart(5), (v.kos/n).toFixed(1).padStart(8), (v.trips/n).toFixed(1).padStart(8), (v.best/n).toFixed(1).padStart(9)); }
console.log('한 판 평균 두르기', (caps/n).toFixed(0), '회');
