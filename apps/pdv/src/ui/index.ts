export const uiLayer = {
  name: "ui",
  responsibility: "Render the keyboard-first desktop shell with Rayzen visual primitives."
} as const;

export { mountPdvShell } from "./renderer.js";
export {
  applyShellTheme,
  getPreferredFocusSelector,
  renderShell
} from "./view.js";
