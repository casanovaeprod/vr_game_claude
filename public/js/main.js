import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import * as C from './constants.js';
import { GameScene } from './scene.js';
import { Physics } from './physics.js';
import { Paddle } from './paddle.js';
import { Ball } from './ball.js';
import { AIOpponent } from './ai.js';
import { AudioManager } from './audio.js';
import { ScoringSystem } from './scoring.js';

class Game {
  constructor() {
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.clock = new THREE.Clock();
    this.isVR = false;
    this.xrSession = null;

    // Game objects
    this.physics = new Physics();
    this.playerPaddle = null;
    this.aiPaddle = null;
    this.ball = null;
    this.ai = null;
    this.audio = new AudioManager();
    this.scoring = new ScoringSystem();

    // Input state
    this.mouse = { x: 0.5, y: 0.5 };
    this.mouseDown = false;
    this.controllers = [];
    this.controllerGrips = [];
    this.triggerPressed = false;

    // Game state
    this.state = 'menu'; // menu, waiting_serve, playing, point_scored, game_over
    this.serveTimer = 0;
    this.pointTimer = 0;
    this.paused = false;
    this.selectedDifficulty = 'medium';

    // VR score display
    this.vrScoreText = null;
    this.vrMessageText = null;

    // FPS tracking
    this.frameCount = 0;
    this.fpsTimer = 0;
    this.lastFps = 0;

    // Key hint timer
    this.keyHintShown = false;
    this.keyHintTimer = 0;

    this.init();
  }

