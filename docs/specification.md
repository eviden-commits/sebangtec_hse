# KOSHA-MS & 사내 표준문서 시스템 개발 사양서 (SRS)

## 1. 프로젝트 개요
- **시스템 명칭**: KOSHA-MS 사내 표준문서 포털 시스템 (가칭)
- **목적**:
  - 기존 인쇄물이나 폐쇄적 파일로 관리되던 안전보건경영시스템(KOSHA-MS) 매뉴얼, 절차서, 지침서, 서식을 웹(HTML) 기반으로 일원화
  - 국가법령정보센터 형태의 친숙하고 체계적인 UI/UX를 도입하여 빠른 검색, 조항별 열람, 신구대비 개정이력 추적 제공
  - 인쇄 시 출력자 정보 워터마크 및 출력 감사 로그를 통한 사내 보안 관리 강화
  - 웹 에디터와 임시 메모리(Draft Staging)를 통한 안전하고 직관적인 문서 관리 지원

---

## 2. 기술 스택 및 환경
- **개발 환경**: Local Windows 환경에서 우선 개발 및 실시간 테스트
- **운영 환경**: 사내 웹서버 또는 임대 호스팅 서버 (JAR 단독 실행 또는 경량 서블릿/정적 웹 배포)
- **프론트엔드**:
  - Modern HTML5, CSS3, Vanilla JavaScript (외부 거대 프레임워크 종속성 배제, 가볍고 빠른 반응형 웹)
  - 웹 리치 텍스트 에디터: Quill.js 또는 TinyMCE (경량화 구성)
  - Diff 뷰어: jsdiff / Diff2Html 라이브러리 (신구대조 기능)
- **백엔드**:
  - **Java** (Spring Boot 경량 REST API 또는 Embedded Undertow/Tomcat)
  - 로컬에서 `mvnw spring-boot:run` 또는 단일 실행형 `.jar`로 원클릭 기동 가능
- **데이터 스토리지 (JSON DB)**:
  - RDBMS 설치 없이 로컬 파일 시스템의 구조화된 `.json` 파일들을 데이터베이스로 사용
  - 서버 시작 시 메모리(In-memory Map)로 캐싱하여 초고속 인덱스 검색 보장
  - 파일 쓰기 시 원자적(Atomic) 파일 교체로 데이터 오염 방지

---

## 3. UI/UX 구성 및 화면 설계

### 3.1 메인 포털 화면 (`index.html`) - 국가법령정보센터 메인 벤치마킹
- **헤더**:
  - 회사 로고 (SEBANG TEC)
  - 로그인 상태 표시 (미로그인 / 로그인된 사번 이메일 표시)
  - 관리자 전용 [관리자 설정] 및 [새 문서 작성] 버튼 (권한 보유자에게만 노출)
- **중앙 통합 검색 영역**:
  - 검색어 입력창 (자동완성 및 엔터 시 즉시 결과 표시)
  - 대상 필터: [전체] [매뉴얼] [절차서] [지침서] [서식]
- **하단 위젯 구역**:
  - **최신 제·개정 규정**: 최근 개정된 절차서/지침서 목록 및 개정일자 표기
  - **카테고리/분야별 탐색**: 안전관리, 보건관리, 환경관리, 비상대응 등 분류별 아이콘 바로가기
  - **나의 즐겨찾기**: 로그인 사용자가 자주 찾는 규정 즐겨찾기 목록

### 3.2 문서 상세 및 뷰어 화면 (`detail.html`) - 국가법령 상세 벤치마킹
- **상단 유틸리티 툴바**:
  - [보안 인쇄] (워터마크 자동 삽입 및 출력 로그 기록)
  - [URL 공유] (현재 조항 위치로 즉시 스크롤되는 단축 딥링크 복사)
  - [즐겨찾기 추가/해제] (사용자 계정 JSON에 저장)
  - [개정이력 / 신구대조] (모달 창으로 이전 개정본과의 변경 내용 강조 표시)
  - [수정하기] (허용된 관리자에게만 활성화)
- **좌측 네비게이션 트리 (Left Sidebar)**:
  - 매뉴얼 ➔ 하부 절차서 ➔ 하부 지침서/서식 계층 트리
  - 접기/펼치기 및 현재 읽고 있는 문서 하이라이트
