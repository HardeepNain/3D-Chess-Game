console.log("Loading ultra-realistic chess...");

const UNI = {
  w: { K:'\u2654', Q:'\u2655', R:'\u2656', B:'\u2657', N:'\u2658', P:'\u2659' },
  b: { K:'\u265A', Q:'\u265B', R:'\u265C', B:'\u265D', N:'\u265E', P:'\u265F' },
};
const initialFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

const turnEl = document.getElementById('turn');
const movesEl = document.getElementById('moves');
const newGameBtn = document.getElementById('newGame');
const undoBtn = document.getElementById('undo');
const errBanner = document.getElementById('err');
const capsByWhiteEl = document.getElementById('capsByWhite');
const capsByBlackEl = document.getElementById('capsByBlack');
const canvasContainer = document.getElementById('canvas-container');

let scene, camera, renderer;
let board = [];
let turn = 'w';
let selected = null;
let legal = [];
let lastDouble = null;
let gameOver = false;
let captured = { byWhite: [], byBlack: [] };
let history = [];
let threePieces = {};
let squareMeshes = {};
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let particleSystem = [];

function showError(msg) {
  console.error(msg);
  errBanner.hidden = false;
  errBanner.textContent = "⚠️ " + msg;
}

function initThreeJS(){
  console.log("Initializing ultra-realistic Three.js...");
  
  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1f);
    scene.fog = new THREE.Fog(0x0a0f1f, 100, 500);
    
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;
    
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(4, 8, 8);
    camera.lookAt(4, 0, 4);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowShadowMap;
    renderer.shadowMap.needsUpdate = true;
    canvasContainer.appendChild(renderer.domElement);
    
    // Professional Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(12, 18, 12);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.left = -25;
    directionalLight.shadow.camera.right = 25;
    directionalLight.shadow.camera.top = 25;
    directionalLight.shadow.camera.bottom = -25;
    directionalLight.shadow.camera.far = 60;
    directionalLight.shadow.bias = -0.001;
    scene.add(directionalLight);
    
    // Fill lights
    const fillLight1 = new THREE.DirectionalLight(0x6366f1, 0.4);
    fillLight1.position.set(-10, 8, -10);
    scene.add(fillLight1);
    
    const fillLight2 = new THREE.DirectionalLight(0xec4899, 0.3);
    fillLight2.position.set(10, 8, -10);
    scene.add(fillLight2);
    
    createParticles();
    createBoardVisuals();
    
    renderer.domElement.addEventListener('click', onMouseClick);
    window.addEventListener('resize', onWindowResize);
    
    console.log("Three.js initialized");
  } catch(e) {
    showError("Three.js init failed: " + e.message);
    throw e;
  }
}

function createParticles(){
  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = 150;
  const positions = new Float32Array(particleCount * 3);
  
  for(let i = 0; i < particleCount * 3; i += 3){
    positions[i] = (Math.random() - 0.5) * 20;
    positions[i + 1] = Math.random() * 15;
    positions[i + 2] = (Math.random() - 0.5) * 20;
  }
  
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const particleMaterial = new THREE.PointsMaterial({
    color: 0x6366f1,
    size: 0.12,
    transparent: true,
    opacity: 0.5,
    sizeAttenuation: true
  });
  
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);
  
  particleSystem.push({
    mesh: particles,
    velocities: Array(particleCount).fill().map(() => ({
      x: (Math.random() - 0.5) * 0.01,
      y: (Math.random() - 0.5) * 0.01,
      z: (Math.random() - 0.5) * 0.01
    }))
  });
}

function createBoardVisuals(){
  // Create wood-like texture with proper shading
  for(let r = 0; r < 8; r++){
    for(let c = 0; c < 8; c++){
      const isLight = (r + c) % 2 === 0;
      
      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshPhongMaterial({
        color: isLight ? 0x2d5016 : 0x1a2e0a,
        emissive: isLight ? 0x0f172a : 0x050a02,
        shininess: 20,
        wireframe: false
      });
      
      const square = new THREE.Mesh(geometry, material);
      square.rotation.x = -Math.PI / 2;
      square.position.set(c + 0.5, 0.01, r + 0.5);
      square.receiveShadow = true;
      square.userData = { r, c };
      scene.add(square);
      squareMeshes[r + '-' + c] = square;
    }
  }
  
  // Decorative board border
  const borderGeometry = new THREE.TorusGeometry(5.7, 0.15, 32, 128);
  const borderMaterial = new THREE.MeshPhongMaterial({
    color: 0x8b4513,
    emissive: 0x654321,
    shininess: 60
  });
  const border = new THREE.Mesh(borderGeometry, borderMaterial);
  border.rotation.x = -Math.PI / 2;
  border.position.y = 0.05;
  border.castShadow = true;
  scene.add(border);
}

