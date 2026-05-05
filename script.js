const searchScreen = document.querySelector('.screen-search');
const resultScreen = document.querySelector('.screen-result');
const searchForm = document.getElementById('search-form');
const backButton = document.getElementById('back-button');
const searchAnotherButton = document.getElementById('search-another');
const candidateInput = document.getElementById('candidate-id');

function showScreen(screen) {
  searchScreen.classList.remove('active');
  resultScreen.classList.remove('active');
  screen.classList.add('active');
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = candidateInput.value.trim();

  if (value.length !== 8 || /\D/.test(value)) {
    candidateInput.focus();
    candidateInput.setCustomValidity('Vui lòng nhập đúng 8 chữ số.');
    candidateInput.reportValidity();
    candidateInput.setCustomValidity('');
    return;
  }

  showScreen(resultScreen);
});

backButton.addEventListener('click', () => showScreen(searchScreen));
searchAnotherButton.addEventListener('click', () => showScreen(searchScreen));

candidateInput.addEventListener('input', () => {
  candidateInput.value = candidateInput.value.replace(/\D/g, '').slice(0, 8);
});