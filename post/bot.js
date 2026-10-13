// 솜솜 우체국 자동 플레이 봇 — node post/bot.js [판수] [설정JSON]
// random: 빈칸 아무 데나 / human: 좋은 수 70%·2등 20%·3등 10% / best: 늘 가장 좋은 수 (한 수 앞만 봄)
require('./core.js');
const { Game, top, topRun } = globalThis.PostCore;

function evalMove(g, i, at){
  const p = g.peek(i, at);
  const b = p.board;
  let h = p.gained * 2 + p.empties * 6;
  // 남은 판의 정돈 정도: 맨 위가 같은 이웃끼리 붙어 있으면 +, 한 가지 편지로 된 칸 +, 섞인 칸의 깊이 −
  for(let x=0;x<b.length;x++){ const s=b[x]; if(!s.length) continue;
    const run = topRun(s); h += run * 0.8; if(run === s.length) h += 2; else h -= (s.length - run) * 0.6;
    for(const y of g.nb[x]) if(b[y].length && top(b[y]) !== top(s)) h -= 0.4; }
  return h;
}
function moves(g){ const out=[]; const E=g.empties(); g.tray.forEach((s,i)=>{ if(s) for(const at of E) out.push([i,at]); }); return out; }

function play(seed, kind, opt){
  const g = Game(seed, opt), rng = globalThis.PostCore.mulberry32(seed ^ 0x9e3779b9);
  let guard = 0;
  while(!g.over && guard++ < 3000){
    const M = moves(g); if(!M.length) break;
    let mv;
    if(kind === 'random') mv = M[(rng()*M.length)|0];
    else {
      const sc = M.map(m => [evalMove(g, m[0], m[1]), m]).sort((a,b) => b[0]-a[0]);
      if(kind === 'best') mv = sc[0][1];
      else { const x = rng(); mv = sc[Math.min(sc.length-1, x < 0.7 ? 0 : x < 0.9 ? 1 : 2)][1]; }
    }
    g.place(mv[0], mv[1]);
  }
  return { placed: g.placed, score: g.score, sent: g.st.sent, chain: g.st.maxChain, colors: g.nColors(), fromSend: g.st.fromSend };
}
const q = (a, p) => { const s=[...a].sort((x,y)=>x-y); return s[Math.min(s.length-1, Math.floor(p*s.length))]; };
function report(kind, n, opt){
  const R = []; for(let s=1;s<=n;s++) R.push(play(s*7919, kind, opt));
  const col = k => R.map(r => r[k]);
  const line = { kind, n,
    placed_med: q(col('placed'),.5), placed_p10: q(col('placed'),.1), placed_p90: q(col('placed'),.9),
    score_med: q(col('score'),.5), score_p10: q(col('score'),.1), score_p90: q(col('score'),.9),
    sent_med: q(col('sent'),.5), chain_max_med: q(col('chain'),.5), chain2plus: Math.round(100*R.filter(r=>r.chain>=2).length/n)+'%',
    colors_end_med: q(col('colors'),.5),
    send_share: Math.round(100 * R.reduce((a,r)=>a+r.fromSend,0) / Math.max(1,R.reduce((a,r)=>a+r.score,0))) + '%' };
  console.log(JSON.stringify(line));
  return line;
}
if(require.main === module){
  const n = +process.argv[2] || 100, opt = process.argv[3] ? JSON.parse(process.argv[3]) : {};
  for(const k of ['random','human','best']) report(k, k==='random'?n*2:n, opt);
}
module.exports = { play, report };