// ULTRA-REALISTIC PIECE CREATION
function createPieceMesh(type, color){
  const isWhite = color === 'w';
  const group = new THREE.Group();
  
  // Premium materials
  const whiteMaterial = new THREE.MeshPhongMaterial({
    color: 0xf5deb3,
    emissive: 0x8b7355,
    shininess: 140,
    wireframe: false
  });
  
  const blackMaterial = new THREE.MeshPhongMaterial({
    color: 0x2a2a2a,
    emissive: 0x0a0a0a,
    shininess: 100,
    wireframe: false
  });
  
  const goldMaterial = new THREE.MeshPhongMaterial({
    color: 0xffd700,
    emissive: 0xdaa520,
    shininess: 200
  });
  
  const material = isWhite ? whiteMaterial : blackMaterial;
  
  // Base for all pieces
  const baseGeometry = new THREE.CylinderGeometry(0.38, 0.42, 0.15, 64);
  const baseBevel = new THREE.CylinderGeometry(0.42, 0.38, 0.04, 64);
  const base = new THREE.Mesh(baseGeometry, material);
  const baseBev = new THREE.Mesh(baseBevel, material);
  baseBev.position.y = 0.095;
  base.position.y = -0.35;
  base.castShadow = true;
  base.receiveShadow = true;
  baseBev.castShadow = true;
  baseBev.receiveShadow = true;
  group.add(base);
  group.add(baseBev);
  
  // Decorative base rim
  const rimGeometry = new THREE.TorusGeometry(0.42, 0.03, 32, 64);
  const rimMaterial = new THREE.MeshPhongMaterial({
    color: isWhite ? 0xdaa520 : 0xffd700,
    emissive: isWhite ? 0xbdb76b : 0xff8c00,
    shininess: 180
  });
  const rim = new THREE.Mesh(rimGeometry, rimMaterial);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = -0.28;
  rim.castShadow = true;
  group.add(rim);
  
  if(type === 'K'){
    // KING - Realistic proportions
    const bodyGeometry = new THREE.ConeGeometry(0.2, 0.55, 64);
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = 0.18;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // Neck band
    const neckGeometry = new THREE.CylinderGeometry(0.22, 0.19, 0.1, 64);
    const neck = new THREE.Mesh(neckGeometry, material);
    neck.position.y = 0.35;
    neck.castShadow = true;
    group.add(neck);
    
    // Crown base
    const crownBaseGeometry = new THREE.CylinderGeometry(0.18, 0.2, 0.08, 64);
    const crownBase = new THREE.Mesh(crownBaseGeometry, goldMaterial);
    crownBase.position.y = 0.48;
    crownBase.castShadow = true;
    group.add(crownBase);
    
    // Crown points
    for(let i = 0; i < 4; i++){
      const pointGeometry = new THREE.ConeGeometry(0.05, 0.15, 32);
      const point = new THREE.Mesh(pointGeometry, goldMaterial);
      const angle = (i * Math.PI / 2);
      point.position.x = Math.cos(angle) * 0.15;
      point.position.y = 0.57;
      point.position.z = Math.sin(angle) * 0.15;
      point.castShadow = true;
      group.add(point);
    }
    
    // Center orb
    const orbGeometry = new THREE.SphereGeometry(0.08, 64, 64);
    const orb = new THREE.Mesh(orbGeometry, goldMaterial);
    orb.position.y = 0.65;
    orb.castShadow = true;
    group.add(orb);
  }
  else if(type === 'Q'){
    // QUEEN - Elegant and refined
    const bodyGeometry = new THREE.ConeGeometry(0.19, 0.52, 64);
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = 0.16;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // Neck
    const neckGeometry = new THREE.CylinderGeometry(0.2, 0.18, 0.08, 64);
    const neck = new THREE.Mesh(neckGeometry, material);
    neck.position.y = 0.34;
    neck.castShadow = true;
    group.add(neck);
    
    // Crown
    const crownGeometry = new THREE.SphereGeometry(0.17, 64, 64, 0, Math.PI * 2, 0, Math.PI);
    const crown = new THREE.Mesh(crownGeometry, goldMaterial);
    crown.position.y = 0.52;
    crown.scale.set(1, 0.9, 1);
    crown.castShadow = true;
    group.add(crown);
    
    // Crown ridges
    for(let i = 0; i < 6; i++){
      const ridgeGeometry = new THREE.ConeGeometry(0.04, 0.12, 32);
      const ridge = new THREE.Mesh(ridgeGeometry, goldMaterial);
      const angle = (i * Math.PI / 3);
      ridge.position.x = Math.cos(angle) * 0.14;
      ridge.position.y = 0.58;
      ridge.position.z = Math.sin(angle) * 0.14;
      ridge.castShadow = true;
      group.add(ridge);
    }
    
    // Top finial
    const finialGeometry = new THREE.SphereGeometry(0.07, 32, 32);
    const finial = new THREE.Mesh(finialGeometry, goldMaterial);
    finial.position.y = 0.62;
    finial.castShadow = true;
    group.add(finial);
  }
  else if(type === 'R'){
    // ROOK - Castle tower with detail
    const bodyGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.52, 64);
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = 0.1;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // Crenellations (realistic castle design)
    for(let i = 0; i < 4; i++){
      const crenelGeometry = new THREE.BoxGeometry(0.14, 0.14, 0.14);
      const crenel = new THREE.Mesh(crenelGeometry, material);
      const angle = (i * Math.PI / 2);
      const dist = 0.28;
      crenel.position.x = Math.cos(angle) * dist;
      crenel.position.y = 0.42;
      crenel.position.z = Math.sin(angle) * dist;
      crenel.castShadow = true;
      group.add(crenel);
    }
    
    // Inner tower detail
    const innerGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.5, 64);
    const innerMat = new THREE.MeshPhongMaterial({
      color: isWhite ? 0xe8d9b8 : 0x1a1a1a,
      emissive: isWhite ? 0x8b7355 : 0x000000,
      shininess: 80
    });
    const inner = new THREE.Mesh(innerGeometry, innerMat);
    inner.position.y = 0.1;
    inner.castShadow = true;
    group.add(inner);
  }
  else if(type === 'B'){
    // BISHOP - Refined and pointed
    const bodyGeometry = new THREE.ConeGeometry(0.18, 0.5, 64);
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = 0.15;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // Mid-section band
    const bandGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 64);
    const bandMat = new THREE.MeshPhongMaterial({
      color: isWhite ? 0xdaa520 : 0xff8c00,
      emissive: isWhite ? 0xbdb76b : 0xff6347,
      shininess: 140
    });
    const band = new THREE.Mesh(bandGeometry, bandMat);
    band.position.y = 0.12;
    band.castShadow = true;
    group.add(band);
    
    // Rounded top
    const topGeometry = new THREE.SphereGeometry(0.12, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2);
    const top = new THREE.Mesh(topGeometry, material);
    top.position.y = 0.42;
    top.castShadow = true;
    group.add(top);
    
    // Finial point
    const tipGeometry = new THREE.ConeGeometry(0.06, 0.1, 32);
    const tip = new THREE.Mesh(tipGeometry, goldMaterial);
    tip.position.y = 0.52;
    tip.castShadow = true;
    group.add(tip);
  }
  else if(type === 'N'){
    // KNIGHT - Realistic horse
    const bodyGeometry = new THREE.BoxGeometry(0.22, 0.38, 0.28);
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = 0.1;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.14, 64, 64, 0, Math.PI * 2, 0, Math.PI * 0.7);
    const head = new THREE.Mesh(headGeometry, material);
    head.position.set(0, 0.28, 0.1);
    head.scale.set(1, 0.9, 1.1);
    head.castShadow = true;
    group.add(head);
    
    // Snout
    const snoutGeometry = new THREE.ConeGeometry(0.08, 0.12, 32);
    const snout = new THREE.Mesh(snoutGeometry, material);
    snout.position.set(0, 0.25, 0.18);
    snout.castShadow = true;
    group.add(snout);
    
    // Mane
    const maneGeometry = new THREE.SphereGeometry(0.1, 32, 32);
    const mane = new THREE.Mesh(maneGeometry, material);
    mane.position.set(-0.08, 0.38, 0.05);
    mane.scale.set(0.8, 1.2, 0.8);
    mane.castShadow = true;
    group.add(mane);
    
    // Ear
    const earGeometry = new THREE.ConeGeometry(0.05, 0.08, 16);
    const ear = new THREE.Mesh(earGeometry, material);
    ear.position.set(0.08, 0.42, 0.05);
    ear.castShadow = true;
    group.add(ear);
  }
  else if(type === 'P'){
    // PAWN - Classic proportions
    const bodyGeometry = new THREE.SphereGeometry(0.15, 64, 64);
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = 0.08;
    body.scale.set(1, 1.3, 1);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // Neck
    const neckGeometry = new THREE.CylinderGeometry(0.12, 0.1, 0.08, 64);
    const neck = new THREE.Mesh(neckGeometry, material);
    neck.position.y = 0.24;
    neck.castShadow = true;
    group.add(neck);
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.11, 64, 64);
    const head = new THREE.Mesh(headGeometry, material);
    head.position.y = 0.34;
    head.castShadow = true;
    group.add(head);
    
    // Crown accent
    const crownGeometry = new THREE.ConeGeometry(0.09, 0.1, 32);
    const crownMat = new THREE.MeshPhongMaterial({
      color: isWhite ? 0xdaa520 : 0xff8c00,
      emissive: isWhite ? 0xbdb76b : 0xff6347,
      shininess: 140
    });
    const crownMesh = new THREE.Mesh(crownGeometry, crownMat);
    crownMesh.position.y = 0.42;
    crownMesh.castShadow = true;
    group.add(crownMesh);
  }
  
  group.userData = { type, color };
  return group;
}

