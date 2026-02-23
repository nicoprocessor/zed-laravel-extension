import * as crypto from "crypto";
import * as fs from "fs";
import { execFile } from "child_process";
import { projectPath, projectPathExists, internalVendorPath } from "./project";
import { getTemplate } from "../templates";

let phpCommand: string = "php";

export function setPhpCommand(cmd: string): void {
  phpCommand = cmd;
}

export function getPhpCommand(): string {
  return phpCommand;
}

export function template(name: string, data: Record<string, string>): string {
  let content = getTemplate(name);

  for (const [key, value] of Object.entries(data)) {
    const placeholder = `__LARAVEL_LSP_${key.toUpperCase()}__`;
    content = content.replace(new RegExp(placeholder, "g"), value);
  }

  return content;
}

const START_MARKER = "__LARAVEL_LSP_START_OUTPUT__";
const END_MARKER = "__LARAVEL_LSP_END_OUTPUT__";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runInLaravel<T>(
  code: string,
  description?: string,
  tryCount: number = 10
): Promise<T | undefined> {
  for (let i = 0; i < tryCount; i++) {
    if (projectPathExists("vendor/autoload.php")) {
      break;
    }
    if (i === tryCount - 1) {
      throw new Error("vendor/autoload.php not found after retries");
    }
    await sleep(2000);
  }

  if (!projectPathExists("bootstrap/app.php")) {
    throw new Error("bootstrap/app.php not found -- is this a Laravel project?");
  }

  const bootstrapped = template("bootstrap-laravel", {
    OUTPUT: code,
  });

  const raw = await runPhp(bootstrapped);

  const startIdx = raw.indexOf(START_MARKER);
  const endIdx = raw.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    if (description) {
      throw new Error(`Failed to parse output for: ${description}`);
    }
    return undefined;
  }

  const jsonStr = raw.substring(startIdx + START_MARKER.length, endIdx).trim();

  if (!jsonStr) {
    return undefined;
  }

  return JSON.parse(jsonStr) as T;
}

export async function runPhp(code: string): Promise<string> {
  const hash = crypto.createHash("md5").update(code).digest("hex");
  const filePath = internalVendorPath(`discover-${hash}.php`);

  fs.writeFileSync(filePath, code, "utf-8");

  return new Promise<string>((resolve, reject) => {
    execFile(
      phpCommand,
      [filePath],
      {
        cwd: projectPath(),
        maxBuffer: 1024 * 1024 * 10,
        timeout: 30000,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `PHP execution failed: ${error.message}\nStderr: ${stderr}`
            )
          );
          return;
        }
        resolve(stdout);
      }
    );
  });
}

export async function artisan(command: string): Promise<string> {
  const artisanPath = projectPath("artisan");

  return new Promise<string>((resolve, reject) => {
    execFile(
      phpCommand,
      [artisanPath, ...command.split(" ")],
      {
        cwd: projectPath(),
        maxBuffer: 1024 * 1024 * 10,
        timeout: 30000,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `Artisan command failed: ${error.message}\nStderr: ${stderr}`
            )
          );
          return;
        }
        resolve(stdout);
      }
    );
  });
}
