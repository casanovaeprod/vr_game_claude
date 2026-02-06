import * as C from './constants.js';

export class ScoringSystem {
  constructor() {
    this.playerScore = 0;
    this.aiScore = 0;
    this.server = 'player';
    this.servesInRound = 0;
    this.servesPerRound = 2;
    this.gameOver = false;
    this.winner = null;

    // Rally tracking
    this.currentRally = 0;
    this.longestRally = 0;
    this.totalRallies = 0;
    this.topBallSpeed = 0; // m/s

    // DOM elements
    this.aiScoreEl = document.getElementById('aiScore');
    this.playerScoreEl = document.getElementById('playerScore');
    this.aiServeDot = document.getElementById('aiServeDot');
    this.playerServeDot = document.getElementById('playerServeDot');
    this.messageEl = document.getElementById('gameMessage');
    this.rallyCountEl = document.getElementById('rallyCount');
    this.rallyCounterEl = document.getElementById('rallyCounter');
    this.speedEl = document.getElementById('ballSpeed');
    this.speedIndicatorEl = document.getElementById('speedIndicator');
    this.gameHudEl = document.getElementById('gameHud');

    this.messageTimer = null;
    this.updateDisplay();
  }

  reset() {
    this.playerScore = 0;
    this.aiScore = 0;
    this.server = 'player';
    this.servesInRound = 0;
    this.gameOver = false;
    this.winner = null;
    this.currentRally = 0;
    this.longestRally = 0;
    this.totalRallies = 0;
    this.topBallSpeed = 0;
    this.updateDisplay();
    this.hideMessage();
  }

  incrementRally() {
    this.currentRally++;
    if (this.currentRally > this.longestRally) {
      this.longestRally = this.currentRally;
    }
    if (this.rallyCountEl) {
      this.rallyCountEl.textContent = this.currentRally;
    }
    if (this.rallyCounterEl && this.currentRally >= 2) {
      this.rallyCounterEl.classList.add('active');
    }
  }

  endRally() {
    if (this.currentRally > 0) {
      this.totalRallies++;
    }
    this.currentRally = 0;
    if (this.rallyCounterEl) {
      this.rallyCounterEl.classList.remove('active');
    }
  }

  updateBallSpeed(speedMs) {
    const speedKmh = speedMs * 3.6;
    if (speedMs > this.topBallSpeed) {
      this.topBallSpeed = speedMs;
    }
    if (this.speedEl) {
      this.speedEl.textContent = Math.round(speedKmh);
    }
    if (this.speedIndicatorEl && speedKmh > 5) {
      this.speedIndicatorEl.classList.add('active');
    }
  }

  pointScored(scorer) {
    if (this.gameOver) return;

    this.endRally();

    if (scorer === 'player') {
      this.playerScore++;
    } else {
      this.aiScore++;
    }

    // Switch server every 2 serves (or every serve at deuce)
    this.servesInRound++;
    const atDeuce = this.playerScore >= C.WINNING_SCORE - 1 &&
                    this.aiScore >= C.WINNING_SCORE - 1;
    const switchEvery = atDeuce ? 1 : this.servesPerRound;

    if (this.servesInRound >= switchEvery) {
      this.server = this.server === 'player' ? 'ai' : 'player';
      this.servesInRound = 0;
    }

    // Check for game over
    const maxScore = Math.max(this.playerScore, this.aiScore);
    const minScore = Math.min(this.playerScore, this.aiScore);

    if (maxScore >= C.WINNING_SCORE && maxScore - minScore >= C.MIN_LEAD) {
      this.gameOver = true;
      this.winner = this.playerScore > this.aiScore ? 'player' : 'ai';
    }

    this.updateDisplay();
    return { server: this.server, gameOver: this.gameOver, winner: this.winner };
  }

  updateDisplay() {
    if (this.aiScoreEl) {
      this.aiScoreEl.textContent = this.aiScore;
    }
    if (this.playerScoreEl) {
      this.playerScoreEl.textContent = this.playerScore;
    }
    // Serve dots
    if (this.aiServeDot) {
      this.aiServeDot.classList.toggle('active', this.server === 'ai');
    }
    if (this.playerServeDot) {
      this.playerServeDot.classList.toggle('active', this.server === 'player');
    }
  }

  showHud() {
    if (this.gameHudEl) {
      this.gameHudEl.classList.add('active');
    }
  }

  hideHud() {
    if (this.gameHudEl) {
      this.gameHudEl.classList.remove('active');
    }
    if (this.speedIndicatorEl) {
      this.speedIndicatorEl.classList.remove('active');
    }
    if (this.rallyCounterEl) {
      this.rallyCounterEl.classList.remove('active');
    }
  }

  showMessage(text, duration = 2000, type = '') {
    if (this.messageEl) {
      // Clear previous classes
      this.messageEl.className = '';
      this.messageEl.textContent = text;
      this.messageEl.classList.add('visible');
      if (type) {
        this.messageEl.classList.add(type);
      }

      if (this.messageTimer) {
        clearTimeout(this.messageTimer);
        this.messageTimer = null;
      }

      if (duration > 0) {
        this.messageTimer = setTimeout(() => this.hideMessage(), duration);
      }
    }
  }

  hideMessage() {
    if (this.messageEl) {
      this.messageEl.classList.remove('visible');
    }
  }

  getStats() {
    return {
      longestRally: this.longestRally,
      topSpeed: Math.round(this.topBallSpeed * 3.6),
      totalRallies: this.totalRallies,
      playerScore: this.playerScore,
      aiScore: this.aiScore,
      winner: this.winner,
    };
  }
}
