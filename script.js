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

const SBD_MIN = 1;
const SBD_MAX = 1000;
const NORTH_MAX = 500;
const REGION_LABELS = {
  MienBac: 'Miền Bắc',
  MienNam: 'Miền Nam',
};

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
  return String(value);
}

function getRegionForCandidateId(candidateId) {
  if (candidateId >= SBD_MIN && candidateId <= NORTH_MAX) {
    return 'MienBac';
  }

  if (candidateId > NORTH_MAX && candidateId <= SBD_MAX) {
    return 'MienNam';
  }

  return null;
}

function isConnectionError(error) {
  return error instanceof Error && /DB_MienBac|DB_MienNam|fetch|network|failed to fetch|connection|timeout|supabase/i.test(error.message);
}

function normalizeCandidateInput(value) {
  const trimmed = String(value || '').trim();

  if (!trimmed) {
    return { error: 'SBD không hợp lệ. Vui lòng nhập lại.' };
  }

  if (!/^\d+$/.test(trimmed)) {
    return { error: 'SBD không hợp lệ. Vui lòng nhập lại.' };
  }

  const candidateId = Number(trimmed);

  if (!Number.isInteger(candidateId)) {
    return { error: 'SBD không hợp lệ. Vui lòng nhập lại.' };
  }

  if (candidateId < SBD_MIN || candidateId > SBD_MAX) {
    return { error: 'Số báo danh phải từ 1 đến 1000.' };
  }

  return { candidateId };
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
  const dbName = region === 'MienBac' ? 'DB_MienBac' : 'DB_MienNam';
  const { data, error } = await client
    .from('ThiSinh')
    .select('MaSoThiSinh,HoTen,NgaySinh,DiaChi,DiemToan,DiemVan,DiemAnh')
    .eq('MaSoThiSinh', candidateId)
    .limit(1);

  if (error) {
    throw new Error(`${dbName}: ${error.message}`);
  }

  return {
    region,
    record: data?.[0] ?? null,
  };
}

async function findCandidate(candidateId) {
  const region = getRegionForCandidateId(candidateId);

  if (!region) {
    return {
      region: '',
      record: null,
      errors: [],
    };
  }

  if (!SUPABASE_CLIENTS.length) {
    throw new Error('Khu vực đang bảo trì.');
  }

  const regionEntry = SUPABASE_CLIENTS.find((item) => item.region === region);

  if (!regionEntry) {
    throw new Error('Khu vực đang bảo trì.');
  }

  const searchResult = await queryProject(regionEntry.region, regionEntry.client, candidateId);

  return {
    region: searchResult.region,
    record: searchResult.record,
    errors: [],
  };
}

if (searchForm) {
  if (candidateInput) {
    candidateInput.value = '';
  }

  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const normalized = normalizeCandidateInput(candidateInput?.value || '');

    if (!candidateInput) return;

    candidateInput.value = (candidateInput.value || '').trim();

    if (normalized.error) {
      candidateInput.focus();
      setSearchFeedback(normalized.error, 'error');
      return;
    }

    setSearchFeedback('Đang kiểm tra dữ liệu...', '');
    setLoadingState(true);

    try {
      const searchResult = await findCandidate(normalized.candidateId);

      if (searchResult.record) {
        window.location.href = `result.html?id=${encodeURIComponent(String(normalized.candidateId))}`;
        return;
      }

      setSearchFeedback('Không tìm thấy số báo danh.', 'error');
      candidateInput.focus();
    } catch (error) {
      if (isConnectionError(error)) {
        setSearchFeedback('Khu vực đang bảo trì.', 'error');
      } else {
        setSearchFeedback(error instanceof Error ? error.message : 'Khu vực đang bảo trì.', 'error');
      }
    } finally {
      setLoadingState(false);
    }
  });
}

// If we're on the result page, run the search using the id query param
if (resultScreen) {
  (async () => {
    const params = new URLSearchParams(window.location.search);
    const rawId = params.get('id') || '';
    const normalized = normalizeCandidateInput(rawId);

    if (normalized.error) {
      setResultStatus(normalized.error, 'error');
      setResultSectionsVisible(false);
      return;
    }

    setResultSectionsVisible(true);
    clearResultFields();
    setResultStatus('Đang tra cứu dữ liệu...', 'loading');
    setLoadingState(true);

    try {
      const searchResult = await findCandidate(normalized.candidateId);

      if (searchResult.record) {
        renderResult(searchResult.record, searchResult.region, normalized.candidateId);
        // Update sub text
        const sub = document.getElementById('result-sub');
        if (sub) sub.textContent = `Số báo danh ${formatCandidateId(normalized.candidateId)}`;
        setResultStatus('', '');
        return;
      }

      clearResultFields();
      setResultStatus('Không tìm thấy số báo danh.', 'error');
    } catch (error) {
      clearResultFields();
      if (isConnectionError(error)) {
        setResultStatus('Khu vực đang bảo trì.', 'error');
      } else {
        setResultStatus(error instanceof Error ? error.message : 'Khu vực đang bảo trì.', 'error');
      }
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