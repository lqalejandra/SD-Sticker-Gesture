let video = document.getElementById('webcam');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let scene, camera, renderer;
let shapes = [];
let currentShape = null;
let isPinching = false;
let shapeScale = 1; 
let originalDistance = null; 
let selectedShape = null;
let shapeCreatedThisPinch = false;
let lastShapeCreationTime = 0;
const shapeCreationCooldown = 1000;

// Palm-hold gesture 
let palmHoldStartTime = null;
let lastPalmTriggerTime = 0;
const palmHoldDurationMs = 1000; 
const palmCooldownMs = 2000;

let messageCards = [];

// Message queue
let messageQueue = [];
let currentMessageIndex = 0;

let selectedColor = '#88d8c0';

const initThree = () => {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;
  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('three-canvas').appendChild(renderer.domElement);
  const light = new THREE.AmbientLight(0xffffff, 1);
  scene.add(light);
  animate();
};

const animate = () => {
  requestAnimationFrame(animate);
  shapes.forEach(shape => {
    if (shape !== selectedShape && !(shape.userData && shape.userData.noAutoRotate)) {
      shape.rotation.x += 0.01;
      shape.rotation.y += 0.01;
    }
    if (shape.userData && typeof shape.userData.update === 'function') {
      shape.userData.update(performance.now());
    }
  });
  renderer.render(scene, camera);
};

const neonColors = [0xFF00FF, 0x00FFFF, 0xFF3300, 0x39FF14, 0xFF0099, 0x00FF00, 0xFF6600, 0xFFFF00];
let colorIndex = 0;

const getNextNeonColor = () => {
    const color = neonColors[colorIndex];
    colorIndex = (colorIndex + 1) % neonColors.length;
    return color;
};

const createRandomShape = (position) => {
  const geometries = [
    new THREE.BoxGeometry(),
    new THREE.SphereGeometry(0.5, 32, 32),
    new THREE.ConeGeometry(0.5, 1, 32),
    new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
  ];
  const geometry = geometries[Math.floor(Math.random() * geometries.length)];
  const color = getNextNeonColor();
  const group = new THREE.Group();

  const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.5 });
  const fillMesh = new THREE.Mesh(geometry, material);

  const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
  const wireframeMesh = new THREE.Mesh(geometry, wireframeMaterial);

  group.add(fillMesh);
  group.add(wireframeMesh);
  group.position.copy(position);
  scene.add(group);

  shapes.push(group);
  return group;
};

// cards
const drawRoundedRect = (ctx2d, x, y, w, h, r) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx2d.beginPath();
  ctx2d.moveTo(x + radius, y);
  ctx2d.lineTo(x + w - radius, y);
  ctx2d.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx2d.lineTo(x + w, y + h - radius);
  ctx2d.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx2d.lineTo(x + radius, y + h);
  ctx2d.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx2d.lineTo(x, y + radius);
  ctx2d.quadraticCurveTo(x, y, x + radius, y);
  ctx2d.closePath();
};

