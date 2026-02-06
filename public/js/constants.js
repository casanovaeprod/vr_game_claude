// All measurements in meters (real-world scale)

// Table dimensions (ITTF regulation)
export const TABLE_LENGTH = 2.74;
export const TABLE_WIDTH = 1.525;
export const TABLE_HEIGHT = 0.76;
export const TABLE_THICKNESS = 0.03;
export const TABLE_LEG_SIZE = 0.05;

// Net
export const NET_HEIGHT = 0.1525;
export const NET_OVERHANG = 0.1525; // extends beyond table on each side

// Ball (40mm diameter)
export const BALL_RADIUS = 0.02;
export const BALL_MASS = 0.0027; // 2.7 grams

// Paddle
export const PADDLE_RADIUS = 0.08;
export const PADDLE_THICKNESS = 0.015;
export const PADDLE_HANDLE_LENGTH = 0.10;
export const PADDLE_HANDLE_RADIUS = 0.015;

// Physics
export const GRAVITY = -9.81;
export const TABLE_RESTITUTION = 0.85;
export const PADDLE_RESTITUTION = 0.88;
export const NET_RESTITUTION = 0.2;
export const AIR_RESISTANCE = 0.0005;
export const MAGNUS_COEFFICIENT = 0.0004;
export const BALL_MAX_SPEED = 25;
export const SPIN_DECAY = 0.995;

// Game
export const WINNING_SCORE = 11;
export const MIN_LEAD = 2;
export const SERVE_POSITION_PLAYER = { x: 0, y: TABLE_HEIGHT + 0.3, z: TABLE_LENGTH / 2 + 0.3 };
export const SERVE_POSITION_AI = { x: 0, y: TABLE_HEIGHT + 0.3, z: -TABLE_LENGTH / 2 - 0.3 };

// Room
export const ROOM_WIDTH = 8;
export const ROOM_LENGTH = 10;
export const ROOM_HEIGHT = 3.5;

// Player position (standing at the end of the table)
export const PLAYER_POSITION = { x: 0, y: 0, z: TABLE_LENGTH / 2 + 0.5 };

// Colors
export const COLORS = {
  tableTop: 0x1a5276,
  tableLine: 0xffffff,
  tableLegs: 0x2c3e50,
  net: 0xeeeeee,
  netPost: 0x555555,
  ball: 0xffffff,
  paddleRubberRed: 0xcc2222,
  paddleRubberBlack: 0x222222,
  paddleWood: 0xc4a35a,
  floor: 0x3a3a4a,
  walls: 0x2a2a3a,
  ceiling: 0x252535,
};
