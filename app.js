// 텔레그램 SDK 초기화
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// -------------------------------------------------------------
// [중요] 1단계에서 복사한 Firebase Realtime Database URL 입력
// -------------------------------------------------------------
const firebaseConfig = {
  databaseURL: "https://lifetree-app-ee9e9-default-rtdb.firebaseio.com/"
};

// Firebase 초기화
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const fruitsRef = db.ref('fruits');

const TOTAL_ZONES = 11;
let currentZone = 1;

let treeData = {};
let editingFruitId = null;
let pendingCoords = { x: 0, y: 0 };

// 드래그 상태 관리
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

// 2. 실시간 데이터 리스너 (누군가 열매를 달거나 옮기면 0.1초 만에 자동 실행)
fruitsRef.on('value', (snapshot) => {
  treeData = snapshot.val() || {};
  
  // 내가 지금 사과를 손가락으로 드래그하고 있을 때는 화면 리셋 방지
  if (!isDragging) {
    renderFruits();
  }
});

// 3. 열매 화면 렌더링
function renderFruits() {
  fruitLayer.innerHTML = '';
  
  // 현재 구역에 해당하는 열매들만 필터링
  const currentFruits = Object.entries(treeData)
    .filter(([id, item]) => item.zone === currentZone)
    .map(([id, item]) => ({ id, ...item }));

  currentFruits.forEach(item => {
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

// 4. 모바일 터치 드래그 앤 드롭
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

    // 단순 터치 클릭이면 수정/삭제 모달 열기
    if (!hasMoved) {
      openEditModal(fruit);
      return;
    }

    // 드래그 종료 시 최종 위치를 실시간 DB에 업데이트 (다른 사람 화면에도 즉시 이동)
    const rect = fruitLayer.getBoundingClientRect();
    let finalX = ((upEvent.clientX - rect.left) / rect.width) * 100;
    let finalY = ((upEvent.clientY - rect.top) / rect.height) * 100;
    finalX = parseFloat(Math.max(2, Math.min(98, finalX)).toFixed(2));
    finalY = parseFloat(Math.max(2, Math.min(98, finalY)).toFixed(2));

    db.ref(`fruits/${draggedFruitId}`).update({
      x: finalX,
      y: finalY
    });

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

// 6. 생성 / 수정 저장 (Firebase에 즉시 push/update)
btnSave.addEventListener('click', () => {
  const name = fruitNameInput.value.trim();
  const role = fruitRoleInput.value.trim();

  if (!name || !role) {
    if (tg?.showAlert) tg.showAlert('이름과 나의 합심을 모두 입력해주세요.');
    else alert('이름과 나의 합심을 모두 입력해주세요.');
    return;
  }

  if (editingFruitId) {
    // 기존 열매 수정
    db.ref(`fruits/${editingFruitId}`).update({
      name,
      role
    });
  } else {
    // 새 열매 등록 (고유 키 자동 생성)
    const newFruitRef = fruitsRef.push();
    newFruitRef.set({
      zone: currentZone,
      name,
      role,
      x: pendingCoords.x,
      y: pendingCoords.y,
      createdAt: Date.now()
    });
  }

  if (tg?.HapticFeedback) {
    tg.HapticFeedback.notificationOccurred('success');
  }

  modalOverlay.classList.remove('active');
});

// 7. 열매 삭제
btnDelete.addEventListener('click', () => {
  if (!editingFruitId) return;

  const confirmed = confirm('이 열매를 삭제하시겠습니까?');
  if (confirmed) {
    db.ref(`fruits/${editingFruitId}`).remove();
    modalOverlay.classList.remove('active');
  }
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 실행
initZones();
