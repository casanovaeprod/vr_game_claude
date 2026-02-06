import * as THREE from 'three';
import * as C from './constants.js';

export class Ball {
  constructor(scene) {
    this.scene = scene;
    this.mesh = this.createBallMesh();
    this.trail = this.createTrail();
    this.scene.add(this.mesh);
    this.scene.add(this.trail);

    this.trailPositions = [];
    this.maxTrailLength = 15;
    this.visible = false;
  }

  createBallMesh() {
    const geo = new THREE.SphereGeometry(C.BALL_RADIUS, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: C.COLORS.ball,
      roughness: 0.3,
      metalness: 0.05,
      emissive: 0xffffff,
      emissiveIntensity: 0.05,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.visible = false;
    return mesh;
  }

  createTrail() {
    // Ball trail effect using line segments
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxTrailLength * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      color: 0xffa500,
      transparent: true,
      opacity: 0.4,
      linewidth: 1,
    });

    return new THREE.Line(geometry, material);
  }

  updateTrail(pos) {
    this.trailPositions.push({ x: pos.x, y: pos.y, z: pos.z });
    if (this.trailPositions.length > this.maxTrailLength) {
      this.trailPositions.shift();
    }

    const positions = this.trail.geometry.attributes.position.array;
    for (let i = 0; i < this.trailPositions.length; i++) {
      positions[i * 3] = this.trailPositions[i].x;
      positions[i * 3 + 1] = this.trailPositions[i].y;
      positions[i * 3 + 2] = this.trailPositions[i].z;
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.setDrawRange(0, this.trailPositions.length);
  }

  update(physicsPos, active) {
    if (active) {
      this.mesh.position.set(physicsPos.x, physicsPos.y, physicsPos.z);
      this.mesh.visible = true;
      this.trail.visible = true;
      this.updateTrail(physicsPos);
      this.visible = true;
    } else if (this.visible) {
      // Keep showing at last position briefly
      this.trail.visible = false;
      this.trailPositions = [];
    }
  }

  show(pos) {
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.visible = true;
    this.visible = true;
    this.trail.visible = false;
    this.trailPositions = [];
  }

  hide() {
    this.mesh.visible = false;
    this.trail.visible = false;
    this.visible = false;
    this.trailPositions = [];
  }
}
