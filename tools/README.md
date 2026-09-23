# 삽화 생성·보정 도구

## 파일
- `gen.py` — Gemini 이미지 생성 호출. `gen.py <출력경로> <장수> <참조1> [참조2 ...] < 프롬프트.txt`
- `fix.py` — 기존 삽화 보정. 두 모드
  - `edit` : 기존 컷 1장만 참조로 넣고 국소 결함만 고침
  - `regen` : 축소한 캐릭터 보드 + 라인업 + 배경으로 새로 그림
- `shots_example.py` — 시즌 단위 일괄 생성 스크립트 예시(여름)

## 토큰 절약 규칙
Gemini는 참조 이미지를 **768×768 타일 단위**로 과금합니다(타일당 258토큰). 그래서

1. **참조 이미지는 긴 변 768 이하로 줄여서 넣습니다.** 1400×1045 보드는 4타일(1,032토큰)이지만 768×573으로 줄이면 1타일(258토큰)입니다. 캐릭터 인식률은 떨어지지 않습니다.
2. **국소 결함은 `edit` 모드로 고칩니다.** 참조가 원본 1장뿐이라 입력이 4,504 → 약 900토큰으로 줄고, 구도·배경이 그대로 보존됩니다.
3. **멀티샷 그리드(2×2)는 쓰지 않습니다.** 출력 과금은 줄지만 셀당 해상도가 절반이 되어 배경 디테일이 뭉갭니다.

측정값: 호출당 입력 4,504토큰 중 참조 이미지가 3,818토큰(85%). 위 1+2를 적용하면 전체 약 64% 절감됩니다.

## 캐릭터 규칙에서 자주 틀리는 것
- **미개 크기** — 라인업 수치로는 끼토의 41%, 즉 무릎 바로 아래입니다. "발목 높이"라고 쓰면 그림과 글이 충돌해 결과가 들쭉날쭉해집니다.
- **람다·할머니** — 종 특징(다람쥐의 붓 꼬리, 친칠라의 둥근 귀와 짧은 주둥이)을 안 쓰면 고양이 얼굴로 그려집니다.
- **북거씨** — 목 길이를 명시하지 않으면 기린처럼 늘어나고, 거북이 두 마리로 그려지는 일도 있습니다.
- **끼토 귀** — "straight UP"을 안 쓰면 아래로 늘어져 다른 동물처럼 보입니다.
- **안경** — 북거씨(사각 검정)와 할머니(둥근 금테, 머리 위)만 씁니다.
- **끼토 체형** — "slender adult"을 안 쓰면 볼터치가 있는 통통한 아기 토끼로 그려집니다. 귀도 같이 짧아집니다. 귀 길이와 체형은 한 덩어리로 무너지니 프롬프트에 둘 다 씁니다.
- **볼터치** — 캐논에 없습니다. 안 막으면 거의 매번 들어갑니다. "no blush or rosy cheek circles of any kind"로 명시합니다.

## 저장 규칙
결말 컷 PNG는 색을 160색으로 줄여 저장합니다(`Image.quantize(colors=160)` + `optimize=True`). 평면 채색이라 눈에 띄는 손실 없이 1.2MB → 400KB가 되고, 기존 결말 컷들과 용량대가 맞습니다.


## 소품·아이콘 멀티샷 레시피 (2026-09-13 검증)

캐릭터가 아닌 사물(장애물, 아이템, 아이콘)을 뽑을 때 쓴 방식입니다. 골목 원정대 에셋 5장이 이 레시피로 나왔습니다.

```
Draw ONE object on a plain pure-white background, centered, filling most of the square.

STYLE: thin uniform dark outlines of even weight, flat matte colors, NO shading,
NO gradients, NO drop shadow, muted pastel palette (warm cream, dusty orange,
sage green, soft blue-grey). Simple and readable — the shape must still be
recognizable when shrunk to 48 pixels. No text, no watermark, no background
scenery, no characters.

OBJECT: <사물 묘사>
```

- 모델 `gemini-3.1-flash-image`, `NB_AR=1:1`, 에셋당 **6샷**
- 참조로 캐릭터 보드 1장(768px)을 넣습니다. 사물이라도 선 굵기와 팔레트를 맞춰 줍니다
- 후처리: 네 모서리에서 플러드필로 흰 배경 키잉(tol 26) → `getbbox()` 트림 → 긴 변 128px 리사이즈

### 걸린 것

**바닥에 놓이는 사물은 배경을 그려 버립니다.** 물웅덩이 6샷 중 5샷에 돌바닥·모자이크 타일이 들어가 키잉이 불가능했습니다. "plain pure-white background"만으로는 부족합니다. 다음부터는 아래를 덧붙입니다.

```
The object floats on empty white. Do NOT draw any ground, floor, pavement,
surface, or shadow beneath it.
```

### 색만 다른 변형은 새로 뽑지 않습니다

일반 도토리는 황금 도토리에서 색조만 돌려 만들었습니다(HLS에서 hue -0.055, 명도 0.80배, 채도 0.72배, 무채색 픽셀은 보존). 같은 샷에서 나온 그림이라 선과 형태가 정확히 같고 샷 6개를 아꼈습니다. 등급 변형, 계절 변형에 쓸 수 있습니다.
