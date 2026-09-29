/**
 * theme/index.js
 *
 * Re-exports the theme system.
 * New code should import from "src/theme" (this file).
 * Old code importing from "src/theme.js" still works.
 */
export { buildT, ThemeProvider, useTheme } from "../theme.jsx";