function updateBoardVisuals(){
  for(let key in threePieces){
    scene.remove(threePieces[key]);
  }
  threePieces = {};
  
  for(let r = 0; r < 8; r++){
    for(let c = 0; c < 8; c++){
      const piece = board[r][c];
      if(piece){
        const mesh = createPieceMesh(piece.t, piece.c);
        mesh.position.set(c + 0.5, 0.3, r + 0.5);
        mesh.userData.boardPos = { r, c };
        mesh.userData.originalY = 0.3;
        mesh.userData.floatTime = Math.random() * Math.PI * 2;
        scene.add(mesh);
        threePieces[r + '-' + c] = mesh;
      }
    }
  }
}

function highlightSquares(){
  for(let key in squareMeshes){
    const sq = squareMeshes[key];
    const isLight = (sq.userData.r + sq.userData.c) % 2 === 0;
    sq.material.color.set(isLight ? 0x2d5016 : 0x1a2e0a);
    sq.material.emissive.set(isLight ? 0x0f172a : 0x050a02);
  }
  
  if(selected){
    const sq = squareMeshes[selected.r + '-' + selected.c];
    if(sq){
      sq.material.emissive.set(0x3b82f6);
      sq.material.color.set(0x1e40af);
    }
    
    for(let m of legal){
      const sq = squareMeshes[m.r + '-' + m.c];
      if(sq){
        sq.material.emissive.set(m.cap ? 0xf87171 : 0x34d399);
        sq.material.color.set(m.cap ? 0x7f1d1d : 0x064e3b);
      }
    }
  }
}

