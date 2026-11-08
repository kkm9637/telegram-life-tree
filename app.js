// 텔레그램 SDK 초기화
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// -------------------------------------------------------------
// [설정] 서버 API 주소 (우분투 서버 IP 또는 도메인)
// 예: 'https://api.yourdomain.com' 또는 'http://123.456.78.90:8000'
// 비워두면('') 로컬스토리지 모드로 동작합니다.
// -------------------------------------------------------------
const API_BASE_URL = ''; 

const TOTAL_ZONES = 11;
let currentZone = 1;

let treeData = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: [], 11: [] };
let editingFruitId = null;
let pendingCoords = { x: 0, y: 0 };

// 드래그 상태 관리 변수
let isDragging = false;
let draggedFruitId = null;
let hasMoved = false;
let startPointer = { x: 0, y: 0 };

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

// 1. 서버 데이터 불러오기 (트래픽 최적화 Polling)
async function fetchFruits() {
  if (isDragging) return; // 드래그 중 화면 갱신 방지

  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/fruits`);
      if (res.ok) {
        treeData = await res.json();
        renderFruits();
      }
    } catch (err) {
      console.error('API Fetch Error:', err);
    }
  } else {
    // 로컬스토리지 폴백
    treeData = JSON.parse(localStorage.getItem('life_tree_fruits') || '{}');
    for (let i = 1; i <= TOTAL_ZONES; i++) {
      if (!treeData[i]) treeData[i] = [];
    }
    renderFruits();
  }
}

// 2. 11개 구역 칩 초기화
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

// 3. 열매 렌더링 및 드래그 바인딩
function renderFruits() {
  fruitLayer.innerHTML = '';
  const zoneFruits = treeData[currentZone] || [];

  zoneFruits.forEach(item => {
    const apple = document.createElement('div');
    apple.className = 'apple-node';
    apple.id = `apple_${item.id}`;
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

    // 터치 및 마우스 드래그 이벤트 (Pointer Events)
    apple.addEventListener('pointerdown', (e) => onPointerDown(e, item));

    fruitLayer.appendChild(apple);
  });
}

// 4. 드래그 앤 드롭 로직
function onPointerDown(e, fruit) {
  e.stopPropagation();
  isDragging = true;
  draggedFruitId = fruit.id;
  hasMoved = false;
  startPointer = { x: e.clientX, y: e.clientY };

  const apple = document.getElementById(`apple_${fruit.id}`);
  if (apple) {
    apple.setPointerCapture(e.pointerId);
    apple.classList.add('dragging');
  }

  const onPointerMove = (moveEvent) => {
    if (!isDragging) return;

    const dx = Math.abs(moveEvent.clientX - startPointer.x);
    const dy = Math.abs(moveEvent.clientY - startPointer.y);
    if (dx > 4 || dy > 4) {
      hasMoved = true;
    }

    const rect = fruitLayer.getBoundingClientRect();
    let xPercent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
    let yPercent = ((moveEvent.clientY - rect.top) / rect.height) * 100;

    // 화면 밖 벗어남 방지 (2% ~ 98%)
    xPercent = Math.max(2, Math.min(98, xPercent));
    yPercent = Math.max(2, Math.min(98, yPercent));

    if (apple) {
      apple.style.left = `${xPercent}%`;
      apple.style.top = `${yPercent}%`;
    }
  };

  const onPointerUp = async (upEvent) => {
    if (apple) {
      apple.releasePointerCapture(upEvent.pointerId);
      apple.classList.remove('dragging');
    }
    apple.removeEventListener('pointermove', onPointerMove);
    apple.removeEventListener('pointerup', onPointerUp);

    isDragging = false;

    // 단순 클릭이면 모달 오픈
    if (!hasMoved) {
      openEditModal(fruit);
      return;
    }

    // 드래그 완료 후 최종 좌표 계산 및 저장
    const rect = fruitLayer.getBoundingClientRect();
    let finalX = ((upEvent.clientX - rect.left) / rect.width) * 100;
    let finalY = ((upEvent.clientY - rect.top) / rect.height) * 100;
    finalX = parseFloat(Math.max(2, Math.min(98, finalX)).toFixed(2));
    finalY = parseFloat(Math.max(2, Math.min(98, finalY)).toFixed(2));

    // 메모리 데이터 업데이트
    const target = treeData[currentZone].find(f => f.id === draggedFruitId);
    if (target) {
      target.x = finalX;
      target.y = finalY;
    }

    // 서버 or 로컬 반영
    if (API_BASE_URL) {
      try {
        await fetch(`${API_BASE_URL}/api/fruits/${draggedFruitId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: finalX, y: finalY })
        });
      } catch (err) {
        console.error('위치 업데이트 실패:', err);
      }
    } else {
      localStorage.setItem('life_tree_fruits', JSON.stringify(treeData));
    }

    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
  };

  apple.addEventListener('pointermove', onPointerMove);
  apple.addEventListener('pointerup', onPointerUp);
}

