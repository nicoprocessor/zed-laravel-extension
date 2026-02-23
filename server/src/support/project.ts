import * as path from "path";
import * as fs from "fs";

let workspaceRoot: string = "";

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = root;
}

export function getWorkspaceRoot(): string {
  return workspaceRoot;
}

export function projectPath(...segments: string[]): string {
  return path.join(workspaceRoot, ...segments);
}

export function projectPathExists(rel: string): boolean {
  return fs.existsSync(projectPath(rel));
}

export function relativePath(abs: string): string {
  return path.relative(workspaceRoot, abs);
}

export function internalVendorPath(...segments: string[]): string {
  const dir = projectPath("vendor", "_laravel_ide");

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return path.join(dir, ...segments);
}