const createSmileyCard = (position, message = 'Hi ! (^-^)/', color = '#ff6b6b', imageData = null, isVideo = false) => {
  const group = new THREE.Group();
  group.userData.noAutoRotate = true;
  const width = 2.8; 
  const height = 1.8;

  const texSize = 512;
  const texCanvas = document.createElement('canvas');
  texCanvas.width = texSize;
  texCanvas.height = texSize;
  const tctx = texCanvas.getContext('2d');

  const texture = new THREE.CanvasTexture(texCanvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const geom = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(0, 0, 0);
  group.add(mesh);

  group.position.copy(position);
  scene.add(group);
  shapes.push(group);
  messageCards.push(group);

  const createdAt = performance.now();

  group.userData.textVisible = true; 
  group.userData.textFadeStart = createdAt;
  group.userData.message = message;
  group.userData.imageData = imageData;
  group.userData.isVideo = isVideo;
  const textFadeDuration = 300; // ms

  const renderFrame = (now) => {
    tctx.clearRect(0, 0, texSize, texSize);

    // mirror card
    tctx.save();
    tctx.scale(-1, 1);
    tctx.translate(-texSize, 0);

    const margin = Math.floor(texSize * 0.08);
    drawRoundedRect(tctx, margin, margin, texSize - margin * 2, texSize - margin * 2, texSize * 0.08);
    tctx.fillStyle = color;
    tctx.fill();

    //  if palm is open and facing camera, show content
    const isPalmOpen = group.userData.palmOpen || false;
    if (isPalmOpen) {
      if (group.userData.imageData) {
        const imgWidth = texSize * 0.8;
        const imgHeight = texSize * 0.8;
        const imgX = (texSize - imgWidth) / 2;
        const imgY = (texSize - imgHeight) / 2;
        
        try {
          if (group.userData.isVideo) {
           
            tctx.drawImage(group.userData.imageData, imgX, imgY, imgWidth, imgHeight);
          } else {
            // Draw image
            tctx.drawImage(group.userData.imageData, imgX, imgY, imgWidth, imgHeight);
          }
        } catch (err) {
          console.error('Error drawing image/video:', err);
        }
      } else {
        // Draw text
        tctx.fillStyle = '#000000';
        tctx.textAlign = 'center';
        tctx.textBaseline = 'middle';
        // Scale font relative to texture size
        const fontSize = Math.floor(texSize * 0.12);
        tctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
        tctx.fillText(group.userData.message, texSize / 2, texSize / 2);
      }
    }

    tctx.restore();

    // texture update
    texture.needsUpdate = true;
  };

  group.userData.update = renderFrame;
  return group;
};

const get3DCoords = (normX, normY) => {
  const x = (normX - 0.5) * 10;
  const y = (0.5 - normY) * 10;
  return new THREE.Vector3(x, y, 0);
};

const isPinch = (landmarks) => {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  return d(landmarks[4], landmarks[8]) < 0.06;
};

// Detect open palm facing the camera
const isOpenPalmFacingCamera = (landmarks) => {
  // Palm center using wrist and MCP joints
  const palmIdx = [0, 1, 5, 9, 13, 17];
  const tipsIdx = [8, 12, 16, 20];
  const palm = palmIdx.map(i => landmarks[i]);
  const tips = tipsIdx.map(i => landmarks[i]);

  const palmCenter = palm.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), { x: 0, y: 0, z: 0 });
  palmCenter.x /= palm.length; palmCenter.y /= palm.length; palmCenter.z /= palm.length;

  // Openness: average distance of tips from palm center
  const avgTipDist = tips.reduce((s, t) => s + Math.hypot(t.x - palmCenter.x, t.y - palmCenter.y), 0) / tips.length;

  const openThreshold = 0.14; // a bit easier to trigger
  // ignore z facing requirement for robustness across devices
  return avgTipDist > openThreshold;
};

const areIndexFingersClose = (l, r) => {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  return d(l[8], r[8]) < 0.12;
};

const findNearestShape = (position) => {
  let minDist = Infinity;
  let closest = null;
  shapes.forEach(shape => {
    const dist = shape.position.distanceTo(position);
    if (dist < 1.5 && dist < minDist) {
      minDist = dist;
      closest = shape;
    }
  });
  return closest;
};

const isInRecycleBinZone = (position) => {
  const vector = position.clone().project(camera);
  const screenX = ((vector.x + 1) / 2) * window.innerWidth;
  const screenY = ((-vector.y + 1) / 2) * window.innerHeight;

  const binWidth = 160;
  const binHeight = 160;
  const binLeft = window.innerWidth - 60 - binWidth;
  const binTop = window.innerHeight - 60 - binHeight;
  const binRight = binLeft + binWidth;
  const binBottom = binTop + binHeight;

  const adjustedX = window.innerWidth - screenX;

  return adjustedX >= binLeft && adjustedX <= binRight && screenY >= binTop && screenY <= binBottom;
};

const hands = new Hands({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });

hands.onResults(results => {
  handsDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const recycleBin = document.getElementById('recycle-bin');
  
// Palm open
  let anyPalmOpen = false;
  if (results.multiHandLandmarks.length > 0) {
    for (const landmarks of results.multiHandLandmarks) {
      if (isOpenPalmFacingCamera(landmarks)) {
        anyPalmOpen = true;
        break;
      }
    }
  }
  
  // Update all message cards with palm status
  messageCards.forEach(card => {
    if (card.userData) {
      card.userData.palmOpen = anyPalmOpen;
    }
  });

  for (const landmarks of results.multiHandLandmarks) {
    const drawCircle = (landmark) => {
      ctx.beginPath();
      ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 8, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(204, 209, 255, 0.8)';
      ctx.fill();
    };
    
    for (let i = 0; i < landmarks.length; i++) {
      drawCircle(landmarks[i]);
    }
    
    // Draw connections between landmarks
    ctx.strokeStyle = 'rgba(211, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    
    // Hand connections...
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [0, 9], [9, 10], [10, 11], [11, 12], // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17] // Palm
    ];
    
    for (const [start, end] of connections) {
      ctx.beginPath();
      ctx.moveTo(landmarks[start].x * canvas.width, landmarks[start].y * canvas.height);
      ctx.lineTo(landmarks[end].x * canvas.width, landmarks[end].y * canvas.height);
      ctx.stroke();
    }
  }

  if (results.multiHandLandmarks.length === 2) {
    const [l, r] = results.multiHandLandmarks;
    const leftPinch = isPinch(l);
    const rightPinch = isPinch(r);
    const indexesClose = areIndexFingersClose(l, r);

    if (leftPinch && rightPinch) {
      const left = l[8];
      const right = r[8];
      const centerX = (left.x + right.x) / 2;
      const centerY = (left.y + right.y) / 2;
      const centerPos = get3DCoords(centerX, centerY);
      const distance = Math.hypot(left.x - right.x, left.y - right.y);

      isPinching = true;
      recycleBin.classList.remove('active');
      return;
    }
  }

  isPinching = false;
  shapeCreatedThisPinch = false;
  originalDistance = null;
  currentShape = null;
  messageCards.forEach(card => {
    if (card.userData) card.userData.scalingActive = false;
  });

  // create card
  const nowTs = Date.now();
  if (results.multiHandLandmarks.length >= 1) {
    // choose the hand with larger index-finger tip size on screen (rough heuristic for closer hand)
    const lm = results.multiHandLandmarks.reduce((best, cur) => {
      const pick = (hand) => hand[8];
      const area = (h) => {
        const tip = pick(h);
        return (1 - tip.z); // larger when closer
      };
      return area(cur) > area(best) ? cur : best;
    });
    const palmOpenFacing = isOpenPalmFacingCamera(lm);
    const notPinching = !isPinch(lm);

    if (palmOpenFacing && notPinching) {
      if (palmHoldStartTime == null) palmHoldStartTime = nowTs;
      const heldMs = nowTs - palmHoldStartTime;
      if (heldMs >= palmHoldDurationMs && nowTs - lastPalmTriggerTime > palmCooldownMs) {
        // Only create card if there are messages in queue
        if (messageQueue.length > 0 && currentMessageIndex < messageQueue.length) {
          const palmIdx = [0, 1, 5, 9, 13, 17];
          const center = palmIdx.map(i => lm[i]).reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
          center.x /= palmIdx.length; center.y /= palmIdx.length;
          const pos = get3DCoords(center.x, center.y);
          
          const msgData = messageQueue[currentMessageIndex];
          const message = msgData.text;
          const color = msgData.color;
          const imageData = msgData.imageData || null;
          const isVideo = msgData.isVideo || false;
          currentMessageIndex++;
          
          console.log('Creating card with:', { message, color, hasImageData: !!imageData, isVideo });
          console.log('ImageData type:', imageData ? imageData.constructor.name : 'null');
          console.log('ImageData readyState:', imageData && imageData.readyState !== undefined ? imageData.readyState : 'N/A');
          const card = createSmileyCard(pos, message, color, imageData, isVideo);
          card.scale.set(0.01, 0.01, 0.01);
          const start = performance.now();
          const dur = 180;
          card.userData.update = ((origUpdate => (t) => {
            const k = Math.min(1, (t - start) / dur);
            const s = 0.01 + (1 - 0.01) * k;
            card.scale.set(s, s, s);
            if (origUpdate) origUpdate(t);
          })(card.userData.update));
        }
        lastPalmTriggerTime = nowTs;
        palmHoldStartTime = null;
      }
    } else {
      palmHoldStartTime = null;
    }
    
  } else {
    palmHoldStartTime = null;
  }

  if (results.multiHandLandmarks.length > 0) {
    for (const landmarks of results.multiHandLandmarks) {
      const indexTip = landmarks[8];
      const position = get3DCoords(indexTip.x, indexTip.y);

      if (isPinch(landmarks)) {
        if (!selectedShape) {
          selectedShape = findNearestShape(position);
        }
        if (selectedShape) {
          selectedShape.position.copy(position);

          const inBin = isInRecycleBinZone(selectedShape.position);
          selectedShape.children.forEach(child => {
            if (child.material && child.material.wireframe) {
              child.material.color.set(inBin ? 0xff0000 : 0xffffff);
            }
          });
          if (inBin) {
            recycleBin.classList.add('active');
          } else {
            recycleBin.classList.remove('active');
          }
        }
      } else {
        if (selectedShape && isInRecycleBinZone(selectedShape.position)) {
          scene.remove(selectedShape);
          shapes = shapes.filter(s => s !== selectedShape);
          messageCards = messageCards.filter(c => c !== selectedShape);
        }
        selectedShape = null;
        recycleBin.classList.remove('active');
      }
    }
  } else {
    if (selectedShape && isInRecycleBinZone(selectedShape.position)) {
      scene.remove(selectedShape);
      shapes = shapes.filter(s => s !== selectedShape);
      messageCards = messageCards.filter(c => c !== selectedShape);
    }
    selectedShape = null;
    recycleBin.classList.remove('active');
  }
});