function onMouseClick(event){
  if(gameOver) return;
  
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  
  const meshesToCheck = Object.values(squareMeshes);
  const intersects = raycaster.intersectObjects(meshesToCheck);
  
  if(intersects.length > 0){
    const { r, c } = intersects[0].object.userData;
    handleSquareClick(r, c);
  }
}

function onWindowResize(){
  const width = canvasContainer.clientWidth;
  const height = canvasContainer.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function handleSquareClick(r, c){
  const piece = board[r][c];
  
  if(!selected){
    if(!piece || piece.c !== turn) return;
    selected = { r, c };
    legal = genLegal(r, c);
    highlightSquares();
    return;
  }
  
  if(piece && piece.c === turn){
    selected = { r, c };
    legal = genLegal(r, c);
    highlightSquares();
    return;
  }
  
  const move = legal.find(m => m.r === r && m.c === c);
  if(!move){
    selected = null;
    legal = [];
    highlightSquares();
    return;
  }
  
  history.push(saveState());
  applyMove({ from: { ...selected }, to: { r, c }, meta: move }, false);
  turn = turn === 'w' ? 'b' : 'w';
  selected = null;
  legal = [];
  
  updateBoardVisuals();
  highlightSquares();
  updateStatus();
}

// ===== CHESS LOGIC =====
function loadFEN(fen){
  board = [];
  for(let i = 0; i < 8; i++) board[i] = [];
  
  const rows = fen.split(' ')[0].split('/');
  for(let r = 0; r < 8; r++){
    let c = 0;
    for(let ch of rows[r]){
      if(/\d/.test(ch)){
        c += parseInt(ch);
      } else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        const type = ch.toUpperCase();
        board[r][c] = { t: type, c: color, moved: false };
        c++;
      }
    }
  }
  lastDouble = null;
  captured.byWhite = [];
  captured.byBlack = [];
}

