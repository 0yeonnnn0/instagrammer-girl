# 리서치: 클로드코드 유출 사건

> 작성일: 2026-04-03 | 주제: Anthropic Claude Code 소스코드 유출 보안 사고

---

## 핵심 포인트 (5-10 bullets)

- **유출 원인**: 2026년 3월 31일, Anthropic이 Claude Code npm 패키지(v2.1.88) 배포 시 `.npmignore` 파일에서 `.map` 파일 제외 처리를 누락하여 59.8MB 크기의 JavaScript 소스맵 파일이 공개 npm 레지스트리에 포함된 채 배포됨. Bun 런타임의 알려진 버그(oven-sh/bun#28001, 3월 11일 제보)도 원인으로 지목됨.

- **유출 규모**: `@anthropic-ai/claude-code` 2.1.88 버전에 포함된 소스맵이 Anthropic의 Cloudflare R2 스토리지 버킷에 호스팅된 전체 소스코드 zip 파일을 참조함. 총 **512,000줄 이상의 비난독화 TypeScript 코드**, **1,906개 파일** 노출.

- **발견 및 확산**: 보안 연구원 Chaofan Shou가 04:23 UTC에 X(트위터)에 공개 → 게시물이 수 시간 내 **3,200만 뷰** 돌파 → GitHub에 미러 저장소가 급속도로 확산되어 **8만 4천 스타, 8만 2천 포크** 달성 → 소스코드를 TypeScript에서 Python으로 재작성한 "claw-code" 저장소가 **약 2시간 만에 10만 5천 스타**를 기록하며 GitHub 역사상 가장 빠르게 성장한 저장소로 등극.

- **미공개 기능 노출**: 44개의 미공개 기능 플래그 발견. 주요 내용:
  - **KAIROS**: 사용자가 자리를 비운 유휴 시간에 자율적으로 메모리를 통합·정제하는 백그라운드 데몬. 밤에 "dreaming" 프로세스 실행. 3중 레이어 메모리 시스템 구비.
  - **ULTRAPLAN**: 복잡한 계획 수립을 최대 30분짜리 원격 클라우드 세션에 위임하고 결과를 로컬에서 실행.
  - **Coordinator Mode**: 하나의 Claude 인스턴스가 여러 워커 에이전트를 병렬 스폰·관리하는 멀티 에이전트 오케스트레이션.
  - **BUDDY**: 18종 종류의 터미널 가상 펫(다마고치 방식). DEBUGGING, PATIENCE, CHAOS 등 성격 스탯 포함. 4월 1~7일 출시 예정이었음.
  - **Undercover Mode**: 공개 저장소 커밋에서 AI 기여 표시를 제거하는 스텔스 기능.
  - **Anti-distillation 메커니즘**: 경쟁사의 API 트래픽 학습 데이터 수집을 방해하기 위한 가짜 툴 정의 및 암호화 클라이언트 인증.

- **내부 모델 코드명 노출**: 개발 중인 차세대 모델의 내부 코드명 공개:
  - **Capybara** → Claude 4.6 변형
  - **Fennec** → Opus 4.6
  - **Numbat** → 미출시 테스트 중 모델
  - 내부 테스트에서 v8의 허위 주장 비율이 29~30%로 v4의 16.7% 대비 **악화**된 회귀 지표도 포함.

- **이중 보안 사고**: 같은 날(3월 31일) 00:21~03:29 UTC 사이에 npm `axios` 패키지의 악성 버전(v1.14.1, v0.30.4)이 **원격 접근 트로이 목마(RAT)** 를 포함한 채 배포되는 공급망 공격이 동시 발생. 해당 시간대에 Claude Code를 설치한 개발자들은 복합 위험에 노출됨.

- **Anthropic의 대응**: 약 08:00 UTC에 npm 패키지 철회. 공식 성명: *"이는 릴리스 패키징 과정에서 발생한 인간의 실수이며, 보안 침해가 아닙니다. 민감한 고객 데이터나 자격 증명은 전혀 노출되지 않았습니다."* → 이후 8,100개 이상의 GitHub 저장소에 DMCA 삭제 요청 전송 (일부 실수로 자사 공개 저장소 포크까지 삭제하는 실수 추가 발생).

- **연속 보안 실책**: 클로드 코드 유출 나흘 전인 3월 27일, CMS 설정 오류로 Anthropic의 미공개 모델 "Mythos"에 대한 내부 파일 약 3,000개가 외부에 노출된 선행 사고가 있었음. IPO 준비 중 연속된 보안 실책으로 신뢰도 타격.

- **비즈니스 영향**: Anthropic은 2026년 4분기 IPO를 통해 350억 달러 이상 조달을 논의 중이었으며, 연 환산 매출 190억 달러를 기록 중. 이번 유출로 경쟁사(Cursor, GitHub Copilot, Windsurf 등)에 내부 로드맵과 아키텍처가 고스란히 노출됨. Yahoo Finance는 이번 사고가 IPO 계획에 부정적 영향을 미칠 것으로 전망.

---

## 관련 통계 및 수치

| 항목 | 수치 |
|------|------|
| 유출된 코드 라인 수 | 512,000줄 이상 |
| 유출된 파일 수 | 1,906개 |
| 소스맵 파일 크기 | 59.8 MB |
| npm 패키지 버전 | 2.1.88 |
| 유출 시각 | 2026년 3월 31일 약 04:00 UTC |
| 발견 시각 | 2026년 3월 31일 04:23 UTC (Chaofan Shou X 게시) |
| 패키지 철회 시각 | 2026년 3월 31일 약 08:00 UTC |
| X(트위터) 조회 수 | 3,200만 뷰 |
| GitHub 미러 스타 | 84,000+ |
| GitHub 미러 포크 | 82,000+ |
| "claw-code" 스타 (2시간 내) | 105,000+ |
| DMCA 삭제된 GitHub 저장소 | 8,100개 이상 |
| 미공개 기능 플래그 수 | 44개 |
| 전체 기능 모듈 수 | 108개 이상 |
| Anthropic 연 환산 매출 (2026년 3월 기준) | 약 190억 달러 |
| 예상 IPO 조달 목표 | 350억 달러 이상 |
| 보안주 주가 하락 (3월 27일 Mythos 유출 당일) | CrowdStrike -7%, Palo Alto Networks -6%, Zscaler -4.5% |
| 악성 axios 배포 위험 시간대 | 2026년 3월 31일 00:21~03:29 UTC |
| v8 내부 허위 주장 비율 (유출 데이터) | 29~30% (v4 대비 16.7%에서 악화) |

---

## 인용구

> **Anthropic 대변인 공식 성명:**
> "클로드 코드 릴리스에 일부 내부 소스코드가 포함된 것은 사실이나, 민감한 고객 데이터나 자격 증명은 전혀 노출되지 않았습니다. 이는 릴리스 패키징 과정에서 발생한 인간의 실수이며, 보안 침해가 아닙니다."
> — Anthropic 대변인 (2026년 3월 31일)

> **Anthropic 엔지니어 Boris Cherny (DMCA 과잉 삭제에 대해):**
> "이것은 의도한 바가 아니었습니다. GitHub과 함께 수정하고 있으며, 곧 해결될 것입니다."
> — Boris Cherny (2026년 4월 1일, X)

> **Theo Browne (개발자 인플루언서), X에서:**
> "클로드의 폐쇄 소스 전략은 AI 시대의 가장 큰 실책(biggest fumble)이었다."

> **Santiago Valdarrama (ML 엔지니어), X에서:**
> "AI가 모든 것을 쓰고 아무도 코드 리뷰를 안 하는 시대에, 모든 게 다 잘 되고 있죠."

> **익명 Hacker News 댓글:**
> "아이러니가 극에 달했다. Anthropic은 자사 Claude가 코드를 얼마나 잘 작성하고 리뷰하는지 마케팅하다가, 정작 자기 코드가 기본적인 실수로 유출됐다."

> **Gergely Orosz (The Pragmatic Engineer):**
> "TypeScript 코드를 Python으로 재작성하면 아마 저작권이 적용되지 않을 것이다. 무서운 점은 이게 AI 에이전트로 순식간에 가능하다는 것이다."

> **개발자 커뮤니티에서 회자된 교훈:**
> "당신의 `.npmignore`는 보안 경계선이다. 그렇게 취급하라."

---

## 최신 트렌드 및 맥락 정보

### 사건의 맥락: AI 코딩 도구 전쟁의 한가운데서

2026년 현재 AI 코딩 도구 시장은 Anthropic의 Claude Code, GitHub Copilot, Cursor, Windsurf, Google의 Gemini Code 등이 치열하게 경쟁 중이다. Claude Code는 "소프트웨어 엔지니어링 에이전트" 카테고리에서 선두 주자로 자리 잡고 있었으며, Anthropic 매출의 약 80%가 엔터프라이즈 고객에서 발생하고 있었다.

### 이중 유출 패턴 (3월 27일 → 3월 31일)

단 나흘 만에 두 번의 유출이 연속 발생하면서 Anthropic의 운영 보안(OpSec) 역량에 대한 근본적 의문이 제기됐다:

1. **3월 27일**: CMS 설정 오류로 미공개 모델 "Mythos" 관련 내부 파일 수천 개 공개
2. **3월 31일**: npm 패키징 오류로 Claude Code 전체 소스코드 유출

### 기술적 원인 분석

- **직접 원인**: `.npmignore` 파일에서 `*.map` 파일 제외 처리 누락
- **간접 원인**: Bun 런타임의 알려진 버그 (GitHub 이슈 제보 후 20일간 수정 미적용)
- **결과**: 프로덕션 빌드에 개발용 소스맵 포함 → 소스맵이 퍼블릭 클라우드 스토리지의 전체 소스 zip 파일 참조 → 누구나 접근 가능

### 보안 파급 효과

1. **공급망 공격 가속화**: 유출 코드를 미끼로 한 트로이 목마 저장소 수천 개가 GitHub에 등장. Rust 기반 드로퍼 `ClaudeCode_x64.exe`가 Vidar v18.7(정보 탈취 악성코드)과 GhostSocks(네트워크 프록시 악성코드) 배포.
2. **취약점 무기화 위험**: 전체 소스코드 공개로 CVE-2025-59536, CVE-2026-21852 등 알려진 취약점을 활용한 원격 코드 실행(RCE) 및 자격 증명 탈취 공격 위험 증가.
3. **타입스쿼팅 공격**: 유출 코드를 컴파일하려는 개발자를 노린 가짜 npm 패키지가 등장.

### 저작권·법적 쟁점

- Anthropic이 8,100개 이상의 GitHub 저장소에 DMCA 삭제 요청 전송 → 자사 공개 저장소의 정상 포크까지 실수로 삭제하는 추가 실수 발생
- **AI 저작권 패러독스**: 코드의 상당 부분이 AI로 생성된 경우 미국 법상 저작권 보호 적용 여부가 불명확하여 법적 집행력 약화
- 분산 미러 및 AI 기반 Python 클린룸 재작성이 빠르게 확산되어 실질적 삭제 효과 제한적

### 커뮤니티 학습 효과 (의외의 긍정적 측면)

- 프로덕션급 AI 에이전트 아키텍처를 처음으로 공개적으로 확인할 수 있게 되어 오픈소스 커뮤니티의 학습 자원이 됨
- r/LocalLLaMA 등 로컬 LLM 커뮤니티에서 "이것이 로컬 모델 기반 에이전트를 어떻게 구현해야 하는지의 설계도"라며 긍정 평가 (3,700+ 업보트)
- 실제로 유출 코드에서 버그를 발견하고 직접 패치를 만든 사례 다수 보고

### IPO와 기업 평판에 대한 우려

- 2026년 4분기 IPO 추진 중인 Anthropic에게 연속된 보안 실책은 기업 거버넌스 문제로 투자자들에게 비춰질 수 있음
- "Safety-First AI Lab"을 표방하는 브랜드 아이덴티티와 모순된 사건
- Inc. 매거진은 이번 유출이 워싱턴 D.C.의 국가안보 관련 논의로까지 확대됐다고 보도

---

## 출처 (Sources)

- [Fortune: Anthropic leaks its own AI coding tool's source code in second major security breach](https://fortune.com/2026/03/31/anthropic-source-code-claude-code-data-leak-second-security-lapse-days-after-accidentally-revealing-mythos/)
- [Axios: Anthropic leaked its own Claude source code](https://www.axios.com/2026/03/31/anthropic-leaked-source-code-ai)
- [VentureBeat: Claude Code's source code appears to have leaked: here's what we know](https://venturebeat.com/technology/claude-codes-source-code-appears-to-have-leaked-heres-what-we-know)
- [Cybernews: Full source code for Anthropic's Claude Code leaks](https://cybernews.com/security/anthropic-claude-code-source-leak/)
- [Zscaler ThreatLabz: Anthropic Claude Code Leak](https://www.zscaler.com/blogs/security-research/anthropic-claude-code-leak)
- [The Register: Anthropic accidentally exposes Claude Code source code](https://www.theregister.com/2026/03/31/anthropic_claude_code_source_code/)
- [DEV.to: The Great Claude Code Leak of 2026](https://dev.to/varshithvhegde/the-great-claude-code-leak-of-2026-accident-incompetence-or-the-best-pr-stunt-in-ai-history-3igm)
- [SecurityWeek: Critical Vulnerability in Claude Code Emerges Days After Source Leak](https://www.securityweek.com/critical-vulnerability-in-claude-code-emerges-days-after-source-leak/)
- [Bloomberg: Anthropic Rushes to Limit Leak of Claude Code Source Code](https://www.bloomberg.com/news/articles/2026-04-01/anthropic-scrambles-to-address-leak-of-claude-code-source-code/)
- [Kilo Blog: Claude Code Source Leak: A Timeline](https://blog.kilo.ai/p/claude-code-source-leak-a-timeline)
- [The Hacker News: Claude Code Leaked via npm Packaging Error, Anthropic Confirms](https://thehackernews.com/2026/04/claude-code-tleaked-via-npm-packaging.html)
- [Cybernews: Leaked Claude Code source spawns fastest growing repository in GitHub's history](https://cybernews.com/tech/claude-code-leak-spawns-github-repo/)
- [TechCrunch: Anthropic took down thousands of GitHub repos trying to yank its leaked source code](https://techcrunch.com/2026/04/01/anthropic-took-down-thousands-of-github-repos-trying-to-yank-its-leaked-source-code-a-move-the-company-says-was-an-accident/)
- [Gizmodo: Source Code for Anthropic's Claude Code Leaks at the Exact Wrong Time](https://gizmodo.com/source-code-for-anthropics-claude-code-leaks-at-the-exact-wrong-time-2000740379)
- [보안뉴스: 앤트로픽 '클로드 코드' 소스 51만줄 유출](https://www.boannews.com/media/view.asp?idx=142963&skind=D)
- [ZDNet Korea: 앤트로픽, '클로드 코드' 설정 실수로 소스코드 50만 줄 노출](https://zdnet.co.kr/view/?no=20260401090613)
- [WaveSpeedAI Blog: Claude Code Leaked Source: BUDDY, KAIROS & Every Hidden Feature Inside](https://wavespeed.ai/blog/posts/claude-code-leaked-source-hidden-features/)
- [PYMNTS: Anthropic Says Claude Code Leak Did Not Expose Customer Data](https://www.pymnts.com/cybersecurity/2026/anthropic-says-claude-code-leak-did-not-expose-customer-data/)
- [Inc: Why Anthropic's Massive Code Leak Is Now a National Security Concern in D.C.](https://www.inc.com/leila-sheridan/anthropic-code-leak-dc-security/91326007)
