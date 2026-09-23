// ── 마을 창고 (V3) — 여섯 게임이 함께 쓰는 주간 공동 목표 ─────────────
// 한 판이 끝나면 각 게임이 SV.add(게임, 이번 판 도토리, 주민)를 부른다.
// Firestore village_week 에 한 줄씩 쌓고, 허브가 이번 주 합을 모아 보여 준다.
// 목표를 채우면 그 주의 보상 컷(assets/day/ 기존 삽화)이 모두에게 열린다.
(function(){
  const KEY='AIzaSyBfld7SRrVTxDG0nE_6Z3Mw5kSRTo5bIGY';
  const DOCS='https://firestore.googleapis.com/v1/projects/somsom-city/databases/(default)/documents';
  const ROOT=(function(){ // 이 스크립트가 있는 폴더 = 허브 루트 (게임은 ../village.js 로 부른다)
    const s=document.currentScript; return s ? s.src.replace(/village\.js(\?.*)?$/,'') : './'; })();
  const TARGET=1500, PER_RUN_MAX=300;
  const GAMES=['leaf','run','match','merge','expedition','defense'];
  const CUTS=["a1_deadline_0.jpg", "a2_rainwindow_0.jpg", "a3_market_0.jpg", "a4_complaint_0.jpg", "a5_ginkgo_call_0.jpg", "a6_festival_prep_0.jpg", "a7_sleep_in_0.jpg", "a8_sick_migae_0.jpg", "b1_edit_0.jpg", "b1_kkito_door_0.jpg", "b1_migae_crumbs_0.jpg", "b1_shoot_0.jpg", "b1_upload_0.jpg", "b1_wake_0.jpg", "b2_close_0.jpg", "b2_customer_0.jpg", "b2_kkito_0.jpg", "b2_label_0.jpg", "b2_migae_0.jpg", "b2_open_0.jpg", "b3_evening_0.jpg", "b3_give_0.jpg", "b3_snack_0.jpg", "b3_stairs_0.jpg", "b3_wake_0.jpg", "b3_window_0.jpg", "b4_alley_0.jpg", "b4_bookgeo_0.jpg", "b4_home_0.jpg", "b4_night_0.jpg", "b4_roof_0.jpg", "b4_trash_0.jpg", "b4_tree_0.jpg", "bg_alley_dusk.jpg", "bg_alley_ginkgo.jpg", "bg_alley_green.jpg", "bg_alley_heat.jpg", "bg_alley_may.jpg", "bg_alley_night.jpg", "bg_alley_petal.jpg", "bg_alley_rain.jpg", "bg_alley_spring.jpg", "bg_alley_summer.jpg", "bg_alley_winter.jpg", "bg_day_entry_dusk.jpg", "bg_day_entry_ginkgo.jpg", "bg_day_entry_green.jpg", "bg_day_entry_heat.jpg", "bg_day_entry_may.jpg", "bg_day_entry_night.jpg", "bg_day_entry_petal.jpg", "bg_day_entry_rain.jpg", "bg_day_entry_spring.jpg", "bg_day_entry_summer.jpg", "bg_day_entry_winter.jpg", "d10_lachil_hallway_0.jpg", "d11_lachil_sewing_0.jpg", "d12_lachil_album_0.jpg", "d13_rain_bookgeo_0.jpg", "d14_market_ramda_0.jpg", "d15_bamboo_boneul_0.jpg", "d16_ginkgo_grandma_0.jpg", "d17_festival_ladder_0.jpg", "d18_walk_sunny_0.jpg", "d19_walk_rain_0.jpg", "d1_boneul_cold_0.jpg", "d20_walk_wind_0.jpg", "d21_home_work_0.jpg", "d22_reconcile_pizza_0.jpg", "d2_boneul_toast_0.jpg", "d3_boneul_camera_0.jpg", "d4_ramda_shop_0.jpg", "d5_ramda_stationery_0.jpg", "d6_ramda_buttons_0.jpg", "d7_bookgeo_strip_0.jpg", "d8_bookgeo_bottle_0.jpg", "d9_bookgeo_name_0.jpg", "fs_boneul_booth.png", "fs_boneul_guest.png", "fs_bookgeo_bench.png", "fs_bookgeo_booth.png", "fs_kkito_guest.png", "fs_kkito_read.png", "fs_lachil_carried.png", "fs_lachil_cart.png", "fs_migae.png", "fs_migae_cart.png", "fs_ramda_back.png", "fs_ramda_guest.png", "fs_ramda_mc.png", "i1_boneul_0.jpg", "i1_end_ring_0.jpg", "i1_grandma_0.jpg", "i1_grandma_nap_0.jpg", "i1_kkito_button_0.jpg", "i1_kkomeon_0.jpg", "i1_rain_shop_0.jpg", "i1_window_bk_0.jpg", "m1_migae_better_0.jpg", "m2_night_nursing_0.jpg", "n2_wet_leaf_0.jpg", "n3_sign_changed_0.jpg", "n4_trash_sign_0.jpg", "n5_roasting_0.jpg", "n6_lights_on_0.jpg", "n7_sunday_nap_0.jpg", "p_a_garden_0.jpg", "p_a_market_0.jpg", "p_a_notice_0.jpg", "p_a_snack_0.jpg", "p_a_stall_0.jpg", "p_bk_paper_0.jpg", "p_bon_button_0.jpg", "p_bon_photo_0.jpg", "p_bon_signoff_0.jpg", "p_city_bk_0.jpg", "p_city_kkito_0.jpg", "p_city_ramda_0.jpg", "p_fest_alone_0.jpg", "p_fest_bg_0.jpg", "p_fest_frame_0.jpg", "p_fest_full_0.jpg", "p_fest_roof_0.jpg", "p_fest_sign_0.jpg", "p_fest_zone_0.jpg", "p_gm_frame_0.jpg", "p_gm_photo_0.jpg", "p_gm_window_frame_0.jpg", "p_gm_window_spring_0.jpg", "p_key_0.jpg", "p_lam_cityhall_0.jpg", "p_lam_cup_0.jpg", "p_lam_eve_0.jpg", "p_lam_eve_n_0.jpg", "p_lam_items_0.jpg", "p_lam_notice_0.jpg", "p_lam_notice_n_0.jpg", "p_lam_poster_0.jpg", "p_letter_city_0.jpg", "p_mg_back_0.jpg", "p_mg_blossom_0.jpg", "p_mg_found_0.jpg", "p_mg_gone_0.jpg", "p_mg_search_0.jpg", "p_n_garden_0.jpg", "p_n_market_0.jpg", "p_n_nap_0.jpg", "p_n_notice_0.jpg", "p_n_plate_0.jpg", "p_n_stall_0.jpg", "p_roof_0.jpg", "p_roof_locked_0.jpg", "p_roof_open_0.jpg", "p_v_bkdry_0.jpg", "p_v_shop_0.jpg", "p_v_sign_0.jpg", "p_v_snack_0.jpg", "p_v_stall_0.jpg", "p_w1_0.jpg", "p_w2_0.jpg", "p_w3_0.jpg", "p_w4_0.jpg", "p_walk_petal_0.jpg", "r_bk_blend_0.jpg", "r_bk_cart_0.jpg", "r_bk_jars_0.jpg", "r_bk_window_0.jpg", "r_bon_apply_0.jpg", "r_bon_bag_0.jpg", "r_bon_recipe_0.jpg", "r_bon_shy_0.jpg", "r_bon_sign_0.jpg", "r_bon_taste_0.jpg", "r_fest_alone_0.jpg", "r_fest_bg_0.jpg", "r_fest_booths_0.jpg", "r_fest_full_0.jpg", "r_fest_reading_0.jpg", "r_fest_window_0.jpg", "r_gm_carttest_0.jpg", "r_gm_roast_0.jpg", "r_gm_stairs_0.jpg", "r_gm_wave_0.jpg", "r_lam_ask_0.jpg", "r_lam_back_0.jpg", "r_lam_cityhall_0.jpg", "r_lam_draft_0.jpg", "r_lam_mend_0.jpg", "r_lam_notice_0.jpg", "r_lam_rehearsal_0.jpg", "r_lights_test_0.jpg", "r_mg_found_atelier_0.jpg", "r_mg_found_bamboo_0.jpg", "r_mg_found_shop_0.jpg", "r_mg_found_tree_0.jpg", "r_mg_leash_0.jpg", "r_mg_search_0.jpg", "r_mg_wet_0.jpg", "r_ms_fail_0.jpg", "r_ms_half_0.jpg", "r_ms_sent_0.jpg", "r_nt_desk_0.jpg", "r_nt_letter_0.jpg", "r_nt_sleep_0.jpg", "r_prep_alley_0.jpg", "s10_festival_night_0.jpg", "s11_portrait_0.jpg", "s1_keyring_0.jpg", "s2_boneul_waiting_0.jpg", "s3_scent_morning_0.jpg", "s6_trash_moved_0.jpg", "s7_rain_scent_0.jpg", "s8_boots_0.jpg", "s9_letter_0.jpg", "u2_ramda_giftbutton_0.jpg", "u3_ramda_shutter_0.jpg", "u4_bookgeo_walk_0.jpg", "u5_bookgeo_label_0.jpg", "u6_lachil_tea_0.jpg", "u7_lachil_lap_0.jpg", "u8_boneul_plate_0.jpg", "u_a_fan_0.jpg", "u_a_market_0.jpg", "u_a_roof_0.jpg", "u_a_snack_0.jpg", "u_a_water_0.jpg", "u_bon_film_0.jpg", "u_bon_meeting_0.jpg", "u_bon_screen_0.jpg", "u_book_0.jpg", "u_book_fall_0.jpg", "u_book_spring_0.jpg", "u_book_winter_0.jpg", "u_eve_0.jpg", "u_eve_n_0.jpg", "u_eve_quiet_0.jpg", "u_eve_told_0.jpg", "u_fest_alone_0.jpg", "u_fest_bff_0.jpg", "u_fest_bg_0.jpg", "u_fest_book_0.jpg", "u_fest_full_0.jpg", "u_fest_screen_0.jpg", "u_fest_wall_0.jpg", "u_fest_window_0.jpg", "u_gm_plates_0.jpg", "u_lam_mc_0.jpg", "u_lam_projector_0.jpg", "u_letter_ed_0.jpg", "u_meet_0.jpg", "u_meet_n_0.jpg", "u_mem1_0.jpg", "u_mem2_0.jpg", "u_mem3_0.jpg", "u_mg_cool_0.jpg", "u_mg_hot_0.jpg", "u_mg_rain_0.jpg", "u_n_cup_0.jpg", "u_n_fan_0.jpg", "u_n_nap_0.jpg", "u_n_roof_0.jpg", "u_n_shade_0.jpg", "u_n_tomato_0.jpg", "u_permit_0.jpg", "u_permit_n_0.jpg", "u_screen_up_0.jpg", "u_v_bkshade_0.jpg", "u_v_chairs_0.jpg", "u_v_fan_0.jpg", "u_v_ice_0.jpg", "u_v_tomato_0.jpg", "u_w1_0.jpg", "u_w2_0.jpg", "u_walk_shade_0.jpg", "u_wall_0.jpg", "w1_autumn_0.jpg", "w2_ginkgo_0.jpg", "w3_dusk_0.jpg", "w4_rain_0.jpg", "w5_winter_0.jpg", "w6_night_0.jpg", "w_a_lantern_0.jpg", "w_a_market_0.jpg", "w_a_mat_0.jpg", "w_a_snack_0.jpg", "w_a_snow_0.jpg", "w_bk_blend_0.jpg", "w_bk_note_0.jpg", "w_bk_oldbottle_0.jpg", "w_bk_road_0.jpg", "w_bk_walk_0.jpg", "w_bon_ask_0.jpg", "w_bon_cough_0.jpg", "w_bon_live_0.jpg", "w_bon_sick_0.jpg", "w_bon_soup_0.jpg", "w_fest_0.jpg", "w_fest_alone_0.jpg", "w_fest_bg_0.jpg", "w_fest_lanterns_0.jpg", "w_fest_live_0.jpg", "w_fest_sea_0.jpg", "w_fest_song_0.jpg", "w_gm_album_0.jpg", "w_gm_kimchi_0.jpg", "w_gm_song_0.jpg", "w_gm_window_0.jpg", "w_gm_window_song_0.jpg", "w_lam_box_0.jpg", "w_lam_inspect_0.jpg", "w_lam_lantern_0.jpg", "w_lam_paper_0.jpg", "w_lam_shop_0.jpg", "w_mg_alone_0.jpg", "w_mg_firstsnow_0.jpg", "w_mg_sick_0.jpg", "w_mg_visit1_0.jpg", "w_mg_visit3_0.jpg", "w_n_lantern1_0.jpg", "w_n_mat_0.jpg", "w_n_nap_0.jpg", "w_n_plate_0.jpg", "w_n_sign_0.jpg", "w_n_snowman_0.jpg", "w_v_bkslow_0.jpg", "w_v_lantern_0.jpg", "w_v_mat_0.jpg", "w_v_shop_0.jpg", "w_v_snack_0.jpg", "w_walk_snow_0.jpg"];
  // 이번 주 = 한국 시간 월요일 날짜(YYYYMMDD 정수)
  function weekKey(ms){
    const d=new Date((ms||Date.now())+9*3600e3); const wd=(d.getUTCDay()+6)%7;
    const m=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-wd));
    return m.getUTCFullYear()*10000+(m.getUTCMonth()+1)*100+m.getUTCDate();
  }
  function weekEnd(w){ const y=Math.floor(w/10000),mo=Math.floor(w/100)%100-1,da=w%100; return Date.UTC(y,mo,da+7)-9*3600e3; }
  function cutFor(w){ // 주마다 정해진 한 컷 (모두에게 같은 컷)
    const y=Math.floor(w/10000),mo=Math.floor(w/100)%100-1,da=w%100;
    const idx=Math.floor(Date.UTC(y,mo,da)/(7*864e5)); return ROOT+'assets/day/'+CUTS[((idx%CUTS.length)+CUTS.length)%CUTS.length];
  }
  function add(game, amount, charKey){
    const a=Math.max(0,Math.min(PER_RUN_MAX,Math.round(+amount||0)));
    if(!a || GAMES.indexOf(game)<0) return;
    const n=(localStorage.getItem('somsom_name')||'').slice(0,12);
    const body={fields:{ n:{stringValue:n}, g:{stringValue:game}, a:{integerValue:String(a)},
      w:{integerValue:String(weekKey())}, t:{integerValue:String(Date.now())}, c:{stringValue:String(charKey||'').slice(0,12)} }};
    try{ fetch(DOCS+'/village_week?key='+KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true})
      .then(()=>toastTotal(a)).catch(()=>toast(a,null)); }catch(e){}
    toast(a,null);
  }
  // 전체 기록을 주별로 묶는다 (이 규모에선 한 번에 읽는 게 가장 단순)
  async function weeks(){
    const r=await fetch(DOCS+':runQuery?key='+KEY,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({structuredQuery:{from:[{collectionId:'village_week'}],limit:5000}})});
    const j=await r.json(); const out={};
    if(!Array.isArray(j)) return out;
    for(const d of j){ if(!d.document) continue; const f=d.document.fields||{};
      const w=+((f.w||{}).integerValue||0), a=+((f.a||{}).integerValue||0), n=(f.n||{}).stringValue||'';
      const o=out[w]=out[w]||{w,total:0,people:{},games:{}}; o.total+=a;
      if(n) o.people[n]=(o.people[n]||0)+a; const g=(f.g||{}).stringValue||''; o.games[g]=(o.games[g]||0)+a; }
    for(const w in out){ const o=out[w]; o.reached=o.total>=TARGET;
      o.top=Object.entries(o.people).sort((x,y)=>y[1]-x[1]).slice(0,3).map(([n,a])=>({n,a})); o.cut=cutFor(+w); }
    return out;
  }
  async function thisWeek(){ const all=await weeks(), w=weekKey(); return all[w]||{w,total:0,people:{},games:{},top:[],reached:false,cut:cutFor(w)}; }

  // 판이 끝났을 때 뜨는 작은 알림 — 게임마다 따로 만들지 않도록 여기서 그린다
  let el=null, hideT=null;
  function toast(a,total){
    if(!el){ el=document.createElement('div');
      el.style.cssText='position:fixed;left:50%;top:calc(58px + env(safe-area-inset-top));transform:translateX(-50%);z-index:9999;'
        +'background:#2B2620;color:#EFE7D6;border-radius:16px;padding:9px 15px;font:700 13px "Apple SD Gothic Neo","Noto Sans KR",sans-serif;'
        +'box-shadow:0 12px 30px -14px rgba(0,0,0,.85);display:flex;align-items:center;gap:9px;white-space:nowrap;pointer-events:none;'
        +'transition:opacity .3s;opacity:0;';
      document.body.appendChild(el); }
    const pct = total==null ? null : Math.min(100,Math.round(total/TARGET*100));
    el.innerHTML='<span style="font-size:18px">🧺</span><span>마을 창고 <b style="color:#F2C14B">+'+a+'</b>'
      +(total==null?'':' · '+total.toLocaleString()+' / '+TARGET.toLocaleString()
        +'<span style="display:block;height:5px;border-radius:3px;background:rgba(255,255,255,.14);margin-top:5px;overflow:hidden">'
        +'<i style="display:block;height:100%;width:'+pct+'%;background:#F2C14B"></i></span>')+'</span>';
    el.style.opacity='1'; clearTimeout(hideT); hideT=setTimeout(()=>{ el.style.opacity='0'; },3600);
  }
  async function toastTotal(a){ try{ const tw=await thisWeek(); toast(a,tw.total); }catch(e){} }

  window.SV={ TARGET, weekKey, weekEnd, cutFor, add, weeks, thisWeek };
})();
