# 그룹 스터디 문제 출제

md·pdf·텍스트 자료를 넣으면 AI(Gemini)가 문제를 내고, 참가자는 QR/링크로 들어와 개인풀이·협력풀이를 하는 웹앱.
기능·데이터 결정은 [docs/requirements.md](docs/requirements.md)가 정본이다.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000 (0.0.0.0 바인딩, 같은 Wi-Fi 폰에서 접속 가능)
```

운영:

```bash
npm run build
npm start          # .output/server/index.mjs, .env.txt를 함께 읽는다
```

첫 접속(`/`)에서 관리자 계정을 만든다. 이후에는 로그인 화면이다.

## 환경변수 (`.env.txt`, 프로젝트 루트)

| 키 | 설명 |
|----|------|
| `GEMINI_API_KEY` | 필수. Google AI Studio 키 |
| `GEMINI_MODEL` | 선택. 기본 `gemini-3.8-flash` |
| `GEMINI_MOCK` | `1`이면 API 대신 모의 출제 (화면 확인용, 내용 품질 없음) |
| `PORT` | 선택. 기본 3000 (`npm start`) |
| `DB_PATH` | 선택. 기본 `data/app.db` |

`.env.txt`는 git에 올리지 않는다.

## 화면

| 경로 | 내용 |
|------|------|
| `/` | 관리자 계정 생성 / 로그인 |
| `/admin` | 시험지 목록 |
| `/admin/new` | 시험지 생성 (자료 여러 개, 자료별 문제 수·보기 수·복수정답 수, 공통 프롬프트, 기간·제한시간) |
| `/admin/exams/:id` | 문제·해설, md/pdf 다운로드, 차시·QR·링크 열기/닫기/재발급, 결과(개인별 점수·문제별 통계·단체) |
| `/admin/exams/:id/edit` | 기간 수정, 자료/문제 삭제·재출제. 응시자가 있으면 새 차시가 만들어진다 |
| `/admin/settings` | 공개 주소(QR·링크에 쓰는 host), 비밀번호 변경, 로그아웃 |
| `/s/:token` | 개인풀이 (링크 진입, 입장마다 한글 랜덤 닉네임) |
| `/g/:token` | 협력풀이 (방장만 입력, 참가자 번호, 방장 넘기기, SSE 동기화) |

## 구조

```
src/
  routes/            페이지·API (얇게, 컨트롤러 호출만)
  modules/           업무 단위 → controller / service / repository
    auth/ setting/ exam/ generation/ attempt/ room/ participant/ export/
  shared/            config(env), db(node:sqlite + migrations), lib(time·normalize·sse·event-bus), ui
som-style/           테마·상수·프리셋 (som-style)
assets/fonts/        PDF용 Noto Sans KR
docs/requirements.md
```

- DB는 Node 24 내장 `node:sqlite`. 첫 실행 때 `data/app.db`를 만들고 마이그레이션을 적용한다.
- 실시간(협력 방, 출제 진행)은 SSE + 프로세스 안 이벤트 버스. 단일 프로세스 전제.
- 시각은 UTC ISO로 저장하고 화면에서 `Asia/Seoul`로 보여준다.

## 테스트

```bash
npm test           # vitest (채점·정규화·닉네임·AI 응답 검증)
npm run typecheck
```

## 알아둘 것

- 개발 서버의 SolidStart 툴바가 브라우저 콘솔에 `@jridgewell ... default` 오류를 남길 수 있다. 기능과 무관하다.
- 라우트 파일의 `export default function` 이름은 같은 파일에서 `import type`으로 들여온 이름과 겹치면 안 된다 (라우트로 인식되지 않는다).
- 자료 텍스트 추출은 `unpdf`. 스캔 PDF(텍스트 없음)는 오류로 안내한다.
