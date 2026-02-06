import * as C from './constants.js';

export class Physics {
  constructor() {
    this.ballPos = { x: 0, y: 0, z: 0 };
    this.ballVel = { x: 0, y: 0, z: 0 };
    this.ballSpin = { x: 0, y: 0, z: 0 }; // angular velocity in rad/s
    this.ballActive = false;
    this.lastBounceTime = 0;
    this.bouncedOnPlayerSide = false;
    this.bouncedOnAISide = false;
    this.crossedNet = false;
    this.lastHitBy = null; // 'player' or 'ai'
  }

  resetBall(position) {
    this.ballPos = { ...position };
    this.ballVel = { x: 0, y: 0, z: 0 };
    this.ballSpin = { x: 0, y: 0, z: 0 };
    this.ballActive = false;
    this.bouncedOnPlayerSide = false;
    this.bouncedOnAISide = false;
    this.crossedNet = false;
    this.lastHitBy = null;
  }

  serveBall(position, velocity, spin) {
    this.ballPos = { ...position };
    this.ballVel = { ...velocity };
    this.ballSpin = spin ? { ...spin } : { x: 0, y: 0, z: 0 };
    this.ballActive = true;
    this.bouncedOnPlayerSide = false;
    this.bouncedOnAISide = false;
    this.crossedNet = false;
  }

  update(dt) {
    if (!this.ballActive) return null;

    // Cap delta time to avoid physics explosions
    dt = Math.min(dt, 1 / 30);

    // Sub-step for better collision detection
    const subSteps = 4;
    const subDt = dt / subSteps;

    for (let i = 0; i < subSteps; i++) {
      const event = this.subStep(subDt);
      if (event) return event;
    }

    return null;
  }

  subStep(dt) {
    // Gravity
    this.ballVel.y += C.GRAVITY * dt;

    // Air resistance
    const speed = Math.sqrt(
      this.ballVel.x ** 2 + this.ballVel.y ** 2 + this.ballVel.z ** 2
    );
    if (speed > 0) {
      const drag = C.AIR_RESISTANCE * speed * speed;
      const factor = Math.max(0, 1 - (drag * dt) / (C.BALL_MASS * speed));
      this.ballVel.x *= factor;
      this.ballVel.y *= factor;
      this.ballVel.z *= factor;
    }

    // Magnus effect (spin causes curved trajectories)
    // F = Cm * (spin x velocity)
    const magnus = {
      x: C.MAGNUS_COEFFICIENT * (this.ballSpin.y * this.ballVel.z - this.ballSpin.z * this.ballVel.y),
      y: C.MAGNUS_COEFFICIENT * (this.ballSpin.z * this.ballVel.x - this.ballSpin.x * this.ballVel.z),
      z: C.MAGNUS_COEFFICIENT * (this.ballSpin.x * this.ballVel.y - this.ballSpin.y * this.ballVel.x),
    };
    this.ballVel.x += magnus.x * dt / C.BALL_MASS;
    this.ballVel.y += magnus.y * dt / C.BALL_MASS;
    this.ballVel.z += magnus.z * dt / C.BALL_MASS;

    // Spin decay
    this.ballSpin.x *= C.SPIN_DECAY;
    this.ballSpin.y *= C.SPIN_DECAY;
    this.ballSpin.z *= C.SPIN_DECAY;

    // Update position
    this.ballPos.x += this.ballVel.x * dt;
    this.ballPos.y += this.ballVel.y * dt;
    this.ballPos.z += this.ballVel.z * dt;

    // Clamp speed
    const newSpeed = Math.sqrt(
      this.ballVel.x ** 2 + this.ballVel.y ** 2 + this.ballVel.z ** 2
    );
    if (newSpeed > C.BALL_MAX_SPEED) {
      const scale = C.BALL_MAX_SPEED / newSpeed;
      this.ballVel.x *= scale;
      this.ballVel.y *= scale;
      this.ballVel.z *= scale;
    }

    // Track net crossing
    if (this.lastHitBy === 'player' && this.ballPos.z < 0 && !this.crossedNet) {
      this.crossedNet = true;
    }
    if (this.lastHitBy === 'ai' && this.ballPos.z > 0 && !this.crossedNet) {
      this.crossedNet = true;
    }

    // --- Collision detection ---

    // Table surface collision
    const tableEvent = this.checkTableCollision();
    if (tableEvent) return tableEvent;

    // Net collision
    const netEvent = this.checkNetCollision();
    if (netEvent) return netEvent;

    // Floor / out of bounds
    if (this.ballPos.y < C.BALL_RADIUS) {
      this.ballActive = false;
      return { type: 'floor' };
    }

    // Way out of bounds
    if (Math.abs(this.ballPos.x) > C.ROOM_WIDTH / 2 ||
        Math.abs(this.ballPos.z) > C.ROOM_LENGTH / 2 ||
        this.ballPos.y > C.ROOM_HEIGHT) {
      this.ballActive = false;
      return { type: 'out_of_bounds' };
    }

    return null;
  }

