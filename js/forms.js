/**
 * 세방테크 KOSHA-MS 서식·양식 가상 메모리 작성 및 관리 엔진 (forms.js)
 */

let allFormsList = [];
let currentFormMeta = null;
let currentFormData = null;
let autosaveTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 인증 및 사용자 상태 렌더링
  if (typeof renderUserStatus === 'function') {
    renderUserStatus();
  }

  // 현장 변경 감지 리스너 등록
  window.onSiteChanged = (site) => {
    updateSidebarSiteInfo(site);
    if (currentFormData) {
      applySiteToCurrentForm(site, true);
    }
  };

  updateSidebarSiteInfo(AUTH.getSelectedSite());

  // 서식 목록 로드
  await loadFormsList();

  // URL 파라미터로 서식 ID 전달된 경우 해당 서식 열기, 없으면 첫 번째 서식 기본 로드
  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get('id') || 'FORM-SAFE-01';
  await selectForm(targetId);
});

// 사이드바 상단 현장 정보 박스 갱신
function updateSidebarSiteInfo(site) {
  const container = document.getElementById('sidebar-site-box');
  if (!container) return;

  if (site) {
    const sName = site.siteName || site.name || '현장명 없음';
    const sCode = site.siteCode || site.code || '';
    const sMgr = site.siteManager || site.manager || (site.managers && site.managers[0]) || '미지정';

    container.innerHTML = `
      <div class="site-title">
        <span><i class="fa-solid fa-location-dot"></i> ${sName}</span>
        <button type="button" onclick="openSiteSelectModal()" class="btn-sm-row" style="padding:2px 6px;">변경</button>
      </div>
      <div class="site-sub">
        현장코드: <strong>${sCode}</strong> | 소장: <strong>${sMgr}</strong>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="site-title" style="color:#d97706;">
        <span><i class="fa-solid fa-triangle-exclamation"></i> 현장 미선택</span>
        <button type="button" onclick="openSiteSelectModal()" class="btn-sm-row" style="background:#fef3c7;color:#b45309;">선택하기</button>
      </div>
      <div class="site-sub" style="color:#b45309;">
        현장을 선택하시면 서식에 정보가 자동 반영됩니다.
      </div>
    `;
  }
}

// 서식 목록 조회 및 렌더링
async function loadFormsList() {
  try {
    allFormsList = await API.getForms();
    renderFormsNav('ALL');
  } catch (e) {
    console.error('서식 목록 로드 실패:', e);
  }
}

