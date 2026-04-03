# Instagram API 자동 게시 설정 가이드

> 카드뉴스 PNG + 캡션을 Instagram에 자동으로 게시하기 위한 전체 셋업 과정

---

## 전체 흐름 요약

```
[1] 인스타 비즈니스 계정 전환
 → [2] Facebook 페이지 연결
 → [3] Meta 개발자 앱 생성
 → [4] 권한 설정 & 앱 심사
 → [5] 액세스 토큰 발급
 → [6] 이미지 호스팅 설정 (imgBB)
 → [7] 게시 스크립트 작성
```

예상 소요 시간: **1~2시간** (앱 심사 제외)

---

## Step 1: Instagram 비즈니스/크리에이터 계정 전환

> Instagram Graph API는 **개인 계정을 지원하지 않습니다.** 반드시 비즈니스 또는 크리에이터 계정이어야 합니다.

### 방법 (모바일)

1. Instagram 앱 → 프로필 → 햄버거 메뉴 (≡)
2. **설정 및 활동** → **계정 유형 및 도구** → **프로페셔널 계정으로 전환**
3. 카테고리 선택 (예: `디지털 크리에이터`, `교육`)
4. **크리에이터** 또는 **비즈니스** 중 택 1
   - 크리에이터: 개인 브랜드, 인플루언서
   - 비즈니스: 기업, 브랜드, 서비스
5. 완료 (1분 소요, 무료, 언제든 되돌리기 가능)

### 확인

프로필 → 설정 → 계정 유형에 "프로페셔널 계정"이라고 표시되면 OK.

---

## Step 2: Facebook 페이지 연결

> API 게시를 위해 Instagram 비즈니스 계정을 Facebook 페이지에 연결해야 합니다.

### Facebook 페이지가 없는 경우 — 먼저 생성

1. Facebook 접속 → 좌측 메뉴 **페이지** → **새 페이지 만들기**
2. 페이지 이름: `yeonnnn.dev` (인스타 계정과 동일하게)
3. 카테고리: `교육` 또는 `디지털 크리에이터`
4. 만들기 클릭 → 완료 (프로필 사진, 커버 사진은 나중에 해도 됨)

### 연결 방법 (4가지 중 가장 쉬운 방법)

**방법 A — Instagram 앱에서 연결 (추천)**

1. Instagram 프로필 → **프로필 편집**
2. 스크롤 → **페이지** (공개 비즈니스 정보 섹션)
3. Facebook 로그인 → 연결할 페이지 선택
4. 완료

**방법 B — Facebook에서 연결**

1. Facebook 페이지 → **설정** → **연결된 계정**
2. **Instagram** → **계정 연결**
3. Instagram 로그인 → 확인

### 확인

Instagram 프로필 편집 → 페이지 항목에 Facebook 페이지 이름이 표시되면 OK.

---

## Step 3: Meta 개발자 앱 생성

### 3-1. 개발자 계정 등록