  init() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.xr.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    document.body.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 5, 12);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      65, window.innerWidth / window.innerHeight, 0.01, 50
    );
    this.camera.position.set(0, 1.65, C.TABLE_LENGTH / 2 + 0.8);
    this.camera.lookAt(0, C.TABLE_HEIGHT + 0.1, 0);

    // Build scene
    new GameScene(this.scene);

    // Create game objects
    this.playerPaddle = new Paddle(this.scene, true);
    this.aiPaddle = new Paddle(this.scene, false);
    this.ball = new Ball(this.scene);
    this.ai = new AIOpponent(this.aiPaddle);

    // Apply default difficulty
    this.applyDifficulty('medium');

    // VR score display
    this.createVRScoreDisplay();

    // Set up event listeners
    this.setupInput();
    this.setupMenuUI();
    this.checkVRSupport();

    // Handle resize
    window.addEventListener('resize', () => this.onResize());

    // Start render loop
    this.renderer.setAnimationLoop((time, frame) => this.gameLoop(time, frame));
  }

  // ========== MENU & UI ==========

  setupMenuUI() {
    // Difficulty buttons
    const diffButtons = document.querySelectorAll('.diff-btn');
    diffButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        diffButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedDifficulty = btn.dataset.diff;
      });
    });

    // Help toggle
    const helpToggle = document.getElementById('helpToggle');
    const helpPanel = document.getElementById('helpPanel');
    if (helpToggle && helpPanel) {
      helpToggle.addEventListener('click', () => {
        helpPanel.classList.toggle('open');
        helpToggle.textContent = helpPanel.classList.contains('open')
          ? 'Hide Controls & Rules'
          : 'Controls & Rules';
      });
    }

    // Pause menu buttons
    document.getElementById('resumeBtn')?.addEventListener('click', () => this.togglePause());
    document.getElementById('restartBtn')?.addEventListener('click', () => {
      this.togglePause();
      this.startGame();
    });
    document.getElementById('quitBtn')?.addEventListener('click', () => {
      this.togglePause();
      this.returnToMenu();
    });

    // Game over buttons
    document.getElementById('playAgainBtn')?.addEventListener('click', () => {
      this.hideGameOver();
      this.startGame();
    });
    document.getElementById('menuBtn')?.addEventListener('click', () => {
      this.hideGameOver();
      this.returnToMenu();
    });
  }

  applyDifficulty(name) {
    const preset = C.DIFFICULTY_PRESETS[name];
    if (preset) {
      this.ai.setDifficultyPreset(preset);
    }
  }

  returnToMenu() {
    this.state = 'menu';
    this.scoring.hideHud();
    this.scoring.hideMessage();
    this.ball.hide();
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('keyHint').classList.remove('active');
    this.audio.stopAmbient();
  }

  // ========== VR DISPLAY ==========

  createVRScoreDisplay() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    this.scoreCanvas = canvas;
    this.scoreCtx = canvas.getContext('2d');

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    this.scoreTexture = texture;

    const geo = new THREE.PlaneGeometry(0.8, 0.2);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    this.vrScoreMesh = new THREE.Mesh(geo, mat);
    this.vrScoreMesh.position.set(0, 2.2, -C.TABLE_LENGTH / 2 - 1.5);
    this.vrScoreMesh.visible = false;
    this.scene.add(this.vrScoreMesh);

    // Message display
    const msgCanvas = document.createElement('canvas');
    msgCanvas.width = 512;
    msgCanvas.height = 128;
    this.msgCanvas = msgCanvas;
    this.msgCtx = msgCanvas.getContext('2d');

    const msgTexture = new THREE.CanvasTexture(msgCanvas);
    msgTexture.minFilter = THREE.LinearFilter;
    this.msgTexture = msgTexture;

    const msgGeo = new THREE.PlaneGeometry(0.8, 0.2);
    const msgMat = new THREE.MeshBasicMaterial({
      map: msgTexture,
      transparent: true,
      depthTest: false,
    });
    this.vrMsgMesh = new THREE.Mesh(msgGeo, msgMat);
    this.vrMsgMesh.position.set(0, 1.8, -C.TABLE_LENGTH / 2 - 1.5);
    this.vrMsgMesh.visible = false;
    this.scene.add(this.vrMsgMesh);

    this.updateVRScore();
  }

  updateVRScore() {
    const ctx = this.scoreCtx;
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(0, 0, 512, 128, 16);
    ctx.fill();

    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const serveDotAI = this.scoring.server === 'ai' ? ' \u2022' : '';
    const serveDotPlayer = this.scoring.server === 'player' ? '\u2022 ' : '';
    ctx.fillText(
      `AI${serveDotAI}  ${this.scoring.aiScore} - ${this.scoring.playerScore}  ${serveDotPlayer}You`,
      256, 64
    );
    this.scoreTexture.needsUpdate = true;
  }

  showVRMessage(text) {
    const ctx = this.msgCtx;
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.roundRect(0, 0, 512, 128, 16);
    ctx.fill();
    ctx.fillStyle = '#ffdd57';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
    this.msgTexture.needsUpdate = true;
    this.vrMsgMesh.visible = true;

    setTimeout(() => {
      this.vrMsgMesh.visible = false;
    }, 2500);
  }

  // ========== VR ==========

  async checkVRSupport() {
    const vrButton = document.getElementById('enterVR');
    const statusEl = document.getElementById('vrStatus');

    if (!navigator.xr) {
      statusEl.textContent = 'WebXR not supported in this browser';
      return;
    }

    try {
      const supported = await navigator.xr.isSessionSupported('immersive-vr');
      if (supported) {
        vrButton.style.display = 'inline-block';
        statusEl.textContent = 'VR headset detected!';
        vrButton.addEventListener('click', () => this.enterVR());
      } else {
        statusEl.textContent = 'No VR headset detected. You can still play on screen.';
      }
    } catch (e) {
      statusEl.textContent = 'VR check failed. Play on screen instead.';
    }
  }

  async enterVR() {
    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking', 'bounded-floor'],
      });

      this.renderer.xr.setSession(session);
      this.xrSession = session;
      this.isVR = true;

      const refSpace = await session.requestReferenceSpace('local-floor');
      this.renderer.xr.setReferenceSpace(refSpace);

      this.setupVRControllers();

      session.addEventListener('end', () => {
        this.isVR = false;
        this.xrSession = null;
        this.vrScoreMesh.visible = false;
        this.vrMsgMesh.visible = false;
        this.returnToMenu();
      });

      this.vrScoreMesh.visible = true;
      this.applyDifficulty(this.selectedDifficulty);
      this.startGame();
    } catch (e) {
      console.error('Failed to enter VR:', e);
      document.getElementById('vrStatus').textContent =
        `Failed to enter VR: ${e.message}`;
    }
  }

  setupVRControllers() {
    const controllerModelFactory = new XRControllerModelFactory();

    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.addEventListener('selectstart', () => {
        this.triggerPressed = true;
      });
      controller.addEventListener('selectend', () => {
        this.triggerPressed = false;
      });
      this.scene.add(controller);
      this.controllers.push(controller);

      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(controllerModelFactory.createControllerModel(grip));
      this.scene.add(grip);
      this.controllerGrips.push(grip);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -0.1),
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.3,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      controller.add(line);
    }
  }

  // ========== INPUT ==========

  setupInput() {
    // Mouse/touch
    document.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX / window.innerWidth;
      this.mouse.y = e.clientY / window.innerHeight;
    });

    document.addEventListener('mousedown', () => {
      this.mouseDown = true;
      this.audio.init();
    });

    document.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });

    // Touch support
    document.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.mouse.x = touch.clientX / window.innerWidth;
      this.mouse.y = touch.clientY / window.innerHeight;
    }, { passive: false });

    document.addEventListener('touchstart', (e) => {
      this.mouseDown = true;
      this.audio.init();
      const touch = e.touches[0];
      this.mouse.x = touch.clientX / window.innerWidth;
      this.mouse.y = touch.clientY / window.innerHeight;
    });

    document.addEventListener('touchend', () => {
      this.mouseDown = false;
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Escape':
          if (this.state !== 'menu' && !this.isVR) {
            this.togglePause();
          }
          break;
        case 'm':
        case 'M':
          if (this.state !== 'menu') {
            this.audio.toggleMute();
          }
          break;
      }
    });

    // Play flat button
    document.getElementById('playFlat').addEventListener('click', () => {
      this.audio.init();
      this.applyDifficulty(this.selectedDifficulty);
      this.startGame();
    });
  }

  // ========== PAUSE ==========

  togglePause() {
    if (this.state === 'menu') return;
    this.paused = !this.paused;
    const pauseOverlay = document.getElementById('pauseOverlay');
    if (this.paused) {
      pauseOverlay.classList.add('active');
      this.clock.stop();
    } else {
      pauseOverlay.classList.remove('active');
      this.clock.start();
    }
  }

  // ========== GAME STATE ==========

  startGame() {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('gameOverOverlay').classList.remove('active');

    this.scoring.reset();
    this.scoring.showHud();
    this.updateVRScore();
    this.state = 'waiting_serve';
    this.serveTimer = 0;

    // Start ambient audio
    this.audio.startAmbient();

    // Show keyboard hints briefly
    if (!this.isVR && !this.keyHintShown) {
      this.keyHintShown = true;
      this.keyHintTimer = 5;
      document.getElementById('keyHint')?.classList.add('active');
    }

    if (this.scoring.server === 'player') {
      this.preparePlayerServe();
    } else {
      this.prepareAIServe();
    }
  }

  preparePlayerServe() {
    this.state = 'waiting_serve';
    const servePos = { ...C.SERVE_POSITION_PLAYER };
    this.physics.resetBall(servePos);
    this.ball.show(servePos);

    const msg = this.isVR ? 'Your serve! Squeeze trigger' : 'Your serve! Click to serve';
    this.scoring.showMessage(msg, 0, 'serve');
    if (this.isVR) this.showVRMessage('Your serve! Squeeze trigger');
  }

  prepareAIServe() {
    this.state = 'waiting_serve';
    this.serveTimer = 0;
    this.ball.hide();
    this.scoring.showMessage('Opponent serving...', 0, 'serve');
    if (this.isVR) this.showVRMessage('Opponent serving...');
  }

  playerServe() {
    const paddleData = this.playerPaddle.getCollisionData();
    const servePos = {
      x: paddleData.pos.x,
      y: paddleData.pos.y + 0.12,
      z: paddleData.pos.z - 0.05,
    };

    const vel = {
      x: (Math.random() - 0.5) * 0.2,
      y: 2.5,
      z: -0.5,
    };

    this.physics.serveBall(servePos, vel, { x: 0, y: 0, z: 0 });
    this.physics.lastHitBy = 'player';
    this.state = 'playing';
    this.scoring.hideMessage();
    this.audio.playServeWhistle();
  }

  // ========== GAME LOOP ==========

  gameLoop(time, frame) {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    // FPS tracking
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1.0) {
      this.lastFps = Math.round(this.frameCount / this.fpsTimer);
      const fpsEl = document.getElementById('fpsCounter');
      if (fpsEl && !this.isVR) {
        fpsEl.textContent = `${this.lastFps} fps`;
      }
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    // Key hint fade
    if (this.keyHintTimer > 0) {
      this.keyHintTimer -= dt;
      if (this.keyHintTimer <= 0) {
        document.getElementById('keyHint')?.classList.remove('active');
      }
    }

    if (this.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Update input
    if (this.isVR) {
      this.updateVRInput();
    } else {
      this.playerPaddle.updateFromMouse(this.mouse.x, this.mouse.y, this.camera);
    }

    // Game state machine
    switch (this.state) {
      case 'waiting_serve':
        this.updateWaitingServe(dt);
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'point_scored':
        this.updatePointScored(dt);
        break;
      case 'game_over':
        this.updateGameOver(dt);
        break;
    }

    // Update AI
    this.ai.update(
      dt,
      this.physics.ballPos,
      this.physics.ballVel,
      this.physics.ballActive,
      this.physics
    );

    // Update ball visual (with dt for particle effects)
    this.ball.update(this.physics.ballPos, this.physics.ballActive, dt);

    // Track ball speed for HUD
    if (this.physics.ballActive) {
      const speed = Math.sqrt(
        this.physics.ballVel.x ** 2 +
        this.physics.ballVel.y ** 2 +
        this.physics.ballVel.z ** 2
      );
      this.scoring.updateBallSpeed(speed);
    }

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  updateVRInput() {
    const rightController = this.controllers[1] || this.controllers[0];
    if (rightController) {
      this.playerPaddle.updateFromController(rightController);
    }

    // Serve on trigger press
    if (this.triggerPressed && this.state === 'waiting_serve' &&
        this.scoring.server === 'player') {
      this.playerServe();
      this.triggerPressed = false;
    }
  }

  updateWaitingServe(dt) {
    if (this.scoring.server === 'player') {
      // Show ball near paddle
      const paddleData = this.playerPaddle.getCollisionData();
      const ballPos = {
        x: paddleData.pos.x,
        y: paddleData.pos.y + 0.1,
        z: paddleData.pos.z - 0.05,
      };
      this.ball.show(ballPos);

      // Mouse click to serve
      if (!this.isVR && this.mouseDown) {
        this.playerServe();
        this.mouseDown = false;
      }
    } else {
      // AI serve
      this.serveTimer += dt;
      if (this.serveTimer > 1.5) {
        this.ai.serve(this.physics);
        this.state = 'playing';
        this.scoring.hideMessage();
        this.audio.playServeWhistle();
      }
    }
  }

  updatePlaying(dt) {
    // Physics step
    const event = this.physics.update(dt);

    // Check paddle collisions
    const playerData = this.playerPaddle.getCollisionData();
    const hit = this.physics.checkPaddleCollision(playerData, true);
    if (hit) {
      const speed = Math.sqrt(
        this.physics.ballVel.x ** 2 +
        this.physics.ballVel.y ** 2 +
        this.physics.ballVel.z ** 2
      );
      const intensity = Math.min(speed / 10, 1);
      this.audio.playPaddleHit(0.5 + intensity * 0.5);
      this.scoring.incrementRally();

      // Particles and impact flash
      this.ball.spawnHitParticles(this.physics.ballPos, this.physics.ballVel, 0xff6633);
      this.ball.triggerImpact(this.physics.ballPos, intensity);

      // Record player position for AI anticipation
      this.ai.recordPlayerPosition(playerData.pos.x);
    }

    const aiData = this.aiPaddle.getCollisionData();
    const aiHit = this.physics.checkPaddleCollision(aiData, false);
    if (aiHit) {
      const speed = Math.sqrt(
        this.physics.ballVel.x ** 2 +
        this.physics.ballVel.y ** 2 +
        this.physics.ballVel.z ** 2
      );
      const intensity = Math.min(speed / 10, 1);
      this.audio.playPaddleHit(0.3 + intensity * 0.4);
      this.scoring.incrementRally();

      this.ball.spawnHitParticles(this.physics.ballPos, this.physics.ballVel, 0x3388ff);
      this.ball.triggerImpact(this.physics.ballPos, intensity * 0.7);
    }

    // Handle physics events
    if (event) {
      this.handlePhysicsEvent(event);
    }
  }

  handlePhysicsEvent(event) {
    switch (event.type) {
      case 'bounce': {
        const speed = Math.sqrt(
          this.physics.ballVel.x ** 2 +
          this.physics.ballVel.y ** 2 +
          this.physics.ballVel.z ** 2
        );
        this.audio.playBounce(Math.min(0.3 + speed / 15, 1.0));
        // Bounce ring effect on table
        this.ball.spawnBounceRing({
          x: this.physics.ballPos.x,
          y: C.TABLE_HEIGHT + C.TABLE_THICKNESS / 2 + 0.001,
          z: this.physics.ballPos.z,
        });
        break;
      }
      case 'net':
        this.audio.playNetHit();
        this.ball.spawnHitParticles(this.physics.ballPos, this.physics.ballVel, 0xffffff);
        break;

      case 'edge':
        this.audio.playBounce(0.3);
        break;

      case 'floor':
      case 'out_of_bounds':
        this.resolvePoint();
        break;
    }
  }

  resolvePoint() {
    let scorer = null;
    const lastHit = this.physics.lastHitBy;
    const bouncedPlayer = this.physics.bouncedOnPlayerSide;
    const bouncedAI = this.physics.bouncedOnAISide;
    const crossedNet = this.physics.crossedNet;

    if (lastHit === 'player') {
      if (!bouncedAI && crossedNet) {
        if (this.physics.ballPos.z < -C.TABLE_LENGTH / 2) {
          scorer = 'ai';
        } else {
          scorer = 'player';
        }
      } else if (bouncedAI) {
        scorer = 'player';
      } else if (!crossedNet) {
        scorer = 'ai';
      } else {
        scorer = 'player';
      }
    } else if (lastHit === 'ai') {
      if (!bouncedPlayer && crossedNet) {
        if (this.physics.ballPos.z > C.TABLE_LENGTH / 2) {
          scorer = 'player';
        } else {
          scorer = 'ai';
        }
      } else if (bouncedPlayer) {
        scorer = 'ai';
      } else if (!crossedNet) {
        scorer = 'player';
      } else {
        scorer = 'ai';
      }
    } else {
      scorer = this.scoring.server === 'player' ? 'ai' : 'player';
    }

    this.scorePoint(scorer);
  }

  scorePoint(scorer) {
    const result = this.scoring.pointScored(scorer);
    this.updateVRScore();

    const msg = scorer === 'player' ? 'Your point!' : 'Opponent point!';
    const msgType = scorer === 'player' ? 'point-player' : 'point-ai';
    this.scoring.showMessage(msg, 2000, msgType);
    if (this.isVR) this.showVRMessage(msg);

    this.audio.playScore(scorer === 'player');

    if (result.gameOver) {
      this.state = 'game_over';
      this.pointTimer = 0;
      this.audio.playGameOver(result.winner === 'player');

      // Show game over UI after brief delay
      setTimeout(() => this.showGameOver(result.winner), 1500);
    } else {
      this.state = 'point_scored';
      this.pointTimer = 0;
    }
  }

  showGameOver(winner) {
    if (this.isVR) {
      const winMsg = winner === 'player' ? 'You Win!' : 'AI Wins!';
      this.showVRMessage(winMsg + ' - Squeeze trigger to play again');
      return;
    }

    const stats = this.scoring.getStats();
    const overlay = document.getElementById('gameOverOverlay');
    const resultEl = document.getElementById('gameOverResult');
    const scoreEl = document.getElementById('gameOverScore');

    if (winner === 'player') {
      resultEl.textContent = 'Victory!';
      resultEl.className = 'game-over-result win';
    } else {
      resultEl.textContent = 'Defeated';
      resultEl.className = 'game-over-result lose';
    }

    scoreEl.textContent = `${stats.playerScore} - ${stats.aiScore}`;
    document.getElementById('statRally').textContent = stats.longestRally;
    document.getElementById('statSpeed').textContent = stats.topSpeed;
    document.getElementById('statTotal').textContent = stats.totalRallies;

    overlay.classList.add('active');
  }

  hideGameOver() {
    document.getElementById('gameOverOverlay').classList.remove('active');
  }

  updatePointScored(dt) {
    this.pointTimer += dt;
    if (this.pointTimer > 2.0) {
      if (this.scoring.server === 'player') {
        this.preparePlayerServe();
      } else {
        this.prepareAIServe();
      }
    }
  }

  updateGameOver(dt) {
    this.pointTimer += dt;

    if (this.isVR && this.pointTimer > 3.0) {
      if (this.triggerPressed) {
        this.startGame();
        this.triggerPressed = false;
      }
    }
  }

  onResize() {
    if (!this.isVR) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }
}

// Start game when page loads
const game = new Game();
