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
    this.createDecorations();
  }

  createRoom() {
    // Floor - sport court style with wood texture look
    const floorGeo = new THREE.PlaneGeometry(C.ROOM_WIDTH, C.ROOM_LENGTH);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x4a3a2a,
      roughness: 0.6,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Floor court boundary lines
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x665544, roughness: 0.5 });
    const courtLines = [
      // Outer boundary
      { w: 0.03, h: C.ROOM_LENGTH * 0.7, x: -2.5, z: 0 },
      { w: 0.03, h: C.ROOM_LENGTH * 0.7, x: 2.5, z: 0 },
      { w: 5, h: 0.03, x: 0, z: -C.ROOM_LENGTH * 0.35 },
      { w: 5, h: 0.03, x: 0, z: C.ROOM_LENGTH * 0.35 },
    ];
    courtLines.forEach(l => {
      const geo = new THREE.PlaneGeometry(l.w, l.h);
      const mesh = new THREE.Mesh(geo, lineMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(l.x, 0.001, l.z);
      this.scene.add(mesh);
    });

    // Walls with slight color variation
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a3a,
      roughness: 0.85,
    });
    const darkWallMat = new THREE.MeshStandardMaterial({
      color: 0x222233,
      roughness: 0.9,
    });

    // Back wall (behind AI)
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(C.ROOM_WIDTH, C.ROOM_HEIGHT),
      darkWallMat
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

    // Baseboard / wall trim
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1a1a28, roughness: 0.7 });
    const trimHeight = 0.08;
    const trimGeo = new THREE.BoxGeometry(C.ROOM_WIDTH, trimHeight, 0.02);
    [[-C.ROOM_LENGTH / 2, 0], [C.ROOM_LENGTH / 2, Math.PI]].forEach(([z, ry]) => {
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(0, trimHeight / 2, z);
      trim.rotation.y = ry;
      this.scene.add(trim);
    });
    const trimGeoSide = new THREE.BoxGeometry(0.02, trimHeight, C.ROOM_LENGTH);
    [-C.ROOM_WIDTH / 2, C.ROOM_WIDTH / 2].forEach(x => {
      const trim = new THREE.Mesh(trimGeoSide, trimMat);
      trim.position.set(x, trimHeight / 2, 0);
      this.scene.add(trim);
    });
  }

  createTable() {
    const halfL = C.TABLE_LENGTH / 2;
    const halfW = C.TABLE_WIDTH / 2;
    const tableY = C.TABLE_HEIGHT;

    // Table top
    const topGeo = new THREE.BoxGeometry(C.TABLE_WIDTH, C.TABLE_THICKNESS, C.TABLE_LENGTH);
    const topMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.tableTop,
      roughness: 0.35,
      metalness: 0.05,
    });
    const tableTop = new THREE.Mesh(topGeo, topMat);
    tableTop.position.set(0, tableY + C.TABLE_THICKNESS / 2, 0);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    this.scene.add(tableTop);

    // Table lines
    const lineMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.tableLine,
      roughness: 0.3,
    });
    const lineHeight = 0.001;
    const lineY = tableY + C.TABLE_THICKNESS + lineHeight / 2;
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

    // Center line (lengthwise)
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

    // Table legs with chamfered edges
    const legGeo = new THREE.BoxGeometry(C.TABLE_LEG_SIZE, tableY, C.TABLE_LEG_SIZE);
    const legMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.tableLegs,
      roughness: 0.5,
      metalness: 0.4,
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

      // Foot pad
      const footGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.01, 8);
      const footMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
      const foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(x, 0.005, z);
      this.scene.add(foot);
    }

    // Under-table support beams
    const beamGeo = new THREE.BoxGeometry(C.TABLE_WIDTH - 0.2, 0.04, 0.04);
    const beam1 = new THREE.Mesh(beamGeo, legMat);
    beam1.position.set(0, tableY * 0.5, -legOffsetZ);
    this.scene.add(beam1);
    const beam2 = new THREE.Mesh(beamGeo, legMat);
    beam2.position.set(0, tableY * 0.5, legOffsetZ);
    this.scene.add(beam2);

    // Longitudinal beam
    const longBeamGeo = new THREE.BoxGeometry(0.04, 0.04, C.TABLE_LENGTH - 0.4);
    const longBeam = new THREE.Mesh(longBeamGeo, legMat);
    longBeam.position.set(0, tableY * 0.5, 0);
    this.scene.add(longBeam);
  }

  createNet() {
    const halfW = C.TABLE_WIDTH / 2 + C.NET_OVERHANG;
    const netBottom = C.TABLE_HEIGHT + C.TABLE_THICKNESS / 2;
    const netTop = netBottom + C.NET_HEIGHT;
    const netMidY = (netBottom + netTop) / 2;

    // Net mesh
    const netGeo = new THREE.PlaneGeometry(halfW * 2, C.NET_HEIGHT);
    const netMat = new THREE.MeshStandardMaterial({
      color: C.COLORS.net,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    const net = new THREE.Mesh(netGeo, netMat);
    net.position.set(0, netMidY, 0);
    this.scene.add(net);

    // Net top cord
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
      roughness: 0.3,
      metalness: 0.7,
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
    // Ambient light (slightly warmer)
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambient);

    // Hemisphere light for natural sky/ground lighting
    const hemiLight = new THREE.HemisphereLight(0xfff8e8, 0x303050, 0.3);
    this.scene.add(hemiLight);

    // Main overhead light
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
    const fillLight = new THREE.PointLight(0xd4e4ff, 0.35, 8);
    fillLight.position.set(2, 2.5, 3);
    this.scene.add(fillLight);

    // Back fill from the AI side
    const backFill = new THREE.PointLight(0xc8d8ff, 0.2, 6);
    backFill.position.set(-1, 2.0, -3);
    this.scene.add(backFill);

    // Overhead fluorescent panels
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

    // Accent spot light over the table
    const spotLight = new THREE.SpotLight(0xfff5e6, 0.4, 6, Math.PI / 6, 0.5, 1);
    spotLight.position.set(0, C.ROOM_HEIGHT - 0.1, 0);
    spotLight.target.position.set(0, C.TABLE_HEIGHT, 0);
    this.scene.add(spotLight);
    this.scene.add(spotLight.target);
  }

  createDecorations() {
    // Score board on back wall (decorative)
    const boardGeo = new THREE.BoxGeometry(1.2, 0.6, 0.03);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x111122,
      roughness: 0.3,
      metalness: 0.5,
    });
    const scoreboard = new THREE.Mesh(boardGeo, boardMat);
    scoreboard.position.set(0, 2.2, -C.ROOM_LENGTH / 2 + 0.02);
    this.scene.add(scoreboard);

    // Border frame for scoreboard
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.4, metalness: 0.6 });
    const frameWidth = 0.025;
    const fh = [
      { w: 1.25, h: frameWidth, x: 0, y: 2.2 + 0.3 },
      { w: 1.25, h: frameWidth, x: 0, y: 2.2 - 0.3 },
    ];
    fh.forEach(f => {
      const geo = new THREE.BoxGeometry(f.w, f.h, 0.04);
      const mesh = new THREE.Mesh(geo, frameMat);
      mesh.position.set(f.x, f.y, -C.ROOM_LENGTH / 2 + 0.02);
      this.scene.add(mesh);
    });
    const fv = [
      { w: frameWidth, h: 0.65, x: -0.625 },
      { w: frameWidth, h: 0.65, x: 0.625 },
    ];
    fv.forEach(f => {
      const geo = new THREE.BoxGeometry(f.w, f.h, 0.04);
      const mesh = new THREE.Mesh(geo, frameMat);
      mesh.position.set(f.x, 2.2, -C.ROOM_LENGTH / 2 + 0.02);
      this.scene.add(mesh);
    });

    // Ball basket near the table (decorative)
    const basketGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.06, 12, 1, true);
    const basketMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3a,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    const basket = new THREE.Mesh(basketGeo, basketMat);
    basket.position.set(C.TABLE_WIDTH / 2 + 0.3, C.TABLE_HEIGHT + 0.03, 0);
    this.scene.add(basket);

    // A few decorative balls in basket
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xffa500,
      roughness: 0.3,
      emissive: 0xffa500,
      emissiveIntensity: 0.02,
    });
    for (let i = 0; i < 3; i++) {
      const ballGeo = new THREE.SphereGeometry(C.BALL_RADIUS * 0.9, 12, 12);
      const ball = new THREE.Mesh(ballGeo, ballMat);
      ball.position.set(
        C.TABLE_WIDTH / 2 + 0.3 + (Math.random() - 0.5) * 0.04,
        C.TABLE_HEIGHT + 0.04 + i * 0.015,
        (Math.random() - 0.5) * 0.04
      );
      this.scene.add(ball);
    }

    // Wall accent stripe
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a5a,
      emissive: 0x0a2040,
      emissiveIntensity: 0.3,
    });
    const stripeGeo = new THREE.BoxGeometry(C.ROOM_WIDTH, 0.05, 0.01);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 1.2, -C.ROOM_LENGTH / 2 + 0.01);
    this.scene.add(stripe);
  }
}
