#!/usr/bin/env python3
"""삽화 보정. 두 가지 모드.
  edit  : 기존 컷 1장만 참조로 넣고 국소 결함만 고침 (토큰 최소)
  regen : 768로 줄인 캐릭터 보드 + 라인업 + 배경으로 새로 그림
사용: fix.py <id> [...]   /  fix.py all
"""
import subprocess, sys, os, time
SC=os.path.dirname(os.path.abspath(__file__)); AD="/home/user/somsom-city/assets/day/"
R=SC+"/refs768/"; OUT=SC+"/out/fix"; os.makedirs(OUT,exist_ok=True)
PRO,FLASH="gemini-3-pro-image","gemini-3.1-flash-image"

CANON=("Canon reminders: eyes are small white circles with a black dot pupil, always visible. "
 "Kkito is a pink rabbit with NO nose, two long upright ears the same pink as her face with a small light-pink oval only at each ear TIP, and two tiny curly strands on her forehead; she wears a white sleeveless blouse and blue trousers. "
 "Boneul is a grey sloth, the TALLEST character, with long arms, a plain white t-shirt, and a slow droopy-eyed face. "
 "Ramda is a red-brown squirrel with a big bushy upright tail, round dark eyes, a red plaid shirt and brown overalls — a squirrel, never a cat. "
 "Grandma Lachilchin is a grey chinchilla: small, round, very fluffy, with big round ears, a short blunt muzzle, round gold glasses resting on top of her head, a purple cardigan and mustard skirt — a chinchilla, never a cat or dog. "
 "Bookgeo is a green tortoise walking on all four legs with a SHORT thick neck (never long or giraffe-like), square black glasses, and a black turtleneck; when he holds something he uses exactly ONE arm from under the front of his shell. "
 "Migae is a small black ant standing on its rear four legs with its two front legs held up as short arms, a pink bow on the head. "
 "HEIGHT RULE, measured against Kkito's full height: Boneul 110%, Kkito 100%, Ramda's head reaches Kkito's mid-chest (67%), Grandma's head reaches Kkito's hip (57%), Bookgeo on four legs reaches Kkito's knee (47%), Migae reaches just below Kkito's knee (41%) — Migae is never taller than Kkito's knee. "
 "Style: thin uniform dark outlines, flat matte colors, no shading, no gradients, muted pastel palette. No text, no watermark.")

# ---- 국소 보정 (기존 컷 1장만 참조) ----
EDIT={}
def edit(id,what): EDIT[id]=("Redraw this EXACT illustration keeping the composition, camera angle, background, props and colors identical. Change ONLY this: "+what+"\n\n"+CANON)

# ---- 전체 재생성 ----
REGEN={}
def regen(id,chars,bg,text,model=FLASH): REGEN[id]=(model,chars,bg,text)

# ===== 전체 보정 목록 =====
ANT="Migae the ant is drawn much too large. Shrink Migae so the top of its head reaches only just below Kkito's knee (about 40% of Kkito's height), keeping the same pose and position."
NECK="Bookgeo's neck is drawn far too long, like a giraffe. Redraw him with a SHORT thick tortoise neck so his head sits close to the front of his shell, and keep him low on all four legs at Kkito's knee height."
TWO='There appear to be two tortoises / two shells. There must be exactly ONE Bookgeo: one green tortoise on four legs with one shell, a short thick neck and square black glasses. Remove the duplicate.'
EAR="Kkito's ears are drooping down like a lop rabbit. Redraw her two long ears standing straight UP from the top of her head, the same pink as her face with a small light-pink oval only at each ear tip."
SQ='Ramda is drawn like a cat. Redraw her as a red-brown squirrel: a big bushy upright tail, small rounded squirrel ears, a short muzzle, round dark eyes, red plaid shirt and brown overalls. Not a cat.'
CH='Grandma Lachilchin is drawn like a cat or a dog. Redraw her as a grey chinchilla: small and round, very fluffy, big round ears, a short blunt muzzle, round gold glasses resting on top of her head, purple cardigan and mustard skirt. Not a cat, not a dog.'
for _i in ["r_gm_carttest","r_gm_wave","r_mg_found_bamboo","r_mg_found_tree","r_mg_found_shop","r_mg_found_atelier","r_mg_wet","m1_migae_better","d20_walk_wind","w_n_sign","p_mg_back","p_w2","u_walk_shade","n2_wet_leaf","a7_sleep_in"]: edit(_i,ANT)
edit("u_mg_hot", ANT+" Its legs are also tangled and there seem to be too many; draw a clean ant body with six legs, standing on its rear four legs with the two front legs held up as short arms.")
edit("p_v_snack", ANT+" "+CH)
edit("s2_boneul_waiting", ANT+" Boneul also has no visible arms; draw his two long sloth arms crossed in front of his chest.")
for _i in ["w_gm_window_song","s7_rain_scent"]: edit(_i,NECK)
edit("w_bk_oldbottle", NECK+" "+ANT)
for _i in ["w_v_lantern","b2_migae","w_bk_blend"]: edit(_i,TWO)
edit("b2_kkito", TWO+" Also remove the grey chinchilla character entirely — only Bookgeo the tortoise and Kkito the pink rabbit belong in this scene.")
for _i in ["u_eve_n","u_fest_alone","b3_give","u_w2"]: edit(_i,EAR)
for _i in ["p_lam_cup","p_lam_poster","u_v_fan","d6_ramda_buttons","i1_kkomeon"]: edit(_i,SQ)
edit("b2_customer", SQ+" Her tail is also drawn far larger than her body; make the tail about as tall as her torso, not bigger.")
for _i in ["i1_grandma","s11_portrait","u_n_fan","d16_ginkgo_grandma"]: edit(_i,CH)
edit("a8_sick_migae","Kkito is wearing purple trousers. Change them to her canon blue denim trousers. "+ANT)
edit("r_ms_fail", EAR+" Keep her sad expression.")

