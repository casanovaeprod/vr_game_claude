import * as THREE from 'three';
import * as C from './constants.js';

export class AIOpponent {
  constructor(paddle) {
    this.paddle = paddle;
    this.targetPos = new THREE.Vector3(0, C.TABLE_HEIGHT + 0.2, -C.TABLE_LENGTH / 2 - 0.15);
    this.currentPos = this.targetPos.clone();
    this.restPos = this.targetPos.clone();

    // AI behavior parameters
    this.reactionDelay = 0.08;
    this.moveSpeed = 4.0;
    this.accuracy = 0.85;
    this.aggression = 0.5;
    this.difficulty = 0.7;

    // State
    this.timeSinceLastUpdate = 0;
    this.swingPhase = 0;
    this.isSwinging = false;
    this.swingTarget = null;
    this.errorOffset = new THREE.Vector3();
    this.serving = false;
    this.state = 'idle'; // idle, tracking, anticipating, returning

    // Smooth angle tracking
    this.currentPitch = 0;
    this.currentYaw = 0;
    this.targetPitch = 0;
    this.targetYaw = 0;

    // Shot selection
    this.shotType = 'neutral'; // neutral, topspin, backspin, smash, placement
    this.consecutiveHits = 0;
    this.lastShotType = 'neutral';

    // Anticipation - predict based on player patterns
    this.playerHitPositions = [];
    this.maxPatternMemory = 10;

    // Swing velocity for hit power
    this.swingVelocity = new THREE.Vector3();
    this.preSwingPos = new THREE.Vector3();
  }

  setDifficulty(level) {
    this.difficulty = level;
    this.reactionDelay = 0.15 - level * 0.12;
    this.moveSpeed = 2.5 + level * 3.5;
    this.accuracy = 0.5 + level * 0.45;
    this.aggression = 0.3 + level * 0.5;
  }

  setDifficultyPreset(preset) {
    this.difficulty = preset.level;
    this.reactionDelay = preset.reactionDelay;
    this.moveSpeed = preset.moveSpeed;
    this.accuracy = preset.accuracy;
    this.aggression = preset.aggression;
  }

