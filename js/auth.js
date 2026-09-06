// ë¶ˆë? ìµœê³  ê´€ë¦¬ì ëª…ë‹¨ (Super Admins)
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
    alert('ë¡œê·¸?„ì›ƒ ?˜ì—ˆ?µë‹ˆ??');
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

// ?¬ì´??ì´ˆê¸° ?‘ì† ë¹„ë?ë²ˆí˜¸ ?•ì¸ (Gatekeeper)
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

// ë¹„ë?ë²ˆí˜¸ ê²€ì¦??œì¶œ
async function submitGatePassword() {
  const input = document.getElementById('gate-password');
  const errorMsg = document.getElementById('gate-error-msg');
  const btn = document.querySelector('.btn-gate-submit');
  const pwd = input.value.trim();

  if (!pwd) {
    if (errorMsg) errorMsg.innerText = 'ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥??ì£¼ì‹­?œì˜¤.';
    return;
  }

  if (errorMsg) errorMsg.innerText = 'ë³´ì•ˆ ?¸ì¦ ?•ì¸ ì¤?..';
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
      if (errorMsg) errorMsg.innerText = res.message || 'ë¹„ë?ë²ˆí˜¸ê°€ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.';
      input.value = '';
      input.focus();
    }
  } catch (err) {
    if (errorMsg) errorMsg.innerText = '?¸ì¦ ?œë²„(Google Apps Script) ?µì‹  ?¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.';
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ?ë‹¨ ?íƒœ ?ì—­ ê°±ì‹ 
function renderUserStatus() {
  const area = document.getElementById('user-status-area');
  if (!area) return;

  const user = AUTH.getUser();
  if (user) {
    let adminBtn = '';
    let roleBadge = '';
    if (AUTH.isSuperAdmin()) {
      roleBadge = `<span style="background:#fff3bf;color:#d9480f;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:700;border:1px solid #ffd43b;margin-right:6px;"><i class="fa-solid fa-crown"></i> ìµœê³  ê´€ë¦¬ì</span>`;
      adminBtn = `<button class="btn-text" style="color:#d9480f;font-weight:bold;" onclick="openAdminModal()"><i class="fa-solid fa-gear"></i> ê´€ë¦¬ì ?¤ì •</button>`;
    } else if (AUTH.isAdmin()) {
      roleBadge = `<span style="background:#e7f5ff;color:#1864ab;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;border:1px solid #a5d8ff;margin-right:6px;"><i class="fa-solid fa-user-shield"></i> ê´€ë¦¬ì</span>`;
    }
    area.innerHTML = `
      ${roleBadge}
      <span style="color:#2b8a3e;font-weight:600;"><i class="fa-solid fa-circle-check"></i> ${user.email}</span>
      ${adminBtn}
      <button class="btn-text" onclick="AUTH.logout()"><i class="fa-solid fa-right-from-bracket"></i> ë¡œê·¸?„ì›ƒ</button>
    `;

    // ê´€ë¦¬ì ?„ìš© ë²„íŠ¼???¸ì¶œ
    document.querySelectorAll('.admin-only').forEach(el => {
      if (AUTH.isAdmin()) el.style.display = 'inline-flex';
    });
  } else {
    area.innerHTML = `
      <button class="btn-text" onclick="openLoginModal()"><i class="fa-solid fa-user"></i> ë¡œê·¸??/button>
    `;
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = 'none';
    });
  }
}

// ëª¨ë‹¬ ?œì–´
function openLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.style.display = 'flex';
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.style.display = 'none';
}

