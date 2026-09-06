/**
 * ?ì„¸ ë¬¸ì„œ ë·°ì–´, ë³´ì•ˆ ?¸ì‡„ ?Œí„°ë§ˆí¬, ? êµ¬?€ì¡? ?„ì‹œê²©ë¦¬ ?¹ì—?”í„° ë¡œì§ (detail.js)
 */
let currentDoc = null;
let allDocs = [];
let activeClauseId = null;

// ?„ì‹œ ë©”ëª¨ë¦?ê²©ë¦¬ ?ë””???íƒœ (Sandbox Draft)
let draftDoc = null;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const docId = params.get('id') || 'MAN-KOSHA-01';
  const clauseParam = params.get('clause') || window.location.hash.replace('#', '');
  const searchKeyword = params.get('q');
  const actionParam = params.get('action');

  await loadAllDocuments();
  await loadDocument(docId, clauseParam, searchKeyword);

  // ê´€ë¦¬ì ?¤ì • ëª¨ë‹¬ ?±ì—???action=edit ë¡?ì§„ì…??ê²½ìš° ì¦‰ì‹œ ?ë””???¤í”ˆ
  if (actionParam === 'edit') {
    setTimeout(() => {
      if (AUTH.isAdmin()) {
        openDraftEditorModal();
      } else {
        alert('ê·œì • ?œÂ·ê°œ?•ì„ ?„í•´?œëŠ” ê´€ë¦¬ì ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??');
        openLoginModal();
      }
    }, 350);
  }
});

// ?„ì²´ ë¬¸ì„œ ë¡œë“œ (?¸ë¦¬ êµ¬ì„±??
async function loadAllDocuments() {
  try {
    allDocs = await API.getDocuments();
  } catch (e) {
    console.error(e);
  }
}

// ê°œë³„ ë¬¸ì„œ ë¡œë“œ ë°??Œë”ë§?async function loadDocument(docId, targetClause, keyword) {
  try {
    currentDoc = await API.getDocument(docId);
    renderDocument(currentDoc);
    renderHierarchyTree(docId);
    renderClauseJumpList();

    // ì¦ê²¨ì°¾ê¸° ?íƒœ ê°±ì‹ 
    updateBookmarkButton();

    // ìµœê³  ê´€ë¦¬ì ?„êµ¬ ?¸ì¶œ ?¬ë? ?œì–´
    updateSuperAdminToolbar();

    // ?¹ì • ì¡°í•­ ?¥ë§???¤í¬ë¡?    if (targetClause) {
      setTimeout(() => {
        scrollToClause(targetClause);
      }, 200);
    }

    // ê²€?‰ì–´ ?˜ì´?¼ì´??    if (keyword) {
      highlightKeyword(keyword);
    }
  } catch (e) {
    alert('ë¬¸ì„œë¥?ë¶ˆëŸ¬?????†ìŠµ?ˆë‹¤: ' + e.message);
  }
}

function updateSuperAdminToolbar() {
  const saDropdown = document.getElementById('super-admin-dropdown');
  if (saDropdown) {
    saDropdown.style.display = AUTH.isSuperAdmin() ? 'inline-block' : 'none';
  }
  const editBtn = document.getElementById('btn-edit-doc');
  if (editBtn) {
    editBtn.style.display = AUTH.isAdmin() ? 'inline-flex' : 'none';
  }
}

// ë¬¸ì„œ ë³¸ë¬¸ ?Œë”ë§?function renderDocument(doc) {
  document.title = `${doc.title} - ?¸ë°©?Œí¬ KOSHA-MS`;
  document.getElementById('doc-title-bar').innerText = doc.title;
  document.getElementById('doc-main-title').innerText = doc.title;
  document.getElementById('doc-ver-tag').innerText = doc.currentVersion;
  document.getElementById('doc-cat-badge').innerText = getCategoryName(doc.category);

  document.getElementById('meta-doc-num').innerText = doc.docNumber || '-';
  document.getElementById('meta-doc-rev').innerText = doc.currentVersion || '-';
  document.getElementById('meta-doc-date').innerText = doc.effectiveDate || '-';
  document.getElementById('meta-doc-dept').innerText = doc.department || '-';

  const bodyEl = document.getElementById('doc-content-body');
  bodyEl.innerHTML = doc.currentContent || '<p>ë³¸ë¬¸ ?´ìš©???†ìŠµ?ˆë‹¤.</p>';

  // ê°?ì¡°í•­ ?´ë¦­ ?´ë²¤??ë°??µì»¤ ì§€??  bodyEl.querySelectorAll('.doc-article').forEach(art => {
    art.addEventListener('click', () => {
      activeClauseId = art.id;
    });
  });

  // ê³µì‹ 4?¨ê³„ ?¸ì‡„ ?˜ì´ì§€ ?°ì´???œì? ??ê°œì •????? êµ¬ë¹„êµ ??ë³¸ë¬¸) ì¤€ë¹?  preparePrintPages(doc);
}

function getCategoryName(cat) {
  if (cat === 'MANUAL') return 'KOSHA ë§¤ë‰´??;
  if (cat === 'PROCEDURE') return '?ˆì°¨??;
  if (cat === 'INSTRUCTION') return 'ì§€ì¹¨ì„œ';
  return '?¬ë‚´ ?œì?';
}

// ì¢Œì¸¡ ?œì? ì²´ê³„ ?¸ë¦¬ ?Œë”ë§?(+ ?ì‹ ê·œì • ì¶”ê? ë°??ì? ê¸°ëŠ¥ ?°ê³„)
function renderHierarchyTree(currentDocId) {
  const treeArea = document.getElementById('hierarchy-tree-area');
  if (!treeArea) return;
  treeArea.innerHTML = '';

  const isAdminUser = AUTH.isAdmin();

  // ?¸ë¦¬ ?¤ë”???„ì²´ ì¶”ê? ë²„íŠ¼ ?¸ì¶œ ?íƒœ ?™ê¸°??  const addBtn = document.querySelector('.btn-tree-add');
  if (addBtn) {
    addBtn.style.display = isAdminUser ? 'inline-flex' : 'none';
  }

  // ë§¤ë‰´??ì°¾ê¸° (ìµœìƒ??
  const manuals = allDocs.filter(d => d.category === 'MANUAL');

  manuals.forEach(m => {
    const mNode = createTreeNodeElement(m, 0, currentDocId, isAdminUser, 'PROCEDURE');
    treeArea.appendChild(mNode);

    // ?˜ë? ?ˆì°¨?œë“¤
    const procs = allDocs.filter(d => d.parentId === m.id || (m.childrenIds && m.childrenIds.includes(d.id)));
    procs.forEach(p => {
      const pNode = createTreeNodeElement(p, 1, currentDocId, isAdminUser, 'INSTRUCTION');
      treeArea.appendChild(pNode);

      // ?˜ë? ì§€ì¹¨ì„œ??      const insts = allDocs.filter(d => d.parentId === p.id || (p.childrenIds && p.childrenIds.includes(d.id)));
      insts.forEach(ins => {
        const insNode = createTreeNodeElement(ins, 2, currentDocId, isAdminUser, null);
        treeArea.appendChild(insNode);
      });
    });
  });

  // ?ìœ„ê°€ ì§€?•ë˜ì§€ ?Šì? ê¸°í? ?ˆì°¨??ì§€ì¹¨ì„œê°€ ?ˆëŠ” ê²½ìš° ì²˜ë¦¬
  const assignedIds = new Set([
    ...manuals.map(d => d.id),
    ...manuals.flatMap(m => allDocs.filter(d => d.parentId === m.id || (m.childrenIds && m.childrenIds.includes(d.id))).map(d => d.id)),
    ...allDocs.filter(d => d.category === 'INSTRUCTION').map(d => d.id)
  ]);
  const unassigned = allDocs.filter(d => !assignedIds.has(d.id));
  if (unassigned.length > 0) {
    unassigned.forEach(u => {
      const uNode = createTreeNodeElement(u, 1, currentDocId, isAdminUser, null);
      treeArea.appendChild(uNode);
    });
  }
}

// ?¸ë¦¬ ?¸ë“œ ?˜ë¦¬ë¨¼íŠ¸ ?ì„± ?¬í¼
function createTreeNodeElement(doc, depth, currentDocId, isAdminUser, childCategoryToAdd) {
  const node = document.createElement('div');
  node.className = `tree-node depth-${depth} ${doc.id === currentDocId ? 'active' : ''}`;

  let iconHtml = '<i class="fa-solid fa-file-lines"></i>';
  if (depth === 0) iconHtml = '<i class="fa-solid fa-folder-open"></i>';
  else if (depth === 2) iconHtml = '<i class="fa-solid fa-file-code"></i>';

  let actionsHtml = '';
  if (isAdminUser) {
    actionsHtml = '<div class="node-actions">';
    if (childCategoryToAdd) {
      const childName = childCategoryToAdd === 'PROCEDURE' ? '?ˆì°¨?? : 'ì§€ì¹¨ì„œ';
      actionsHtml += `<button type="button" class="btn-node-opt" onclick="event.stopPropagation(); openNewDocModal('${childCategoryToAdd}', '${doc.id}')" title="?˜ìœ„ ${childName} ì¶”ê?"><i class="fa-solid fa-plus"></i></button>`;
    }
    // ìµœìƒ??ë§¤ë‰´??MAN-KOSHA-01)?€ ?ˆì „???„í•´ ?ì? ë²„íŠ¼ ?œì™¸
    if (doc.id !== 'MAN-KOSHA-01') {
      actionsHtml += `<button type="button" class="btn-node-opt opt-del" onclick="event.stopPropagation(); deleteDocumentById('${doc.id}', '${escapeHtml(doc.title)}')" title="ê·œì • ?ì?/?? œ"><i class="fa-solid fa-trash-can"></i></button>`;
    }
    actionsHtml += '</div>';
  }

  node.innerHTML = `
    <div class="node-content" onclick="location.href='detail.html?id=${doc.id}'">
      ${iconHtml}
      <span title="${escapeHtml(doc.title)}">${escapeHtml(doc.title)}</span>
    </div>
    ${actionsHtml}
  `;

  return node;
}

