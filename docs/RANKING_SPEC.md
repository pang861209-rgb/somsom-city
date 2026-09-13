# 비동기 랭킹 공용 규격 v1

작성 2026-09-13 · 적용 대상: 모든 솜솜시티 게임 (방범대 포함)

## 문제

지금 랭킹은 **점수형 게임에만 맞습니다.**

| 게임 | 보상 구조 | 지금 랭킹과의 궁합 |
|---|---|---|
| 낙엽피하기 | 점수가 전부 | 잘 맞음 |
| 달리기 | 거리가 전부 | 잘 맞음 |
| 짝맞추기 | 클리어 + 실수 횟수 | 반반 |
| 방범대 | 스테이지 클리어 · 별점 · 주민 강화 | **안 맞음** |

방범대는 점수를 올릴 이유가 없습니다. 스테이지를 깨면 그 자리에서 끝나니까요. 그래서 제출 기록이 거의 없었고, 그걸 "안 하는 게임"으로 잘못 읽었습니다.

**재미가 없어서가 아니라 올릴 이유가 없어서였습니다.**

## 원칙

1. **랭킹 등록을 강제하지 않습니다.** 판은 그 자리에서 완결돼야 합니다.
2. **같이 플레이하지 않아도 서로 얼마나 했는지 보입니다.** 가족이 같은 시간에 접속할 일은 없습니다.
3. **비교 대상은 게임의 성격에 맞춥니다.** 점수형은 점수로, 스테이지형은 진도와 별점으로.
4. **묻지 않고 올립니다.** 판이 끝나면 조용히 기록됩니다. 이름 입력창이 뜨지 않습니다.

## 4번이 핵심입니다

지금은 점수를 올리려면 뭔가를 눌러야 합니다. 그 한 번의 마찰이 방범대에서 기록을 0에 가깝게 만들었습니다.

이름은 이미 `somsom_name`에 있습니다. 판이 끝나면 결과 화면을 그리면서 **뒤에서 조용히 올리면 됩니다.** 실패해도 아무 일 없습니다 (`catch` 후 무시).

## 기록 형태

게임마다 "잘했다"의 정의가 다르므로, 두 갈래로 나눕니다.

### A. 점수형 — 기존 그대로

낙엽피하기 · 달리기 · 신작 원정대

```
{ n: '닉네임', s: 점수(정수), t: 타임스탬프 }
```

컬렉션: `scores`, `runner_scores`, `memory_scores`, `defense_scores`, `merge_scores`

### B. 진도형 — 새로 추가

방범대 · 짝맞추기

```
{ n: '닉네임',
  p: 진도(정수),        // 방범대: 클리어한 스테이지 수, 짝맞추기: 최고 난이도
  st: 별 합계(정수),     // 방범대: 전 스테이지 별 합계 (최대 24)
  b: 최고기록(정수),     // 방범대: 무한 모드 최고 웨이브
  t: 타임스탬프 }
```

컬렉션: `defense_progress`, `match_progress`

**진도형은 판마다 올리지 않고 갱신합니다.** 문서 ID를 닉네임으로 고정하면 한 사람당 한 줄만 남습니다. 방범대는 판이 짧지 않으니 매판 새 문서를 만들 이유가 없습니다.

## 허브에서 어떻게 보이나

주간 랭킹 패널(🏆)을 두 칸으로 나눕니다.

```
┌─ 이번 주 점수 ──────────────┐   기존 방식 그대로
│ 🥇 리우      320            │   최근 7일 · 게임별 최고를 100점 환산해 합산
│ 🥈 부장애비   290            │
└────────────────────────────┘

┌─ 골목 진도 ────────────────┐   새로 추가. 기간 제한 없음
│ 방범대                      │
│  부장애비  ★18/24  무한 21웨이브 │
│  리우      ★12/24  무한 14웨이브 │
│  가람      ★6/24              │
└────────────────────────────┘
```

진도는 주간이 아니라 **누적**입니다. 한 주 쉬어도 사라지지 않습니다. 이게 스테이지형 게임에 맞는 비교 방식입니다.

## 방범대에 적용하는 방법

방범대는 `somsom-city-game` 저장소에 있어 이 세션에서 수정할 수 없습니다. 아래는 넘겨받아 적용할 명세입니다.

### 1. 기록 올리기

결과 화면(`RESULT`)을 그릴 때, 아래를 **버튼 없이** 호출합니다.

```js
// 진도형 기록 갱신. 실패해도 게임 흐름에 영향 없음.
async function pushProgress(){
  try{
    const nm = localStorage.getItem('somsom_name');
    if(!nm) return;                        // 이름이 없으면 조용히 건너뜀
    const S = JSON.parse(localStorage.getItem('somsom_defense_v1')||'{}');
    const stars = Object.values(S.stars||{}).reduce((a,b)=>a+b,0);
    const cleared = Object.keys(S.stars||{}).length;
    const body = { fields:{
      n:{stringValue:nm},
      p:{integerValue:String(cleared)},
      st:{integerValue:String(stars)},
      b:{integerValue:String(S.endlessBest||0)},
      t:{integerValue:String(Date.now())} } };
    // 문서 ID = 닉네임 → 한 사람당 한 줄만 남고 갱신됨
    await fetch(FB_DOCS+'/defense_progress/'+encodeURIComponent(nm)+'?key='+FB_KEY,
      {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  }catch(e){}                              // 조용히 실패
}
```

