import * as THREE from 'three';
import * as C from './constants.js';

export class Paddle {
  constructor(scene, isPlayer = true) {
    this.scene = scene;
    this.isPlayer = isPlayer;
    this.mesh = this.createPaddleMesh();
    this.scene.add(this.mesh);

    this.position = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.velocity = new THREE.Vector3();
    this.prevPosition = new THREE.Vector3();

    // Position history for velocity smoothing
    this.posHistory = [];
    this.maxHistoryLength = 5;

    // Default position
    if (isPlayer) {
      this.mesh.position.set(0.15, C.TABLE_HEIGHT + 0.2, C.TABLE_LENGTH / 2 + 0.3);
    } else {
      this.mesh.position.set(0, C.TABLE_HEIGHT + 0.2, -C.TABLE_LENGTH / 2 - 0.3);
      // AI paddle faces player
      this.mesh.rotation.x = -0.3;
    }
  }

  createPaddleMesh() {
    const group = new THREE.Group();

    // Paddle blade (circular)
    const bladeGeo = new THREE.CylinderGeometry(
      C.PADDLE_RADIUS, C.PADDLE_RADIUS, C.PADDLE_THICKNESS, 32
    );

    // Red rubber side (front)
    const redMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.paddleRubberRed,
      roughness: 0.6,
      metalness: 0.0,
    });

    // Black rubber side (back)
    const blackMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.paddleRubberBlack,
      roughness: 0.6,
      metalness: 0.0,
    });

    // Wood core
    const woodMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.paddleWood,
      roughness: 0.7,
      metalness: 0.0,
    });

    // Blade
    const blade = new THREE.Mesh(bladeGeo, redMat);
    blade.castShadow = true;
    group.add(blade);

    // Thin wood edge ring
    const edgeGeo = new THREE.TorusGeometry(C.PADDLE_RADIUS - 0.002, 0.003, 8, 32);
    const edge = new THREE.Mesh(edgeGeo, woodMat);
    edge.rotation.x = Math.PI / 2;
    group.add(edge);

    // Handle
    const handleGeo = new THREE.CylinderGeometry(
      C.PADDLE_HANDLE_RADIUS, C.PADDLE_HANDLE_RADIUS * 0.85,
      C.PADDLE_HANDLE_LENGTH, 8
    );
    const handle = new THREE.Mesh(handleGeo, woodMat);
    handle.position.y = -(C.PADDLE_RADIUS * 0.7 + C.PADDLE_HANDLE_LENGTH / 2);
    handle.castShadow = true;
    group.add(handle);

    // Handle grip (darker wrap)
    const gripGeo = new THREE.CylinderGeometry(
      C.PADDLE_HANDLE_RADIUS + 0.002, C.PADDLE_HANDLE_RADIUS + 0.001,
      C.PADDLE_HANDLE_LENGTH * 0.7, 8
    );
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9,
    });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.y = -(C.PADDLE_RADIUS * 0.7 + C.PADDLE_HANDLE_LENGTH / 2);
    group.add(grip);

    return group;
  }

  updateFromController(controller) {
    // Get controller world position and quaternion
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    controller.matrixWorld.decompose(pos, quat, new THREE.Vector3());

    // Apply paddle offset from controller grip
    // Rotate paddle so it's angled like holding a real paddle
    const paddleOffset = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-Math.PI / 4, 0, 0)
    );
    quat.multiply(paddleOffset);

    this.updatePosition(pos, quat);
  }

  updateFromMouse(mouseX, mouseY, camera) {
    // Convert mouse position to world coordinates on a plane at paddle height
    const targetY = C.TABLE_HEIGHT + 0.15;
    const targetX = (mouseX - 0.5) * 2 * 1.0; // Map to ~±1m range
    const targetZ = C.TABLE_LENGTH / 2 + 0.1 - (mouseY * 0.6); // Forward/back based on Y

    const pos = new THREE.Vector3(targetX, targetY + mouseY * 0.3, targetZ);

    // Tilt paddle based on mouse movement (simulates wrist angle)
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-0.3 - mouseY * 0.5, mouseX * 0.3, 0)
    );

    this.updatePosition(pos, quat);
  }

  updatePosition(pos, quat) {
    // Store previous for velocity calculation
    this.prevPosition.copy(this.position);
    this.position.copy(pos);
    this.quaternion.copy(quat);

    // Update mesh
    this.mesh.position.copy(pos);
    this.mesh.quaternion.copy(quat);

    // Track position history for velocity smoothing
    this.posHistory.push({
      pos: pos.clone(),
      time: performance.now(),
    });
    if (this.posHistory.length > this.maxHistoryLength) {
      this.posHistory.shift();
    }
  }

  getSmoothedVelocity() {
    if (this.posHistory.length < 2) {
      return { x: 0, y: 0, z: 0 };
    }

    const newest = this.posHistory[this.posHistory.length - 1];
    const oldest = this.posHistory[0];
    const dt = (newest.time - oldest.time) / 1000;

    if (dt < 0.001) return { x: 0, y: 0, z: 0 };

    return {
      x: (newest.pos.x - oldest.pos.x) / dt,
      y: (newest.pos.y - oldest.pos.y) / dt,
      z: (newest.pos.z - oldest.pos.z) / dt,
    };
  }

  getCollisionData() {
    return {
      pos: { x: this.position.x, y: this.position.y, z: this.position.z },
      quat: { x: this.quaternion.x, y: this.quaternion.y, z: this.quaternion.z, w: this.quaternion.w },
      vel: this.getSmoothedVelocity(),
    };
  }
}
