import * as THREE from 'three';
import * as C from './constants.js';

export class GameScene {
  constructor(scene) {
    this.scene = scene;
    this.build();
  }

  build() {
    this.createRoom();
    this.createTable();
    this.createNet();
    this.createLighting();
  }

  createRoom() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(C.ROOM_WIDTH, C.ROOM_LENGTH);
    const floorMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.floor,
      roughness: 0.8,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Floor line markings (like a sports hall)
    const lineGeo = new THREE.PlaneGeometry(0.05, C.ROOM_LENGTH);
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x555566 });
    for (let x = -3; x <= 3; x += 1.5) {
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.001, 0);
      this.scene.add(line);
    }

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.walls,
      roughness: 0.9,
    });

    // Back wall (behind AI)
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(C.ROOM_WIDTH, C.ROOM_HEIGHT),
      wallMat
    );
    backWall.position.set(0, C.ROOM_HEIGHT / 2, -C.ROOM_LENGTH / 2);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Front wall (behind player)
    const frontWall = new THREE.Mesh(
      new THREE.PlaneGeometry(C.ROOM_WIDTH, C.ROOM_HEIGHT),
      wallMat
    );
    frontWall.position.set(0, C.ROOM_HEIGHT / 2, C.ROOM_LENGTH / 2);
    frontWall.rotation.y = Math.PI;
    frontWall.receiveShadow = true;
    this.scene.add(frontWall);

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(C.ROOM_LENGTH, C.ROOM_HEIGHT),
      wallMat
    );
    leftWall.position.set(-C.ROOM_WIDTH / 2, C.ROOM_HEIGHT / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(C.ROOM_LENGTH, C.ROOM_HEIGHT),
      wallMat
    );
    rightWall.position.set(C.ROOM_WIDTH / 2, C.ROOM_HEIGHT / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    // Ceiling
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(C.ROOM_WIDTH, C.ROOM_LENGTH),
      new THREE.MeshStandardMaterial({ color: C.COLORS.ceiling, roughness: 0.95 })
    );
    ceiling.position.y = C.ROOM_HEIGHT;
    ceiling.rotation.x = Math.PI / 2;
    this.scene.add(ceiling);
  }

  createTable() {
    const halfL = C.TABLE_LENGTH / 2;
    const halfW = C.TABLE_WIDTH / 2;
    const tableY = C.TABLE_HEIGHT;

    // Table top
    const topGeo = new THREE.BoxGeometry(C.TABLE_WIDTH, C.TABLE_THICKNESS, C.TABLE_LENGTH);
    const topMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.tableTop,
      roughness: 0.4,
      metalness: 0.05,
    });
    const tableTop = new THREE.Mesh(topGeo, topMat);
    tableTop.position.set(0, tableY + C.TABLE_THICKNESS / 2, 0);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    this.scene.add(tableTop);

    // Table lines (white border and center line)
    const lineMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.tableLine,
      roughness: 0.3,
    });
    const lineHeight = 0.001;
    const lineY = tableY + C.TABLE_THICKNESS + lineHeight / 2;

    // Border lines
    const lineWidth = 0.02;

    // Long sides
    for (const side of [-1, 1]) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(lineWidth, lineHeight, C.TABLE_LENGTH),
        lineMat
      );
      line.position.set(side * halfW, lineY, 0);
      this.scene.add(line);
    }

    // Short sides
    for (const end of [-1, 1]) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(C.TABLE_WIDTH, lineHeight, lineWidth),
        lineMat
      );
      line.position.set(0, lineY, end * halfL);
      this.scene.add(line);
    }

    // Center line (lengthwise, for doubles but we include it for authenticity)
    const centerLine = new THREE.Mesh(
      new THREE.BoxGeometry(lineWidth, lineHeight, C.TABLE_LENGTH),
      lineMat
    );
    centerLine.position.set(0, lineY, 0);
    this.scene.add(centerLine);

    // Halfway line (across the width at the net)
    const halfLine = new THREE.Mesh(
      new THREE.BoxGeometry(C.TABLE_WIDTH, lineHeight, lineWidth),
      lineMat
    );
    halfLine.position.set(0, lineY, 0);
    this.scene.add(halfLine);

    // Table legs
    const legGeo = new THREE.BoxGeometry(C.TABLE_LEG_SIZE, tableY, C.TABLE_LEG_SIZE);
    const legMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.tableLegs,
      roughness: 0.6,
      metalness: 0.3,
    });

    const legOffsetX = halfW - 0.1;
    const legOffsetZ = halfL - 0.15;
    const legPositions = [
      [-legOffsetX, tableY / 2, -legOffsetZ],
      [legOffsetX, tableY / 2, -legOffsetZ],
      [-legOffsetX, tableY / 2, legOffsetZ],
      [legOffsetX, tableY / 2, legOffsetZ],
    ];

    for (const [x, y, z] of legPositions) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, y, z);
      leg.castShadow = true;
      this.scene.add(leg);
    }

    // Under-table support beam
    const beamGeo = new THREE.BoxGeometry(C.TABLE_WIDTH - 0.2, 0.04, 0.04);
    const beam1 = new THREE.Mesh(beamGeo, legMat);
    beam1.position.set(0, tableY * 0.5, -legOffsetZ);
    this.scene.add(beam1);
    const beam2 = new THREE.Mesh(beamGeo, legMat);
    beam2.position.set(0, tableY * 0.5, legOffsetZ);
    this.scene.add(beam2);
  }

  createNet() {
    const halfW = C.TABLE_WIDTH / 2 + C.NET_OVERHANG;
    const netBottom = C.TABLE_HEIGHT + C.TABLE_THICKNESS / 2;
    const netTop = netBottom + C.NET_HEIGHT;
    const netMidY = (netBottom + netTop) / 2;

    // Net mesh (slightly transparent)
    const netGeo = new THREE.PlaneGeometry(halfW * 2, C.NET_HEIGHT);
    const netMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.net,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    const net = new THREE.Mesh(netGeo, netMat);
    net.position.set(0, netMidY, 0);
    this.scene.add(net);

    // Net top cord (white line along the top)
    const cordGeo = new THREE.CylinderGeometry(0.003, 0.003, halfW * 2, 8);
    const cordMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const cord = new THREE.Mesh(cordGeo, cordMat);
    cord.rotation.z = Math.PI / 2;
    cord.position.set(0, netTop, 0);
    this.scene.add(cord);

    // Net posts
    const postGeo = new THREE.CylinderGeometry(0.01, 0.01, C.NET_HEIGHT + 0.02, 8);
    const postMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.netPost,
      roughness: 0.4,
      metalness: 0.6,
    });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(side * halfW, netMidY, 0);
      post.castShadow = true;
      this.scene.add(post);

      // Post clamp
      const clampGeo = new THREE.BoxGeometry(0.04, 0.02, 0.03);
      const clamp = new THREE.Mesh(clampGeo, postMat);
      clamp.position.set(side * halfW, netBottom - 0.01, 0);
      this.scene.add(clamp);
    }
  }

  createLighting() {
    // Ambient light (soft fill)
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(ambient);

    // Main overhead light (like a sports hall)
    const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
    mainLight.position.set(0, C.ROOM_HEIGHT - 0.2, 0);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.1;
    mainLight.shadow.camera.far = 10;
    mainLight.shadow.camera.left = -3;
    mainLight.shadow.camera.right = 3;
    mainLight.shadow.camera.top = 3;
    mainLight.shadow.camera.bottom = -3;
    mainLight.shadow.bias = -0.001;
    this.scene.add(mainLight);

    // Secondary fill light from player side
    const fillLight = new THREE.PointLight(0xd4e4ff, 0.4, 8);
    fillLight.position.set(2, 2.5, 3);
    this.scene.add(fillLight);

    // Back fill from the AI side (subtle, reduces harsh shadows)
    const backFill = new THREE.PointLight(0xc8d8ff, 0.25, 6);
    backFill.position.set(-1, 2.0, -3);
    this.scene.add(backFill);

    // Overhead fluorescent panels (visual only)
    const panelGeo = new THREE.BoxGeometry(0.3, 0.02, 1.2);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff8e8,
      emissiveIntensity: 0.8,
    });
    for (const x of [-1.5, 1.5]) {
      for (const z of [-1.5, 1.5]) {
        const panel = new THREE.Mesh(panelGeo, panelMat);
        panel.position.set(x, C.ROOM_HEIGHT - 0.01, z);
        this.scene.add(panel);
      }
    }
  }
}
