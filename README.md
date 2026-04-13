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
- Docker에서 Codex를 쓸 경우 이미지 안에 Codex CLI가 설치되어 있어야 함
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

### Codex 사용 시

- 저장소 루트의 `CODEX.md`를 통해 Codex 런타임 지침을 제공합니다.
- Docker 이미지에는 `@openai/codex` CLI가 포함됩니다.
- 컨테이너에서는 호스트의 `~/.codex` 설정을 마운트해 인증 정보를 사용합니다.

### 기존 데이터 마이그레이션 (선택)

이미 CLI로 카드뉴스를 생성해왔다면:

```bash
npm run migrate
```

## 배포

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

### macOS (launchd)

```bash
npm run dashboard:install
```

## 프로젝트 구조

```
├── server.js              # Fastify 엔트리포인트
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
