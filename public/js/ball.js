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
    this.maxTrailLength = 20;
    this.visible = false;
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
    // Ball trail effect using line segments with fading opacity
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxTrailLength * 3);
    const colors = new Float32Array(this.maxTrailLength * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      linewidth: 1,
    });

    return new THREE.Line(geometry, material);
  }

  createShadowDisc() {
    // A simple fake shadow disc projected onto the table surface
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

  updateTrail(pos) {
    this.trailPositions.push({ x: pos.x, y: pos.y, z: pos.z });
    if (this.trailPositions.length > this.maxTrailLength) {
      this.trailPositions.shift();
    }

    const positions = this.trail.geometry.attributes.position.array;
    const colors = this.trail.geometry.attributes.color.array;
    const len = this.trailPositions.length;

    for (let i = 0; i < len; i++) {
      positions[i * 3] = this.trailPositions[i].x;
      positions[i * 3 + 1] = this.trailPositions[i].y;
      positions[i * 3 + 2] = this.trailPositions[i].z;

      // Fade from dim orange (old) to bright orange (new)
      const t = i / Math.max(len - 1, 1);
      colors[i * 3] = 1.0;             // R
      colors[i * 3 + 1] = 0.4 + t * 0.3; // G: 0.4→0.7
      colors[i * 3 + 2] = 0.1 * t;     // B
    }

    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
    this.trail.geometry.setDrawRange(0, len);
  }

  update(physicsPos, active) {
    if (active) {
      this.mesh.position.set(physicsPos.x, physicsPos.y, physicsPos.z);
      this.mesh.visible = true;
      this.trail.visible = true;
      this.updateTrail(physicsPos);
      this.visible = true;

      // Update fake shadow disc on table surface
      const tableY = C.TABLE_HEIGHT + C.TABLE_THICKNESS / 2 + 0.001;
      const halfL = C.TABLE_LENGTH / 2;
      const halfW = C.TABLE_WIDTH / 2;

      // Only show shadow when ball is above the table area
      if (Math.abs(physicsPos.x) < halfW + 0.2 &&
          Math.abs(physicsPos.z) < halfL + 0.2 &&
          physicsPos.y > tableY) {
        this.shadowDisc.position.set(physicsPos.x, tableY, physicsPos.z);
        // Scale shadow based on height above table
        const heightAbove = Math.max(0.01, physicsPos.y - tableY);
        const scale = Math.max(0.5, 1.0 - heightAbove * 0.5);
        this.shadowDisc.scale.setScalar(scale);
        this.shadowDisc.material.opacity = Math.max(0.05, 0.2 - heightAbove * 0.1);
        this.shadowDisc.visible = true;
      } else {
        this.shadowDisc.visible = false;
      }
    } else if (this.visible) {
      // Keep showing at last position briefly
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
  }

  hide() {
    this.mesh.visible = false;
    this.trail.visible = false;
    this.shadowDisc.visible = false;
    this.visible = false;
    this.trailPositions = [];
  }
}
