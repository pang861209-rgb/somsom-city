// 솜솜시티 테마곡 — 허브와 모든 게임에서 같은 노래를 이어서 튼다.
// 쓰는 법: <script src="../assets/bgm.js" data-pos="left:70px;top:8px"></script>
//   data-btn     : 이미 있는 버튼을 쓸 때 그 선택자(허브). 없으면 떠 있는 ♪ 버튼을 만든다.
//   data-pos     : 떠 있는 버튼 위치(CSS)
//   data-show-if : 이 선택자에 맞는 요소가 보일 때만 버튼을 보인다(게임 중엔 숨길 때)
//   data-vol     : 음량(기본 0.3, 게임 효과음보다 작게)
//   data-mute-key: 이 페이지 게임의 전체 음소거 키(기본 somsom_muted, 달리기는 runner_muted)
// 음악만 끄는 키는 somsom_bgm_off. 이 페이지 게임의 전체 음소거를 켜도 멈춘다.
// 음소거를 localStorage에 따로 두지 않는 게임(방범대)은 SomsomBgm.setGameMuted(true/false)로 알려준다.
// 페이지를 옮길 때마다 멈춘 자리(somsom_theme_t)부터 이어서 튼다.
(function(){
  if(window.SomsomBgm) return;
  const me = document.currentScript, d = (me && me.dataset) || {};
  const src = me ? me.src.replace(/bgm\.js(\?.*)?$/, 'somsom_theme.mp3') : 'assets/somsom_theme.mp3';
  const au = new Audio(src); au.preload = 'auto'; au.loop = true; au.volume = parseFloat(d.vol || '0.3');
  const get = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
  const off = () => get('somsom_bgm_off') === '1';
  const muteKey = d.muteKey || 'somsom_muted';
  let pageMuted = null;   // setGameMuted로 받은 값이 있으면 키 대신 이걸 쓴다
  // 다른 게임의 음소거 키는 보지 않는다 (달리기 음소거가 모든 게임의 노래를 끄던 문제)
  const gameMuted = () => pageMuted !== null ? pageMuted : get(muteKey) === '1';
  let forced = false;   // 게임 전체 음소거 중에 ♪로 노래만 켠 상태
  const should = () => !off() && (forced || !gameMuted());
  try{ const t = parseFloat(sessionStorage.getItem('somsom_theme_t')); if(t > 0) au.currentTime = t; }catch(e){}
  const keep = () => { try{ sessionStorage.setItem('somsom_theme_t', String(au.currentTime || 0)); }catch(e){} };
  let lastKeep = 0;
  au.addEventListener('timeupdate', () => { const n = Date.now(); if(n - lastKeep > 1000){ lastKeep = n; keep(); } });

  const tryPlay = () => { if(!should() || !au.paused || document.hidden) return; const p = au.play(); if(p && p.catch) p.catch(()=>{}); };
  // 휴대폰은 사용자가 한 번 누르기 전엔 소리를 막는다. 손을 뗄 때(pointerup·touchend·click)가 허용 동작이다.
  const EV = ['pointerup','touchend','click','keydown'];
  const kick = e => { if(btn && btn.contains(e.target)) return; tryPlay(); };
  EV.forEach(ev => document.addEventListener(ev, kick, {passive:true, capture:true}));
  au.addEventListener('playing', () => EV.forEach(ev => document.removeEventListener(ev, kick, {capture:true})));

  // 버튼
  let btn = d.btn ? document.querySelector(d.btn) : null;
  if(!btn){
    const st = document.createElement('style');
    st.textContent = '#somsomBgm{position:fixed;z-index:70;width:32px;height:32px;border-radius:50%;border:none;'
      + 'background:rgba(43,38,32,.86);color:#F2C14B;font:800 15px sans-serif;cursor:pointer;display:flex;'
      + 'align-items:center;justify-content:center;box-shadow:0 4px 14px -6px rgba(0,0,0,.8);padding:0;}'
      + '#somsomBgm.off{color:#8A8271;} #somsomBgm.off .nt{text-decoration:line-through;}'
      + '#somsomBgm .eq,#bgmBtn .eq{display:none;align-items:flex-end;gap:2px;height:13px;}'
      + '#somsomBgm.on .eq{display:flex;} #somsomBgm.on .nt{display:none;}'
      + '#somsomBgm .eq i{width:3px;background:#F2C14B;border-radius:1px;animation:somsomEq .9s ease-in-out infinite;}'
      + '#somsomBgm .eq i:nth-child(2){animation-delay:-.3s;} #somsomBgm .eq i:nth-child(3){animation-delay:-.6s;}'
      + '@keyframes somsomEq{0%,100%{height:4px;}50%{height:13px;}}';
    document.head.appendChild(st);
    btn = document.createElement('button');
    btn.id = 'somsomBgm'; btn.setAttribute('aria-label', '솜솜시티 노래 켜기·끄기');
    btn.innerHTML = '<span class="nt">♪</span><span class="eq"><i></i><i></i><i></i></span>';
    btn.style.cssText = (d.pos || 'left:70px;top:8px').replace(/top:\s*([\d.]+px)/, 'top:calc($1 + env(safe-area-inset-top))');
    (document.body || document.documentElement).appendChild(btn);
  }
  const paint = () => { btn.classList.toggle('on', !au.paused); btn.classList.toggle('off', off()); };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if(!au.paused){ forced = false; au.pause(); try{ localStorage.setItem('somsom_bgm_off','1'); }catch(e){} }
    else { try{ localStorage.setItem('somsom_bgm_off','0'); }catch(e){} forced = gameMuted(); tryPlay(); }
    paint();
  });
  au.addEventListener('play', paint); au.addEventListener('pause', paint);

  // 게임의 음소거 버튼을 누르면 따라 멈추고, 풀면 다시 튼다. 버튼을 보일지도 여기서 정한다.
  let wasMuted = gameMuted();
  const active = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  setInterval(() => {
    const m = gameMuted(); if(m !== wasMuted){ wasMuted = m; forced = false; }
    if(!should() && !au.paused) au.pause();
    else if(should() && au.paused && active()) tryPlay();
    if(d.showIf){ btn.style.display = document.querySelector(d.showIf) ? '' : 'none'; }
    paint();
  }, 500);

  addEventListener('pagehide', keep);
  document.addEventListener('visibilitychange', () => { if(document.hidden){ keep(); au.pause(); } else tryPlay(); });
  addEventListener('pageshow', e => { if(e.persisted) tryPlay(); });

  window.SomsomBgm = { audio: au, on: () => !au.paused,
    setGameMuted: m => { pageMuted = !!m; if(m){ forced = false; au.pause(); } else tryPlay(); paint(); } };
  paint(); tryPlay();
})();