// ì¡°í•­ ëª©ì°¨ ?í”„ ë¦¬ìŠ¤???ì„±
function renderClauseJumpList() {
  const listEl = document.getElementById('clause-nav-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const articles = document.querySelectorAll('.doc-article');
  articles.forEach(art => {
    const titleEl = art.querySelector('.article-title');
    if (titleEl) {
      const text = titleEl.innerText.trim();
      const li = document.createElement('li');
      li.innerHTML = `<a href="javascript:void(0)" onclick="scrollToClause('${art.id}')"><i class="fa-solid fa-angle-right"></i> ${text}</a>`;
      listEl.appendChild(li);
    }
  });
}

function scrollToClause(clauseId) {
  const target = document.getElementById(clauseId);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.style.backgroundColor = '#fff9db';
    setTimeout(() => {
      target.style.backgroundColor = '';
    }, 2000);
    activeClauseId = clauseId;
  }
}

// ë³¸ë¬¸ ??ê²€???˜ì´?¼ì´??function searchInDoc() {
  const keyword = document.getElementById('mini-search-input').value.trim();
  if (!keyword) return;
  highlightKeyword(keyword);
}

function highlightKeyword(keyword) {
  const body = document.getElementById('doc-content-body');
  const innerHtml = currentDoc.currentContent;
  const regex = new RegExp(`(${keyword})`, 'gi');
  body.innerHTML = innerHtml.replace(regex, `<mark style="background:#ffe066;padding:2px 4px;border-radius:2px;">$1</mark>`);
  
  const firstMark = body.querySelector('mark');
  if (firstMark) {
    firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ----------------------------------------------------------------
// [ìµœê³  ê´€ë¦¬ì ?„ìš© ë©”ë‰´ ë°??¸ì‡„/?¤ìš´ë¡œë“œ ?œì–´]
// ----------------------------------------------------------------
function toggleSuperAdminMenu() {
  const menu = document.getElementById('menu-superadmin');
  if (menu) {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }
}

// ?¸ë? ?´ë¦­ ???œë¡­?¤ìš´ ?«ê¸°
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('super-admin-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    const menu = document.getElementById('menu-superadmin');
    if (menu) menu.style.display = 'none';
  }
});

/** 1. ìµœê³  ê´€ë¦¬ì ?„ìš©: ê³µì‹ ê´€ë¦¬ë³¸ ?¸ì‡„ (?Œí„°ë§ˆí¬ ?„ì „ ?? œ & ê´€ë¦¬ë³¸ ?„ì¥) */
async function triggerOfficialControlledPrint() {
  if (!AUTH.isSuperAdmin()) {
    alert('ê´€ë¦¬ë³¸(?Œí„°ë§ˆí¬ ?? œ) ?¸ì‡„??ìµœê³  ê´€ë¦¬ìë§?ê°€?¥í•©?ˆë‹¤.');
    return;
  }

  const user = AUTH.getUser();
  const userEmail = user ? user.email : 'ìµœê³ ê´€ë¦¬ì';
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  // ?Œí„°ë§ˆí¬ ?ˆì´???„ì „ ì´ˆê¸°??(ë°°ê²½ ?Œí„°ë§ˆí¬ ?? œ)
  const watermarkLayer = document.getElementById('print-watermark-layer');
  if (watermarkLayer) {
    watermarkLayer.style.backgroundImage = 'none';
  }

  // ?ë‹¨ ?¤ë”: ê³µì‹ ê´€ë¦¬ë³¸ ?œê¸°
  const headerMeta = document.getElementById('print-watermark-text');
  if (headerMeta) {
    headerMeta.innerHTML = `<strong style="color:#d9480f;font-size:11pt;">[ê´€ë¦¬ë³¸ - CONTROLLED COPY]</strong> | ì¶œë ¥?? ${userEmail} | ì¶œë ¥?¼ì‹œ: ${timeStr} | (ì£??¸ë°©?Œí¬ KOSHA-MS`;
  }

  const classTag = document.getElementById('print-doc-classification-tag');
  if (classTag) {
    classTag.innerHTML = '<strong style="color:#d9480f;">[ê´€ë¦¬ë³¸ - CONTROLLED COPY]</strong>';
  }

  // 4?¨ê³„ ?¸ì‡„ ?°ì´??ìµœì‹ ??  if (currentDoc) preparePrintPages(currentDoc);

  // ê°ì‚¬ ë¡œê·¸ ?„ì†¡
  await API.logPrint(currentDoc.id, currentDoc.title, `${userEmail} [ê´€ë¦¬ë³¸ ì¶œë ¥ / ?Œí„°ë§ˆí¬ ?œì™¸]`);

  // ?œë¡­?¤ìš´ ?«ê¸° ë°??¸ì‡„ ì°??¸ì¶œ
  const menu = document.getElementById('menu-superadmin');
  if (menu) menu.style.display = 'none';

  window.print();
}

