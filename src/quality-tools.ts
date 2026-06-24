import type { QualityExplanation, RepairResult, SceneDiff } from "./advanced-types.js";
import type { ExcalidrawScene } from "./scene-types.js";
import { createSceneFromPrompt } from "./scene-factory.js";
import { validateSceneQuality } from "./scene-quality.js";
import { labelsFor } from "./advanced-shared.js";

export function explainSceneQuality(scene: ExcalidrawScene): QualityExplanation {
  const result = validateSceneQuality(scene);
  const issueText = result.issues.join("; ");
  return {
    ok: result.ok,
    summary: result.ok ? "Scene quality passed" : `${result.issues.length} quality issue(s): ${issueText}`,
    issueCount: result.issues.length,
    issues: result.issues,
    repairActions: result.issues.flatMap(repairActionsForIssue)
  };
}

export function repairScene(scene: ExcalidrawScene): RepairResult {
  const explanation = explainSceneQuality(scene);
  if (explanation.ok) return { ok: true, scene, actions: [] };
  const labels = labelsFor(scene);
  const repaired = createSceneFromPrompt(labels.length > 1 ? labels.join(" to ") : "client calls API");
  return { ok: validateSceneQuality(repaired).ok, scene: repaired, actions: ["rebuilt layout from visible node labels", ...explanation.repairActions] };
}

export function diffScenes(before: ExcalidrawScene, after: ExcalidrawScene): SceneDiff {
  const beforeLabels = labelsFor(before);
  const afterLabels = labelsFor(after);
  const addedLabels = afterLabels.filter((label) => !beforeLabels.includes(label));
  const removedLabels = beforeLabels.filter((label) => !afterLabels.includes(label));
  const changedPositions = countChangedPositions(before, after);
  const elementDelta = after.elements.length - before.elements.length;
  return {
    summary: `changed: ${addedLabels.length} added, ${removedLabels.length} removed, ${changedPositions} moved, ${Math.abs(elementDelta)} element delta`,
    addedLabels,
    removedLabels,
    changedPositions,
    elementDelta
  };
}

function repairActionsForIssue(issue: string): readonly string[] {
  if (/overlap/i.test(issue)) return ["separate overlapping elements", "rerun layout with wider spacing"];
  if (/too close/i.test(issue)) return ["increase spacing between neighboring elements"];
  if (/canvas/i.test(issue)) return ["reduce detail or use a more compact layout profile"];
  if (/arrow/i.test(issue)) return ["reroute arrows through reserved gutters"];
  if (/text/i.test(issue)) return ["increase text container width and recenter labels"];
  return ["regenerate scene with balanced layout"];
}

function countChangedPositions(before: ExcalidrawScene, after: ExcalidrawScene): number {
  const beforeByText = new Map(labelsFor(before).map((label) => [label, before.elements.find((element) => element.originalText === label || element.text === label)]));
  return labelsFor(after).filter((label) => {
    const oldElement = beforeByText.get(label);
    const newElement = after.elements.find((element) => element.originalText === label || element.text === label);
    return !!oldElement && !!newElement && (Math.abs(oldElement.x - newElement.x) > 1 || Math.abs(oldElement.y - newElement.y) > 1);
  }).length;
}
