/**
 * 세방테크 KOSHA-MS 보안 인증 & 로깅 백엔드 (Google Apps Script)
 * 프로젝트 연동 스크립트: sebangtec_hse
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    // Google Drive 스프레드시트 자동 연결 또는 생성 (sebangtec_hse)
    const ss = getOrCreateSpreadsheet("sebangtec_hse");

    // [1] 사이트 초기 접속 비밀번호(게이트) 검증
    if (action === "VERIFY_GATE_PASSWORD") {
      const inputPassword = data.password;
      const scriptProps = PropertiesService.getScriptProperties();
      const correctPassword = scriptProps.getProperty("SITE_PASSWORD");

      if (!correctPassword) {
        return makeJsonResponse({ success: false, message: "스크립트 속성에 SITE_PASSWORD가 설정되지 않았습니다." });
      }

      if (inputPassword === correctPassword) {
        logToSheet(ss, "로그인이력", [new Date(), "GATE_ACCESS", "SUCCESS_GATE_PASSWORD", data.ip || "-", data.userAgent || "-"]);
        return makeJsonResponse({ success: true, message: "접속 인증 성공" });
      } else {
        logToSheet(ss, "로그인이력", [new Date(), "GATE_ACCESS", "FAIL_GATE_PASSWORD", data.ip || "-", data.userAgent || "-"]);
        return makeJsonResponse({ success: false, message: "접속 비밀번호가 일치하지 않습니다." });
      }
    }

    // [2] 사내 이메일 OTP 요청 (@sebangtec.com 검증 & Gmail 발송)
    if (action === "REQUEST_OTP") {
      const email = data.email;
      if (!email || !email.endsWith("@sebangtec.com")) {
        logToSheet(ss, "로그인이력", [new Date(), email, "FAIL_INVALID_DOMAIN", data.ip || "-", data.userAgent || "-"]);
        return makeJsonResponse({ success: false, message: "@sebangtec.com 도메인만 이용 가능합니다." });
      }

      // 6자리 난수 OTP 생성 및 캐시 저장 (5분 유효)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      CacheService.getScriptCache().put("OTP_" + email, otp, 300);

      // Gmail 발송
      GmailApp.sendEmail(email, 
        "[세방테크 KOSHA-MS] 로그인 일회용 인증번호(OTP)", 
        "세방테크 사내 표준정보센터 로그인 인증번호는 [" + otp + "] 입니다. (5분 내 입력)"
      );

      logToSheet(ss, "로그인이력", [new Date(), email, "OTP_SENT", data.ip || "-", data.userAgent || "-"]);
      return makeJsonResponse({ success: true, message: "인증번호가 발송되었습니다." });
    }

    // [3] OTP 검증
    if (action === "VERIFY_OTP") {
      const email = data.email;
      const inputOtp = data.otp;
      const cachedOtp = CacheService.getScriptCache().get("OTP_" + email);

      if (cachedOtp && cachedOtp === inputOtp) {
        CacheService.getScriptCache().remove("OTP_" + email);
        logToSheet(ss, "로그인이력", [new Date(), email, "LOGIN_SUCCESS", data.ip || "-", data.userAgent || "-"]);
        return makeJsonResponse({ success: true, message: "로그인 성공", email: email });
      } else {
        logToSheet(ss, "로그인이력", [new Date(), email, "FAIL_INVALID_OTP", data.ip || "-", data.userAgent || "-"]);
        return makeJsonResponse({ success: false, message: "인증번호가 일치하지 않거나 만료되었습니다." });
      }
    }

    // [4] 보안 인쇄 감사 로그 기록
    if (action === "LOG_PRINT") {
      logToSheet(ss, "인쇄이력", [new Date(), data.userEmail || "비회원", data.docId, data.docTitle, data.ip || "-"]);
      return makeJsonResponse({ success: true });
    }

    return makeJsonResponse({ success: false, message: "알 수 없는 요청입니다." });

  } catch (err) {
    return makeJsonResponse({ success: false, message: err.toString() });
  }
}

// Drive에서 sebangtec_hse 시트 가져오기 (없으면 자동 생성)
function getOrCreateSpreadsheet(name) {
  const files = DriveApp.getFilesByName(name);
  let ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(name);
    initSheet(ss, "로그인이력", ["일시", "이메일/구분", "상태", "접속IP", "기기정보(UA)"]);
    initSheet(ss, "인쇄이력", ["출력일시", "출력자 이메일", "문서번호/ID", "문서제목", "IP"]);
    initSheet(ss, "관리자명단", ["관리자 이메일", "등록일", "비고"]);
  }
  return ss;
}

function initSheet(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setBackground("#194a9a").setFontColor("#ffffff").setFontWeight("bold");
  }
}

function logToSheet(ss, sheetName, rowData) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  sheet.appendRow(rowData);
}

function makeJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
