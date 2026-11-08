// 텔레그램 SDK 초기화
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const TOTAL_ZONES = 11;
let currentZone = 1;

// 상태 관리
let editingFruitId = null;
let pendingCoords = { x: 0, y: 0 };

// 브라우저 로컬 저장소 로드
let treeData = JSON.parse(localStorage.getItem('life_tree_fruits') || '{}');

// DOM 엘리먼트
const zoneBar = document.getElementById('zoneBar');
const fruitLayer = document.getElementById('fruitLayer');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const currentZoneLabel = document.getElementById('currentZoneLabel');
const fruitNameInput = document.getElementById('fruitName');
const fruitRoleInput = document.getElementById('fruitRole');
const btnCancel = document.getElementById('btnCancel');
const btnDelete = document.getElementById('btnDelete');
const btnSave = document.getElementById('btnSave');

// 1. 11개 구역 바 초기화
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

// 2. 현재 구역 사과 열매 렌더링
function renderFruits() {
  fruitLayer.innerHTML = '';
  const zoneFruits = treeData[currentZone] || [];

  zoneFruits.forEach(item => {
    const apple = document.createElement('div');
    apple.className = 'apple-node';
    apple.style.left = `${item.x}%`;
    apple.style.top = `${item.y}%`;

    apple.innerHTML = `
      <div class="apple-stem"></div>
      <div class="apple-leaf"></div>
      <div class="apple-body"></div>
      <div class="fruit-badge">
        <div class="badge-name">${escapeHtml(item.name)}</div>
        <div class="badge-role">${escapeHtml(item.role)}</div>
      </div>
    `;

    // 열매 클릭 시 수정/삭제 모달 열기
    apple.addEventListener('click', (e) => {
      e.stopPropagation(); // 배경 터치 방지
      openEditModal(item);
    });

    fruitLayer.appendChild(apple);
  });
}

// 3. 신규 열매 터치 생성 이벤트
fruitLayer.addEventListener('click', (e) => {
  const rect = fruitLayer.getBoundingClientRect();
  const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
  const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

  pendingCoords = {
    x: parseFloat(xPercent.toFixed(2)),
    y: parseFloat(yPercent.toFixed(2))
  };

  openCreateModal();
});

// 신규 모달 열기
function openCreateModal() {
  editingFruitId = null;
  modalTitle.textContent = '열매 달기 🍎';
  currentZoneLabel.textContent = `${currentZone}구역`;
  fruitNameInput.value = '';
  fruitRoleInput.value = '';
  btnDelete.style.display = 'none';
  btnSave.textContent = '열매 맺기';
  modalOverlay.classList.add('active');
  fruitNameInput.focus();
}

// 수정 모달 열기
function openEditModal(fruit) {
  editingFruitId = fruit.id;
  modalTitle.textContent = '열매 수정 / 삭제 🍎';
  currentZoneLabel.textContent = `${currentZone}구역`;
  fruitNameInput.value = fruit.name;
  fruitRoleInput.value = fruit.role;
  btnDelete.style.display = 'block';
  btnSave.textContent = '수정 완료';
  modalOverlay.classList.add('active');
  fruitNameInput.focus();
}

// 모달 닫기
btnCancel.addEventListener('click', () => {
  modalOverlay.classList.remove('active');
});

// 4. 저장 (신규 등록 또는 수정)
btnSave.addEventListener('click', () => {
  const name = fruitNameInput.value.trim();
  const role = fruitRoleInput.value.trim();

  if (!name || !role) {
    if (tg?.showAlert) tg.showAlert('이름과 나의 합심을 모두 입력해주세요.');
    else alert('이름과 나의 합심을 모두 입력해주세요.');
    return;
  }

  if (!treeData[currentZone]) {
    treeData[currentZone] = [];
  }

  if (editingFruitId) {
    // 기존 열매 내용 수정
    const target = treeData[currentZone].find(f => f.id === editingFruitId);
    if (target) {
      target.name = name;
      target.role = role;
    }
  } else {
    // 신규 열매 추가
    treeData[currentZone].push({
      id: 'fruit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name,
      role,
      x: pendingCoords.x,
      y: pendingCoords.y,
      createdAt: new Date().toISOString()
    });
  }

  saveAndRefresh();
});

// 5. 열매 삭제
btnDelete.addEventListener('click', () => {
  if (!editingFruitId) return;

  const confirmed = confirm('이 열매를 삭제하시겠습니까?');
  if (confirmed) {
    treeData[currentZone] = treeData[currentZone].filter(f => f.id !== editingFruitId);
    saveAndRefresh();
  }
});

function saveAndRefresh() {
  localStorage.setItem('life_tree_fruits', JSON.stringify(treeData));
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.notificationOccurred('success');
  }
  modalOverlay.classList.remove('active');
  renderFruits();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 실행
initZones();
renderFruits();
