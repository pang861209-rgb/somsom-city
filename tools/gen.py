#!/usr/bin/env python3
"""Nano Banana Pro (gemini-3-pro-image) 호출: 참고 그림 + 프롬프트 → PNG 저장.
사용: gen.py <out_prefix> <n_shots> <ref1> [ref2 ...] < prompt.txt
키는 환경의 API 자격 증명(에이전트 프록시)이 붙여 주므로 스크립트에는 없음."""
import base64, json, sys, time, urllib.request, os

MODEL = os.environ.get("NB_MODEL", "gemini-3-pro-image")
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

out_prefix, n = sys.argv[1], int(sys.argv[2])
refs = sys.argv[3:]
prompt = sys.stdin.read().strip()

parts = []
for r in refs:
    raw = open(r, "rb").read()
    mime = "image/jpeg" if raw[:3] == b"\xff\xd8\xff" else "image/png"
    parts.append({"inline_data": {"mime_type": mime, "data": base64.b64encode(raw).decode()}})
parts.append({"text": prompt})

body = {
    "contents": [{"role": "user", "parts": parts}],
    "generationConfig": {
        "responseModalities": ["IMAGE"],
        "imageConfig": {"aspectRatio": os.environ.get("NB_AR", "3:4"), "imageSize": os.environ.get("NB_SIZE", "1K")},
    },
}
data = json.dumps(body).encode()

for i in range(n):
    req = urllib.request.Request(URL, data=data, headers={"Content-Type": "application/json"})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            res = json.load(resp)
    except urllib.error.HTTPError as e:
        print(f"shot {i}: HTTP {e.code} {e.read()[:400]!r}"); continue
    saved = False
    for cand in res.get("candidates", []):
        for p in cand.get("content", {}).get("parts", []):
            if "inlineData" in p:
                fn = f"{out_prefix}_{i}.png"
                open(fn, "wb").write(base64.b64decode(p["inlineData"]["data"]))
                print(f"shot {i}: saved {fn} ({time.time()-t:.0f}s)"); saved = True
    if not saved:
        print(f"shot {i}: no image. finish={res.get('candidates',[{}])[0].get('finishReason')} "
              f"{json.dumps(res)[:300]}")