`PATCH`를 쓰는 이유는 문서를 덮어쓰기 위해서입니다. `POST`는 매번 새 문서를 만듭니다.

### 2. 기존 `defense_scores`는 어떻게 하나

**무한 모드 전용으로 남깁니다.** 무한 모드는 점수형이 맞습니다. 스테이지 모드만 `defense_progress`로 옮깁니다.

### 3. 허브 쪽

`index.html`의 `renderWeekly()` 아래에 `renderProgress()`를 추가하고, 🏆 패널을 두 칸으로 나눕니다. 신작 작업과 함께 진행합니다.

## 신작에 적용하는 방법

신작 「솜솜 합체」는 점수형과 진도형을 **둘 다** 씁니다.

- 점수형 (`merge_scores`) — 한 판의 점수 `{ n, s, d, t }`. `d`는 그 판의 "오늘의 통" 날짜(YYYYMMDD 정수)라 같은 날끼리 비교할 수 있습니다. 주간 랭킹에 들어감.
- 진도형 (`merge_progress`) — `{ n, st:최고 도달 단계, b:최고 점수, t }`. 문서 ID는 닉네임.

> 2026-09-13 기준. 「골목 원정대」(`expedition_*`)는 M0 게이트에서 탈락해 허브에서 내렸습니다. 아래 규칙에서도 `merge_*`로 바뀌었습니다.

둘 다 판이 끝날 때 조용히 올라갑니다. 어느 쪽도 플레이어가 누를 버튼이 없습니다.

## 먼저 해야 할 일 — Firestore 규칙 추가 (막혀 있습니다)

**신작의 랭킹은 규칙을 고치기 전까지 동작하지 않습니다.** 2026-09-13 실측 결과입니다.

| 컬렉션 | 클라이언트 읽기 |
|---|---|
| `scores` | 허용 |
| `runner_scores` | 허용 |
| `memory_scores` | 허용 |
| `defense_scores` | 허용 |
| `defense_events` | **403 차단** |
| `merge_scores` | **403 차단** |
| `merge_progress` | **403 차단** |

규칙이 **컬렉션 이름을 하나씩 허용하는 방식**으로 짜여 있습니다. 목록에 없는 이름은 읽기도 쓰기도 막힙니다. 그래서 새 컬렉션 네 개(`merge_scores`, `merge_progress`, `defense_progress`, `match_progress`)를 규칙에 추가해야 합니다.

게임 코드는 실패를 조용히 삼키도록(`catch` 후 무시) 되어 있으므로, 규칙을 고치기 전에도 플레이에는 지장이 없습니다. 랭킹만 안 올라갑니다.

### 권장 규칙

> 2026-09-13 갱신: 실제 콘솔의 규칙은 컬렉션마다 `match` 블록을 하나씩 두는 모양이었습니다(아래 `col in [...]` 초안과 다름). **실제로 붙여 넣을 완성본은 `docs/firestore.rules`** 이고, 기존 여섯 블록은 그대로 두고 `merge_scores`·`merge_progress` 블록 둘만 뒤에 붙인 것입니다. 아래 초안은 참고용으로 남깁니다.


[Firebase 콘솔](https://console.firebase.google.com/project/somsom-city/firestore/rules) → 규칙 탭에 붙여넣습니다.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 점수형 — 새 기록 추가만 허용. 기존 기록은 못 고치고 못 지웁니다.
    match /{col}/{doc} {
      allow read: if col in ['scores','runner_scores','memory_scores',
                             'defense_scores','merge_scores'];
      allow create: if col in ['scores','runner_scores','memory_scores',
                               'defense_scores','merge_scores']
                    && request.resource.data.keys().hasOnly(['n','s','t','c','w','d'])
                    && request.resource.data.n is string
                    && request.resource.data.n.size() <= 12;
      allow update, delete: if false;
    }

    // 진도형 — 닉네임이 문서 ID. 갱신이 필요하므로 create 와 update 를 엽니다.
    match /{col}/{nick} {
      allow read: if col in ['merge_progress','defense_progress','match_progress'];
      allow create, update: if col in ['merge_progress','defense_progress','match_progress']
                    && request.resource.data.n == nick
                    && request.resource.data.n.size() <= 12;
      allow delete: if false;
    }
  }
}
```

`allow delete: if false` 가 핵심입니다. 브라우저에서는 아무도 기록을 지울 수 없고, 콘솔에서만 정리할 수 있습니다.

## 앞서 쓴 보안 경고를 정정합니다

이 문서 초판과 대화에서 "아무나 랭킹을 지울 수 있는 상태"라고 했는데, **확인되지 않은 추측이었습니다.**

2026-09-13에 지운 293건은 Firebase 콘솔에서 소유자 권한으로 지운 것입니다. 콘솔은 보안 규칙을 우회하므로, 그 성공이 "웹 키로도 지워진다"는 증거가 되지 못합니다. 실제로 규칙은 생각보다 좁게 잠겨 있었습니다(위 표 참조).

다만 허용된 네 컬렉션에 **점수를 넣는 것**은 여전히 누구나 할 수 있습니다. 키가 `index.html`에 그대로 있기 때문입니다. 위 규칙은 그것까지는 막지 않고(막으려면 인증이 필요합니다), 최소한 **기존 기록을 고치거나 지우는 것**만 차단합니다. 가족끼리 쓰는 수준에서는 이 정도면 충분합니다.
