/**
 * 백엔드 REST API & Google Apps Script 하이브리드 통신 클라이언트
 * (로컬 Java 서버 및 GitHub Pages 정적 배포 양방향 지원)
 */
const GAS_URL = "https://script.google.com/macros/s/AKfycbz_eDVQVSNSNQ7D7WuPgZ1j7emKQdVK6M5bXyI2rScV51OjoSbKKuAhgrgA7Y5yvwCsaw/exec";

async function callGasDirect(payload) {
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (e) {
    console.error('GAS 직접 통신 오류:', e);
    return { success: false, message: '인증 서버 통신 실패' };
  }
}

const API = {
  // 사이트 초기 접속 비밀번호(게이트) 검증
  async verifyGatePassword(password) {
    try {
      const res = await fetch('/api/gate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) return await res.json();
    } catch (ignored) {}

    // 로컬 백엔드가 없거나 GitHub Pages 정적 호스팅인 경우 GAS 직접 호출
    return await callGasDirect({ action: 'VERIFY_GATE_PASSWORD', password });
  },

  // 문서 전체 목록 조회
  async getDocuments() {
    let docs = [];
    try {
      const res = await fetch('/api/documents');
      if (res.ok) docs = await res.json();
    } catch (ignored) {}

    // 정적 파일 폴백
    if (!docs || docs.length === 0) {
      try {
        const res = await fetch('data/documents_index.json');
        if (res.ok) docs = await res.json();
      } catch (ignored) {}
    }

    // 로컬스토리지에 추가/수정/삭제된 문서 오버라이드 반영
    const deletedIds = JSON.parse(localStorage.getItem('deleted_doc_ids') || '[]');
    docs = docs.filter(d => !deletedIds.includes(d.id));

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('doc_')) {
        const id = k.substring(4);
        if (!deletedIds.includes(id)) {
          try {
            const localDoc = JSON.parse(localStorage.getItem(k));
            const existingIdx = docs.findIndex(d => d.id === id);
            if (existingIdx >= 0) {
              docs[existingIdx] = localDoc;
            } else {
              docs.push(localDoc);
            }
          } catch (e) {}
        }
      }
    }

    return docs;
  },

  // 특정 문서 단건 조회
  async getDocument(docId) {
    // 로컬스토리지 오버라이드 확인
    const local = localStorage.getItem('doc_' + docId);
    if (local) {
      try { return JSON.parse(local); } catch (e) {}
    }

    try {
      const res = await fetch(`/api/documents/${docId}`);
      if (res.ok) return await res.json();
    } catch (ignored) {}

    // 정적 파일 폴백
    const res = await fetch(`data/documents/${docId}.json`);
    if (!res.ok) throw new Error('문서를 찾을 수 없습니다.');
    return await res.json();
  },

  // 문서 저장 (신규 등록 or 개정 발행)
  async saveDocument(docData) {
    // 삭제 목록에서 제거 (재등록 시)
    const deletedIds = JSON.parse(localStorage.getItem('deleted_doc_ids') || '[]');
    const newDeleted = deletedIds.filter(id => id !== docData.id);
    localStorage.setItem('deleted_doc_ids', JSON.stringify(newDeleted));

    // 정적 및 오프라인 환경을 위해 항상 로컬스토리지에도 저장
    localStorage.setItem('doc_' + docData.id, JSON.stringify(docData));

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docData)
      });
      if (res.ok) return await res.json();
    } catch (ignored) {}

    return { success: true, message: '규정이 성공적으로 등록/발행되었습니다.' };
  },

  // 규정 폐지 / 삭제
  async deleteDocument(docId) {
    // 로컬스토리지 오버라이드 및 삭제 기록
    localStorage.removeItem('doc_' + docId);
    const deletedIds = JSON.parse(localStorage.getItem('deleted_doc_ids') || '[]');
    if (!deletedIds.includes(docId)) {
      deletedIds.push(docId);
      localStorage.setItem('deleted_doc_ids', JSON.stringify(deletedIds));
    }

    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE'
      });
      if (res.ok) return await res.json();
    } catch (ignored) {}

    return { success: true, message: '규정이 폐지/삭제되었습니다.' };
  },

  // 통합 검색
  async search(query) {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) return await res.json();
    } catch (ignored) {}

    // 클라이언트 측 검색 폴백
    const docs = await this.getDocuments();
    const q = query.toLowerCase();
    const results = [];
    for (const d of docs) {
      const full = await this.getDocument(d.id);
      if (JSON.stringify(full).toLowerCase().includes(q)) {
        results.push(full);
      }
    }
    return results;
  },

  // OTP 발송 요청
  async requestOtp(email) {
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) return await res.json();
    } catch (ignored) {}

    return await callGasDirect({ action: 'REQUEST_OTP', email });
  },

  // OTP 검증 및 로그인
  async verifyOtp(email, otp) {
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      if (res.ok) return await res.json();
    } catch (ignored) {}

    return await callGasDirect({ action: 'VERIFY_OTP', email, otp });
  },

  // 관리자 목록 조회
  async getAdmins() {
    try {
      const res = await fetch('/api/admins');
      if (res.ok) return await res.json();
    } catch (ignored) {}

    try {
      const res = await fetch('data/admins.json');
      if (res.ok) return await res.json();
    } catch (ignored) {}

    return { admins: ['sb06@sebangtec.com', 'nschoi@sebangtec.com'] };
  },

  // 관리자 목록 갱신
  async saveAdmins(adminsArray) {
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admins: adminsArray })
      });
      if (res.ok) return await res.json();
    } catch (ignored) {}

    localStorage.setItem('sebang_admins', JSON.stringify(adminsArray));
    return { success: true, message: '관리자 목록이 갱신되었습니다.' };
  },

  // 인쇄 감사 로그 기록
  async logPrint(docId, docTitle, userEmail) {
    try {
      await fetch('/api/logs/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, docTitle, userEmail })
      });
    } catch (ignored) {}

    // GAS로도 직접 전송
    callGasDirect({ action: 'LOG_PRINT', docId, docTitle, userEmail });
  },

  // 현장 목록 조회 (GET /api/sites, 정적 파일 및 로컬스토리지 폴백 지원)
  async getSites() {
    let sites = null;
    try {
      const res = await fetch('/api/sites');
      if (res.ok) sites = await res.json();
    } catch (ignored) {}

    if (!sites || sites.length === 0) {
      try {
        const res = await fetch('data/sites.json');
        if (res.ok) sites = await res.json();
      } catch (ignored) {}
    }

    // 로컬스토리지에 저장된 현장 목록 변경사항이 있는 경우 오버라이드
    const localSites = localStorage.getItem('sebang_sites');
    if (localSites) {
      try {
        const parsed = JSON.parse(localSites);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }

    return sites || [];
  },

  // 현장 목록 및 현장소장 정보 저장 (POST /api/sites)
  async saveSites(sitesArray) {
    // 항상 로컬스토리지에 즉시 동기화 보존
    localStorage.setItem('sebang_sites', JSON.stringify(sitesArray));

    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sitesArray)
      });
      if (res.ok) return await res.json();
    } catch (ignored) {}

    return { success: true, message: '현장소장 및 현장 정보가 저장되었습니다.' };
  },

  // 방문자 카운터 조회 (GET /api/counter)
  async getVisitorCounter(sourceOverride) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const ref = sourceOverride || urlParams.get('ref') || (document.referrer ? new URL(document.referrer).hostname : '') || '';
      const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
      const res = await fetch(`/api/counter${query}`);
      if (res.ok) return await res.json();
    } catch (ignored) {}

    // 정적 배포(GitHub Pages 등) 폴백: localStorage 기반 시뮬레이션
    const todayStr = new Date().toISOString().split('T')[0];
    let counter = {
      total: 14522,
      today: 130,
      todayDate: todayStr,
      sources: {
        "직접 접속 / 즐겨찾기": 8420,
        "사내 그룹웨어": 3210,
        "현장 QR코드 스캔": 1840,
        "모바일 메신저 (카카오톡)": 750,
        "사내 공지메일": 300
      },
      devices: {
        "PC": 9120,
        "모바일": 5402
      },
      recentLogs: [
        { "timestamp": "2026-09-07 09:00:00", "source": "사내 그룹웨어", "device": "PC", "ip": "127.0.0.1" }
      ]
    };
    try {
      const stored = localStorage.getItem('sebang_visitor_counter');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.todayDate === todayStr) {
          counter = { ...parsed, total: parsed.total + 1, today: parsed.today + 1 };
        } else {
          counter = { ...parsed, total: parsed.total + 1, today: 1, todayDate: todayStr };
        }
      }
      localStorage.setItem('sebang_visitor_counter', JSON.stringify(counter));
    } catch (e) {}

    return counter;
  },

  // 서식 목록 조회 (GET /api/forms)
  async getForms() {
    let forms = null;
    try {
      const res = await fetch('/api/forms');
      if (res.ok) forms = await res.json();
    } catch (ignored) {}

    if (!forms || forms.length === 0) {
      try {
        const res = await fetch('data/forms_index.json');
        if (res.ok) forms = await res.json();
      } catch (ignored) {}
    }

    // 로컬스토리지에 저장된 사용자 정의 서식 병합
    const customForms = JSON.parse(localStorage.getItem('sebang_custom_forms') || '[]');
    let merged = Array.isArray(forms) ? [...forms] : [];
    customForms.forEach(cf => {
      const existingIdx = merged.findIndex(m => m.id === cf.id);
      const meta = {
        id: cf.id,
        category: cf.category || 'CUSTOM',
        categoryName: cf.categoryName || '맞춤서식',
        title: cf.title,
        docNumber: cf.docNumber,
        version: cf.version || 'Rev.1',
        effectiveDate: cf.effectiveDate || new Date().toISOString().split('T')[0],
        department: cf.department || '품질안전보건실',
        description: cf.description || cf.title
      };
      if (existingIdx >= 0) {
        merged[existingIdx] = meta;
      } else {
        merged.push(meta);
      }
    });

    return merged;
  },

  // 개별 서식 템플릿 조회 (GET /api/forms/{id})
  async getForm(formId) {
    // 로컬스토리지 우선 확인
    const customForms = JSON.parse(localStorage.getItem('sebang_custom_forms') || '[]');
    const foundCustom = customForms.find(f => f.id === formId);
    if (foundCustom) return foundCustom;

    try {
      const res = await fetch(`/api/forms/${formId}`);
      if (res.ok) return await res.json();
    } catch (ignored) {}

    // 정적 파일 폴백
    try {
      const res = await fetch(`data/forms/${formId}.json`);
      if (res.ok) return await res.json();
    } catch (ignored) {}

    throw new Error('서식 템플릿을 찾을 수 없습니다.');
  },

  // 신규 서식 및 결재선 등록/저장 (POST /api/forms)
  async saveForm(formData) {
    // 항상 로컬스토리지에 즉시 동기화 백업
    const customForms = JSON.parse(localStorage.getItem('sebang_custom_forms') || '[]');
    const idx = customForms.findIndex(f => f.id === formData.id);
    if (idx >= 0) {
      customForms[idx] = formData;
    } else {
      customForms.push(formData);
    }
    localStorage.setItem('sebang_custom_forms', JSON.stringify(customForms));

    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) return await res.json();
    } catch (ignored) {}

    return { success: true, message: '서식이 성공적으로 저장되었습니다.', id: formData.id };
  }
};

