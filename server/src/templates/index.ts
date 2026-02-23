import { bootstrapLaravel } from "./bootstrap-laravel";

const templates: Map<string, string> = new Map();

export function registerTemplate(name: string, content: string): void {
  templates.set(name, content);
}

export function getTemplate(name: string): string {
  const tpl = templates.get(name);

  if (!tpl) {
    throw new Error(`Template "${name}" not found`);
  }

  return tpl;
}

// Auto-register built-in templates
registerTemplate("bootstrap-laravel", bootstrapLaravel);
