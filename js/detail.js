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

// 좌측 표준 체계 트리 렌더링
function renderHierarchyTree(currentDocId) {
  const treeArea = document.getElementById('hierarchy-tree-area');
  if (!treeArea) return;
  treeArea.innerHTML = '';

  // 매뉴얼 찾기 (최상위)
  const manuals = allDocs.filter(d => d.category === 'MANUAL');

  manuals.forEach(m => {
    const mNode = document.createElement('div');
    mNode.className = `tree-node depth-0 ${m.id === currentDocId ? 'active' : ''}`;
    mNode.innerHTML = `<i class="fa-solid fa-folder-open"></i> <span>${m.title}</span>`;
    mNode.onclick = () => location.href = `detail.html?id=${m.id}`;
    treeArea.appendChild(mNode);

    // 하부 절차서들
    const procs = allDocs.filter(d => d.parentId === m.id || (m.childrenIds && m.childrenIds.includes(d.id)));
    procs.forEach(p => {
      const pNode = document.createElement('div');
      pNode.className = `tree-node depth-1 ${p.id === currentDocId ? 'active' : ''}`;
      pNode.innerHTML = `<i class="fa-solid fa-file-lines"></i> <span>${p.title}</span>`;
      pNode.onclick = () => location.href = `detail.html?id=${p.id}`;
      treeArea.appendChild(pNode);

      // 하부 지침서들
      const insts = allDocs.filter(d => d.parentId === p.id || (p.childrenIds && p.childrenIds.includes(d.id)));
      insts.forEach(ins => {
        const insNode = document.createElement('div');
        insNode.className = `tree-node depth-2 ${ins.id === currentDocId ? 'active' : ''}`;
        insNode.innerHTML = `<i class="fa-solid fa-file-code"></i> <span>${ins.title}</span>`;
        insNode.onclick = () => location.href = `detail.html?id=${ins.id}`;
        treeArea.appendChild(insNode);
      });
    });
  });
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
// [보안 인쇄 및 워터마크, 인쇄 로그]
// ----------------------------------------------------------------
async function triggerSecurityPrint() {
  const user = AUTH.getUser();
  const userEmail = user ? user.email : '비회원(외부접속)';
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  // 1. 인쇄용 상단 헤더 텍스트 주입
  const headerMeta = document.getElementById('print-watermark-text');
  if (headerMeta) {
    headerMeta.innerText = `출력자: ${userEmail} | 출력일시: ${timeStr} | 문서보안: 비제어본`;
  }

  // 2. 대각선 45도 반투명 워터마크 캔버스 생성 및 배경 이미지 적용
  const canvas = document.createElement('canvas');
  canvas.width = 450;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  ctx.rotate(-25 * Math.PI / 180);
  ctx.font = 'bold 15px "Pretendard", "Malgun Gothic", sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText('(주)세방테크 KOSHA-MS 비제어본', -30, 160);
  ctx.font = '12px "Pretendard", "Malgun Gothic", sans-serif';
  ctx.fillText(`출력자: ${userEmail}`, -30, 185);
  ctx.fillText(`출력일시: ${timeStr}`, -30, 205);

  const watermarkLayer = document.getElementById('print-watermark-layer');
  if (watermarkLayer) {
    watermarkLayer.style.backgroundImage = `url(${canvas.toDataURL()})`;
  }

  // 3. 백엔드로 인쇄 감사 로그 비동기 전송
  await API.logPrint(currentDoc.id, currentDoc.title, userEmail);

  // 4. 인쇄 다이얼로그 호출
  window.print();
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
  document.execCommand(cmd, false, val);
}

// 조항 템플릿 추가
function insertArticleTemplate() {
  const editorArea = document.getElementById('draft-editor-area');
  const nextNum = editorArea.querySelectorAll('.doc-article').length + 1;
  const tpl = `
<div class="doc-article" id="art-${nextNum}">
  <h3 class="article-title"><span class="art-num">제${nextNum}조</span> (조항 제목 입력)</h3>
  <p class="article-body">① 여기에 세부 절차 내용을 입력하십시오.</p>
</div>`;
  formatDoc('insertHTML', tpl);
}

function insertRefLink() {
  const url = prompt('연결할 절차서 문서 ID 또는 URL을 입력하세요:', 'detail.html?id=PRC-KOSHA-01');
  const title = prompt('표시할 링크 텍스트:', '[위험성평가 관리 절차서]');
  if (url && title) {
    formatDoc('insertHTML', `<a href="${url}" class="ref-link">${title}</a>`);
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

// 간단한 신구대조 하이라이트
function highlightChanges(oldText, newText) {
  if (oldText === newText) return newText;
  return `<span class="diff-add">${newText}</span>`;
}
