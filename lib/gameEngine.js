export const gameEngine = {
  state: {
    hudVisible: true,
    initialized: false,
  },

  setHUDVisible(visible) {
    this.state.hudVisible = Boolean(visible);
    window.dispatchEvent(new CustomEvent("hudToggle", {
      detail: this.state.hudVisible
    }));
  },

  toggleHUD() {
    this.setHUDVisible(!this.state.hudVisible);
  },

  init() {
    if (this.state.initialized) return;
    this.state.initialized = true;

    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "h") {
        e.preventDefault();
        this.toggleHUD();
      }
    });
  }
};
