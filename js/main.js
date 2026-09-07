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

  // 방문자 카운터 로드
  await loadVisitorCounter();
});

async function loadVisitorCounter() {
  try {
    const counter = await API.getVisitorCounter();
    if (!counter) return;

    const todayEl = document.getElementById('counter-today');
    const totalEl = document.getElementById('counter-total');
    const footerTodayEl = document.getElementById('footer-counter-today');
    const footerTotalEl = document.getElementById('footer-counter-total');

    const todayCount = Number(counter.today || 0).toLocaleString();
    const totalCount = Number(counter.total || 0).toLocaleString();

    if (todayEl) todayEl.innerText = todayCount;
    if (totalEl) totalEl.innerText = totalCount;
    if (footerTodayEl) footerTodayEl.innerText = todayCount;
    if (footerTotalEl) footerTotalEl.innerText = totalCount;
  } catch (e) {
    console.error('방문자 카운터 로드 오류:', e);
  }
}

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

// ==========================================================================
// 통합 검색 엔진 (10개 단위, 매뉴얼➔절차서➔지침서➔양식 유사도순, 요약 스니펫)
// ==========================================================================

let allForms = [];
const docDetailsCache = {};
const formDetailsCache = {};
let currentSearchResults = [];
let currentFilterCategory = 'ALL';
let currentSearchPage = 1;
const ITEMS_PER_PAGE = 10;
let currentSearchQuery = '';

// 양식 목록 로드
async function loadForms() {
  if (allForms.length > 0) return allForms;
  try {
    const res = await fetch('data/forms_index.json');
    if (res.ok) {
      allForms = await res.json();
    }
  } catch (e) {
    console.warn('양식 인덱스 로드 실패:', e);
  }
  return allForms;
}

// HTML 태그 제거 헬퍼
function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// 텍스트에서 키워드 주변 문맥 스니펫(요약) 추출
function extractSnippetFromText(text, keyword, maxSnippetLen = 90) {
  if (!text || !keyword) return null;
  const lowerText = text.toLowerCase();
  const lowerKw = keyword.toLowerCase();
  const idx = lowerText.indexOf(lowerKw);
  if (idx === -1) return null;

  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + keyword.length + 50);

  let snippet = text.substring(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  // 키워드 하이라이트 치환 (대소문자 보존)
  const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlighted = snippet.replace(new RegExp(`(${escapedKw})`, 'gi'), '<mark class="search-kw-highlight">$1</mark>');

  return highlighted;
}

