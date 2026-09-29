/**
 * useBreakpoint
 *
 * Reactively tracks window width and returns a breakpoint name.
 * Uses a passive resize listener — no throttle needed for this granularity.
 *
 * Breakpoints:
 *   mobile  — < 768 px  (phones, narrow viewports)
 *   tablet  — 768–1099 px (tablets, small laptops)
 *   desktop — ≥ 1100 px  (standard dashboard width)
 */
import { useState, useEffect } from "react";

function getBreakpoint() {
  const w = window.innerWidth;
  if (w < 768)  return "mobile";
  if (w < 1100) return "tablet";
  return "desktop";
}

export function useBreakpoint() {
  const [bp, setBp] = useState(getBreakpoint);
  useEffect(() => {
    const handler = () => setBp(getBreakpoint());
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);
  return bp;
}
