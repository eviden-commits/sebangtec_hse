// 불변 최고 관리자 명단 (Super Admins)
const SUPER_ADMINS = ['nschoi@sebangtec.com', 'sb06@sebangtec.com'];

const AUTH = {
  isGatePassed() {
    return sessionStorage.getItem('sebang_gate_passed') === 'true';
  },

  setGatePassed() {
    sessionStorage.setItem('sebang_gate_passed', 'true');
  },

  getUser() {
    try {
      const data = localStorage.getItem('sebang_auth_user');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  setUser(user) {
    localStorage.setItem('sebang_auth_user', JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem('sebang_auth_user');
    alert('로그아웃 되었습니다.');
    location.reload();
  },

  isSuperAdmin() {
    const user = this.getUser();
    if (!user || !user.email) return false;
    return user.isSuperAdmin === true || SUPER_ADMINS.includes(user.email.trim().toLowerCase());
  },

  isAdmin() {
    const user = this.getUser();
    if (!user || !user.email) return false;
    return this.isSuperAdmin() || user.isAdmin === true;
  },

  getSelectedSite() {
    const user = this.getUser();
    if (user && user.site) return user.site;
    try {
      const stored = localStorage.getItem('sebang_selected_site');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  },

  setSelectedSite(site) {
    if (!site) return;
    localStorage.setItem('sebang_selected_site', JSON.stringify(site));
    const user = this.getUser();
    if (user) {
      user.site = site;
      this.setUser(user);
    }
    renderUserStatus();
    if (typeof window.onSiteChanged === 'function') {
      window.onSiteChanged(site);
    }
  }
};

// 사이트 초기 접속 비밀번호 확인 (Gatekeeper)
function checkGateAccess() {
  const gateModal = document.getElementById('gate-modal');
  if (!gateModal) return;

  if (AUTH.isGatePassed()) {
    gateModal.style.display = 'none';
  } else {
    gateModal.style.display = 'flex';
    const pwdInput = document.getElementById('gate-password');
    if (pwdInput) {
      setTimeout(() => pwdInput.focus(), 100);
    }
  }
}

// 비밀번호 검증 제출
async function submitGatePassword() {
  const input = document.getElementById('gate-password');
  const errorMsg = document.getElementById('gate-error-msg');
  const btn = document.querySelector('.btn-gate-submit');
  const pwd = input.value.trim();

  if (!pwd) {
    if (errorMsg) errorMsg.innerText = '비밀번호를 입력해 주십시오.';
    return;
  }

  if (errorMsg) errorMsg.innerText = '보안 인증 확인 중...';
  if (btn) btn.disabled = true;

  try {
    const res = await API.verifyGatePassword(pwd);
    if (res.success) {
      AUTH.setGatePassed();
      const gateModal = document.getElementById('gate-modal');
      if (gateModal) {
        gateModal.style.opacity = '0';
        gateModal.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
          gateModal.style.display = 'none';
        }, 300);
      }
    } else {
      if (errorMsg) errorMsg.innerText = res.message || '비밀번호가 올바르지 않습니다.';
      input.value = '';
      input.focus();
    }
  } catch (err) {
    if (errorMsg) errorMsg.innerText = '인증 서버(Google Apps Script) 통신 오류가 발생했습니다.';
  } finally {
    if (btn) btn.disabled = false;
  }
}

// 상단 상태 영역 갱신
function renderUserStatus() {
  const area = document.getElementById('user-status-area');
  if (!area) return;

  const site = AUTH.getSelectedSite();
  let siteBadge = '';
  if (site) {
    const sMgr = site.siteManager || site.manager || '미지정';
    const sSafety = site.safetyManager || '미지정';
    siteBadge = `<span class="site-badge" onclick="openSiteSelectModal()" title="소속 현장 변경 (클릭)&#10;• 현장소장: ${escapeHtml(sMgr)}&#10;• 안전관리자: ${escapeHtml(sSafety)}" style="background:#e0f2fe;color:#0369a1;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;border:1px solid #bae6fd;cursor:pointer;margin-right:8px;display:inline-flex;align-items:center;gap:4px;"><i class="fa-solid fa-location-dot" style="color:#0284c7;"></i> ${escapeHtml(site.siteName)} <span style="font-size:10px;color:#0284c7;text-decoration:underline;">(변경)</span></span>`;
  } else {
    siteBadge = `<span class="site-badge" onclick="openSiteSelectModal()" title="소속 현장 선택 (클릭)" style="background:#f1f5f9;color:#64748b;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;border:1px dashed #cbd5e1;cursor:pointer;margin-right:8px;display:inline-flex;align-items:center;gap:4px;"><i class="fa-solid fa-location-dot" style="color:#94a3b8;"></i> 현장 선택 <span style="font-size:10px;color:#0284c7;text-decoration:underline;">(설정)</span></span>`;
  }

  const user = AUTH.getUser();
  if (user) {
    let adminBtn = '';
    let sigBtn = '';
    let roleBadge = '';
    if (AUTH.isSuperAdmin()) {
      roleBadge = `<span style="background:#fff3bf;color:#d9480f;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:700;border:1px solid #ffd43b;margin-right:6px;"><i class="fa-solid fa-crown"></i> 최고 관리자</span>`;
      adminBtn = `<button class="btn-text" style="color:#d9480f;font-weight:bold;" onclick="openAdminModal()"><i class="fa-solid fa-gear"></i> 관리자 설정</button>`;
      sigBtn = `<button class="btn-text" style="color:#0369a1;font-weight:bold;margin-left:6px;" onclick="openSignatureManagerModal()" title="임원 및 관리자 결재 서명 관리"><i class="fa-solid fa-signature"></i> 서명 관리</button>`;
    } else if (AUTH.isAdmin()) {
      roleBadge = `<span style="background:#e7f5ff;color:#1864ab;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;border:1px solid #a5d8ff;margin-right:6px;"><i class="fa-solid fa-user-shield"></i> 관리자</span>`;
      sigBtn = `<button class="btn-text" style="color:#0369a1;font-weight:bold;margin-left:6px;" onclick="openSignatureManagerModal()" title="임원 및 관리자 결재 서명 관리"><i class="fa-solid fa-signature"></i> 서명 관리</button>`;
    }
    area.innerHTML = `
      ${siteBadge}
      ${roleBadge}
      <span style="color:#2b8a3e;font-weight:600;"><i class="fa-solid fa-circle-check"></i> ${user.email}</span>
      ${adminBtn}
      ${sigBtn}
      <button class="btn-text" onclick="AUTH.logout()"><i class="fa-solid fa-right-from-bracket"></i> 로그아웃</button>
    `;

    // 관리자 전용 버튼들 노출
    document.querySelectorAll('.admin-only').forEach(el => {
      if (AUTH.isAdmin()) el.style.display = 'inline-flex';
    });
  } else {
    area.innerHTML = `
      ${siteBadge}
      <button class="btn-text" onclick="openLoginModal()"><i class="fa-solid fa-user"></i> 로그인</button>
    `;
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = 'none';
    });
  }
}

// -------------------------------------------------------------
// 현장 선택 모달 (최초 로그인 및 현장 변경 시 사용)
// -------------------------------------------------------------
let allModalSites = [];

async function openSiteSelectModal() {
  ensureSiteSelectModal();
  const modal = document.getElementById('site-select-modal');
  if (modal) {
    modal.style.display = 'flex';
    try {
      allModalSites = await API.getSites();
      renderSiteSelectList('');
      const searchInput = document.getElementById('site-search-input');
      if (searchInput) {
        searchInput.value = '';
        setTimeout(() => searchInput.focus(), 100);
      }
    } catch (e) {
      console.error('현장 목록 로드 실패:', e);
    }
  }
}

function closeSiteSelectModal() {
  const modal = document.getElementById('site-select-modal');
  if (modal) modal.style.display = 'none';
}

function filterSiteSelectList() {
  const input = document.getElementById('site-search-input');
  const query = input ? input.value.trim().toLowerCase() : '';
  renderSiteSelectList(query);
}