- **우측 본문 영역 (Content Pane)**:
  - 문서 헤더: 문서번호, 제·개정 번호(Rev), 시행일자, 주관부서
  - 조항별(제n조, 제n항) 본문 렌더링
  - 각 조항 우측에 '링크 복사' 및 '관련 절차서 팝업' 배지 연계

### 3.3 관리자 모달 및 웹 에디터 (Draft Staging 모달)
- **오염 방지 격리 구조 (Sandbox Draft)**:
  - 문서 수정 버튼 클릭 시 원본이 바로 바뀌지 않고, **독립된 모달 창의 임시 메모리**에 원본을 복사하여 로드
  - 에디터 안에서 서식, 표, 텍스트 편집, 관련 양식 첨부
  - [미리보기] 지원
  - [개정 사유 입력] 필수화 (예: "2026년 정기 심사 지적사항 반영 개정")
  - [발행 및 적용] 버튼을 눌러야만 실제 JSON 파일에 버전이 올라가며 갱신
  - [취소] 시 임시 메모리 즉시 파기

---

## 4. 세부 기능 사양

### 4.1 로그인 및 인증 (GAS 기반 이메일 OTP)
1. **도메인 제한 검증**:
   - 입력값 정규식 검증: `^[a-zA-Z0-9._%+-]+@sebangtec\.com$`
   - 타 도메인(naver.com, gmail.com 등) 입력 시: *"허용되지 않은 사내 이메일 도메인입니다."* 경고 반환 및 진행 거부
2. **OTP 발송 및 검증**:
   - 기존 구축된 Google Apps Script(GAS) 웹앱 엔드포인트와 통신
   - 6자리 난수 OTP 생성 후 사내 이메일로 전송
   - OTP 일치 시 로그인 세션 토큰(LocalStorage/Cookie) 발급

### 4.2 관리자 권한 관리
- **허용 관리자 목록 JSON (`admins.json`)**:
  - 기본 허용 예시: `["sb06@sebangtec.com", "nschoi@sebangtec.com"]`
- **권한 관리 모달**:
  - 관리자로 로그인한 경우에만 [관리자 관리] 팝업 접근 가능
  - 사내 이메일을 추가하거나 삭제할 수 있는 간편 UI 제공

### 4.3 보안 인쇄 및 감사 로그 (Audit Log)
1. **로그인 이력 로그 (`login_logs.json`)**:
   - OTP 발송 요청 및 최종 로그인 성공/실패 시 백엔드에 즉시 기록
   - 기록 항목: `timestamp`, `userEmail`, `status` (SUCCESS / FAIL_DOMAIN / FAIL_OTP), `ipAddress`, `userAgent`
   - 비인가 도메인 접근 시도나 잘못된 OTP 입력 시도까지 추적 가능
2. **화면 및 인쇄 워터마크**:
   - CSS `@media print` 및 동적 캔버스 배경 레이어 적용
   - 대각선 45도 반투명 워터마크 출력:
     - `SEBANG TEC CO., LTD. - 비제어본 (UNCONTROLLED COPY)`
     - `출력자: {로그인 이메일} | 출력일시: YYYY-MM-DD HH:mm:ss`
3. **인쇄 감사 로그 (`print_logs.json`)**:
   - 인쇄 트리거 시 백엔드로 즉시 비동기 로깅 요청:
     - `timestamp`, `userEmail`, `documentId`, `documentTitle`, `ipAddress`

### 4.4 URL 단축 및 딥링크 공유
- 사내 규정 링크: `http://localhost:8080/doc/{docId}?clause={clauseId}`
- 단축 키 발급 매핑 (`shortlinks.json`): 예: `/s/k3a9f` ➔ 특정 매뉴얼 제5조로 바로 이동

---

## 5. 데이터 저장소 설계 (JSON 스키마)