  checkTableCollision() {
    const halfL = C.TABLE_LENGTH / 2;
    const halfW = C.TABLE_WIDTH / 2;
    const tableY = C.TABLE_HEIGHT + C.TABLE_THICKNESS / 2;

    // Ball must be near the table surface
    if (this.ballPos.y - C.BALL_RADIUS <= tableY &&
        this.ballPos.y - C.BALL_RADIUS > tableY - 0.05 &&
        this.ballVel.y < 0 &&
        Math.abs(this.ballPos.x) <= halfW + C.BALL_RADIUS &&
        Math.abs(this.ballPos.z) <= halfL + C.BALL_RADIUS) {

      // Bounce
      this.ballPos.y = tableY + C.BALL_RADIUS;
      this.ballVel.y = -this.ballVel.y * C.TABLE_RESTITUTION;

      // Spin effect on bounce: topspin/backspin affects horizontal velocity
      this.ballVel.x += this.ballSpin.z * 0.02;
      this.ballVel.z -= this.ballSpin.x * 0.02;

      // Friction reduces spin on contact
      this.ballSpin.x *= 0.7;
      this.ballSpin.z *= 0.7;

      // Track which side it bounced on
      const now = performance.now();
      if (now - this.lastBounceTime > 50) { // debounce
        this.lastBounceTime = now;
        if (this.ballPos.z > 0) {
          this.bouncedOnPlayerSide = true;
          return { type: 'bounce', side: 'player' };
        } else {
          this.bouncedOnAISide = true;
          return { type: 'bounce', side: 'ai' };
        }
      }
    }

    // Table edge collision (sides)
    const edgeCollision = this.checkTableEdgeCollision(halfL, halfW, tableY);
    if (edgeCollision) return edgeCollision;

    return null;
  }

  checkTableEdgeCollision(halfL, halfW, tableY) {
    // Check if the ball hits the side of the table
    const tableBottom = tableY - C.TABLE_THICKNESS / 2;

    if (this.ballPos.y > tableBottom && this.ballPos.y < tableY + 0.05) {
      // Side edges (x-axis)
      if (Math.abs(this.ballPos.z) <= halfL) {
        if (Math.abs(this.ballPos.x) > halfW - C.BALL_RADIUS &&
            Math.abs(this.ballPos.x) < halfW + C.BALL_RADIUS) {
          this.ballVel.x = -this.ballVel.x * 0.5;
          this.ballPos.x = Math.sign(this.ballPos.x) * (halfW + C.BALL_RADIUS);
          return { type: 'edge' };
        }
      }
      // End edges (z-axis)
      if (Math.abs(this.ballPos.x) <= halfW) {
        if (Math.abs(this.ballPos.z) > halfL - C.BALL_RADIUS &&
            Math.abs(this.ballPos.z) < halfL + C.BALL_RADIUS) {
          this.ballVel.z = -this.ballVel.z * 0.5;
          this.ballPos.z = Math.sign(this.ballPos.z) * (halfL + C.BALL_RADIUS);
          return { type: 'edge' };
        }
      }
    }

    return null;
  }

