const searchScreen = document.querySelector('.screen-search');
const resultScreen = document.querySelector('.screen-result');
const searchForm = document.getElementById('search-form');
const searchButton = searchForm ? searchForm.querySelector('button[type="submit"]') : null;
const backButton = document.getElementById('back-button');
const searchAnotherButton = document.getElementById('search-another');
const candidateInput = document.getElementById('candidate-id');
const searchFeedback = document.getElementById('search-feedback');
const resultStatus = document.getElementById('result-status');

const resultFields = {
  name: document.getElementById('result-name'),
  id: document.getElementById('result-id'),
  birthdate: document.getElementById('result-birthdate'),
  address: document.getElementById('result-address'),
  region: document.getElementById('result-region'),
  math: document.getElementById('result-math'),
  literature: document.getElementById('result-literature'),
  english: document.getElementById('result-english'),
};

const resultSections = [
  document.querySelector('.candidate-card'),
  document.getElementById('result-scores'),
];

const PROJECT_CONFIG = window.__SUPABASE_CONFIG__ || {};
const SUPABASE_CLIENTS = [];

if (window.supabase && typeof window.supabase.createClient === 'function') {
  for (const [region, config] of Object.entries(PROJECT_CONFIG)) {
    const url = (config?.url || '').trim();
    const anonKey = (config?.anonKey || '').trim();

    if (url && anonKey) {
      SUPABASE_CLIENTS.push({
        region,
        client: window.supabase.createClient(url, anonKey),
      });
    }
  }
}

function showScreen(screen) {
  searchScreen.classList.remove('active');
  resultScreen.classList.remove('active');
  screen.classList.add('active');
}

function setSearchFeedback(message = '', tone = '') {
  if (!searchFeedback) return;

  searchFeedback.textContent = message;
  searchFeedback.className = 'search-feedback';

  if (tone === 'error') {
    searchFeedback.classList.add('is-error');
  }
}

function setResultStatus(message = '', tone = '') {
  resultStatus.textContent = message;
  resultStatus.className = 'result-status';

  if (tone === 'error') {
    resultStatus.classList.add('is-error');
  } else if (tone === 'success') {
    resultStatus.classList.add('is-success');
  } else if (tone === 'loading') {
    resultStatus.classList.add('is-loading');
  }
}

function setResultSectionsVisible(visible) {
  resultSections.forEach((section) => {
    if (!section) return;
    section.classList.toggle('is-hidden', !visible);
  });
}

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('vi-VN').format(date);
}

function formatScore(value) {
  const number = Number(value);

  if (Number.isFinite(number)) {
    return number.toFixed(2);
  }

  return '—';
}

function formatCandidateId(value) {
  return String(value).padStart(8, '0');
}

function clearResultFields() {
  resultFields.name.textContent = '—';
  resultFields.id.textContent = '—';
  resultFields.birthdate.textContent = '—';
  resultFields.address.textContent = '—';
  resultFields.region.textContent = '—';
  resultFields.math.textContent = '—';
  resultFields.literature.textContent = '—';
  resultFields.english.textContent = '—';
}

function renderResult(record, region, searchedId) {
  resultFields.name.textContent = record.HoTen || '—';
  resultFields.id.textContent = formatCandidateId(searchedId);
  resultFields.birthdate.textContent = formatDate(record.NgaySinh);
  resultFields.address.textContent = record.DiaChi || '—';
  resultFields.region.textContent = region;
  resultFields.math.textContent = formatScore(record.DiemToan);
  resultFields.literature.textContent = formatScore(record.DiemVan);
  resultFields.english.textContent = formatScore(record.DiemAnh);
}

function setLoadingState(isLoading) {
  if (searchButton) {
    searchButton.disabled = isLoading;
    searchButton.textContent = isLoading ? 'Đang tra cứu...' : 'Tra cứu ngay';
  }

  if (candidateInput) {
    candidateInput.disabled = isLoading;
  }
}

async function queryProject(region, client, candidateId) {
  const { data, error } = await client
    .from('ThiSinh')
    .select('MaSoThiSinh,HoTen,NgaySinh,DiaChi,DiemToan,DiemVan,DiemAnh')
    .eq('MaSoThiSinh', candidateId)
    .limit(1);

  if (error) {
    throw new Error(`${region}: ${error.message}`);
  }

  return {
    region,
    record: data?.[0] ?? null,
  };
}

async function findCandidate(candidateId) {
  if (!SUPABASE_CLIENTS.length) {
    throw new Error('Chưa cấu hình Supabase cho MienBac/MienNam.');
  }

  const results = await Promise.allSettled(
    SUPABASE_CLIENTS.map(({ region, client }) => queryProject(region, client, candidateId))
  );

  const errors = [];

  for (const item of results) {
    if (item.status === 'fulfilled') {
      if (item.value.record) {
        return item.value;
      }
    } else if (item.reason instanceof Error) {
      errors.push(item.reason.message);
    } else {
      errors.push('Lỗi truy vấn dữ liệu.');
    }
  }

  return {
    region: '',
    record: null,
    errors,
  };
}

if (searchForm) {
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const rawValue = (candidateInput?.value || '').replace(/\D/g, '').slice(0, 8);

    if (!candidateInput) return;

    candidateInput.value = rawValue;

    if (rawValue.length !== 8) {
      candidateInput.focus();
      setSearchFeedback('Vui lòng nhập đúng 8 chữ số.', 'error');
      return;
    }

    // Redirect to result page with query param
    window.location.href = `result.html?id=${encodeURIComponent(rawValue)}`;
  });
}

// If we're on the result page, run the search using the id query param
if (resultScreen) {
  (async () => {
    const params = new URLSearchParams(window.location.search);
    const rawId = params.get('id') || '';

    if (!rawId) {
      setResultStatus('Không có số báo danh để tra cứu.', 'error');
      setResultSectionsVisible(false);
      return;
    }

    setResultSectionsVisible(true);
    clearResultFields();
    setResultStatus('Đang tra cứu dữ liệu từ MienBac và MienNam...', 'loading');
    setLoadingState(true);

    try {
      const searchResult = await findCandidate(Number(rawId));

      if (searchResult.record) {
        renderResult(searchResult.record, searchResult.region, rawId);
        // Update sub text
        const sub = document.getElementById('result-sub');
        if (sub) sub.textContent = `Số báo danh ${formatCandidateId(rawId)}`;
        setResultStatus(`Đã lấy dữ liệu từ ${searchResult.region}.`, 'success');
        return;
      }

      clearResultFields();
      setResultStatus(`Không tìm thấy kết quả cho SBD ${formatCandidateId(rawId)}.`, 'error');

      if (searchResult.errors?.length) {
        // If there's a searchFeedback on page, show it
        setSearchFeedback(searchResult.errors.join(' | '), 'error');
      }
    } catch (error) {
      clearResultFields();
      setResultStatus(error instanceof Error ? error.message : 'Không thể truy vấn dữ liệu.', 'error');
      setSearchFeedback(error instanceof Error ? error.message : 'Không thể truy vấn dữ liệu.', 'error');
    } finally {
      setLoadingState(false);
    }
  })();
}

if (backButton) {
  backButton.addEventListener('click', () => {
    // If we have history, go back; otherwise go to index
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'index.html';
    }
  });
}

if (searchAnotherButton) {
  searchAnotherButton.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}

candidateInput.addEventListener('input', () => {
  candidateInput.value = candidateInput.value.replace(/\D/g, '').slice(0, 8);
  setSearchFeedback('');
});