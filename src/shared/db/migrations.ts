/**
 * 스키마 정의. 순서대로 한 번씩만 적용된다 (schema_migration 테이블에 기록).
 *
 * 결정 사항 (가이드 2-7-1, 2-7-4):
 * - 참조 무결성: DB 외래키로 막는다. PRAGMA foreign_keys=ON.
 *   삭제는 부모가 사라지면 자식도 의미가 없는 관계뿐이므로 전부 CASCADE.
 * - 중복 방지: DB 유니크 제약으로 막는다.
 * - 삭제는 실제 삭제 (요구사항 7장). 이력 성격의 테이블은 created_at만 둔다.
 * - 시각은 UTC ISO 8601 문자열. 시간대는 앱 설정(Asia/Seoul)에서만 바꾼다.
 * - 상태 코드는 대문자 스네이크. 가능한 값은 컬럼 주석에 적는다.
 * - 정답 수·문항 수를 저장하고 점수(%)는 계산한다 (부동소수점 저장 안 함).
 */
export const migrations: { name: string; sql: string }[] = [
  {
    name: "001_init",
    sql: `
CREATE TABLE admin (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,            -- scrypt: salt$hash (hex)
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);
CREATE UNIQUE INDEX uk_admin_username ON admin(username);

CREATE TABLE admin_session (
  id         TEXT    PRIMARY KEY,             -- 랜덤 토큰 (쿠키 값)
  admin_id   INTEGER NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);
CREATE INDEX ix_admin_session_expires ON admin_session(expires_at);

CREATE TABLE setting (
  key        TEXT PRIMARY KEY,                -- PUBLIC_BASE_URL
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE exam (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  common_prompt TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE round (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id         INTEGER NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
  round_no        INTEGER NOT NULL,           -- 1부터. 삭제해도 재부여 안 함
  starts_at       TEXT    NOT NULL,           -- 시작 포함
  ends_at         TEXT    NOT NULL,           -- 종료 미포함
  solo_limit_min  INTEGER NOT NULL,
  group_limit_min INTEGER NOT NULL,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);
CREATE UNIQUE INDEX uk_round_exam_no ON round(exam_id, round_no);

-- 자료와 문제는 차시에 속한다 (차시 = 스냅샷). 수정으로 새 차시가 생기면 복사한다.
CREATE TABLE source (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id         INTEGER NOT NULL REFERENCES round(id) ON DELETE CASCADE,
  seq              INTEGER NOT NULL,
  kind             TEXT    NOT NULL,          -- MD | PDF | TEXT
  file_name        TEXT,                      -- TEXT 자료면 NULL
  content          TEXT    NOT NULL,          -- 추출된 텍스트 (최대 100,000자)
  short_count      INTEGER NOT NULL,
  multiple_count   INTEGER NOT NULL,
  choice_count     INTEGER NOT NULL,          -- 2~6
  max_answer_count INTEGER NOT NULL,          -- 1~choice_count
  created_at       TEXT    NOT NULL
);
CREATE INDEX ix_source_round ON source(round_id, seq);

CREATE TABLE question (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id    INTEGER NOT NULL REFERENCES round(id) ON DELETE CASCADE,
  source_id   INTEGER NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,               -- 차시 안 전체 순번
  type        TEXT    NOT NULL,               -- SHORT | MULTIPLE
  text        TEXT    NOT NULL,
  explanation TEXT    NOT NULL,
  created_at  TEXT    NOT NULL
);
CREATE INDEX ix_question_round ON question(round_id, seq);
CREATE INDEX ix_question_source ON question(source_id);

CREATE TABLE choice (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  text        TEXT    NOT NULL,
  is_answer   INTEGER NOT NULL                -- 0 | 1
);
CREATE INDEX ix_choice_question ON choice(question_id, seq);

CREATE TABLE short_answer (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,               -- 0 = 대표 정답, 이후 유의어
  text        TEXT    NOT NULL
);
CREATE INDEX ix_short_answer_question ON short_answer(question_id, seq);

CREATE TABLE generation_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id        INTEGER REFERENCES round(id) ON DELETE SET NULL,
  source_id       INTEGER REFERENCES source(id) ON DELETE SET NULL,
  model           TEXT    NOT NULL,
  request_summary TEXT    NOT NULL,           -- JSON: 옵션·프롬프트 길이 등
  response_json   TEXT,                       -- AI 응답 원문
  duration_ms     INTEGER NOT NULL,
  error           TEXT,
  created_at      TEXT    NOT NULL
);

CREATE TABLE access_link (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id   INTEGER NOT NULL REFERENCES round(id) ON DELETE CASCADE,
  mode       TEXT    NOT NULL,                -- SOLO | GROUP
  token      TEXT    NOT NULL,
  is_open    INTEGER NOT NULL,                -- 0 | 1
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
CREATE UNIQUE INDEX uk_access_link_token ON access_link(token);
CREATE UNIQUE INDEX uk_access_link_round_mode ON access_link(round_id, mode);

CREATE TABLE participant (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id   INTEGER NOT NULL REFERENCES round(id) ON DELETE CASCADE,
  mode       TEXT    NOT NULL,                -- SOLO | GROUP
  secret     TEXT    NOT NULL,                -- 쿠키 값
  nickname   TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);
CREATE UNIQUE INDEX uk_participant_secret ON participant(secret);
CREATE INDEX ix_participant_round ON participant(round_id, mode);

CREATE TABLE solo_attempt (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id       INTEGER NOT NULL REFERENCES round(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES participant(id) ON DELETE CASCADE,
  started_at     TEXT    NOT NULL,
  submitted_at   TEXT,                        -- NULL = 풀이 중
  submit_kind    TEXT,                        -- MANUAL | TIMEOUT | LINK_CLOSED | GROUP_STARTED
  correct_count  INTEGER,                     -- 제출 시 스냅샷
  question_count INTEGER,                     -- 제출 시 스냅샷
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL
);
CREATE UNIQUE INDEX uk_solo_attempt_participant ON solo_attempt(participant_id);
CREATE INDEX ix_solo_attempt_round ON solo_attempt(round_id);

CREATE TABLE solo_answer (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id  INTEGER NOT NULL REFERENCES solo_attempt(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  choice_ids  TEXT,                           -- JSON 배열 (객관식)
  text        TEXT,                           -- 주관식
  updated_at  TEXT    NOT NULL
);
CREATE UNIQUE INDEX uk_solo_answer ON solo_answer(attempt_id, question_id);

CREATE TABLE group_room (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id              INTEGER NOT NULL REFERENCES round(id) ON DELETE CASCADE,
  leader_participant_id INTEGER REFERENCES participant(id) ON DELETE SET NULL,
  started_at            TEXT,                 -- 방장이 시작을 누른 시각
  submitted_at          TEXT,
  submit_kind           TEXT,                 -- MANUAL | TIMEOUT | LINK_CLOSED
  correct_count         INTEGER,
  question_count        INTEGER,
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL
);
CREATE UNIQUE INDEX uk_group_room_round ON group_room(round_id);

CREATE TABLE room_member (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id        INTEGER NOT NULL REFERENCES group_room(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES participant(id) ON DELETE CASCADE,
  member_no      INTEGER NOT NULL,            -- 입장 순서 1, 2, 3…
  joined_at      TEXT    NOT NULL,
  last_seen_at   TEXT    NOT NULL
);
CREATE UNIQUE INDEX uk_room_member_participant ON room_member(participant_id);
CREATE UNIQUE INDEX uk_room_member_no ON room_member(room_id, member_no);

CREATE TABLE group_answer (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id     INTEGER NOT NULL REFERENCES group_room(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  choice_ids  TEXT,
  text        TEXT,
  updated_at  TEXT    NOT NULL
);
CREATE UNIQUE INDEX uk_group_answer ON group_answer(room_id, question_id);
`,
  },
  {
    name: "002_admin_recovery",
    sql: `
-- 비밀번호 찾기용 질문·답변. 답변은 정규화(공백·문장부호 제거, 소문자) 후 scrypt 해시로만 저장.
-- 빈 문자열이면 아직 등록하지 않은 계정 (설정에서 등록).
ALTER TABLE admin ADD COLUMN recovery_question TEXT NOT NULL DEFAULT '';
ALTER TABLE admin ADD COLUMN recovery_answer_hash TEXT NOT NULL DEFAULT '';
`,
  },
  {
    name: "003_exam_owner",
    sql: `
-- 시험지는 만든 관리자만 관리한다. 기존 시험지는 가장 먼저 만든 계정에 귀속.
ALTER TABLE exam ADD COLUMN admin_id INTEGER REFERENCES admin(id) ON DELETE CASCADE;
UPDATE exam SET admin_id = (SELECT MIN(id) FROM admin) WHERE admin_id IS NULL;
CREATE INDEX ix_exam_admin ON exam(admin_id);
`,
  },
];
