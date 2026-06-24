import type { LibraryPack } from "./advanced-types.js";
import type { ExcalidrawElement } from "./scene-types.js";
import { createSceneFromPrompt } from "./scene-factory.js";
import { slug } from "./advanced-shared.js";

export function exportLibraryPack(): LibraryPack {
  const names = ["API service", "queue", "database", "trust boundary", "worker", "browser", "cache", "alert"];
  return {
    type: "excalidrawlib",
    version: 2,
    source: "https://github.com/yappologistic/Excalidrawer",
    libraryItems: names.map((name, index) => ({
      id: `excalidrawer-library-${slug(name)}`,
      name,
      status: "published",
      created: 1_782_277_000 + index,
      elements: libraryElements(name, index)
    }))
  };
}

function libraryElements(name: string, index: number): readonly ExcalidrawElement[] {
  const scene = createSceneFromPrompt(`${name} calls target`);
  return scene.elements.slice(0, Math.min(2, scene.elements.length)).map((element) => ({
    ...element,
    id: `library-${slug(name)}-${index}-${element.id}`,
    customData: { excalidrawer: { ...element.customData?.excalidrawer, role: "library-item", iconKey: slug(name) } }
  }));
}
