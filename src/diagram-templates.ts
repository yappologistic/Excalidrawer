import type { ComplexityMode, LayoutIntent, TemplateName, ThemeName } from "./diagram-model.js";

export type DiagramTemplate = {
  readonly name: TemplateName;
  readonly layoutIntent: LayoutIntent;
  readonly themeName: ThemeName;
  readonly complexityMode: ComplexityMode;
  readonly prompt: string;
};

export const diagramTemplates: Record<TemplateName, DiagramTemplate> = {
  flow: {
    name: "flow",
    layoutIntent: "flow",
    themeName: "technical",
    complexityMode: "balanced",
    prompt: "intake validates request, request routes to processor, processor exports result"
  },
  architecture: {
    name: "architecture",
    layoutIntent: "architecture",
    themeName: "system-architecture",
    complexityMode: "detailed",
    prompt: "frontend calls API, API writes Postgres, API publishes queue, worker consumes queue, metrics collector observes API"
  },
  sequence: {
    name: "sequence",
    layoutIntent: "sequence",
    themeName: "minimal",
    complexityMode: "balanced",
    prompt: "client sends request, API authenticates client, API calls worker, worker returns result"
  },
  mindmap: {
    name: "mindmap",
    layoutIntent: "mindmap",
    themeName: "handdrawn",
    complexityMode: "balanced",
    prompt: "platform idea to reliability, platform idea to observability, platform idea to delivery, platform idea to security"
  },
  "data-flow": {
    name: "data-flow",
    layoutIntent: "data-flow",
    themeName: "technical",
    complexityMode: "detailed",
    prompt: "source API reads events, events queue publishes stream, transform worker writes warehouse, dashboard reads warehouse"
  },
  "state-machine": {
    name: "state-machine",
    layoutIntent: "state-machine",
    themeName: "executive",
    complexityMode: "balanced",
    prompt: "draft state transitions review state, review state transitions approved state, approved state transitions published state"
  },
  swimlane: {
    name: "swimlane",
    layoutIntent: "swimlane",
    themeName: "technical",
    complexityMode: "detailed",
    prompt: "client sends ticket, support validates ticket, platform investigates API, data team reads warehouse, ops notifies client"
  },
  "incident-response": {
    name: "incident-response",
    layoutIntent: "incident-response",
    themeName: "incident-response",
    complexityMode: "detailed",
    prompt: "client reports outage, alert manager notifies on-call, on-call investigates API, API reads Postgres, worker consumes queue"
  },
  "system-architecture": {
    name: "system-architecture",
    layoutIntent: "architecture",
    themeName: "system-architecture",
    complexityMode: "detailed",
    prompt: "browser calls gateway, gateway calls auth service, gateway calls API, API writes database, API queues jobs, worker consumes queue"
  }
};