// 문서/양식에서 키워드 문맥 요약 스니펫 목록 추출
function extractDocumentSnippets(doc, keyword) {
  const snippets = [];
  const addedTexts = new Set();

  function addSnippet(locationName, text) {
    if (!text || snippets.length >= 3) return;
    const cleanText = stripHtml(text).replace(/\s+/g, ' ').trim();
    if (!cleanText.toLowerCase().includes(keyword.toLowerCase())) return;

    const snippetHtml = extractSnippetFromText(cleanText, keyword);
    if (snippetHtml && !addedTexts.has(cleanText.substring(0, 30))) {
      addedTexts.add(cleanText.substring(0, 30));
      snippets.push({
        location: locationName,
        html: snippetHtml
      });
    }
  }

  // 1. 문서 설명 / 개요
  if (doc.description) {
    addSnippet('문서 개요', doc.description);
  }

  // 2. 조항(articles) 및 본문 섹션
  if (Array.isArray(doc.sections)) {
    for (const sec of doc.sections) {
      if (snippets.length >= 3) break;
      const secTitle = sec.title || sec.heading || '';
      if (sec.content) {
        addSnippet(secTitle || '본문 조항', sec.content);
      }
      if (sec.htmlContent) {
        addSnippet(secTitle || '본문 조항', sec.htmlContent);
      }
      if (Array.isArray(sec.articles)) {
        for (const art of sec.articles) {
          if (snippets.length >= 3) break;
          const artLoc = (art.number ? art.number + ' ' : '') + (art.title || '');
          addSnippet(artLoc || '조항', art.content || art.htmlContent || '');
        }
      }
    }
  }

  // 3. 장별 구조(chapters)
  if (Array.isArray(doc.chapters)) {
    for (const chap of doc.chapters) {
      if (snippets.length >= 3) break;
      const chapTitle = chap.title || '';
      if (Array.isArray(chap.sections)) {
        for (const sec of chap.sections) {
          if (snippets.length >= 3) break;
          const loc = (chapTitle ? chapTitle + ' > ' : '') + (sec.title || sec.number || '');
          addSnippet(loc, sec.content || sec.htmlContent || '');
        }
      }
    }
  }

  // 4. 용어 정의(terms)
  if (Array.isArray(doc.terms)) {
    for (const term of doc.terms) {
      if (snippets.length >= 3) break;
      addSnippet(`용어 정의 (${term.term})`, term.definition);
    }
  }

  // 5. currentContent (HTML 본문 전문) 정밀 파싱
  if (doc.currentContent && typeof doc.currentContent === 'string') {
    try {
      const parser = new DOMParser();
      const docDom = parser.parseFromString(doc.currentContent, 'text/html');
      const nodes = docDom.querySelectorAll('h1, h2, h3, h4, h5, p, td, th, li, .section-title, .article-title, .chapter-title, .term-entry');
      let currentHeading = '본문';

      for (const node of nodes) {
        if (snippets.length >= 3) break;
        const tag = node.tagName.toLowerCase();
        const text = (node.textContent || node.innerText || '').trim();
        if (!text) continue;

        if (['h1', 'h2', 'h3', 'h4'].includes(tag) || node.classList.contains('section-title') || node.classList.contains('chapter-title') || node.classList.contains('article-title')) {
          currentHeading = text.substring(0, 35);
        }

        if (text.toLowerCase().includes(keyword.toLowerCase())) {
          addSnippet(currentHeading, text);
        }
      }
    } catch (e) {
      const clean = stripHtml(doc.currentContent);
      addSnippet('본문', clean);
    }
  }

  // 6. 양식 체크리스트 / 필드 (defaultData)
  if (doc.defaultData && typeof doc.defaultData === 'object') {
    if (Array.isArray(doc.defaultData.checkRows)) {
      for (const row of doc.defaultData.checkRows) {
        if (snippets.length >= 3) break;
        const rowText = `${row.item || ''} ${row.action || ''} ${row.area || ''}`;
        addSnippet(`점검항목 [${row.area || '전체'}]`, rowText);
      }
    }
  }

  // 7. 전체 텍스트 검색 폴백 (아직 스니펫이 없고 본문에 키워드가 포함된 경우)
  if (snippets.length === 0) {
    const rawJson = JSON.stringify(doc);
    const snippetHtml = extractSnippetFromText(stripHtml(rawJson), keyword);
    if (snippetHtml) {
      snippets.push({
        location: '본문 내용',
        html: snippetHtml
      });
    }
  }

  return snippets;
}