// 카테고리 탭 필터링
function filterFormCategory(cat) {
  document.querySelectorAll('.form-cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  renderFormsNav(cat);
}

// 좌측 서식 목록 네비게이션 렌더링
function renderFormsNav(category) {
  const listEl = document.getElementById('form-nav-list');
  if (!listEl) return;

  let filtered = allFormsList;
  if (category && category !== 'ALL') {
    filtered = allFormsList.filter(f => f.category === category);
  }

  listEl.innerHTML = filtered.map(f => {
    const isActive = currentFormMeta && currentFormMeta.id === f.id;
    return `
      <li class="form-nav-item ${isActive ? 'active' : ''}" onclick="selectForm('${f.id}')">
        <div class="doc-num">${f.docNumber} &bull; ${f.version}</div>
        <div class="doc-title">${f.title}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${f.categoryName}</div>
      </li>
    `;
  }).join('');
}

// 서식 선택 및 가상 메모리 로드
async function selectForm(formId) {
  try {
    // 1. 메타데이터 및 템플릿 로드
    currentFormMeta = allFormsList.find(f => f.id === formId) || { id: formId, title: '표준 서식', docNumber: formId, version: 'Rev.1' };
    const rawTemplate = await API.getForm(formId);

    // 2. 가상 메모리 데이터 구성 (기본 템플릿 복제)
    currentFormData = JSON.parse(JSON.stringify(rawTemplate.defaultData || {}));
    if (rawTemplate.approvalLine) {
      currentFormData.approvalLine = rawTemplate.approvalLine;
      currentFormMeta.approvalLine = rawTemplate.approvalLine;
    }
    if (rawTemplate.baseTemplateId) {
      currentFormMeta.baseTemplateId = rawTemplate.baseTemplateId;
    }

    // 3. 소속 현장 정보 및 사용자 정보 치환자 바인딩
    const site = AUTH.getSelectedSite() || { siteName: '(주)세방테크 평택 고덕 P3 현장', siteCode: 'ST-PT-03', siteManager: '김세방 소장' };
    applySiteToCurrentForm(site, false);

    // 4. 로컬 캐시(Autosave) 복원 여부 확인
    checkDraftCache(formId);

    // 5. 캔버스 렌더링
    renderFormCanvas();
    renderFormsNav();
    updateAutosaveStatus('정상 로드됨');
  } catch (e) {
    alert('서식을 로드하는 중 오류가 발생했습니다: ' + e.message);
  }
}

// 현장 정보를 현재 서식 데이터에 주입
function applySiteToCurrentForm(site, reRender = true) {
  if (!currentFormData || !site) return;
  const user = AUTH.getUser();
  const todayStr = new Date().toISOString().split('T')[0];

  const sName = site.siteName || site.name || '';
  const sCode = site.siteCode || site.code || '';
  const sMgr = site.siteManager || site.manager || (site.managers && site.managers[0]) || '현장소장';
  const sSafetyMgr = site.safetyManager || (site.safetyManagers && site.safetyManagers[0]) || '안전관리자';
  const writerName = user ? (user.name || user.email.split('@')[0]) : sSafetyMgr;

  // 치환자 치환 로직
  for (let key in currentFormData) {
    if (typeof currentFormData[key] === 'string') {
      currentFormData[key] = currentFormData[key]
        .replace(/{{SITE_NAME}}/g, sName)
        .replace(/{{SITE_CODE}}/g, sCode)
        .replace(/{{SITE_MANAGER}}/g, sMgr)
        .replace(/{{SAFETY_MANAGER}}/g, sSafetyMgr)
        .replace(/{{DATE}}/g, todayStr)
        .replace(/{{WRITER}}/g, writerName);
    }
  }

  // 명시적 프로퍼티 보장
  currentFormData.siteName = sName;
  currentFormData.siteCode = sCode;
  currentFormData.siteManager = sMgr;
  currentFormData.safetyManager = sSafetyMgr;
  if (!currentFormData.docDate || currentFormData.docDate.includes('{{DATE}}')) {
    currentFormData.docDate = todayStr;
  }
  if (!currentFormData.writer || currentFormData.writer.includes('{{WRITER}}')) {
    currentFormData.writer = writerName;
  }

  if (reRender) {
    renderFormCanvas();
    triggerAutosave();
  }
}

// 결재선 테이블 렌더링 엔진 (1단, 2단, 3단, 4단 동적 생성)
function renderApprovalBoxHtml(d) {
  let line = d.approvalLine || (currentFormMeta && currentFormMeta.approvalLine);
  if (!line || !Array.isArray(line) || line.length === 0) {
    if ((currentFormMeta && currentFormMeta.id === 'FORM-SAFE-04') || d.id === 'FORM-SAFE-04') {
      line = [
        { role: '간 사', name: d.safetyManager || '안전관리자' },
        { role: '근로자대표', name: '근로자대표' },
        { role: '위원장(소장)', name: d.siteManager || '현장소장' }
      ];
    } else {
      line = [
        { role: '작 성', name: d.writer || d.safetyManager || '작성자' },
        { role: '검 토', name: '안전팀장' },
        { role: '승 인', name: d.siteManager || '현장소장' }
      ];
    }
  }

  const boxWidth = Math.max(160, line.length * 68);
  return `
    <table class="approval-box" style="width:${boxWidth}px;">
      <tr>
        <th rowspan="2" style="width: 24px; background:#f1f5f9; padding: 2px;">결<br>재</th>
        ${line.map(item => `<th>${item.role}</th>`).join('')}
      </tr>
      <tr class="sign-cell">
        ${line.map(item => {
          let displayName = item.name;
          if (!displayName || displayName.includes('{{SITE_MANAGER}}') || displayName === '현장소장') {
            displayName = d.siteManager || '현장소장';
          } else if (displayName.includes('{{SAFETY_MANAGER}}') || displayName === '안전관리자') {
            displayName = d.safetyManager || '안전관리자';
          } else if (displayName.includes('{{WRITER}}') || displayName === '작성자') {
            displayName = d.writer || '작성자';
          }
          return `<td><strong>${displayName}</strong><br><small>(인)</small></td>`;
        }).join('')}
      </tr>
    </table>
  `;
}

// 캔버스 렌더링 분기
function renderFormCanvas() {
  const canvas = document.getElementById('a4-render-canvas');
  if (!canvas || !currentFormMeta || !currentFormData) return;

  document.getElementById('current-form-badge').innerText = currentFormMeta.docNumber + ' (' + (currentFormMeta.version || 'Rev.1') + ')';
  document.getElementById('current-form-title').innerText = currentFormMeta.title;

  const baseId = currentFormMeta.baseTemplateId || currentFormMeta.id;
  if (baseId === 'FORM-SAFE-01' || currentFormMeta.id === 'FORM-SAFE-01') {
    renderForm01(canvas);
  } else if (baseId === 'FORM-SAFE-02' || currentFormMeta.id === 'FORM-SAFE-02') {
    renderForm02(canvas);
  } else if (baseId === 'FORM-SAFE-03' || currentFormMeta.id === 'FORM-SAFE-03') {
    renderForm03(canvas);
  } else if (baseId === 'FORM-SAFE-04' || currentFormMeta.id === 'FORM-SAFE-04') {
    renderForm04(canvas);
  } else {
    renderForm01(canvas);
  }
}

// -------------------------------------------------------------
// [FORM-SAFE-01] 일일 안전보건 순회점검표 렌더링
// -------------------------------------------------------------
function renderForm01(canvas) {
  const d = currentFormData;
  const rows = d.checkRows || [];

  canvas.innerHTML = `
    <!-- 문서 상단 헤더 & 결재란 -->
    <table class="doc-header-table">
      <tr>
        <td style="width: 55%;" class="doc-title-cell">
          ${currentFormMeta.title}
        </td>
        <td style="width: 45%; padding: 0;">
          ${renderApprovalBoxHtml(d)}
        </td>
      </tr>
    </table>

    <!-- 기본 정보 메타 테이블 -->
    <table class="meta-table">
      <tr>
        <th>현 장 명</th>
        <td><input type="text" class="meta-input" value="${d.siteName || ''}" onchange="updateDataField('siteName', this.value)"></td>
        <th>현장코드</th>
        <td><input type="text" class="meta-input" value="${d.siteCode || ''}" onchange="updateDataField('siteCode', this.value)"></td>
      </tr>
      <tr>
        <th>점검일자</th>
        <td><input type="date" class="meta-input" value="${d.docDate || ''}" onchange="updateDataField('docDate', this.value)"></td>
        <th>날 씨</th>
        <td><input type="text" class="meta-input" value="${d.weather || '맑음'}" onchange="updateDataField('weather', this.value)"></td>
      </tr>
      <tr>
        <th>점 검 자</th>
        <td><input type="text" class="meta-input" value="${d.writer || ''}" onchange="updateDataField('writer', this.value)"></td>
        <th>현장소장</th>
        <td><input type="text" class="meta-input" value="${d.siteManager || ''}" onchange="updateDataField('siteManager', this.value)"></td>
      </tr>
    </table>

    <!-- 점검 항목 리스트 -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <h4 style="font-size:13px;color:#1e293b;"><i class="fa-solid fa-list-check" style="color:#0284c7;"></i> 순회 점검 결과 및 시정조치 내역</h4>
      <div class="table-btn-row" style="margin-bottom:0;">
        <button type="button" class="btn-sm-row" onclick="addCheckRow()"><i class="fa-solid fa-plus"></i> 행 추가</button>
      </div>
    </div>

    <table class="content-table" id="check-table">
      <thead>
        <tr>
          <th style="width: 5%;">No</th>
          <th style="width: 22%;">점검 위치 / 구역</th>
          <th style="width: 33%;">점검 항목 및 불안전 요소</th>
          <th style="width: 10%;">점검결과</th>
          <th style="width: 10%;">위험도</th>
          <th style="width: 20%;">시정조치 및 대책</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td class="editable-cell" contenteditable="true" onblur="updateRowField(${i}, 'area', this.innerText)">${r.area}</td>
            <td class="editable-cell" contenteditable="true" onblur="updateRowField(${i}, 'item', this.innerText)">${r.item}</td>
            <td style="text-align:center;">
              <select onchange="updateRowField(${i}, 'status', this.value)" style="border:none;background:transparent;font-size:12px;cursor:pointer;">
                <option value="적합" ${r.status==='적합'?'selected':''}>적합</option>
                <option value="보통" ${r.status==='보통'?'selected':''}>보통</option>
                <option value="부적합" ${r.status==='부적합'?'selected':''}>부적합</option>
              </select>
            </td>
            <td style="text-align:center;">
              <select onchange="updateRowField(${i}, 'risk', this.value)" style="border:none;background:transparent;font-size:12px;cursor:pointer;">
                <option value="상" ${r.risk==='상'?'selected':''}>상</option>
                <option value="중" ${r.risk==='중'?'selected':''}>중</option>
                <option value="하" ${r.risk==='하'?'selected':''}>하</option>
              </select>
            </td>
            <td class="editable-cell" contenteditable="true" onblur="updateRowField(${i}, 'action', this.innerText)">${r.action}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- 종합 의견 -->
    <div class="form-textarea-box">
      <h4><i class="fa-solid fa-comment-dots" style="color:#0284c7;"></i> 총괄 안전보건 의견 및 지시사항</h4>
      <textarea class="form-textarea" onchange="updateDataField('generalOpinion', this.value)">${d.generalOpinion || ''}</textarea>
    </div>

    <div style="font-size:11px;color:#64748b;text-align:center;margin-top:20px;border-top:1px solid #cbd5e1;padding-top:10px;">
      (주)세방테크 안전보건경영시스템 표준 양식 (ST-FR-SAFE-001) &bull; 비제어본 인쇄물
    </div>
  `;
}

// -------------------------------------------------------------
// [FORM-SAFE-02] 작업 전 안전점검(TBM) 일지 렌더링
// -------------------------------------------------------------
function renderForm02(canvas) {
  const d = currentFormData;
  const rows = d.tbmRows || [];

  canvas.innerHTML = `
    <table class="doc-header-table">
      <tr>
        <td style="width: 55%;" class="doc-title-cell">
          ${currentFormMeta.title}
        </td>
        <td style="width: 45%; padding: 0;">
          ${renderApprovalBoxHtml(d)}
        </td>
      </tr>
    </table>

    <table class="meta-table">
      <tr>
        <th>현 장 명</th>
        <td><input type="text" class="meta-input" value="${d.siteName || ''}" onchange="updateDataField('siteName', this.value)"></td>
        <th>현장코드</th>
        <td><input type="text" class="meta-input" value="${d.siteCode || ''}" onchange="updateDataField('siteCode', this.value)"></td>
      </tr>
      <tr>
        <th>실시일시</th>
        <td><input type="date" class="meta-input" value="${d.docDate || ''}" onchange="updateDataField('docDate', this.value)"></td>
        <th>TBM 리더</th>
        <td><input type="text" class="meta-input" value="${d.leader || ''}" onchange="updateDataField('leader', this.value)"></td>
      </tr>
      <tr>
        <th>작업공종</th>
        <td><input type="text" class="meta-input" value="${d.workType || ''}" onchange="updateDataField('workType', this.value)"></td>
        <th>참석인원</th>
        <td><input type="text" class="meta-input" value="${d.workerCount || ''}" onchange="updateDataField('workerCount', this.value)"> 명</td>
      </tr>
    </table>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <h4 style="font-size:13px;color:#1e293b;"><i class="fa-solid fa-triangle-exclamation" style="color:#d97706;"></i> 금일 작업별 중점 위험요인 및 안전대책 전파</h4>
      <div class="table-btn-row" style="margin-bottom:0;">
        <button type="button" class="btn-sm-row" onclick="addTbmRow()"><i class="fa-solid fa-plus"></i> 작업 추가</button>
      </div>
    </div>

    <table class="content-table">
      <thead>
        <tr>
          <th style="width: 6%;">No</th>
          <th style="width: 24%;">작업 내용</th>
          <th style="width: 35%;">핵심 위험요인</th>
          <th style="width: 35%;">안전보건 조치대책</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td class="editable-cell" contenteditable="true" onblur="updateTbmRowField(${i}, 'work', this.innerText)">${r.work}</td>
            <td class="editable-cell" contenteditable="true" onblur="updateTbmRowField(${i}, 'hazard', this.innerText)">${r.hazard}</td>
            <td class="editable-cell" contenteditable="true" onblur="updateTbmRowField(${i}, 'measure', this.innerText)">${r.measure}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="form-textarea-box">
      <h4><i class="fa-solid fa-heart-pulse" style="color:#e11d48;"></i> 작업자 건강상태 확인 및 특별 지시사항</h4>
      <textarea class="form-textarea" onchange="updateDataField('healthCheck', this.value)">${d.healthCheck || ''}</textarea>
    </div>

    <div class="form-textarea-box">
      <h4><i class="fa-solid fa-bullhorn" style="color:#0284c7;"></i> 당일 현장 기상 및 특별 전달사항</h4>
      <textarea class="form-textarea" onchange="updateDataField('specialNote', this.value)">${d.specialNote || ''}</textarea>
    </div>

    <div style="font-size:11px;color:#64748b;text-align:center;margin-top:20px;border-top:1px solid #cbd5e1;padding-top:10px;">
      (주)세방테크 안전보건경영시스템 표준 양식 (ST-FR-SAFE-002) &bull; 비제어본 인쇄물
    </div>
  `;
}

// -------------------------------------------------------------
// [FORM-SAFE-03] 현장 안전보건 관리계획서 렌더링
// -------------------------------------------------------------
function renderForm03(canvas) {
  const d = currentFormData;

  canvas.innerHTML = `
    <table class="doc-header-table">
      <tr>
        <td style="width: 55%;" class="doc-title-cell">
          ${currentFormMeta.title}
        </td>
        <td style="width: 45%; padding: 0;">
          ${renderApprovalBoxHtml(d)}
        </td>
      </tr>
    </table>

    <table class="meta-table">
      <tr>
        <th>현 장 명</th>
        <td><input type="text" class="meta-input" value="${d.siteName || ''}" onchange="updateDataField('siteName', this.value)"></td>
        <th>현장코드</th>
        <td><input type="text" class="meta-input" value="${d.siteCode || ''}" onchange="updateDataField('siteCode', this.value)"></td>
      </tr>
      <tr>
        <th>작성일자</th>
        <td><input type="date" class="meta-input" value="${d.docDate || ''}" onchange="updateDataField('docDate', this.value)"></td>
        <th>공사기간</th>
        <td><input type="text" class="meta-input" value="${d.period || ''}" onchange="updateDataField('period', this.value)"></td>
      </tr>
      <tr>
        <th>목표 재해율</th>
        <td><input type="text" class="meta-input" value="${d.targetAccidentRate || ''}" onchange="updateDataField('targetAccidentRate', this.value)"></td>
        <th>목표 무재해</th>
        <td><input type="text" class="meta-input" value="${d.targetManHour || ''}" onchange="updateDataField('targetManHour', this.value)"></td>
      </tr>
    </table>

    <div class="form-textarea-box">
      <h4><i class="fa-solid fa-shield-halved" style="color:#0284c7;"></i> 1. 현장 안전보건 방침</h4>
      <textarea class="form-textarea" style="min-height:90px;" onchange="updateDataField('policy', this.value)">${d.policy || ''}</textarea>
    </div>

    <div class="form-textarea-box">
      <h4><i class="fa-solid fa-sitemap" style="color:#0284c7;"></i> 2. 안전보건 관리조직 체계 및 직무</h4>
      <textarea class="form-textarea" style="min-height:90px;" onchange="updateDataField('organization', this.value)">${d.organization || ''}</textarea>
    </div>

    <div class="form-textarea-box">
      <h4><i class="fa-solid fa-list-check" style="color:#0284c7;"></i> 3. 중점 안전보건 추진과제 및 실행계획</h4>
      <textarea class="form-textarea" style="min-height:100px;" onchange="updateDataField('keyActionPlan', this.value)">${d.keyActionPlan || ''}</textarea>
    </div>

    <div style="font-size:11px;color:#64748b;text-align:center;margin-top:20px;border-top:1px solid #cbd5e1;padding-top:10px;">
      (주)세방테크 안전보건경영시스템 표준 양식 (ST-FR-SAFE-003) &bull; 비제어본 인쇄물
    </div>
  `;
}

// -------------------------------------------------------------
// [FORM-SAFE-04] 노·사 안전보건 협의체 회의록 렌더링
// -------------------------------------------------------------
function renderForm04(canvas) {
  const d = currentFormData;
  const items = d.agendaItems || [];

  canvas.innerHTML = `
    <table class="doc-header-table">
      <tr>
        <td style="width: 55%;" class="doc-title-cell">
          ${currentFormMeta.title}
        </td>
        <td style="width: 45%; padding: 0;">
          ${renderApprovalBoxHtml(d)}
        </td>
      </tr>
    </table>

    <table class="meta-table">
      <tr>
        <th>현 장 명</th>
        <td><input type="text" class="meta-input" value="${d.siteName || ''}" onchange="updateDataField('siteName', this.value)"></td>
        <th>현장코드</th>
        <td><input type="text" class="meta-input" value="${d.siteCode || ''}" onchange="updateDataField('siteCode', this.value)"></td>
      </tr>
      <tr>
        <th>회의일시</th>
        <td><input type="date" class="meta-input" value="${d.docDate || ''}" onchange="updateDataField('docDate', this.value)"></td>
        <th>회의장소</th>
        <td><input type="text" class="meta-input" value="${d.meetingPlace || ''}" onchange="updateDataField('meetingPlace', this.value)"></td>
      </tr>
      <tr>
        <th>사용자위원</th>
        <td><input type="text" class="meta-input" value="${d.employerAttendees || ''}" onchange="updateDataField('employerAttendees', this.value)"></td>
        <th>근로자위원</th>
        <td><input type="text" class="meta-input" value="${d.workerAttendees || ''}" onchange="updateDataField('workerAttendees', this.value)"></td>
      </tr>
    </table>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <h4 style="font-size:13px;color:#1e293b;"><i class="fa-solid fa-comments" style="color:#0284c7;"></i> 주요 심의 및 협의 의결사항</h4>
      <div class="table-btn-row" style="margin-bottom:0;">
        <button type="button" class="btn-sm-row" onclick="addAgendaRow()"><i class="fa-solid fa-plus"></i> 안건 추가</button>
      </div>
    </div>

    <table class="content-table">
      <thead>
        <tr>
          <th style="width: 8%;">No</th>
          <th style="width: 42%;">상정 안건 및 건의사항</th>
          <th style="width: 50%;">협의 결과 및 조치계획</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, i) => `
          <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td class="editable-cell" contenteditable="true" onblur="updateAgendaRowField(${i}, 'agenda', this.innerText)">${item.agenda}</td>
            <td class="editable-cell" contenteditable="true" onblur="updateAgendaRowField(${i}, 'result', this.innerText)">${item.result}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="form-textarea-box">
      <h4><i class="fa-solid fa-quote-left" style="color:#0284c7;"></i> 위원장(현장소장) 총평</h4>
      <textarea class="form-textarea" onchange="updateDataField('chairpersonRemark', this.value)">${d.chairpersonRemark || ''}</textarea>
    </div>

    <div style="font-size:11px;color:#64748b;text-align:center;margin-top:20px;border-top:1px solid #cbd5e1;padding-top:10px;">
      (주)세방테크 안전보건경영시스템 표준 양식 (ST-FR-SAFE-004) &bull; 비제어본 인쇄물
    </div>
  `;
}

// -------------------------------------------------------------
// 데이터 업데이트 & 인라인 테이블 조작
// -------------------------------------------------------------
function updateDataField(key, val) {
  if (!currentFormData) return;
  currentFormData[key] = val;
  triggerAutosave();
}

function updateRowField(index, field, val) {
  if (!currentFormData || !currentFormData.checkRows) return;
  currentFormData.checkRows[index][field] = val;
  triggerAutosave();
}

function addCheckRow() {
  if (!currentFormData || !currentFormData.checkRows) return;
  currentFormData.checkRows.push({
    area: '신규 점검 구역',
    item: '세부 점검 항목 입력',
    status: '적합',
    risk: '중',
    action: '조치 예정 내용 입력'
  });
  renderFormCanvas();
  triggerAutosave();
}

function updateTbmRowField(index, field, val) {
  if (!currentFormData || !currentFormData.tbmRows) return;
  currentFormData.tbmRows[index][field] = val;
  triggerAutosave();
}

function addTbmRow() {
  if (!currentFormData || !currentFormData.tbmRows) return;
  currentFormData.tbmRows.push({
    work: '신규 작업 공종 입력',
    hazard: '발생 가능한 위험 요인 입력',
    measure: '구체적 안전 대책 입력'
  });
  renderFormCanvas();
  triggerAutosave();
}

function updateAgendaRowField(index, field, val) {
  if (!currentFormData || !currentFormData.agendaItems) return;
  currentFormData.agendaItems[index][field] = val;
  triggerAutosave();
}

function addAgendaRow() {
  if (!currentFormData || !currentFormData.agendaItems) return;
  currentFormData.agendaItems.push({
    agenda: '신규 협의 안건 입력',
    result: '협의 결과 및 조치 일정'
  });
  renderFormCanvas();
  triggerAutosave();
}

// -------------------------------------------------------------
// 실시간 자동 캐싱 (Autosave to localStorage)
// -------------------------------------------------------------
function triggerAutosave() {
  updateAutosaveStatus('저장 중...');
  if (autosaveTimer) clearTimeout(autosaveTimer);

  autosaveTimer = setTimeout(() => {
    if (!currentFormMeta || !currentFormData) return;
    const cacheKey = 'sebang_form_draft_' + currentFormMeta.id;
    const payload = {
      savedAt: new Date().toISOString(),
      formId: currentFormMeta.id,
      data: currentFormData
    };
    try {
      localStorage.setItem(cacheKey, JSON.stringify(payload));
      updateAutosaveStatus('자동저장됨 (' + new Date().toLocaleTimeString() + ')');
    } catch (e) {
      updateAutosaveStatus('저장 실패');
    }
  }, 600);
}

function updateAutosaveStatus(msg) {
  const el = document.getElementById('autosave-status');
  if (el) {
    el.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> ${msg}`;
  }
}

