import * as THREE from 'three';
import * as C from './constants.js';

export class AIOpponent {
  constructor(paddle) {
    this.paddle = paddle;
    this.targetPos = new THREE.Vector3(0, C.TABLE_HEIGHT + 0.2, -C.TABLE_LENGTH / 2 - 0.15);
    this.currentPos = this.targetPos.clone();
    this.restPos = this.targetPos.clone();

    // AI behavior parameters
    this.reactionDelay = 0.08; // seconds before AI reacts
    this.moveSpeed = 4.0; // meters per second
    this.accuracy = 0.85; // 0-1, how accurately it aims
    this.aggression = 0.5; // 0-1, how aggressively it hits
    this.difficulty = 0.7; // overall difficulty scaling

    // State
    this.timeSinceLastUpdate = 0;
    this.swingPhase = 0; // for swing animation
    this.isSwinging = false;
    this.swingTarget = null;
    this.errorOffset = new THREE.Vector3();
    this.serving = false;

    // Smooth angle tracking
    this.currentPitch = 0;
    this.currentYaw = 0;
    this.targetPitch = 0;
    this.targetYaw = 0;
  }

  setDifficulty(level) {
    // level: 0.0 (easy) to 1.0 (hard)
    this.difficulty = level;
    this.reactionDelay = 0.15 - level * 0.12;
    this.moveSpeed = 2.5 + level * 3.5;
    this.accuracy = 0.5 + level * 0.45;
    this.aggression = 0.3 + level * 0.5;
  }

  update(dt, ballPos, ballVel, ballActive, physics) {
    this.timeSinceLastUpdate += dt;

    if (ballActive && ballVel.z < 0) {
      // Ball is coming toward AI
      this.trackBall(dt, ballPos, ballVel);
    } else if (ballActive && ballVel.z > 0) {
      // Ball going away - return to ready position
      this.returnToReady(dt);
    } else {
      // No ball active - idle at ready position
      this.idle(dt);
    }

    // Smooth movement
    this.currentPos.lerp(this.targetPos, Math.min(1, this.moveSpeed * dt));

    // Smooth angle interpolation
    this.currentPitch += (this.targetPitch - this.currentPitch) * Math.min(1, 8 * dt);
    this.currentYaw += (this.targetYaw - this.currentYaw) * Math.min(1, 8 * dt);

    // Update paddle with proper orientation
    // The paddle's neutral position (identity quaternion) already has the face pointing
    // forward (-Z) thanks to the inner group pre-rotation.
    // For the AI, we need the face pointing +Z (toward the player).
    // So we rotate 180° around Y to flip it, then apply pitch/yaw adjustments.
    const quat = new THREE.Quaternion();

    // Base: flip paddle to face the player (+Z direction)
    const flipToPlayer = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, Math.PI, 0)
    );

    // Tilt adjustments
    const tiltQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.currentPitch, this.currentYaw, 0)
    );

    quat.copy(tiltQuat).multiply(flipToPlayer);

    this.paddle.updatePosition(this.currentPos, quat);
  }

  trackBall(dt, ballPos, ballVel) {
    // Predict where ball will be when it reaches AI's z-position
    const aiZ = -C.TABLE_LENGTH / 2 - 0.15;
    const dz = aiZ - ballPos.z;

    if (ballVel.z === 0) return;

    const timeToReach = dz / ballVel.z;

    if (timeToReach < 0 || timeToReach > 3) {
      this.returnToReady(dt);
      return;
    }

    // Predict position accounting for gravity and current velocity
    const predictedX = ballPos.x + ballVel.x * timeToReach;
    const predictedY = ballPos.y + ballVel.y * timeToReach + 0.5 * C.GRAVITY * timeToReach * timeToReach;

    // Add inaccuracy
    if (this.timeSinceLastUpdate > this.reactionDelay) {
      this.errorOffset.set(
        (1 - this.accuracy) * (Math.random() - 0.5) * 0.3,
        (1 - this.accuracy) * (Math.random() - 0.5) * 0.1,
        0
      );
      this.timeSinceLastUpdate = 0;
    }

    // Clamp predicted position to reachable area
    const targetX = THREE.MathUtils.clamp(
      predictedX + this.errorOffset.x,
      -C.TABLE_WIDTH / 2 - 0.3,
      C.TABLE_WIDTH / 2 + 0.3
    );
    const targetY = THREE.MathUtils.clamp(
      Math.max(predictedY + this.errorOffset.y, C.TABLE_HEIGHT + 0.05),
      C.TABLE_HEIGHT + 0.05,
      C.TABLE_HEIGHT + 0.6
    );

    this.targetPos.set(targetX, targetY, aiZ);

    // Aim paddle toward the ball
    const distToBall = Math.abs(ballPos.z - aiZ);
    this.targetPitch = -0.15; // slightly tilted forward

    // Start swing when ball is close
    if (distToBall < 0.5 && !this.isSwinging) {
      this.startSwing(ballPos);
    }

    // Adjust aim toward where we want to hit the ball
    if (this.swingTarget) {
      const aimAngle = Math.atan2(this.swingTarget.x - targetX, C.TABLE_LENGTH);
      this.targetYaw = -aimAngle * 0.3;
    }
  }

  startSwing(ballPos) {
    this.isSwinging = true;
    this.swingPhase = 0;

    // Decide where to aim the return
    const aimX = (Math.random() - 0.5) * C.TABLE_WIDTH * this.accuracy;
    this.swingTarget = new THREE.Vector3(aimX, 0, C.TABLE_LENGTH / 2);
  }

  returnToReady(dt) {
    this.targetPos.lerp(this.restPos, Math.min(1, 2 * dt));
    this.isSwinging = false;
    this.targetPitch = -0.1;
    this.targetYaw = 0;
  }

  idle(dt) {
    // Slight idle movement
    const time = performance.now() / 1000;
    this.targetPos.set(
      Math.sin(time * 0.5) * 0.1,
      C.TABLE_HEIGHT + 0.2 + Math.sin(time * 0.3) * 0.02,
      -C.TABLE_LENGTH / 2 - 0.15
    );
    this.targetPitch = -0.1;
    this.targetYaw = 0;
  }

  serve(physics) {
    this.serving = true;

    // Position ball for serve
    const servePos = {
      x: (Math.random() - 0.5) * 0.2,
      y: C.TABLE_HEIGHT + 0.4,
      z: -C.TABLE_LENGTH / 2 - 0.1,
    };

    // Aim at a random spot on the player's side
    const targetX = (Math.random() - 0.5) * C.TABLE_WIDTH * 0.6;

    const speed = 2.5 + this.aggression * 2.5;
    const vx = (targetX - servePos.x) * 0.8;
    const vz = speed;
    const vy = 1.5 + Math.random() * 0.5;

    // Add some spin
    const spin = {
      x: (Math.random() - 0.5) * 20 * this.aggression,
      y: (Math.random() - 0.5) * 10,
      z: (Math.random() - 0.5) * 20 * this.aggression,
    };

    physics.serveBall(servePos, { x: vx, y: vy, z: vz }, spin);
    physics.lastHitBy = 'ai';

    setTimeout(() => { this.serving = false; }, 500);
  }
}