// OTP ë°œì†¡ ?”ì²­
async function sendOtp() {
  const emailInput = document.getElementById('login-email');
  const email = emailInput.value.trim();

  if (!email) {
    alert('?´ë©”??ì£¼ì†Œë¥??…ë ¥??ì£¼ì„¸??');
    return;
  }

  // ?„ë©”??ê²€ì¦?  if (!email.endsWith('@sebangtec.com')) {
    alert('?ˆìš©?˜ì? ?Šì? ?„ë©”?¸ì…?ˆë‹¤.\n(ì£??¸ë°©?Œí¬ ?„ì§???„ìš©(@sebangtec.com) ë©”ì¼ë§??´ìš© ê°€?¥í•©?ˆë‹¤.');
    return;
  }

  try {
    const btn = document.getElementById('btn-send-otp');
    btn.disabled = true;
    btn.innerText = 'ë°œì†¡ ì¤?..';

    const res = await API.requestOtp(email);
    btn.disabled = false;
    btn.innerText = '?¬ë°œ??;

    if (res.success) {
      document.getElementById('group-otp').style.display = 'block';
      const msgBox = document.getElementById('otp-status-msg');
      msgBox.style.color = '#1864ab';
      // ë¡œì»¬ ê°œë°œ ëª¨ë“œ ?ˆë‚´
      msgBox.innerHTML = `?¸ì¦ë²ˆí˜¸ê°€ ë°œì†¡?˜ì—ˆ?µë‹ˆ??<br><small style="color:#d9480f;">[ë¡œì»¬ ?ŒìŠ¤??ëª¨ë“œ] ì½˜ì†” ?ëŠ” ?”ë©´ ?¸ì¦ë²ˆí˜¸: <strong>${res.devOtp}</strong></small>`;
      document.getElementById('login-otp').value = res.devOtp || '';
      document.getElementById('login-otp').focus();
    } else {
      alert(res.message || 'OTP ë°œì†¡???¤íŒ¨?ˆìŠµ?ˆë‹¤.');
    }
  } catch (e) {
    alert('?œë²„ ?µì‹  ?¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.');
  }
}

// OTP ìµœì¢… ê²€ì¦?async function verifyOtp() {
  const email = document.getElementById('login-email').value.trim();
  const otp = document.getElementById('login-otp').value.trim();

  if (!otp) {
    alert('?¸ì¦ë²ˆí˜¸ë¥??…ë ¥?˜ì„¸??');
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
      alert(`?˜ì˜?©ë‹ˆ?? ${res.email} ?? (ê¶Œí•œ: ${res.isAdmin ? 'ê´€ë¦¬ì' : '?¼ë°˜ ?¬ìš©??})`);
      closeLoginModal();
      renderUserStatus();
      if (typeof onLoginSuccess === 'function') onLoginSuccess();
    } else {
      alert(res.message || '?¸ì¦ë²ˆí˜¸ê°€ ?¼ì¹˜?˜ì? ?ŠìŠµ?ˆë‹¤.');
    }
  } catch (e) {
    alert('?¸ì¦ ì²˜ë¦¬ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.');
  }
}

// ê´€ë¦¬ì ê´€ë¦?ëª¨ë‹¬ ?œì–´
async function openAdminModal() {
  if (!AUTH.isAdmin()) {
    alert('ê´€ë¦¬ì ê¶Œí•œ???„ìš”?©ë‹ˆ??');
    return;
  }
  const modal = document.getElementById('admin-modal');
  if (modal) {
    modal.style.display = 'flex';
    // ê¸°ë³¸?¼ë¡œ ?œì? ê·œì • ???œì„±??    switchAdminTab('docs');
  }
}

function closeAdminModal() {
  const modal = document.getElementById('admin-modal');
  if (modal) modal.style.display = 'none';
}

