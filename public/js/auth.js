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

  const user = AUTH.getUser();
  if (user) {
    let adminBtn = '';
    let roleBadge = '';
    if (AUTH.isSuperAdmin()) {
      roleBadge = `<span style="background:#fff3bf;color:#d9480f;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:700;border:1px solid #ffd43b;margin-right:6px;"><i class="fa-solid fa-crown"></i> 최고 관리자</span>`;
      adminBtn = `<button class="btn-text" style="color:#d9480f;font-weight:bold;" onclick="openAdminModal()"><i class="fa-solid fa-gear"></i> 관리자 설정</button>`;
    } else if (AUTH.isAdmin()) {
      roleBadge = `<span style="background:#e7f5ff;color:#1864ab;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;border:1px solid #a5d8ff;margin-right:6px;"><i class="fa-solid fa-user-shield"></i> 관리자</span>`;
    }
    area.innerHTML = `
      ${roleBadge}
      <span style="color:#2b8a3e;font-weight:600;"><i class="fa-solid fa-circle-check"></i> ${user.email}</span>
      ${adminBtn}
      <button class="btn-text" onclick="AUTH.logout()"><i class="fa-solid fa-right-from-bracket"></i> 로그아웃</button>
    `;

    // 관리자 전용 버튼들 노출
    document.querySelectorAll('.admin-only').forEach(el => {
      if (AUTH.isAdmin()) el.style.display = 'inline-flex';
    });
  } else {
    area.innerHTML = `
      <button class="btn-text" onclick="openLoginModal()"><i class="fa-solid fa-user"></i> 로그인</button>
    `;
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = 'none';
    });
  }
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

// 관리자 모달 탭 전환 ('docs': 규정 제·개정 관리, 'accounts': 계정 권한 관리)
function switchAdminTab(tabName) {
  const tabDocs = document.getElementById('admin-tab-pane-docs');
  const tabAccounts = document.getElementById('admin-tab-pane-accounts');
  const btnDocs = document.getElementById('tab-btn-docs');
  const btnAccounts = document.getElementById('tab-btn-accounts');

  if (tabName === 'docs') {
    if (tabDocs) tabDocs.style.display = 'block';
    if (tabAccounts) tabAccounts.style.display = 'none';
    if (btnDocs) {
      btnDocs.style.fontWeight = '700';
      btnDocs.style.color = 'var(--primary, #194a9a)';
      btnDocs.style.borderBottom = '2px solid var(--primary, #194a9a)';
    }
    if (btnAccounts) {
      btnAccounts.style.fontWeight = '600';
      btnAccounts.style.color = '#64748b';
      btnAccounts.style.borderBottom = 'none';
    }
    renderAdminDocList();
  } else {
    if (tabDocs) tabDocs.style.display = 'none';
    if (tabAccounts) tabAccounts.style.display = 'block';
    if (btnDocs) {
      btnDocs.style.fontWeight = '600';
      btnDocs.style.color = '#64748b';
      btnDocs.style.borderBottom = 'none';
    }
    if (btnAccounts) {
      btnAccounts.style.fontWeight = '700';
      btnAccounts.style.color = 'var(--primary, #194a9a)';
      btnAccounts.style.borderBottom = '2px solid var(--primary, #194a9a)';
    }
    loadAdminList();
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

// 초기 로딩 시 게이트 확인 및 상태 바 렌더링
window.addEventListener('DOMContentLoaded', () => {
  checkGateAccess();
  renderUserStatus();
});
