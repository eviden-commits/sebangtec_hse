# 세방테크 KOSHA-MS 사내 표준정보센터 (`sebangtec_hse`)

> 법제처 국가법령정보센터의 직관적인 UI/UX를 벤치마킹하여 사내 안전보건경영시스템(KOSHA-MS) 매뉴얼, 절차서, 지침서, 서식을 일원화하고 보안 및 감사 체계를 확립한 웹 포털 시스템입니다.

---

## 🌟 주요 기능 및 특징

1. **국가법령정보센터 벤치마킹 UI/UX**
   - **포털 메인 (`index.html`)**: 통합 검색창, 최신 제·개정 규정 탭, 즐겨찾기, **폴딩식 아코디언 체계 트리**
   - **문서 상세 뷰어 (`detail.html`)**: 좌측 계층 트리(매뉴얼 ➔ 절차서 ➔ 지침서), 조항(제n조) 바로가기 목차, 공식 문서 헤더
2. **초기 접속 보안 인증 (Gatekeeper)**
   - 사이트 첫 진입 시 화면 전체를 잠그고 지정된 보안 비밀번호를 검증
   - **Google Apps Script ScriptProperties (`SITE_PASSWORD`)**와 실시간 연동
3. **Google Drive 연동 실시간 감사 로깅 (`sebangtec_hse`)**
   - 접속 시도, 외부 비인가 도메인 차단 기록, OTP 요청, 인쇄 로그가 구글 드라이브 스프레드시트(`sebangtec_hse`)와 로컬 JSON에 이중 기록
4. **사내 이메일 OTP 본인 인증**
   - `@sebangtec.com` 도메인만 허용 (외부 메일 접근 시 403 차단)
   - GmailApp 연동 실시간 6자리 OTP 발송 및 세션 관리
5. **보안 인쇄 및 동적 워터마크**
   - 인쇄 시 툴바/트리 자동 숨김 및 A4 최적화
   - 대각선 45도 반투명 워터마크: `SEBANG TEC - 비제어본`, `출력자: {이메일}`, `출력일시: {시간}`
   - 인쇄 즉시 서버 감사 로그(`print_logs.json`) 기록
6. **오염 방지 웹 에디터 (Sandbox Draft Mode)**
   - 관리자 권한 계정만 접근 가능
   - 실서버 문서를 건드리지 않고 **임시 메모리(Staging 모달)**에서 격리 편집 후 개정 사유와 함께 [발행]해야 실문서 갱신
   - 이전 버전과의 신구조문대조(Diff) 뷰어 제공
7. **조항별 딥링크 공유**
   - 특정 조항 앵커 링크 클립보드 원클릭 복사

---

## 📂 프로젝트 구조

```
sebangtec_hse/
├── run.bat                 # 로컬 서버 원클릭 기동 배치 파일 (Java 25)
├── src/com/sebang/kosha/   # Java 경량 백엔드 (JDK 내장 HttpServer 기반, 외부 라이브러리 없음)
│   └── Main.java
├── public/                 # 프론트엔드 정적 웹 리소스
│   ├── index.html          # 메인 포털 화면 (법령센터 스타일)
│   ├── detail.html         # 상세 뷰어 화면 (2단 분할 레이아웃)
│   ├── css/                # 스타일시트 (main, detail, print 워터마크)
│   └── js/                 # 클라이언트 스크립트 (api, auth, main, detail)
├── data/                   # JSON 파일 기반 데이터베이스
│   ├── documents/          # KOSHA-MS 규정 문서들 (매뉴얼, 절차서, 지침서)
│   ├── admins.json         # 수정 권한 관리자 명단
│   └── logs/               # 로그인 및 인쇄 감사 로그 (JSON)
└── docs/                   # 프로젝트 문서 및 산출물
    ├── specification.md    # 시스템 개발 사양서 (SRS)
    ├── walkthrough.md      # 기능 검증 및 구현 완료 보고서
    └── gas/Code.gs         # Google Apps Script 연동 전체 소스코드
```

---

## 🚀 로컬 실행 방법

1. Java 17 이상(JDK 25 권장)이 설치된 환경에서 `run.bat` 파일을 더블 클릭합니다.
2. 컴파일 후 자동으로 `http://localhost:8080` 포트로 서버가 기동됩니다.
3. 브라우저에서 `http://localhost:8080`으로 접속하여 테스트합니다.
   - 초기 접속 비밀번호: Google Apps Script에 설정된 값 (테스트: `0889`)
   - 사내 관리자 계정: `sb06@sebangtec.com`, `nschoi@sebangtec.com`
