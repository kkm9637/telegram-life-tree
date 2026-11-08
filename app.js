// 텔레그램 SDK 초기화
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand(); // 모바일 텔레그램 화면 전체 확장
}

const TOTAL_ZONES = 11;
let currentZone = 1;
let clickCoords = { xPercent: 0, yPercent: 0 };

// 로컬 스토리지 데이터 로드 (서버 연동 전 기본 캐시)
let treeData = JSON.parse(localStorage.getItem('life_tree_fruits') || '{}');

const zoneBar = document.getElementById('zoneBar');
const fruitLayer = document.getElementById('fruitLayer');
const modalOverlay = document.getElementById('modalOverlay');
const currentZoneLabel = document.getElementById('currentZoneLabel');
const fruitNameInput = document.getElementById('fruitName');
const fruitRoleInput = document.getElementById('fruitRole');
const btnCancel = document.getElementById('btnCancel');
const btnSave = document.getElementById('btnSave');

// 1. 11개 구역 칩 생성
function initZones() {
  zoneBar.innerHTML = '';
  for (let i = 1; i <= TOTAL_ZONES; i++) {
    const chip = document.createElement('button');
    chip.className = `zone-chip ${i === currentZone ? 'active' : ''}`;
    chip.textContent = `${i}구역`;
    chip.addEventListener('click', () => {
      currentZone = i;
      document.querySelectorAll('.zone-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderFruits();
    });
    zoneBar.appendChild(chip);
  }
}

// 2. 현재 구역의 열매 렌더링
function renderFruits() {
  fruitLayer.innerHTML = '';
  const zoneFruits = treeData[currentZone] || [];

  zoneFruits.forEach(item => {
    const node = document.createElement('div');
    node.className = 'fruit-node';
    node.style.left = `${item.x}%`;
    node.style.top = `${item.y}%`;

    const badge = document.createElement('div');
    badge.className = 'fruit-badge';
    badge.innerHTML = `
      <div class="badge-name">${escapeHtml(item.name)}</div>
      <div class="badge-role">${escapeHtml(item.role)}</div>
    `;
    node.appendChild(badge);
    fruitLayer.appendChild(node);
  });
}

// 3. 나무 클릭 시 상대 좌표(%) 계산 후 모달 오픈
fruitLayer.addEventListener('click', (e) => {
  // 열매 자체를 클릭했을 때는 중복 생성 방지
  if (e.target.closest('.fruit-node')) return;

  const rect = fruitLayer.getBoundingClientRect();
  const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
  const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

  clickCoords = { 
    xPercent: parseFloat(xPercent.toFixed(2)), 
    yPercent: parseFloat(yPercent.toFixed(2)) 
  };

  currentZoneLabel.textContent = `${currentZone}구역`;
  fruitNameInput.value = '';
  fruitRoleInput.value = '';
  modalOverlay.classList.add('active');
  fruitNameInput.focus();
});

// 4. 저장 및 취소 이벤트
btnCancel.addEventListener('click', () => {
  modalOverlay.classList.remove('active');
});

btnSave.addEventListener('click', () => {
  const name = fruitNameInput.value.trim();
  const role = fruitRoleInput.value.trim();

  if (!name || !role) {
    if (tg?.showAlert) tg.showAlert('이름과 역할을 모두 입력해주세요.');
    else alert('이름과 역할을 모두 입력해주세요.');
    return;
  }

  if (!treeData[currentZone]) {
    treeData[currentZone] = [];
  }

  treeData[currentZone].push({
    name,
    role,
    x: clickCoords.xPercent,
    y: clickCoords.yPercent,
    createdAt: new Date().toISOString()
  });

  localStorage.setItem('life_tree_fruits', JSON.stringify(treeData));
  
  // 텔레그램 햅틱 진동 피드백
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.notificationOccurred('success');
  }

  modalOverlay.classList.remove('active');
  renderFruits();
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 실행
initZones();
renderFruits();