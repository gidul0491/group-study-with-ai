import { configure } from "som-style/solid";

// Loads defineTheme (palette CSS + theme handles).
import "./theme.js";

configure({
  breakpoints: {
    pc: "1024px",
  },
  // Wrap rules in @layer som.base / som.<breakpoint> so breakpoint precedence
  // survives being merged with other stylesheets. Note: layered CSS always
  // loses to unlayered CSS, so a plain reset would start winning.
  // cascadeLayers: true,
});