// 로컬 캐시 존재 시 복원 여부 확인
function checkDraftCache(formId) {
  const cacheKey = 'sebang_form_draft_' + formId;
  const cached = localStorage.getItem(cacheKey);
  if (!cached) return;

  try {
    const parsed = JSON.parse(cached);
    if (parsed && parsed.data) {
      const timeStr = new Date(parsed.savedAt).toLocaleString();
      if (confirm(`작성 중이던 임시 저장본(${timeStr})이 있습니다.\n복원하시겠습니까?`)) {
        currentFormData = parsed.data;
        updateAutosaveStatus('캐시 복원됨');
      }
    }
  } catch (e) {}
}

// [초기화]
async function resetToTemplate() {
  if (!confirm('작성 중인 내용을 초기화하고 본사 기본 서식으로 되돌리시겠습니까?')) return;
  if (currentFormMeta) {
    localStorage.removeItem('sebang_form_draft_' + currentFormMeta.id);
    await selectForm(currentFormMeta.id);
  }
}

// [캐시 복원 수동 실행]
function restoreDraftCache() {
  if (!currentFormMeta) return;
  const cacheKey = 'sebang_form_draft_' + currentFormMeta.id;
  const cached = localStorage.getItem(cacheKey);
  if (!cached) {
    alert('임시 저장된 캐시 데이터가 없습니다.');
    return;
  }
  try {
    const parsed = JSON.parse(cached);
    currentFormData = parsed.data;
    renderFormCanvas();
    alert('캐시 본이 정상 복원되었습니다.');
  } catch (e) {
    alert('캐시 복원에 실패했습니다.');
  }
}