// 유사도 점수 계산
function calculateRelevanceScore(item, keyword, snippets) {
  let score = 0;
  const kw = keyword.toLowerCase();
  const title = (item.title || '').toLowerCase();
  const docNum = (item.docNumber || item.id || '').toLowerCase();

  // 제목 정확도
  if (title === kw) {
    score += 100;
  } else if (title.startsWith(kw)) {
    score += 70;
  } else if (title.includes(kw)) {
    score += 50;
  }

  // 문서번호 일치
  if (docNum.includes(kw)) {
    score += 40;
  }

  // 스니펫 위치/내용 일치
  snippets.forEach(snp => {
    if (snp.location && snp.location.toLowerCase().includes(kw)) {
      score += 25;
    }
    score += 15;
  });

  // 본문 출현 빈도수 가산 (JSON 내 등장 횟수)
  try {
    const raw = JSON.stringify(item).toLowerCase();
    const count = (raw.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    score += Math.min(count * 4, 40);
  } catch (ignored) {}

  return score;
}

// 통합 검색 실행
async function executeSearch() {
  const input = document.getElementById('search-input');
  const query = input.value.trim();
  if (!query) {
    alert('검색어를 입력해 주세요.');
    input.focus();
    return;
  }

  currentSearchQuery = query;
  currentSearchPage = 1;

  // 카테고리 셀렉트 박스 동기화
  const selectCat = document.getElementById('search-category')?.value || 'ALL';
  currentFilterCategory = selectCat;

  // 로딩 상태 표시
  const resultsSection = document.getElementById('search-results-section');
  const resultsList = document.getElementById('search-results-list');
  resultsSection.style.display = 'block';
  resultsList.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top:12px;font-weight:600;">규정 및 양식 전문을 정밀 검색 중입니다...</p></div>';

  // 검색 섹션으로 스크롤 이동
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 1. 규정 목록 & 양식 목록 확보
  if (allDocuments.length === 0) {
    await loadDocuments();
  }
  await loadForms();

  // 2. 전체 규정 상세 및 양식 상세 병렬 로드 및 캐시
  const docPromises = allDocuments.map(async (doc) => {
    if (!docDetailsCache[doc.id]) {
      try {
        const full = await API.getDocument(doc.id);
        docDetailsCache[doc.id] = full || doc;
      } catch (e) {
        docDetailsCache[doc.id] = doc;
      }
    }
    return docDetailsCache[doc.id];
  });

  const formPromises = allForms.map(async (form) => {
    if (!formDetailsCache[form.id]) {
      try {
        const res = await fetch(`data/forms/${form.id}.json`);
        if (res.ok) {
          const fullForm = await res.json();
          formDetailsCache[form.id] = Object.assign({}, form, fullForm);
        } else {
          formDetailsCache[form.id] = form;
        }
      } catch (e) {
        formDetailsCache[form.id] = form;
      }
    }
    return formDetailsCache[form.id];
  });

  const [fullDocs, fullForms] = await Promise.all([
    Promise.all(docPromises),
    Promise.all(formPromises)
  ]);

  // 3. 검색 및 스니펫 추출, 유사도 점수 산출
  const matchedResults = [];

  // (1) 규정 문서 검색 (매뉴얼, 절차서, 지침서)
  for (const doc of fullDocs) {
    const rawText = JSON.stringify(doc).toLowerCase();
    if (rawText.includes(query.toLowerCase())) {
      const snippets = extractDocumentSnippets(doc, query);
      const score = calculateRelevanceScore(doc, query, snippets);

      let catPriority = 2; // 지침서
      if (doc.category === 'MANUAL') catPriority = 0; // 1순위: 매뉴얼
      else if (doc.category === 'PROCEDURE') catPriority = 1; // 2순위: 절차서
      else if (doc.category === 'INSTRUCTION') catPriority = 2; // 3순위: 지침서

      matchedResults.push({
        id: doc.id,
        title: doc.title,
        docNumber: doc.docNumber || doc.id,
        category: doc.category,
        categoryPriority: catPriority,
        version: doc.currentVersion || 'Rev.0',
        effectiveDate: doc.effectiveDate || '-',
        department: doc.department || '품질안전보건실',
        snippets: snippets,
        relevanceScore: score,
        type: 'DOC'
      });
    }
  }

  // (2) 양식/서식 검색 (FORM)
  for (const form of fullForms) {
    const rawText = JSON.stringify(form).toLowerCase();
    if (rawText.includes(query.toLowerCase())) {
      const snippets = extractDocumentSnippets(form, query);
      const score = calculateRelevanceScore(form, query, snippets);

      matchedResults.push({
        id: form.id,
        title: form.title,
        docNumber: form.docNumber || form.id,
        category: 'FORM',
        categoryPriority: 3, // 4순위: 양식
        version: form.version || 'Rev.1',
        effectiveDate: form.effectiveDate || '-',
        department: form.department || '품질안전보건실',
        snippets: snippets,
        relevanceScore: score,
        type: 'FORM'
      });
    }
  }

  // 4. 정렬 로직 (핵심 요구사항):
  //    1차: 매뉴얼(0) ➔ 절차서(1) ➔ 지침서(2) ➔ 양식(3) 순
  //    2차: 각 카테고리 내에서는 유사도 점수(relevanceScore) 내림차순
  matchedResults.sort((a, b) => {
    if (a.categoryPriority !== b.categoryPriority) {
      return a.categoryPriority - b.categoryPriority;
    }
    return b.relevanceScore - a.relevanceScore;
  });

  currentSearchResults = matchedResults;

  // 키워드 및 총 건수 헤더 갱신
  document.getElementById('results-keyword').innerText = query;
  document.getElementById('results-total-count').innerText = `${matchedResults.length}건`;

  // 카테고리 탭 카운트 갱신
  updateCategoryTabCounts();

  // 결과 렌더링
  renderSearchResults();
}

// 카테고리별 건수 뱃지 갱신
function updateCategoryTabCounts() {
  const counts = {
    ALL: currentSearchResults.length,
    MANUAL: currentSearchResults.filter(r => r.category === 'MANUAL').length,
    PROCEDURE: currentSearchResults.filter(r => r.category === 'PROCEDURE').length,
    INSTRUCTION: currentSearchResults.filter(r => r.category === 'INSTRUCTION').length,
    FORM: currentSearchResults.filter(r => r.category === 'FORM').length
  };

  document.getElementById('count-all').innerText = counts.ALL;
  document.getElementById('count-manual').innerText = counts.MANUAL;
  document.getElementById('count-procedure').innerText = counts.PROCEDURE;
  document.getElementById('count-instruction').innerText = counts.INSTRUCTION;
  document.getElementById('count-form').innerText = counts.FORM;

  // 탭 버튼 활성화 상태 동기화
  document.querySelectorAll('.s-tab-btn').forEach(btn => {
    if (btn.dataset.cat === currentFilterCategory) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// 카테고리 필터 탭 클릭
function filterSearchCategory(category) {
  currentFilterCategory = category;
  currentSearchPage = 1;
  const selectCat = document.getElementById('search-category');
  if (selectCat) selectCat.value = category;

  updateCategoryTabCounts();
  renderSearchResults();
}

// 검색 결과 목록 및 10개 단위 페이징 렌더링
function renderSearchResults() {
  const listEl = document.getElementById('search-results-list');
  const paginationEl = document.getElementById('search-pagination');

  // 필터링 적용
  let filtered = currentSearchResults;
  if (currentFilterCategory !== 'ALL') {
    filtered = currentSearchResults.filter(r => r.category === currentFilterCategory);
  }

  // 검색 결과 없음 처리
  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="no-search-results">
        <i class="fa-solid fa-folder-open"></i>
        <h4>'${currentSearchQuery}'에 대한 ${getCategoryName(currentFilterCategory)} 검색 결과가 없습니다.</h4>
        <p>단어의 철자가 정확한지 확인하시거나, 다른 검색어로 다시 시도해 주세요.</p>
      </div>
    `;
    paginationEl.style.display = 'none';
    return;
  }

  // 10개 단위 페이징 계산
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (currentSearchPage > totalPages) currentSearchPage = totalPages;
  if (currentSearchPage < 1) currentSearchPage = 1;

  const startIndex = (currentSearchPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const pageItems = filtered.slice(startIndex, endIndex);

  // 카드 렌더링
  let html = '';
  pageItems.forEach((item, index) => {
    const itemNum = startIndex + index + 1;
    const catBadgeClass = getCategoryBadgeClass(item.category);
    const catName = getCategoryName(item.category);

    // 상세 이동 링크
    const targetUrl = item.type === 'FORM'
      ? `forms.html?formId=${item.id}&q=${encodeURIComponent(currentSearchQuery)}`
      : `detail.html?id=${item.id}&q=${encodeURIComponent(currentSearchQuery)}`;

    // 스니펫 목록 렌더링
    let snippetsHtml = '';
    if (item.snippets && item.snippets.length > 0) {
      snippetsHtml = `
        <div class="res-snippets-box">
          ${item.snippets.map(s => `
            <div class="res-snippet-item">
              <span class="snippet-loc-badge">${s.location}</span>
              <span>${s.html}</span>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      snippetsHtml = `
        <div class="res-snippets-box" style="color:#888;font-size:12.5px;">
          <i class="fa-solid fa-info-circle"></i> 문서 기본 정보와 제목이 검색어와 일치합니다.
        </div>
      `;
    }

    // 유사도 일치율 추정 (최대 100%)
    const matchPercent = Math.min(Math.round((item.relevanceScore / 120) * 100), 99);

    html += `
      <a href="${targetUrl}" class="search-result-card" title="해당 규정/양식 바로보기">
        <div class="res-card-header">
          <div class="res-header-tags">
            <span class="res-category-badge ${catBadgeClass}">${catName}</span>
            <span class="res-doc-number">${item.docNumber}</span>
            <span class="res-version-pill">${item.version}</span>
          </div>
          <span class="res-score-badge"><i class="fa-solid fa-chart-simple"></i> 관련도 ${matchPercent}%</span>
        </div>
        <div class="res-card-title">
          <span style="color:#64748b;font-size:14px;font-weight:600;">#${itemNum}</span>
          <span>${item.title}</span>
        </div>
        ${snippetsHtml}
        <div class="res-card-footer">
          <span><i class="fa-regular fa-calendar"></i> 시행: ${item.effectiveDate} · 담당: ${item.department}</span>
          <span class="res-footer-action">
            원문 바로보기 <i class="fa-solid fa-arrow-right"></i>
          </span>
        </div>
      </a>
    `;
  });

  listEl.innerHTML = html;

  // 10개 단위 페이지네이션 버튼 렌더링
  if (totalPages > 1) {
    paginationEl.style.display = 'flex';
    let pBtnHtml = '';

    // 이전 페이지 버튼
    pBtnHtml += `
      <button class="s-page-btn" onclick="goToSearchPage(${currentSearchPage - 1})" ${currentSearchPage === 1 ? 'disabled' : ''} title="이전 페이지">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
    `;

    // 페이지 번호 버튼들
    for (let p = 1; p <= totalPages; p++) {
      const activeClass = p === currentSearchPage ? 'active' : '';
      pBtnHtml += `
        <button class="s-page-btn ${activeClass}" onclick="goToSearchPage(${p})">${p}</button>
      `;
    }

    // 다음 페이지 버튼
    pBtnHtml += `
      <button class="s-page-btn" onclick="goToSearchPage(${currentSearchPage + 1})" ${currentSearchPage === totalPages ? 'disabled' : ''} title="다음 페이지">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    `;

    paginationEl.innerHTML = pBtnHtml;
  } else {
    paginationEl.style.display = 'none';
  }
}

// 특정 페이지로 이동
function goToSearchPage(page) {
  currentSearchPage = page;
  renderSearchResults();
  document.getElementById('search-results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 카테고리 뱃지 클래스 매핑
function getCategoryBadgeClass(category) {
  switch (category) {
    case 'MANUAL': return 'res-cat-manual';
    case 'PROCEDURE': return 'res-cat-procedure';
    case 'INSTRUCTION': return 'res-cat-instruction';
    case 'FORM': return 'res-cat-form';
    default: return 'res-cat-manual';
  }
}

// 카테고리 한글명 매핑
function getCategoryName(category) {
  switch (category) {
    case 'MANUAL': return '매뉴얼';
    case 'PROCEDURE': return '절차서';
    case 'INSTRUCTION': return '지침서';
    case 'FORM': return '양식·서식';
    case 'ALL': return '전체';
    default: return '규정';
  }
}

// 검색 결과 섹션 닫기
function closeSearchResults() {
  const resultsSection = document.getElementById('search-results-section');
  if (resultsSection) {
    resultsSection.style.display = 'none';
  }
}

// 퀵 키워드 검색
function quickSearch(word) {
  const input = document.getElementById('search-input');
  if (input) input.value = word;
  executeSearch();
}