### 5.1 문서 데이터 (`data/documents/{docId}.json`)
```json
{
  "id": "MAN-KOSHA-01",
  "category": "MANUAL", 
  "parentId": null,
  "title": "안전보건경영시스템 매뉴얼",
  "docNumber": "ST-MN-001",
  "currentVersion": "Rev.3",
  "effectiveDate": "2026-03-01",
  "department": "안전보건팀",
  "childrenIds": ["PRC-KOSHA-01", "PRC-KOSHA-02"],
  "revisions": [
    {
      "version": "Rev.2",
      "date": "2024-01-15",
      "author": "sb06@sebangtec.com",
      "summary": "법 개정에 따른 관리감독자 역할 구체화",
      "content": "..."
    },
    {
      "version": "Rev.3",
      "date": "2026-03-01",
      "author": "nschoi@sebangtec.com",
      "summary": "KOSHA-MS 정기 심사 개정사항 반영",
      "content": "<h1>제1조 (목적)</h1>..."
    }
  ],
  "currentContent": "<h1>제1조 (목적)</h1><p>본 매뉴얼은...</p>"
}
```

### 5.2 관리자 목록 (`data/admins.json`)
```json
{
  "admins": [
    "sb06@sebangtec.com",
    "nschoi@sebangtec.com"
  ]
}
```

### 5.3 사용자 개인화 (`data/users/{email_hash}.json`)
```json
{
  "email": "user@sebangtec.com",
  "bookmarks": ["MAN-KOSHA-01", "PRC-KOSHA-02"],
  "recentViews": [
    {"docId": "MAN-KOSHA-01", "viewedAt": "2026-09-04T07:15:00Z"}
  ]
}
```

### 5.4 인쇄 감사 로그 (`data/logs/print_logs.json`)
```json
[
  {
    "logId": "log_print_20260904_001",
    "userEmail": "sb06@sebangtec.com",
    "docId": "MAN-KOSHA-01",
    "docTitle": "안전보건경영시스템 매뉴얼",
    "timestamp": "2026-09-04T07:25:31+09:00",
    "ip": "192.168.0.45"
  }
]
```

### 5.5 로그인 감사 로그 (`data/logs/login_logs.json`)
```json
[
  {
    "logId": "log_login_20260904_001",
    "userEmail": "sb06@sebangtec.com",
    "status": "SUCCESS",
    "timestamp": "2026-09-04T07:20:10+09:00",
    "ip": "192.168.0.45",
    "userAgent": "Mozilla/5.0..."
  },
  {
    "logId": "log_login_20260904_002",
    "userEmail": "intruder@gmail.com",
    "status": "FAIL_INVALID_DOMAIN",
    "timestamp": "2026-09-04T07:22:05+09:00",
    "ip": "211.234.12.3",
    "userAgent": "Mozilla/5.0..."
  }
]
```

---

## 6. 단계별 개발 로드맵 (Execution Plan)

- **[1단계] 로컬 프로젝트 기본 뼈대 & 백엔드/JSON 데이터 핸들러 구축**
  - Java 기반 경량 백엔드 세팅 (REST API + 정적 웹서버)
  - JSON 데이터 읽기/쓰기 및 검색 엔진 기본 구조 구현
- **[2단계] 국가법령정보센터 스타일 프론트엔드 UI 구축**
  - `index.html`: 상단 헤더, 메인 검색 바, 최신 개정 규정 및 카테고리
  - `detail.html`: 좌측 계층 트리(매뉴얼-절차서-지침서), 우측 본문 뷰어, 상단 툴바
- **[3단계] 사내 이메일 OTP 인증 & 관리자 권한 제어 모달**
  - `@sebangtec.com` 도메인 검증 및 GAS 연동 OTP 모달
  - 관리자 추가/삭제 모달 및 수정 권한 분기
- **[4단계] 안전한 웹 에디터 (Draft Sandbox) & 개정이력(Diff) 뷰어**
  - 임시 메모리 기반의 작성/수정 모달 (본문 오염 방지)
  - 이전 버전과의 신구대조(Diff) 비교 뷰어 구현
- **[5단계] 보안 인쇄 워터마크 & JSON 인쇄 로그 & 단축 URL 공유**
  - CSS Print 워터마크 합성 및 서버 인쇄 로깅
  - 단축 URL 생성 및 조항 앵커 공유 기능
- **[6단계] 종합 테스트 및 배포 패키징**
  - 로컬 환경 시연 및 호스팅/서버 이관을 위한 단일 실행 JAR/정적 리소스 패키징
