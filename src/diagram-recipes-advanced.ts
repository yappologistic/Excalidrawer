import type { DiagramRecipe } from "./advanced-types.js";
import type { ExcalidrawScene } from "./scene-types.js";
import { createSceneFromPrompt } from "./scene-factory.js";

const recipes: readonly DiagramRecipe[] = [
  { name: "c4-container", title: "C4 container", prompt: "architecture detailed: user calls web app, web app calls API, API writes database, API publishes queue, worker consumes queue" },
  { name: "incident-timeline", title: "Incident timeline", prompt: "incident-response detailed: monitor observes API, alert manager notifies on-call, on-call investigates API, API reports mitigation, support dashboard reads metrics" },
  { name: "service-map", title: "Service map", prompt: "architecture detailed: browser calls gateway, gateway authenticates auth service, gateway calls API, API writes Postgres, API publishes event bus, worker consumes event bus" },
  { name: "data-lineage", title: "Data lineage", prompt: "data-flow detailed: source sends transform, transform writes warehouse, warehouse feeds dashboard, dashboard reports metric" },
  { name: "deployment-topology", title: "Deployment topology", prompt: "architecture detailed: cloud load balancer routes API, API calls worker, worker writes database, API reads cache, put databases at bottom, group cloud services together" },
  { name: "queue-worker-system", title: "Queue worker system", prompt: "architecture detailed: frontend calls API, API publishes queue, worker consumes queue, worker writes database, alert manager observes queue" },
  { name: "auth-flow", title: "Auth flow", prompt: "sequence detailed: browser calls auth service, auth service authenticates user, auth service issues token, browser calls API, API validates token" }
];

export function listDiagramRecipes(): readonly DiagramRecipe[] {
  return recipes;
}

export function sceneFromRecipe(name: string): ExcalidrawScene {
  const recipe = recipes.find((entry) => entry.name === name);
  if (!recipe) throw new Error(`Unknown recipe: ${name}`);
  return createSceneFromPrompt(recipe.prompt);
}
