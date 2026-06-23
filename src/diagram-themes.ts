import type { ThemeName } from "./diagram-model.js";

export type DiagramTheme = {
  readonly name: ThemeName;
  readonly nodeFill: readonly string[];
  readonly groupFill: string;
  readonly laneFill: string;
  readonly stroke: string;
  readonly text: string;
  readonly arrow: string;
  readonly fontSize: number;
  readonly strokeWidth: number;
  readonly roughness: number;
};

export const themes: Record<ThemeName, DiagramTheme> = {
  technical: {
    name: "technical",
    nodeFill: ["#e0f2fe", "#dcfce7", "#fef3c7", "#ede9fe"],
    groupFill: "#f8fafc",
    laneFill: "#eef2ff",
    stroke: "#1e293b",
    text: "#0f172a",
    arrow: "#334155",
    fontSize: 20,
    strokeWidth: 2,
    roughness: 1
  },
  executive: {
    name: "executive",
    nodeFill: ["#eff6ff", "#f0fdf4", "#fff7ed", "#faf5ff"],
    groupFill: "#ffffff",
    laneFill: "#f8fafc",
    stroke: "#334155",
    text: "#111827",
    arrow: "#475569",
    fontSize: 19,
    strokeWidth: 2,
    roughness: 0
  },
  handdrawn: {
    name: "handdrawn",
    nodeFill: ["#fef9c3", "#dbeafe", "#dcfce7", "#fee2e2"],
    groupFill: "#fffbeb",
    laneFill: "#fefce8",
    stroke: "#292524",
    text: "#1c1917",
    arrow: "#44403c",
    fontSize: 20,
    strokeWidth: 2,
    roughness: 2
  },
  minimal: {
    name: "minimal",
    nodeFill: ["#ffffff", "#f8fafc", "#f1f5f9", "#e2e8f0"],
    groupFill: "#ffffff",
    laneFill: "#f8fafc",
    stroke: "#475569",
    text: "#0f172a",
    arrow: "#64748b",
    fontSize: 18,
    strokeWidth: 1,
    roughness: 0
  },
  "system-architecture": {
    name: "system-architecture",
    nodeFill: ["#dbeafe", "#dcfce7", "#fef3c7", "#fce7f3"],
    groupFill: "#f8fafc",
    laneFill: "#ecfeff",
    stroke: "#075985",
    text: "#082f49",
    arrow: "#0369a1",
    fontSize: 19,
    strokeWidth: 2,
    roughness: 1
  },
  "incident-response": {
    name: "incident-response",
    nodeFill: ["#fee2e2", "#ffedd5", "#fef9c3", "#e0f2fe"],
    groupFill: "#fff7ed",
    laneFill: "#fef2f2",
    stroke: "#991b1b",
    text: "#450a0a",
    arrow: "#b91c1c",
    fontSize: 19,
    strokeWidth: 2,
    roughness: 1
  }
};
