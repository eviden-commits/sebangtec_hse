/**
 * 사내 이메일 OTP 인증 및 권한 관리 모듈
 */
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

  isAdmin() {
    const user = this.getUser();
    return user && user.isAdmin === true;
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
    if (user.isAdmin) {
      adminBtn = `<button class="btn-text" style="color:#d9480f;font-weight:bold;" onclick="openAdminModal()"><i class="fa-solid fa-gear"></i> 관리자 설정</button>`;
    }
    area.innerHTML = `
      <span style="color:#2b8a3e;font-weight:600;"><i class="fa-solid fa-circle-check"></i> ${user.email}</span>
      ${adminBtn}
      <button class="btn-text" onclick="AUTH.logout()"><i class="fa-solid fa-right-from-bracket"></i> 로그아웃</button>
    `;

    // 관리자 전용 버튼들 노출
    document.querySelectorAll('.admin-only').forEach(el => {
      if (user.isAdmin) el.style.display = 'inline-flex';
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
    loadAdminList();
  }
}

function closeAdminModal() {
  const modal = document.getElementById('admin-modal');
  if (modal) modal.style.display = 'none';
}

async function loadAdminList() {
  const listEl = document.getElementById('admin-email-list');
  if (!listEl) return;
  try {
    const data = await API.getAdmins();
    listEl.innerHTML = '';
    (data.admins || []).forEach(email => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span><i class="fa-solid fa-user-shield"></i> ${email}</span>
        <button class="btn-delete-sm" onclick="removeAdminEmail('${email}')">삭제</button>
      `;
      listEl.appendChild(li);
    });
  } catch (e) {
    listEl.innerHTML = '<li>목록을 불러오지 못했습니다.</li>';
  }
}

async function addAdminEmail() {
  const input = document.getElementById('new-admin-email');
  const email = input.value.trim();
  if (!email || !email.endsWith('@sebangtec.com')) {
    alert('@sebangtec.com 사내 이메일을 정확히 입력하세요.');
    return;
  }

  const data = await API.getAdmins();
  const admins = data.admins || [];
  if (admins.includes(email)) {
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
  if (!confirm(`${email} 관리자 권한을 삭제하시겠습니까?`)) return;
  const data = await API.getAdmins();
  const admins = (data.admins || []).filter(e => e !== email);
  await API.saveAdmins(admins);
  loadAdminList();
}

// 초기 로딩 시 게이트 확인 및 상태 바 렌더링
window.addEventListener('DOMContentLoaded', () => {
  checkGateAccess();
  renderUserStatus();
});
