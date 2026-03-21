// Browser-safe theme tokens for the file:// renderer bundle.
export const rayzenShellTheme = {
  colorCanvas: "#17130f",
  colorPanel: "#211a14",
  colorPanelAlt: "#2a211a",
  colorPanelRaised: "#35291f",
  colorBorder: "#584638",
  colorAccent: "#de7e4b",
  colorAccentSoft: "#f2bc67",
  colorSuccess: "#7cc790",
  colorWarning: "#edc15f",
  colorDanger: "#e37772",
  colorText: "#f5ead5",
  colorMuted: "#baa58c",
  colorShadow: "rgba(0, 0, 0, 0.32)",
  fontSans: "\"Bahnschrift\", \"Segoe UI\", sans-serif",
  fontMono: "\"Cascadia Mono\", \"Consolas\", monospace",
  radiusPanel: "24px",
  radiusChip: "999px"
} as const;

export function createShellThemeCssVariables(
  theme: typeof rayzenShellTheme = rayzenShellTheme
): ReadonlyArray<readonly [string, string]> {
  return Object.entries(theme).map(([token, value]) => {
    return [`--rayzen-${token}`, value] as const;
  });
}
