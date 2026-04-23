export const gameEngine = {
  state: {
    hudVisible: true,
    initialized: false,
  },

  toggleHUD() {
    this.state.hudVisible = !this.state.hudVisible;
    window.dispatchEvent(new CustomEvent("hudToggle", {
      detail: this.state.hudVisible
    }));
  },

  init() {
    if (this.state.initialized) return;
    this.state.initialized = true;

    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "h" || e.key === "Tab") {
        e.preventDefault();
        this.toggleHUD();
      }
    });
  }
};
