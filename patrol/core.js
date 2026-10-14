// 「주민 원정」 규칙 — 화면과 떨어진 순수 로직. 게임(index.html)과 자동 대전(sim.js, node)이 같은 파일을 쓴다.
//
// 한 줄 규칙: 은행나무 골목에 골칫거리가 몰려온다. 주민은 움직이기만 하고 공격은 자동.
//            골칫거리가 떨군 도토리를 모으면 판 안 레벨업 → 기술 카드 3장 중 1장 고르기.
//            3분 버티면 성공. 판이 끝나면 고른 주민이 경험치를 받아 '주민 레벨'이 오르고 새 기술이 열린다.
(function(root){

  const DEFAULTS = {
    time: 180,        // 한 판 3분
    bossAt: 150,      // 2분 30초에 왕꼬릿 구름
    spawnR: 500,      // 화면 밖 이 거리에서 골칫거리가 나옴 (화면을 0.85배로 줄여서 조금 멀리)
    despawnR: 1000,
  };

  // ── 골칫거리 (악당이 아니라 골칫거리: 화난 얼굴 없음) ──
  const FOES = {
    dust:  { n:'먼지 뭉치',   hp:3,   spd:58, r:11, dmg:14,  xp:1,  c:'#D8C7A6' },
    nut:   { n:'굴러오는 은행', hp:2,  spd:95, r:8,  dmg:12,  xp:1,  c:'#F0C23B' },
    cloud: { n:'꼬릿 구름',   hp:13,  spd:38, r:18, dmg:22, xp:3,  c:'#F3E7A2' },
    pile:  { n:'젖은 낙엽 더미', hp:28, spd:30, r:22, dmg:28, xp:5, c:'#A0703F' },
    boss:  { n:'왕꼬릿 구름', hp:750, spd:42, r:48, dmg:45, xp:60, c:'#CFC3E3' },
  };

  // ── 기술 ── kind: 'atk'(공격) · 'pas'(패시브) · 'evo'(진화)
  const SKILLS = {
    // 람다
    acorn:  { n:'도토리 던지기', who:'ramda',   kind:'atk', d:['가까운 골칫거리에게 도토리를 던져요','도토리가 더 아파요','한 번에 2개','더 빨리 던져요','한 번에 3개, 뚫고 지나가요'] },
    tail:   { n:'꼬리 털기',     who:'ramda',   kind:'atk', d:['꼬리로 둘레를 털어 밀어내요','더 넓게','더 아프게','더 자주','아주 넓게'] },
    button: { n:'단추 부메랑',   who:'ramda',   kind:'atk', d:['단추가 날아갔다 돌아와요','더 아프게','2개','더 멀리','더 빨리'] },
    pocket: { n:'불룩한 주머니', who:'ramda',   kind:'pas', d:['도토리를 멀리서도 끌어와요','경험치 +10%','더 멀리','경험치 +10%','아주 멀리'] },
    storm:  { n:'도토리 폭풍',   who:'ramda',   kind:'evo', from:['acorn','tail'], d:['도토리가 람다 둘레를 쉬지 않고 돌아요'] },
    // 북거씨
    spray:  { n:'향수 분무',     who:'bookgeo', kind:'atk', d:['가는 쪽으로 향수를 뿌려요','더 아프게','더 넓게, 맞으면 느려져요','더 자주','아주 멀리'] },
    wave:   { n:'바다향 파동',   who:'bookgeo', kind:'atk', d:['파란 파동이 퍼져 밀어내요','더 넓게','더 아프게','더 자주','아주 넓게'] },
    euca:   { n:'유칼립투스 장판', who:'bookgeo', kind:'atk', d:['골칫거리 발밑에 잎을 깔아 느리게','더 아프게','2장','더 넓게','더 오래'] },
    shell:  { n:'단단한 등딱지', who:'bookgeo', kind:'pas', d:['덜 아프고, 부딪히면 되갚아요','더 단단히','더 아프게 되갚기','더 단단히','가시 등딱지'] },
    tide:   { n:'밀물',          who:'bookgeo', kind:'evo', from:['spray','wave'], d:['큰 파도가 골목을 휩쓸어요'] },
    // 끼토
    ear:    { n:'쫑긋 소리',    who:'kkito',   kind:'atk', d:['귀를 쫑긋! 소리 고리가 둘레를 밀어내요','더 넓게','맞으면 느려져요','더 자주','아주 넓게'] },
    brush:  { n:'물감 붓질',    who:'kkito',   kind:'atk', d:['가까운 골칫거리 쪽으로 붓을 쭉','더 길게','2번 칠해요','더 아프게','3번 칠해요'] },
    pearl:  { n:'진주 구슬',    who:'kkito',   kind:'atk', d:['진주 2알이 둘레를 돌아요','더 아프게','3알','더 빨리 돌아요','4알'] },
    scare:  { n:'깜짝 순발력',  who:'kkito',   kind:'pas', d:['부딪히면 깜짝! 잠깐 빨라지고 안 다쳐요','이동 속도 +6%','더 오래','이동 속도 +6%','더 오래'] },
    rainbow:{ n:'무지개 붓질',  who:'kkito',   kind:'evo', from:['brush','ear'], d:['여섯 방향으로 무지개를 칠해요'] },
    // 미개
    ants:   { n:'개미 친구',    who:'migae',   kind:'atk', d:['친구 개미가 쫓아가 깨물어요','더 아프게','친구가 더 많이','더 자주 불러요','친구가 더 많이'] },
    zap:    { n:'더듬이 찌릿',  who:'migae',   kind:'atk', d:['더듬이 찌릿! 여러 골칫거리에 번져요','한 번 더 번져요','더 아프게','더 자주','두 번 더 번져요'] },
    burrow: { n:'개미굴',       who:'migae',   kind:'atk', d:['발밑에서 흙이 펑! 솟아요','더 넓게','2곳','더 아프게','3곳'] },
    ribbon: { n:'분홍 리본',    who:'migae',   kind:'pas', d:['경험치 +12%, 도토리를 더 멀리서','+12%','+12%','+12%','+12%'] },
    march:  { n:'개미 행진',    who:'migae',   kind:'evo', from:['ants','zap'], d:['개미 친구들이 줄지어 쉬지 않고 나와요'] },
    // 할머니
    yarn:   { n:'실타래 굴리기', who:'lachilchin', kind:'atk', d:['실타래가 굴러가며 휘감아 느리게','더 아프게','2개','더 크게','3개'] },
    tongs:  { n:'은행 집게',    who:'lachilchin', kind:'atk', d:['제일 튼튼한 골칫거리를 콕 집어요','더 아프게','더 자주','더 아프게','2마리'] },
    tea:    { n:'따뜻한 차',    who:'lachilchin', kind:'pas', d:['체력이 조금씩 차올라요','더 빨리','더 빨리','더 빨리','더 빨리'] },
    net:    { n:'뜨개 그물',    who:'lachilchin', kind:'atk', d:['그물로 덮어 꼼짝 못 하게','더 넓게','더 오래','2곳','아주 넓게'] },
    scarf:  { n:'할머니 목도리', who:'lachilchin', kind:'evo', from:['yarn','net'], d:['기다란 목도리가 빙글빙글 휘감아요'] },
    // 보늘
    roll:   { n:'데굴데굴',     who:'boneul',  kind:'atk', d:['가는 쪽으로 데굴데굴 굴러 들이받아요','더 멀리','더 아프게','더 자주','아주 멀리'] },
    flop:   { n:'털썩',         who:'boneul',  kind:'atk', d:['털썩 주저앉아 둘레를 쾅','더 넓게','더 아프게','더 자주','아주 넓게'] },
    snack:  { n:'과자 봉지',    who:'boneul',  kind:'pas', d:['골칫거리를 물리칠 때마다 냠, 체력 회복','더 많이','더 많이','더 많이','더 많이'] },
    yawn:   { n:'하품',         who:'boneul',  kind:'atk', d:['하암~ 둘레의 골칫거리가 졸려서 느려져요','더 넓게','졸면서 다쳐요','더 넓게','아주 졸려요'] },
    bigroll:{ n:'대왕 데굴',    who:'boneul',  kind:'evo', from:['roll','flop'], d:['크게 굴러가서 털썩까지 한 번에'] },
    // 공용
    shoes:  { n:'새 운동화',     who:'*', kind:'pas', d:['이동 속도 +10%','+10%','+10%','+10%','+10%'] },
    lunch:  { n:'할머니 도시락', who:'*', kind:'pas', d:['최대 체력 +20, 체력 회복','+20','+20','+20','+20'] },
    lens:   { n:'돋보기',        who:'*', kind:'pas', d:['기술 범위 +12%','+12%','+12%','+12%','+12%'] },
    clock:  { n:'모래시계',      who:'*', kind:'pas', d:['기술 쿨타임 -8%','-8%','-8%','-8%','-8%'] },
  };

  // ── 주민: 기본 능력 + 주민 레벨별로 열리는 것 ──
  const HEROES = {
    ramda: { n:'람다', hp:100, spd:150, armor:0, start:'acorn',
      unlock: [
        { lv:1, add:['acorn','tail'], txt:'도토리 던지기 · 꼬리 털기' },
        { lv:2, add:['button'],       txt:'새 기술: 단추 부메랑' },
        { lv:3, add:['pocket','storm'], txt:'새 기술: 불룩한 주머니 · 진화 「도토리 폭풍」' },
        { lv:4, startLv:2,            txt:'도토리 던지기 2단계로 시작' },
        { lv:5, hpK:1.15, outfit:1,   txt:'새 옷 「가을 조끼」 · 체력 +15%' },
      ] },
    bookgeo: { n:'북거씨', hp:120, spd:112, armor:1, start:'spray',
      unlock: [
        { lv:1, add:['spray','wave'], txt:'향수 분무 · 바다향 파동' },
        { lv:2, add:['euca'],         txt:'새 기술: 유칼립투스 장판' },
        { lv:3, add:['shell','tide'], txt:'새 기술: 단단한 등딱지 · 진화 「밀물」' },
        { lv:4, startLv:2,            txt:'향수 분무 2단계로 시작' },
        { lv:5, hpK:1.15, outfit:1,   txt:'새 옷 「바다색 터틀넥」 · 체력 +15%' },
      ] },
  };
  Object.assign(HEROES, {
    kkito: { n:'끼토', hp:80, spd:165, armor:0, start:'ear', r:13,
      unlock: [
        { lv:1, add:['ear','brush'],    txt:'쫑긋 소리 · 물감 붓질' },
        { lv:2, add:['pearl'],          txt:'새 기술: 진주 구슬' },
        { lv:3, add:['scare','rainbow'], txt:'새 기술: 깜짝 순발력 · 진화 「무지개 붓질」' },
        { lv:4, startLv:2,              txt:'쫑긋 소리 2단계로 시작' },
        { lv:5, hpK:1.15, outfit:1,     txt:'새 옷 「노을빛 조끼」 · 체력 +15%' },
      ] },
    migae: { n:'미개', hp:90, spd:150, armor:0, start:'ants', r:11,
      unlock: [
        { lv:1, add:['ants','zap'],     txt:'개미 친구 · 더듬이 찌릿' },
        { lv:2, add:['burrow'],         txt:'새 기술: 개미굴' },
        { lv:3, add:['ribbon','march'], txt:'새 기술: 분홍 리본 · 진화 「개미 행진」' },
        { lv:4, startLv:2,              txt:'개미 친구 2단계로 시작' },
        { lv:5, hpK:1.15, outfit:1,     txt:'새 옷 「산책 부츠」 · 체력 +15%' },
      ] },
    lachilchin: { n:'할머니', hp:135, spd:126, armor:0, start:'yarn', r:14,
      unlock: [
        { lv:1, add:['yarn','tongs'],   txt:'실타래 굴리기 · 은행 집게' },
        { lv:2, add:['net'],            txt:'새 기술: 뜨개 그물' },
        { lv:3, add:['tea','scarf'],    txt:'새 기술: 따뜻한 차 · 진화 「할머니 목도리」' },
        { lv:4, startLv:2,              txt:'실타래 굴리기 2단계로 시작' },
        { lv:5, hpK:1.15, outfit:1,     txt:'새 옷 「꽃무늬 앞치마」 · 체력 +15%' },
      ] },
    boneul: { n:'보늘', hp:160, spd:100, armor:1, start:'roll', r:17,
      unlock: [
        { lv:1, add:['roll','flop'],    txt:'데굴데굴 · 털썩' },
        { lv:2, add:['yawn'],           txt:'새 기술: 하품' },
        { lv:3, add:['snack','bigroll'], txt:'새 기술: 과자 봉지 · 진화 「대왕 데굴」' },
        { lv:4, startLv:2,              txt:'데굴데굴 2단계로 시작' },
        { lv:5, hpK:1.15, outfit:1,     txt:'새 옷 「늘보의 식탁 티셔츠」 · 체력 +15%' },
      ] },
  });
  const COMMON = ['shoes','lunch','lens','clock'];
  const HERO_XP = [0, 0, 200, 600, 1200, 2000];     // 주민 레벨 n이 되는 누적 경험치 (최대 5)
  const MAXLV = 5;

  function heroLevel(xp){ let l = 1; for(let i = 2; i < HERO_XP.length; i++) if(xp >= HERO_XP[i]) l = i; return l; }
  function heroGain(res){ return Math.round(res.kills*0.15 + res.t*0.5 + (res.win ? 80 : 0) + (res.boss ? 40 : 0)); }

  function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function Game(seed, heroKey, heroLv, opt){
    const P = Object.assign({}, DEFAULTS, opt || {});
    const rnd = mulberry32(seed >>> 0);
    const H = HEROES[heroKey];
    // 주민 레벨로 열린 것
    const pool = new Set(COMMON); let startLv = 1, hpK = 1, outfit = 0;
    for(const u of H.unlock){ if(heroLv < u.lv) continue; (u.add || []).forEach(s => pool.add(s)); if(u.startLv) startLv = u.startLv; if(u.hpK) hpK = u.hpK; if(u.outfit) outfit = u.outfit; }

    const p = { x:0, y:0, r:H.r || 14, boost:0, invuln:0, roll:0, rdx:1, rdy:0, rollHit:{}, hp:H.hp*hpK, maxhp:H.hp*hpK, spd:H.spd, armor:H.armor, magnet:80, xpK:1, area:1, cdm:1, thorns:0,
      lv:1, xp:0, next:8, fx:1, fy:0, ix:0, iy:0, hurt:0, outfit, skills:{}, t:{} };
    p.skills[H.start] = startLv;

    const g = { P, hero:heroKey, heroLv, p, foes:[], shots:[], areas:[], gems:[], t:0, over:false, win:false, kills:0, boss:null, bossDown:false,
      events:[], pendingUp:0, chests:[], chest:false, choices:null, pool, rnd, spawnAcc:0, orbit:0 };

    const need = lv => 2 + lv*3 + Math.floor(lv*lv*0.15);
    const lvOf = id => p.skills[id] || 0;

    // ── 카드 고르기 ──
    function offers(){
      const c = [];
      for(const id of pool){
        const s = SKILLS[id], cur = lvOf(id);
        if(s.kind === 'evo'){
          if(cur || !s.from.every(f => lvOf(f) >= 1) || lvOf(s.from[0]) < MAXLV) continue;
          c.push({ id, evo:true, w:6 }); continue;
        }
        if(cur >= MAXLV) continue;
        // 진화로 사라진 기술은 다시 안 나옴
        if(Object.keys(SKILLS).some(e => SKILLS[e].kind === 'evo' && lvOf(e) && SKILLS[e].from[0] === id)) continue;
        c.push({ id, w: s.kind === 'atk' ? (cur ? 3 : 2.2) : 1.4 });
      }
      const out = [];
      while(out.length < 3 && c.length){
        const evo = c.findIndex(o => o.evo); let i;
        if(evo >= 0 && !out.length) i = evo;   // 진화가 가능하면 맨 앞에 꼭
        else { let s = 0; c.forEach(o => s += o.w); let r = rnd()*s; i = 0; for(; i < c.length - 1; i++){ r -= c[i].w; if(r <= 0) break; } }
        out.push(c[i].id); c.splice(i, 1);
      }
      return out.map(id => ({ id, from:lvOf(id), to:lvOf(id) + 1 }));
    }
    function apply(o){
      const s = SKILLS[o.id];
      p.skills[o.id] = o.to; p.t[o.id] = 0;
      if(s.kind === 'evo'){ delete p.skills[s.from[0]]; }
      if(o.id === 'lunch'){ p.maxhp += 20; p.hp = Math.min(p.maxhp, p.hp + 20 + p.maxhp*0.25); g.events.push({ type:'heal' }); }
      if(o.id === 'shoes') p.spd *= 1.10;
      if(o.id === 'lens') p.area += 0.12;
      if(o.id === 'clock') p.cdm *= 0.92;
      if(o.id === 'pocket'){ p.magnet *= 1.3; p.xpK += o.to % 2 === 0 ? 0.10 : 0; }
      if(o.id === 'shell'){ p.armor += 1; p.thorns += 2; }
      if(o.id === 'ribbon'){ p.xpK += 0.12; p.magnet *= 1.2; }
      if(o.id === 'scare' && (o.to === 2 || o.to === 4)) p.spd *= 1.06;
      g.events.push({ type:'pick', id:o.id, lv:o.to });
    }
    g.choose = function(i){
      if(!g.choices) return;
      const o = g.choices[i]; if(!o) return;
      apply(o);
      g.choices = null; g.pendingUp--;
      if(g.pendingUp > 0){ const o2 = offers(); if(o2.length) g.choices = o2; else g.pendingUp = 0; }
    };

    for(let i = 0; i < 6; i++){ const e = spawn('dust', i/6*Math.PI*2); e.x = Math.cos(i)*200; e.y = Math.sin(i)*200; }

    // 보물 상자 열기: 1개 60% · 2개 30% · 3개 10%
    g.openChest = function(){
      if(!g.chest) return null;
      g.chest = false;
      const r = rnd(), n = r < 0.6 ? 1 : r < 0.9 ? 2 : 3, got = [];
      for(let i = 0; i < n; i++){ const o = offers()[0]; if(!o) break; apply(o); got.push(o); }
      if(!got.length) p.hp = Math.min(p.maxhp, p.hp + p.maxhp*0.5);
      return got;
    };

    g.setInput = function(x, y){ const m = Math.hypot(x, y); if(m > 1){ x /= m; y /= m; } p.ix = x; p.iy = y; if(m > 0.1){ p.fx = x/(m || 1); p.fy = y/(m || 1); } };

    // ── 골칫거리 나오기 ──
    function spawn(type, ang){
      const f = FOES[type], a = ang == null ? rnd()*Math.PI*2 : ang, k = 1 + g.t/60 + (g.t/120)**2;
      const e = { type, x: p.x + Math.cos(a)*P.spawnR, y: p.y + Math.sin(a)*P.spawnR, r:f.r, hp:f.hp*(type === 'boss' ? 1 : k), spd:f.spd*(0.9 + rnd()*0.2)*(1 + g.t/260), dmg:f.dmg,
        vx:0, vy:0, flash:0, slow:0, hitBy:{}, id: Math.floor(rnd()*1e9), wob: rnd()*7 };
      e.maxhp = e.hp; g.foes.push(e); return e;
    }
    function spawner(dt){
      const t = g.t;
      const rate = 1.3 + t*0.09 + (t > 100 ? (t - 100)*0.09 : 0);
      g.spawnAcc += rate*dt;
      while(g.spawnAcc >= 1){ g.spawnAcc--;
        const r = rnd();
        let type = 'dust';
        if(t > 20 && r < 0.3) type = 'nut';
        if(t > 40 && r > 0.82) type = 'cloud';
        if(t > 90 && r > 0.93) type = 'pile';
        spawn(type);
      }
      // 무리 지어 오기 (원 모양 포위)
      if(Math.floor((t - dt)/30) !== Math.floor(t/30) && t > 25){ const n = 10 + Math.floor(t/20); for(let i = 0; i < n; i++) spawn(t > 70 ? 'nut' : 'dust', i/n*Math.PI*2); g.events.push({ type:'ring' }); }
      if(Math.floor((t - dt)/40) !== Math.floor(t/40) && t > 30 && t < P.bossAt){ const e = spawn(t > 90 ? 'pile' : 'cloud'); e.elite = true; e.hp *= 8; e.maxhp = e.hp; e.r *= 1.35; e.spd *= 0.85; g.events.push({ type:'elite' }); }
      if(!g.boss && !g.bossDown && t >= P.bossAt){ g.boss = spawn('boss'); g.boss.summon = 4; g.events.push({ type:'boss' }); }
    }

    // ── 피해 ──
    function hurt(e, dmg, kx, ky, kb, src){
      if(e.dead) return;
      e.hp -= dmg; e.flash = 0.12;
      if(kb && e.type !== 'boss'){ const m = Math.hypot(kx, ky) || 1; e.vx += kx/m*kb; e.vy += ky/m*kb; }
      g.events.push({ type:'hit', x:e.x, y:e.y - e.r, dmg:Math.round(dmg), src, lv: src ? (p.skills[src] || 1) : 1 });
      if(e.hp <= 0){ e.dead = true; g.kills++; if(lvOf('snack')){ p.hp = Math.min(p.maxhp, p.hp + 0.3 + lvOf('snack')*0.25); }
        const f = FOES[e.type];
        g.gems.push({ x:e.x, y:e.y, v:f.xp*(e.elite ? 4 : 1), big:e.type === 'boss' || e.type === 'pile' || e.elite });
        if(e.elite || e.type === 'boss') g.chests.push({ x:e.x + 18, y:e.y });
        g.events.push({ type:'die', x:e.x, y:e.y, foe:e.type });
        if(e === g.boss){ g.boss = null; g.bossDown = true; g.events.push({ type:'bossDown' }); }
      }
    }
    const nearest = (n, maxd) => {
      const arr = [];
      for(const e of g.foes){ if(e.dead) continue; const d = (e.x - p.x)**2 + (e.y - p.y)**2; if(d < maxd*maxd) arr.push([d, e]); }
      arr.sort((a, b) => a[0] - b[0]); return arr.slice(0, n).map(a => a[1]);
    };
    const nearestTo = (x, y, maxd, not) => { let b = null, bd = maxd*maxd; for(const e of g.foes){ if(e.dead || e === not) continue; const d = (e.x - x)**2 + (e.y - y)**2; if(d < bd){ bd = d; b = e; } } return b; };
    const onLine = (x1, y1, x2, y2, w, fn) => { const dx = x2 - x1, dy = y2 - y1, L2 = dx*dx + dy*dy || 1;
      for(const e of g.foes){ if(e.dead) continue; let q = ((e.x - x1)*dx + (e.y - y1)*dy)/L2; q = Math.max(0, Math.min(1, q)); const px = x1 + dx*q, py = y1 + dy*q; if((e.x - px)**2 + (e.y - py)**2 < (w + e.r)**2) fn(e); } };
    const inCircle = (x, y, r, fn) => { for(const e of g.foes){ if(e.dead) continue; if((e.x - x)**2 + (e.y - y)**2 < (r + e.r)**2) fn(e); } };

    // ── 기술 동작 ──
    function cd(id, base){ p.t[id] = (p.t[id] || 0) - g.dt; if(p.t[id] > 0) return false; p.t[id] = base*p.cdm; return true; }
    function skills(dt){
      const L = lvOf;
      // 람다
      if(L('acorn') && cd('acorn', L('acorn') >= 4 ? 0.62 : 0.85)){
        const n = L('acorn') >= 5 ? 3 : L('acorn') >= 3 ? 2 : 1;
        const ts = nearest(n, 420);
        ts.forEach(e => { const a = Math.atan2(e.y - p.y, e.x - p.x); g.shots.push({ k:'acorn', lv:L('acorn'), x:p.x, y:p.y, vx:Math.cos(a)*420, vy:Math.sin(a)*420, r:6 + L('acorn')*0.5, dmg:(4 + L('acorn')*1.6), pierce:L('acorn') >= 5 ? 2 : 0, life:1.2, hit:{} }); });
        if(ts.length) g.events.push({ type:'throw' });
      }
      if(L('storm')){
        g.orbit += dt*4.2;
        if(cd('stormTick', 0.18)){ const R = 70*p.area; for(let i = 0; i < 5; i++){ const a = g.orbit + i*Math.PI*2/5; inCircle(p.x + Math.cos(a)*R, p.y + Math.sin(a)*R, 14, e => hurt(e, 9, e.x - p.x, e.y - p.y, 80, 'storm')); } }
        if(cd('acorn', 0.45)){ nearest(3, 420).forEach(e => { const a = Math.atan2(e.y - p.y, e.x - p.x); g.shots.push({ k:'acorn', lv:6, x:p.x, y:p.y, vx:Math.cos(a)*460, vy:Math.sin(a)*460, r:8, dmg:14, pierce:3, life:1.2, hit:{} }); }); }
      }
      if(L('tail') && cd('tail', L('tail') >= 4 ? 1.5 : 2.1)){
        const R = (52 + L('tail')*8 + (L('tail') >= 5 ? 20 : 0))*p.area;
        inCircle(p.x, p.y, R, e => hurt(e, 6 + L('tail')*2.5, e.x - p.x, e.y - p.y, 160, 'tail'));
        g.events.push({ type:'tail', r:R, lv:L('tail') });
      }
      if(L('button') && cd('button', L('button') >= 5 ? 1.7 : 2.4)){
        const n = L('button') >= 3 ? 2 : 1;
        const tg = nearest(1, 380)[0], a0 = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : Math.atan2(p.fy, p.fx);
        for(let i = 0; i < n; i++){ const a = a0 + (i ? Math.PI : 0); const sp = 320;
          g.shots.push({ k:'button', lv:L('button'), x:p.x, y:p.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:11, dmg:8 + L('button')*3, pierce:999, life:L('button') >= 4 ? 1.9 : 1.5, boomer:true, t:0, hit:{} }); }
      }
      // 북거씨
      if(L('spray') && cd('spray', L('spray') >= 4 ? 0.8 : 1.1)){
        const len = (95 + (L('spray') >= 5 ? 50 : 0))*p.area*(L('spray') >= 3 ? 1.15 : 1), half = 0.5, tg = nearest(1, len + 60)[0], fa = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : Math.atan2(p.fy, p.fx);
        for(const e of g.foes){ if(e.dead) continue; const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy); if(d > len + e.r) continue;
          let da = Math.abs(((Math.atan2(dy, dx) - fa + Math.PI*3) % (Math.PI*2)) - Math.PI); if(da < half + e.r/Math.max(d, 1)){ hurt(e, 5 + L('spray')*2, dx, dy, 40, 'spray'); if(L('spray') >= 3) e.slow = Math.max(e.slow, 1.2); } }
        g.events.push({ type:'spray', len, a:fa, lv:L('spray') });
      }
      if(L('tide')){
        if(cd('spray', 0.55)){ const len = 150*p.area, tg = nearest(1, len + 60)[0], fa = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : Math.atan2(p.fy, p.fx);
          for(const e of g.foes){ if(e.dead) continue; const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy); if(d > len + e.r) continue;
            let da = Math.abs(((Math.atan2(dy, dx) - fa + Math.PI*3) % (Math.PI*2)) - Math.PI); if(da < 0.6) { hurt(e, 14, dx, dy, 60, 'tide'); e.slow = 1.2; } }
          g.events.push({ type:'spray', len, a:fa, lv:5, tide:true }); }
        if(cd('tideWave', 2.0)){ g.areas.push({ k:'wave', x:p.x, y:p.y, r:10, R:240*p.area, life:0.7, t:0, dmg:24, kb:280, hit:{}, big:true }); g.events.push({ type:'wave', big:true }); }
      }
      if(L('wave') && cd('wave', L('wave') >= 4 ? 2.3 : 3.1)){
        g.areas.push({ k:'wave', x:p.x, y:p.y, r:10, R:(115 + L('wave')*14 + (L('wave') >= 5 ? 40 : 0))*p.area, life:0.55, t:0, dmg:6 + L('wave')*2.5, kb:150, hit:{} });
        g.events.push({ type:'wave', lv:L('wave') });
      }
      if(L('euca') && cd('euca', 3.2)){
        const n = L('euca') >= 3 ? 2 : 1, ts = nearest(6, 360);
        for(let i = 0; i < n && ts.length; i++){ const e = ts[Math.floor(rnd()*ts.length)];
          g.events.push({ type:'euca', x:e.x, y:e.y }); g.areas.push({ k:'euca', lv:L('euca'), x:e.x, y:e.y, r:(40 + (L('euca') >= 4 ? 16 : 0))*p.area, life:L('euca') >= 5 ? 5 : 3.5, t:0, dmg:1.5 + L('euca')*0.8, tick:0 }); }
      }
    }

    function skills2(dt){
      const L = lvOf;
      // 끼토
      if(L('ear') && cd('ear', L('ear') >= 4 ? 1.6 : 2.2)){
        g.areas.push({ k:'wave', src:'ear', col:'238,143,174', x:p.x, y:p.y, r:6, R:(70 + L('ear')*10 + (L('ear') >= 5 ? 30 : 0))*p.area, life:0.4, t:0, dmg:4 + L('ear')*2, kb:70, slowT: L('ear') >= 3 ? 1.2 : 0, hit:{} });
        g.events.push({ type:'ear', lv:L('ear') }); }
      const strokes = (n, len, w, dmg, src, spread, base) => { for(let i = 0; i < n; i++){ const a = base + (i - (n - 1)/2)*spread, x2 = p.x + Math.cos(a)*len, y2 = p.y + Math.sin(a)*len;
          onLine(p.x, p.y, x2, y2, w, e => hurt(e, dmg, Math.cos(a), Math.sin(a), 60, src)); g.events.push({ type:'brush', x1:p.x, y1:p.y, x2, y2, w, i, rainbow: src === 'rainbow' }); } };
      if(L('brush') && cd('brush', 1.6)){ const tg = nearest(1, 260)[0], a = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : Math.atan2(p.fy, p.fx);
        strokes(L('brush') >= 5 ? 3 : L('brush') >= 3 ? 2 : 1, (160 + L('brush')*18)*p.area, 12, 7 + L('brush')*2.5 + (L('brush') >= 4 ? 4 : 0), 'brush', 0.45, a); }
      if(L('rainbow') && cd('rainbow', 1.0)){ strokes(6, 230*p.area, 16, 20, 'rainbow', Math.PI/3, g.t*1.3); }
      if(L('pearl')){ g.pearlA = (g.pearlA || 0) + dt*(L('pearl') >= 4 ? 4.5 : 3); const n = L('pearl') >= 5 ? 4 : L('pearl') >= 3 ? 3 : 2, R = 52*p.area;
        if(cd('pearlTick', 0.2)) for(let i = 0; i < n; i++){ const a = g.pearlA + i*Math.PI*2/n; inCircle(p.x + Math.cos(a)*R, p.y + Math.sin(a)*R, 10, e => hurt(e, 4 + L('pearl')*1.6, e.x - p.x, e.y - p.y, 60, 'pearl')); } }
      // 미개
      const ant = (dmg, src) => g.shots.push({ k:'ant', src, x:p.x, y:p.y, vx:(rnd() - 0.5)*200, vy:(rnd() - 0.5)*200, r:7, dmg, pierce:3, life:3.2, home:true, hit:{} });
      if(L('ants')){ const cap = 5 + (L('ants') >= 3 ? 2 : 0) + (L('ants') >= 5 ? 2 : 0), have = g.shots.filter(s => s.k === 'ant').length;
        if(cd('ants', L('ants') >= 4 ? 0.7 : 1.0) && have < cap) ant(8 + L('ants')*3, 'ants'); }
      if(L('march') && cd('march', 0.28) && g.shots.filter(s => s.k === 'ant').length < 14) ant(12, 'march');
      if(L('zap') && cd('zap', L('zap') >= 4 ? 1.1 : 1.5)){ let cur = nearest(1, 260)[0]; const pts = [[p.x, p.y - 10]], n = 3 + (L('zap') >= 2 ? 1 : 0) + (L('zap') >= 5 ? 2 : 0), seen = new Set();
        for(let i = 0; i < n && cur; i++){ seen.add(cur); pts.push([cur.x, cur.y]); hurt(cur, 10 + L('zap')*3 + (L('zap') >= 3 ? 5 : 0), cur.x - p.x, cur.y - p.y, 30, 'zap');
          let nx = null, nd = 110*110; for(const e of g.foes){ if(e.dead || seen.has(e)) continue; const d = (e.x - cur.x)**2 + (e.y - cur.y)**2; if(d < nd){ nd = d; nx = e; } } cur = nx; }
        if(pts.length > 1) g.events.push({ type:'zap', pts }); }
      if(L('burrow') && cd('burrow', 2.8)){ const n = L('burrow') >= 5 ? 3 : L('burrow') >= 3 ? 2 : 1, ts = nearest(8, 300);
        for(let i = 0; i < n && ts.length; i++){ const e = ts[Math.floor(rnd()*ts.length)]; g.areas.push({ k:'burrow', x:e.x, y:e.y, r:(40 + (L('burrow') >= 2 ? 10 : 0))*p.area, life:0.75, t:0, dmg:12 + L('burrow')*3 + (L('burrow') >= 4 ? 8 : 0), popped:false }); } }
      // 할머니
      if(L('yarn') && cd('yarn', 1.15)){ const n = L('yarn') >= 5 ? 3 : L('yarn') >= 3 ? 2 : 1, tg = nearest(1, 360)[0], a0 = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : Math.atan2(p.fy, p.fx);
        for(let i = 0; i < n; i++){ const a = a0 + (i - (n - 1)/2)*0.5; g.shots.push({ k:'yarn', x:p.x, y:p.y, vx:Math.cos(a)*240, vy:Math.sin(a)*240, r:(L('yarn') >= 4 ? 17 : 13), dmg:10 + L('yarn')*3.5, pierce:999, life:2.0, slowT:1.2, hit:{} }); } }
      if(L('tongs') && cd('tongs', L('tongs') >= 3 ? 1.2 : 1.7)){ const c = g.foes.filter(e => !e.dead && (e.x - p.x)**2 + (e.y - p.y)**2 < 240*240).sort((a, b) => b.hp - a.hp).slice(0, L('tongs') >= 5 ? 2 : 1);
        c.forEach(e => { hurt(e, 18 + L('tongs')*7 + (L('tongs') >= 4 ? 10 : 0), e.x - p.x, e.y - p.y, 100, 'tongs'); g.events.push({ type:'tongs', x:e.x, y:e.y }); }); }
      if(L('tea')){ p.hp = Math.min(p.maxhp, p.hp + (0.8 + L('tea')*0.7)*dt); if(cd('teaFx', 1.6)) g.events.push({ type:'tea' }); }
      if(L('net') && cd('net', 2.6)){ const n = L('net') >= 4 ? 2 : 1, ts = nearest(8, 300);
        for(let i = 0; i < n && ts.length; i++){ const e = ts[Math.floor(rnd()*ts.length)]; g.areas.push({ k:'net', x:e.x, y:e.y, r:(55 + (L('net') >= 2 ? 12 : 0) + (L('net') >= 5 ? 25 : 0))*p.area, life:L('net') >= 3 ? 3.4 : 2.5, t:0, tick:0, dmg:6 + L('net')*2.5 }); } }
      if(L('scarf')){ g.scarfA = (g.scarfA || 0) + dt*3.2; if(cd('scarfTick', 0.22)){ const R = (90 + Math.sin(g.t*1.6)*50)*p.area; for(let i = 0; i < 8; i++){ const a = g.scarfA + i*0.28; inCircle(p.x + Math.cos(a)*R, p.y + Math.sin(a)*R, 13, e => { hurt(e, 11, e.x - p.x, e.y - p.y, 60, 'scarf'); e.slow = Math.max(e.slow, 0.6); }); } } }
      // 보늘
      const startRoll = (dist, rad, dmg, src, flop) => { const tg = nearest(1, dist + 80)[0]; let rx = tg ? tg.x - p.x : p.fx, ry = tg ? tg.y - p.y : p.fy; const m = Math.hypot(rx, ry) || 1; p.rdx = rx/m; p.rdy = ry/m; p.roll = 0.32; p.rollSpd = dist/0.32; p.rollR = rad; p.rollDmg = dmg; p.rollSrc = src; p.rollFlop = flop; p.rollHit = {}; g.events.push({ type:'roll', big: src === 'bigroll' }); };
      if(L('roll') && cd('roll', L('roll') >= 4 ? 1.3 : 1.8)) startRoll((140 + L('roll')*18 + (L('roll') >= 5 ? 50 : 0))*p.area, 28, 14 + L('roll')*4 + (L('roll') >= 3 ? 8 : 0), 'roll', false);
      if(L('bigroll') && cd('roll', 1.5)) startRoll(260*p.area, 40, 22, 'bigroll', true);
      const flop = (R, dmg, src) => { inCircle(p.x, p.y, R, e => hurt(e, dmg*(e.type === 'boss' ? 2 : 1), e.x - p.x, e.y - p.y, 220, src)); g.events.push({ type:'flop', r:R, big: src === 'bigroll' }); };
      if(L('flop') && cd('flop', L('flop') >= 4 ? 2.8 : 3.6)) flop((80 + L('flop')*12 + (L('flop') >= 5 ? 30 : 0))*p.area, 18 + L('flop')*6 + (L('flop') >= 3 ? 8 : 0), 'flop');
      if(L('yawn')){ const R = (70 + L('yawn')*10 + (L('yawn') >= 4 ? 15 : 0))*p.area; g.yawnR = R; inCircle(p.x, p.y, R, e => { e.slow = Math.max(e.slow, L('yawn') >= 5 ? 0.6 : 0.25); });
        if(L('yawn') >= 3 && cd('yawnTick', 0.5)) inCircle(p.x, p.y, R, e => hurt(e, 2 + L('yawn'), 0, 0, 0, 'yawn')); } else g.yawnR = 0;
      g._flop = flop;
    }

    g.update = function(dt){
      if(g.over || g.choices || g.chest) return;
      g.dt = dt; g.t += dt;
      if(g.t >= P.time){ g.over = true; g.win = true; g.events.push({ type:'end', win:true }); return; }
      // 주민 이동
      if(p.roll > 0){ p.roll -= dt; p.x += p.rdx*p.rollSpd*dt; p.y += p.rdy*p.rollSpd*dt;
        inCircle(p.x, p.y, p.rollR, e => { if(p.rollHit[e.id]) return; p.rollHit[e.id] = 1; hurt(e, p.rollDmg*(e.type === 'boss' ? 2.5 : 1), e.x - p.x, e.y - p.y, 260, p.rollSrc); });
        if(p.roll <= 0 && p.rollFlop) g._flop(110*p.area, 30, 'bigroll'); }
      else { const k = p.boost > 0 ? 1.4 : 1; p.x += p.ix*p.spd*k*dt; p.y += p.iy*p.spd*k*dt; }
      if(p.boost > 0) p.boost -= dt; if(p.invuln > 0) p.invuln -= dt;
      if(p.hurt > 0) p.hurt -= dt;
      spawner(dt);
      skills(dt); skills2(dt);
      // 골칫거리
      let touching = 0;
      for(const e of g.foes){
        if(e.dead) continue;
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
        if(d > P.despawnR && e.type !== 'boss'){ e.dead = true; continue; }
        const sp = e.spd*(e.root > 0 ? 0.08 : e.slow > 0 ? 0.55 : 1); if(e.root > 0) e.root -= dt;
        e.x += (dx/d*sp + e.vx)*dt; e.y += (dy/d*sp + e.vy)*dt;
        e.vx *= Math.max(0, 1 - dt*8); e.vy *= Math.max(0, 1 - dt*8);
        if(e.flash > 0) e.flash -= dt; if(e.slow > 0) e.slow -= dt;
        if(d < e.r + p.r){ touching += Math.max(1, e.dmg*Math.min(1, 0.6 + g.t/300) - p.armor); if(p.thorns && !(e.thornT > 0)){ e.thornT = 0.5; hurt(e, p.thorns, -dx, -dy, 120, 'shell'); g.events.push({ type:'thorn', x:e.x, y:e.y }); } }
        if(e.thornT > 0) e.thornT -= dt;
        if(e.type === 'boss'){ e.summonT = (e.summonT || 6) - dt; if(e.summonT <= 0){ e.summonT = 6; for(let i = 0; i < 6; i++) { const s = spawn('dust'); s.x = e.x + Math.cos(i)*50; s.y = e.y + Math.sin(i)*50; } g.events.push({ type:'summon' }); } }
      }
      // 서로 밀어내기 (겹쳐서 한 점에 뭉치지 않게) — 가까운 것끼리만 대충
      const fs = g.foes;
      for(let i = 0; i < fs.length; i++){ const a = fs[i]; if(a.dead) continue;
        for(let j = i + 1; j < Math.min(fs.length, i + 12); j++){ const b = fs[j]; if(b.dead) continue;
          const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx*dx + dy*dy;
          if(d2 < rr*rr && d2 > 0.01){ const d = Math.sqrt(d2), o = (rr - d)/2; a.x -= dx/d*o; a.y -= dy/d*o; b.x += dx/d*o; b.y += dy/d*o; } } }
      if(touching && (p.roll > 0 || p.invuln > 0)) touching = 0;   // 구르는 중·깜짝 무적
      if(touching){ p.hp -= touching*dt; if(p.hurt <= 0){ p.hurt = 0.35; g.events.push({ type:'hurt', shell: lvOf('shell') });
        if(lvOf('scare')){ p.boost = 1.2 + (lvOf('scare') >= 3 ? 0.5 : 0) + (lvOf('scare') >= 5 ? 0.5 : 0); p.invuln = 0.6; g.events.push({ type:'scare' }); } } }
      if(p.hp <= 0){ p.hp = 0; g.over = true; g.win = false; g.events.push({ type:'end', win:false }); return; }
      // 날아가는 것
      for(const s of g.shots){
        s.life -= dt;
        if(s.home){ s.tt = (s.tt || 0) - dt; if(s.tt <= 0 || !s.tg || s.tg.dead){ s.tt = 0.2; s.tg = nearestTo(s.x, s.y, 320); }
          if(s.tg){ const dx = s.tg.x - s.x, dy = s.tg.y - s.y, d = Math.hypot(dx, dy) || 1; s.vx += (dx/d*320 - s.vx)*Math.min(1, dt*7); s.vy += (dy/d*320 - s.vy)*Math.min(1, dt*7); }
          else { const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1; if(d > 40){ s.vx += (dx/d*200 - s.vx)*dt*4; s.vy += (dy/d*200 - s.vy)*dt*4; } } }
        if(s.boomer){ s.t += dt; const back = s.t > 0.55; if(back){ const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1; s.vx += dx/d*1400*dt; s.vy += dy/d*1400*dt; const m = Math.hypot(s.vx, s.vy); if(m > 420){ s.vx *= 420/m; s.vy *= 420/m; } if(d < 18 && s.t > 0.8) s.life = 0; } else { s.vx *= 1 - dt*1.2; s.vy *= 1 - dt*1.2; } }
        s.x += s.vx*dt; s.y += s.vy*dt;
        for(const e of g.foes){ if(e.dead || s.life <= 0) continue;
          if((e.x - s.x)**2 + (e.y - s.y)**2 < (e.r + s.r)**2){
            const last = s.hit[e.id] || -9; if(g.t - last < 0.4) continue; s.hit[e.id] = g.t;
            hurt(e, s.dmg, s.vx, s.vy, s.k === 'ant' ? 20 : 70, s.src || s.k); if(s.slowT) e.slow = Math.max(e.slow, s.slowT); if(!s.boomer){ if(s.pierce-- <= 0) s.life = 0; } } }
      }
      g.shots = g.shots.filter(s => s.life > 0);
      // 퍼지는 것·깔린 것
      for(const a of g.areas){
        a.t += dt; a.life -= dt;
        if(a.k === 'wave'){ a.r = a.R*Math.min(1, a.t/ (a.life + a.t)); a.x = a.x; inCircle(a.x, a.y, a.r, e => { if(a.hit[e.id]) return; const d = Math.hypot(e.x - a.x, e.y - a.y); if(d > a.r - 26 - e.r){ a.hit[e.id] = 1; hurt(e, a.dmg, e.x - a.x, e.y - a.y, a.kb, a.src || (a.big ? 'tide' : 'wave')); if(a.slowT) e.slow = Math.max(e.slow, a.slowT); } }); }
        if(a.k === 'burrow' && !a.popped && a.t >= 0.4){ a.popped = true; inCircle(a.x, a.y, a.r, e => hurt(e, a.dmg, e.x - a.x, e.y - a.y, 160, 'burrow')); g.events.push({ type:'burrowPop', x:a.x, y:a.y, r:a.r }); }
        if(a.k === 'net'){ inCircle(a.x, a.y, a.r, e => { if(e.type !== 'boss') e.root = Math.max(e.root || 0, 0.2); }); a.tick -= dt; if(a.tick <= 0){ a.tick = 0.5; inCircle(a.x, a.y, a.r, e => hurt(e, a.dmg, 0, 0, 0, 'net')); } }
        if(a.k === 'euca'){ a.tick -= dt; inCircle(a.x, a.y, a.r, e => { e.slow = Math.max(e.slow, 0.15); }); if(a.tick <= 0){ a.tick = 0.5; inCircle(a.x, a.y, a.r, e => hurt(e, a.dmg, 0, 0, 0, 'euca')); } }
      }
      g.areas = g.areas.filter(a => a.life > 0);
      g.foes = g.foes.filter(e => !e.dead);
      // 도토리 줍기
      for(const m of g.gems){
        const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1;
        if(d < p.magnet || m.pull){ m.pull = true; const sp = 380 + (m.sp = (m.sp || 0) + dt*900); m.x += dx/d*Math.min(d, sp*dt); m.y += dy/d*Math.min(d, sp*dt); }
        if(d < p.r + 6){ m.got = true; p.xp += m.v*p.xpK; g.events.push({ type:'gem', big:m.big });
          while(p.xp >= p.next){ p.xp -= p.next; p.lv++; p.next = need(p.lv); g.pendingUp++; } }
      }
      g.gems = g.gems.filter(m => !m.got);
      for(const c of g.chests){ if(Math.hypot(p.x - c.x, p.y - c.y) < p.r + 18){ c.got = true; g.chest = true; g.events.push({ type:'chest' }); } }
      g.chests = g.chests.filter(c => !c.got);
      if(g.gems.length > 400) g.gems.splice(0, g.gems.length - 400);
      if(g.pendingUp > 0 && !g.choices){ const o = offers();
        if(o.length){ g.choices = o; g.events.push({ type:'levelup', lv:p.lv }); }
        else { g.pendingUp = 0; p.hp = Math.min(p.maxhp, p.hp + p.maxhp*0.3); g.events.push({ type:'allmax' }); } }   // 모든 기술이 최고 단계면 카드 대신 체력 회복
    };

    g.result = () => ({ t:Math.floor(g.t), kills:g.kills, win:g.win, boss:g.bossDown, lv:p.lv });
    return g;
  }

  const api = { DEFAULTS, FOES, SKILLS, HEROES, HERO_XP, MAXLV, heroLevel, heroGain, Game, mulberry32 };
  if(typeof module !== 'undefined') module.exports = api; else root.PatrolCore = api;
})(this);