const initCamera = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
  video.srcObject = stream;
  await new Promise(resolve => video.onloadedmetadata = resolve);
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  new Camera(video, {
    onFrame: async () => await hands.send({ image: video }),
    width: video.videoWidth,
    height: video.videoHeight
  }).start();
};

// Initialize UI event listeners
const initUI = () => {
  const textInput = document.getElementById('text-input');
  const imageInput = document.getElementById('image-input');
  const addButton = document.getElementById('add-message');
  const colorOptions = document.querySelectorAll('.color-option');
  
  // Color selection
  colorOptions.forEach(option => {
    option.addEventListener('click', () => {
      colorOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      selectedColor = option.dataset.color;
    });
  });
  
  // Set default selection
  colorOptions[0].classList.add('selected');
  
  // Add message function
  const addMessage = () => {
    const text = textInput.value.trim();
    const file = imageInput.files[0];
    
    if (text || file) {
      if (file) {
        // Handle image/GIF file
        const reader = new FileReader();
        reader.onload = (e) => {
          const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
          
          if (isGif) {
            // For GIFs, try video first, fallback to image
            console.log('Processing GIF file...');
            const video = document.createElement('video');
            video.src = e.target.result;
            video.loop = true;
            video.muted = true;
            video.autoplay = true;
            video.playsInline = true;
            video.style.display = 'none';
            document.body.appendChild(video);
            
            const fallbackTimeout = setTimeout(() => {
              console.log('Video load timeout, falling back to image');
              const img = new Image();
              img.onload = () => {
                messageQueue.push({ 
                  text: text || 'GIF', 
                  color: selectedColor, 
                  imageData: img,
                  isVideo: false
                });
                console.log(`Added GIF as static image with text: "${text || 'GIF'}" and color ${selectedColor}. Queue length: ${messageQueue.length}`);
              };
              img.src = e.target.result;
            }, 2000);
            
            video.addEventListener('loadeddata', () => {
              clearTimeout(fallbackTimeout);
              console.log('Video loaded, attempting to play...');
              video.play().then(() => {
                console.log('Video playing successfully');
                messageQueue.push({ 
                  text: text || 'GIF', 
                  color: selectedColor, 
                  imageData: video,
                  isVideo: true
                });
                console.log(`Added GIF as video with text: "${text || 'GIF'}" and color ${selectedColor}. Queue length: ${messageQueue.length}`);
              }).catch(err => {
                console.error('Video play failed:', err);
                // Fallback to static image
                const img = new Image();
                img.onload = () => {
                  messageQueue.push({ 
                    text: text || 'GIF', 
                    color: selectedColor, 
                    imageData: img,
                    isVideo: false
                  });
                  console.log(`Added GIF as static image fallback with text: "${text || 'GIF'}" and color ${selectedColor}. Queue length: ${messageQueue.length}`);
                };
                img.src = e.target.result;
              });
            });
            
            video.addEventListener('error', (err) => {
              clearTimeout(fallbackTimeout);
              console.error('Video load error:', err);
              // Fallback to static image
              const img = new Image();
              img.onload = () => {
                messageQueue.push({ 
                  text: text || 'GIF', 
                  color: selectedColor, 
                  imageData: img,
                  isVideo: false
                });
                console.log(`Added GIF as static image after video error with text: "${text || 'GIF'}" and color ${selectedColor}. Queue length: ${messageQueue.length}`);
              };
              img.src = e.target.result;
            });
          } else {
            // Static images
            const img = new Image();
            img.onload = () => {
              messageQueue.push({ 
                text: text || 'Image', 
                color: selectedColor, 
                imageData: img,
                isVideo: false
              });
              console.log(`Added image with text: "${text || 'Image'}" and color ${selectedColor}. Queue length: ${messageQueue.length}`);
            };
            img.src = e.target.result;
          }
        };
        reader.readAsDataURL(file);
        imageInput.value = ''; // Clear file input
      } else {
        // Handle text only
        messageQueue.push({ text, color: selectedColor });
        console.log(`Added message: "${text}" with color ${selectedColor}. Queue length: ${messageQueue.length}`);
      }
      textInput.value = '';
    }
  };
  
  // Button click
  addButton.addEventListener('click', addMessage);
  
  // Enter key
  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addMessage();
    }
  });
};

initThree();
initCamera();
initUI();