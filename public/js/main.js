/**
 * 메인 포털 인터랙션 및 검색 로직 (main.js)
 */
let allDocuments = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 오늘 날짜 표시
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${today.getMonth()+1}.${today.getDate()}`;
  const badge = document.getElementById('current-date-badge');
  if (badge) badge.innerText = `기준일: ${dateStr}`;

  // 문서 목록 로드
  await loadDocuments();
});

async function loadDocuments() {
  try {
    allDocuments = await API.getDocuments();
    renderRecentList('recent');
  } catch (e) {
    console.error('문서 목록 로드 오류:', e);
  }
}

// 폴딩식 아코디언 트리 접기/펼치기 토글
function toggleFolder(btn) {
  const group = btn.closest('.foldable-group');
  if (!group) return;
  const subTree = group.querySelector(':scope > .sub-tree-container');
  if (!subTree) return;

  const isOpen = subTree.style.display !== 'none';
  if (isOpen) {
    subTree.style.display = 'none';
    btn.classList.remove('open');
    const folderIcon = group.querySelector(':scope > .cat-row .folder-icon');
    if (folderIcon) {
      folderIcon.classList.remove('fa-folder-open');
      folderIcon.classList.add('fa-folder');
    }
  } else {
    subTree.style.display = 'flex';
    btn.classList.add('open');
    const folderIcon = group.querySelector(':scope > .cat-row .folder-icon');
    if (folderIcon) {
      folderIcon.classList.remove('fa-folder');
      folderIcon.classList.add('fa-folder-open');
    }
  }
}


// 탭 전환
function switchTab(type) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderRecentList(type);
}

// 최신 목록 렌더링
function renderRecentList(filter) {
  const listEl = document.getElementById('recent-doc-list');
  if (!listEl) return;

  let filtered = allDocuments;
  if (filter === 'manual') {
    filtered = allDocuments.filter(d => d.category === 'MANUAL');
  } else if (filter === 'procedure') {
    filtered = allDocuments.filter(d => d.category === 'PROCEDURE');
  }

  listEl.innerHTML = '';
  if (filtered.length === 0) {
    listEl.innerHTML = '<li style="justify-content:center;color:#888;">등록된 규정이 없습니다.</li>';
    return;
  }

  filtered.forEach(doc => {
    const li = document.createElement('li');
    let pillClass = 'pill-manual';
    let pillText = '매뉴얼';
    if (doc.category === 'PROCEDURE') {
      pillClass = 'pill-proc';
      pillText = '절차서';
    } else if (doc.category === 'INSTRUCTION') {
      pillClass = 'pill-inst';
      pillText = '지침서';
    }

    li.innerHTML = `
      <a href="detail.html?id=${doc.id}" class="recent-link">
        <span class="doc-type-pill ${pillClass}">${pillText}</span>
        <strong>${doc.title}</strong>
        <span style="font-size:12px;color:#888;">[${doc.currentVersion}]</span>
      </a>
      <span class="recent-meta">시행 ${doc.effectiveDate}</span>
    `;
    listEl.appendChild(li);
  });
}

// 통합 검색 실행
async function executeSearch() {
  const input = document.getElementById('search-input');
  const query = input.value.trim();
  if (!query) {
    alert('검색어를 입력해 주세요.');
    return;
  }

  try {
    const results = await API.search(query);
    if (results.length === 0) {
      alert(`'${query}'에 대한 검색 결과가 없습니다.`);
      return;
    }

    // 결과가 1건이면 즉시 해당 상세 페이지로 이동
    if (results.length === 1) {
      location.href = `detail.html?id=${results[0].id}&q=${encodeURIComponent(query)}`;
    } else {
      // 복수 결과 시 첫 번째 문서로 이동하거나 알림
      const first = results[0];
      if (confirm(`총 ${results.length}건의 규정이 검색되었습니다.\n첫 번째 검색 결과인 [${first.title}] 로 이동하시겠습니까?`)) {
        location.href = `detail.html?id=${first.id}&q=${encodeURIComponent(query)}`;
      }
    }
  } catch (e) {
    alert('검색 중 오류가 발생했습니다.');
  }
}

// 퀵 키워드 검색
function quickSearch(word) {
  document.getElementById('search-input').value = word;
  executeSearch();
}