/** 2. ?¼ë°˜ ?¬ìš©?ìš©: ë¹„ê?ë¦¬ë³¸ ?¸ì‡„ (?€ê°ì„  ?Œí„°ë§ˆí¬ ê°•ì œ ? ì?) */
async function triggerSecurityPrint() {
  const user = AUTH.getUser();
  const userEmail = user ? user.email : '?¼ë°˜?¬ìš©??ë¹„ê?ë¦¬ë³¸)';
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  // 1. ?¸ì‡„???ë‹¨ ?¤ë” ?ìŠ¤??ì£¼ì… (ë¹„ê?ë¦¬ë³¸ ëª…ì‹œ)
  const headerMeta = document.getElementById('print-watermark-text');
  if (headerMeta) {
    headerMeta.innerText = `ì¶œë ¥?? ${userEmail} | ì¶œë ¥?¼ì‹œ: ${timeStr} | ë¬¸ì„œë³´ì•ˆ: ë¹„ê?ë¦¬ë³¸ (UNCONTROLLED COPY)`;
  }

  const classTag = document.getElementById('print-doc-classification-tag');
  if (classTag) {
    classTag.innerText = '[ë¹„ê?ë¦¬ë³¸ - UNCONTROLLED COPY]';
  }

  // 4?¨ê³„ ?¸ì‡„ ?°ì´??ìµœì‹ ??  if (currentDoc) preparePrintPages(currentDoc);

  // 2. ?€ê°ì„  45??ë°˜íˆ¬ëª??Œí„°ë§ˆí¬ ìº”ë²„???ì„± ë°?ë°°ê²½ ?´ë?ì§€ ê°•ì œ ?ìš©
  const canvas = document.createElement('canvas');
  canvas.width = 460;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  ctx.rotate(-25 * Math.PI / 180);
  ctx.font = 'bold 15px "Pretendard", "Malgun Gothic", sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText('(ì£??¸ë°©?Œí¬ KOSHA-MS [ë¹„ê?ë¦¬ë³¸]', -30, 160);
  ctx.font = '12px "Pretendard", "Malgun Gothic", sans-serif';
  ctx.fillText(`ì¶œë ¥?? ${userEmail}`, -30, 185);
  ctx.fillText(`ì¶œë ¥?¼ì‹œ: ${timeStr}`, -30, 205);

  const watermarkLayer = document.getElementById('print-watermark-layer');
  if (watermarkLayer) {
    watermarkLayer.style.backgroundImage = `url(${canvas.toDataURL()})`;
  }

  // 3. ë°±ì—”?œë¡œ ?¸ì‡„ ê°ì‚¬ ë¡œê·¸ ë¹„ë™ê¸??„ì†¡
  await API.logPrint(currentDoc.id, currentDoc.title, `${userEmail} [ë¹„ê?ë¦¬ë³¸ ì¶œë ¥]`);

  // 4. ?¸ì‡„ ?¤ì´?¼ë¡œê·??¸ì¶œ
  window.print();
}

/** 3. ìµœê³  ê´€ë¦¬ì ?„ìš©: Word (.doc/.docx) ?¤ìš´ë¡œë“œ */
function downloadAsDocx() {
  if (!AUTH.isSuperAdmin()) {
    alert('DOCX ?¤ìš´ë¡œë“œ??ìµœê³  ê´€ë¦¬ìë§?ê°€?¥í•©?ˆë‹¤.');
    return;
  }

  const docHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${currentDoc.title}</title>
    <style>
      body { font-family: 'Malgun Gothic', 'ë§‘ì? ê³ ë”•', sans-serif; line-height: 1.7; font-size: 11pt; color: #111; }
      table.doc-header-tbl { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
      table.doc-header-tbl th, table.doc-header-tbl td { border: 1px solid #333; padding: 7px 10px; font-size: 10pt; }
      table.doc-header-tbl th { background-color: #f1f3f5; }
      h1.main-title { text-align: center; font-size: 22pt; margin: 30px 0 20px 0; color: #194a9a; border-bottom: 2px solid #194a9a; padding-bottom: 10px; }
      .doc-article { margin-bottom: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 12px; }
      .article-title { font-size: 13pt; color: #0b3a75; font-weight: bold; margin-bottom: 6px; }
      .art-num { color: #d9480f; font-weight: bold; }
      .article-body { text-indent: 10px; line-height: 1.8; margin-bottom: 5px; }
      .rev-badge { color: #1864ab; font-size: 9pt; }
    </style></head>
    <body>
      <table class="doc-header-tbl">
        <tr>
          <th colspan="4" style="text-align:center;font-size:13pt;background-color:#194a9a;color:#ffffff;font-weight:bold;">
            (ì£??¸ë°©?Œí¬ ?ˆì „ë³´ê±´ê²½ì˜?œìŠ¤???œì? [ê´€ë¦¬ë³¸]
          </th>
        </tr>
        <tr>
          <th width="20%">ë¬¸ì„œë²ˆí˜¸</th><td width="30%">${currentDoc.docNumber || '-'}</td>
          <th width="20%">?œÂ·ê°œ?•êµ¬ë¶?/th><td width="30%">${currentDoc.currentVersion || '-'}</td>
        </tr>
        <tr>
          <th>?œí–‰?¼ì</th><td>${currentDoc.effectiveDate || '-'}</td>
          <th>ì£¼ê?ë¶€??/th><td>${currentDoc.department || '-'}</td>
        </tr>
      </table>
      <h1 class="main-title">${currentDoc.title}</h1>
      <div>${currentDoc.currentContent || ''}</div>
    </body></html>
  `;

  const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `[?¸ë°©?Œí¬]_${currentDoc.docNumber}_${currentDoc.title}_(${currentDoc.currentVersion}).doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // ë©”ë‰´ ?«ê¸°
  const menu = document.getElementById('menu-superadmin');
  if (menu) menu.style.display = 'none';
}

/** 4. ìµœê³  ê´€ë¦¬ì ?„ìš©: PDF ?¤ìš´ë¡œë“œ (?Œí„°ë§ˆí¬ ?œì™¸ ?´ë¦° PDF) */
function downloadAsPdf() {
  if (!AUTH.isSuperAdmin()) {
    alert('PDF ?¤ìš´ë¡œë“œ??ìµœê³  ê´€ë¦¬ìë§?ê°€?¥í•©?ˆë‹¤.');
    return;
  }
  // ?Œí„°ë§ˆí¬ ?†ëŠ” ê³µì‹ ê´€ë¦¬ë³¸ ?¸ì‡„ ?¸ë¦¬ê±????€?ì—??"PDFë¡??€?? ? íƒ ? ë„
  alert("?ˆë‚´: ?¸ì‡„ ?¤ì´?¼ë¡œê·?ì°½ì—??[?€?? PDFë¡??€????? íƒ?˜ì‹œë©??Œí„°ë§ˆí¬ê°€ ?†ëŠ” ê³ í™”ì§??´ë¦° PDFë¡??¤ìš´ë¡œë“œ?©ë‹ˆ??");
  triggerOfficialControlledPrint();
}

// ----------------------------------------------------------------
// [URL ?¨ì¶• / ?¥ë§??ê³µìœ ]
// ----------------------------------------------------------------
function copyShareUrl() {
  let shareUrl = `${window.location.origin}/detail.html?id=${currentDoc.id}`;
  if (activeClauseId) {
    shareUrl += `&clause=${activeClauseId}#${activeClauseId}`;
  }
  navigator.clipboard.writeText(shareUrl).then(() => {
    alert(`ì¡°í•­ ?¥ë§??ê³µìœ  ì£¼ì†Œê°€ ?´ë¦½ë³´ë“œ??ë³µì‚¬?˜ì—ˆ?µë‹ˆ??\n\n${shareUrl}`);
  }).catch(() => {
    prompt('ê³µìœ  ë§í¬ë¥?ë³µì‚¬?˜ì„¸??', shareUrl);
  });
}

// ----------------------------------------------------------------
// [ì¦ê²¨ì°¾ê¸° ? ê?]
// ----------------------------------------------------------------
function toggleBookmark() {
  const bookmarks = JSON.parse(localStorage.getItem('sebang_bookmarks') || '[]');
  const idx = bookmarks.indexOf(currentDoc.id);
  if (idx >= 0) {
    bookmarks.splice(idx, 1);
    alert('ì¦ê²¨ì°¾ê¸°?ì„œ ?œê±°?˜ì—ˆ?µë‹ˆ??');
  } else {
    bookmarks.push(currentDoc.id);
    alert('ì¦ê²¨ì°¾ê¸°???±ë¡?˜ì—ˆ?µë‹ˆ??');
  }
  localStorage.setItem('sebang_bookmarks', JSON.stringify(bookmarks));
  updateBookmarkButton();
}

function updateBookmarkButton() {
  const btn = document.getElementById('btn-bookmark');
  if (!btn || !currentDoc) return;
  const bookmarks = JSON.parse(localStorage.getItem('sebang_bookmarks') || '[]');
  if (bookmarks.includes(currentDoc.id)) {
    btn.classList.add('active');
    btn.innerHTML = `<i class="fa-solid fa-star"></i> ì¦ê²¨ì°¾ê¸° ?´ì œ`;
  } else {
    btn.classList.remove('active');
    btn.innerHTML = `<i class="fa-regular fa-star"></i> ì¦ê²¨ì°¾ê¸°`;
  }
}

// ----------------------------------------------------------------
// [?„ì‹œ ë©”ëª¨ë¦????ë””??(Sandbox Draft Modal - ?¤ì—¼ ë°©ì?)]
// ----------------------------------------------------------------
function openDraftEditorModal() {
  if (!AUTH.isAdmin()) {
    alert('ë¬¸ì„œ ?˜ì • ê¶Œí•œ???†ìŠµ?ˆë‹¤. ê´€ë¦¬ì ?´ë©”?¼ë¡œ ë¡œê·¸?¸í•´ ì£¼ì„¸??');
    return;
  }

  // ?¤ì„œë²??°ì´???¤ì—¼ ë°©ì?ë¥??„í•´ ê¹Šì? ë³µì‚¬(Deep Clone)?˜ì—¬ ?„ì‹œ ë©”ëª¨ë¦?ê°ì²´ ?ì„±
  draftDoc = JSON.parse(JSON.stringify(currentDoc));

  document.getElementById('edit-doc-title').value = draftDoc.title || '';
  document.getElementById('edit-doc-num').value = draftDoc.docNumber || '';
  document.getElementById('edit-doc-ver').value = bumpVersion(draftDoc.currentVersion);
  document.getElementById('edit-doc-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('edit-doc-summary').value = '';

  const editorArea = document.getElementById('draft-editor-area');
  editorArea.innerHTML = draftDoc.currentContent || '';

  // ?ë””????ì»¤ì„œ ?„ì¹˜(Range) ?¤ì‹œê°??€???´ë²¤???±ë¡
  editorArea.addEventListener('keyup', saveEditorSelection);
  editorArea.addEventListener('mouseup', saveEditorSelection);
  editorArea.addEventListener('focus', saveEditorSelection);

  document.getElementById('editor-modal').style.display = 'flex';
}

function closeDraftEditorModal() {
  if (confirm('?‘ì„± ì¤‘ì¸ ?„ì‹œ ?´ìš©???Œê¸°?©ë‹ˆ?? ?«ìœ¼?œê² ?µë‹ˆê¹?')) {
    draftDoc = null;
    savedEditorRange = null;
    document.getElementById('editor-modal').style.display = 'none';
  }
}

// ?ë””??ì»¤ì„œ(Range) ë³´ì¡´
let savedEditorRange = null;

function saveEditorSelection() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const editorArea = document.getElementById('draft-editor-area');
    if (editorArea.contains(range.commonAncestorContainer)) {
      savedEditorRange = range.cloneRange();
    }
  }
}

function restoreEditorSelection() {
  if (savedEditorRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedEditorRange);
  }
}

// ë¦¬ì¹˜ ?ìŠ¤???œì‹ ëª…ë ¹
function formatDoc(cmd, val = null) {
  document.getElementById('draft-editor-area').focus();
  restoreEditorSelection();
  document.execCommand(cmd, false, val);
  saveEditorSelection();
}

// ì¡°í•­ ì¶”ê? ëª¨ë‹¬ ?´ê¸° (?œëª©/ë³¸ë¬¸ ë¶„ë¦¬ ?…ë ¥, ?¤ìŒ ë²ˆí˜¸ ?ë™ ê°ì?)
function openArticleModal() {
  const editorArea = document.getElementById('draft-editor-area');
  const existingArticles = editorArea.querySelectorAll('.doc-article');
  let maxNum = 0;
  
  existingArticles.forEach(art => {
    const numEl = art.querySelector('.art-num');
    if (numEl) {
      const m = numEl.textContent.match(/??s*(\d+)\s*ì¡?);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
  });

  const nextNum = (maxNum > 0) ? maxNum + 1 : (existingArticles.length + 1);
  document.getElementById('modal-art-num').value = `??{nextNum}ì¡?;
  document.getElementById('modal-art-title').value = '';
  document.getElementById('modal-art-body').value = '';

  document.getElementById('article-modal').style.display = 'flex';
  setTimeout(() => {
    document.getElementById('modal-art-title').focus();
  }, 100);
}

function closeArticleModal() {
  document.getElementById('article-modal').style.display = 'none';
}

// ëª¨ë‹¬ ?????? ??, ??1., ê°€.) ê¸°í˜¸ ê°„í¸ ?½ì…
function insertParagraphSymbol(sym) {
  const textarea = document.getElementById('modal-art-body');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  // ?„ì¬ ì»¤ì„œê°€ ì¤„ì˜ ?œì‘???„ë‹ˆë©?ì¤„ë°”ê¿????½ì…
  const prefix = (start > 0 && val[start - 1] !== '\n') ? '\n' : '';
  textarea.value = val.substring(0, start) + prefix + sym + val.substring(end);
  textarea.focus();
  const nextPos = start + prefix.length + sym.length;
  textarea.setSelectionRange(nextPos, nextPos);
}

// ? ê·œ ì¡°í•­ ?•ì¸ ë°??ë””??ë§??„ë˜??'??ì¤? ?…ë¦½ ë¸”ë¡?¼ë¡œ ?½ì…
function confirmAddArticle() {
  const artNum = document.getElementById('modal-art-num').value.trim() || '?œnì¡?;
  const artTitle = document.getElementById('modal-art-title').value.trim() || 'ì¡°í•­ ?œëª©';
  const rawBody = document.getElementById('modal-art-body').value.trim() || '???¬ê¸°???¸ë? ?ˆì°¨ ?´ìš©???…ë ¥?˜ì‹­?œì˜¤.';

  // ë³¸ë¬¸???¬ëŸ¬ ì¤??? ????HTML <p> ?¨ìœ„ë¡?ë³€??(ê¸°ì¡´???½ì…??<a> ë§í¬ ?œê·¸??ë³´ì¡´)
  const bodyParagraphs = rawBody.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      // ë§Œì•½ ë§í¬ ?œê·¸(<a ...)ê°€ ?¬í•¨?˜ì–´ ?ˆìœ¼ë©??œê·¸ë¥?ë³´ì¡´?˜ê³ , ?†ìœ¼ë©?escapeHtml ?ìš©
      if (/<a\s+[^>]*href=/i.test(line)) {
        return `<p class="article-body">${line}</p>`;
      }
      return `<p class="article-body">${escapeHtml(line)}</p>`;
    })
    .join('\n');

  // ì¡°í•­ ë²ˆí˜¸ ID ì¶”ì¶œ (?? ??ì¡?-> art-5)
  const numMatch = artNum.match(/\d+/);
  const idSuffix = numMatch ? numMatch[0] : Date.now();
  const articleId = `art-${idSuffix}`;

  const newArticleHtml = `
<div class="doc-article" id="${articleId}">
  <h3 class="article-title"><span class="art-num">${escapeHtml(artNum)}</span> (${escapeHtml(artTitle)})</h3>
  ${bodyParagraphs}
</div>
<p><br></p>`;

  const editorArea = document.getElementById('draft-editor-area');
  
  // ê¸°ì¡´ ë³¸ë¬¸ ?¤ì— ?…ë¦½????ì¤„ë¡œ ?ˆì „?˜ê²Œ ê²°í•©
  editorArea.insertAdjacentHTML('beforeend', newArticleHtml);

  // ì¶”ê?????ì¡°í•­ ?„ì¹˜ë¡?ë¶€?œëŸ½ê²??¤í¬ë¡?  const addedEl = document.getElementById(articleId);
  if (addedEl) {
    addedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    addedEl.style.transition = 'background-color 0.8s';
    addedEl.style.backgroundColor = '#fef9c3';
    setTimeout(() => {
      addedEl.style.backgroundColor = 'transparent';
    }, 1200);
  }

  closeArticleModal();
}

// ?˜ìœ„ ?¸í™˜???œí”Œë¦?ì¶”ê? (?¨ì¶•???ëŠ” ?´ì „ ?¸ì¶œ ?€ë¹?
function insertArticleTemplate() {
  openArticleModal();
}

// ??Table) ?½ì… ?¤ì´?¼ë¡œê·?function insertTableDialog() {
  const rows = parseInt(prompt('?ì„±???œì˜ ??Row) ê°œìˆ˜ (ê¸°ë³¸: 3):', '3'), 10) || 3;
  const cols = parseInt(prompt('?ì„±???œì˜ ??Column) ê°œìˆ˜ (ê¸°ë³¸: 3):', '3'), 10) || 3;

  if (rows <= 0 || cols <= 0 || rows > 20 || cols > 10) {
    alert('?‰ì? 1~20ê°? ?´ì? 1~10ê°??¬ì´ë¡??…ë ¥??ì£¼ì‹­?œì˜¤.');
    return;
  }

  let tableHtml = '<table class="content-table" style="width:100%; border-collapse:collapse; margin:15px 0;"><thead><tr>';
  for (let c = 1; c <= cols; c++) {
    tableHtml += `<th style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:8px 12px; font-weight:600;">êµ¬ë¶„ ${c}</th>`;
  }
  tableHtml += '</tr></thead><tbody>';

  for (let r = 1; r <= rows; r++) {
    tableHtml += '<tr>';
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<td style="border:1px solid #cbd5e1; padding:8px 12px;">?´ìš© (${r}, ${c})</td>`;
    }
    tableHtml += '</tr>';
  }
  tableHtml += '</tbody></table><p><br></p>';

  formatDoc('insertHTML', tableHtml);
}

function insertRefLink() {
  openLinkPickerModal();
}

// ê°œì • ì°¨ìˆ˜ ?ë™ ì¶”ì²œ
function bumpVersion(ver) {
  if (!ver) return 'Rev.1';
  const m = ver.match(/Rev\.?(\d+)/i);
  if (m) {
    return `Rev.${parseInt(m[1]) + 1}`;
  }
  return ver + '.1';
}

// ìµœì¢… ë°œí–‰ ë°??ìš©
async function publishDraftChanges() {
  const summary = document.getElementById('edit-doc-summary').value.trim();
  if (!summary) {
    alert('ê°œì • ?¬ìœ  ë°?ì£¼ìš” ë³€ê²??”ì•½??ë°˜ë“œ???…ë ¥?´ì•¼ ?©ë‹ˆ??');
    document.getElementById('edit-doc-summary').focus();
    return;
  }

  const user = AUTH.getUser();
  const author = user ? user.email : 'admin@sebangtec.com';
  const newVer = document.getElementById('edit-doc-ver').value.trim();
  const newDate = document.getElementById('edit-doc-date').value;
  const newContent = document.getElementById('draft-editor-area').innerHTML;

  // ?„ì‹œ ë©”ëª¨ë¦?ê°ì²´ ê°±ì‹ 
  draftDoc.title = document.getElementById('edit-doc-title').value.trim();
  draftDoc.docNumber = document.getElementById('edit-doc-num').value.trim();
  draftDoc.currentVersion = newVer;
  draftDoc.effectiveDate = newDate;
  draftDoc.currentContent = newContent;

  if (!draftDoc.revisions) draftDoc.revisions = [];
  draftDoc.revisions.push({
    version: newVer,
    date: newDate,
    author: author,
    summary: summary,
    content: newContent
  });

  try {
    const res = await API.saveDocument(draftDoc);
    if (res.success) {
      alert(`[${newVer}] ?±ê³µ?ìœ¼ë¡?ë°œí–‰?˜ì–´ ?¬ë‚´ ?¬í„¸???ìš©?˜ì—ˆ?µë‹ˆ??`);
      document.getElementById('editor-modal').style.display = 'none';
      location.reload();
    } else {
      alert('?€???¤íŒ¨: ' + res.message);
    }
  } catch (e) {
    alert('?€??ì¤??µì‹  ?¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.');
  }
}

// ----------------------------------------------------------------
// [ê°œì •?´ë ¥ ë°?? êµ¬?€ì¡?(Diff)]
// ----------------------------------------------------------------
function openRevisionHistoryModal() {
  const listEl = document.getElementById('rev-timeline-list');
  listEl.innerHTML = '';

  const revs = currentDoc.revisions || [];
  if (revs.length === 0) {
    listEl.innerHTML = '<p>ê¸°ë¡??ê°œì • ?´ë ¥???†ìŠµ?ˆë‹¤.</p>';
  } else {
    revs.slice().reverse().forEach(r => {
      const item = document.createElement('div');
      item.className = 'rev-timeline-item';
      item.innerHTML = `
        <strong>${r.version}</strong> (${r.date}) - ?‘ì„±?? ${r.author || '-'}<br>
        <span style="color:#555;">?¬ìœ : ${r.summary || 'ìµœì´ˆ ?œì •'}</span>
      `;
      listEl.appendChild(item);
    });
  }

  // ? êµ¬?€ì¡??œì‹œ
  if (revs.length >= 2) {
    const prev = revs[revs.length - 2];
    const curr = revs[revs.length - 1];
    document.getElementById('diff-prev-version').innerText = prev.version;
    document.getElementById('diff-curr-version').innerText = curr.version;

    document.getElementById('diff-prev-content').innerText = stripHtml(prev.content || '');
    document.getElementById('diff-curr-content').innerHTML = highlightChanges(stripHtml(prev.content || ''), stripHtml(curr.content || ''));
  } else {
    document.getElementById('diff-prev-version').innerText = '-';
    document.getElementById('diff-curr-version').innerText = currentDoc.currentVersion;
    document.getElementById('diff-prev-content').innerText = 'ìµœì´ˆ ?œì •ë³¸ìœ¼ë¡??´ì „ ë¹„êµ ?€?ì´ ?†ìŠµ?ˆë‹¤.';
    document.getElementById('diff-curr-content').innerText = stripHtml(currentDoc.currentContent || '');
  }

  document.getElementById('diff-modal').style.display = 'flex';
}

function closeRevisionHistoryModal() {
  document.getElementById('diff-modal').style.display = 'none';
}

function stripHtml(html) {
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ê°„ë‹¨??? êµ¬?€ì¡??˜ì´?¼ì´??function highlightChanges(oldText, newText) {
  if (oldText === newText) return newText;
  return `<span class="diff-add">${newText}</span>`;
}

// ================================================================
// [ê³µì‹ ?¸ì‡„ ì²´ê³„] ?œì? ??ê°œì •????? êµ¬ë¹„êµ ??ë³¸ë¬¸ ?°ì´??ì¤€ë¹?// ================================================================
function preparePrintPages(doc) {
  if (!doc) return;

  // [1] ?œì? (Cover Page) ì£¼ì…
  const coverCat = document.getElementById('print-cover-cat');
  if (coverCat) coverCat.innerText = getCategoryName(doc.category);

  const coverTitle = document.getElementById('print-cover-title');
  if (coverTitle) coverTitle.innerText = doc.title || '-';

  const coverDocNum = document.getElementById('print-cover-docnum');
  if (coverDocNum) coverDocNum.innerText = `ë¬¸ì„œë²ˆí˜¸: ${doc.docNumber || '-'}`;

  const metaNum = document.getElementById('print-cover-meta-num');
  if (metaNum) metaNum.innerText = doc.docNumber || '-';

  const metaVer = document.getElementById('print-cover-meta-ver');
  if (metaVer) metaVer.innerText = doc.currentVersion || 'Rev.1';

  const firstDate = (doc.revisions && doc.revisions.length > 0 && doc.revisions[0].date) 
    ? doc.revisions[0].date 
    : (doc.effectiveDate || '-');
  const metaInitDate = document.getElementById('print-cover-meta-initdate');
  if (metaInitDate) metaInitDate.innerText = firstDate;

  const metaEffDate = document.getElementById('print-cover-meta-effdate');
  if (metaEffDate) metaEffDate.innerText = doc.effectiveDate || '-';

  const metaDept = document.getElementById('print-cover-meta-dept');
  if (metaDept) metaDept.innerText = doc.department || '?ˆì§ˆ?ˆì „ë³´ê±´??;

  // [2] ?œÂ·ê°œ??ê´€ë¦??´ë ¥??(Revision History) ì£¼ì…
  const revDocNumHeader = document.getElementById('print-rev-docnum-header');
  if (revDocNumHeader) revDocNumHeader.innerText = doc.docNumber || '-';

  const revDocTitle = document.getElementById('print-rev-doc-title');
  if (revDocTitle) revDocTitle.innerText = doc.title || '-';

  const revCurrVer = document.getElementById('print-rev-curr-ver');
  if (revCurrVer) revCurrVer.innerText = doc.currentVersion || 'Rev.1';

  const revCurrDate = document.getElementById('print-rev-curr-date');
  if (revCurrDate) revCurrDate.innerText = doc.effectiveDate || '-';

  const revTbody = document.getElementById('print-revision-tbody');
  if (revTbody) {
    const revs = doc.revisions || [];
    if (revs.length === 0) {
      revTbody.innerHTML = `
        <tr>
          <td style="text-align:center; font-weight:600;">${escapeHtml(doc.currentVersion || 'Rev.0')}</td>
          <td style="text-align:center;">${escapeHtml(doc.effectiveDate || '-')}</td>
          <td>ìµœì´ˆ ?œì • ë°?KOSHA-MS ?œì? ?±ë¡</td>
          <td style="text-align:center;">?ˆì§ˆ?ˆì „ë³´ê±´??/td>
          <td style="text-align:center; color:#15803d; font-weight:600;">?¹ì¸ ?„ë£Œ</td>
        </tr>
      `;
    } else {
      let revHtml = '';
      revs.forEach((r, idx) => {
        const defaultSummary = idx === 0 ? 'ìµœì´ˆ ?œì • ë°??œí–‰' : '?•ê¸° ê°œì • ë°?ë²•ê·œ ê²€??ë³´ì™„';
        revHtml += `
          <tr>
            <td style="text-align:center; font-weight:600;">${escapeHtml(r.version || `Rev.${idx}`)}</td>
            <td style="text-align:center;">${escapeHtml(r.date || '-')}</td>
            <td>${escapeHtml(r.summary || defaultSummary)}</td>
            <td style="text-align:center;">${escapeHtml(r.author || '?ˆì „ë³´ê±´??)}</td>
            <td style="text-align:center; color:#15803d; font-weight:600;">?¹ì¸ ?„ë£Œ</td>
          </tr>
        `;
      });
      revTbody.innerHTML = revHtml;
    }
  }

  // [3] ? Â·êµ¬ ì¡°ë¬¸ ?€ë¹„í‘œ (Comparison Table) ì£¼ì…
  const diffDocNumHeader = document.getElementById('print-diff-docnum-header');
  if (diffDocNumHeader) diffDocNumHeader.innerText = doc.docNumber || '-';

  const diffDocTitle = document.getElementById('print-diff-doc-title');
  if (diffDocTitle) diffDocTitle.innerText = doc.title || '-';

  const diffVersionInfo = document.getElementById('print-diff-version-info');
  const diffTbody = document.getElementById('print-diff-tbody');

  if (diffTbody) {
    const revs = doc.revisions || [];
    if (revs.length >= 2) {
      const prevRev = revs[revs.length - 2];
      const currRev = revs[revs.length - 1];

      if (diffVersionInfo) {
        diffVersionInfo.innerHTML = `<strong>ê°œì • ë¹„êµ:</strong> ì§ì „ <u>${escapeHtml(prevRev.version)}</u> ?€ë¹??„í–‰ <u>${escapeHtml(currRev.version)}</u> (${escapeHtml(currRev.date)})`;
      }

      diffTbody.innerHTML = renderPrintDiffRows(prevRev.content || '', currRev.content || doc.currentContent || '');
    } else {
      if (diffVersionInfo) {
        diffVersionInfo.innerHTML = `<strong>ê°œì • ë¹„êµ:</strong> ìµœì´ˆ ?œì •ë³?(${escapeHtml(doc.currentVersion || 'Rev.0')})`;
      }
      diffTbody.innerHTML = `
        <tr style="height: 120px;">
          <td colspan="3" style="text-align:center; vertical-align:middle; color:#64748b; font-size:10pt; line-height:1.6;">
            ??ë³?ê·œì •?€ ìµœì´ˆ ?œì •ë³??ëŠ” ì§ì „ ê°œì • ?´ë ¥ ?†ìŒ)?¼ë¡œ ? Â·êµ¬ ì¡°ë¬¸ ?€ì¡??€?ì´ ?†ìŠµ?ˆë‹¤.<br>
            <span style="font-size:9pt; color:#94a3b8;">(?„í–‰ ê·œì • ë³¸ë¬¸?€ ?¤ìŒ ?˜ì´ì§€??ë³¸ë¬¸ ?¥ì„ ì°¸ì¡°?˜ì‹­?œì˜¤)</span>
          </td>
        </tr>
      `;
    }
  }
}

// ì¡°í•­ ?¨ìœ„ ? êµ¬ì¡°ë¬¸?€ì¡°í‘œ ?ì„± ?¬í¼
function renderPrintDiffRows(prevHtml, currHtml) {
  const prevArticles = parseArticlesFromHtml(prevHtml);
  const currArticles = parseArticlesFromHtml(currHtml);

  // ì¡°í•­ ??ë²ˆí˜¸ ë°??œëª©) ëª¨ìŒ
  const allKeys = [];
  const keySet = new Set();

  currArticles.forEach(a => {
    if (!keySet.has(a.key)) {
      keySet.add(a.key);
      allKeys.push(a.key);
    }
  });

  prevArticles.forEach(a => {
    if (!keySet.has(a.key)) {
      keySet.add(a.key);
      allKeys.push(a.key);
    }
  });

  const prevMap = new Map(prevArticles.map(a => [a.key, a]));
  const currMap = new Map(currArticles.map(a => [a.key, a]));

  let diffRowsHtml = '';
  let changedCount = 0;

  allKeys.forEach(key => {
    const p = prevMap.get(key);
    const c = currMap.get(key);

    const pText = p ? p.bodyText.trim() : '';
    const cText = c ? c.bodyText.trim() : '';
    const title = (c ? c.title : (p ? p.title : key)) || key;

    // ?´ìš©???¤ë¥´ê±°ë‚˜ ? ì„¤/?? œ??ê²½ìš° ?€ì¡°í‘œ??ë°˜ì˜
    if (pText !== cText || !p || !c) {
      changedCount++;
      let prevCell = '';
      let currCell = '';

      if (!p) {
        prevCell = '<span style="color:#94a3b8; font-style:italic;">[? ì„¤ - ?´ì „ ì¡°í•­ ?†ìŒ]</span>';
        currCell = `<strong style="color:#0f172a;">${escapeHtml(cText)}</strong>`;
      } else if (!c) {
        prevCell = `<span style="text-decoration:line-through; color:#dc2626;">${escapeHtml(pText)}</span>`;
        currCell = '<span style="color:#dc2626; font-style:italic;">[?? œ ?ì???</span>';
      } else {
        prevCell = escapeHtml(pText);
        currCell = `<mark style="background:#fef08a; padding:1px 3px; font-weight:600;">${escapeHtml(cText)}</mark>`;
      }

      diffRowsHtml += `
        <tr>
          <td style="text-align:center; font-weight:700; vertical-align:top; background:#fcfcfc;">${escapeHtml(title)}</td>
          <td style="vertical-align:top;">${prevCell}</td>
          <td style="vertical-align:top;">${currCell}</td>
        </tr>
      `;
    }
  });

  // ë§Œì•½ ì¡°í•­ ?Œì‹± ê²°ê³¼ ë³€ê²½ì ???†ê±°??ë¹„êµ¬ì¡°í™” HTML??ê²½ìš°
  if (changedCount === 0) {
    const pPlain = stripHtml(prevHtml).trim();
    const cPlain = stripHtml(currHtml).trim();

    if (pPlain !== cPlain) {
      return `
        <tr>
          <td style="text-align:center; font-weight:700; vertical-align:top;">ë³¸ë¬¸ ?„ë©´ ê°œì •</td>
          <td style="vertical-align:top;">${escapeHtml(pPlain.substring(0, 500))}${pPlain.length > 500 ? '...' : ''}</td>
          <td style="vertical-align:top;"><mark style="background:#fef08a;">${escapeHtml(cPlain.substring(0, 500))}${cPlain.length > 500 ? '...' : ''}</mark></td>
        </tr>
      `;
    }

    return `
      <tr>
        <td colspan="3" style="text-align:center; padding:25px; color:#64748b;">
          ??ë³?ê°œì •ë³¸ì? ì¡°í•­??ì¶”ê?/?? œ/ë¬¸êµ¬ ë³€ê²??†ì´ ?¤íƒˆ???•ë¹„ ?ëŠ” ì²´ê³„ ? ì? ëª©ì ?¼ë¡œ ê°œì •?˜ì—ˆ?µë‹ˆ??
        </td>
      </tr>
    `;
  }

  return diffRowsHtml;
}

// HTML?ì„œ ì¡°í•­ ?Œì‹± ? í‹¸ë¦¬í‹°
function parseArticlesFromHtml(html) {
  if (!html) return [];
  const container = document.createElement('div');
  container.innerHTML = html;

  const articles = container.querySelectorAll('.doc-article');
  if (articles.length === 0) return [];

  const results = [];
  articles.forEach((art, idx) => {
    const titleEl = art.querySelector('.article-title');
    const numEl = art.querySelector('.art-num');
    const titleText = titleEl ? titleEl.innerText.trim() : `??{idx+1}ì¡?;
    const key = numEl ? numEl.innerText.trim() : (titleText.split(' ')[0] || `art-${idx}`);

    // ë³¸ë¬¸ ?´ìš© ?ìŠ¤??ì¶”ì¶œ
    const bodyEls = art.querySelectorAll('.article-body');
    let bodyText = '';
    if (bodyEls.length > 0) {
      bodyText = Array.from(bodyEls).map(el => el.innerText.trim()).join('\n');
    } else {
      bodyText = art.innerText.replace(titleText, '').trim();
    }

    results.push({
      key: key,
      title: titleText,
      bodyText: bodyText
    });
  });

  return results;
}

// ë¸Œë¼?°ì? ê¸°ë³¸ ?¸ì‡„(Ctrl+P) ?¸ì¶œ ?„ì—???¸ì‡„ ?°ì´???ë™ ìµœì‹ ??window.addEventListener('beforeprint', () => {
  if (currentDoc) {
    preparePrintPages(currentDoc);
  }
});


// ----------------------------------------------------------------
// [ëª¨ë‹¬ 4] ? ê·œ ?ˆì°¨??/ ì§€ì¹¨ì„œ ì¶”ê? & ?ì? ê´€ë¦?ë¡œì§
// ----------------------------------------------------------------
function openNewDocModal(targetCategory = 'PROCEDURE', parentId = null) {
  if (!AUTH.isAdmin()) {
    alert('ê·œì • ?œì • ë°?ì¶”ê???ê´€ë¦¬ì ê¶Œí•œ???„ìš”?©ë‹ˆ??');
    return;
  }

  const catSelect = document.getElementById('new-doc-category');
  catSelect.value = targetCategory;

  updateParentOptions(targetCategory, parentId);

  // ê¸°ë³¸ê°??¤ì •
  document.getElementById('new-doc-title').value = '';
  document.getElementById('new-doc-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('new-doc-dept').value = '?ˆì§ˆ?ˆì „ë³´ê±´??;
  document.getElementById('new-doc-summary').value = 'KOSHA-MS ?ˆì „ë³´ê±´ê²½ì˜ì²´ê³„ ê³ ë„?”ì— ?°ë¥¸ ? ê·œ ê·œì • ?œì •';

  // ì¶”ì²œ ë¬¸ì„œë²ˆí˜¸ ?¤ì •
  suggestDocNumber(targetCategory);

  document.getElementById('new-doc-modal').style.display = 'flex';
  setTimeout(() => {
    document.getElementById('new-doc-title').focus();
  }, 100);
}

function closeNewDocModal() {
  document.getElementById('new-doc-modal').style.display = 'none';
}

function onNewDocCategoryChange() {
  const cat = document.getElementById('new-doc-category').value;
  updateParentOptions(cat, null);
  suggestDocNumber(cat);
}

function updateParentOptions(category, selectedParentId) {
  const parentSelect = document.getElementById('new-doc-parent');
  parentSelect.innerHTML = '';

  if (category === 'MANUAL') {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '(ìµœìƒ??ë§¤ë‰´??- ?ìœ„ ?†ìŒ)';
    parentSelect.appendChild(opt);
    return;
  }

  if (category === 'PROCEDURE') {
    // ?ˆì°¨?œëŠ” ë§¤ë‰´?¼ì„ ë¶€ëª¨ë¡œ ê°€ì§?    const manuals = allDocs.filter(d => d.category === 'MANUAL');
    manuals.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `[ë§¤ë‰´?? ${m.title}`;
      if (selectedParentId === m.id) opt.selected = true;
      parentSelect.appendChild(opt);
    });
  } else if (category === 'INSTRUCTION') {
    // ì§€ì¹¨ì„œ???ˆì°¨?œë? ë¶€ëª¨ë¡œ ê°€ì§?    const procs = allDocs.filter(d => d.category === 'PROCEDURE');
    procs.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `[?ˆì°¨?? ${p.title}`;
      if (selectedParentId === p.id) opt.selected = true;
      parentSelect.appendChild(opt);
    });
  }
}

function suggestDocNumber(category) {
  const prefix = category === 'PROCEDURE' ? 'ST-PR' : (category === 'INSTRUCTION' ? 'ST-IN' : 'ST-MN');
  const count = allDocs.filter(d => d.category === category).length + 1;
  const seq = String(count).padStart(3, '0');
  document.getElementById('new-doc-num').value = `${prefix}-${seq}`;
}

async function confirmCreateNewDoc() {
  const title = document.getElementById('new-doc-title').value.trim();
  const category = document.getElementById('new-doc-category').value;
  const parentId = document.getElementById('new-doc-parent').value || null;
  const docNumber = document.getElementById('new-doc-num').value.trim() || 'ST-DOC-001';
  const effectiveDate = document.getElementById('new-doc-date').value || new Date().toISOString().split('T')[0];
  const department = document.getElementById('new-doc-dept').value.trim() || '?ˆì§ˆ?ˆì „ë³´ê±´??;
  const summary = document.getElementById('new-doc-summary').value.trim() || '? ê·œ ê·œì • ìµœì´ˆ ?œì •';

  if (!title) {
    alert('ê·œì • ëª…ì¹­(?œëª©)???…ë ¥??ì£¼ì‹­?œì˜¤.');
    document.getElementById('new-doc-title').focus();
    return;
  }

  const prefix = category === 'PROCEDURE' ? 'PRC-KOSHA' : (category === 'INSTRUCTION' ? 'INS-KOSHA' : 'MAN-KOSHA');
  const catCount = allDocs.filter(d => d.category === category).length + 1;
  const newId = `${prefix}-${String(catCount).padStart(2, '0')}`;

  const user = AUTH.getUser();
  const author = user ? user.email : 'admin@sebangtec.com';

  const defaultContent = `
<div class="doc-article" id="art-1">
  <h3 class="article-title"><span class="art-num">??ì¡?/span> (ëª©ì )</h3>
  <p class="article-body">ë³?ê·œì •?€ (ì£??¸ë°©?Œí¬???ˆì „ë³´ê±´ê²½ì˜?œìŠ¤???´ì˜???ˆì–´ ${escapeHtml(title)}??ê´€???¸ë? ê¸°ì? ë°??ˆì°¨ë¥??•ë¦½?¨ì„ ëª©ì ?¼ë¡œ ?œë‹¤.</p>
</div>

<div class="doc-article" id="art-2">
  <h3 class="article-title"><span class="art-num">??ì¡?/span> (?ìš©ë²”ìœ„)</h3>
  <p class="article-body">?Œì‚¬??ë³¸ì‚¬ ë°?ëª¨ë“  ?œê³µ ?„ì¥, ê´€ê³??‘ë ¥?…ì²´???‘ì—… ?ˆì°¨???ìš©?œë‹¤.</p>
</div>

<div class="doc-article" id="art-3">
  <h3 class="article-title"><span class="art-num">??ì¡?/span> (ì±…ì„ê³?ê¶Œí•œ)</h3>
  <p class="article-body">??ì´ê´„ì±…ì„?ëŠ” ë³?ê·œì •???œë°˜ ?´í–‰ ?¤íƒœë¥?ê°ë…?˜ê³  ?„ìš”??ì¡°ì¹˜ë¥?ì·¨í•˜?¬ì•¼ ?œë‹¤.</p>
  <p class="article-body">???„ì¥ ê´€ë¦¬ì±…?„ì???´ë‹¹ ?‘ì—… ì°©ìˆ˜ ??ë³?ê·œì •??ëª…ì‹œ???ˆì „ë³´ê±´ ì¡°ì¹˜ê°€ ?„ë£Œ?˜ì—ˆ?”ì? ?•ì¸?˜ì—¬???œë‹¤.</p>
</div>`;

  const newDoc = {
    id: newId,
    category: category,
    parentId: parentId,
    title: title,
    docNumber: docNumber,
    currentVersion: 'Rev.1',
    effectiveDate: effectiveDate,
    department: department,
    childrenIds: [],
    revisions: [
      {
        version: 'Rev.1',
        date: effectiveDate,
        author: author,
        summary: summary,
        content: defaultContent
      }
    ],
    currentContent: defaultContent
  };

  try {
    // 1. ??ë¬¸ì„œ ?€??    await API.saveDocument(newDoc);

    // 2. ë¶€ëª?ë¬¸ì„œ??childrenIds???±ë¡
    if (parentId) {
      const parentDoc = allDocs.find(d => d.id === parentId);
      if (parentDoc) {
        if (!parentDoc.childrenIds) parentDoc.childrenIds = [];
        if (!parentDoc.childrenIds.includes(newId)) {
          parentDoc.childrenIds.push(newId);
          await API.saveDocument(parentDoc);
        }
      }
    }

    alert(`? ê·œ ${getCategoryName(category)} [${title}]??ê°€) ?±ë¡?˜ì—ˆ?µë‹ˆ??\n?´ë‹¹ ê·œì • ?ì„¸ ?˜ì´ì§€ë¡??´ë™?©ë‹ˆ??`);
    closeNewDocModal();
    location.href = `detail.html?id=${newId}`;
  } catch (err) {
    alert('ê·œì • ?±ë¡ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤: ' + err.message);
  }
}

// ê·œì • ?ì? / ?? œ
async function deleteDocumentById(docId, docTitle) {
  if (!AUTH.isAdmin()) {
    alert('ê·œì • ?ì???ê´€ë¦¬ì ê¶Œí•œ???„ìš”?©ë‹ˆ??');
    return;
  }

  const confirmMsg = `[ì£¼ì˜] '${docTitle}' (${docId}) ê·œì •???ì?(?? œ)?˜ì‹œê² ìŠµ?ˆê¹Œ?\n\n?ì???ê·œì •?€ ?¬í„¸ ë°?ê³„ì¸µ ?¸ë¦¬?ì„œ ì¦‰ì‹œ ?œì™¸?©ë‹ˆ??`;
  if (!confirm(confirmMsg)) return;

  try {
    await API.deleteDocument(docId);
    alert(`'${docTitle}' ê·œì •???•ìƒ?ìœ¼ë¡??ì??˜ì—ˆ?µë‹ˆ??`);
    
    // ?„ì¬ ë³´ê³  ?ˆë˜ ë¬¸ì„œê°€ ?? œ??ë¬¸ì„œ??ê²½ìš° ìµœìƒ??ë§¤ë‰´?¼ë¡œ ?´ë™
    if (currentDoc && currentDoc.id === docId) {
      location.href = 'detail.html?id=MAN-KOSHA-01';
    } else {
      // ëª©ë¡ ?¬ê°±??      allDocs = await API.getDocuments();
      renderHierarchyTree(currentDoc ? currentDoc.id : 'MAN-KOSHA-01');
    }
  } catch (err) {
    alert('ê·œì • ?ì? ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤: ' + err.message);
  }
}

// ----------------------------------------------------------------
// [ëª¨ë‹¬ 5] ?°ê³„ ê·œì • ë°?ì¡°í•­ ?¥ë§???¸ë¦¬ë§?ë¸Œë¼?°ì? ë¡œì§
// ----------------------------------------------------------------
let pickerSelectedDoc = null;
let pickerSelectedClause = null;
let pickerLoadedDocsCache = {};
let pickerTargetContext = 'editor'; // 'editor' ?ëŠ” 'modal-art-body'

async function openLinkPickerModal(targetContext = 'editor') {
  pickerTargetContext = targetContext;
  pickerSelectedDoc = null;
  pickerSelectedClause = null;

  // ?ë””?°ì—???¸ì¶œ??ê²½ìš° ?„ì¬ ì»¤ì„œ ?„ì¹˜ ë³´ì¡´
  if (targetContext === 'editor') {
    saveEditorSelection();
  }

  document.getElementById('link-picker-search').value = '';
  document.getElementById('link-target-display').innerText = '? íƒ?˜ì? ?ŠìŒ';
  document.getElementById('link-custom-text').value = '';
  document.getElementById('btn-confirm-link').disabled = true;

  document.getElementById('picker-clauses-title').innerHTML = '<i class="fa-solid fa-list-ol"></i> ì¡°í•­ ? íƒ (ì¢Œì¸¡?ì„œ ê·œì •??ë¨¼ì? ? íƒ?˜ì„¸??';
  document.getElementById('picker-clause-list').innerHTML = '<div class="picker-empty-guide">ì¢Œì¸¡?ì„œ ê·œì •??? íƒ?˜ë©´ ?¸ë? ì¡°í•­ ëª©ë¡???œì‹œ?©ë‹ˆ??</div>';

  renderLinkPickerTree(allDocs);

  document.getElementById('link-picker-modal').style.display = 'flex';
  setTimeout(() => {
    document.getElementById('link-picker-search').focus();
  }, 100);
}

function closeLinkPickerModal() {
  document.getElementById('link-picker-modal').style.display = 'none';
}

// ?¸ë¦¬ë§??Œë”ë§?function renderLinkPickerTree(docsToRender) {
  const treeListEl = document.getElementById('picker-tree-list');
  treeListEl.innerHTML = '';

  const manuals = docsToRender.filter(d => d.category === 'MANUAL');

  manuals.forEach(m => {
    appendPickerTreeItem(m, 0, treeListEl);

    const procs = docsToRender.filter(d => d.parentId === m.id || (m.childrenIds && m.childrenIds.includes(d.id)));
    procs.forEach(p => {
      appendPickerTreeItem(p, 1, treeListEl);

      const insts = docsToRender.filter(d => d.parentId === p.id || (p.childrenIds && p.childrenIds.includes(d.id)));
      insts.forEach(ins => {
        appendPickerTreeItem(ins, 2, treeListEl);
      });
    });
  });

  // ê¸°í? ë¯¸ë¶„ë¥?  const assigned = new Set([
    ...manuals.map(d => d.id),
    ...manuals.flatMap(m => docsToRender.filter(d => d.parentId === m.id || (m.childrenIds && m.childrenIds.includes(d.id))).map(d => d.id)),
    ...docsToRender.filter(d => d.category === 'INSTRUCTION').map(d => d.id)
  ]);
  const others = docsToRender.filter(d => !assigned.has(d.id));
  others.forEach(o => appendPickerTreeItem(o, 1, treeListEl));
}