1. [developers.facebook.com](https://developers.facebook.com/) 접속
2. Facebook 계정으로 로그인
3. 상단 **시작하기** 클릭 → 개발자 약관 동의
4. 전화번호 인증 (SMS)

### 3-2. 앱 생성

1. **내 앱** → **앱 만들기**
2. 사용 사례 선택: **기타** → **다음**
3. 앱 유형: **비즈니스** 선택
4. 앱 이름: `CardNews Auto Publisher` (아무거나 가능)
5. 연결할 비즈니스 포트폴리오: 없으면 건너뛰기
6. **앱 만들기** 클릭

### 3-3. Instagram Graph API 제품 추가

1. 앱 대시보드 → **제품 추가**
2. **Instagram Graph API** 찾기 → **설정**
3. 좌측 메뉴에 Instagram 관련 항목들이 추가됨

### 3-4. App ID & App Secret 확인

1. 앱 대시보드 → **설정** → **기본 설정**
2. **앱 ID**: 복사해서 저장
3. **앱 시크릿 코드**: "보기" 클릭 → 비밀번호 입력 → 복사해서 저장

⚠️ **App Secret은 절대 외부에 노출하지 마세요.** `.env` 파일에 저장하고 `.gitignore`에 추가하세요.

---

## Step 4: 권한 설정 & 앱 심사

### 4-1. 필요한 권한

| 권한 | 용도 |
|---|---|
| `instagram_basic` | 계정 기본 정보 읽기 |
| `instagram_content_publish` | 게시물 게시 (**핵심**) |
| `pages_show_list` | 연결된 페이지 목록 조회 |
| `pages_read_engagement` | 페이지 참여도 읽기 |

### 4-2. 테스트 모드에서 먼저 확인 (심사 전)

> 앱이 **개발 모드**일 때는 앱 역할에 추가된 사용자(본인)만 사용할 수 있습니다. 심사 없이도 본인 계정에 게시 가능!

1. 앱 대시보드 → **앱 역할** → **역할**
2. 본인 Facebook 계정이 **관리자**로 되어 있는지 확인
3. **개발 모드**에서는 본인 계정에 한해 모든 권한 사용 가능

🎉 **본인 계정에만 게시할 거라면 앱 심사 없이도 가능합니다!**

### 4-3. 앱 심사 (프로덕션 전환 시 — 선택사항)

> 다른 사용자의 계정에도 게시하려면 앱 심사가 필요합니다. 본인 계정에만 쓸 거면 건너뛰세요.

1. 앱 대시보드 → **앱 검수** → **권한 및 기능**
2. `instagram_content_publish` → **검수 요청**
3. 제출물 준비:
   - 앱 사용 목적 설명 (한글 가능)
   - 화면 녹화 영상: 앱으로 게시하는 과정 시연
   - 개인정보 처리방침 URL (간단한 페이지라도 필요)
4. 제출 → 심사 결과 대기 (보통 1~5 영업일)

---

## Step 5: 액세스 토큰 발급

### 5-1. 단기 토큰 발급 (1시간 유효)

1. [Graph API Explorer](https://developers.facebook.com/tools/explorer/) 접속
2. 상단 드롭다운 → 방금 만든 앱 선택
3. **사용자 토큰 생성** 클릭
4. 권한 추가:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
5. **Generate Access Token** 클릭
6. Facebook 로그인 → 권한 승인
7. 토큰이 생성됨 → 복사

### 5-2. 장기 토큰으로 교환 (60일 유효)

터미널에서 아래 명령 실행:

```bash
curl -X GET "https://graph.facebook.com/v21.0/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id={앱ID}&\
client_secret={앱시크릿}&\
fb_exchange_token={단기토큰}"
```

응답에서 `access_token` 값이 장기 토큰입니다. 복사해서 저장하세요.

### 5-3. Instagram 비즈니스 계정 ID 확인

```bash
curl -X GET "https://graph.facebook.com/v21.0/me/accounts?access_token={장기토큰}"
```

응답에서 Facebook 페이지 ID를 확인한 뒤:

```bash
curl -X GET "https://graph.facebook.com/v21.0/{페이지ID}?fields=instagram_business_account&access_token={장기토큰}"
```

응답의 `instagram_business_account.id`가 **Instagram 비즈니스 계정 ID**입니다. 이 값을 저장하세요.

### 5-4. 토큰 갱신 (60일마다)

장기 토큰 만료 전에 갱신:

```bash
curl -X GET "https://graph.facebook.com/v21.0/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id={앱ID}&\
client_secret={앱시크릿}&\
fb_exchange_token={현재장기토큰}"
```

> 💡 토큰 만료일을 캘린더에 등록해두세요. 만료되면 처음부터 다시 발급해야 합니다.

---

## Step 6: 이미지 호스팅 설정 (imgBB)

> Instagram Graph API는 **공개 URL로만** 이미지를 받습니다. 로컬 PNG 파일을 직접 업로드할 수 없기 때문에 이미지 호스팅이 필요합니다.

### 왜 imgBB인가?

| 서비스 | 무료 용량 | API 지원 | 난이도 |
|---|---|---|---|
| **imgBB** | 무제한 | ✅ 간단 | ⭐ 쉬움 |
| AWS S3 | 5GB (12개월) | ✅ | ⭐⭐⭐ |
| Cloudflare R2 | 10GB | ✅ | ⭐⭐ |
| Imgur | 무제한 | ✅ | ⭐⭐ |

### imgBB API 키 발급

1. [imgbb.com](https://imgbb.com/) 접속 → 회원가입 (무료)
2. 로그인 → [api.imgbb.com](https://api.imgbb.com/) 접속
3. **Get API key** 클릭 → API 키 복사

### 이미지 업로드 테스트

```bash
curl -X POST "https://api.imgbb.com/1/upload" \
  -F "key={imgBB_API_KEY}" \
  -F "image=@output/26-03-15-AI-트렌드-2026/slide_01.png"
```

응답에서 `data.url`이 공개 이미지 URL입니다.

---

## Step 7: 전체 게시 흐름 (API 호출 순서)

### 7-1. 이미지 업로드 (imgBB → 공개 URL 확보)

각 슬라이드 PNG를 imgBB에 업로드하여 URL을 확보합니다.

```bash
# 각 슬라이드마다 반복
curl -X POST "https://api.imgbb.com/1/upload" \
  -F "key={IMGBB_API_KEY}" \
  -F "image=@slide_01.png"
# → 응답에서 image_url 저장
```

### 7-2. 캐러셀 자식 컨테이너 생성 (슬라이드마다 1개)

```bash
# 슬라이드 1
curl -X POST "https://graph.facebook.com/v21.0/{IG_USER_ID}/media" \
  -d "image_url={슬라이드1_URL}" \
  -d "is_carousel_item=true" \
  -d "access_token={ACCESS_TOKEN}"
# → 응답에서 creation_id 저장 (예: 12345678)

# 슬라이드 2 ~ N도 동일하게 반복
```

### 7-3. 캐러셀 컨테이너 생성 (모든 자식 묶기)

```bash
curl -X POST "https://graph.facebook.com/v21.0/{IG_USER_ID}/media" \
  -d "media_type=CAROUSEL" \
  -d "children={자식ID1},{자식ID2},{자식ID3},..." \
  -d "caption={text.md 내용 (URL 인코딩)}" \
  -d "access_token={ACCESS_TOKEN}"
# → 응답에서 creation_id 저장 (캐러셀 컨테이너 ID)
```

### 7-4. 게시 (Publish)

```bash
curl -X POST "https://graph.facebook.com/v21.0/{IG_USER_ID}/media_publish" \
  -d "creation_id={캐러셀_컨테이너_ID}" \
  -d "access_token={ACCESS_TOKEN}"
# → 성공 시 게시물 ID 반환
```

### 7-5. 게시 확인

```bash
curl -X GET "https://graph.facebook.com/v21.0/{게시물ID}?fields=id,timestamp,permalink&access_token={ACCESS_TOKEN}"
# → permalink로 실제 게시물 URL 확인 가능
```

---

## 환경 변수 정리 (.env)

프로젝트 루트에 `.env` 파일을 만들고 아래 값들을 저장하세요:

```env
# Meta / Instagram
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
INSTAGRAM_ACCESS_TOKEN=your_long_lived_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_ig_user_id

# imgBB
IMGBB_API_KEY=your_imgbb_api_key
```

⚠️ `.gitignore`에 `.env` 추가를 잊지 마세요!

---

## 제약 사항 & 주의 사항

| 항목 | 내용 |
|---|---|
| 게시 제한 | 24시간 내 최대 **100개** 게시 (캐러셀은 1개로 카운트) |
| 캐러셀 제한 | 최소 2장, 최대 **10장** |
| 이미지 크기 | 최대 **100MB**, JPG/PNG |
| 비율 | 캐러셀 내 모든 이미지 **동일 비율** 필요 (4:5 권장) |
| 토큰 만료 | 장기 토큰은 **60일** 후 만료, 갱신 필요 |
| 개발 모드 | 본인 계정에만 게시 가능 (심사 없이 OK) |
| 해시태그 | 캡션 내 해시태그 **최대 30개** |

---

## 체크리스트

- [ ] Instagram 비즈니스/크리에이터 계정 전환 완료
- [ ] Facebook 페이지 생성 & Instagram 계정 연결 완료
- [ ] Meta 개발자 앱 생성 완료
- [ ] 앱에서 Instagram Graph API 제품 추가 완료
- [ ] Graph API Explorer에서 토큰 발급 완료
- [ ] 장기 토큰 교환 완료
- [ ] Instagram 비즈니스 계정 ID 확인 완료
- [ ] imgBB 가입 & API 키 발급 완료
- [ ] `.env` 파일 작성 & `.gitignore` 추가 완료
- [ ] 테스트 게시 성공 확인

---

## 참고 링크

- [Instagram Graph API 공식 문서 — Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [Instagram Graph API 개발자 가이드 2026](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/)
- [API to Post to Instagram — 튜토리얼](https://getlate.dev/blog/api-to-post-to-instagram)
- [Meta 앱 심사 가이드](https://developers.facebook.com/docs/instagram-platform/app-review/)
- [Instagram 액세스 토큰 공식 문서](https://developers.facebook.com/docs/instagram-platform/reference/access_token/)
- [imgBB API 문서](https://api.imgbb.com/)
- [Instagram 비즈니스 계정 전환 가이드](https://help.instagram.com/570895513091465)
- [Facebook 페이지 연결 가이드](https://www.leadsie.com/blog/link-instagram-facebook-page)
