# VR Table Tennis

A realistic table tennis game built with Three.js and WebXR, designed for Oculus Quest 3 browser VR mode.

## Features

- **WebXR VR Support**: Full immersive VR mode with controller tracking on Oculus Quest 3
- **Realistic Physics**: Ball spin (Magnus effect), air resistance, proper bounce mechanics
- **AI Opponent**: Adaptive AI that tracks and returns the ball with configurable difficulty
- **Regulation Table**: ITTF-standard table dimensions (2.74m x 1.525m at 0.76m height)
- **Scoring System**: Standard table tennis rules - first to 11, win by 2, alternating serves
- **Sound Effects**: Procedural audio for ball bounces, paddle hits, and scoring
- **Screen Mode**: Playable with mouse/touch when no VR headset is available

## Quick Start

```bash
npm install
npm start
```

Then open `http://localhost:3000` in your browser.

### Playing in VR (Oculus Quest 3)

1. Start the server on your local network
2. Open the URL in the Quest 3 browser
3. Click "Enter VR" to start immersive mode
4. Use the right controller as your paddle
5. Squeeze the trigger to serve

### Playing on Screen

1. Click "Play on Screen"
2. Move your mouse to control the paddle
3. Click to serve

## Controls

| Mode | Paddle Control | Serve |
|------|---------------|-------|
| VR | Right controller | Squeeze trigger |
| Screen | Mouse movement | Click |

## Architecture

- `public/js/main.js` - Game loop, WebXR session management, input handling
- `public/js/physics.js` - Ball physics, collision detection, spin mechanics
- `public/js/scene.js` - 3D scene construction (table, room, lighting)
- `public/js/paddle.js` - Paddle mesh and controller/mouse input mapping
- `public/js/ball.js` - Ball rendering and trail effects
- `public/js/ai.js` - AI opponent behavior and difficulty scaling
- `public/js/audio.js` - Procedural sound effect generation
- `public/js/scoring.js` - Score tracking and game rules
- `public/js/constants.js` - All game constants and dimensions

## Tech Stack

- **Three.js 0.160** - 3D rendering (loaded via CDN import map)
- **WebXR Device API** - VR headset integration
- **Web Audio API** - Procedural sound effects
- **Express** - Static file server
