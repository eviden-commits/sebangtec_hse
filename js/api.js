/**
 * ë°±ì—”??REST API & Google Apps Script ?˜ì´ë¸Œë¦¬???µì‹  ?´ë¼?´ì–¸?? * (ë¡œì»¬ Java ?œë²„ ë°?GitHub Pages ?•ì  ë°°í¬ ?‘ë°©??ì§€??
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
    console.error('GAS ì§ì ‘ ?µì‹  ?¤ë¥˜:', e);
    return { success: false, message: '?¸ì¦ ?œë²„ ?µì‹  ?¤íŒ¨' };
  }
}

const API = {
  // ?¬ì´??ì´ˆê¸° ?‘ì† ë¹„ë?ë²ˆí˜¸(ê²Œì´?? ê²€ì¦?  async verifyGatePassword(password) {
    try {
      const res = await fetch('/api/gate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) return await res.json();
    } catch (ignored) {}

    // ë¡œì»¬ ë°±ì—”?œê? ?†ê±°??GitHub Pages ?•ì  ?¸ìŠ¤?…ì¸ ê²½ìš° GAS ì§ì ‘ ?¸ì¶œ
    return await callGasDirect({ action: 'VERIFY_GATE_PASSWORD', password });
  },

  // ë¬¸ì„œ ?„ì²´ ëª©ë¡ ì¡°íšŒ
  async getDocuments() {
    let docs = [];
    try {
      const res = await fetch('/api/documents');
      if (res.ok) docs = await res.json();
    } catch (ignored) {}

    // ?•ì  ?Œì¼ ?´ë°±
    if (!docs || docs.length === 0) {
      try {
        const res = await fetch('data/documents_index.json');
        if (res.ok) docs = await res.json();
      } catch (ignored) {}
    }

    // ë¡œì»¬?¤í† ë¦¬ì???ì¶”ê?/?˜ì •/?? œ??ë¬¸ì„œ ?¤ë²„?¼ì´??ë°˜ì˜
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

  // ?¹ì • ë¬¸ì„œ ?¨ê±´ ì¡°íšŒ
  async getDocument(docId) {
    // ë¡œì»¬?¤í† ë¦¬ì? ?¤ë²„?¼ì´???•ì¸
    const local = localStorage.getItem('doc_' + docId);
    if (local) {
      try { return JSON.parse(local); } catch (e) {}
    }

    try {
      const res = await fetch(`/api/documents/${docId}`);
      if (res.ok) return await res.json();
    } catch (ignored) {}

    // ?•ì  ?Œì¼ ?´ë°±
    const res = await fetch(`data/documents/${docId}.json`);
    if (!res.ok) throw new Error('ë¬¸ì„œë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.');
    return await res.json();
  },

  // ë¬¸ì„œ ?€??(? ê·œ ?±ë¡ or ê°œì • ë°œí–‰)
  async saveDocument(docData) {
    // ?? œ ëª©ë¡?ì„œ ?œê±° (?¬ë“±ë¡???
    const deletedIds = JSON.parse(localStorage.getItem('deleted_doc_ids') || '[]');
    const newDeleted = deletedIds.filter(id => id !== docData.id);
    localStorage.setItem('deleted_doc_ids', JSON.stringify(newDeleted));

    // ?•ì  ë°??¤í”„?¼ì¸ ?˜ê²½???„í•´ ??ƒ ë¡œì»¬?¤í† ë¦¬ì??ë„ ?€??    localStorage.setItem('doc_' + docData.id, JSON.stringify(docData));

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docData)
      });
      if (res.ok) return await res.json();
    } catch (ignored) {}

    return { success: true, message: 'ê·œì •???±ê³µ?ìœ¼ë¡??±ë¡/ë°œí–‰?˜ì—ˆ?µë‹ˆ??' };
  },

  // ê·œì • ?ì? / ?? œ
  async deleteDocument(docId) {
    // ë¡œì»¬?¤í† ë¦¬ì? ?¤ë²„?¼ì´??ë°??? œ ê¸°ë¡
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

    return { success: true, message: 'ê·œì •???ì?/?? œ?˜ì—ˆ?µë‹ˆ??' };
  },

  // ?µí•© ê²€??  async search(query) {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) return await res.json();
    } catch (ignored) {}

    // ?´ë¼?´ì–¸??ì¸?ê²€???´ë°±
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

  // OTP ë°œì†¡ ?”ì²­
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

  // OTP ê²€ì¦?ë°?ë¡œê·¸??  async verifyOtp(email, otp) {
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

  // ê´€ë¦¬ì ëª©ë¡ ì¡°íšŒ
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

  // ê´€ë¦¬ì ëª©ë¡ ê°±ì‹ 
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
    return { success: true, message: 'ê´€ë¦¬ì ëª©ë¡??ê°±ì‹ ?˜ì—ˆ?µë‹ˆ??' };
  },

  // ?¸ì‡„ ê°ì‚¬ ë¡œê·¸ ê¸°ë¡
  async logPrint(docId, docTitle, userEmail) {
    try {
      await fetch('/api/logs/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, docTitle, userEmail })
      });
    } catch (ignored) {}

    // GASë¡œë„ ì§ì ‘ ?„ì†¡
    callGasDirect({ action: 'LOG_PRINT', docId, docTitle, userEmail });
  },

  // ?„ì¥ ëª©ë¡ ì¡°íšŒ (GET /api/sites, ?•ì  ?Œì¼ ë°?ë¡œì»¬?¤í† ë¦¬ì? ?´ë°± ì§€??
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

    // ë¡œì»¬?¤í† ë¦¬ì????€?¥ëœ ?„ì¥ ëª©ë¡ ë³€ê²½ì‚¬??´ ?ˆëŠ” ê²½ìš° ?¤ë²„?¼ì´??    const localSites = localStorage.getItem('sebang_sites');
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

  // ?„ì¥ ëª©ë¡ ë°??„ì¥?Œì¥ ?•ë³´ ?€??(POST /api/sites)
  async saveSites(sitesArray) {
    // ??ƒ ë¡œì»¬?¤í† ë¦¬ì???ì¦‰ì‹œ ?™ê¸°??ë³´ì¡´
    localStorage.setItem('sebang_sites', JSON.stringify(sitesArray));

    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sitesArray)
      });
      if (res.ok) return await res.json();
    } catch (ignored) {}

    return { success: true, message: '?„ì¥?Œì¥ ë°??„ì¥ ?•ë³´ê°€ ?€?¥ë˜?ˆìŠµ?ˆë‹¤.' };
  }
};

