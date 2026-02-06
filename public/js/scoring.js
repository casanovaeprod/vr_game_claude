import * as C from './constants.js';

export class ScoringSystem {
  constructor() {
    this.playerScore = 0;
    this.aiScore = 0;
    this.server = 'player'; // who is serving
    this.servesInRound = 0;
    this.servesPerRound = 2;
    this.gameOver = false;
    this.winner = null;

    this.scoreBoardEl = document.getElementById('scoreBoard');
    this.messageEl = document.getElementById('gameMessage');

    this.updateDisplay();
  }

  reset() {
    this.playerScore = 0;
    this.aiScore = 0;
    this.server = 'player';
    this.servesInRound = 0;
    this.gameOver = false;
    this.winner = null;
    this.updateDisplay();
    this.hideMessage();
  }

  pointScored(scorer) {
    if (this.gameOver) return;

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
    if (this.scoreBoardEl) {
      const serverIcon = this.server === 'player' ? ' *' : '';
      const aiServerIcon = this.server === 'ai' ? '* ' : '';
      this.scoreBoardEl.textContent = `${aiServerIcon}AI  ${this.aiScore} - ${this.playerScore}  You${serverIcon}`;
    }
  }

  showMessage(text, duration = 2000) {
    if (this.messageEl) {
      this.messageEl.textContent = text;
      this.messageEl.classList.add('visible');
      if (duration > 0) {
        setTimeout(() => this.hideMessage(), duration);
      }
    }
  }

  hideMessage() {
    if (this.messageEl) {
      this.messageEl.classList.remove('visible');
    }
  }
}