const inBounds = (r,c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const at = (r,c) => inBounds(r,c) ? board[r][c] : null;
const empty = (r,c) => inBounds(r,c) && !board[r][c];
const ally = (r,c,clr) => inBounds(r,c) && board[r][c] && board[r][c].c === clr;
const enemy = (r,c,clr) => inBounds(r,c) && board[r][c] && board[r][c].c !== clr;
const algebra = (r,c) => String.fromCharCode(97+c) + (8-r);

function saveState(){
  return {
    board: board.map(r => r.map(p => p ? {...p} : null)),
    turn, selected: selected ? {...selected} : null, legal: JSON.parse(JSON.stringify(legal)),
    lastDouble: lastDouble ? {...lastDouble} : null,
    captured: { byWhite: [...captured.byWhite], byBlack: [...captured.byBlack] },
    movesHTML: movesEl.innerHTML
  };
}

function restoreState(s){
  board = s.board.map(r => r.map(p => p ? {...p} : null));
  turn = s.turn; selected = s.selected ? {...s.selected} : null;
  legal = JSON.parse(JSON.stringify(s.legal));
  lastDouble = s.lastDouble ? {...s.lastDouble} : null;
  captured.byWhite = [...s.captured.byWhite]; captured.byBlack = [...s.captured.byBlack];
  movesEl.innerHTML = s.movesHTML;
}

function kingPos(color){
  for(let r = 0; r < 8; r++)
    for(let c = 0; c < 8; c++)
      if(board[r][c] && board[r][c].t === 'K' && board[r][c].c === color) return {r,c};
  return null;
}

function attacksSquare(color, r, c){
  for(let rr = 0; rr < 8; rr++){
    for(let cc = 0; cc < 8; cc++){
      const p = board[rr][cc];
      if(p && p.c === color){
        const moves = genPseudo(rr, cc, true);
        if(moves.some(m => m.r === r && m.c === c)) return true;
      }
    }
  }
  return false;
}

function inCheck(color){
  const kp = kingPos(color);
  return kp ? attacksSquare(color === 'w' ? 'b' : 'w', kp.r, kp.c) : false;
}

function genPseudo(r, c, forAttack = false){
  const p = board[r][c];
  if(!p) return [];
  
  const color = p.c, type = p.t;
  const moves = [];
  
  const rays = (dirs) => {
    for(let [dr,dc] of dirs){
      let rr = r+dr, cc = c+dc;
      while(inBounds(rr,cc)){
        if(board[rr][cc]){
          if(board[rr][cc].c !== color) moves.push({r:rr,c:cc,cap:true});
          break;
        }
        moves.push({r:rr,c:cc});
        rr += dr; cc += dc;
      }
    }
  };
  
  if(type === 'P'){
    const dir = color === 'w' ? -1 : 1;
    const start = color === 'w' ? 6 : 1;
    if(!forAttack && empty(r+dir,c)){
      moves.push({r:r+dir,c});
      if(r === start && empty(r+2*dir,c)) moves.push({r:r+2*dir,c,double:true});
    }
    for(let dc of [-1,1]){
      if(enemy(r+dir,c+dc,color)) moves.push({r:r+dir,c:c+dc,cap:true});
    }
    if(lastDouble && lastDouble.r === r && Math.abs(lastDouble.c-c) === 1 && r === (color==='w'?3:4)){
      moves.push({r:r+dir,c:lastDouble.c,cap:true,ep:true});
    }
  }
  else if(type === 'N'){
    for(let [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){
      if(inBounds(r+dr,c+dc) && !ally(r+dr,c+dc,color))
        moves.push({r:r+dr,c:c+dc,cap:enemy(r+dr,c+dc,color)});
    }
  }
  else if(type === 'B') rays([[1,1],[1,-1],[-1,1],[-1,-1]]);
  else if(type === 'R') rays([[1,0],[-1,0],[0,1],[0,-1]]);
  else if(type === 'Q') rays([[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]);
  else if(type === 'K'){
    for(let dr = -1; dr <= 1; dr++){
      for(let dc = -1; dc <= 1; dc++){
        if(dr === 0 && dc === 0) continue;
        if(inBounds(r+dr,c+dc) && !ally(r+dr,c+dc,color))
          moves.push({r:r+dr,c:c+dc,cap:enemy(r+dr,c+dc,color)});
      }
    }
    if(!forAttack && !p.moved && !inCheck(color)){
      if(canCastle(color,'k')) moves.push({r,c:c+2,castle:'k'});
      if(canCastle(color,'q')) moves.push({r,c:c-2,castle:'q'});
    }
  }
  
  return moves;
}

function canCastle(color, side){
  const row = color === 'w' ? 7 : 0;
  const kC = 4, rC = side === 'k' ? 7 : 0, step = side === 'k' ? 1 : -1;
  const rook = at(row,rC), king = at(row,kC);
  if(!king || !rook || king.t !== 'K' || rook.t !== 'R' || king.moved || rook.moved) return false;
  for(let c = kC+step; c !== rC; c += step) if(!empty(row,c)) return false;
  for(let c = kC; c !== kC+2*step; c += step)
    if(attacksSquare(color==='w'?'b':'w',row,c)) return false;
  return true;
}

function genLegal(r, c){
  const pseudo = genPseudo(r, c, false);
  const p = board[r][c];
  if(!p) return [];
  const color = p.c;
  const legal = [];
  for(let m of pseudo){
    const state = saveState();
    applyMove({from:{r,c},to:{r:m.r,c:m.c},meta:m},true);
    if(!inCheck(color)) legal.push(m);
    restoreState(state);
  }
  return legal;
}

function applyMove(m, sim = false){
  const {from, to, meta} = m;
  const piece = at(from.r, from.c);
  const target = at(to.r, to.c);
  
  if(target && !sim){
    const icon = UNI[target.c][target.t];
    if(piece.c === 'w') captured.byWhite.push(icon);
    else captured.byBlack.push(icon);
  }
  if(meta?.ep && !sim){
    const ep = at(from.r, to.c);
    if(ep){
      const icon = UNI[ep.c][ep.t];
      if(piece.c === 'w') captured.byWhite.push(icon);
      else captured.byBlack.push(icon);
    }
  }
  if(meta?.ep) board[from.r][to.c] = null;
  
  board[to.r][to.c] = {...piece, moved: true};
  board[from.r][from.c] = null;
  
  if(meta?.castle){
    const row = to.r;
    if(meta.castle === 'k'){
      board[row][5] = {...board[row][7], moved: true};
      board[row][7] = null;
    } else {
      board[row][3] = {...board[row][0], moved: true};
      board[row][0] = null;
    }
  }
  
  if(board[to.r][to.c].t === 'P' && (to.r === 0 || to.r === 7)){
    board[to.r][to.c].t = 'Q';
  }
  
  if(piece.t === 'P' && meta?.double){
    lastDouble = {r:to.r,c:to.c};
  } else {
    lastDouble = null;
  }
  
  if(!sim){
    logMove(piece, target, from, to, meta);
    renderCaptured();
  }
}

function logMove(piece, target, from, to, meta){
  let name = piece.t === 'P' ? '' : piece.t;
  let capture = target || meta?.ep ? 'x' : '';
  let dest = algebra(to.r, to.c);
  let promo = piece.t === 'P' && (to.r === 0 || to.r === 7) ? '=Q' : '';
  let castle = meta?.castle === 'k' ? 'O-O' : meta?.castle === 'q' ? 'O-O-O' : '';
  const moveText = castle || (name + capture + dest + promo);
  
  if(turn === 'w'){
    const li = document.createElement('li');
    li.textContent = (movesEl.children.length + 1) + '. ' + moveText;
    movesEl.appendChild(li);
  } else {
    if(movesEl.lastElementChild)
      movesEl.lastElementChild.textContent += ' ' + moveText;
  }
}

function renderCaptured(){
  capsByWhiteEl.innerHTML = captured.byWhite.join(' ');
  capsByBlackEl.innerHTML = captured.byBlack.join(' ');
}

function anyLegalMove(color){
  for(let r = 0; r < 8; r++)
    for(let c = 0; c < 8; c++){
      const p = board[r][c];
      if(p && p.c === color && genLegal(r,c).length) return true;
    }
  return false;
}

function updateStatus(){
  const hasMove = anyLegalMove(turn);
  if(!hasMove){
    if(inCheck(turn)){
      turnEl.textContent = '🏆 ' + (turn === 'w' ? 'Black' : 'White') + ' Wins!';
    } else {
      turnEl.textContent = '🤝 Stalemate - Draw!';
    }
    gameOver = true;
  } else {
    const checkIcon = inCheck(turn) ? ' ⚠️' : '';
    turnEl.textContent = (turn === 'w' ? 'White' : 'Black') + ' to move' + checkIcon;
  }
  undoBtn.disabled = history.length === 0;
}

function undo(){
  if(history.length === 0) return;
  const state = history.pop();
  restoreState(state);
  gameOver = false;
  selected = null;
  legal = [];
  updateBoardVisuals();
  highlightSquares();
  renderCaptured();
  updateStatus();
}

function updateParticles(){
  if(particleSystem.length === 0) return;
  
  const ps = particleSystem[0];
  const positions = ps.mesh.geometry.attributes.position.array;
  
  for(let i = 0; i < positions.length; i += 3){
    const index = i / 3;
    positions[i] += ps.velocities[index].x;
    positions[i + 1] += ps.velocities[index].y;
    positions[i + 2] += ps.velocities[index].z;
    
    if(positions[i + 1] < 0) positions[i + 1] = 15;
    if(positions[i + 1] > 15) positions[i + 1] = 0;
  }
  
  ps.mesh.geometry.attributes.position.needsUpdate = true;
}

function updatePiecesFloat(){
  for(let key in threePieces){
    const piece = threePieces[key];
    if(piece.userData.floatTime !== undefined){
      piece.userData.floatTime += 0.008;
      piece.position.y = piece.userData.originalY + Math.sin(piece.userData.floatTime) * 0.06;
      piece.rotation.y += 0.0006;
    }
  }
}

function animate(){
  requestAnimationFrame(animate);
  
  updateParticles();
  updatePiecesFloat();
  
  if(renderer) renderer.render(scene, camera);
}

function init(){
  console.log("Initializing ultra-realistic chess...");
  try {
    if(!canvasContainer){
      throw new Error("Canvas container not found");
    }
    
    initThreeJS();
    loadFEN(initialFEN);
    updateBoardVisuals();
    updateStatus();
    renderCaptured();
    
    newGameBtn.addEventListener('click', () => {
      loadFEN(initialFEN);
      movesEl.innerHTML = '';
      turn = 'w';
      selected = null;
      legal = [];
      gameOver = false;
      history = [];
      updateBoardVisuals();
      highlightSquares();
      renderCaptured();
      updateStatus();
    });
    
    undoBtn.addEventListener('click', undo);
    
    animate();
    console.log("Chess initialized!");
    errBanner.hidden = true;
  } catch(e) {
    console.error("Init error:", e);
    showError("Failed to initialize: " + e.message);
  }
}

window.addEventListener('DOMContentLoaded', init);