function renderSiteSelectList(query) {
  const listEl = document.getElementById('site-select-list');
  if (!listEl) return;

  const currentSite = AUTH.getSelectedSite();
  const currentCode = currentSite ? (currentSite.siteCode || currentSite.code) : '';

  let filtered = allModalSites;
  if (query) {
    filtered = allModalSites.filter(s => {
      const sName = (s.name || s.siteName || '').toLowerCase();
      const sCode = (s.code || s.siteCode || '').toLowerCase();
      const managers = (s.managers || []).map(m => m.toLowerCase());
      const sMgr = (s.manager || '').toLowerCase();
      const safetyManagers = (s.safetyManagers || []).map(m => m.toLowerCase());
      const sSafety = (s.safetyManager || '').toLowerCase();
      return sName.includes(query) || sCode.includes(query) ||
             managers.some(m => m.includes(query)) || sMgr.includes(query) ||
             safetyManagers.some(m => m.includes(query)) || sSafety.includes(query);
    });
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8;">일치하는 현장이 없습니다.</div>';
    return;
  }

  listEl.innerHTML = filtered.map(s => {
    const sName = s.name || s.siteName || '현장명 없음';
    const sCode = s.code || s.siteCode || '';
    const isSelected = sCode && sCode === currentCode;
    
    // 현장소장 및 안전관리자 상태 문자열
    const hasMgr = (s.managers && s.managers.length > 0 && s.managers[0]) || (s.manager && s.manager.trim());
    const managersStr = hasMgr
      ? `<strong style="color:#0f172a;">${escapeHtml(s.managers && s.managers.length > 0 ? s.managers.join(', ') : s.manager)}</strong>`
      : `<span style="color:#ef4444; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> 미지정 (선택 시 필수 입력)</span>`;

    const hasSafety = (s.safetyManagers && s.safetyManagers.length > 0 && s.safetyManagers[0]) || (s.safetyManager && s.safetyManager.trim());
    const safetyStr = hasSafety
      ? `<strong style="color:#0f172a;">${escapeHtml(s.safetyManagers && s.safetyManagers.length > 0 ? s.safetyManagers.join(', ') : s.safetyManager)}</strong>`
      : `<span style="color:#ef4444; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> 미지정 (선택 시 필수 입력)</span>`;

    return `
      <div onclick="selectSiteFromModal('${sCode}')" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid ${isSelected ? '#0284c7' : '#e2e8f0'};border-radius:8px;background:${isSelected ? '#f0f9ff' : '#ffffff'};cursor:pointer;transition:all 0.15s ease;" onmouseover="this.style.borderColor='#38bdf8';this.style.background='#f8fafc';" onmouseout="this.style.borderColor='${isSelected ? '#0284c7' : '#e2e8f0'}';this.style.background='${isSelected ? '#f0f9ff' : '#ffffff'}';">
        <div style="flex:1;">
          <div style="font-weight:600;font-size:14px;color:#1e293b;display:flex;align-items:center;gap:6px;">
            <span>${escapeHtml(sName)}</span>
            <span style="font-size:11px;background:#e2e8f0;color:#475569;padding:1px 6px;border-radius:4px;font-weight:500;">${escapeHtml(sCode)}</span>
            ${isSelected ? '<span style="font-size:11px;background:#0284c7;color:#fff;padding:1px 6px;border-radius:4px;font-weight:600;">선택됨</span>' : ''}
          </div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;display:flex;gap:14px;flex-wrap:wrap;">
            <span><i class="fa-solid fa-user-tie" style="font-size:11px;color:#0284c7;"></i> 현장소장: ${managersStr}</span>
            <span><i class="fa-solid fa-user-shield" style="font-size:11px;color:#16a34a;"></i> 안전관리자: ${safetyStr}</span>
          </div>
        </div>
        <button type="button" style="padding:6px 12px;border:1px solid ${isSelected ? '#0284c7' : '#cbd5e1'};background:${isSelected ? '#0284c7' : '#fff'};color:${isSelected ? '#fff' : '#334155'};border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;margin-left:10px;">
          ${isSelected ? '선택됨' : '선택'}
        </button>
      </div>
    `;
  }).join('');
}

async function selectSiteFromModal(siteCode) {
  const target = allModalSites.find(s => (s.code === siteCode || s.siteCode === siteCode));
  if (!target) return;

  const siteName = target.name || target.siteName || '선택 현장';

  // 1. 현장소장 확인 (비어있는 경우 무조건 필수 입력 받기)
  let siteManager = (target.managers && target.managers.length > 0 && target.managers[0])
    ? target.managers[0]
    : (target.manager || '');

  while (!siteManager || !siteManager.trim()) {
    const inputMgr = prompt(`[${siteName}]\n선택하신 현장은 '현장소장' 정보가 등록되어 있지 않습니다.\n\n현장소장의 성명을 입력해 주십시오 (필수값):`);
    if (inputMgr === null) {
      alert('현장소장 성명 입력이 취소되어 현장 선택을 완료할 수 없습니다.');
      return;
    }
    siteManager = inputMgr.trim();
    if (!siteManager) {
      alert('현장소장 성명은 필수 입력 항목입니다.');
    }
  }

  // 2. 안전관리자 확인 (비어있는 경우 무조건 필수 입력 받기)
  let safetyManager = (target.safetyManagers && target.safetyManagers.length > 0 && target.safetyManagers[0])
    ? target.safetyManagers[0]
    : (target.safetyManager || '');

  while (!safetyManager || !safetyManager.trim()) {
    const inputSafety = prompt(`[${siteName}]\n선택하신 현장은 '안전관리자' 정보가 등록되어 있지 않습니다.\n\n안전관리자의 성명을 입력해 주십시오 (필수값):`);
    if (inputSafety === null) {
      alert('안전관리자 성명 입력이 취소되어 현장 선택을 완료할 수 없습니다.');
      return;
    }
    safetyManager = inputSafety.trim();
    if (!safetyManager) {
      alert('안전관리자 성명은 필수 입력 항목입니다.');
    }
  }

  // 신규 입력된 정보가 있다면 현장 데이터(sites.json)에 즉시 동기화 저장
  let needSave = false;
  if (!target.managers || target.managers.length === 0 || target.managers[0] !== siteManager) {
    target.managers = [siteManager];
    target.manager = siteManager;
    needSave = true;
  }
  if (!target.safetyManagers || target.safetyManagers.length === 0 || target.safetyManagers[0] !== safetyManager) {
    target.safetyManagers = [safetyManager];
    target.safetyManager = safetyManager;
    needSave = true;
  }

  if (needSave) {
    try {
      await API.saveSites(allModalSites);
      // 관리자 캐시도 동기화
      if (typeof cachedAdminSites !== 'undefined') {
        cachedAdminSites = allModalSites;
      }
    } catch (e) {
      console.warn('현장 정보 자동 저장 실패:', e);
    }
  }

  const siteObj = {
    siteCode: target.code || target.siteCode,
    siteName: siteName,
    siteManager: siteManager,
    safetyManager: safetyManager
  };

  AUTH.setSelectedSite(siteObj);
  closeSiteSelectModal();
  alert(`[${siteObj.siteName}] 현장으로 설정되었습니다.\n\n• 현장소장: ${siteObj.siteManager}\n• 안전관리자: ${siteObj.safetyManager}`);
}