// ê´€ë¦¬ì ëª¨ë‹¬ ???„í™˜ ('docs': ê·œì • ?œÂ·ê°œ??ê´€ë¦? 'sites': ?„ì¥ ë°??„ì¥?Œì¥ ê´€ë¦? 'accounts': ê³„ì • ê¶Œí•œ ê´€ë¦?
function switchAdminTab(tabName) {
  const tabDocs = document.getElementById('admin-tab-pane-docs');
  const tabSites = document.getElementById('admin-tab-pane-sites');
  const tabAccounts = document.getElementById('admin-tab-pane-accounts');
  const btnDocs = document.getElementById('tab-btn-docs');
  const btnSites = document.getElementById('tab-btn-sites');
  const btnAccounts = document.getElementById('tab-btn-accounts');

  // ?„ì²´ ?¨ë„ ?¨ê?
  if (tabDocs) tabDocs.style.display = 'none';
  if (tabSites) tabSites.style.display = 'none';
  if (tabAccounts) tabAccounts.style.display = 'none';

  // ??ë²„íŠ¼ ?¤í???ì´ˆê¸°??  [btnDocs, btnSites, btnAccounts].forEach(btn => {
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
// [?„ì¥ ë°??„ì¥?Œì¥ ê´€ë¦?ë¡œì§ (2026 ?„ì¥ëª©ë¡ ?Œì‹± ?°ë™)]
// -------------------------------------------------------------
let cachedAdminSites = [];

// ?„ì¥ ëª©ë¡ ?Œë”ë§?async function renderAdminSiteList(fetchFromApi = true) {
  const tbody = document.getElementById('admin-site-list-tbody');
  const badge = document.getElementById('site-count-badge');
  if (!tbody) return;

  if (fetchFromApi || cachedAdminSites.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:25px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> ?„ì¥ ë°??„ì¥?Œì¥ ëª©ë¡??ë¶ˆëŸ¬?¤ëŠ” ì¤?..</td></tr>`;
    try {
      cachedAdminSites = await API.getSites();
    } catch (e) {
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:25px; color:#ef4444;">?„ì¥ ëª©ë¡??ë¶ˆëŸ¬?¤ì? ëª»í–ˆ?µë‹ˆ??</td></tr>`;
      return;
    }
  }

  // ê²€?‰ì–´ ?„í„°ë§?  const searchInput = document.getElementById('admin-site-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let filtered = cachedAdminSites;
  if (query) {
    filtered = cachedAdminSites.filter(s => {
      const code = (s.code || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      const mgrStr = (s.managers || []).join(' ').toLowerCase();
      return code.includes(query) || name.includes(query) || mgrStr.includes(query);
    });
  }

  // ?µê³„ ë±ƒì? ?…ë°?´íŠ¸
  if (badge) {
    const assignedCount = cachedAdminSites.filter(s => s.managers && s.managers.length > 0).length;
    badge.innerText = `ì´?${cachedAdminSites.length}ê°??„ì¥ (ë°°ì¹˜: ${assignedCount}ê°?/ ë¯¸ë°°ì¹? ${cachedAdminSites.length - assignedCount}ê°?`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:25px; color:#64748b;">?¼ì¹˜?˜ëŠ” ?„ì¥???†ìŠµ?ˆë‹¤.</td></tr>`;
    return;
  }

  let html = '';
  filtered.forEach(site => {
    const managers = site.managers || [];
    let mgrBadgesHtml = '';

    if (managers.length === 0) {
      mgrBadgesHtml = '<span style="color:#ef4444; font-size:12px; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> ë¯¸ì???/span>';
    } else {
      managers.forEach(m => {
        mgrBadgesHtml += `
          <span style="background:#f1f5f9; border:1px solid #cbd5e1; padding:2px 8px; border-radius:12px; font-size:12px; display:inline-flex; align-items:center; gap:4px; margin:2px;">
            <i class="fa-solid fa-user-tie" style="color:#0284c7; font-size:11px;"></i>
            <strong>${escapeHtml(m)}</strong>
            <button type="button" onclick="removeSiteManager('${escapeHtml(site.id)}', '${escapeHtml(m)}')" title="?„ì¥?Œì¥ ?? œ" style="border:none; background:none; color:#ef4444; font-size:14px; cursor:pointer; padding:0 2px; line-height:1; font-weight:bold;">&times;</button>
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
        <td style="padding:9px 12px; text-align:center; vertical-align:middle;">
          <div style="display:flex; gap:4px; justify-content:center; align-items:center;">
            <input type="text" id="add-mgr-input-${escapeHtml(site.id)}" placeholder="?Œì¥ ?±ëª…" style="width:75px; padding:4px 6px; font-size:12px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" onkeydown="if(event.key==='Enter') addSiteManager('${escapeHtml(site.id)}')">
            <button type="button" class="btn-primary" onclick="addSiteManager('${escapeHtml(site.id)}')" style="padding:4px 8px; font-size:11.5px; border-radius:4px; cursor:pointer; white-space:nowrap;">
              <i class="fa-solid fa-plus"></i> ì¶”ê?
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// ?„ì¥ ëª©ë¡ ê²€???„í„°ë§?(ìºì‹œ ê¸°ë°˜ ë¹ ë¥¸ ?Œë”ë§?
function filterAdminSites() {
  renderAdminSiteList(false);
}

// ?¹ì • ?„ì¥???„ì¥?Œì¥ ì¶”ê?
async function addSiteManager(siteId) {
  const input = document.getElementById(`add-mgr-input-${siteId}`);
  if (!input) return;
  const newName = input.value.trim();

  if (!newName) {
    alert('ì¶”ê????„ì¥?Œì¥???±ëª…???…ë ¥??ì£¼ì‹­?œì˜¤.');
    input.focus();
    return;
  }

  const site = cachedAdminSites.find(s => s.id === siteId);
  if (!site) {
    alert('?„ì¥ ?•ë³´ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.');
    return;
  }

  if (!site.managers) site.managers = [];

  if (site.managers.includes(newName)) {
    alert(`'${newName}' ?˜ì? ?´ë? ë³??„ì¥???„ì¥?Œì¥?¼ë¡œ ?±ë¡?˜ì–´ ?ˆìŠµ?ˆë‹¤.`);
    return;
  }

  // ?„ì¥?Œì¥ ë°°ì—´??ì¶”ê?
  site.managers.push(newName);
  site.manager = site.managers.join(', ');

  try {
    input.disabled = true;
    await API.saveSites(cachedAdminSites);
    input.value = '';
    renderAdminSiteList(false);
  } catch (err) {
    alert('?„ì¥?Œì¥ ì¶”ê? ?€??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.');
  } finally {
    input.disabled = false;
  }
}

// ?¹ì • ?„ì¥???„ì¥?Œì¥ ?œê±°
async function removeSiteManager(siteId, managerName) {
  const site = cachedAdminSites.find(s => s.id === siteId);
  if (!site) return;

  if (!confirm(`[${site.name}]\n'${managerName}' ?„ì¥?Œì¥???? œ(?´ì œ)?˜ì‹œê² ìŠµ?ˆê¹Œ?`)) {
    return;
  }

  site.managers = (site.managers || []).filter(m => m !== managerName);
  site.manager = site.managers.join(', ');

  try {
    await API.saveSites(cachedAdminSites);
    renderAdminSiteList(false);
  } catch (err) {
    alert('?„ì¥?Œì¥ ?? œ ?€??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.');
  }
}

// ê´€ë¦¬ì ëª¨ë‹¬ ??ê·œì • ëª©ë¡ ?Œë”ë§?(ë§¤ë‰´?? ?ˆì°¨?? ì§€ì¹¨ì„œ)
async function renderAdminDocList() {
  const tbody = document.getElementById('admin-doc-list-tbody');
  if (!tbody) return;

  const filterSelect = document.getElementById('admin-filter-category');
  const selectedCat = filterSelect ? filterSelect.value : 'ALL';

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> ê·œì • ëª©ë¡ ë¶ˆëŸ¬?¤ëŠ” ì¤?..</td></tr>`;

  try {
    const docs = await API.getDocuments();
    let filtered = docs;
    if (selectedCat !== 'ALL') {
      filtered = docs.filter(d => d.category === selectedCat);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">?´ë‹¹ ì¹´í…Œê³ ë¦¬??ê·œì •???†ìŠµ?ˆë‹¤.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    filtered.forEach(doc => {
      let catBadge = '';
      if (doc.category === 'MANUAL') {
        catBadge = '<span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-weight:700; font-size:11px;">ë§¤ë‰´??/span>';
      } else if (doc.category === 'PROCEDURE') {
        catBadge = '<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:4px; font-weight:700; font-size:11px;">?ˆì°¨??/span>';
      } else if (doc.category === 'INSTRUCTION') {
        catBadge = '<span style="background:#ecfdf5; color:#047857; padding:2px 8px; border-radius:4px; font-weight:700; font-size:11px;">ì§€ì¹¨ì„œ</span>';
      } else {
        catBadge = '<span style="background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:4px; font-weight:600; font-size:11px;">?œì?</span>';
      }

      rowsHtml += `
        <tr style="border-bottom:1px solid #f1f5f9; transition:background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='transparent'">
          <td style="padding:10px 12px; vertical-align:middle;">${catBadge}</td>
          <td style="padding:10px 12px; font-weight:600; color:#1e293b; vertical-align:middle;">${escapeHtml(doc.docNumber || '-')}</td>
          <td style="padding:10px 12px; vertical-align:middle;">
            <a href="detail.html?id=${encodeURIComponent(doc.id)}" style="color:#1d4ed8; text-decoration:none; font-weight:600;" title="ë¬¸ì„œ ë³´ê¸°">
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
              <i class="fa-solid fa-file-pen"></i> ê°œì •/?¸ì§‘
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#ef4444;">ê·œì • ëª©ë¡??ë¶ˆëŸ¬?¤ì? ëª»í–ˆ?µë‹ˆ??</td></tr>`;
  }
}

// ê´€ë¦¬ì ëª¨ë‹¬?ì„œ ê°œì •/?¸ì§‘ ë²„íŠ¼ ?´ë¦­ ???™ì‘
function openAdminDocEdit(docId) {
  closeAdminModal();
  // ?„ì¬ ?ì„¸ ?˜ì´ì§€?´ê³  ?„ì¬ ë³´ê³  ?ˆëŠ” ë¬¸ì„œ??ê²½ìš° ì¦‰ì‹œ ?ë””??ëª¨ë‹¬ ?¤í–‰
  if (typeof currentDoc !== 'undefined' && currentDoc && currentDoc.id === docId && typeof openDraftEditorModal === 'function') {
    openDraftEditorModal();
  } else {
    // ?¤ë¥¸ ë¬¸ì„œ?´ê±°??index.html??ê²½ìš° detail.html?id=...&action=edit ë¡??´ë™
    window.location.href = `detail.html?id=${encodeURIComponent(docId)}&action=edit`;
  }
}

async function loadAdminList() {
  const listEl = document.getElementById('admin-email-list');
  if (!listEl) return;
  try {
    const data = await API.getAdmins();
    listEl.innerHTML = '';

    // 1. ìµœê³  ê´€ë¦¬ì (Super Admins) ë¨¼ì? ê³ ì • ?Œë”ë§?    SUPER_ADMINS.forEach(email => {
      const li = document.createElement('li');
      li.style.backgroundColor = '#fff9db';
      li.style.borderLeft = '3px solid #f59f00';
      li.innerHTML = `
        <span><i class="fa-solid fa-crown" style="color:#f59f00;"></i> <strong>${email}</strong> <small style="color:#d9480f;font-weight:700;margin-left:6px;">[ìµœê³  ê´€ë¦¬ì]</small></span>
        <span style="font-size:11px;color:#862e9c;padding:2px 8px;background:#f3d9fa;border-radius:3px;font-weight:bold;">ê³ ì • ê¶Œí•œ</span>
      `;
      listEl.appendChild(li);
    });

    // 2. ?¼ë°˜ ê´€ë¦¬ì ëª©ë¡
    const otherAdmins = (data.admins || []).filter(e => !SUPER_ADMINS.includes(e.toLowerCase()));
    otherAdmins.forEach(email => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span><i class="fa-solid fa-user-shield" style="color:#1971c2;"></i> ${email} <small style="color:#666;margin-left:6px;">[?¼ë°˜ ê´€ë¦¬ì]</small></span>
        <button class="btn-delete-sm" onclick="removeAdminEmail('${email}')">?? œ</button>
      `;
      listEl.appendChild(li);
    });
  } catch (e) {
    listEl.innerHTML = '<li>ëª©ë¡??ë¶ˆëŸ¬?¤ì? ëª»í–ˆ?µë‹ˆ??</li>';
  }
}

async function addAdminEmail() {
  if (!AUTH.isSuperAdmin()) {
    alert('??ê´€ë¦¬ì ì¶”ê???ìµœê³  ê´€ë¦¬ì(nschoi, sb06)ë§?ê°€?¥í•©?ˆë‹¤.');
    return;
  }

  const input = document.getElementById('new-admin-email');
  const email = input.value.trim().toLowerCase();
  if (!email || !email.endsWith('@sebangtec.com')) {
    alert('@sebangtec.com ?¬ë‚´ ?´ë©”?¼ì„ ?•í™•???…ë ¥?˜ì„¸??');
    return;
  }

  const data = await API.getAdmins();
  const admins = data.admins || [];
  if (SUPER_ADMINS.includes(email) || admins.map(a => a.toLowerCase()).includes(email)) {
    alert('?´ë? ?±ë¡??ê´€ë¦¬ì?…ë‹ˆ??');
    return;
  }

  admins.push(email);
  await API.saveAdmins(admins);
  input.value = '';
  loadAdminList();
  alert('ê´€ë¦¬ìê°€ ì¶”ê??˜ì—ˆ?µë‹ˆ??');
}

async function removeAdminEmail(email) {
  if (SUPER_ADMINS.includes(email.toLowerCase())) {
    alert('ìµœê³  ê´€ë¦¬ì(nschoi@sebangtec.com, sb06@sebangtec.com)??ê¶Œí•œ?€ ?? œ?????†ìŠµ?ˆë‹¤.');
    return;
  }

  if (!AUTH.isSuperAdmin()) {
    alert('ê´€ë¦¬ì ê¶Œí•œ ?? œ??ìµœê³  ê´€ë¦¬ì(nschoi, sb06)ë§?ê°€?¥í•©?ˆë‹¤.');
    return;
  }

  if (!confirm(`${email} ê´€ë¦¬ì ê¶Œí•œ???? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?`)) return;
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

// ì´ˆê¸° ë¡œë”© ??ê²Œì´???•ì¸ ë°??íƒœ ë°??Œë”ë§?window.addEventListener('DOMContentLoaded', () => {
  checkGateAccess();
  renderUserStatus();
});