// -------------------------------------------------------------
// [JSON 다운로드 & 파일 불러오기]
// -------------------------------------------------------------
function downloadAsJson() {
  if (!currentFormMeta || !currentFormData) return;

  const siteCode = currentFormData.siteCode || 'SITE';
  const docDate = currentFormData.docDate || new Date().toISOString().split('T')[0];
  const safeTitle = currentFormMeta.title.replace(/\s+/g, '_');
  const filename = `${siteCode}_${safeTitle}_${docDate}.json`;

  const exportObj = {
    fileType: 'SEBANG_KOSHA_FORM_INSTANCE',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    formMeta: {
      id: currentFormMeta.id,
      title: currentFormMeta.title,
      docNumber: currentFormMeta.docNumber,
      version: currentFormMeta.version
    },
    formData: currentFormData
  };

  const jsonStr = JSON.stringify(exportObj, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerImportJson() {
  const fileInput = document.getElementById('json-file-input');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

function handleJsonFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.formData || !parsed.formMeta) {
        alert('올바른 세방테크 KOSHA-MS 서식 JSON 파일이 아닙니다.');
        return;
      }

      currentFormMeta = parsed.formMeta;
      currentFormData = parsed.formData;
      renderFormCanvas();
      renderFormsNav();
      triggerAutosave();
      alert(`[${parsed.formMeta.title}] 파일이 정상적으로 로드되었습니다.`);
    } catch (err) {
      alert('JSON 파일을 파싱할 수 없습니다: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// -------------------------------------------------------------
// [A4 PDF 인쇄 / 출력]
// -------------------------------------------------------------
function printCurrentForm() {
  if (!currentFormMeta || !currentFormData) return;

  // 인쇄 로그 기록
  const user = AUTH.getUser();
  const userEmail = user ? user.email : '비회원(현장작성)';
  API.logPrint(currentFormMeta.docNumber, currentFormMeta.title, userEmail);

  // 브라우저 인쇄 실행 (CSS print 미디어 쿼리가 A4로 서식 출력)
  window.print();
}

// -------------------------------------------------------------
// [신규 양식 등록 및 결재선 설정 모달 로직]
// -------------------------------------------------------------
let currentModalApprovalLine = [];

function openNewFormModal() {
  const modal = document.getElementById('new-form-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  // 기본값 설정
  document.getElementById('modal-base-template').value = 'FORM-SAFE-01';
  document.getElementById('modal-new-title').value = '';
  document.getElementById('modal-new-category').value = 'CHECK';

  // 기본 선택: 안전관리자 기안형 (2단)
  const radio = document.querySelector('input[name="approval-preset"][value="safety-manager"]');
  if (radio) radio.checked = true;
  onApprovalPresetChange('safety-manager');
}

function closeNewFormModal() {
  const modal = document.getElementById('new-form-modal');
  if (modal) modal.style.display = 'none';
}

function onBaseTemplateChanged(baseId) {
  const titleInput = document.getElementById('modal-new-title');
  const catSelect = document.getElementById('modal-new-category');
  if (!titleInput.value) {
    if (baseId === 'FORM-SAFE-01') {
      titleInput.placeholder = '예: 현장소장 일일 안전보건 지시서';
      catSelect.value = 'CHECK';
    } else if (baseId === 'FORM-SAFE-02') {
      titleInput.placeholder = '예: 용접 및 고소작업 특별 TBM 일지';
      catSelect.value = 'TBM';
    } else if (baseId === 'FORM-SAFE-03') {
      titleInput.placeholder = '예: 분기별 현장 안전보건 실행계획서';
      catSelect.value = 'PLAN';
    } else if (baseId === 'FORM-SAFE-04') {
      titleInput.placeholder = '예: 협력업체 합동 안전보건 간담회 회의록';
      catSelect.value = 'MEETING';
    }
  }
}

function onApprovalPresetChange(preset) {
  const customEditor = document.getElementById('custom-approval-editor');
  if (customEditor) {
    customEditor.style.display = (preset === 'custom') ? 'block' : 'none';
  }

  if (preset === 'safety-manager') {
    // 안전(작성) ➔ 소장(승인)
    currentModalApprovalLine = [
      { role: '작 성', name: '안전관리자' },
      { role: '승 인', name: '{{SITE_MANAGER}}' }
    ];
  } else if (preset === 'director-sole') {
    // 소장(작성, 전결)
    currentModalApprovalLine = [
      { role: '작성 / 전결', name: '{{SITE_MANAGER}}' }
    ];
  } else if (preset === 'standard-3') {
    // 작성 ➔ 검토 ➔ 승인
    currentModalApprovalLine = [
      { role: '작 성', name: '{{WRITER}}' },
      { role: '검 토', name: '공사팀장' },
      { role: '승 인', name: '{{SITE_MANAGER}}' }
    ];
  } else if (preset === 'council-3') {
    // 간사 ➔ 근로자대표 ➔ 위원장
    currentModalApprovalLine = [
      { role: '간 사', name: '안전관리자' },
      { role: '근로자대표', name: '근로자대표' },
      { role: '위원장', name: '{{SITE_MANAGER}}' }
    ];
  } else if (preset === 'custom') {
    if (!currentModalApprovalLine || currentModalApprovalLine.length === 0) {
      currentModalApprovalLine = [
        { role: '작 성', name: '담당자' },
        { role: '승 인', name: '{{SITE_MANAGER}}' }
      ];
    }
    renderCustomApprovalCols();
  }

  updateApprovalPreview();
}

function updateApprovalPreview() {
  const previewBox = document.getElementById('approval-preview-box');
  if (!previewBox) return;

  const site = AUTH.getSelectedSite() || { siteManager: '현장소장' };
  const mockData = {
    approvalLine: currentModalApprovalLine,
    writer: '작성자',
    siteManager: site.siteManager || site.manager || '현장소장'
  };

  previewBox.innerHTML = renderApprovalBoxHtml(mockData);
}

function renderCustomApprovalCols() {
  const container = document.getElementById('custom-approval-cols');
  if (!container) return;

  container.innerHTML = currentModalApprovalLine.map((item, idx) => `
    <div style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:6px 8px;display:flex;flex-direction:column;gap:4px;width:110px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;font-weight:600;color:#64748b;">${idx + 1}단계</span>
        ${currentModalApprovalLine.length > 1 ? `<button type="button" onclick="removeCustomApprovalCol(${idx})" style="border:none;background:none;color:#ef4444;cursor:pointer;font-size:12px;">&times;</button>` : ''}
      </div>
      <input type="text" value="${item.role}" placeholder="직책/구분" oninput="currentModalApprovalLine[${idx}].role = this.value; updateApprovalPreview();" style="width:100%;padding:3px 6px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;box-sizing:border-box;">
      <input type="text" value="${item.name}" placeholder="성명/호칭" oninput="currentModalApprovalLine[${idx}].name = this.value; updateApprovalPreview();" style="width:100%;padding:3px 6px;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;box-sizing:border-box;">
    </div>
  `).join('');
}

function addCustomApprovalCol() {
  if (currentModalApprovalLine.length >= 4) {
    alert('결재선은 최대 4단계까지 추가할 수 있습니다.');
    return;
  }
  currentModalApprovalLine.push({ role: '검 토', name: '공사팀장' });
  renderCustomApprovalCols();
  updateApprovalPreview();
}

function removeCustomApprovalCol(idx) {
  currentModalApprovalLine.splice(idx, 1);
  renderCustomApprovalCols();
  updateApprovalPreview();
}

async function saveNewFormFromModal() {
  const baseId = document.getElementById('modal-base-template').value;
  const title = document.getElementById('modal-new-title').value.trim();
  const category = document.getElementById('modal-new-category').value;

  if (!title) {
    alert('새로운 서식 제목을 입력해 주세요.');
    document.getElementById('modal-new-title').focus();
    return;
  }

  try {
    const baseTemplate = await API.getForm(baseId);
    const newId = 'FORM-CUSTOM-' + Date.now();
    const docNumber = 'ST-FR-CUST-' + String(allFormsList.length + 1).padStart(3, '0');

    const catNameMap = {
      CHECK: '안전점검',
      TBM: 'TBM·위험성평가',
      PLAN: '안전계획',
      MEETING: '협의체·회의'
    };

    const newFormObj = {
      id: newId,
      baseTemplateId: baseId,
      category: category,
      categoryName: catNameMap[category] || '맞춤서식',
      title: title,
      docNumber: docNumber,
      version: 'Rev.1',
      effectiveDate: new Date().toISOString().split('T')[0],
      department: '품질안전보건실',
      description: title + ' (맞춤 결재선 서식)',
      approvalLine: currentModalApprovalLine,
      defaultData: JSON.parse(JSON.stringify(baseTemplate.defaultData || {}))
    };
    newFormObj.defaultData.approvalLine = currentModalApprovalLine;

    const res = await API.saveForm(newFormObj);
    if (res.success) {
      alert(`[${title}] 양식이 표준서식 라이브러리에 등록되었습니다!\n결재선: ${currentModalApprovalLine.map(c => c.role).join(' ➔ ')}`);
      closeNewFormModal();
      await loadFormsList();
      await selectForm(newId);
    } else {
      alert('서식 저장 실패: ' + (res.message || '알 수 없는 오류'));
    }
  } catch (e) {
    alert('서식 등록 중 오류 발생: ' + e.message);
  }
}
