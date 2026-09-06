/**
 * 상세 문서 뷰어, 보안 인쇄 워터마크, 신구대조, 임시격리 웹에디터 로직 (detail.js)
 */
let currentDoc = null;
let allDocs = [];
let activeClauseId = null;

// 임시 메모리 격리 에디터 상태 (Sandbox Draft)
let draftDoc = null;

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const docId = params.get('id') || 'MAN-KOSHA-01';
  const clauseParam = params.get('clause') || window.location.hash.replace('#', '');
  const searchKeyword = params.get('q');

  await loadAllDocuments();
  await loadDocument(docId, clauseParam, searchKeyword);
});

// 전체 문서 로드 (트리 구성용)
async function loadAllDocuments() {
  try {
    allDocs = await API.getDocuments();
  } catch (e) {
    console.error(e);
  }
}

// 개별 문서 로드 및 렌더링
async function loadDocument(docId, targetClause, keyword) {
  try {
    currentDoc = await API.getDocument(docId);
    renderDocument(currentDoc);
    renderHierarchyTree(docId);
    renderClauseJumpList();

    // 즐겨찾기 상태 갱신
    updateBookmarkButton();

    // 최고 관리자 도구 노출 여부 제어
    updateSuperAdminToolbar();

    // 특정 조항 딥링크 스크롤
    if (targetClause) {
      setTimeout(() => {
        scrollToClause(targetClause);
      }, 200);
    }

    // 검색어 하이라이팅
    if (keyword) {
      highlightKeyword(keyword);
    }
  } catch (e) {
    alert('문서를 불러올 수 없습니다: ' + e.message);
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

// 문서 본문 렌더링
function renderDocument(doc) {
  document.title = `${doc.title} - 세방테크 KOSHA-MS`;
  document.getElementById('doc-title-bar').innerText = doc.title;
  document.getElementById('doc-main-title').innerText = doc.title;
  document.getElementById('doc-ver-tag').innerText = doc.currentVersion;
  document.getElementById('doc-cat-badge').innerText = getCategoryName(doc.category);

  document.getElementById('meta-doc-num').innerText = doc.docNumber || '-';
  document.getElementById('meta-doc-rev').innerText = doc.currentVersion || '-';
  document.getElementById('meta-doc-date').innerText = doc.effectiveDate || '-';
  document.getElementById('meta-doc-dept').innerText = doc.department || '-';

  const bodyEl = document.getElementById('doc-content-body');
  bodyEl.innerHTML = doc.currentContent || '<p>본문 내용이 없습니다.</p>';

  // 각 조항 클릭 이벤트 및 앵커 지원
  bodyEl.querySelectorAll('.doc-article').forEach(art => {
    art.addEventListener('click', () => {
      activeClauseId = art.id;
    });
  });
}

function getCategoryName(cat) {
  if (cat === 'MANUAL') return 'KOSHA 매뉴얼';
  if (cat === 'PROCEDURE') return '절차서';
  if (cat === 'INSTRUCTION') return '지침서';
  return '사내 표준';
}

// 좌측 표준 체계 트리 렌더링 (+ 자식 규정 추가 및 폐지 기능 연계)
function renderHierarchyTree(currentDocId) {
  const treeArea = document.getElementById('hierarchy-tree-area');
  if (!treeArea) return;
  treeArea.innerHTML = '';

  const isAdminUser = AUTH.isAdmin();

  // 트리 헤더의 전체 추가 버튼 노출 상태 동기화
  const addBtn = document.querySelector('.btn-tree-add');
  if (addBtn) {
    addBtn.style.display = isAdminUser ? 'inline-flex' : 'none';
  }

  // 매뉴얼 찾기 (최상위)
  const manuals = allDocs.filter(d => d.category === 'MANUAL');

  manuals.forEach(m => {
    const mNode = createTreeNodeElement(m, 0, currentDocId, isAdminUser, 'PROCEDURE');
    treeArea.appendChild(mNode);

    // 하부 절차서들
    const procs = allDocs.filter(d => d.parentId === m.id || (m.childrenIds && m.childrenIds.includes(d.id)));
    procs.forEach(p => {
      const pNode = createTreeNodeElement(p, 1, currentDocId, isAdminUser, 'INSTRUCTION');
      treeArea.appendChild(pNode);

      // 하부 지침서들
      const insts = allDocs.filter(d => d.parentId === p.id || (p.childrenIds && p.childrenIds.includes(d.id)));
      insts.forEach(ins => {
        const insNode = createTreeNodeElement(ins, 2, currentDocId, isAdminUser, null);
        treeArea.appendChild(insNode);
      });
    });
  });

  // 상위가 지정되지 않은 기타 절차서/지침서가 있는 경우 처리
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

// 트리 노드 엘리먼트 생성 헬퍼
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
      const childName = childCategoryToAdd === 'PROCEDURE' ? '절차서' : '지침서';
      actionsHtml += `<button type="button" class="btn-node-opt" onclick="event.stopPropagation(); openNewDocModal('${childCategoryToAdd}', '${doc.id}')" title="하위 ${childName} 추가"><i class="fa-solid fa-plus"></i></button>`;
    }
    // 최상위 매뉴얼(MAN-KOSHA-01)은 안전을 위해 폐지 버튼 제외
    if (doc.id !== 'MAN-KOSHA-01') {
      actionsHtml += `<button type="button" class="btn-node-opt opt-del" onclick="event.stopPropagation(); deleteDocumentById('${doc.id}', '${escapeHtml(doc.title)}')" title="규정 폐지/삭제"><i class="fa-solid fa-trash-can"></i></button>`;
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

// 조항 목차 점프 리스트 생성
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

// 본문 내 검색 하이라이팅
function searchInDoc() {
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
// [최고 관리자 전용 메뉴 및 인쇄/다운로드 제어]
// ----------------------------------------------------------------
function toggleSuperAdminMenu() {
  const menu = document.getElementById('menu-superadmin');
  if (menu) {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }
}

// 외부 클릭 시 드롭다운 닫기
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('super-admin-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    const menu = document.getElementById('menu-superadmin');
    if (menu) menu.style.display = 'none';
  }
});

/** 1. 최고 관리자 전용: 공식 관리본 인쇄 (워터마크 완전 삭제 & 관리본 도장) */
async function triggerOfficialControlledPrint() {
  if (!AUTH.isSuperAdmin()) {
    alert('관리본(워터마크 삭제) 인쇄는 최고 관리자만 가능합니다.');
    return;
  }

  const user = AUTH.getUser();
  const userEmail = user ? user.email : '최고관리자';
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  // 워터마크 레이어 완전 초기화 (배경 워터마크 삭제)
  const watermarkLayer = document.getElementById('print-watermark-layer');
  if (watermarkLayer) {
    watermarkLayer.style.backgroundImage = 'none';
  }

  // 상단 헤더: 공식 관리본 표기
  const headerMeta = document.getElementById('print-watermark-text');
  if (headerMeta) {
    headerMeta.innerHTML = `<strong style="color:#d9480f;font-size:11pt;">[관리본 - CONTROLLED COPY]</strong> | 출력자: ${userEmail} | 출력일시: ${timeStr} | (주)세방테크 KOSHA-MS`;
  }

  // 감사 로그 전송
  await API.logPrint(currentDoc.id, currentDoc.title, `${userEmail} [관리본 출력 / 워터마크 제외]`);

  // 드롭다운 닫기 및 인쇄 창 호출
  const menu = document.getElementById('menu-superadmin');
  if (menu) menu.style.display = 'none';

  window.print();
}

/** 2. 일반 사용자용: 비관리본 인쇄 (대각선 워터마크 강제 유지) */
async function triggerSecurityPrint() {
  const user = AUTH.getUser();
  const userEmail = user ? user.email : '일반사용자(비관리본)';
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  // 1. 인쇄용 상단 헤더 텍스트 주입 (비관리본 명시)
  const headerMeta = document.getElementById('print-watermark-text');
  if (headerMeta) {
    headerMeta.innerText = `출력자: ${userEmail} | 출력일시: ${timeStr} | 문서보안: 비관리본 (UNCONTROLLED COPY)`;
  }

  // 2. 대각선 45도 반투명 워터마크 캔버스 생성 및 배경 이미지 강제 적용
  const canvas = document.createElement('canvas');
  canvas.width = 460;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  ctx.rotate(-25 * Math.PI / 180);
  ctx.font = 'bold 15px "Pretendard", "Malgun Gothic", sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText('(주)세방테크 KOSHA-MS [비관리본]', -30, 160);
  ctx.font = '12px "Pretendard", "Malgun Gothic", sans-serif';
  ctx.fillText(`출력자: ${userEmail}`, -30, 185);
  ctx.fillText(`출력일시: ${timeStr}`, -30, 205);

  const watermarkLayer = document.getElementById('print-watermark-layer');
  if (watermarkLayer) {
    watermarkLayer.style.backgroundImage = `url(${canvas.toDataURL()})`;
  }

  // 3. 백엔드로 인쇄 감사 로그 비동기 전송
  await API.logPrint(currentDoc.id, currentDoc.title, `${userEmail} [비관리본 출력]`);

  // 4. 인쇄 다이얼로그 호출
  window.print();
}

/** 3. 최고 관리자 전용: Word (.doc/.docx) 다운로드 */
function downloadAsDocx() {
  if (!AUTH.isSuperAdmin()) {
    alert('DOCX 다운로드는 최고 관리자만 가능합니다.');
    return;
  }

  const docHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${currentDoc.title}</title>
    <style>
      body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; line-height: 1.7; font-size: 11pt; color: #111; }
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
            (주)세방테크 안전보건경영시스템 표준 [관리본]
          </th>
        </tr>
        <tr>
          <th width="20%">문서번호</th><td width="30%">${currentDoc.docNumber || '-'}</td>
          <th width="20%">제·개정구분</th><td width="30%">${currentDoc.currentVersion || '-'}</td>
        </tr>
        <tr>
          <th>시행일자</th><td>${currentDoc.effectiveDate || '-'}</td>
          <th>주관부서</th><td>${currentDoc.department || '-'}</td>
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
  a.download = `[세방테크]_${currentDoc.docNumber}_${currentDoc.title}_(${currentDoc.currentVersion}).doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // 메뉴 닫기
  const menu = document.getElementById('menu-superadmin');
  if (menu) menu.style.display = 'none';
}

/** 4. 최고 관리자 전용: PDF 다운로드 (워터마크 제외 클린 PDF) */
function downloadAsPdf() {
  if (!AUTH.isSuperAdmin()) {
    alert('PDF 다운로드는 최고 관리자만 가능합니다.');
    return;
  }
  // 워터마크 없는 공식 관리본 인쇄 트리거 후 대상에서 "PDF로 저장" 선택 유도
  alert("안내: 인쇄 다이얼로그 창에서 [대상: PDF로 저장]을 선택하시면 워터마크가 없는 고화질 클린 PDF로 다운로드됩니다.");
  triggerOfficialControlledPrint();
}

// ----------------------------------------------------------------
// [URL 단축 / 딥링크 공유]
// ----------------------------------------------------------------
function copyShareUrl() {
  let shareUrl = `${window.location.origin}/detail.html?id=${currentDoc.id}`;
  if (activeClauseId) {
    shareUrl += `&clause=${activeClauseId}#${activeClauseId}`;
  }
  navigator.clipboard.writeText(shareUrl).then(() => {
    alert(`조항 딥링크 공유 주소가 클립보드에 복사되었습니다!\n\n${shareUrl}`);
  }).catch(() => {
    prompt('공유 링크를 복사하세요:', shareUrl);
  });
}

// ----------------------------------------------------------------
// [즐겨찾기 토글]
// ----------------------------------------------------------------
function toggleBookmark() {
  const bookmarks = JSON.parse(localStorage.getItem('sebang_bookmarks') || '[]');
  const idx = bookmarks.indexOf(currentDoc.id);
  if (idx >= 0) {
    bookmarks.splice(idx, 1);
    alert('즐겨찾기에서 제거되었습니다.');
  } else {
    bookmarks.push(currentDoc.id);
    alert('즐겨찾기에 등록되었습니다.');
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
    btn.innerHTML = `<i class="fa-solid fa-star"></i> 즐겨찾기 해제`;
  } else {
    btn.classList.remove('active');
    btn.innerHTML = `<i class="fa-regular fa-star"></i> 즐겨찾기`;
  }
}

// ----------------------------------------------------------------
// [임시 메모리 웹 에디터 (Sandbox Draft Modal - 오염 방지)]
// ----------------------------------------------------------------
function openDraftEditorModal() {
  if (!AUTH.isAdmin()) {
    alert('문서 수정 권한이 없습니다. 관리자 이메일로 로그인해 주세요.');
    return;
  }

  // 실서버 데이터 오염 방지를 위해 깊은 복사(Deep Clone)하여 임시 메모리 객체 생성
  draftDoc = JSON.parse(JSON.stringify(currentDoc));

  document.getElementById('edit-doc-title').value = draftDoc.title || '';
  document.getElementById('edit-doc-num').value = draftDoc.docNumber || '';
  document.getElementById('edit-doc-ver').value = bumpVersion(draftDoc.currentVersion);
  document.getElementById('edit-doc-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('edit-doc-summary').value = '';

  const editorArea = document.getElementById('draft-editor-area');
  editorArea.innerHTML = draftDoc.currentContent || '';

  document.getElementById('editor-modal').style.display = 'flex';
}

function closeDraftEditorModal() {
  if (confirm('작성 중인 임시 내용이 파기됩니다. 닫으시겠습니까?')) {
    draftDoc = null;
    document.getElementById('editor-modal').style.display = 'none';
  }
}

// 리치 텍스트 서식 명령
function formatDoc(cmd, val = null) {
  document.getElementById('draft-editor-area').focus();
  document.execCommand(cmd, false, val);
}

// 조항 추가 모달 열기 (제목/본문 분리 입력, 다음 번호 자동 감지)
function openArticleModal() {
  const editorArea = document.getElementById('draft-editor-area');
  const existingArticles = editorArea.querySelectorAll('.doc-article');
  let maxNum = 0;
  
  existingArticles.forEach(art => {
    const numEl = art.querySelector('.art-num');
    if (numEl) {
      const m = numEl.textContent.match(/제\s*(\d+)\s*조/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
  });

  const nextNum = (maxNum > 0) ? maxNum + 1 : (existingArticles.length + 1);
  document.getElementById('modal-art-num').value = `제${nextNum}조`;
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

// 모달 내 항(①, ②), 호(1., 가.) 기호 간편 삽입
function insertParagraphSymbol(sym) {
  const textarea = document.getElementById('modal-art-body');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  // 현재 커서가 줄의 시작이 아니면 줄바꿈 후 삽입
  const prefix = (start > 0 && val[start - 1] !== '\n') ? '\n' : '';
  textarea.value = val.substring(0, start) + prefix + sym + val.substring(end);
  textarea.focus();
  const nextPos = start + prefix.length + sym.length;
  textarea.setSelectionRange(nextPos, nextPos);
}

// 신규 조항 확인 및 에디터 맨 아래에 '새 줄' 독립 블록으로 삽입
function confirmAddArticle() {
  const artNum = document.getElementById('modal-art-num').value.trim() || '제n조';
  const artTitle = document.getElementById('modal-art-title').value.trim() || '조항 제목';
  const rawBody = document.getElementById('modal-art-body').value.trim() || '① 여기에 세부 절차 내용을 입력하십시오.';

  // 본문의 여러 줄(항, 호)을 HTML <p> 단위로 깔끔하게 변환
  const bodyParagraphs = rawBody.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p class="article-body">${escapeHtml(line)}</p>`)
    .join('\n');

  // 조항 번호 ID 추출 (예: 제5조 -> art-5)
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
  
  // 기존 본문 뒤에 독립된 새 줄로 안전하게 결합
  editorArea.insertAdjacentHTML('beforeend', newArticleHtml);

  // 추가된 새 조항 위치로 부드럽게 스크롤
  const addedEl = document.getElementById(articleId);
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

// 하위 호환용 템플릿 추가 (단축키 또는 이전 호출 대비)
function insertArticleTemplate() {
  openArticleModal();
}

// 표(Table) 삽입 다이얼로그
function insertTableDialog() {
  const rows = parseInt(prompt('생성할 표의 행(Row) 개수 (기본: 3):', '3'), 10) || 3;
  const cols = parseInt(prompt('생성할 표의 열(Column) 개수 (기본: 3):', '3'), 10) || 3;

  if (rows <= 0 || cols <= 0 || rows > 20 || cols > 10) {
    alert('행은 1~20개, 열은 1~10개 사이로 입력해 주십시오.');
    return;
  }

  let tableHtml = '<table class="content-table" style="width:100%; border-collapse:collapse; margin:15px 0;"><thead><tr>';
  for (let c = 1; c <= cols; c++) {
    tableHtml += `<th style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:8px 12px; font-weight:600;">구분 ${c}</th>`;
  }
  tableHtml += '</tr></thead><tbody>';

  for (let r = 1; r <= rows; r++) {
    tableHtml += '<tr>';
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<td style="border:1px solid #cbd5e1; padding:8px 12px;">내용 (${r}, ${c})</td>`;
    }
    tableHtml += '</tr>';
  }
  tableHtml += '</tbody></table><p><br></p>';

  formatDoc('insertHTML', tableHtml);
}

function insertRefLink() {
  const url = prompt('연결할 절차서/지침서 문서 ID 또는 URL을 입력하세요:', 'detail.html?id=PRC-KOSHA-01');
  const title = prompt('본문에 표시할 링크 텍스트:', '[위험성평가 관리 절차서]');
  if (url && title) {
    formatDoc('insertHTML', `<a href="${url}" class="ref-link" style="color:#1d4ed8; text-decoration:underline; font-weight:600;">${escapeHtml(title)}</a> `);
  }
}

// 개정 차수 자동 추천
function bumpVersion(ver) {
  if (!ver) return 'Rev.1';
  const m = ver.match(/Rev\.?(\d+)/i);
  if (m) {
    return `Rev.${parseInt(m[1]) + 1}`;
  }
  return ver + '.1';
}

// 최종 발행 및 적용
async function publishDraftChanges() {
  const summary = document.getElementById('edit-doc-summary').value.trim();
  if (!summary) {
    alert('개정 사유 및 주요 변경 요약을 반드시 입력해야 합니다.');
    document.getElementById('edit-doc-summary').focus();
    return;
  }

  const user = AUTH.getUser();
  const author = user ? user.email : 'admin@sebangtec.com';
  const newVer = document.getElementById('edit-doc-ver').value.trim();
  const newDate = document.getElementById('edit-doc-date').value;
  const newContent = document.getElementById('draft-editor-area').innerHTML;

  // 임시 메모리 객체 갱신
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
      alert(`[${newVer}] 성공적으로 발행되어 사내 포털에 적용되었습니다!`);
      document.getElementById('editor-modal').style.display = 'none';
      location.reload();
    } else {
      alert('저장 실패: ' + res.message);
    }
  } catch (e) {
    alert('저장 중 통신 오류가 발생했습니다.');
  }
}

// ----------------------------------------------------------------
// [개정이력 및 신구대조 (Diff)]
// ----------------------------------------------------------------
function openRevisionHistoryModal() {
  const listEl = document.getElementById('rev-timeline-list');
  listEl.innerHTML = '';

  const revs = currentDoc.revisions || [];
  if (revs.length === 0) {
    listEl.innerHTML = '<p>기록된 개정 이력이 없습니다.</p>';
  } else {
    revs.slice().reverse().forEach(r => {
      const item = document.createElement('div');
      item.className = 'rev-timeline-item';
      item.innerHTML = `
        <strong>${r.version}</strong> (${r.date}) - 작성자: ${r.author || '-'}<br>
        <span style="color:#555;">사유: ${r.summary || '최초 제정'}</span>
      `;
      listEl.appendChild(item);
    });
  }

  // 신구대조 표시
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
    document.getElementById('diff-prev-content').innerText = '최초 제정본으로 이전 비교 대상이 없습니다.';
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

// 간단한 신구대조 하이라이트
function highlightChanges(oldText, newText) {
  if (oldText === newText) return newText;
  return `<span class="diff-add">${newText}</span>`;
}

// ----------------------------------------------------------------
// [모달 4] 신규 절차서 / 지침서 추가 & 폐지 관리 로직
// ----------------------------------------------------------------
function openNewDocModal(targetCategory = 'PROCEDURE', parentId = null) {
  if (!AUTH.isAdmin()) {
    alert('규정 제정 및 추가는 관리자 권한이 필요합니다.');
    return;
  }

  const catSelect = document.getElementById('new-doc-category');
  catSelect.value = targetCategory;

  updateParentOptions(targetCategory, parentId);

  // 기본값 설정
  document.getElementById('new-doc-title').value = '';
  document.getElementById('new-doc-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('new-doc-dept').value = '품질안전보건실';
  document.getElementById('new-doc-summary').value = 'KOSHA-MS 안전보건경영체계 고도화에 따른 신규 규정 제정';

  // 추천 문서번호 설정
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
    opt.textContent = '(최상위 매뉴얼 - 상위 없음)';
    parentSelect.appendChild(opt);
    return;
  }

  if (category === 'PROCEDURE') {
    // 절차서는 매뉴얼을 부모로 가짐
    const manuals = allDocs.filter(d => d.category === 'MANUAL');
    manuals.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `[매뉴얼] ${m.title}`;
      if (selectedParentId === m.id) opt.selected = true;
      parentSelect.appendChild(opt);
    });
  } else if (category === 'INSTRUCTION') {
    // 지침서는 절차서를 부모로 가짐
    const procs = allDocs.filter(d => d.category === 'PROCEDURE');
    procs.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `[절차서] ${p.title}`;
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
  const department = document.getElementById('new-doc-dept').value.trim() || '품질안전보건실';
  const summary = document.getElementById('new-doc-summary').value.trim() || '신규 규정 최초 제정';

  if (!title) {
    alert('규정 명칭(제목)을 입력해 주십시오.');
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
  <h3 class="article-title"><span class="art-num">제1조</span> (목적)</h3>
  <p class="article-body">본 규정은 (주)세방테크의 안전보건경영시스템 운영에 있어 ${escapeHtml(title)}에 관한 세부 기준 및 절차를 확립함을 목적으로 한다.</p>
</div>

<div class="doc-article" id="art-2">
  <h3 class="article-title"><span class="art-num">제2조</span> (적용범위)</h3>
  <p class="article-body">회사의 본사 및 모든 시공 현장, 관계 협력업체의 작업 절차에 적용한다.</p>
</div>

<div class="doc-article" id="art-3">
  <h3 class="article-title"><span class="art-num">제3조</span> (책임과 권한)</h3>
  <p class="article-body">① 총괄책임자는 본 규정의 제반 이행 실태를 감독하고 필요한 조치를 취하여야 한다.</p>
  <p class="article-body">② 현장 관리책임자는 해당 작업 착수 전 본 규정에 명시된 안전보건 조치가 완료되었는지 확인하여야 한다.</p>
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
    // 1. 새 문서 저장
    await API.saveDocument(newDoc);

    // 2. 부모 문서의 childrenIds에 등록
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

    alert(`신규 ${getCategoryName(category)} [${title}]이(가) 등록되었습니다.\n해당 규정 상세 페이지로 이동합니다.`);
    closeNewDocModal();
    location.href = `detail.html?id=${newId}`;
  } catch (err) {
    alert('규정 등록 중 오류가 발생했습니다: ' + err.message);
  }
}

// 규정 폐지 / 삭제
async function deleteDocumentById(docId, docTitle) {
  if (!AUTH.isAdmin()) {
    alert('규정 폐지는 관리자 권한이 필요합니다.');
    return;
  }

  const confirmMsg = `[주의] '${docTitle}' (${docId}) 규정을 폐지(삭제)하시겠습니까?\n\n폐지된 규정은 포털 및 계층 트리에서 즉시 제외됩니다.`;
  if (!confirm(confirmMsg)) return;

  try {
    await API.deleteDocument(docId);
    alert(`'${docTitle}' 규정이 정상적으로 폐지되었습니다.`);
    
    // 현재 보고 있던 문서가 삭제된 문서인 경우 최상위 매뉴얼로 이동
    if (currentDoc && currentDoc.id === docId) {
      location.href = 'detail.html?id=MAN-KOSHA-01';
    } else {
      // 목록 재갱신
      allDocs = await API.getDocuments();
      renderHierarchyTree(currentDoc ? currentDoc.id : 'MAN-KOSHA-01');
    }
  } catch (err) {
    alert('규정 폐지 중 오류가 발생했습니다: ' + err.message);
  }
}