function appendPickerTreeItem(doc, depth, container) {
  const item = document.createElement('div');
  item.className = `picker-tree-item depth-${depth} ${pickerSelectedDoc && pickerSelectedDoc.id === doc.id ? 'active' : ''}`;
  item.id = `picker-item-${doc.id}`;

  let icon = '<i class="fa-solid fa-file-lines"></i>';
  if (depth === 0) icon = '<i class="fa-solid fa-folder-open"></i>';
  else if (depth === 2) icon = '<i class="fa-solid fa-file-code"></i>';

  item.innerHTML = `${icon} <span>${escapeHtml(doc.title)}</span>`;
  item.onclick = () => selectPickerDoc(doc);
  container.appendChild(item);
}

// ?¹ì • ê·œì • ? íƒ ???´ë‹¹ ê·œì •??ì¡°í•­ ëª©ë¡ ë¹„ë™ê¸??Œì‹± ë°??¸ì¶œ
async function selectPickerDoc(doc) {
  pickerSelectedDoc = doc;
  pickerSelectedClause = null;

  document.querySelectorAll('.picker-tree-item').forEach(el => el.classList.remove('active'));
  const currentItem = document.getElementById(`picker-item-${doc.id}`);
  if (currentItem) currentItem.classList.add('active');

  // ? íƒ ?”ì•½ ?…ë°?´íŠ¸ (ê·œì • ?„ì²´ ë§í¬ ?”í´??
  document.getElementById('link-target-display').innerText = `[${getCategoryName(doc.category)}] ${doc.title}`;
  document.getElementById('link-custom-text').value = `[${doc.title}]`;
  document.getElementById('btn-confirm-link').disabled = false;

  document.getElementById('picker-clauses-title').innerHTML = `<i class="fa-solid fa-list-ol"></i> <strong>${escapeHtml(doc.title)}</strong> ?¸ë? ì¡°í•­ ëª©ë¡`;
  const clauseListEl = document.getElementById('picker-clause-list');
  clauseListEl.innerHTML = '<div style="padding:15px; text-align:center; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> ì¡°í•­ ë¡œë”© ì¤?..</div>';

  try {
    let fullDoc = pickerLoadedDocsCache[doc.id];
    if (!fullDoc) {
      fullDoc = await API.getDocument(doc.id);
      pickerLoadedDocsCache[doc.id] = fullDoc;
    }

    renderPickerClauses(fullDoc);
  } catch (err) {
    clauseListEl.innerHTML = '<div style="color:#e03131; padding:15px;">ì¡°í•­??ë¶ˆëŸ¬?¤ì? ëª»í–ˆ?µë‹ˆ?? ê·œì • ?„ì²´???€??ë§í¬??ê°€?¥í•©?ˆë‹¤.</div>';
  }
}

