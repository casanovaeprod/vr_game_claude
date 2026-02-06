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
    this.maxHistoryLength = 8;

    // Mouse swing tracking for screen mode
    this.mouseVelX = 0;
    this.mouseVelY = 0;
    this.prevMouseX = 0.5;
    this.prevMouseY = 0.5;
    this.lastMouseTime = performance.now();

    // Default position
    if (isPlayer) {
      this.mesh.position.set(0, C.TABLE_HEIGHT + 0.2, C.TABLE_LENGTH / 2 + 0.15);
    } else {
      this.mesh.position.set(0, C.TABLE_HEIGHT + 0.2, -C.TABLE_LENGTH / 2 - 0.15);
    }
  }

  createPaddleMesh() {
    const group = new THREE.Group();

    // --- Paddle blade ---
    // We build the blade so its LOCAL coordinate system has:
    //   +Y = face normal (the red rubber side faces +Y)
    //   -Y = back side (black rubber)
    // The blade is a thin cylinder along Y.

    const bladeRadius = C.PADDLE_RADIUS;
    const bladeThick = C.PADDLE_THICKNESS;

    // Create two separate discs for front (red) and back (black) rubber
    // Plus a thin cylindrical edge (wood)

    // Front face (red rubber) — a disc at +Y side
    const frontGeo = new THREE.CircleGeometry(bladeRadius, 32);
    const redMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.paddleRubberRed,
      roughness: 0.55,
      metalness: 0.0,
    });
    const frontFace = new THREE.Mesh(frontGeo, redMat);
    frontFace.position.y = bladeThick / 2 + 0.0005;
    frontFace.rotation.x = -Math.PI / 2; // CircleGeometry faces +Z, rotate to face +Y
    frontFace.castShadow = true;
    group.add(frontFace);

    // Back face (black rubber) — a disc at -Y side
    const backGeo = new THREE.CircleGeometry(bladeRadius, 32);
    const blackMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.paddleRubberBlack,
      roughness: 0.55,
      metalness: 0.0,
    });
    const backFace = new THREE.Mesh(backGeo, blackMat);
    backFace.position.y = -(bladeThick / 2 + 0.0005);
    backFace.rotation.x = Math.PI / 2; // face -Y
    backFace.castShadow = true;
    group.add(backFace);

    // Blade core cylinder (wood visible on the edge)
    const coreGeo = new THREE.CylinderGeometry(bladeRadius, bladeRadius, bladeThick, 32, 1, true); // open-ended
    const woodMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.paddleWood,
      roughness: 0.65,
      metalness: 0.0,
    });
    const core = new THREE.Mesh(coreGeo, woodMat);
    core.castShadow = true;
    group.add(core);

    // Thin edge tape (slightly darker wood ring around the perimeter)
    const edgeGeo = new THREE.TorusGeometry(bladeRadius, 0.0025, 6, 32);
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x8B6914,
      roughness: 0.7,
    });
    const edgeTop = new THREE.Mesh(edgeGeo, edgeMat);
    edgeTop.rotation.x = Math.PI / 2;
    edgeTop.position.y = bladeThick / 2;
    group.add(edgeTop);
    const edgeBot = new THREE.Mesh(edgeGeo, edgeMat);
    edgeBot.rotation.x = Math.PI / 2;
    edgeBot.position.y = -bladeThick / 2;
    group.add(edgeBot);

    // --- Handle ---
    const handleLen = C.PADDLE_HANDLE_LENGTH;
    const handleRad = C.PADDLE_HANDLE_RADIUS;

    // Flared handle shape (slightly wider at the base)
    const handleGeo = new THREE.CylinderGeometry(
      handleRad * 0.9, handleRad * 1.1,
      handleLen, 8
    );
    const handle = new THREE.Mesh(handleGeo, woodMat);
    handle.position.y = -(bladeRadius * 0.68 + handleLen / 2);
    handle.castShadow = true;
    group.add(handle);

    // Grip wrap (textured rubber)
    const gripGeo = new THREE.CylinderGeometry(
      handleRad * 0.92 + 0.002, handleRad * 1.12 + 0.002,
      handleLen * 0.75, 8
    );
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.95,
      metalness: 0.0,
    });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.y = -(bladeRadius * 0.68 + handleLen / 2 + handleLen * 0.05);
    group.add(grip);

    // Butt cap at the end of the handle
    const capGeo = new THREE.SphereGeometry(handleRad * 1.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, woodMat);
    cap.rotation.x = Math.PI; // flip hemisphere to point down
    cap.position.y = -(bladeRadius * 0.68 + handleLen);
    group.add(cap);

    // --- Critical: Rotate the entire group so the paddle face points FORWARD (-Z for player) ---
    // By default the blade face normal is +Y (local). We need it to face -Z in world
    // when the paddle is in its neutral position. So rotate the group 90° around X.
    // This makes the red face point toward -Z (toward the opponent), handle points down.
    group.rotation.x = Math.PI / 2;

    // Wrap in an outer group so mesh.quaternion controls world orientation cleanly
    const wrapper = new THREE.Group();
    wrapper.add(group);

    return wrapper;
  }

  updateFromController(controller) {
    // Get controller world position and quaternion
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    controller.matrixWorld.decompose(pos, quat, new THREE.Vector3());

    // Apply paddle offset from controller grip
    // Tilt the paddle ~30° forward to simulate a natural penhold/shakehand grip angle
    const paddleOffset = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-Math.PI / 6, 0, 0)
    );
    quat.multiply(paddleOffset);

    this.updatePosition(pos, quat);
  }

  updateFromMouse(mouseX, mouseY, camera) {
    const now = performance.now();
    const mouseDt = (now - this.lastMouseTime) / 1000;
    this.lastMouseTime = now;

    // Track mouse velocity for swing detection
    if (mouseDt > 0 && mouseDt < 0.1) {
      this.mouseVelX = (mouseX - this.prevMouseX) / mouseDt;
      this.mouseVelY = (mouseY - this.prevMouseY) / mouseDt;
    }
    this.prevMouseX = mouseX;
    this.prevMouseY = mouseY;

    // Map mouse position to paddle world position
    // X: mouse 0..1 → paddle -0.75..+0.75m (covers table width)
    const targetX = (mouseX - 0.5) * 1.5;

    // Z: mouse Y 0(top)..1(bottom) → paddle closer/further from table
    // Moving mouse up = lean forward toward table, mouse down = back to player
    const targetZ = C.TABLE_LENGTH / 2 + 0.35 - (1.0 - mouseY) * 0.55;

    // Y: slight vertical variation — mouse at top = slightly higher
    const baseY = C.TABLE_HEIGHT + 0.18;
    const targetY = baseY + (1.0 - mouseY) * 0.15;

    const pos = new THREE.Vector3(targetX, targetY, targetZ);

    // Paddle angle reacts to mouse movement to create a natural "swing" feel
    // Base tilt: paddle face angled slightly downward (like a real ready position)
    const basePitch = -0.25;

    // Dynamic tilt from mouse velocity (moving mouse up = forward swing = more tilt)
    const swingTilt = THREE.MathUtils.clamp(-this.mouseVelY * 0.15, -0.5, 0.5);

    // Horizontal angle from mouse X velocity (wrist rotation)
    const wristYaw = THREE.MathUtils.clamp(-this.mouseVelX * 0.08, -0.3, 0.3);

    // Side tilt from horizontal position (slight wrist angle at extremes)
    const wristRoll = -(mouseX - 0.5) * 0.15;

    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(basePitch + swingTilt, wristYaw, wristRoll)
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

    // Use a weighted average of recent velocity samples for smoother result
    let vx = 0, vy = 0, vz = 0;
    let totalWeight = 0;

    for (let i = 1; i < this.posHistory.length; i++) {
      const curr = this.posHistory[i];
      const prev = this.posHistory[i - 1];
      const dt = (curr.time - prev.time) / 1000;
      if (dt < 0.0001) continue;

      // More recent samples get higher weight
      const weight = i;
      vx += ((curr.pos.x - prev.pos.x) / dt) * weight;
      vy += ((curr.pos.y - prev.pos.y) / dt) * weight;
      vz += ((curr.pos.z - prev.pos.z) / dt) * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return { x: 0, y: 0, z: 0 };

    return {
      x: vx / totalWeight,
      y: vy / totalWeight,
      z: vz / totalWeight,
    };
  }

  getCollisionData() {
    // The paddle's face normal in world space.
    // The inner group is pre-rotated so that local +Y becomes the face normal.
    // The outer wrapper's quaternion then transforms this into world space.
    // So we need to rotate the (0,1,0) vector by the wrapper's world quaternion.
    const normal = new THREE.Vector3(0, 1, 0);

    // Get the full world quaternion (includes inner group rotation + wrapper quaternion)
    const worldQuat = new THREE.Quaternion();
    this.mesh.getWorldQuaternion(worldQuat);

    // But the inner group pre-rotation (90° around X) maps +Y → -Z.
    // So the actual face normal in local paddle-group space after pre-rotation is -Z,
    // but in the mesh world space we need to account for this.
    // Actually, let's just compute it from the mesh's world matrix directly.
    // The inner group rotates +Y → -Z. Then the wrapper's quaternion rotates that.
    const innerRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const combinedQuat = this.quaternion.clone().multiply(innerRotation);
    normal.set(0, 1, 0).applyQuaternion(combinedQuat);

    return {
      pos: { x: this.position.x, y: this.position.y, z: this.position.z },
      quat: { x: combinedQuat.x, y: combinedQuat.y, z: combinedQuat.z, w: combinedQuat.w },
      normal: { x: normal.x, y: normal.y, z: normal.z },
      vel: this.getSmoothedVelocity(),
    };
  }
}