  update(dt, ballPos, ballVel, ballActive, physics) {
    this.timeSinceLastUpdate += dt;

    if (ballActive && ballVel.z < 0) {
      this.state = 'tracking';
      this.trackBall(dt, ballPos, ballVel, physics);
    } else if (ballActive && ballVel.z > 0) {
      this.state = 'anticipating';
      this.anticipateReturn(dt, ballPos, ballVel);
    } else {
      this.state = 'idle';
      this.idle(dt);
    }

    // Smooth movement
    const lerpFactor = Math.min(1, this.moveSpeed * dt);
    this.currentPos.lerp(this.targetPos, lerpFactor);

    // Smooth angle interpolation
    const angleLerp = Math.min(1, 10 * dt);
    this.currentPitch += (this.targetPitch - this.currentPitch) * angleLerp;
    this.currentYaw += (this.targetYaw - this.currentYaw) * angleLerp;

    // Update paddle with proper orientation
    const quat = new THREE.Quaternion();
    const flipToPlayer = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, Math.PI, 0)
    );
    const tiltQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.currentPitch, this.currentYaw, 0)
    );
    quat.copy(tiltQuat).multiply(flipToPlayer);

    this.paddle.updatePosition(this.currentPos, quat);
  }

  trackBall(dt, ballPos, ballVel, physics) {
    const aiZ = -C.TABLE_LENGTH / 2 - 0.15;
    const dz = aiZ - ballPos.z;

    if (ballVel.z === 0) return;
    const timeToReach = dz / ballVel.z;

    if (timeToReach < 0 || timeToReach > 3) {
      this.returnToReady(dt);
      return;
    }

    // Predict position accounting for gravity, spin (Magnus), and air resistance
    let predX = ballPos.x;
    let predY = ballPos.y;
    let predVx = ballVel.x;
    let predVy = ballVel.y;
    let predVz = ballVel.z;

    // Simple forward integration for better prediction (accounts for spin/drag)
    const steps = Math.min(30, Math.ceil(timeToReach / 0.016));
    const stepDt = timeToReach / Math.max(steps, 1);

    if (this.difficulty > 0.5) {
      // Higher difficulty AI does more accurate prediction
      const spin = physics.ballSpin || { x: 0, y: 0, z: 0 };
      for (let i = 0; i < steps; i++) {
        predVy += C.GRAVITY * stepDt;
        // Magnus effect prediction
        if (this.difficulty > 0.7) {
          predVx += C.MAGNUS_COEFFICIENT * (spin.y * predVz - spin.z * predVy) * stepDt / C.BALL_MASS;
          predVy += C.MAGNUS_COEFFICIENT * (spin.z * predVx - spin.x * predVz) * stepDt / C.BALL_MASS;
        }
        predX += predVx * stepDt;
        predY += predVy * stepDt;
      }
    } else {
      // Low difficulty: basic linear prediction
      predX = ballPos.x + ballVel.x * timeToReach;
      predY = ballPos.y + ballVel.y * timeToReach + 0.5 * C.GRAVITY * timeToReach * timeToReach;
    }

    // Add inaccuracy based on reaction timing
    if (this.timeSinceLastUpdate > this.reactionDelay) {
      const inaccuracy = 1 - this.accuracy;
      this.errorOffset.set(
        inaccuracy * (Math.random() - 0.5) * 0.4,
        inaccuracy * (Math.random() - 0.5) * 0.15,
        0
      );
      this.timeSinceLastUpdate = 0;

      // Decide shot type based on ball state and difficulty
      this.decideShotType(ballPos, ballVel, timeToReach);
    }

    // Clamp predicted position to reachable area
    const targetX = THREE.MathUtils.clamp(
      predX + this.errorOffset.x,
      -C.TABLE_WIDTH / 2 - 0.3,
      C.TABLE_WIDTH / 2 + 0.3
    );
    const targetY = THREE.MathUtils.clamp(
      Math.max(predY + this.errorOffset.y, C.TABLE_HEIGHT + 0.05),
      C.TABLE_HEIGHT + 0.05,
      C.TABLE_HEIGHT + 0.6
    );

    this.targetPos.set(targetX, targetY, aiZ);

    // Adjust paddle angle based on shot type
    this.applyPaddleAngleForShot(ballPos, aiZ, targetX);

    // Start swing when ball is close
    const distToBall = Math.abs(ballPos.z - aiZ);
    if (distToBall < 0.5 && !this.isSwinging) {
      this.startSwing(ballPos);
    }
  }

  decideShotType(ballPos, ballVel, timeToReach) {
    const rand = Math.random();
    const speed = Math.sqrt(ballVel.x ** 2 + ballVel.y ** 2 + ballVel.z ** 2);

    if (this.aggression > 0.6 && speed < 3 && ballPos.y > C.TABLE_HEIGHT + 0.2 && rand < this.aggression * 0.4) {
      // Smash opportunity - ball is high and slow
      this.shotType = 'smash';
    } else if (rand < 0.25 && this.accuracy > 0.6) {
      // Placement shot - aim at corners
      this.shotType = 'placement';
    } else if (rand < 0.45) {
      this.shotType = 'topspin';
    } else if (rand < 0.6 && this.difficulty > 0.4) {
      this.shotType = 'backspin';
    } else {
      this.shotType = 'neutral';
    }
  }

  applyPaddleAngleForShot(ballPos, aiZ, targetX) {
    const distToBall = Math.abs(ballPos.z - aiZ);

    switch (this.shotType) {
      case 'smash':
        this.targetPitch = -0.35; // angle down for smash
        break;
      case 'topspin':
        this.targetPitch = -0.25; // slightly forward for topspin
        break;
      case 'backspin':
        this.targetPitch = 0.1; // open face for backspin
        break;
      case 'placement':
        this.targetPitch = -0.15;
        break;
      default:
        this.targetPitch = -0.15;
    }

    // Aim toward where we want to hit the ball
    if (this.swingTarget) {
      const aimAngle = Math.atan2(this.swingTarget.x - targetX, C.TABLE_LENGTH);
      this.targetYaw = -aimAngle * 0.4;
    }

    // Adjust pitch based on distance to ball
    if (distToBall < 0.3) {
      this.targetPitch -= 0.1; // lean in for contact
    }
  }

  startSwing(ballPos) {
    this.isSwinging = true;
    this.swingPhase = 0;
    this.preSwingPos.copy(this.currentPos);

    // Decide where to aim the return based on shot type
    let aimX, aimZ;

    switch (this.shotType) {
      case 'smash':
        // Aim at center or away from anticipated player position
        aimX = this.predictPlayerWeakSide();
        aimZ = C.TABLE_LENGTH / 2 - 0.3;
        break;
      case 'placement':
        // Aim at corners
        aimX = (Math.random() > 0.5 ? 1 : -1) * C.TABLE_WIDTH * 0.4;
        aimZ = C.TABLE_LENGTH / 2 - (Math.random() * 0.5);
        break;
      case 'topspin':
        aimX = (Math.random() - 0.5) * C.TABLE_WIDTH * 0.6;
        aimZ = C.TABLE_LENGTH / 2;
        break;
      case 'backspin':
        // Backspin: aim short (close to net)
        aimX = (Math.random() - 0.5) * C.TABLE_WIDTH * 0.4;
        aimZ = 0.3 + Math.random() * 0.5;
        break;
      default:
        aimX = (Math.random() - 0.5) * C.TABLE_WIDTH * this.accuracy;
        aimZ = C.TABLE_LENGTH / 2;
    }

    this.swingTarget = new THREE.Vector3(aimX, 0, aimZ);
  }

  predictPlayerWeakSide() {
    if (this.playerHitPositions.length < 3) {
      return (Math.random() - 0.5) * C.TABLE_WIDTH * 0.6;
    }

    // Average player position - aim away from it
    const avgX = this.playerHitPositions.reduce((sum, p) => sum + p, 0) / this.playerHitPositions.length;
    return -avgX * 0.6 + (Math.random() - 0.5) * 0.2;
  }

  recordPlayerPosition(x) {
    this.playerHitPositions.push(x);
    if (this.playerHitPositions.length > this.maxPatternMemory) {
      this.playerHitPositions.shift();
    }
  }

  anticipateReturn(dt, ballPos, ballVel) {
    // Ball going toward player - move to ready position but anticipate return
    const readyX = this.difficulty > 0.6
      ? this.predictPlayerWeakSide() * -0.3 // Position to cover likely return
      : 0;

    this.targetPos.lerp(
      new THREE.Vector3(readyX, C.TABLE_HEIGHT + 0.22, -C.TABLE_LENGTH / 2 - 0.15),
      Math.min(1, 1.5 * dt)
    );
    this.isSwinging = false;
    this.targetPitch = -0.1;
    this.targetYaw = 0;
  }

  returnToReady(dt) {
    this.targetPos.lerp(this.restPos, Math.min(1, 2 * dt));
    this.isSwinging = false;
    this.targetPitch = -0.1;
    this.targetYaw = 0;
  }

  idle(dt) {
    const time = performance.now() / 1000;
    // Subtle idle animation - looks alive
    this.targetPos.set(
      Math.sin(time * 0.5) * 0.08 + Math.sin(time * 1.3) * 0.02,
      C.TABLE_HEIGHT + 0.2 + Math.sin(time * 0.7) * 0.015,
      -C.TABLE_LENGTH / 2 - 0.15
    );
    this.targetPitch = -0.1 + Math.sin(time * 0.4) * 0.02;
    this.targetYaw = Math.sin(time * 0.6) * 0.02;
  }

  serve(physics) {
    this.serving = true;

    // Position ball for serve
    const serveX = (Math.random() - 0.5) * 0.3;
    const servePos = {
      x: serveX,
      y: C.TABLE_HEIGHT + 0.4,
      z: -C.TABLE_LENGTH / 2 - 0.1,
    };

    // Varied serve targeting based on difficulty
    let targetX, speed, vy;
    const serveType = Math.random();

    if (serveType < 0.3 && this.difficulty > 0.5) {
      // Fast serve to corner
      targetX = (Math.random() > 0.5 ? 1 : -1) * C.TABLE_WIDTH * 0.35;
      speed = 3.0 + this.aggression * 2.5;
      vy = 1.2 + Math.random() * 0.3;
    } else if (serveType < 0.5 && this.difficulty > 0.4) {
      // Short serve (backspin)
      targetX = (Math.random() - 0.5) * C.TABLE_WIDTH * 0.4;
      speed = 2.0 + this.aggression * 1.0;
      vy = 2.0 + Math.random() * 0.3;
    } else {
      // Standard serve
      targetX = (Math.random() - 0.5) * C.TABLE_WIDTH * 0.6;
      speed = 2.5 + this.aggression * 2.0;
      vy = 1.5 + Math.random() * 0.5;
    }

    const vx = (targetX - servePos.x) * 0.8;
    const vz = speed;

    // Spin based on serve type and difficulty
    const spinIntensity = this.aggression * 25;
    let spin;
    if (serveType < 0.3) {
      // Sidespin serve
      spin = {
        x: (Math.random() - 0.5) * spinIntensity * 0.5,
        y: (Math.random() > 0.5 ? 1 : -1) * spinIntensity * 0.8,
        z: (Math.random() - 0.5) * spinIntensity * 0.3,
      };
    } else if (serveType < 0.5) {
      // Backspin serve
      spin = {
        x: spinIntensity * 0.7,
        y: (Math.random() - 0.5) * spinIntensity * 0.2,
        z: 0,
      };
    } else {
      // Mixed spin
      spin = {
        x: (Math.random() - 0.5) * spinIntensity,
        y: (Math.random() - 0.5) * spinIntensity * 0.5,
        z: (Math.random() - 0.5) * spinIntensity,
      };
    }

    physics.serveBall(servePos, { x: vx, y: vy, z: vz }, spin);
    physics.lastHitBy = 'ai';

    setTimeout(() => { this.serving = false; }, 500);
  }
}