  checkNetCollision() {
    const halfW = C.TABLE_WIDTH / 2 + C.NET_OVERHANG;
    const netTop = C.TABLE_HEIGHT + C.TABLE_THICKNESS / 2 + C.NET_HEIGHT;
    const netBottom = C.TABLE_HEIGHT;

    if (Math.abs(this.ballPos.z) < C.BALL_RADIUS + 0.005 &&
        Math.abs(this.ballPos.x) < halfW &&
        this.ballPos.y > netBottom &&
        this.ballPos.y < netTop + C.BALL_RADIUS) {

      // Bounce off net
      this.ballVel.z = -this.ballVel.z * C.NET_RESTITUTION;
      this.ballVel.y *= 0.5;
      this.ballPos.z = Math.sign(this.ballPos.z) * (C.BALL_RADIUS + 0.006);

      return { type: 'net' };
    }

    return null;
  }

  checkPaddleCollision(paddlePos, paddleQuat, paddleVel, isPlayer) {
    if (!this.ballActive) return false;

    // Distance check
    const dx = this.ballPos.x - paddlePos.x;
    const dy = this.ballPos.y - paddlePos.y;
    const dz = this.ballPos.z - paddlePos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist > C.PADDLE_RADIUS + C.BALL_RADIUS + 0.03) return false;

    // Get paddle normal (local Y axis transformed by quaternion)
    const nx = 2 * (paddleQuat.x * paddleQuat.y + paddleQuat.w * paddleQuat.z);
    const ny = 1 - 2 * (paddleQuat.x * paddleQuat.x + paddleQuat.z * paddleQuat.z);
    const nz = 2 * (paddleQuat.y * paddleQuat.z - paddleQuat.w * paddleQuat.x);

    // Project distance onto paddle plane
    const projDist = Math.abs(dx * nx + dy * ny + dz * nz);

    // Project distance onto paddle face
    const faceDist = Math.sqrt(dist * dist - projDist * projDist);

    if (projDist < C.PADDLE_THICKNESS / 2 + C.BALL_RADIUS + 0.01 &&
        faceDist < C.PADDLE_RADIUS + C.BALL_RADIUS * 0.5) {

      // Prevent double hits
      if (this.lastHitBy === (isPlayer ? 'player' : 'ai')) {
        // Allow hit if ball has bounced or crossed net since last hit
        if (!this.crossedNet && !this.bouncedOnPlayerSide && !this.bouncedOnAISide) {
          return false;
        }
      }

      // Calculate reflection
      const relVelX = this.ballVel.x - (paddleVel?.x || 0);
      const relVelY = this.ballVel.y - (paddleVel?.y || 0);
      const relVelZ = this.ballVel.z - (paddleVel?.z || 0);

      const velDotN = relVelX * nx + relVelY * ny + relVelZ * nz;

      // Only hit if ball is moving toward paddle
      if (isPlayer && velDotN > 0.5) return false;
      if (!isPlayer && velDotN < -0.5) return false;

      // Reflect velocity
      const restitution = C.PADDLE_RESTITUTION;
      this.ballVel.x -= (1 + restitution) * velDotN * nx;
      this.ballVel.y -= (1 + restitution) * velDotN * ny;
      this.ballVel.z -= (1 + restitution) * velDotN * nz;

      // Add paddle velocity (transfers energy from swing)
      const paddleSpeed = paddleVel ? Math.sqrt(
        paddleVel.x ** 2 + paddleVel.y ** 2 + paddleVel.z ** 2
      ) : 0;

      if (paddleVel && paddleSpeed > 0.1) {
        const transferFactor = 1.2;
        this.ballVel.x += paddleVel.x * transferFactor;
        this.ballVel.y += paddleVel.y * transferFactor;
        this.ballVel.z += paddleVel.z * transferFactor;

        // Generate spin based on paddle motion
        // Cross product of paddle velocity and paddle normal gives spin axis
        this.ballSpin.x += (paddleVel.y * nz - paddleVel.z * ny) * 30;
        this.ballSpin.y += (paddleVel.z * nx - paddleVel.x * nz) * 30;
        this.ballSpin.z += (paddleVel.x * ny - paddleVel.y * nx) * 30;
      }

      // Push ball away from paddle to prevent re-collision
      const pushDir = isPlayer ? -1 : 1;
      this.ballPos.z += pushDir * 0.03;

      // Update hit state
      this.lastHitBy = isPlayer ? 'player' : 'ai';
      this.crossedNet = false;
      this.bouncedOnPlayerSide = false;
      this.bouncedOnAISide = false;

      return true;
    }

    return false;
  }
}
