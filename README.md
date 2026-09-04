# G-Over World — 재현 가이드

구식 CGI 게시판 게임 양식(judomst.net 계열)의 **MS 파일럿 육성 시뮬레이션**.
FF ADVENTURE 계열 **2d6 대항판정**으로 전투를 굴리고, 기체 제원·무장·이미지는
**GGen Eternal Database** 공개 API에서 가져온 실제 데이터를 쓴다.

수록 기체 **1244기 전부**. 결과물은 `docs/` 폴더 하나(약 143MB)이고,
그대로 **GitHub Pages 에 올리거나** 로컬에서 `index.html` 을 열어 실행한다.
외부 의존은 Google Fonts 스타일시트뿐이며, 실패해도 시스템 폰트로 대체된다.

---

## 목차

1. [5분 재현](#1-5분-재현)
2. [요구 사항](#2-요구-사항)
3. [디렉터리 구조](#3-디렉터리-구조)
4. [데이터 파이프라인](#4-데이터-파이프라인)
4-5. [한글화](#45-한글화)
5. [빌드](#5-빌드)
6. [실행 · GitHub Pages 배포](#6-실행과-검증)
7. [게임 설계 명세](#7-게임-설계-명세)
8. [전투 규칙 전문](#8-전투-규칙-전문)
9. [밸런스 — 상수와 근거](#9-밸런스--상수와-근거)
10. [밸런스 검증 시뮬레이터](#10-밸런스-검증-시뮬레이터)
11. [함정 모음](#11-함정-모음)
12. [스타일 가이드](#12-스타일-가이드)
13. [커스터마이즈 레시피](#13-커스터마이즈-레시피)
14. [출처와 권리](#14-출처와-권리)

---

## 1. 5분 재현

빈 디렉터리에 `build.mjs`, `serve.mjs`, 그리고 `src/` 의 다섯 파일
(`head.html` `engine.js` `ui.js` `i18n.mjs` `fetch-roster.mjs`)을 놓은 뒤:

```bash
node src/fetch-roster.mjs
```

```bash
node build.mjs
```

```bash
node serve.mjs
```

`http://localhost:8788/` 로 접속하면 끝. 수집은 1244기 기준 **약 5분**
(상세 1244건 + 이미지 2488장 / 142MB)이고, 빌드는 즉시 끝난다.

빠르게 확인만 하려면 등급별 3기씩만 받는다:

```bash
node src/fetch-roster.mjs --limit=3 && node build.mjs
```

> **로스터 수집은 결정적(deterministic)이다.** 선정 로직에 난수를 쓰지 않으므로
> 같은 API 상태에서 두 번 돌리면 `src/roster.json` 이 바이트 단위로 동일하게 나온다.

---

## 2. 요구 사항

| 항목 | 버전 / 비고 |
|---|---|
| Node.js | **18 이상** (전역 `fetch` 필요). 검증 환경은 v20.15.0 |
| 인터넷 | 최초 로스터 수집 때만. 이후 빌드·실행은 오프라인 가능 |
| 브라우저 | 최신 Chrome / Edge / Firefox. `localStorage` 사용 |
| 디스크 | 약 150MB (초상화 133MB + 썸네일 9.3MB + 나머지) |
| sharp | **선택.** `--resize` 로 초상화를 줄일 때만 필요 (`npm i -D sharp`) |

**필수 패키지 의존성은 없다.** 원본 해상도를 그대로 쓰면 `npm install` 자체가 불필요하다.

---

## 3. 디렉터리 구조

```
.
├── build.mjs              조각들을 docs/index.html 로 합침
├── serve.mjs              docs/ 를 정적 서버로 띄움 (Pages 와 같은 조건)
├── package.json           npm run fetch / build / serve
├── README.md              이 문서
├── docs/                  ← 배포 대상. 통째로 GitHub Pages 에 올린다
│   ├── index.html         0.86MB — 코드 + 1244기 데이터 인라인
│   ├── img/               초상화 936x803 · 1244장 · 133MB
│   ├── th/                썸네일 128x128 · 1244장 · 9.3MB
│   └── .nojekyll          Jekyll 처리 비활성화
└── src/
    ├── fetch-roster.mjs   GGen DB API → roster.json + docs/img · docs/th
    ├── i18n.mjs           빌드 시점 한글화 사전 (무장·특성·시리즈)
    ├── roster.json        기체 1244기 데이터 (0.92MB, 이미지는 경로만)
    ├── head.html          <title>·CSS·마크업 골격 + <script> 여는 태그
    ├── engine.js          상수 / 세이브 / 파생수치 / 전투 엔진
    └── ui.js              렌더링 / 화면 9종 / 이벤트 바인딩 / 부팅
```

### 왜 조각으로 나눠 두는가

`roster.json` 이 0.92MB라 통짜 HTML을 직접 편집하면 에디터가 느려지고, 게임 로직
한 줄 고칠 때마다 거대한 데이터 블록을 스크롤해야 한다. 데이터와 코드를 분리해
두면 로직만 편집하고 `node build.mjs` 로 합친다.

### 결합 순서 (build.mjs)

```
head.html                    ← <!DOCTYPE> ~ <script> "use strict";
  + "const UNITS = " + roster.json + ";"
  + engine.js
  + ui.js
  + "</script></body></html>"
```

`ui.js` 맨 끝의 `renderAll()` 이 부팅을 담당하므로 **engine → ui 순서를 지켜야 한다.**

이미지는 HTML 에 들어가지 않는다. `docs/img/` · `docs/th/` 에 개별 파일로 있고
HTML 에는 `img/1001000150.webp` 같은 **상대경로만** 들어간다.

---

## 4. 데이터 파이프라인

### 4.1 API 개요

베이스: `https://ggendb.up.railway.app`
인증 없음. JSON. 언어는 `lang=` 로 지정하며 **EN / TW / HK / JP** 만 지원한다
(한국어 없음 → 기체명은 영문, UI만 한글).

#### 목록 — `GET /api/units`

```
/api/units?lang=EN&page=1&per_page=100&grid_skills=1
```

| 파라미터 | 설명 |
|---|---|
| `page` | 1부터 |
| `per_page` | **서버가 100으로 자른다.** 200을 넣어도 100만 온다 |
| `sort` / `dir` | `rarity` 등, 선택 |
| `q` | 이름 검색, 선택 |

응답은 래퍼 객체이고 실제 유닛 배열은 **`rows`** 에 들어 있다.
`total`(1244), `total_pages` 를 보고 순회할 것.

`rows[]` 항목:

| 필드 | 예 | 설명 |
|---|---|---|
| `id` | `"1001000150"` | 상세 조회 키 |
| `name` | `"Gundam (EX)"` | 표시명 |
| `rarity` | `N` `R` `SR` `SSR` `UR` | 등급 |
| `role` | `Attack` `Defense` `Support` | 역할 |
| `HP` `ATK` `DEF` `MOB` `EN` `MOV` | 151599 / 10886 / 10040 / 8978 / 399 / 5 | 제원 |
| `thum` | `https://…github.io/…/thum_g0010u00150.webp` | 썸네일 URL (44px용, 미사용) |
| `grid_abilities[]` | `{name, detail, icon}` | 특성 요약 |

#### 상세 — `GET /api/unit/<id>`

```
/api/unit/1001000150?lang=EN
```

목록에 없는 것들이 여기 있다:

| 필드 | 설명 |
|---|---|
| `model` | `"RX-78-2"` 형식번호 |
| `series[]` | `{id, name, icon}` — `[0].name` 이 작품명 |
| `portrait` | **기체 초상화 URL.** 이 프로젝트가 쓰는 이미지 |
| `is_large` | 대형기 여부 |
| `abilities[]` | `{display_name, details:[{text}], icon}` |
| **`weapons[]`** | 아래 참조 |

`weapons[]` 항목:

| 필드 | 설명 |
|---|---|
| `name` | 무장명 |
| **`levels[]`** | `{level, power, en, ammo, accuracy, critical}` — **레벨별 위력표.** 무장 강화 시스템의 근거 |
| `power` `accuracy` `critical` | 대표값 |
| `en_cost` `ammo` | 소모 자원 |
| `min_range` `max_range` | 사거리 |
| `attribute` | `"Beam"` `"Physical"` 등 |
| `attack_types[]` | `{key:"melee"\|"shooting", label}` |
| `is_map` `is_ssp_weapon` `is_preemptive` | 분류 플래그 |

> 다른 URL 형태(`/api/units/<id>`, `/api/unit_detail?id=`)는 **404**다.
> 단수형 `/api/unit/<id>` 만 동작한다.

이미지는 별도 호스트(GitHub Pages)에 있다:
`https://zh7tcm9fmv-cloud.github.io/ggen_db_images/…`

**규격은 딱 두 가지뿐이고 중간 크기는 없다.**

| 경로 | 크기 | 용량 |
|---|---|---|
| `images/Trait/thum/thum_<code>.webp` | 작은 아이콘 | 약 8.8KB |
| `images/unit_portraits/ub_<code>.webp` | 936×803 초상화 | 약 140~226KB |

썸네일 URL에서 초상화 URL로 가는 규칙은 경로 중간만 바꾸면 된다:
`/Trait/thum/thum_` → `/unit_portraits/ub_`.
상세 응답의 `portrait` 필드에 완성된 URL이 이미 들어 있으므로 그쪽을 먼저 쓰고,
없을 때만 문자열 치환으로 만든다.

### 4.2 로스터 선정

기본은 **전 기체(1244기)** 다. 데이터만 보면 기당 740B 라 전부 담아도 0.92MB 밖에 안 된다.

```
UR 114 · SSR 350 · SR 365 · R 313 · N 102  =  1244기
```

`--limit=<n>` 을 주면 등급별로 `n` 기씩만 균등 간격으로 뽑는다. 개발 중 빠른
확인용이며, 앞에서부터 순서대로가 아니라 목록 전체를 훑는 간격 샘플이라
시리즈가 한쪽에 쏠리지 않는다.

---

### 4.3 저장 스키마

용량을 아끼려고 필드명을 짧게 줄인다. `roster.json` 은 이 객체의 배열이다.

```js
{
  id, nm,        // id, 이름 ('[SD] ' 접두어 포함)
  mdl, sr,       // 형식번호(model), 시리즈명(series[0].name)
  rar, role,     // 등급(내부 전용 — 화면에는 안 나온다), 역할
  hp, atk, def, en, mob, mov,
  lg,            // is_large
  w: [{          // 무장 (최종 레벨 위력 내림차순, 최대 6종)
    n,           // 이름
    pw: [ ... ], // 레벨별 위력 배열. pw[0]=Lv1, pw[len-1]=최대
    ac, cr,      // accuracy, critical
    en, am,      // EN 소모, 탄수 (0이면 무제한)
    mn, mx,      // 최소/최대 사거리 (표시용)
    at,          // 속성 "빔" / "실탄" / "특수" (한글화됨)
    tp,          // "M"=격투 / "S"=사격
    pre          // 선제 공격 플래그
  }],
  ab: [{ n, d }],// 특성 이름 + 설명(원문 160자까지 읽어 한글화)
  img,           // 'img/<id>.webp'  초상화 936x803 — 전투·도시에·도감 상세용
  th             // 'th/<id>.webp'   썸네일 128x128 — 목록·그리드용
}
```

**맵 병기(`is_map`)와 SSP 전용 병기(`is_ssp_weapon`)는 제외한다.** 이 게임에는
맵과 사거리 개념이 없어서 그대로 넣으면 밸런스만 망가진다.

### 4.4 이미지는 왜 분리하는가

한때 base64 로 HTML 에 내장했었다. 단일 파일이라는 장점이 있었지만 대가가 컸다.

| | 내장(base64) | 분리(파일) |
|---|---|---|
| 용량 | ×1.34 팽창 | 원본 그대로 |
| 지연 로딩 | 불가 — 전부 파싱 | `loading="lazy"` 로 보이는 것만 |
| 캐시 | HTML 통째로 | 파일 단위 |
| 상한 | Artifact 16MB | 없음 |

1244기를 내장하면 초상화 기준 **약 29MB** 라 아티팩트 상한을 넘고, 도감을 열
때마다 브라우저가 그 전부를 파싱해야 한다. 분리하면 첫 로딩은 `index.html`
0.86MB 뿐이고 이미지는 화면에 들어온 것만 내려간다.

#### 두 규격을 모두 받는 이유

호스트가 주는 규격은 딱 둘이다.

| 경로 | 크기 | 용량 |
|---|---|---|
| `images/Trait/thum/thum_<code>.webp` | 128×128 | 약 8.8KB |
| `images/unit_portraits/ub_<code>.webp` | 936×803 | 약 109KB |

도감 그리드는 44px 칸이다. 여기에 109KB 초상화를 쓰면 스크롤할 때마다 낭비가
크므로 **목록에는 썸네일, 상세·전투에는 초상화**를 쓴다. 경계는 썸네일 해상도가
버티는 지점(128px)에서 갈랐다.

```js
// src/ui.js
const picFor = (B, cls) => (cls === 'l' || cls === 'xl') ? B.img : (B.th || B.img);
// .s 44px · .m 72px  → 썸네일
// .l 104px · .xl 132px → 초상화
```

합계 142MB. `--resize=<px>` 를 주면 초상화를 줄일 수 있다(sharp 필요).

| 초상화 폭 | 기당 | 1244기 합계 |
|---|---|---|
| **원본 936px** | **109KB** | **133MB** |
| 512 | 약 45KB | 약 56MB |
| 288 | 약 24KB | 약 30MB |

---

### 4.5 한글화

API는 **EN / TW / HK / JP** 만 준다. 한국어가 없으므로 무장·특성·시리즈는
`src/i18n.mjs` 가 **빌드 시점에** 옮긴다. `roster.json` 에는 이미 한글이 들어가므로
런타임 비용은 0이다.

대상 규모(1244기 기준): 고유 무장 **1226종**, 특성명 **252종**, 특성 설명 **173종**, 시리즈 **103종**.

3단 구조로 처리한다.

1. **완전 일치 표** (`WEP_EXACT`) — 낱말로 쪼개면 망가지는 것. `Kick` → 킥,
   `Sekiha Tenkyoken` → 석파천귀권.
2. **구 치환** (`WEP_PHRASE`, `AB_PHRASE`) — `Beam Rifle` → 빔 라이플.
   **반드시 긴 키부터** 적용한다(`byLenDesc`). 짧은 키가 먼저 걸리면
   `Increased ATK & MOB` 이 `공격력 증가 & MOB` 처럼 반쪽만 번역된다.
3. **낱말 치환** (`WEP_TOKEN`) — 남은 단어. 구분자는 공백·괄호·슬래시만 쓴다.
   **하이픈으로 쪼개면 안 된다** — `Air-to-Air` 가 `공-to-공` 이 되어버린다.

특성 설명은 문형이 정해져 있어 정규식으로 옮긴다.

```
When HP is 75% or above, increase ATK by 20%.
  → HP 75% 이상일 때 공격력 20% 증가.
When enemies attack with a beam ranged weapon, reduce damage taken by 50%.
  → 적이 빔 사격 병장으로 공격할 때 받는 피해 50% 감소.
```

**형식번호·고유명은 일부러 영문으로 남긴다.** `MA-M01 Lacerta`, `RFW-99`,
`"Forfanterie"`, `Okitsu-no-Kagami` 같은 것을 억지로 음차하면 오히려 읽기 나쁘다.

최종 커버리지 — 시리즈 **103/103**, 특성명 **220/252**, 무장 **844/1226**.
무장 잔여 382건은 대부분 형식번호와 일본어 필살기명이다.

> **재번역은 이미지를 다시 받지 않는다.** 사전을 고친 뒤 `--skip-images` 를 주면
> 상세 API 만 다시 돌아 1분이면 끝난다. 133MB 를 다시 받을 이유가 없다.
>
> ```bash
> node src/fetch-roster.mjs --from-cache --skip-images && node build.mjs
> ```

#### 사전 커버리지 확인

사전을 고친 뒤에는 무엇이 안 걸렸는지 확인할 것. 프로젝트 루트에서:

```bash
node --input-type=module -e "import fs from 'node:fs';import{trWeapon,trAbilityName,trAbilityDetail}from'./src/i18n.mjs';const R=JSON.parse(fs.readFileSync('src/roster.json','utf8'));const w=new Set(),a=new Set();R.forEach(u=>{u.w.forEach(x=>/[A-Za-z]{3,}/.test(x.n)&&w.add(x.n));(u.ab||[]).forEach(x=>/[A-Za-z]{3,}/.test(x.n)&&a.add(x.n))});console.log('무장 잔여',w.size);console.log([...w].join('
'));console.log('특성 잔여',a.size)"
```

한글 뒤에 영문이 붙어 있으면(`핀 판넬s`) 구 치환이 반쪽만 걸린 것이다.
`trWeapon` 끝의 `([가-힣])s → $1` 안전망이 복수형은 걷어내지만,
원인이 되는 구를 사전에 추가하는 편이 낫다.

---

## 5. 빌드

```bash
node build.mjs      # 또는 npm run build
```

`src/head.html` + `roster.json` + `engine.js` + `ui.js` 를 이어 붙여
`docs/index.html` 을 만든다. 경로는 `import.meta.url` 기준이라 **어느 디렉터리에서
실행해도 동작한다.**

문법 검사만 따로 하려면:

```bash
sed -n '/^"use strict";$/,/^</script>$/p' docs/index.html | sed '$d' > _chk.js && node --check _chk.js && rm _chk.js
```

---

## 6. 실행과 검증

### 로컬 실행

```bash
node serve.mjs      # 또는 npm run serve  →  http://localhost:8788/
```

`docs/index.html` 을 브라우저로 직접 열어도 동작한다. 이미지가 상대경로라
`file://` 에서도 문제없다. 다만 브라우저 설정에 따라 `localStorage` 가 막혀
세이브가 안 될 수 있으므로(우상단이 계속 `저장 실패`) 그때는 서버를 쓴다.

### GitHub Pages 배포

`docs/` 폴더를 그대로 올리면 된다. 저장소 루트에서:

```bash
git init -b main
git add -A
git commit -m "G-Over World"
git remote add origin https://github.com/<계정>/<저장소>.git
git push -u origin main
```

그다음 저장소 **Settings → Pages** 에서

- **Source**: Deploy from a branch
- **Branch**: `main` / **폴더**: `/docs`

로 지정하면 1~2분 뒤 `https://<계정>.github.io/<저장소>/` 에서 열린다.

| 제약 | 값 | 현재 |
|---|---|---|
| 파일 1개 최대 | 100MB (Git 하드 제한) | 최대 250KB |
| 게시 사이트 최대 | 1GB | 143MB |
| 대역폭 | 월 100GB (소프트) | — |

`docs/.nojekyll` 이 있어야 Jekyll 이 `_` 로 시작하는 경로를 지우지 않는다.
`.gitignore` 는 `node_modules/` 와 중간 캐시를 제외하고 `docs/` 는 **커밋에 포함한다**
(Pages 가 빌드 결과물을 그대로 서빙하므로 산출물이 저장소에 있어야 한다).

### 세이브 초기화

브라우저 콘솔에서:

```js
localStorage.removeItem('gover.world.v3'); location.reload();
```

화면 우상단 `【기록말소】` 버튼도 같은 일을 한다(확인 창 있음).

---

## 7. 게임 설계 명세

### 7.1 세이브 상태 (`g`)

`localStorage['gover.world.v3']` 에 JSON으로 통째 저장. 이미지·제원은 저장하지
않고 **`id` 만** 들고 있다가 `UMAP[id]` 로 참조한다. 세이브 크기는 수 KB.

```js
{
  name, fac,                    // 파일럿명, 소속 키(fed|duc|mrc)
  lv, exp, cash,
  ap, apMax, day,
  mor0,                         // 전투 개시 기력 (기본 100, 이벤트로 상승)
  st: { sho, mel, rea, def, skl, spi },   // 능력치 각 상한 20
  kills, sorties, wins, losses, downs, fame,
  garage: [{
    id,                         // UNITS 의 id
    hp,                         // 현재 HP (출격 사이 유지)
    mod: { hp, en, def, mob, atk },   // 각 0~10단
    wl: [ 1, 1, ... ]           // 무장별 레벨, 기체의 무장 수만큼
  }],
  cur,                          // garage 인덱스 = 탑승기
  records: [ {day, m, r, kills, pay, exp, hp} ],   // 최근 40건
  flags: { bossDown }
}
```

로드할 때 `UMAP[id]` 로 실재 여부를 검증하고, 없는 기체는 걸러낸다.
**로스터를 바꾸면 기존 세이브의 일부 기체가 사라질 수 있다.**
세이브 구조를 바꿨다면 `SAVEKEY` 의 버전을 올려 옛 세이브가 섞이지 않게 한다
(현재 `gover.world.v3`).

### 7.2 화면 9종 + 다음 날

| 커맨드 | 뷰 함수 | AP | 하는 일 |
|---|---|---|---|
| 상황실 | `viewMain` | – | 일자·자금·경고·임무 일람·최근 전투 |
| 훈련 | `viewTrain` | 1 | 능력치 6종 중 하나를 2d6으로 판정해 상승 |
| 출격 | `viewSortie` | 1~4 | 전법 선택 후 임무 선택 |
| 정비 | `viewRepair` | 1 | HP 완전 회복, 손상량 비례 과금 |
| 개조 | `viewMod` | 0 | 기체 5항목 + 무장 레벨 강화 |
| 개발 | `viewShop` | 0 | 작품별·구입가능 필터로 기체 구입 |
| 격납고 | `viewHangar` | 0 | 탑승기 변경 / 매각 |
| 도감 | `viewBook` | 0 | 110기 작품 필터 + 이름·형식번호 검색 |
| 기록 | `viewLog` | 0 | 통계 + 출격 이력 |
| **다음 날** | `nextDay` | – | 유지비 차감, AP 회복, 랜덤 이벤트 |

`S.view` 문자열로 분기하고 `renderAll()` = `renderLeft()` + `renderMain()` + `renderCmd()`.

### 7.3 파생 수치

```js
uStat(v) = {
  hpMax : B.hp  * (1 + mod.hp  * 0.05),
  enMax : B.en  * (1 + mod.en  * 0.05),
  def   : B.def * (1 + mod.def * 0.05),
  mob   : B.mob * (1 + mod.mob * 0.05) * (1 + faction.mob),   // 공국군만 +6%
  atk   : B.atk * (1 + mod.atk * 0.05)
}
wpowOf(v, i) = UMAP[v.id].w[i].pw[ wl[i] - 1 ]   // 무장 레벨 → 실제 위력표 인덱싱
```

개조 1단 = 기본 제원의 5%, 최대 10단 = **+50%**.

### 7.4 경제

| 항목 | 공식 |
|---|---|
| 기체 정가 | `PRICE = {N:38000, R:96000, SR:215000, SSR:470000, UR:990000}` |
| 실구입가 | `PRICE × (대형기면 1.15)` |
| 매각가 | `구입가 × 0.55` (개조 투자분 환불 없음) |
| 등급 해금 | `LVREQ = {N:1, R:4, SR:9, SSR:15, UR:23}` |
| 개조 비용 | `round(PRICE × 0.045 × 1.34^현재단수 / 100) × 100` |
| 무장 강화 | `round(PRICE × 0.05 × 현재레벨 / 100) × 100` |
| 정비 | `ceil((hpMax − hp) × 0.16 × 소속계수 / 10) × 10` |
| 부대 유지비 | `1500 + 레벨 × 400` (다음 날마다) |
| 초기 자금 | 연방/공국 62,000C · 의용병단 102,000C |

개조 비용이 `1.34^단수` 로 오르므로 10단 완주는 초기 비용의 약 **18배**가 든다.
한 기체에 몰빵할지 새 기체를 살지가 실질적인 선택이 된다.

### 7.5 성장

```js
expNeed(lv) = round(100 × lv^1.45)
```

레벨업 시: 능력치 1종 랜덤 +1(상한 20), 자금 +4,000C, **4레벨마다 AP 상한 +1**
(시작 10 — `AP_BASE` 상수). 임무·훈련 양쪽에서 EXP가 들어온다.

계급은 격추수로만 결정: 훈련병 0 / 소위 3 / 중위 10 / 대위 24 / 소령 45 /
중령 75 / 대령 115 / 준장 170.

### 7.6 훈련 판정

```
목표치 = 6 + floor(현재능력치 / 2)
보정   = floor(기량 / 2)
마진   = 2d6 + 보정 − 목표치

2d6 == 12  → +3  대성공
마진 ≥ 5   → +2
마진 ≥ 0   → +1
그 외      →  0
EXP = 18 + 상승치 × 12
```

능력치가 오를수록 목표치도 오르므로 후반에는 성공률이 자연히 떨어진다.
**기량**은 훈련 효율과 전투 명중·크리티컬에 모두 관여하는 핵심 스탯.

### 7.7 소속

| 키 | 이름 | 효과 |
|---|---|---|
| `fed` | 지구연방군 | 임무 보수 ×1.12, 사격 +1 |
| `duc` | 공국군 | 격투 +1, 운동성 ×1.06 |
| `mrc` | 의용병단 | 정비비 ×0.75, 초기자금 +40,000C |

### 7.8 일일 이벤트

가중 추첨(총 가중치 100). 자금 획득/손실, HP 손상/완전정비, 능력치 +1,
AP 완전회복, 초기 기력 +3(상한 118), 명성 +3, 무변화.

---

## 8. 전투 규칙 전문

전투는 **완전 자동**이다. 플레이어의 개입 지점은 출격 전 **전법 선택** 하나뿐.

### 8.1 라운드 구조

최대 `ROUND_CAP = 20` 라운드. 매 라운드 생존 유닛 전원이 1회씩 행동한다.

**행동 순서(이니셔티브):**

```
MOB + MOV × 260 + (선제 병장 보유 시 900) + d6 × 320
```

내림차순. 매 라운드 다시 굴린다.

**표적 선택:** 플레이어는 HP 비율이 낮은 적을 우선하되 `±0.225` 난수로 흔든다
(마무리 우선이지만 항상 같지는 않게). 적은 선택지가 하나뿐이다.

**화면 표시:** 매 공격마다 `paintDuel()` 이 공격기와 피격기의 초상화를 좌우로 띄우고
가운데에 `교전 → HIT/CRITICAL/MISS + 피해량` 을 찍는다. 그 아래 `paintBoard()` 가
양쪽 전 유닛의 HP 게이지를 갱신하며, 이번에 행동하는 기체에 `.act` 테두리가 붙는다.
셋 다 `S.duel` / `S.board` / `S.blog` 에 보관되므로 전투가 끝나고 결과 화면을
다시 그려도 방금 본 교전 기록이 남는다([11.5](#115-전투-종료-시-로그가-사라진다) 참조).

**병장 선택:** `명중확률 × 예상피해` 가 최대인 것을 자동으로 고른다.
EN 부족·탄약 소진 병장은 후보에서 빠진다.

### 8.2 명중 판정

```
공격측 = 2d6 + 사격|격투 + round((무장명중 − 100) / 8) + 기력보정
              + 전법·역할 보정 + floor(기량 / 4)

방어측 = 2d6 + 반응 + 기력보정 + floor(MOB / 2200)
              + 전법회피 + (대형기면 −1)

우열 = clamp(공격측고정치 − 방어측고정치, −6, +6)
명중 = (2d6 + 우열) ≥ 2d6
```

`clamp(±6)` 이 **핵심**이다. 이게 없으면 고레벨에서 한쪽 명중률이 0.8%까지
떨어져 전투가 성립하지 않는다([함정 §11.2](#112-정예기가-무적이-되는-이유) 참조).
±6은 명중률 **11%~89%** 구간에 해당한다.

### 8.3 크리티컬

```
필요마진 = clamp(10 − floor(기량/2) + floor(상대기량/3) − round(무장크리/5), 3, 12)
마진 ≥ 필요마진 → 크리티컬, 피해 ×1.45
```

### 8.4 피해

```
공격력 = ATK × (1 + 사격|격투 × 0.02) × 기력배율 × (역할 × 전법)
방어력 = DEF × (1 + 방어능력 × 0.018) × (1 + (기력 − 100) × 0.002)

피해 = 무장위력 × (공격력 / 방어력) × DMG_K × 피격측전법
       × (공격자가 적이면 FOE_DMG)
       × (방어측이 대형기면 1.06)

최소 200, 10단위 반올림
```

**방어 능력치 계수(0.018)를 화력 계수(0.02)보다 낮게 둔 것은 의도적이다.**
같게 두면 양쪽이 스탯을 올릴수록 서로 안 죽는 교착이 생긴다.

### 8.5 기력 (모랄)

```
morB(u) = clamp(floor((기력 − 100) / 10), −4, +5)   // 명중/회피 보정
morP(u) = 1 + (기력 − 100) × 0.005                   // 화력 배율 (150 → ×1.25)
```

| 사건 | 변화 |
|---|---|
| 공격 명중 | 공격측 **+1 + floor(정신/8)** |
| 피격 | 피격측 +2 |
| 회피 성공 | 회피측 +1 |
| 격추 달성 | 공격측 +3 |
| 아군 격추당함 | 같은 편 생존자 전원 +5 |

범위 50~150. 파일럿의 **정신** 능력치가 기력 상승 속도에 직접 관여한다.

### 8.6 적 유닛 생성

```js
ps  = 2 + round(플레이어레벨 × 0.7)     // 기준 파일럿 능력
off = ps + (보스 3 / 에이스 2 / 잡졸 0) // 사격·격투
eva = ps + (보스 1 / 에이스 1 / 잡졸 0) // 반응
skl = round(ps × 0.7)
무장레벨 = clamp(1 + floor(레벨/5), 1, 5)

HP  = 기본HP × FOE_HP[등급]            // 잡졸 0.38 / 에이스 0.62 / 보스 0.72
ATK = 기본ATK × 임무난이도(diff)
DEF = 기본DEF                           // 배수 없음
EN  = 기본EN × 3,  탄약 × 3             // 20라운드를 버티도록
기력 = 에이스·보스 110, 잡졸 100
```

**`off` 와 `eva` 를 분리한 것이 이 설계의 핵심 교훈이다.** 하나의 값으로 둘 다
굴리면 강한 적일수록 "절대 안 맞고 절대 안 빗나가는" 무적이 된다.

보상:

```
자금 = PRICE[등급] × 0.035 × (보스 4 / 에이스 2 / 잡졸 1)
EXP  = (10 + 등급인덱스 × 26) × (보스 5 / 에이스 2.5 / 잡졸 1)
```

### 8.7 임무

| ID | 이름 | AP | Lv | 적 편성 | 난이도 | 기본 보수 |
|---|---|---|---|---|---|---|
| `ptrl` | 초계 임무 | 1 | 1 | N·N·R 중 2기 | 0.80 | 9,000C |
| `swp` | 소탕전 | 2 | 3 | R·R·SR 중 3기 | 0.90 | 27,000C |
| `base` | 거점 공략 | 2 | 7 | SR·SR·SSR 중 4기 | 1.00 | 64,000C |
| `itcp` | 에이스 요격 | 3 | 12 | SSR 2기 + UR 에이스 | 1.05 | 155,000C |
| `final` | 결전 · 기함 요격 | 4 | 18 | SSR/UR 3기 + UR 지휘기 | 1.10 | 430,000C |

**적 편성은 매 출격마다 로스터에서 새로 뽑는다.** 같은 임무도 매번 다르다.
`diff` 는 적 ATK에 곱해지는 난이도 계수.

보스는 UR 풀에서 `HP + ATK×4` 상위 5기 중 하나를 무작위로 고른다.

### 8.8 승패와 정산

| 결과 | 조건 | 정산 |
|---|---|---|
| 완수 | 적 전멸 | 격추 보상 + 임무 보수, 명성 +4~10 (기함 첫 격파 시 추가 +30) |
| 대파 | 플레이어 HP 0 | 격추 보상 ×0.4, **보유 자금 −10%**, HP는 1로 생존 |
| 철수 | 20라운드 초과 | 격추 보상 ×0.7 |

최종 자금에 소속 계수(`FACTIONS.pay`)를 곱한다.
남은 HP는 다음 출격까지 유지되므로 **정비 타이밍이 자원 관리의 축**이 된다.

---

## 9. 밸런스 — 상수와 근거

### 9.1 상수표 (`src/engine.js` 상단)

| 상수 | 값 | 역할 |
|---|---|---|
| `ROUND_CAP` | 20 | 라운드 상한. 넘으면 철수 |
| `DMG_K` | 3.0 | 전역 피해 계수. **동급 교전이 3~5히트로 끝나는 지점** |
| `FOE_HP` | 잡졸 0.38 / 에이스 0.62 / 보스 0.72 | 적 HP 배수 |
| `FOE_DMG` | 0.55 | 적→아군 피해 계수 |
| `DEF_STAT_K` | 0.018 | 방어 능력치 1점당 장갑 상승률 |
| `HIT_CLAMP` | 6 | 명중 우열 상한 (명중률 11~89%) |

### 9.2 왜 단일 계수로 전 등급이 커버되는가

`fetch-roster.mjs` 가 마지막에 출력하는 등급별 중앙값:

| 등급 | HP | ATK | DEF | MOB | EN | 최고위력 | 무장수 |
|---|---|---|---|---|---|---|---|
| N | 39,648 | 4,551 | 3,764 | 3,964 | 184 | 3,840 | 2 |
| R | 48,690 | 5,093 | 4,879 | 4,872 | 228 | 4,200 | 2 |
| SR | 58,408 | 6,120 | 5,525 | 5,840 | 257 | 4,440 | 3 |
| SSR | 73,844 | 8,694 | 7,295 | 7,759 | 327 | 5,040 | 3 |
| UR | 100,396 | 13,304 | 9,576 | 10,122 | 418 | 6,600 | 4 |

**HP : ATK 비가 등급 전체에서 거의 일정하다** (N 8.7배, UR 7.5배). ATK/DEF 비도
1.1~1.4 사이에 몰려 있다. 그래서 `무장위력 × (ATK/DEF) × K` 형태의 식 하나로
N부터 UR까지 비슷한 히트 수가 나온다. 계수를 등급별로 나눌 필요가 없다.

**계수를 다시 잡아야 할 때는 이 표를 먼저 뽑아라.** 원 게임이 업데이트되어
비율이 깨지면 그때 식을 손봐야 한다.

### 9.3 목표 승률

임무별 50회 시뮬레이션 결과(레벨·기체 등급을 임무에 맞춰 세팅, 전법 통상):

| 임무 | 무장 Lv1 | 무장 Lv5 |
|---|---|---|
| 초계 임무 | 72% | 84% |
| 소탕전 | 78% | 74% |
| 거점 공략 | 76% | 78% |
| 에이스 요격 | 72% | 80% |
| 결전 · 기함 요격 | **34%** | **56%** |

무장 강화만으로 결전 승률이 34%→56%로 오르는 것이 의도한 성장 체감이다.
최종 임무가 첫 시도에 잘 안 뚫리는 것도 의도다.

### 9.4 전법 균형

거점~요격 구간 120회 기준:

| 전법 | 보정 | 승률 | 평균 잔여 HP |
|---|---|---|---|
| 신중 | 명중 +2 / 화력 −10% / 피해 −18% | 80% | 66% |
| 통상 | 없음 | 73% | 54% |
| 회피 | 회피 +4 / 화력 −18% / 피해 −12% | 63% | 84% |
| 맹공 | 명중 −2 / 화력 +22% / 피해 +28% | 56% | 42% |

지배 전략이 없도록 맞췄다. 회피는 **패배가 거의 없는 대신 무승부가 많고**,
맹공은 빠르지만 대파 위험이 크다.

> 초안에서는 맹공이 승률 87%로 압도적이었다. 화력을 1.28→1.22로 낮추고
> 피격 배수를 1.10→1.28로 올려 위험을 실제 비용으로 만들었다.

---

## 10. 밸런스 검증 시뮬레이터

상수를 만졌다면 반드시 돌려볼 것. **브라우저에서 `mst.html` 을 연 뒤 개발자 도구
콘솔에 통째로 붙여넣는다.** 게임의 실제 함수(`mkPlayer`, `buildFoes`, `hitAdv`,
`calcDmg`)를 그대로 호출하므로 수식 중복이 없다.

```js
/* 타이머·DOM 없이 전투 수식만 돌리는 동기 시뮬레이터 */
window.sim = function (m, lv, rar, seed, wlv, tac) {
  const pool = UNITS.filter(u => u.rar === rar && u.w.length);
  newGame('T', 'fed', { sho:1, mel:1, rea:1, def:1, skl:1, spi:1 }, pool[seed % pool.length].id);
  g.lv = lv;
  g.st = { sho: Math.min(20,3+lv), mel: Math.min(18,2+lv), rea: Math.min(20,3+lv),
           def: Math.min(18,1+lv), skl: Math.min(18,1+lv), spi: Math.min(16,1+lv) };
  cur().wl = cur().wl.map(() => wlv);
  const P = mkPlayer(tac || 'norm'), foes = buildFoes(m);
  let round = 1;
  while (round <= ROUND_CAP && P.hp > 0 && foes.some(f => f.hp > 0)) {
    const order = [P].concat(foes.filter(f => f.hp > 0))
      .map(u => ({ u, i: u.mob + u.mov*260 + (u.weps.some(w=>w.pre)?900:0) + d6()*320 }))
      .sort((a,b) => b.i - a.i).map(o => o.u);
    for (const A of order) {
      if (A.hp <= 0 || P.hp <= 0 || !foes.some(f => f.hp > 0)) continue;
      const live = A.side === 'p' ? foes.filter(f => f.hp > 0) : [P];
      const D = A.side === 'p'
        ? live.slice().sort((x,y) => (x.hp/x.hpMax) - (y.hp/y.hpMax))[0] : P;
      const w = chooseWep(A, D); if (!w) continue;
      if (w.en) A.en -= w.en; if (w.am) w.ammo--;
      const adv = hitAdv(A,D,w), cn = critNeed(A,D,w), mg = (r2().t + adv) - r2().t;
      if (mg < 0) { D.mor = clamp(D.mor+1, 50, 150); continue; }
      D.hp = Math.max(0, D.hp - Math.round(calcDmg(A,D,w) * (mg >= cn ? 1.45 : 1)));
      A.mor = clamp(A.mor + 1 + Math.floor(A.st.spi/8), 50, 150);
      D.mor = clamp(D.mor + 2, 50, 150);
    }
    round++;
  }
  return { r: P.hp <= 0 ? 'lose' : foes.every(f => f.hp <= 0) ? 'win' : 'draw',
           rounds: round - 1, hp: Math.round(P.hp / P.hpMax * 100) };
};

/* 임무별 승률표 */
const TIERS = [[0,1,'N'], [1,5,'R'], [2,9,'SR'], [3,14,'SSR'], [4,20,'UR']];
for (const wlv of [1, 5]) {
  const rows = [];
  for (const [mi, lv, rar] of TIERS) {
    const t = { 임무: MISSION[mi].n, 승:0, 패:0, 무:0, hp:0 };
    for (let i = 0; i < 50; i++) {
      const s = sim(MISSION[mi], lv, rar, i, wlv);
      t[s.r === 'win' ? '승' : s.r === 'lose' ? '패' : '무']++; t.hp += s.hp;
    }
    t.잔여HP = Math.round(t.hp / 50) + '%'; delete t.hp; rows.push(t);
  }
  console.log('무장 Lv' + wlv); console.table(rows);
}
localStorage.removeItem('mst.frontline.v2');
```

**주의: 시뮬레이터가 세이브를 덮어쓴다.** 마지막 줄에서 지우도록 해 뒀지만,
진행 중인 기록이 있으면 먼저 백업할 것.

---

## 11. 함정 모음

실제로 밟은 것들. 다시 만들 때 여기서 시간을 아낄 수 있다.

### 11.1 `per_page` 가 100에서 잘린다

`per_page=5000` 을 넣어도 100건만 온다. `total_pages` 를 보고 순회하지 않으면
1244기 중 100기만 받고 "전체 UR 등급"이라는 엉뚱한 통계를 얻게 된다.

### 11.2 정예기가 무적이 되는 이유

가장 오래 잡아먹은 버그. 적 파일럿 능력치를 **하나의 값 `ps` 로 만들어
사격·격투·반응에 전부 넣었더니**, 레벨이 오를수록 보스가

- 플레이어를 향한 명중률 **100%**
- 플레이어에게 맞을 확률 **5%**

인 상태가 됐다. 강한 적일수록 공격과 회피가 **동시에** 좋아지니 당연한 결과다.
`off`(공격)와 `eva`(회피)를 분리하고, 정예 보너스를 공격 쪽에 몰아주고
회피 쪽은 +1만 주는 것으로 해결했다.

### 11.3 명중 우열에 상한이 없으면 교착한다

`hitAdv` 를 그대로 두면 고레벨에서 우열이 −13까지 벌어져 명중률이 0.8%가 된다.
양쪽 다 안 맞아서 20라운드 내내 아무 일도 안 일어나고 전부 무승부가 된다.
`clamp(±6)` 으로 11~89% 구간에 가둬야 전투가 성립한다.

### 11.4 무장 레벨 1 기준으로 계산할 것

밸런스를 잡을 때 `pw[len-1]`(최대 레벨) 기준으로 계수를 뽑았는데, 플레이어는
**Lv1으로 시작한다.** 실제 초반 화력이 예상보다 20% 낮아 첫 임무가 무승부로
끝났다. 시뮬레이터를 `wlv = 1`과 `5` 양쪽으로 돌리는 이유다.

### 11.5 전투 종료 시 로그가 사라진다

전투가 끝나면 결과 상자를 그리려고 `renderAll()` 을 부르는데, 이때
`viewBattle()` 이 빈 `#blog` 를 새로 만들어 **방금 본 42줄짜리 전투 기록이
통째로 날아간다.** 로그와 상황판을 `S.blog[]` / `S.board` 에 보관해 두고
`viewBattle()` 이 그걸 다시 뿌리도록 고쳤다.

### 11.6 배경 탭에서 `setTimeout` 이 throttle된다

전투 연출은 `sleep()` = `setTimeout` 기반이다. 브라우저가 **비활성 탭의
타이머를 1초 간격으로 늦추므로**, 탭을 뒤로 둔 채 자동 시뮬레이션을 돌리면
수십 배 느려져 타임아웃 난다. §10 시뮬레이터가 DOM·타이머를 전혀 안 쓰는
동기 루프인 이유가 이것이다.

### 11.7 이미지를 HTML 에 내장하면 규모가 막힌다

base64 내장은 단일 파일이라는 장점 대신 **×1.34 팽창 + 지연 로딩 불가 + 용량 상한**을
같이 가져온다. 110기까지는 괜찮았지만 1244기에서는 성립하지 않는다.
파일로 분리하면 세 문제가 한꺼번에 사라진다([4.4절](#44-이미지는-왜-분리하는가)).

거꾸로, **데이터를 별도 JSON 으로 빼서 `fetch` 하는 것은 하지 말 것.**
`file://` 에서 CORS 에 막혀 로컬 실행이 깨진다. 이미지는 `<img src>` 라 상대경로가
그대로 먹지만 `fetch` 는 다르다. 그래서 데이터는 HTML 에 인라인으로 둔다.

### 11.8 등급을 지울 때 남는 것

화면에서 등급(N·SR·UR)을 빼도 **가격·해금 레벨·적 편성 풀**이 등급을 키로 쓰고 있다.
표기만 지우고 `rar` 는 내부 키로 남겨 두는 편이 안전하다. 대신 등급 탭으로
쓰던 개발·도감 화면의 분류 수단이 사라지므로 **작품(시리즈) 필터로 갈아끼워야** 한다.

### 11.9 Artifact CSP 는 외부 리소스를 전부 막는다

아티팩트로 발행하면 **외부 이미지가 호스트 불문하고 차단**되고 `fetch`/XHR 도 막힌다.
조용히 실패해서 빈 칸만 보인다. 즉 "아티팩트는 두고 이미지만 깃허브에서 불러오기"는
불가능하다. 아티팩트를 쓰려면 base64 내장 + 16MB 상한(약 500기)을 받아들여야 하고,
그 이상은 GitHub Pages 같은 일반 정적 호스팅으로 가야 한다.

### 11.10 사전을 고쳤다고 이미지까지 다시 받지 말 것

한글화는 수집 시점에 적용되므로 사전을 고치면 재수집이 필요하다. 하지만 이미지는
바뀌지 않았다. `--skip-images` 를 주면 상세 API 만 다시 돌아 **1분**이면 끝난다.
이걸 모르면 매번 133MB 를 다시 받게 된다.

### 11.11 로스터를 늘리면 사전 커버리지가 무너진다

110기 → 1244기로 늘렸을 때 고유 무장이 223종 → 1226종이 되면서 번역률이
**48%로 떨어졌다.** 시리즈도 43종 → 103종이 됐다. 규모를 바꾼 뒤에는 반드시
커버리지를 다시 재고([4.5절](#45-한글화)) 사전을 보강할 것.

---

## 12. 스타일 가이드

목표는 **2000년대 초 한국 CGI 게시판 게임**의 질감이다. 세련되게 만들면 안 된다.

### 12.1 색 토큰 (`src/head.html` 의 `:root`)

```css
--bg:#000            /* 순검정 배경 */
--panel:#07070b  --panel2:#0d0d14
--row:#101018    --row2:#0a0a10      /* 표 줄무늬 */
--bd:#3a3a4c     --bd2:#22222e       /* 표 테두리 2단계 */
--tx:#c8c8d0     --dim:#7a7a8a       /* 본문 / 흐린 글씨 */
--cy:#3fe0ff     --lime:#5cff5c      /* 형광 시안 / 라임 */
--yel:#ffe400    --org:#ff9d2e
--red:#ff4444    --mag:#ff6cc4
--lnk:#7fc9ff                        /* 링크 */
/* 등급색 */
--n:#9aa0ac  --r:#5aa0ff  --sr:#b07cff  --ssr:#ffc83a  --ur:#ff6a3d
```

### 12.2 서체

```css
--f-ui: "Dotum","돋움","Gulim","굴림","Malgun Gothic",sans-serif;  /* 시스템 우선 */
--f-mn: "Nanum Gothic Coding","D2Coding","Consolas",monospace;      /* 수치·로그 */
--f-dp: "Black Han Sans","Dotum",sans-serif;                        /* 로고 */
```

**본문에 시스템 폰트를 먼저 두는 게 핵심이다.** Windows에서 실제 돋움/굴림이
잡혀야 그 시절 질감이 난다. 웹폰트는 로고와 등폭 두 곳에만 쓴다.

### 12.3 구성 규칙

- 프레임셋 흉내: 좌측 300px 스테이터스 + 우측 메인 + 하단 커맨드 바
- 섹션 제목은 전부 `【 】` 로 감싼다. 공지는 `※` 로 시작한다
- 모든 정보는 `<table>`. 카드·둥근 모서리·그림자 금지 (`border-radius` 0)
- 게이지는 `repeating-linear-gradient(90deg, ... 0 3px, ... 3px 4px)` 로
  도트 찍힌 막대를 만든다. 매끈한 그라디언트를 쓰면 시대감이 깨진다
- 배경에 4px 간격 스캔라인 두 겹 + 상단 라디얼 그라디언트
- 링크 hover는 `color:#ff4444; background:#2a0000` — 당시 흔하던 반전 효과

---

## 13. 커스터마이즈 레시피

### 로스터 규모

기본이 전 기체(1244기)다. 줄이려면 `--limit=<n>` (등급별 n기).

```bash
node src/fetch-roster.mjs --limit=40   # 약 200기
```

**1기당 데이터 740B + 이미지 118KB.** 데이터는 전부 담아도 1MB 미만이라
규모를 좌우하는 건 사실상 이미지뿐이다.

### 특정 기체 찾기

전 기체를 담으므로 강제 포함 목록은 필요 없다. API 의 정확한 이름을 확인하려면:

```bash
node --eval "fetch('https://ggendb.up.railway.app/api/units?lang=EN&page=1&per_page=100&q=Sazabi').then(r=>r.json()).then(j=>console.log(j.rows.map(r=>r.name+' / '+r.rarity)))"
```

### 임무 추가

`src/engine.js` 의 `MISSION` 배열에 항목을 넣고, `MISSION` 은 상황실·출격 화면이
자동으로 순회하므로 UI 수정은 필요 없다.

```js
{ id:'raid', n:'거점 습격', ap:3, lv:16, pool:['SSR','UR'], cnt:5,
  diff:1.08, pay:280000, exp:900, d:'적 보급 거점을 급습한다.' }
```

`ace:'UR'` 을 넣으면 마지막 1기가 에이스로, `boss:true` 를 함께 넣으면 지휘기로 바뀐다.

### 난이도 조정

| 하고 싶은 것 | 만질 곳 |
|---|---|
| 전체적으로 쉽게 | `FOE_DMG` ↓ (0.55 → 0.45) |
| 전투를 짧게 | `DMG_K` ↑ (3.0 → 3.6) |
| 특정 임무만 | 해당 `MISSION.diff` |
| 명중 편차 줄이기 | `HIT_CLAMP` ↓ (6 → 4) |
| 적을 단단하게 | `FOE_HP` ↑ |

바꾼 뒤에는 §10 시뮬레이터로 확인할 것.

### 이미지 크기 바꾸기

`--resize=<px>` (sharp 필요). 용량 표는 [4.4절](#44-이미지는-왜-분리하는가)에 있다.
화면 표시 크기는 `src/head.html` 의 `.ui.s`(44) `.m`(72) `.l`(104) `.xl`(132) 네 단계이고,
어느 크기에 썸네일을 쓸지는 `src/ui.js` 의 `picFor()` 가 정한다.

### 기체명 접두어

`src/fetch-roster.mjs` 의 `NAME_PREFIX`. 기본값 `'[SD] '`. 빈 문자열로 두면 접두어가 사라진다.
로스터에 저장되는 값이므로 바꾼 뒤 **재수집이 필요하다.**

### 등급 표기를 되살리려면

`rar` 값은 데이터에 그대로 남아 있다(가격·해금·적 편성에 쓰인다).
`src/ui.js` 에 아래를 되살리고 원하는 위치에 끼우면 된다.

```js
const rtag = r => '<span class="rtag r' + r + '">' + r + '</span>';
```

`.rtag` 와 등급색 `--n/--r/--sr/--ssr/--ur` CSS 는 `head.html` 에 아직 남아 있다.

### 일일 행동력

`src/engine.js` 의 `AP_BASE`(기본 10). 4레벨마다 상한이 1씩 오르는 규칙은
`gainExp()` 안에 있다.

### 언어 바꾸기

`fetch-roster.mjs` 의 `LANG` 을 `JP`/`TW`/`HK` 로. **한국어는 API가 지원하지 않는다.**
무장·특성·시리즈는 `src/i18n.mjs` 가 빌드 시점에 옮기고([4.5절](#45-한글화)),
UI 문자열은 `head.html`·`engine.js`·`ui.js` 에 한글로 하드코딩돼 있다.
`LANG` 을 바꾸면 사전 키가 안 맞으므로 사전도 함께 갈아야 한다.

### 세이브 호환

`SAVEKEY` 는 `'mst.frontline.v2'`. 상태 구조를 바꿨다면 `v3` 으로 올려서
기존 세이브가 깨진 채 로드되지 않게 한다. `load()` 가 `UMAP[id]` 검증을 하므로
로스터만 바뀐 경우는 없는 기체만 조용히 걸러진다.

---

## 14. 출처와 권리

- **전투 규칙 계보** — FF ADVENTURE v0.45 (D.Takamiya / CUMRO) → MSVS →
  MS Tactics v1 (LAK). 2d6 대항판정이라는 뼈대만 가져왔고 코드는 전부 새로 썼다.
- **기체 제원·무장·이미지** — [GGen Eternal Database](https://ggendb.up.railway.app/u).
  푸터에 출처를 표기한다. 이미지를 내장하는 대신 원 서버에 반복 요청을 보내지 않는다.
- 원작 IP는 반다이남코 / 선라이즈에 있다. **비영리 팬 제작물**이며 배포·판매하지 않는다.
- 로스터를 대량으로 늘릴 때는 상대 서버 부담을 생각해 동시 요청 수
  (`pool(items, 6, ...)` / `pool(items, 8, ...)`)를 그대로 두는 것을 권한다.

---

## 부록 — 함수 색인

| 함수 | 파일 | 역할 |
|---|---|---|
| `uStat(v)` | engine | 개조 반영된 기체 제원 |
| `wpowOf(v,i)` | engine | 무장 레벨 반영 위력 |
| `mkPlayer(tac)` | engine | 전투용 플레이어 유닛 생성 |
| `mkFoe(B,lv,elite,boss,idx,diff)` | engine | 전투용 적 유닛 생성 |
| `buildFoes(ms)` | engine | 임무 정의 → 적 편성 |
| `hitAdv(A,D,w)` | engine | 명중 우열 (clamp 포함) |
| `critNeed(A,D,w)` | engine | 크리티컬 필요 마진 |
| `calcDmg(A,D,w)` | engine | 피해량 |
| `chooseWep(A,D)` | engine | 기대 피해 최대 병장 선택 |
| `runBattle(ms,tac)` | engine | 전투 전체 진행 + 정산 (async) |
| `oppP(adv)` | engine | 2d6 대항판정 명중 확률표 |
| `renderAll()` | ui | 좌측 + 메인 + 커맨드 바 재렌더 |
| `view*()` | ui | 화면별 HTML 생성 |
| `bindMain()` | ui | 메인 프레임 이벤트 위임 |
| `nextDay()` | ui | 일자 진행 + 이벤트 |
| `doTrain(k)` | ui | 훈련 판정 |