regen("u_v_bkshade",["kkito","bookgeo","migae"],"bg_day_perfume_atelier",
 "the shaded spot in front of the perfume atelier in summer heat, strong sun and deep flat shadows. Bookgeo the green tortoise sits very still on all four legs, his shell wet with water drops, square black glasses on, eyes half closed, his neck short and thick. Kkito the pink rabbit sits beside him in the shade with her knees up, her two long ears straight up but slightly wilted from the heat, wearing her white sleeveless blouse and blue trousers. Migae lies flat in the shade under the front edge of Bookgeo's shell, tiny.")
regen("u_fest_book",["kkito","migae","boneul","ramda","bookgeo","lachilchin"],"bg_alley_night",
 "a summer night rooftop film festival: a glowing white cloth screen on a laundry line showing a simple crayon drawing of an alley, folding chairs in rows, string lights, the dark alley below. Kkito the pink rabbit stands beside the screen holding an open picture book, reading aloud, her two long ears straight up, cheeks flushed. In the chairs, each exactly once at correct heights: Boneul the sloth tallest in the back row smiling, Ramda the squirrel at the projector with her bushy tail high, Bookgeo the tortoise on four legs with glasses at the side aisle, Grandma the chinchilla small and round in the front row. Migae sits at Kkito's feet, only knee-high.",PRO)
regen("r_bon_shy",["kkito","boneul","migae"],"bg_alley_ginkgo",
 "the ginkgo alley in autumn, yellow leaves overhead and on the ground. Boneul the grey sloth, the tallest character, stands with his long arms hanging and his hands clasped low in front of him, looking away with his usual droopy-eyed deadpan face — his face must be clearly drawn, not blurred. Kkito the pink rabbit stands beside him with her two long ears straight up, looking up at him, one hand raised in a small wave. Migae sits at her feet, only knee-high.")
regen("r_fest_alone",["kkito","migae"],"bg_day_festival",
 "the autumn festival park at night, string lights overhead, a red-and-white striped stage curtain and empty wooden benches, ginkgo leaves on the ground. Kkito the pink rabbit sits alone on a bench in the FOREGROUND, drawn large enough to fill roughly the lower half of the frame so her face reads clearly, her two long ears up, hands in her lap, looking at the empty stage. Migae sits on the bench beside her, small. Quiet and a little lonely.")
regen("p_fest_alone",["kkito","migae"],"bg_alley_green",
 "a spring flea market alley with striped stall awnings and bunting, fresh green trees, but one chalk square on the ground is completely empty. Kkito the pink rabbit sits in the FOREGROUND inside that empty chalk square hugging her knees, drawn large enough to fill roughly the lower half of the frame so her face reads clearly, her two long ears drooping slightly with disappointment. Migae sits beside her looking up at her, small. The shop shutter behind is half down.")
regen("w_gm_song",["kkito","lachilchin","migae"],"bg_day_grandma_room",
 "Grandma's small fifth-floor room in winter, snow at the open window, warm lamp light. Grandma Lachilchin, a small round grey chinchilla with big round ears and round gold glasses on top of her head, sits ON the chair by the open window humming with her eyes closed, one hand on the sill — she must be clearly the main figure, not an empty chair. Kkito the pink rabbit sits on the floor beside the chair listening, her two long ears straight up. Migae sits on the windowsill, tiny.")


# ===== 2차: 편집으로 안 고쳐진 7장 전체 재생성 =====
regen("b2_customer",["bookgeo","ramda"],"bg_day_perfume_atelier",
 "inside the perfume atelier in winter, snow at the window, shelves of small bottles, warm lamp light. Ramda the red-brown squirrel stands at the counter with a big bright smile but her bushy tail hanging LOW behind her — her tail is about as tall as her torso, not larger than her body — holding a coiled string of unlit paper lanterns. Bookgeo the green tortoise stands behind the counter on all four legs, short thick neck, square black glasses, holding two small bottles (one orange, one purple) in ONE arm from under the front of his shell. Only these two characters.")
