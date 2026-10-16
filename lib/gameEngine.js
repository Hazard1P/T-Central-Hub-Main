import { shouldIgnoreFlightKey } from './flightInput.js';

function handleHudShortcut(event) {
  if (event.repeat || event.ctrlKey || shouldIgnoreFlightKey(event)) return;
  if (event.key?.toLowerCase() === 'h') {
    event.preventDefault();
    gameEngine.toggleHUD();
  }
}

export const gameEngine = {
  state: { hudVisible: true, initialized: false },

  setHUDVisible(visible) {
    this.state.hudVisible = Boolean(visible);
    window.dispatchEvent(new CustomEvent('hudToggle', { detail: this.state.hudVisible }));
  },

  toggleHUD() { this.setHUDVisible(!this.state.hudVisible); },

  init() {
    if (this.state.initialized) return;
    this.state.initialized = true;
    window.addEventListener('keydown', handleHudShortcut);
    this.setHUDVisible(true);
  },

  destroy() {
    window.removeEventListener('keydown', handleHudShortcut);
    this.state.initialized = false;
    this.setHUDVisible(true);
  },
};
