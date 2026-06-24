export function text(value: string) {
  return {
    content: [{ type: "text" as const, text: value }]
  };
}
