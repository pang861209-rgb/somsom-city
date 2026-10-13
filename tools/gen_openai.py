#!/usr/bin/env python3
"""OpenAI GPT Image 호출: 참고 그림 + 프롬프트 → PNG 저장. (gen.py의 OpenAI판)
사용: gen_openai.py <out_prefix> <n> <ref1> [ref2 ...] < prompt.txt
환경 변수: OAI_MODEL(기본 gpt-image-2.5-sunburst), OAI_SIZE(기본 1536x1024), OAI_BG(기본 transparent), OAI_QUALITY(기본 high)
키는 클라우드 환경의 네트워크 시크릿(api.openai.com, Bearer)이 붙여 주므로 스크립트에는 없음.
참고 그림이 없으면 /v1/images/generations, 있으면 /v1/images/edits."""
import base64, json, os, sys, time, uuid, urllib.request, urllib.error

out_prefix, n = sys.argv[1], int(sys.argv[2])
refs = sys.argv[3:]
prompt = sys.stdin.read().strip()
model = os.environ.get("OAI_MODEL", "gpt-image-2.5-sunburst")
fields = {"model": model, "prompt": prompt, "n": str(n), "size": os.environ.get("OAI_SIZE", "1536x1024"),
          "background": os.environ.get("OAI_BG", "transparent"), "quality": os.environ.get("OAI_QUALITY", "high"),
          "output_format": "png"}

if refs:
    url = "https://api.openai.com/v1/images/edits"
    b = uuid.uuid4().hex; body = b""
    for k, v in fields.items():
        body += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    for r in refs:
        raw = open(r, "rb").read(); mime = "image/jpeg" if raw[:3] == b"\xff\xd8\xff" else "image/png"
        body += (f"--{b}\r\nContent-Disposition: form-data; name=\"image[]\"; filename=\"{os.path.basename(r)}\"\r\n"
                 f"Content-Type: {mime}\r\n\r\n").encode() + raw + b"\r\n"
    body += f"--{b}--\r\n".encode()
    headers = {"Content-Type": f"multipart/form-data; boundary={b}"}
else:
    url = "https://api.openai.com/v1/images/generations"
    f = dict(fields); f["n"] = n
    body = json.dumps(f).encode(); headers = {"Content-Type": "application/json"}

t = time.time()
try:
    with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers), timeout=600) as resp:
        res = json.load(resp)
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code} {e.read()[:500]!r}"); sys.exit(1)
for i, d in enumerate(res.get("data", [])):
    fn = f"{out_prefix}_{i}.png"
    open(fn, "wb").write(base64.b64decode(d["b64_json"]))
    print(f"saved {fn}")
print(f"{time.time()-t:.0f}s, usage={json.dumps(res.get('usage', {}))}")