function ensureSiteSelectModal() {
  if (document.getElementById('site-select-modal')) return;
  const modalHtml = `
  <div id="site-select-modal" class="modal-backdrop" style="display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;">
    <div class="modal-dialog" style="background:#fff;border-radius:12px;max-width:580px;width:92vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 25px -5px rgba(0,0,0,0.2);">
      <div class="modal-header" style="padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;background:#f8fafc;">
        <h3 style="margin:0;font-size:17px;color:#1e293b;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-map-location-dot" style="color:#0284c7;"></i> 소속 현장 선택</h3>
        <button class="btn-close" onclick="closeSiteSelectModal()" style="border:none;background:none;font-size:22px;cursor:pointer;color:#64748b;">&times;</button>
      </div>
      <div class="modal-body" style="padding:16px 20px;overflow-y:auto;">
        <p style="margin:0 0 12px 0;font-size:13px;color:#64748b;">소속된 공사 현장을 선택하세요. 서식 및 보고서 작성 시 현장명과 현장소장 정보가 자동으로 반영됩니다.</p>
        <div style="margin-bottom:12px;position:relative;">
          <input type="text" id="site-search-input" placeholder="현장명, 현장코드, 소장명 검색..." oninput="filterSiteSelectList()" style="width:100%;padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;">
        </div>
        <div id="site-select-list" style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
          <!-- 현장 목록 렌더링 -->
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// 모달 제어
function openLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.style.display = 'flex';
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.style.display = 'none';
}

// OTP 발송 요청
async function sendOtp() {
  const emailInput = document.getElementById('login-email');
  const email = emailInput.value.trim();

  if (!email) {
    alert('이메일 주소를 입력해 주세요.');
    return;
  }

  // 도메인 검증
  if (!email.endsWith('@sebangtec.com')) {
    alert('허용되지 않은 도메인입니다.\n(주)세방테크 임직원 전용(@sebangtec.com) 메일만 이용 가능합니다.');
    return;
  }

  try {
    const btn = document.getElementById('btn-send-otp');
    btn.disabled = true;
    btn.innerText = '발송 중...';

    const res = await API.requestOtp(email);
    btn.disabled = false;
    btn.innerText = '재발송';

    if (res.success) {
      document.getElementById('group-otp').style.display = 'block';
      const msgBox = document.getElementById('otp-status-msg');
      msgBox.style.color = '#1864ab';
      // 로컬 개발 모드 안내
      msgBox.innerHTML = `인증번호가 발송되었습니다.<br><small style="color:#d9480f;">[로컬 테스트 모드] 콘솔 또는 화면 인증번호: <strong>${res.devOtp}</strong></small>`;
      document.getElementById('login-otp').value = res.devOtp || '';
      document.getElementById('login-otp').focus();
    } else {
      alert(res.message || 'OTP 발송에 실패했습니다.');
    }
  } catch (e) {
    alert('서버 통신 오류가 발생했습니다.');
  }
}

// OTP 최종 검증
async function verifyOtp() {
  const email = document.getElementById('login-email').value.trim();
  const otp = document.getElementById('login-otp').value.trim();

  if (!otp) {
    alert('인증번호를 입력하세요.');
    return;
  }

  try {
    const res = await API.verifyOtp(email, otp);
    if (res.success) {
      AUTH.setUser({
        email: res.email,
        isAdmin: res.isAdmin,
        token: res.token
      });
      alert(`환영합니다, ${res.email} 님! (권한: ${res.isAdmin ? '관리자' : '일반 사용자'})`);
      closeLoginModal();
      renderUserStatus();
      if (typeof onLoginSuccess === 'function') onLoginSuccess();
      if (!AUTH.getSelectedSite()) {
        setTimeout(openSiteSelectModal, 300);
      }
    } else {
      alert(res.message || '인증번호가 일치하지 않습니다.');
    }
  } catch (e) {
    alert('인증 처리 중 오류가 발생했습니다.');
  }
}

// 관리자 관리 모달 제어
async function openAdminModal() {
  if (!AUTH.isAdmin()) {
    alert('관리자 권한이 필요합니다.');
    return;
  }
  const modal = document.getElementById('admin-modal');
  if (modal) {
    modal.style.display = 'flex';
    // 기본으로 표준 규정 탭 활성화
    switchAdminTab('docs');
  }
}

function closeAdminModal() {
  const modal = document.getElementById('admin-modal');
  if (modal) modal.style.display = 'none';
}

// 관리자 모달 탭 전환 ('docs': 규정 제·개정 관리, 'sites': 현장 및 현장소장 관리, 'accounts': 계정 권한 관리, 'traffic': 접속자 & 유입경로 통계)
function switchAdminTab(tabName) {
  const tabDocs = document.getElementById('admin-tab-pane-docs');
  const tabSites = document.getElementById('admin-tab-pane-sites');
  const tabAccounts = document.getElementById('admin-tab-pane-accounts');
  const tabTraffic = document.getElementById('admin-tab-pane-traffic');
  const btnDocs = document.getElementById('tab-btn-docs');
  const btnSites = document.getElementById('tab-btn-sites');
  const btnAccounts = document.getElementById('tab-btn-accounts');
  const btnTraffic = document.getElementById('tab-btn-traffic');

  // 전체 패널 숨김
  if (tabDocs) tabDocs.style.display = 'none';
  if (tabSites) tabSites.style.display = 'none';
  if (tabAccounts) tabAccounts.style.display = 'none';
  if (tabTraffic) tabTraffic.style.display = 'none';

  // 탭 버튼 스타일 초기화
  [btnDocs, btnSites, btnAccounts, btnTraffic].forEach(btn => {
    if (btn) {
      btn.style.fontWeight = '600';
      btn.style.color = '#64748b';
      btn.style.borderBottom = 'none';
    }
  });

  if (tabName === 'docs') {
    if (tabDocs) tabDocs.style.display = 'block';
    if (btnDocs) {
      btnDocs.style.fontWeight = '700';
      btnDocs.style.color = 'var(--primary, #194a9a)';
      btnDocs.style.borderBottom = '2px solid var(--primary, #194a9a)';
    }
    renderAdminDocList();
  } else if (tabName === 'sites') {
    if (tabSites) tabSites.style.display = 'block';
    if (btnSites) {
      btnSites.style.fontWeight = '700';
      btnSites.style.color = 'var(--primary, #194a9a)';
      btnSites.style.borderBottom = '2px solid var(--primary, #194a9a)';
    }
    renderAdminSiteList(true);
  } else if (tabName === 'traffic') {
    if (tabTraffic) tabTraffic.style.display = 'block';
    if (btnTraffic) {
      btnTraffic.style.fontWeight = '700';
      btnTraffic.style.color = 'var(--primary, #194a9a)';
      btnTraffic.style.borderBottom = '2px solid var(--primary, #194a9a)';
    }
    renderTrafficTab();
  } else {
    if (tabAccounts) tabAccounts.style.display = 'block';
    if (btnAccounts) {
      btnAccounts.style.fontWeight = '700';
      btnAccounts.style.color = 'var(--primary, #194a9a)';
      btnAccounts.style.borderBottom = '2px solid var(--primary, #194a9a)';
    }
    loadAdminList();
  }
}

// -------------------------------------------------------------
// [현장 및 현장소장 관리 로직 (2026 현장목록 파싱 연동)]
// -------------------------------------------------------------
let cachedAdminSites = [];

// 현장 목록 렌더링
async function renderAdminSiteList(fetchFromApi = true) {
  const tbody = document.getElementById('admin-site-list-tbody');
  const badge = document.getElementById('site-count-badge');
  if (!tbody) return;

  if (fetchFromApi || cachedAdminSites.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:25px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> 현장 및 현장소장/안전관리자 목록을 불러오는 중...</td></tr>`;
    try {
      cachedAdminSites = await API.getSites();
    } catch (e) {
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:25px; color:#ef4444;">현장 목록을 불러오지 못했습니다.</td></tr>`;
      return;
    }
  }

  // 검색어 필터링 (코드, 현장명, 소장, 안전관리자)
  const searchInput = document.getElementById('admin-site-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let filtered = cachedAdminSites;
  if (query) {
    filtered = cachedAdminSites.filter(s => {
      const code = (s.code || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      const mgrStr = (s.managers || []).join(' ').toLowerCase() + ' ' + (s.manager || '').toLowerCase();
      const safetyStr = (s.safetyManagers || []).join(' ').toLowerCase() + ' ' + (s.safetyManager || '').toLowerCase();
      return code.includes(query) || name.includes(query) || mgrStr.includes(query) || safetyStr.includes(query);
    });
  }

  // 통계 뱃지 업데이트
  if (badge) {
    const assignedMgrCount = cachedAdminSites.filter(s => (s.managers && s.managers.length > 0 && s.managers[0]) || (s.manager && s.manager.trim())).length;
    const assignedSafetyCount = cachedAdminSites.filter(s => (s.safetyManagers && s.safetyManagers.length > 0 && s.safetyManagers[0]) || (s.safetyManager && s.safetyManager.trim())).length;
    badge.innerText = `총 ${cachedAdminSites.length}개 현장 (소장 지정: ${assignedMgrCount}개 / 안전관리자 지정: ${assignedSafetyCount}개)`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:25px; color:#64748b;">일치하는 현장이 없습니다.</td></tr>`;
    return;
  }

  let html = '';
  filtered.forEach(site => {
    // 1. 현장소장 뱃지
    const managers = site.managers || (site.manager ? [site.manager] : []);
    let mgrBadgesHtml = '';
    if (managers.length === 0 || !managers[0]) {
      mgrBadgesHtml = '<span style="color:#ef4444; font-size:12px; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> 미지정 (필수)</span>';
    } else {
      managers.forEach(m => {
        if (!m) return;
        mgrBadgesHtml += `
          <span style="background:#f1f5f9; border:1px solid #cbd5e1; padding:2px 8px; border-radius:12px; font-size:12px; display:inline-flex; align-items:center; gap:4px; margin:2px;">
            <i class="fa-solid fa-user-tie" style="color:#0284c7; font-size:11px;"></i>
            <strong>${escapeHtml(m)}</strong>
            <button type="button" onclick="removeSiteManager('${escapeHtml(site.id)}', '${escapeHtml(m)}')" title="현장소장 삭제" style="border:none; background:none; color:#ef4444; font-size:14px; cursor:pointer; padding:0 2px; line-height:1; font-weight:bold;">&times;</button>
          </span>
        `;
      });
    }

    // 2. 안전관리자 뱃지
    const safetyManagers = site.safetyManagers || (site.safetyManager ? [site.safetyManager] : []);
    let safetyBadgesHtml = '';
    if (safetyManagers.length === 0 || !safetyManagers[0]) {
      safetyBadgesHtml = '<span style="color:#ef4444; font-size:12px; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> 미지정 (필수)</span>';
    } else {
      safetyManagers.forEach(sm => {
        if (!sm) return;
        safetyBadgesHtml += `
          <span style="background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; padding:2px 8px; border-radius:12px; font-size:12px; display:inline-flex; align-items:center; gap:4px; margin:2px;">
            <i class="fa-solid fa-user-shield" style="color:#16a34a; font-size:11px;"></i>
            <strong>${escapeHtml(sm)}</strong>
            <button type="button" onclick="removeSiteSafetyManager('${escapeHtml(site.id)}', '${escapeHtml(sm)}')" title="안전관리자 삭제" style="border:none; background:none; color:#ef4444; font-size:14px; cursor:pointer; padding:0 2px; line-height:1; font-weight:bold;">&times;</button>
          </span>
        `;
      });
    }

    html += `
      <tr style="border-bottom:1px solid #f1f5f9; transition:background-color 0.15s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='transparent'">
        <td style="padding:9px 12px; text-align:center; font-family:monospace; font-weight:700; color:#475569; vertical-align:middle;">
          ${escapeHtml(site.code || '-')}
        </td>
        <td style="padding:9px 12px; vertical-align:middle; font-weight:600; color:#1e293b;">
          ${escapeHtml(site.name)}
        </td>
        <td style="padding:9px 12px; vertical-align:middle;">
          <div style="display:flex; flex-wrap:wrap; align-items:center;">
            ${mgrBadgesHtml}
          </div>
        </td>
        <td style="padding:9px 12px; vertical-align:middle;">
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:4px;">
            ${safetyBadgesHtml}
          </div>
        </td>
        <td style="padding:9px 10px; text-align:center; vertical-align:middle; white-space:nowrap;">
          <div style="display:inline-flex; gap:5px; justify-content:center; align-items:center; flex-wrap:nowrap;">
            <button type="button" onclick="promptAddManager('${escapeHtml(site.id)}')" title="현장소장 추가/변경" style="padding:5px 8px; font-size:12px; font-weight:600; background:#f0f9ff; color:#0369a1; border:1px solid #bae6fd; border-radius:5px; cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center; gap:4px; transition:all 0.15s;" onmouseover="this.style.background='#e0f2fe'" onmouseout="this.style.background='#f0f9ff'">
              <i class="fa-solid fa-user-tie"></i> 소장
            </button>
            <button type="button" onclick="promptAddSafetyManager('${escapeHtml(site.id)}')" title="안전관리자 추가/변경" style="padding:5px 8px; font-size:12px; font-weight:600; background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; border-radius:5px; cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center; gap:4px; transition:all 0.15s;" onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">
              <i class="fa-solid fa-user-shield"></i> 안전
            </button>
            <button type="button" onclick="deleteSite('${escapeHtml(site.id)}')" title="현장 삭제" style="padding:5px 8px; font-size:12px; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; border-radius:5px; cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center; transition:all 0.15s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// 신규 현장 추가 입력 행(Row) 노출
function showAddSiteRow() {
  const row = document.getElementById('add-site-row-tr');
  if (!row) return;

  row.style.display = 'table-row';
  document.getElementById('new-site-code').value = '';
  document.getElementById('new-site-name').value = '';
  document.getElementById('new-site-manager').value = '';
  const safetyInput = document.getElementById('new-site-safety-manager');
  if (safetyInput) safetyInput.value = '';
  
  setTimeout(() => {
    document.getElementById('new-site-code').focus();
  }, 50);
}

// 신규 현장 추가 입력 행 숨김
function hideAddSiteRow() {
  const row = document.getElementById('add-site-row-tr');
  if (row) row.style.display = 'none';
}

// 신규 현장 저장 (JSON 업데이트)
async function confirmSaveNewSite() {
  const codeInput = document.getElementById('new-site-code');
  const nameInput = document.getElementById('new-site-name');
  const mgrInput = document.getElementById('new-site-manager');
  const safetyInput = document.getElementById('new-site-safety-manager');

  const code = codeInput.value.trim();
  const name = nameInput.value.trim();
  const manager = mgrInput.value.trim();
  const safetyManager = safetyInput ? safetyInput.value.trim() : '';

  if (!code) {
    alert('현장코드를 입력해 주십시오 (예: 2026022).');
    codeInput.focus();
    return;
  }

  if (!name) {
    alert('현장명(공사명)을 입력해 주십시오.');
    nameInput.focus();
    return;
  }

  if (!manager) {
    alert('현장소장 성명을 입력해 주십시오 (필수값).');
    mgrInput.focus();
    return;
  }

  if (!safetyManager) {
    alert('안전관리자 성명을 입력해 주십시오 (필수값).');
    if (safetyInput) safetyInput.focus();
    return;
  }

  // 중복 현장코드 검증
  const duplicate = cachedAdminSites.find(s => s.code === code);
  if (duplicate) {
    alert(`현장코드 [${code}]는 이미 등록되어 있는 현장입니다 (${duplicate.name}).`);
    codeInput.focus();
    return;
  }

  const newSite = {
    id: `SITE-${code}`,
    code: code,
    name: name,
    managers: [manager],
    manager: manager,
    safetyManagers: [safetyManager],
    safetyManager: safetyManager,
    status: '진행중'
  };

  // 최상단에 신규 현장 추가
  cachedAdminSites.unshift(newSite);

  try {
    await API.saveSites(cachedAdminSites);
    hideAddSiteRow();
    renderAdminSiteList(false);
    alert(`'${name}' (코드: ${code}) 현장이 성공적으로 추가 및 저장되었습니다.\n• 현장소장: ${manager}\n• 안전관리자: ${safetyManager}`);
  } catch (err) {
    alert('현장 저장 중 오류가 발생했습니다.');
  }
}

// 현장 자체 삭제
async function deleteSite(siteId) {
  const site = cachedAdminSites.find(s => s.id === siteId);
  if (!site) return;

  if (!confirm(`[${site.name}]\n본 현장(${site.code})을 목록에서 완전히 삭제하시겠습니까?`)) {
    return;
  }

  cachedAdminSites = cachedAdminSites.filter(s => s.id !== siteId);

  try {
    await API.saveSites(cachedAdminSites);
    renderAdminSiteList(false);
    alert(`'${site.name}' 현장이 삭제되었습니다.`);
  } catch (err) {
    alert('현장 삭제 중 오류가 발생했습니다.');
  }
}

// 현장소장 추가/수정 프롬프트
async function promptAddManager(siteId) {
  const site = cachedAdminSites.find(s => s.id === siteId);
  if (!site) return;

  const currentMgr = (site.managers && site.managers[0]) || site.manager || '';
  const newMgr = prompt(`[${site.name}]\n현장소장의 성명을 입력해 주십시오 (필수):`, currentMgr);
  if (newMgr === null) return;

  const trimmed = newMgr.trim();
  if (!trimmed) {
    alert('현장소장 성명은 필수값입니다.');
    return;
  }

  site.managers = [trimmed];
  site.manager = trimmed;

  try {
    await API.saveSites(cachedAdminSites);
    renderAdminSiteList(false);
  } catch (err) {
    alert('현장소장 저장 중 오류가 발생했습니다.');
  }
}

// 안전관리자 추가/수정 프롬프트
async function promptAddSafetyManager(siteId) {
  const site = cachedAdminSites.find(s => s.id === siteId);
  if (!site) return;

  const currentSafety = (site.safetyManagers && site.safetyManagers[0]) || site.safetyManager || '';
  const newSafety = prompt(`[${site.name}]\n안전관리자의 성명을 입력해 주십시오 (필수):`, currentSafety);
  if (newSafety === null) return;

  const trimmed = newSafety.trim();
  if (!trimmed) {
    alert('안전관리자 성명은 필수값입니다.');
    return;
  }

  site.safetyManagers = [trimmed];
  site.safetyManager = trimmed;

  try {
    await API.saveSites(cachedAdminSites);
    renderAdminSiteList(false);
  } catch (err) {
    alert('안전관리자 저장 중 오류가 발생했습니다.');
  }
}

// 현장 목록 검색 필터링 (캐시 기반 빠른 렌더링)
function filterAdminSites() {
  renderAdminSiteList(false);
}

// 특정 현장의 현장소장 제거
async function removeSiteManager(siteId, managerName) {
  const site = cachedAdminSites.find(s => s.id === siteId);
  if (!site) return;

  if (!confirm(`[${site.name}]\n'${managerName}' 현장소장을 삭제(해제)하시겠습니까?\n(삭제 시 미지정 상태가 되며 현장 선택 시 재입력이 요구됩니다.)`)) {
    return;
  }

  site.managers = (site.managers || []).filter(m => m !== managerName);
  site.manager = site.managers.join(', ');

  try {
    await API.saveSites(cachedAdminSites);
    renderAdminSiteList(false);
  } catch (err) {
    alert('현장소장 삭제 저장 중 오류가 발생했습니다.');
  }
}

// 특정 현장의 안전관리자 제거
async function removeSiteSafetyManager(siteId, safetyName) {
  const site = cachedAdminSites.find(s => s.id === siteId);
  if (!site) return;

  if (!confirm(`[${site.name}]\n'${safetyName}' 안전관리자를 삭제(해제)하시겠습니까?\n(삭제 시 미지정 상태가 되며 현장 선택 시 재입력이 요구됩니다.)`)) {
    return;
  }

  site.safetyManagers = (site.safetyManagers || []).filter(m => m !== safetyName);
  site.safetyManager = site.safetyManagers.join(', ');

  try {
    await API.saveSites(cachedAdminSites);
    renderAdminSiteList(false);
  } catch (err) {
    alert('안전관리자 삭제 저장 중 오류가 발생했습니다.');
  }
}

// 관리자 모달 내 규정 목록 렌더링 (매뉴얼, 절차서, 지침서)
async function renderAdminDocList() {
  const tbody = document.getElementById('admin-doc-list-tbody');
  if (!tbody) return;

  const filterSelect = document.getElementById('admin-filter-category');
  const selectedCat = filterSelect ? filterSelect.value : 'ALL';

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> 규정 목록 불러오는 중...</td></tr>`;

  try {
    const docs = await API.getDocuments();
    let filtered = docs;
    if (selectedCat !== 'ALL') {
      filtered = docs.filter(d => d.category === selectedCat);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">해당 카테고리의 규정이 없습니다.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    filtered.forEach(doc => {
      let catBadge = '';
      if (doc.category === 'MANUAL') {
        catBadge = '<span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-weight:700; font-size:11px;">매뉴얼</span>';
      } else if (doc.category === 'PROCEDURE') {
        catBadge = '<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:4px; font-weight:700; font-size:11px;">절차서</span>';
      } else if (doc.category === 'INSTRUCTION') {
        catBadge = '<span style="background:#ecfdf5; color:#047857; padding:2px 8px; border-radius:4px; font-weight:700; font-size:11px;">지침서</span>';
      } else {
        catBadge = '<span style="background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:4px; font-weight:600; font-size:11px;">표준</span>';
      }

      rowsHtml += `
        <tr style="border-bottom:1px solid #f1f5f9; transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='transparent'">
          <td style="padding:10px 12px; vertical-align:middle;">${catBadge}</td>
          <td style="padding:10px 12px; font-weight:600; color:#1e293b; vertical-align:middle;">${escapeHtml(doc.docNumber || '-')}</td>
          <td style="padding:10px 12px; vertical-align:middle;">
            <a href="detail.html?id=${encodeURIComponent(doc.id)}" style="color:#1d4ed8; text-decoration:none; font-weight:600;" title="문서 보기">
              ${escapeHtml(doc.title)}
            </a>
          </td>
          <td style="padding:10px 12px; text-align:center; vertical-align:middle;">
            <span style="background:#f1f5f9; border:1px solid #cbd5e1; padding:2px 6px; border-radius:4px; font-size:11.5px; font-weight:600;">${escapeHtml(doc.currentVersion || 'Rev.1')}</span>
          </td>
          <td style="padding:10px 12px; text-align:center; color:#64748b; font-size:12px; vertical-align:middle;">
            ${escapeHtml(doc.effectiveDate || '-')}
          </td>
          <td style="padding:10px 12px; text-align:center; vertical-align:middle;">
            <button type="button" class="btn-primary" onclick="openAdminDocEdit('${escapeHtml(doc.id)}')" style="padding:4px 10px; font-size:12px; display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
              <i class="fa-solid fa-file-pen"></i> 개정/편집
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#ef4444;">규정 목록을 불러오지 못했습니다.</td></tr>`;
  }
}

// 관리자 모달에서 개정/편집 버튼 클릭 시 동작
function openAdminDocEdit(docId) {
  closeAdminModal();
  // 현재 상세 페이지이고 현재 보고 있는 문서인 경우 즉시 에디터 모달 실행
  if (typeof currentDoc !== 'undefined' && currentDoc && currentDoc.id === docId && typeof openDraftEditorModal === 'function') {
    openDraftEditorModal();
  } else {
    // 다른 문서이거나 index.html인 경우 detail.html?id=...&action=edit 로 이동
    window.location.href = `detail.html?id=${encodeURIComponent(docId)}&action=edit`;
  }
}

async function loadAdminList() {
  const listEl = document.getElementById('admin-email-list');
  if (!listEl) return;
  try {
    const data = await API.getAdmins();
    listEl.innerHTML = '';

    // 1. 최고 관리자 (Super Admins) 먼저 고정 렌더링
    SUPER_ADMINS.forEach(email => {
      const li = document.createElement('li');
      li.style.backgroundColor = '#fff9db';
      li.style.borderLeft = '3px solid #f59f00';
      li.innerHTML = `
        <span><i class="fa-solid fa-crown" style="color:#f59f00;"></i> <strong>${email}</strong> <small style="color:#d9480f;font-weight:700;margin-left:6px;">[최고 관리자]</small></span>
        <span style="font-size:11px;color:#862e9c;padding:2px 8px;background:#f3d9fa;border-radius:3px;font-weight:bold;">고정 권한</span>
      `;
      listEl.appendChild(li);
    });

    // 2. 일반 관리자 목록
    const otherAdmins = (data.admins || []).filter(e => !SUPER_ADMINS.includes(e.toLowerCase()));
    otherAdmins.forEach(email => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span><i class="fa-solid fa-user-shield" style="color:#1971c2;"></i> ${email} <small style="color:#666;margin-left:6px;">[일반 관리자]</small></span>
        <button class="btn-delete-sm" onclick="removeAdminEmail('${email}')">삭제</button>
      `;
      listEl.appendChild(li);
    });
  } catch (e) {
    listEl.innerHTML = '<li>목록을 불러오지 못했습니다.</li>';
  }
}

async function addAdminEmail() {
  if (!AUTH.isSuperAdmin()) {
    alert('새 관리자 추가는 최고 관리자(nschoi, sb06)만 가능합니다.');
    return;
  }

  const input = document.getElementById('new-admin-email');
  const email = input.value.trim().toLowerCase();
  if (!email || !email.endsWith('@sebangtec.com')) {
    alert('@sebangtec.com 사내 이메일을 정확히 입력하세요.');
    return;
  }

  const data = await API.getAdmins();
  const admins = data.admins || [];
  if (SUPER_ADMINS.includes(email) || admins.map(a => a.toLowerCase()).includes(email)) {
    alert('이미 등록된 관리자입니다.');
    return;
  }

  admins.push(email);
  await API.saveAdmins(admins);
  input.value = '';
  loadAdminList();
  alert('관리자가 추가되었습니다.');
}

async function removeAdminEmail(email) {
  if (SUPER_ADMINS.includes(email.toLowerCase())) {
    alert('최고 관리자(nschoi@sebangtec.com, sb06@sebangtec.com)의 권한은 삭제할 수 없습니다.');
    return;
  }

  if (!AUTH.isSuperAdmin()) {
    alert('관리자 권한 삭제는 최고 관리자(nschoi, sb06)만 가능합니다.');
    return;
  }

  if (!confirm(`${email} 관리자 권한을 삭제하시겠습니까?`)) return;
  const data = await API.getAdmins();
  const admins = (data.admins || []).filter(e => e.toLowerCase() !== email.toLowerCase());
  await API.saveAdmins(admins);
  loadAdminList();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// -------------------------------------------------------------
// [접속자 및 유입 경로 통계 관리 (Traffic & Referrer Analytics)]
// -------------------------------------------------------------
async function renderTrafficTab() {
  const kpiToday = document.getElementById('traffic-kpi-today');
  const kpiTotal = document.getElementById('traffic-kpi-total');
  const kpiPc = document.getElementById('traffic-kpi-pc');
  const kpiMobile = document.getElementById('traffic-kpi-mobile');
  const sourceBars = document.getElementById('traffic-source-bars');
  const recentTbody = document.getElementById('traffic-recent-tbody');

  if (kpiToday) kpiToday.innerText = '...';
  if (kpiTotal) kpiTotal.innerText = '...';

  try {
    const data = await API.getVisitorCounter();
    if (!data) return;

    const total = data.total || 0;
    const today = data.today || 0;
    const devices = data.devices || { PC: 0, '모바일': 0 };
    const pcCount = devices['PC'] || 0;
    const mobileCount = devices['모바일'] || 0;
    const devSum = pcCount + mobileCount || 1;
    const pcPct = Math.round((pcCount / devSum) * 100);
    const mobilePct = Math.round((mobileCount / devSum) * 100);

    if (kpiToday) kpiToday.innerText = today.toLocaleString() + '명';
    if (kpiTotal) kpiTotal.innerText = total.toLocaleString() + '명';
    if (kpiPc) kpiPc.innerHTML = `${pcPct}% <small style="font-size:11px;font-weight:normal;color:#64748b;">(${pcCount.toLocaleString()}건)</small>`;
    if (kpiMobile) kpiMobile.innerHTML = `${mobilePct}% <small style="font-size:11px;font-weight:normal;color:#64748b;">(${mobileCount.toLocaleString()}건)</small>`;

    // 1. 유입 채널별 막대 바 렌더링
    if (sourceBars) {
      const sources = data.sources || {};
      const sourceList = Object.entries(sources).map(([name, count]) => ({
        name,
        count: Number(count) || 0
      })).sort((a, b) => b.count - a.count);

      const totalSourceCount = sourceList.reduce((acc, cur) => acc + cur.count, 0) || 1;

      // 채널별 아이콘 & 색상
      const channelStyleMap = {
        '현장 QR코드 스캔': { icon: 'fa-qrcode', color: '#0284c7', bg: '#e0f2fe' },
        '사내 그룹웨어': { icon: 'fa-building', color: '#16a34a', bg: '#dcfce7' },
        '모바일 메신저 (카카오톡/Teams)': { icon: 'fa-comments', color: '#ca8a04', bg: '#fef9c3' },
        '사내 공지메일': { icon: 'fa-envelope', color: '#9333ea', bg: '#f3e8ff' },
        '직접 접속 / 즐겨찾기': { icon: 'fa-compass', color: '#475569', bg: '#f1f5f9' }
      };

      sourceBars.innerHTML = sourceList.map(item => {
        const pct = Math.round((item.count / totalSourceCount) * 100);
        const style = channelStyleMap[item.name] || { icon: 'fa-link', color: '#0284c7', bg: '#e0f2fe' };

        return `
          <div style="font-size:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:600; color:#334155; display:inline-flex; align-items:center; gap:6px;">
                <span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:4px; background:${style.bg}; color:${style.color}; font-size:11px;">
                  <i class="fa-solid ${style.icon}"></i>
                </span>
                ${escapeHtml(item.name)}
              </span>
              <span style="font-weight:700; color:#0f172a;">
                ${item.count.toLocaleString()}회 <span style="font-size:11px; color:#64748b; font-weight:normal;">(${pct}%)</span>
              </span>
            </div>
            <div style="height:7px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
              <div style="width:${pct}%; height:100%; background:${style.color}; border-radius:4px; transition:width 0.5s ease;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 2. 실시간 최근 접속 로그 테이블
    if (recentTbody) {
      const recentLogs = data.recentLogs || [];
      if (recentLogs.length === 0) {
        recentTbody.innerHTML = `<tr><td colspan="3" style="padding:16px; text-align:center; color:#94a3b8;">최근 접속 로그가 없습니다.</td></tr>`;
      } else {
        recentTbody.innerHTML = recentLogs.slice(0, 20).map(log => {
          const isMobile = log.device === '모바일';
          const devBadge = isMobile
            ? `<span style="background:#fef9c3; color:#a16207; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:700; border:1px solid #fde047;"><i class="fa-solid fa-mobile-screen"></i> 모바일</span>`
            : `<span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:700; border:1px solid #bae6fd;"><i class="fa-solid fa-desktop"></i> PC</span>`;
          
          let srcBadgeColor = '#f1f5f9';
          let srcTextColor = '#475569';
          if (log.source && log.source.includes('QR')) {
            srcBadgeColor = '#eff6ff'; srcTextColor = '#1d4ed8';
          } else if (log.source && log.source.includes('그룹웨어')) {
            srcBadgeColor = '#f0fdf4'; srcTextColor = '#15803d';
          } else if (log.source && (log.source.includes('카카오') || log.source.includes('메신저'))) {
            srcBadgeColor = '#fffbeb'; srcTextColor = '#b45309';
          }

          return `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:6px 8px; color:#64748b; white-space:nowrap;">${escapeHtml(log.timestamp || '')}</td>
              <td style="padding:6px 8px;">
                <span style="background:${srcBadgeColor}; color:${srcTextColor}; padding:2px 6px; border-radius:4px; font-weight:600; font-size:11px;">
                  ${escapeHtml(log.source || '직접 접속')}
                </span>
              </td>
              <td style="padding:6px 8px; text-align:center;">${devBadge}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('트래픽 통계 렌더링 실패:', err);
  }
}

// 유입 추적용 배포 링크 클립보드 복사 함수
function copyTrafficLink(refKey) {
  const baseUrl = window.location.origin + window.location.pathname;
  const targetUrl = `${baseUrl}?ref=${encodeURIComponent(refKey)}`;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(targetUrl).then(() => {
      alert(`[추적 링크 복사 완료]\n\n${targetUrl}\n\n위 링크를 사내 게시판, QR코드 또는 메신저에 공유하시면 유입경로가 자동 집계됩니다.`);
    }).catch(() => {
      prompt('아래 링크를 복사하여 사용하십시오:', targetUrl);
    });
  } else {
    // 대체 복사 방식
    const textArea = document.createElement('textarea');
    textArea.value = targetUrl;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      textArea.remove();
      alert(`[추적 링크 복사 완료]\n\n${targetUrl}\n\n위 링크를 사내 게시판, QR코드 또는 메신저에 공유하시면 유입경로가 자동 집계됩니다.`);
    } catch (e) {
      textArea.remove();
      prompt('아래 링크를 복사하여 사용하십시오:', targetUrl);
    }
  }
}

// 초기 로딩 시 게이트 확인 및 상태 바 렌더링
window.addEventListener('DOMContentLoaded', () => {
  checkGateAccess();
  renderUserStatus();
  // 문서 로딩 후 서명 자동 매칭 적용
  setTimeout(() => {
    applySignaturesToDocument();
  }, 300);
});

// ================================================================
// [전자서명 관리록 및 자동 매칭 시스템]
// ================================================================
const SIGNATURE_STORAGE_KEY = 'sebang_official_signatures';
let isSignatureActive = true;

// 도장 SVG DataURL 생성 헬퍼
function generateStampSvgDataUrl(name) {
  const clean = (name || '').replace(/\s+/g, '');
  const stampText = clean.length === 3 ? clean + '인' : clean;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="45" stroke="#dc2626" stroke-width="4.5" fill="none"/>
    <circle cx="50" cy="50" r="41" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="2,2" fill="none"/>
    <text x="50" y="58" font-family="'Malgun Gothic', 'Batang', sans-serif" font-size="20" font-weight="900" fill="#dc2626" text-anchor="middle" letter-spacing="1">${stampText}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const SIGNATURE_MANAGER = {
  getDefaultSignatures() {
    return [
      { id: 'sig_1', name: '강치성', title: '대표이사', type: 'stamp', dataUrl: generateStampSvgDataUrl('강치성'), date: '2026-01-02' },
      { id: 'sig_2', name: '박계석', title: '대표이사', type: 'stamp', dataUrl: generateStampSvgDataUrl('박계석'), date: '2026-01-02' },
      { id: 'sig_3', name: '정재빈', title: '경영대리인', type: 'stamp', dataUrl: generateStampSvgDataUrl('정재빈'), date: '2026-01-02' },
      { id: 'sig_4', name: '최난새', title: '품질안전보건실장/파트장', type: 'stamp', dataUrl: generateStampSvgDataUrl('최난새'), date: '2026-01-02' },
      { id: 'sig_5', name: '민경진', title: '시스템관리자/대리', type: 'stamp', dataUrl: generateStampSvgDataUrl('민경진'), date: '2026-01-02' }
    ];
  },

  getSignatures() {
    try {
      const raw = localStorage.getItem(SIGNATURE_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }
    const def = this.getDefaultSignatures();
    this.saveSignatures(def);
    return def;
  },

  saveSignatures(list) {
    localStorage.setItem(SIGNATURE_STORAGE_KEY, JSON.stringify(list));
    applySignaturesToDocument();
  },

  addSignature(name, title, dataUrl) {
    if (!name || !dataUrl) {
      alert('성명과 서명 이미지를 모두 입력해 주십시오.');
      return false;
    }
    const list = this.getSignatures();
    const existingIdx = list.findIndex(s => s.name.replace(/\s+/g,'') === name.trim().replace(/\s+/g,''));
    const item = {
      id: 'sig_' + Date.now(),
      name: name.trim(),
      title: (title || '').trim(),
      type: 'image',
      dataUrl: dataUrl,
      date: new Date().toISOString().split('T')[0]
    };

    if (existingIdx >= 0) {
      list[existingIdx] = item;
    } else {
      list.push(item);
    }
    this.saveSignatures(list);
    return true;
  },

  deleteSignature(id) {
    if (!confirm('해당 서명을 삭제하시겠습니까?')) return;
    const list = this.getSignatures().filter(s => s.id !== id);
    this.saveSignatures(list);
    renderSignatureTable();
  },

  getSignatureByName(name) {
    const list = this.getSignatures();
    const clean = (name || '').replace(/\s+/g, '');
    return list.find(s => s.name.replace(/\s+/g, '') === clean) || null;
  }
};

// 서명 토글 스위치 (공식 서명본 vs 미서명본)
function toggleSignatureDisplay() {
  isSignatureActive = !isSignatureActive;
  applySignaturesToDocument();
  const btn = document.getElementById('btn-toggle-signatures');
  if (btn) {
    btn.innerHTML = isSignatureActive 
      ? '<i class="fa-solid fa-stamp" style="color:#16a34a;"></i> 전자서명 날인 [ON]' 
      : '<i class="fa-solid fa-stamp" style="color:#94a3b8;"></i> 전자서명 날인 [OFF]';
  }
}

// 문서 내 (인) 위치에 등록된 서명 자동 매칭
function applySignaturesToDocument() {
  if (typeof document === 'undefined') return;

  // 1. 기존 .stamp-slot 요소 처리
  const slots = document.querySelectorAll('.stamp-slot');
  slots.forEach(slot => {
    const signer = slot.getAttribute('data-signer');
    const existingImg = slot.querySelector('.auto-stamp-img');
    if (!isSignatureActive) {
      if (existingImg) existingImg.remove();
      return;
    }

    if (signer) {
      const sig = SIGNATURE_MANAGER.getSignatureByName(signer);
      if (sig && sig.dataUrl) {
        if (!existingImg) {
          const img = document.createElement('img');
          img.className = 'auto-stamp-img';
          img.src = sig.dataUrl;
          img.alt = `${signer} (인)`;
          img.title = `${signer} 공인 서명/인감`;
          slot.appendChild(img);
        } else {
          existingImg.src = sig.dataUrl;
        }
      }
    }
  });

  // 2. 본문 및 승인표 텍스트 내 자동 매칭
  const signers = SIGNATURE_MANAGER.getSignatures();
  document.querySelectorAll('.official-sign-table td, .doc-official-header td, .approval-table td, .cover-approval-box td').forEach(td => {
    signers.forEach(sig => {
      if (td.innerText.includes(sig.name) && td.innerText.includes('(인)') && !td.querySelector('.stamp-slot')) {
        td.innerHTML = td.innerHTML.replace(
          new RegExp(`(${sig.name}[^<]*?)(\\(인\\)|<small>\\(인\\)<\\/small>)`, 'g'),
          `$1<span class="stamp-slot" data-signer="${sig.name}"><small>(인)</small></span>`
        );
      }
    });
  });

  // 새로 생성된 slot에 다시 서명 주입
  document.querySelectorAll('.stamp-slot').forEach(slot => {
    if (!isSignatureActive) return;
    if (slot.querySelector('.auto-stamp-img')) return;
    const signer = slot.getAttribute('data-signer');
    if (signer) {
      const sig = SIGNATURE_MANAGER.getSignatureByName(signer);
      if (sig && sig.dataUrl) {
        const img = document.createElement('img');
        img.className = 'auto-stamp-img';
        img.src = sig.dataUrl;
        img.alt = `${signer} (인)`;
        slot.appendChild(img);
      }
    }
  });
}

// -------------------------------------------------------------
// 서명 관리 모달 UI (동적 생성 및 이벤트 바인딩)
// -------------------------------------------------------------
function ensureSignatureModal() {
  if (document.getElementById('signature-manager-modal')) return;

  const modalHtml = `
  <div id="signature-manager-modal" class="modal-backdrop no-print" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.55); z-index:10000; align-items:center; justify-content:center;">
    <div class="modal-dialog sig-manage-dialog" style="background:#ffffff; width:92%; max-width:820px; border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,0.25); overflow:hidden; display:flex; flex-direction:column; max-height:90vh;">
      <div class="modal-header" style="background:#0f172a; color:#ffffff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0; font-size:16px; font-weight:700; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-signature" style="color:#38bdf8;"></i> 임원 및 결재선 서명/인감 관리록
        </h3>
        <button onclick="closeSignatureManagerModal()" style="background:none; border:none; color:#94a3b8; font-size:20px; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div class="modal-body" style="padding:20px; overflow-y:auto; flex:1;">
        <!-- 서명 등록 안내 -->
        <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:12px 16px; margin-bottom:18px; font-size:13px; line-height:1.6; color:#0369a1;">
          <i class="fa-solid fa-circle-info"></i> <strong>서명 자동 매칭 안내:</strong><br>
          등록된 성명(예: <strong>강치성, 최난새, 민경진, 정재빈, 박계석</strong> 등)은 매뉴얼 및 절차서의 결재란과 승인현황표 내 <code>(인)</code> 위치에 자동으로 날인됩니다.
        </div>

        <!-- 신규 서명 등록 폼 -->
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:20px;">
          <h4 style="margin:0 0 12px 0; font-size:14px; font-weight:700; color:#1e293b;"><i class="fa-solid fa-plus-circle"></i> 신규 서명/인감 등록</h4>
          <div style="display:grid; grid-template-columns: 1fr 1.2fr 1.5fr auto; gap:10px; align-items:end;">
            <div>
              <label style="font-size:12px; font-weight:600; color:#475569; display:block; margin-bottom:4px;">성명 (필수)</label>
              <input type="text" id="sig-input-name" placeholder="예: 최난새" style="width:100%; padding:7px 10px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; box-sizing:border-box;">
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#475569; display:block; margin-bottom:4px;">직책/부서</label>
              <input type="text" id="sig-input-title" placeholder="예: 품질안전보건실장" style="width:100%; padding:7px 10px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; box-sizing:border-box;">
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#475569; display:block; margin-bottom:4px;">서명 파일 업로드 (PNG 투명배경 권장)</label>
              <input type="file" id="sig-input-file" accept="image/*" style="width:100%; font-size:12px;">
            </div>
            <div>
              <button type="button" class="btn-primary" onclick="submitNewSignature()" style="padding:8px 16px; font-size:13px; background:#0284c7; color:#fff; border:none; border-radius:4px; font-weight:600; cursor:pointer; white-space:nowrap;">
                <i class="fa-solid fa-check"></i> 서명 저장
              </button>
            </div>
          </div>
          <div style="margin-top:10px; font-size:12px; color:#64748b;">
            ※ 파일을 선택하지 않고 저장할 경우, 한국 공식 붉은색 인감도장 모양으로 자동 생성됩니다.
          </div>
        </div>

        <!-- 현재 등록된 서명 목록 -->
        <h4 style="margin:0 0 10px 0; font-size:14px; font-weight:700; color:#1e293b;"><i class="fa-solid fa-list"></i> 등록된 서명 목록</h4>
        <div style="border:1px solid #cbd5e1; border-radius:6px; overflow:hidden;">
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="background:#f1f5f9; color:#1e293b; font-weight:700;">
                <th style="padding:8px 10px; text-align:center; width:15%;">성명</th>
                <th style="padding:8px 10px; text-align:center; width:25%;">직책/부서</th>
                <th style="padding:8px 10px; text-align:center; width:20%;">서명/인감 미리보기</th>
                <th style="padding:8px 10px; text-align:center; width:20%;">등록일자</th>
                <th style="padding:8px 10px; text-align:center; width:20%;">관리</th>
              </tr>
            </thead>
            <tbody id="sig-list-tbody">
              <!-- JS 렌더링 -->
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-footer" style="padding:12px 20px; background:#f8fafc; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end;">
        <button type="button" onclick="closeSignatureManagerModal()" style="padding:7px 18px; border:1px solid #cbd5e1; background:#ffffff; border-radius:4px; font-size:13px; font-weight:600; cursor:pointer;">닫기</button>
      </div>
    </div>
  </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openSignatureManagerModal() {
  if (!AUTH.isAdmin()) {
    alert('관리자 전용 기능입니다.');
    return;
  }
  ensureSignatureModal();
  renderSignatureTable();
  const modal = document.getElementById('signature-manager-modal');
  if (modal) modal.style.display = 'flex';
}

function closeSignatureManagerModal() {
  const modal = document.getElementById('signature-manager-modal');
  if (modal) modal.style.display = 'none';
}

function renderSignatureTable() {
  const tbody = document.getElementById('sig-list-tbody');
  if (!tbody) return;

  const list = SIGNATURE_MANAGER.getSignatures();
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">등록된 서명이 없습니다.</td></tr>';
    return;
  }

  let html = '';
  list.forEach(s => {
    html += `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px; text-align:center; font-weight:700; color:#0f172a;">${escapeHtml(s.name)}</td>
        <td style="padding:10px; text-align:center; color:#475569;">${escapeHtml(s.title || '-')}</td>
        <td style="padding:6px; text-align:center;">
          <img src="${s.dataUrl}" alt="${escapeHtml(s.name)}" style="height:38px; max-width:60px; object-fit:contain; vertical-align:middle;">
        </td>
        <td style="padding:10px; text-align:center; color:#64748b; font-size:12px;">${escapeHtml(s.date || '-')}</td>
        <td style="padding:10px; text-align:center;">
          <button onclick="SIGNATURE_MANAGER.deleteSignature('${s.id}')" style="padding:4px 10px; background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:4px; font-size:12px; cursor:pointer; font-weight:600;">
            <i class="fa-solid fa-trash-can"></i> 삭제
          </button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function submitNewSignature() {
  const nameInput = document.getElementById('sig-input-name');
  const titleInput = document.getElementById('sig-input-title');
  const fileInput = document.getElementById('sig-input-file');

  const name = nameInput ? nameInput.value.trim() : '';
  const title = titleInput ? titleInput.value.trim() : '';

  if (!name) {
    alert('서명자의 성명을 입력해 주십시오.');
    if (nameInput) nameInput.focus();
    return;
  }

  const file = fileInput && fileInput.files && fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const dataUrl = e.target.result;
      SIGNATURE_MANAGER.addSignature(name, title, dataUrl);
      nameInput.value = '';
      if (titleInput) titleInput.value = '';
      if (fileInput) fileInput.value = '';
      renderSignatureTable();
      alert(`[${name}] 님의 서명이 성공적으로 등록되었습니다.`);
    };
    reader.readAsDataURL(file);
  } else {
    // 자동 붉은색 인감도장 생성
    const stampUrl = generateStampSvgDataUrl(name);
    SIGNATURE_MANAGER.addSignature(name, title, stampUrl);
    nameInput.value = '';
    if (titleInput) titleInput.value = '';
    renderSignatureTable();
    alert(`[${name}] 님의 공인 인감도장이 자동으로 생성 및 등록되었습니다.`);
  }
}