regen("b2_migae",["bookgeo","migae"],"bg_day_perfume_atelier",
 "inside the perfume atelier in winter, warm lamp light, snow at the window. Exactly ONE tortoise: Bookgeo, a green tortoise standing still on all four legs with a single brown shell, a short thick neck and square black glasses, eyes half closed and patient. Migae the small black ant is curled up asleep ON TOP of his shell, tiny — about the size of Bookgeo's head. No second tortoise, no second shell, no other characters.")
regen("r_gm_carttest",["kkito","lachilchin","migae"],"bg_alley_ginkgo",
 "the ginkgo alley in autumn, yellow leaves overhead and on the ground. A small wooden wagon with wheels and a cushion. Grandma Lachilchin, a small round grey chinchilla with round gold glasses on top of her head, sits in the wagon smiling with crescent eyes. Kkito the pink rabbit pushes the wagon from behind, her two long ears straight up. Migae the ant pulls the wagon handle from the front — Migae is TINY, its head reaching only just below Kkito's knee, much smaller than the wagon.")
regen("r_mg_found_tree",["kkito","migae"],"bg_alley_ginkgo",
 "under a big ginkgo tree in autumn, a thick drift of yellow leaves piled on the ground. Migae the small black ant sits on top of the leaf pile with leaves stuck on it, antennae raised in a heart shape — Migae is TINY, no taller than Kkito's knee. Kkito the pink rabbit kneels in front of the pile with both arms open, her two long ears straight up, eyes wet with relief. Only these two.")
regen("r_mg_wet",["kkito","migae"],"bg_day_entry",
 "night at the open front door of apartment 901, a puddle on the doormat, autumn leaves blown in. Migae the small black ant stands soaked on the doormat, antennae drooping — Migae is TINY, its head reaching only just below Kkito's knee. Kkito the pink rabbit kneels in the doorway wrapping a towel around Migae, her two long ears straight up, a tired relieved face. Only these two.")
regen("u_w2",["kkito","migae"],"bg_alley_heat",
 "the alley in peak summer heat, washed-out bright light and deep flat shadows, dusty green leaves. Kkito the pink rabbit lies on her back on a wooden bench in the shade with a wet towel folded on her forehead, her two long ears hanging over the END of the bench but still clearly long rabbit ears, wearing her white sleeveless blouse and blue trousers. Migae the small black ant lies flat on the ground under the bench, tiny. A paper fan on the ground.")
regen("w_v_lantern",["kkito","ramda","bookgeo","migae"],"bg_alley_winter",
 "the snowy alley in winter, bare trees, snow on the ground. Ramda the red-brown squirrel stands on a wooden ladder reaching down, bushy tail high. Exactly ONE tortoise: Bookgeo, a green tortoise on all four legs with a single shell, short thick neck and square black glasses, lifting one round paper lantern up toward her with ONE arm from under the front of his shell. Kkito the pink rabbit holds the ladder steady, scarf on, ears up. Migae sits on Bookgeo's shell, tiny. No second tortoise.")

for _i in ["b2_customer","b2_migae","r_gm_carttest","r_mg_found_tree","r_mg_wet","u_w2","w_v_lantern"]: EDIT.pop(_i,None)

def run(id):
    outp=f"{OUT}/{id}"
    if os.path.exists(outp+"_0.png"): print("skip",id); return
    if id in EDIT:
        refs=[AD+id+"_0.jpg"]; prompt=EDIT[id]; model=FLASH; mode="edit"
    elif id in REGEN:
        model,chars,bg,text=REGEN[id]
        refs=[R+f"board_{c if c!='lachil' else 'lachilchin'}.jpg" for c in chars]+[R+"lineup.jpg"]
        b=R+"bg/"+bg+".jpg"
        if os.path.exists(b): refs.append(b)
        prompt=CANON+"\n\nThe reference images are character model sheets, then a height lineup, then the background/style guide. Draw ONLY the characters named below, each exactly once. Vertical 3:4 composition.\n\nScene: "+text
        mode="regen"
    else:
        print("unknown",id); return
    miss=[r for r in refs if not os.path.exists(r)]
    if miss: print("MISSING",id,miss); return
    open(outp+".prompt.txt","w").write(prompt)
    env=dict(os.environ,NB_MODEL=model,NB_AR="3:4",NB_SIZE="1K"); t=time.time()
    for a in range(2):
        r=subprocess.run([sys.executable,f"{SC}/gen.py",outp,"1",*refs],stdin=open(outp+".prompt.txt"),env=env,capture_output=True,text=True)
        print(f"{id:20s} {mode:5s} refs={len(refs)} {r.stdout.strip()[-60:]} ({time.time()-t:.0f}s)",flush=True)
        if os.path.exists(outp+"_0.png"): break
        time.sleep(4)

ids=sys.argv[1:] or ["all"]
if ids==["all"]: ids=list(EDIT)+list(REGEN)
for i in ids: run(i)
print("DONE")
