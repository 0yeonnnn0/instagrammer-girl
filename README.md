# 📸 IG Dashboard

Instagram 카드뉴스 & 릴스를 자동으로 생성하고 업로드하는 대시보드.

AI CLI(Claude 또는 Codex)가 리서치 → 카피라이팅 → 렌더링 → 업로드 전 과정을 자동화합니다.

## 주요 기능

- **다중 계정 관리** — 여러 Instagram 계정을 하나의 대시보드에서 관리
- **자동 콘텐츠 생성** — 매일 설정한 시간에 카드뉴스 + 릴스 자동 생성 & 업로드
- **9종 카드뉴스 템플릿** — studio, minimal, bold, elegant, premium, toss, magazine, clean, blueprint
- **4종 릴스 템플릿** — clean, toss, bold, studio
- **템플릿 편집** — 웹에서 HTML 직접 수정 + AI에게 수정 요청
- **프롬프트 커스터마이징** — 콘텐츠 전략 설정 + 추가 지시사항 + 실시간 테스트
- **콘텐츠 전략** — 카드뉴스(튜토리얼/팁), 릴스(뉴스/트렌드) 등 전략별 프롬프트
- **시리즈 모드** — React/Kotlin 같은 프레임워크를 `#1~#N` 순서로 자동 발행
- **프레임워크 전환** — React `10/10` 완료 후 Kotlin `1/10` 자동 전환
- **작업 히스토리** — 성공/실패 로그, 생성된 슬라이드 미리보기

## 스크린샷

> 토스 스타일 다크 UI

## 기술 스택

| 항목 | 선택 |
|------|------|
| Web | Fastify + EJS + Alpine.js + htmx |
| DB | SQLite (better-sqlite3) |
| AI | Claude CLI 또는 Codex CLI |
| 렌더링 | Puppeteer (HTML → PNG) |
| 영상 | FFmpeg (PNG → MP4) |
| 업로드 | Instagram Graph API (Cloudinary 중계) |
| 스케줄 | node-cron (인프로세스) |
| CSS | Pretendard + 토스 스타일 커스텀 |

## 시작하기

### 필수 조건

- Node.js 20+
- Claude CLI 또는 Codex CLI 중 하나
- FFmpeg (`brew install ffmpeg` / `apt install ffmpeg`)
- Instagram Business 계정 + Graph API 토큰
- Cloudinary 계정 (무료 플랜 OK)

### 설치

```bash
git clone https://github.com/0yeonnnn0/instagrammer-girl.git
cd instagrammer-girl
npm install
```

### 환경 변수 설정

```bash
cp .env.example .env
# .env 파일을 열어서 API 키를 입력하세요
# 필요하면 AI_PROVIDER=codex 로 변경
```

### 실행

```bash
# 대시보드 시작
npm start

# http://localhost:3000 접속
# 기본 로그인: admin / admin
```

계정 설정 화면에서 계정별로 `AI Provider`와 `AI Model`을 따로 지정할 수 있습니다.

### 카드 시리즈 모드

계정 설정의 `주제 설정` 탭에서 카드 주제를 시리즈로 운용할 수 있습니다.

- `card_topic_mode=series`: 백업 주제 대신 시리즈 파트로 생성
- `card_series_framework`: 예) `React`, `Kotlin`
- `card_series_current_part`: 현재 파트
- `card_series_total_parts`: 전체 파트 수
- `card_series_loop`: 마지막 파트 이후 반복 여부

현재 기본 커리큘럼:

- React 1~10 (컴포넌트/props/state/useEffect 등)
- Kotlin 1~10 (기본문법/null-safety/컬렉션/코루틴 등)

전환 규칙:

- React `10/10` 성공 시 다음 실행부터 Kotlin `1/10` 자동 전환
- `card_series_loop=0`일 때도 위 전환 규칙이 우선 적용됩니다.

### 기존 데이터 마이그레이션 (선택)

이미 CLI로 카드뉴스를 생성해왔다면:

```bash
npm run migrate
```

## 배포

권장 운영 경로는 `worker.js` 단일 스케줄러입니다.
`server.js`는 대시보드/API만 담당하고, 자동 실행은 `worker.js`에 맡기세요.

이유:

- `server.js`와 `worker.js`가 동시에 스케줄러를 돌면 같은 시간에 중복 게시가 발생할 수 있습니다.
- 기본값으로 `server.js`의 스케줄러는 비활성화되어 있습니다.
  - 활성화가 꼭 필요할 때만 `.env`에 `SERVER_RUN_SCHEDULER=1` 설정

### Docker (권장)

```bash
docker compose up -d
# http://localhost:3000
```

`restart: unless-stopped`로 부팅 시 자동 실행됩니다.

### Linux (systemd)

```bash
bash automation/install-linux.sh
```

### Raspberry Pi Worker Only (systemd)

웹 대시보드 없이 자동화만 돌리려면:

```bash
npm run worker
```

라즈베리파이에서 부팅 시 자동 실행하려면:

```bash
npm run worker:install:linux
```

이 경로는 `worker.js`만 실행하며, `data/dashboard.db`에 저장된 활성 계정의 스케줄을 기준으로 카드뉴스/릴스를 생성합니다.

### macOS (launchd)

```bash
npm run dashboard:install
```

자동화만 백그라운드로 돌리려면:

```bash
npm run worker:install
```

이 경로는 `worker.js`를 `launchd`로 상시 유지하고, 실제 매일 아침 실행 시각은 계정의 `schedule_cron` 설정을 따릅니다.

레거시 단일 스크립트 스케줄러를 과거에 설치했다면 제거:

```bash
npm run legacy:schedule:uninstall
```

## 프로젝트 구조

```
├── server.js              # Fastify 엔트리포인트
├── worker.js              # 자동화 워커(권장 스케줄 실행 주체)
├── lib/                   # 핵심 로직
│   ├── db.js              # SQLite 연결
│   ├── auth.js            # 인증
│   ├── crypto.js          # 토큰 암호화
│   ├── scheduler.js       # 계정별 스케줄러
│   ├── ai-provider.js     # Claude/Codex 실행 추상화
│   ├── job-runner.js      # 콘텐츠 생성 파이프라인
│   └── feeds.js           # RSS 수집
├── routes/                # API 라우트
├── views/                 # EJS 템플릿
├── templates/             # 카드뉴스 HTML 템플릿 (9종)
├── templates-reel/        # 릴스 HTML 템플릿 (4종)
├── scripts/               # 렌더링/업로드 스크립트
├── automation/            # OS별 자동 실행 설정
├── Dockerfile
└── docker-compose.yml
```

## 콘텐츠 생성 파이프라인

```
RSS 수집 → AI 주제 선정 → 리서치 → 카피라이팅 → 카피 토론
→ HTML 렌더링 (Puppeteer) → 캡션 생성 → Instagram 업로드
```

## 라이선스

[MIT](LICENSE)
