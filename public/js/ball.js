import * as THREE from 'three';
import * as C from './constants.js';

export class Ball {
  constructor(scene) {
    this.scene = scene;
    this.mesh = this.createBallMesh();
    this.trail = this.createTrail();
    this.shadowDisc = this.createShadowDisc();
    this.scene.add(this.mesh);
    this.scene.add(this.trail);
    this.scene.add(this.shadowDisc);

    this.trailPositions = [];
    this.maxTrailLength = 25;
    this.visible = false;

    // Particle system for hit effects
    this.particles = [];
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    // Impact flash
    this.impactLight = new THREE.PointLight(0xffaa44, 0, 0.8);
    this.impactLight.visible = false;
    this.scene.add(this.impactLight);
    this.impactTimer = 0;

    // Bounce ring effect
    this.bounceRings = [];
  }

  createBallMesh() {
    const geo = new THREE.SphereGeometry(C.BALL_RADIUS, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: C.COLORS.ball,
      roughness: 0.25,
      metalness: 0.05,
      emissive: 0xffffff,
      emissiveIntensity: 0.08,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.visible = false;
    return mesh;
  }

  createTrail() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxTrailLength * 3);
    const colors = new Float32Array(this.maxTrailLength * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      linewidth: 1,
    });

    return new THREE.Line(geometry, material);
  }

  createShadowDisc() {
    const geo = new THREE.CircleGeometry(C.BALL_RADIUS * 1.5, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    const disc = new THREE.Mesh(geo, mat);
    disc.rotation.x = -Math.PI / 2;
    disc.visible = false;
    return disc;
  }

  spawnHitParticles(position, velocity, color = 0xffaa44) {
    const count = 8;
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    const particleSpeed = Math.min(speed * 0.3, 2.0);

    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.003 + Math.random() * 0.003, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8,
      });
      const particle = new THREE.Mesh(geo, mat);
      particle.position.set(position.x, position.y, position.z);

      // Random outward velocity
      const angle = Math.random() * Math.PI * 2;
      const upAngle = Math.random() * Math.PI * 0.5;
      particle.userData.vel = {
        x: Math.cos(angle) * Math.cos(upAngle) * particleSpeed * (0.5 + Math.random()),
        y: Math.sin(upAngle) * particleSpeed * (0.3 + Math.random() * 0.7),
        z: Math.sin(angle) * Math.cos(upAngle) * particleSpeed * (0.5 + Math.random()),
      };
      particle.userData.life = 0;
      particle.userData.maxLife = 0.3 + Math.random() * 0.2;

      this.particleGroup.add(particle);
      this.particles.push(particle);
    }
  }

  spawnBounceRing(position) {
    const geo = new THREE.RingGeometry(0.001, 0.008, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.x, position.y + 0.001, position.z);
    ring.userData.life = 0;
    ring.userData.maxLife = 0.4;
    this.scene.add(ring);
    this.bounceRings.push(ring);
  }

  updateParticles(dt) {
    // Update hit particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.userData.life += dt;

      if (p.userData.life >= p.userData.maxLife) {
        this.particleGroup.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      const t = p.userData.life / p.userData.maxLife;
      p.position.x += p.userData.vel.x * dt;
      p.position.y += p.userData.vel.y * dt + C.GRAVITY * dt * dt * 0.5;
      p.position.z += p.userData.vel.z * dt;
      p.userData.vel.y += C.GRAVITY * dt * 0.5;
      p.material.opacity = 0.8 * (1 - t);
      p.scale.setScalar(1 - t * 0.5);
    }

    // Update bounce rings
    for (let i = this.bounceRings.length - 1; i >= 0; i--) {
      const ring = this.bounceRings[i];
      ring.userData.life += dt;

      if (ring.userData.life >= ring.userData.maxLife) {
        this.scene.remove(ring);
        ring.geometry.dispose();
        ring.material.dispose();
        this.bounceRings.splice(i, 1);
        continue;
      }

      const t = ring.userData.life / ring.userData.maxLife;
      const scale = 1 + t * 4;
      ring.scale.setScalar(scale);
      ring.material.opacity = 0.5 * (1 - t);
    }

    // Update impact light
    if (this.impactTimer > 0) {
      this.impactTimer -= dt;
      this.impactLight.intensity = Math.max(0, this.impactTimer * 15);
      if (this.impactTimer <= 0) {
        this.impactLight.visible = false;
      }
    }
  }

  triggerImpact(position, intensity = 1) {
    this.impactLight.position.set(position.x, position.y, position.z);
    this.impactLight.intensity = intensity * 3;
    this.impactLight.visible = true;
    this.impactTimer = 0.15;
  }

  updateTrail(pos, speed) {
    this.trailPositions.push({ x: pos.x, y: pos.y, z: pos.z });
    if (this.trailPositions.length > this.maxTrailLength) {
      this.trailPositions.shift();
    }

    const positions = this.trail.geometry.attributes.position.array;
    const colors = this.trail.geometry.attributes.color.array;
    const len = this.trailPositions.length;

    // Color based on speed
    const speedNorm = Math.min(speed / 15, 1); // 0-1 based on speed

    for (let i = 0; i < len; i++) {
      positions[i * 3] = this.trailPositions[i].x;
      positions[i * 3 + 1] = this.trailPositions[i].y;
      positions[i * 3 + 2] = this.trailPositions[i].z;

      const t = i / Math.max(len - 1, 1);

      // Color transitions from cool (slow) to hot (fast)
      if (speedNorm > 0.7) {
        // Fast: orange to red
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.3 + t * 0.3;
        colors[i * 3 + 2] = 0.1 * t;
      } else if (speedNorm > 0.4) {
        // Medium: yellow to orange
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.5 + t * 0.4;
        colors[i * 3 + 2] = 0.2 * t;
      } else {
        // Slow: white to light blue
        colors[i * 3] = 0.6 + t * 0.4;
        colors[i * 3 + 1] = 0.7 + t * 0.3;
        colors[i * 3 + 2] = 0.9 + t * 0.1;
      }
    }

    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
    this.trail.geometry.setDrawRange(0, len);

    // Trail opacity based on speed
    this.trail.material.opacity = 0.3 + speedNorm * 0.5;
  }

  update(physicsPos, active, dt = 0.016) {
    this.updateParticles(dt);

    if (active) {
      this.mesh.position.set(physicsPos.x, physicsPos.y, physicsPos.z);
      this.mesh.visible = true;
      this.trail.visible = true;
      this.visible = true;

      // Calculate ball speed for trail coloring
      const speed = this._lastPos
        ? Math.sqrt(
            (physicsPos.x - this._lastPos.x) ** 2 +
            (physicsPos.y - this._lastPos.y) ** 2 +
            (physicsPos.z - this._lastPos.z) ** 2
          ) / Math.max(dt, 0.001)
        : 0;
      this._lastPos = { ...physicsPos };

      this.updateTrail(physicsPos, speed);

      // Update ball emissive glow based on speed
      const speedNorm = Math.min(speed / 15, 1);
      this.mesh.material.emissiveIntensity = 0.08 + speedNorm * 0.15;

      // Update shadow disc on table surface
      const tableY = C.TABLE_HEIGHT + C.TABLE_THICKNESS / 2 + 0.001;
      const halfL = C.TABLE_LENGTH / 2;
      const halfW = C.TABLE_WIDTH / 2;

      if (Math.abs(physicsPos.x) < halfW + 0.2 &&
          Math.abs(physicsPos.z) < halfL + 0.2 &&
          physicsPos.y > tableY) {
        this.shadowDisc.position.set(physicsPos.x, tableY, physicsPos.z);
        const heightAbove = Math.max(0.01, physicsPos.y - tableY);
        const scale = Math.max(0.5, 1.0 - heightAbove * 0.5);
        this.shadowDisc.scale.setScalar(scale);
        this.shadowDisc.material.opacity = Math.max(0.05, 0.2 - heightAbove * 0.1);
        this.shadowDisc.visible = true;
      } else {
        this.shadowDisc.visible = false;
      }
    } else if (this.visible) {
      this.trail.visible = false;
      this.trailPositions = [];
      this.shadowDisc.visible = false;
    }
  }

  show(pos) {
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.visible = true;
    this.visible = true;
    this.trail.visible = false;
    this.trailPositions = [];
    this.shadowDisc.visible = false;
    this._lastPos = { ...pos };
  }

  hide() {
    this.mesh.visible = false;
    this.trail.visible = false;
    this.shadowDisc.visible = false;
    this.visible = false;
    this.trailPositions = [];
    this._lastPos = null;
  }
}