// ì¡°í•­ ëª©ë¡ ?Œë”ë§?function renderPickerClauses(doc) {
  const clauseListEl = document.getElementById('picker-clause-list');
  clauseListEl.innerHTML = '';

  // ê·œì • ?„ì²´ ë°”ë¡œê°€ê¸??µì…˜ (ìµœìƒ??
  const allDocOption = document.createElement('div');
  allDocOption.className = 'picker-clause-item active';
  allDocOption.innerHTML = `
    <div class="picker-clause-num"><i class="fa-solid fa-file-export"></i> ê·œì • ?„ë¬¸ ë°”ë¡œê°€ê¸?(?¹ì • ì¡°í•­ ë¯¸ì???</div>
    <div class="picker-clause-preview">${escapeHtml(doc.title)} ë¬¸ì„œ ?„ì²´ë¡??´ë™?˜ëŠ” ë§í¬ë¥??ì„±?©ë‹ˆ??</div>
  `;
  allDocOption.onclick = () => {
    pickerSelectedClause = null;
    document.querySelectorAll('.picker-clause-item').forEach(el => el.classList.remove('active'));
    allDocOption.classList.add('active');
    document.getElementById('link-target-display').innerText = `[${getCategoryName(doc.category)}] ${doc.title}`;
    document.getElementById('link-custom-text').value = `[${doc.title}]`;
  };
  clauseListEl.appendChild(allDocOption);

  // HTML ë³¸ë¬¸?ì„œ .doc-article ?”ì†Œ??ì¶”ì¶œ
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = doc.currentContent || '';
  const articles = tempDiv.querySelectorAll('.doc-article');

  if (articles.length === 0) {
    const emptyNotice = document.createElement('div');
    emptyNotice.className = 'picker-empty-guide';
    emptyNotice.textContent = '?±ë¡???¸ë? ì¡°í•­???†ìŠµ?ˆë‹¤.';
    clauseListEl.appendChild(emptyNotice);
    return;
  }

  articles.forEach(art => {
    const titleEl = art.querySelector('.article-title');
    const titleText = titleEl ? titleEl.innerText.trim() : 'ì¡°í•­';
    const bodyEl = art.querySelector('.article-body') || art;
    const bodyText = bodyEl ? bodyEl.innerText.trim() : '';

    const clauseItem = document.createElement('div');
    clauseItem.className = 'picker-clause-item';
    clauseItem.innerHTML = `
      <div class="picker-clause-num"><i class="fa-solid fa-bookmark"></i> ${escapeHtml(titleText)}</div>
      <div class="picker-clause-preview">${escapeHtml(bodyText)}</div>
    `;

    clauseItem.onclick = () => {
      pickerSelectedClause = {
        id: art.id,
        title: titleText
      };

      document.querySelectorAll('.picker-clause-item').forEach(el => el.classList.remove('active'));
      clauseItem.classList.add('active');

      document.getElementById('link-target-display').innerText = `${doc.title} > ${titleText}`;
      document.getElementById('link-custom-text').value = `[${doc.title} ${titleText}]`;
    };

    clauseListEl.appendChild(clauseItem);
  });
}