// 5. 빈 공간 터치 시 신규 열매 생성
fruitLayer.addEventListener('click', (e) => {
  if (e.target.closest('.apple-node') || isDragging || hasMoved) return;

  const rect = fruitLayer.getBoundingClientRect();
  const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
  const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

  pendingCoords = {
    x: parseFloat(xPercent.toFixed(2)),
    y: parseFloat(yPercent.toFixed(2))
  };

  openCreateModal();
});

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

btnCancel.addEventListener('click', () => {
  modalOverlay.classList.remove('active');
});

// 6. 생성 / 수정 저장
btnSave.addEventListener('click', async () => {
  const name = fruitNameInput.value.trim();
  const role = fruitRoleInput.value.trim();

  if (!name || !role) {
    if (tg?.showAlert) tg.showAlert('이름과 나의 합심을 모두 입력해주세요.');
    else alert('이름과 나의 합심을 모두 입력해주세요.');
    return;
  }

  if (editingFruitId) {
    // 수정
    const target = treeData[currentZone].find(f => f.id === editingFruitId);
    if (target) {
      target.name = name;
      target.role = role;
    }

    if (API_BASE_URL) {
      await fetch(`${API_BASE_URL}/api/fruits/${editingFruitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role })
      });
    }
  } else {
    // 신규 생성
    const newFruit = {
      id: 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      zone: currentZone,
      name,
      role,
      x: pendingCoords.x,
      y: pendingCoords.y
    };

    if (!treeData[currentZone]) treeData[currentZone] = [];
    treeData[currentZone].push(newFruit);

    if (API_BASE_URL) {
      await fetch(`${API_BASE_URL}/api/fruits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFruit)
      });
    }
  }

  if (!API_BASE_URL) {
    localStorage.setItem('life_tree_fruits', JSON.stringify(treeData));
  }

  if (tg?.HapticFeedback) {
    tg.HapticFeedback.notificationOccurred('success');
  }

  modalOverlay.classList.remove('active');
  renderFruits();
});

// 7. 열매 삭제
btnDelete.addEventListener('click', async () => {
  if (!editingFruitId) return;

  const confirmed = confirm('이 열매를 삭제하시겠습니까?');
  if (confirmed) {
    treeData[currentZone] = treeData[currentZone].filter(f => f.id !== editingFruitId);

    if (API_BASE_URL) {
      await fetch(`${API_BASE_URL}/api/fruits/${editingFruitId}`, {
        method: 'DELETE'
      });
    } else {
      localStorage.setItem('life_tree_fruits', JSON.stringify(treeData));
    }

    modalOverlay.classList.remove('active');
    renderFruits();
  }
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 초기 구동 및 3.5초 주기 실시간 자동 동기화
initZones();
fetchFruits();
setInterval(fetchFruits, 3500);
