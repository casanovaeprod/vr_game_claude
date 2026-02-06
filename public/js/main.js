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

    // VR score display
    this.vrScoreText = null;
    this.vrMessageText = null;

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

    // Camera (for non-VR mode)
    // Position slightly elevated and behind the player's end, looking at the table
    this.camera = new THREE.PerspectiveCamera(
      65, window.innerWidth / window.innerHeight, 0.01, 50
    );
    this.camera.position.set(
      0,
      1.65, // standing eye height
      C.TABLE_LENGTH / 2 + 0.8
    );
    this.camera.lookAt(0, C.TABLE_HEIGHT + 0.1, 0);

    // Build scene
    new GameScene(this.scene);

    // Create game objects
    this.playerPaddle = new Paddle(this.scene, true);
    this.aiPaddle = new Paddle(this.scene, false);
    this.ball = new Ball(this.scene);
    this.ai = new AIOpponent(this.aiPaddle);
    this.ai.setDifficulty(0.6);

    // VR score display (3D text in the scene)
    this.createVRScoreDisplay();

    // Set up event listeners
    this.setupInput();
    this.checkVRSupport();

    // Handle resize
    window.addEventListener('resize', () => this.onResize());

    // Start render loop
    this.renderer.setAnimationLoop((time, frame) => this.gameLoop(time, frame));
  }

  createVRScoreDisplay() {
    // Create a canvas-based texture for score display in VR
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.roundRect(0, 0, 512, 128, 16);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const serverLeft = this.scoring.server === 'ai' ? '* ' : '';
    const serverRight = this.scoring.server === 'player' ? ' *' : '';
    ctx.fillText(
      `${serverLeft}AI ${this.scoring.aiScore} - ${this.scoring.playerScore} You${serverRight}`,
      256, 64
    );
    this.scoreTexture.needsUpdate = true;
  }

  showVRMessage(text) {
    const ctx = this.msgCtx;
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
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
        statusEl.textContent = 'VR headset detected! Click "Enter VR" to play in VR.';
        vrButton.addEventListener('click', () => this.enterVR());
      } else {
        statusEl.textContent = 'No VR headset detected. You can still play on screen!';
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

      // Set up VR reference space
      const refSpace = await session.requestReferenceSpace('local-floor');
      this.renderer.xr.setReferenceSpace(refSpace);

      // Set up controllers
      this.setupVRControllers();

      session.addEventListener('end', () => {
        this.isVR = false;
        this.xrSession = null;
        this.vrScoreMesh.visible = false;
        this.vrMsgMesh.visible = false;
        document.getElementById('overlay').classList.remove('hidden');
      });

      // Show VR score display
      this.vrScoreMesh.visible = true;

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

      // Controller grip (for model visualization)
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(controllerModelFactory.createControllerModel(grip));
      this.scene.add(grip);
      this.controllerGrips.push(grip);

      // Add a visual ray for aiming (subtle)
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

  setupInput() {
    // Mouse/touch input for non-VR mode
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

    // Play flat button
    document.getElementById('playFlat').addEventListener('click', () => {
      this.audio.init();
      this.startGame();
    });
  }

  startGame() {
    document.getElementById('overlay').classList.add('hidden');
    this.scoring.reset();
    this.updateVRScore();
    this.state = 'waiting_serve';
    this.serveTimer = 0;

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
    this.scoring.showMessage(this.isVR
      ? 'Your serve! Squeeze trigger'
      : 'Your serve! Click to serve');
    if (this.isVR) this.showVRMessage('Your serve! Squeeze trigger');
  }

  prepareAIServe() {
    this.state = 'waiting_serve';
    this.serveTimer = 0;
    this.ball.hide();
    this.scoring.showMessage('Opponent serving...');
    if (this.isVR) this.showVRMessage('Opponent serving...');
  }

  playerServe() {
    const paddleData = this.playerPaddle.getCollisionData();
    const servePos = {
      x: paddleData.pos.x,
      y: paddleData.pos.y + 0.12,
      z: paddleData.pos.z - 0.05,
    };

    // Toss the ball up with a slight forward trajectory
    // The player needs to hit it with their paddle
    const vel = {
      x: (Math.random() - 0.5) * 0.2,
      y: 2.5,
      z: -0.5,
    };

    this.physics.serveBall(servePos, vel, { x: 0, y: 0, z: 0 });
    this.physics.lastHitBy = 'player';
    this.state = 'playing';
    this.scoring.hideMessage();
  }

  gameLoop(time, frame) {
    const dt = Math.min(this.clock.getDelta(), 0.05);

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

    // Update ball visual
    this.ball.update(this.physics.ballPos, this.physics.ballActive);

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  updateVRInput() {
    // Use right controller (index 1) as paddle, fallback to 0
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
      // Show ball near paddle, waiting for serve input
      const paddleData = this.playerPaddle.getCollisionData();
      const ballPos = {
        x: paddleData.pos.x,
        y: paddleData.pos.y + 0.1,
        z: paddleData.pos.z - 0.05,
      };
      this.ball.show(ballPos);

      // Mouse click to serve in non-VR
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
      }
    }
  }

  updatePlaying(dt) {
    // Physics step
    const event = this.physics.update(dt);

    // Check paddle collisions using the new API
    // getCollisionData() now returns { pos, quat, normal, vel }
    const playerData = this.playerPaddle.getCollisionData();
    const hit = this.physics.checkPaddleCollision(playerData, true);
    if (hit) {
      this.audio.playPaddleHit(0.7);
    }

    const aiData = this.aiPaddle.getCollisionData();
    const aiHit = this.physics.checkPaddleCollision(aiData, false);
    if (aiHit) {
      this.audio.playPaddleHit(0.5);
    }

    // Handle physics events
    if (event) {
      this.handlePhysicsEvent(event);
    }
  }

  handlePhysicsEvent(event) {
    switch (event.type) {
      case 'bounce':
        this.audio.playBounce(0.6);
        break;

      case 'net':
        this.audio.playNetHit();
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
    // Determine who scored based on game rules
    let scorer = null;
    const lastHit = this.physics.lastHitBy;
    const bouncedPlayer = this.physics.bouncedOnPlayerSide;
    const bouncedAI = this.physics.bouncedOnAISide;
    const crossedNet = this.physics.crossedNet;

    if (lastHit === 'player') {
      if (!bouncedAI && crossedNet) {
        // Player hit it over but it didn't bounce on AI's side
        if (this.physics.ballPos.z < -C.TABLE_LENGTH / 2) {
          scorer = 'ai'; // Player hit it past the table
        } else {
          scorer = 'player'; // AI failed to return
        }
      } else if (bouncedAI) {
        scorer = 'player'; // Bounced on AI side and AI didn't return
      } else if (!crossedNet) {
        scorer = 'ai'; // Didn't make it over the net
      } else {
        scorer = 'player';
      }
    } else if (lastHit === 'ai') {
      if (!bouncedPlayer && crossedNet) {
        if (this.physics.ballPos.z > C.TABLE_LENGTH / 2) {
          scorer = 'player'; // AI hit it past the table
        } else {
          scorer = 'ai';
        }
      } else if (bouncedPlayer) {
        scorer = 'ai'; // Bounced on player side and player didn't return
      } else if (!crossedNet) {
        scorer = 'player'; // AI didn't make it over the net
      } else {
        scorer = 'ai';
      }
    } else {
      // No one hit it - serve fault, point to receiver
      scorer = this.scoring.server === 'player' ? 'ai' : 'player';
    }

    this.scorePoint(scorer);
  }

  scorePoint(scorer) {
    const result = this.scoring.pointScored(scorer);
    this.updateVRScore();

    const msg = scorer === 'player' ? 'Your point!' : 'Opponent point!';
    this.scoring.showMessage(msg);
    if (this.isVR) this.showVRMessage(msg);

    this.audio.playScore(scorer === 'player');

    if (result.gameOver) {
      this.state = 'game_over';
      this.pointTimer = 0;
      const winMsg = result.winner === 'player'
        ? 'You Win!'
        : 'AI Wins!';
      this.scoring.showMessage(winMsg, 0);
      if (this.isVR) this.showVRMessage(winMsg);
      this.audio.playGameOver(result.winner === 'player');
    } else {
      this.state = 'point_scored';
      this.pointTimer = 0;
    }
  }

  updatePointScored(dt) {
    this.pointTimer += dt;

    if (this.pointTimer > 2.0) {
      // Start next serve
      if (this.scoring.server === 'player') {
        this.preparePlayerServe();
      } else {
        this.prepareAIServe();
      }
    }
  }

  updateGameOver(dt) {
    this.pointTimer += dt;

    // After 5 seconds, allow restart
    if (this.pointTimer > 5.0) {
      if (this.isVR) {
        if (this.triggerPressed) {
          this.startGame();
          this.triggerPressed = false;
        } else {
          this.showVRMessage('Squeeze trigger to play again');
        }
      } else if (this.mouseDown) {
        this.startGame();
        this.mouseDown = false;
      } else {
        this.scoring.showMessage(
          `${this.scoring.winner === 'player' ? 'You Win!' : 'AI Wins!'} - Click to play again`,
          0
        );
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