// ?¤ì‹œê°?ê²€???„í„°ë§?(ê·œì •ëª?+ ì¡°í•­ ê²€??
function filterLinkPicker() {
  const query = document.getElementById('link-picker-search').value.trim().toLowerCase();
  if (!query) {
    renderLinkPickerTree(allDocs);
    return;
  }

  const matchedDocs = allDocs.filter(d => {
    return d.title.toLowerCase().includes(query) || (d.docNumber && d.docNumber.toLowerCase().includes(query));
  });

  renderLinkPickerTree(matchedDocs);

  // ê²€?‰ì–´ê°€ ?ˆì„ ??ì²?ë²ˆì§¸ ê²€??ê²°ê³¼ ?ë™ ? íƒ
  if (matchedDocs.length > 0) {
    selectPickerDoc(matchedDocs[0]);
  }
}

// ? íƒ ?„ë£Œ ë°??ë””??ë³¸ë¬¸(?ëŠ” ? ê·œ ì¡°í•­ ëª¨ë‹¬ textarea)???˜ì´?¼ë§???½ì…
function confirmInsertLink() {
  if (!pickerSelectedDoc) {
    alert('?°ê³„??ê·œì •??? íƒ??ì£¼ì‹­?œì˜¤.');
    return;
  }

  let targetUrl = `detail.html?id=${pickerSelectedDoc.id}`;
  if (pickerSelectedClause && pickerSelectedClause.id) {
    targetUrl += `#${pickerSelectedClause.id}`;
  }

  let displayText = document.getElementById('link-custom-text').value.trim();
  if (!displayText) {
    displayText = pickerSelectedClause 
      ? `[${pickerSelectedDoc.title} ${pickerSelectedClause.title}]`
      : `[${pickerSelectedDoc.title}]`;
  }

  const linkHtml = `<a href="${targetUrl}" class="ref-link" style="color:#1d4ed8; text-decoration:underline; font-weight:600;" target="_self" title="${escapeHtml(pickerSelectedDoc.title)} ë°”ë¡œê°€ê¸?>${escapeHtml(displayText)}</a> `;

  // 1. ? ê·œ ì¡°í•­ ì¶”ê? ëª¨ë‹¬(textarea)?ì„œ ?¸ì¶œ??ê²½ìš°
  if (pickerTargetContext === 'modal-art-body') {
    const textarea = document.getElementById('modal-art-body');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const insertText = linkHtml + ' ';
      textarea.value = val.substring(0, start) + insertText + val.substring(end);
      textarea.focus();
      const nextPos = start + insertText.length;
      textarea.setSelectionRange(nextPos, nextPos);
    }
  } else {
    // 2. ë©”ì¸ ???ë””??contenteditable)?ì„œ ?¸ì¶œ??ê²½ìš°
    const editorArea = document.getElementById('draft-editor-area');
    editorArea.focus();

    // ?€?¥ëœ ì»¤ì„œ ?„ì¹˜ê°€ ? íš¨?˜ë©´ ?´ë‹¹ ?„ì¹˜???½ì…, ?†ìœ¼ë©?ë§??ì— ?ˆì „ ì¶”ê?
    if (savedEditorRange) {
      restoreEditorSelection();
      try {
        document.execCommand('insertHTML', false, linkHtml);
      } catch (e) {
        editorArea.insertAdjacentHTML('beforeend', ' ' + linkHtml);
      }
    } else {
      editorArea.insertAdjacentHTML('beforeend', ' ' + linkHtml);
    }
  }

  closeLinkPickerModal();
}
