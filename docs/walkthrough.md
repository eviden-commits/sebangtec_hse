# KOSHA-MS 사내 표준문서 웹 서비스 구축 완료 보고서 (1단계)

법제처 국가법령정보센터의 UI/UX 체계를 사내 안전보건경영시스템(KOSHA-MS)에 접목한 경량 웹 서비스 시스템이 성공적으로 구축되었습니다.

---

## 1. 구축된 프로젝트 구조

위치: `C:\Users\evide\.gemini\antigravity\scratch\kosha-manual-system`

```
kosha-manual-system/
├── run.bat                 # 로컬 서버 원클릭 컴파일 & 기동 배치 파일
├── bin/                    # Java 바이트코드 컴파일 결과물
├── src/com/sebang/kosha/
│   └── Main.java           # JDK 25 내장 HttpServer 기반 경량 백엔드 (포트 8080)
├── data/
│   ├── documents/          # JSON 기반 매뉴얼/절차서/지침서 데이터
│   │   ├── MAN-KOSHA-01.json  (안전보건경영시스템 매뉴얼, Rev.3)
│   │   ├── PRC-KOSHA-01.json  (위험성평가 관리 절차서, Rev.2)
│   │   └── INS-KOSHA-01.json  (위험성평가 실시 지침서, Rev.1)
│   ├── admins.json         # 수정 권한 허용 관리자 목록
│   └── logs/
│       ├── login_logs.json # 로그인 시도 및 감사 로그 (성공, 외부도메인 차단, 실패)
│       └── print_logs.json # 보안 인쇄 출력 감사 로그 (출력자, 일시, 문서정보, IP)
└── public/
    ├── index.html          # [화면 1] 국가법령센터 메인 포털 (통합 검색, 최신 규정, 분류별 찾기)
    ├── detail.html         # [화면 2] 국가법령 상세 뷰어 (좌측 계층 트리, 우측 본문, 액션바)
    ├── css/
    │   ├── main.css        # 메인 포털 스타일
    │   ├── detail.css      # 상세 2단 분할 레이아웃 스타일
    │   └── print.css       # A4 최적화 및 대각선 보안 워터마크 레이어
    └── js/
        ├── api.js          # REST API 비동기 통신
        ├── auth.js         # sebangtec.com 도메인 OTP 인증 및 관리자 권한 제어
        ├── main.js         # 포털 메인 동적 렌더링 및 통합 검색
        └── detail.js       # 트리 렌더링, 딥링크 공유, 보안 인쇄, 격리 웹에디터, 신구대조
```

---

## 2. 주요 기능 검증 결과

| 기능 | 검증 시나리오 | 동작 결과 |
| :--- | :--- | :--- |
| **외부 도메인 차단** | `intruder@naver.com`으로 OTP 요청 | **403 Forbidden** 차단 반환 및 `login_logs.json`에 `FAIL_INVALID_DOMAIN` 기록 확인 |
| **사내 도메인 OTP** | `sb06@sebangtec.com`으로 OTP 요청 | **200 OK** 정상 처리, 일회용 6자리 OTP 발급 및 `OTP_REQUESTED` 로그 기록 (GAS 비동기 전달) |
| **OTP 인증 & 권한** | 발급된 OTP 검증 요청 | **200 OK** 반환, `isAdmin: true` 플래그 및 토큰 발급 완료 |
| **초기 접속 비밀번호(게이트)** | 초기 접속 시 GAS 웹앱과 통신 | `0889` 입력 시 GAS에서 `접속 인증 성공` 수신 후 화면 잠금 해제 (오답 입력 시 차단 유지) |
| **Google Drive 시트 연동** | GAS `sebangtec_hse` 연동 | 접속 인증, OTP, 보안 인쇄 로그가 Google Drive의 `sebangtec_hse` 스프레드시트와 로컬 JSON에 이중 기록 |
| **통합 본문 검색** | `/api/search?q=위험성평가` 호출 | 매뉴얼 및 절차서, 지침서 본문까지 색인 검색되어 결과 JSON 반환 |
| **보안 인쇄 & 로그** | 문서 인쇄 트리거 시 | 45도 대각선 반투명 워터마크(출력자, 일시, 비제어본) 동적 합성 및 `print_logs.json` 자동 저장 |
| **웹 에디터 오염 방지** | 문서 수정 버튼 클릭 시 | 원본을 바로 건드리지 않고 **임시 메모리(Sandbox Draft)**에서 편집 후 개정 사유와 함께 [발행]해야 적용 |
| **계층 트리 & 딥링크** | 매뉴얼 ➔ 절차서 ➔ 지침서 연계 | 좌측 트리에서 상하위 관계가 시각적으로 연결되며, 조항별 딥링크 URL 복사 지원 |

---

## 3. 로컬 실행 및 접속 방법

1. 브라우저(Chrome, Edge 등)를 열고 다음 주소로 접속합니다:
   - **메인 포털**: `http://localhost:8080/index.html`
   - **문서 상세 뷰어**: `http://localhost:8080/detail.html?id=MAN-KOSHA-01`
2. 향후 컴퓨터를 재부팅하거나 서버를 다시 켤 때는 해당 폴더의 **`run.bat`** 파일을 더블 클릭하시면 1초 만에 컴파일 및 서버가 기동됩니다.
