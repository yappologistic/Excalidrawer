import { describe, expect, it } from "vitest";
import { createSceneFromPrompt, renderSvg, validateSceneQuality } from "../src/scene.js";
import { compileDiagram, parseDiagramPrompt, scoreDiagramScene } from "../src/diagram-compiler.js";
import { layoutIntents, themeNames } from "../src/diagram-model.js";
import { galleryCases, runGalleryVerification } from "../src/diagram-gallery.js";
import { diagramTemplates } from "../src/diagram-templates.js";

const complexPrompt =
  "frontend calls API, API writes Postgres, worker consumes queue, queue retries failed jobs, auth service issues token, metrics collector observes API, alert manager notifies on failures, admin dashboard reads metrics";

describe("diagram compiler", () => {
  it("parses prompts into a controllable diagram IR", () => {
    const model = parseDiagramPrompt(complexPrompt);

    expect(model.nodes.length).toBeGreaterThanOrEqual(8);
    expect(model.edges.length).toBeGreaterThanOrEqual(7);
    expect(model.groups.length).toBeGreaterThanOrEqual(2);
    expect(model.lanes.length).toBeGreaterThanOrEqual(2);
    expect(model.clusters.length).toBeGreaterThanOrEqual(2);
    expect(model.annotations.length).toBeGreaterThanOrEqual(1);
    expect(model.layoutIntent).toBe("architecture");
    expect(model.edges.map((edge) => edge.verb)).toContain("writes");
  });

  it("strips explicit layout prefixes case-insensitively", () => {
    const model = parseDiagramPrompt("Architecture: frontend calls API");

    expect(model.layoutIntent).toBe("architecture");
    expect(model.nodes.map((node) => node.label)).toEqual(["frontend", "API"]);
  });

  it("strips space-form layout prefixes and routes them through the compiler", () => {
    const model = parseDiagramPrompt("architecture frontend calls API");
    const scene = createSceneFromPrompt("architecture frontend calls API");
    const labels = scene.elements
      .filter((element) => element.type === "text" && element.customData?.excalidrawer?.role === "node-label")
      .map((element) => element.originalText);

    expect(model.layoutIntent).toBe("architecture");
    expect(model.nodes.map((node) => node.label)).toEqual(["frontend", "API"]);
    expect(labels).toEqual(["frontend", "API"]);
    expect(validateSceneQuality(scene).ok).toBe(true);
  });

  it("does not normalize compiler-triggered weak prompts into empty valid scenes", () => {
    const commaScene = createSceneFromPrompt("alpha to beta, beta to gamma");
    const topicScene = createSceneFromPrompt("flow: quarterly roadmap");
    const mixedScene = createSceneFromPrompt("flow: alpha to beta then gamma");
    const mixedLabels = mixedScene.elements
      .filter((element) => element.type === "text" && element.customData?.excalidrawer?.role === "node-label")
      .map((element) => element.originalText);
    const mixedArrows = mixedScene.elements.filter((element) => element.type === "arrow");

    expect(commaScene.elements.length).toBeGreaterThan(0);
    expect(topicScene.elements.length).toBeGreaterThan(0);
    expect(mixedLabels).toEqual(["alpha", "beta", "gamma"]);
    expect(mixedArrows).toHaveLength(2);
    expect(validateSceneQuality(commaScene).ok).toBe(true);
    expect(validateSceneQuality(topicScene).ok).toBe(true);
    expect(validateSceneQuality(mixedScene).ok).toBe(true);
  });

  it("supports every layout intent with polished valid scenes", () => {
    for (const layoutIntent of layoutIntents) {
      const scene = compileDiagram({
        prompt: `${layoutIntent}: ${complexPrompt}`,
        layoutIntent,
        themeName: "technical"
      });
      const rectangles = scene.elements.filter((element) => element.type === "rectangle");
      const arrows = scene.elements.filter((element) => element.type === "arrow");

      expect(rectangles.length, layoutIntent).toBeGreaterThanOrEqual(8);
      expect(arrows.length, layoutIntent).toBeGreaterThanOrEqual(7);
      expect(validateSceneQuality(scene).ok, layoutIntent).toBe(true);
      expect(scoreDiagramScene(scene).ok, layoutIntent).toBe(true);
    }
  });

  it("applies reusable themes without breaking layout quality", () => {
    for (const themeName of themeNames) {
      const scene = compileDiagram({ prompt: complexPrompt, layoutIntent: "architecture", themeName });
      const fills = new Set(
        scene.elements.filter((element) => element.type === "rectangle").map((element) => element.backgroundColor)
      );

      expect(fills.size, themeName).toBeGreaterThan(1);
      expect(validateSceneQuality(scene).ok, themeName).toBe(true);
    }
  });

  it("fails closed when a scored scene contains arrows over labels", () => {
    const scene = createSceneFromPrompt("alpha to beta then gamma");
    const arrow = scene.elements.find((element) => element.type === "arrow");
    const label = scene.elements.find((element) => element.type === "text");
    if (!arrow || !label) throw new Error("expected generated arrow and label");
    arrow.startBinding = null;
    arrow.endBinding = null;
    arrow.x = label.x - 10;
    arrow.y = label.y + label.height / 2;
    arrow.width = label.width + 20;
    arrow.height = 0;
    arrow.points = [
      [0, 0],
      [arrow.width, 0]
    ];

    const score = scoreDiagramScene(scene);

    expect(score.ok).toBe(false);
    expect(score.issues.join("\n")).toContain("crosses visible content");
  });

  it("extracts semantic shapes, icons, typed arrows, templates, and complexity into the IR", () => {
    const model = parseDiagramPrompt({
      prompt: "incident-response: client reports outage, alert manager notifies on-call, on-call investigates API, API reads Postgres, worker consumes queue",
      layoutIntent: "incident-response",
      themeName: "incident-response",
      templateName: "incident-response",
      complexityMode: "detailed"
    });

    expect(model.layoutIntent).toBe("incident-response");
    expect(model.templateName).toBe("incident-response");
    expect(model.complexityMode).toBe("detailed");
    expect(model.nodes.map((node) => node.semanticShape)).toEqual(
      expect.arrayContaining(["actor", "alert", "service", "database", "queue"])
    );
    expect(model.nodes.every((node) => node.iconKey.length > 0)).toBe(true);
    expect(model.edges.map((edge) => edge.edgeType)).toEqual(expect.arrayContaining(["alert", "query", "async"]));
    expect(model.annotations.length).toBeGreaterThanOrEqual(2);
  });

  it("renders complex diagrams with semantic shapes, icons, edge labels, typed arrows, and callouts", () => {
    const scene = compileDiagram({
      prompt: complexPrompt,
      layoutIntent: "architecture",
      themeName: "system-architecture",
      templateName: "system-architecture",
      complexityMode: "detailed"
    });
    const semanticShapes = scene.elements.filter((element) => element.customData?.excalidrawer?.role === "node-shape");
    const icons = scene.elements.filter((element) => element.customData?.excalidrawer?.role === "icon");
    const edgeLabels = scene.elements.filter((element) => element.customData?.excalidrawer?.role === "edge-label");
    const callouts = scene.elements.filter((element) => element.customData?.excalidrawer?.role === "annotation");
    const typedArrows = scene.elements.filter((element) => element.type === "arrow" && element.customData?.excalidrawer?.edgeType);

    expect(semanticShapes.some((element) => element.type === "ellipse" || element.type === "diamond")).toBe(true);
    expect(icons.length).toBeGreaterThanOrEqual(semanticShapes.length);
    expect(edgeLabels.length).toBeGreaterThanOrEqual(typedArrows.length);
    expect(callouts.length).toBeGreaterThanOrEqual(1);
    expect(typedArrows.map((element) => element.strokeStyle)).toContain("dashed");
    expect(validateSceneQuality(scene).ok).toBe(true);

    const svg = renderSvg(scene);
    expect(svg).toContain("data-excalidrawer-role=\"icon\"");
    expect(svg).toContain("data-excalidrawer-edge-type=");
  });

  it("publishes templates and verifies gallery cases through the quality gate", async () => {
    expect(Object.keys(diagramTemplates)).toEqual(expect.arrayContaining([...layoutIntents]));
    expect(galleryCases.length).toBeGreaterThanOrEqual(layoutIntents.length);
    expect(galleryCases.map((entry) => entry.name)).toContain("architecture-ecommerce-spacious");

    const result = await runGalleryVerification();

    expect(result.ok).toBe(true);
    expect(result.cases.map((entry) => entry.layoutIntent)).toEqual(expect.arrayContaining([...layoutIntents]));
    expect(result.cases.every((entry) => entry.excalidrawOk && entry.svgOk)).toBe(true);
  });

  it("keeps compact architecture prompts readable instead of failing from cramped spacing", () => {
    const scene = compileDiagram(
      "compact architecture: frontend calls API, API writes Postgres, API publishes queue, worker consumes queue"
    );

    expect(scoreDiagramScene(scene).ok).toBe(true);
  });

  it("routes dense architecture arrows without covering lower-row content", () => {
    const scene = compileDiagram(
      "architecture: browser calls gateway, gateway authenticates user, API calls worker, API writes Postgres, API publishes queue, worker consumes queue, API observes metrics collector, alert manager notifies on-call, admin dashboard reads metrics"
    );

    expect(validateSceneQuality(scene).ok).toBe(true);
    expect(scoreDiagramScene(scene).ok).toBe(true);
  });

  it("renders custom hub-and-spoke mindmaps without routing arrows through sibling nodes", () => {
    const scene = compileDiagram(
      "mindmap: platform idea to reliability, platform idea to observability, platform idea to delivery, platform idea to security, platform idea to cost"
    );

    expect(scoreDiagramScene(scene).ok).toBe(true);
  });

  it("compiles advanced diagram design primitives, hints, legends, subdiagrams, and review metadata", () => {
    const prompt =
      "architecture detailed: external users cross trust boundary to API, API publishes event bus, API writes Postgres in data zone, expand API internals, put databases at bottom, group AWS services together, mark API critical and PII";
    const model = parseDiagramPrompt(prompt);

    expect(model.primitives.map((primitive) => primitive.primitiveType)).toEqual(
      expect.arrayContaining(["trust-boundary", "event-bus", "deployment-zone"])
    );
    expect(model.layoutHints.map((hint) => hint.kind)).toEqual(expect.arrayContaining(["database-bottom", "group-cloud"]));
    expect(model.subdiagrams.map((subdiagram) => subdiagram.parentNodeId)).toContain("node-1");
    expect(model.nodes.find((node) => node.label === "API")?.decorations).toEqual(expect.arrayContaining(["critical", "pii"]));
    expect(model.visualGrammar.legendItems.map((item) => item.edgeType)).toEqual(expect.arrayContaining(["async", "query"]));

    const scene = compileDiagram({ prompt, layoutIntent: "architecture", themeName: "system-architecture", complexityMode: "detailed" });
    const roles = scene.elements.map((element) => element.customData?.excalidrawer?.role).filter(Boolean);

    expect(roles).toEqual(expect.arrayContaining(["primitive", "badge", "legend", "subdiagram", "review-note"]));
    expect(scene.elements.some((element) => element.type === "arrow" && element.customData?.excalidrawer?.routeGroup)).toBe(true);
    expect(scene.appState.excalidrawerReview).toMatchObject({ status: "pass" });
    expect(renderSvg(scene)).toContain("data-excalidrawer-primitive-type=");
    expect(scoreDiagramScene(scene).ok).toBe(true);
  });

  it("records renderer specs, optimizer attempts, and bundled route lanes", () => {
    const prompt =
      "architecture detailed: frontend calls API, API writes Postgres, API reads warehouse, API publishes event bus, worker consumes event bus, alert manager notifies on-call, expand API internals, mark API critical";
    const scene = compileDiagram({ prompt, layoutIntent: "architecture", themeName: "system-architecture", complexityMode: "detailed" });
    const review = scene.appState.excalidrawerReview as {
      readonly attemptCount?: number;
      readonly selectedAttempt?: number;
      readonly optimizerAttempts?: readonly unknown[];
      readonly rendererSpec?: { readonly edgePolicy?: string; readonly primitivePolicy?: string };
      readonly grammarSummary?: { readonly routeGroups?: readonly string[] };
    };
    const arrows = scene.elements.filter((element) => element.type === "arrow");
    const routeGroups = new Set(arrows.map((arrow) => arrow.customData?.excalidrawer?.routeGroup).filter(Boolean));
    const routeLanes = new Set(arrows.map((arrow) => arrow.customData?.excalidrawer?.routeLane).filter(Boolean));

    expect(scene.appState.excalidrawerRendererSpec).toMatchObject({ edgePolicy: "orthogonal", primitivePolicy: "cluster" });
    expect(review).toMatchObject({
      attemptCount: 3,
      rendererSpec: { edgePolicy: "orthogonal", primitivePolicy: "cluster" }
    });
    expect(review.optimizerAttempts?.length).toBeGreaterThanOrEqual(1);
    expect(typeof review.selectedAttempt).toBe("number");
    expect(review.grammarSummary?.routeGroups).toEqual(expect.arrayContaining(["query-corridor", "async-corridor"]));
    expect([...routeGroups]).toEqual(expect.arrayContaining(["query-corridor", "async-corridor"]));
    expect(routeLanes.size).toBeGreaterThanOrEqual(2);
    expect(renderSvg(scene)).toContain("data-excalidrawer-route-lane=");
    expect(scoreDiagramScene(scene).ok).toBe(true);
  });

  it("compiles next-generation complexity metadata into polished Excalidraw scenes", () => {
    const prompt =
      "domain: ecommerce pattern: strangler migration profile: spacious preset: boardroom import: yaml detail: deep architecture detailed: buyer calls storefront, storefront calls checkout API, checkout API writes orders database, checkout API publishes payment event bus, fulfillment worker consumes payment event bus, warehouse service reads orders database, support dashboard reads metrics, mark checkout API critical and PII, expand API internals, put databases at bottom";
    const model = parseDiagramPrompt({ prompt, layoutIntent: "architecture", themeName: "executive", complexityMode: "detailed" });

    expect(model.patterns.map((pattern) => pattern.name)).toContain("strangler-migration");
    expect(model.domainPack.name).toBe("ecommerce");
    expect(model.layoutProfile.name).toBe("spacious");
    expect(model.stylePreset.name).toBe("boardroom");
    expect(model.importedSource?.format).toBe("yaml");
    expect(model.progressiveDetail.level).toBe("deep");
    expect(model.critic.checks.map((check) => check.id)).toEqual(
      expect.arrayContaining(["node-spacing", "edge-routing", "label-centering", "semantic-coverage"])
    );
    expect(model.compoundComponents.map((component) => component.kind)).toEqual(expect.arrayContaining(["service-with-database", "async-worker"]));
    expect(model.ports.some((port) => port.side === "right")).toBe(true);
    expect(model.anchors.some((anchor) => anchor.kind === "edge-anchor")).toBe(true);
    expect(model.goldenFixture.name).toBe("architecture-ecommerce-spacious");

    const scene = compileDiagram({ prompt, layoutIntent: "architecture", themeName: "executive", complexityMode: "detailed" });
    const roles = scene.elements.map((element) => element.customData?.excalidrawer?.role).filter(Boolean);

    expect(roles).toEqual(expect.arrayContaining(["pattern-note", "compound-component", "detail-panel", "critic-note"]));
    expect(scene.appState.excalidrawerReview).toMatchObject({
      domainPack: "ecommerce",
      layoutProfile: "spacious",
      stylePreset: "boardroom",
      importedSource: { format: "yaml" },
      goldenFixture: "architecture-ecommerce-spacious"
    });
    expect(scene.appState.excalidrawerLayoutProfile).toMatchObject({ name: "spacious" });
    expect(scene.appState.excalidrawerDomainPack).toMatchObject({ name: "ecommerce" });
    expect(scene.elements.some((element) => element.customData?.excalidrawer?.portId)).toBe(true);
    expect(renderSvg(scene)).toContain("data-excalidrawer-style-preset=\"boardroom\"");
    expect(renderSvg(scene)).toContain("data-excalidrawer-port-id=");
    expect(scoreDiagramScene(scene).ok).toBe(true);
  });

  it("renders requested diagram families without generic fallback", () => {
    const cases = [
      {
        family: "uml-class",
        prompt: "UML class diagram for User, Order, Product with attributes and methods, User places Orders, Order contains Products",
        roles: ["class", "class-compartment"],
        edgeSemantics: ["association"]
      },
      {
        family: "bpmn-process",
        prompt:
          "BPMN process: customer submits order, payment gateway authorizes, if payment fails notify customer, if payment succeeds warehouse ships order",
        roles: ["start-event", "task", "gateway", "end-event"],
        edgeSemantics: ["sequence-flow"]
      },
      {
        family: "data-flow",
        prompt:
          "Data flow diagram: external customer sends order to order service, order service writes orders data store, payment processor returns authorization, analytics receives event stream",
        roles: ["external-entity", "process", "data-store"],
        edgeSemantics: ["data-flow"]
      },
      {
        family: "network",
        prompt:
          "Network diagram: internet connects firewall, firewall routes to DMZ load balancer, load balancer routes to two web servers, web servers connect to app server, app server connects to database subnet",
        roles: ["network-zone", "network-device"],
        edgeSemantics: ["network-link"]
      },
      {
        family: "org-chart",
        prompt:
          "Org chart: CEO manages VP Engineering and VP Sales; VP Engineering manages Platform Lead and Product Lead; VP Sales manages Account Exec",
        roles: ["person", "reporting-line"],
        edgeSemantics: ["reports-to"]
      }
    ] as const;

    for (const entry of cases) {
      const model = parseDiagramPrompt(entry.prompt);
      const scene = compileDiagram(entry.prompt);
      const roles = new Set(scene.elements.map((element) => element.customData?.excalidrawer?.notationRole).filter(Boolean));
      const edgeSemantics = new Set(scene.elements.map((element) => element.customData?.excalidrawer?.connectorSemantic).filter(Boolean));
      const review = scene.appState.excalidrawerReview as {
        readonly diagramFamily?: string;
        readonly strictness?: string;
        readonly unsupported?: readonly string[];
      };
      const svg = renderSvg(scene);

      expect(model.diagramFamily, entry.family).toBe(entry.family);
      expect(review).toMatchObject({ diagramFamily: entry.family, strictness: "strict" });
      expect(review.unsupported ?? [], entry.family).toEqual([]);
      for (const role of entry.roles) expect(roles.has(role), `${entry.family}:${role}`).toBe(true);
      for (const semantic of entry.edgeSemantics) expect(edgeSemantics.has(semantic), `${entry.family}:${semantic}`).toBe(true);
      expect(svg, entry.family).toContain(`data-excalidrawer-diagram-family="${entry.family}"`);
      expect(svg, entry.family).toContain("data-excalidrawer-notation-role=");
      expect(scoreDiagramScene(scene).ok, entry.family).toBe(true);
    }
  });

  it("covers the core catalog with diagram contracts", () => {
    const contracts = [
      ["flowchart", "flowchart: start to validate input then process request then finish"],
      ["architecture-c4", "C4 container diagram: user calls web app, web app calls API, API writes database"],
      ["sequence", "sequence diagram: actor user sends login message to API, API returns token"],
      ["state-machine", "state machine: draft transitions to review, review transitions to approved, review transitions to rejected"],
      ["swimlane", "cross-functional swimlane: support team triages ticket then engineering team fixes bug then support team closes ticket"],
      ["data-flow", "data flow diagram: customer sends profile to onboarding process, onboarding process writes customer data store"],
      ["uml-use-case", "UML use case: customer actor searches catalog, customer checks out, admin manages catalog"],
      ["uml-activity", "UML activity diagram: start then validate form then decision valid then submit or show errors then end"],
      ["bpmn-process", "BPMN process: start event receives invoice, approval task reviews invoice, gateway routes approved invoice, end event archives invoice"],
      ["network", "infrastructure network diagram: internet connects firewall, firewall routes to load balancer, load balancer connects web server"],
      ["org-chart", "org chart: CEO manages CTO and COO; CTO manages Engineering Manager"],
      ["timeline", "timeline roadmap: Q1 discovery, Q2 beta, Q3 launch, Q4 scale"],
      ["dependency-graph", "dependency graph: app depends on auth package, auth package depends on crypto package"],
      ["mindmap", "concept map: platform idea to reliability, platform idea to observability, platform idea to security"],
      ["incident-response", "incident response: alert manager notifies on-call, on-call investigates API, API recovers service"],
      ["threat-model", "threat model: attacker targets API, API validates token, database stores PII, audit log detects abuse"]
    ] as const;

    for (const [family, prompt] of contracts) {
      const scene = compileDiagram(prompt);
      const review = scene.appState.excalidrawerReview as { readonly diagramFamily?: string; readonly strictness?: string };

      expect(review).toMatchObject({ diagramFamily: family, strictness: "strict" });
      expect(scene.elements.some((element) => element.customData?.excalidrawer?.diagramFamily === family), family).toBe(true);
      expect(scoreDiagramScene(scene).ok, family).toBe(true);
      expect(renderSvg(scene), family).toContain(`data-excalidrawer-diagram-family="${family}"`);
    }
  });
});
