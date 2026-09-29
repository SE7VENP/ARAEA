/**
 * Barrel file — re-export everything from constants/
 *
 * Usage:  import { MOODS, SCENES, NAV, API } from "@/constants";
 * or:     import { MOODS } from "../constants/emotions.js";
 */
export * from "./emotions.js";
export * from "./scenes.js";
export * from "./navigation.js";

/** Backend base URL — single source of truth */
export const API = "http://127.0.0.1:3001";
