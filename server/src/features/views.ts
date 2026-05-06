import {
  CompletionItem,
  CompletionItemKind,
  Hover,
  Location,
  Diagnostic,
  DiagnosticSeverity,
  Range,
  Position,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getViews, ViewItem } from "../repositories/views";
import { projectPath } from "../support/project";
import { URI } from "vscode-uri";

const VIEW_FUNCTION_PATTERNS = [
  /(?:^|[^\w:>])view\s*\(\s*$/,
  /View::make\s*\(\s*$/,
  /@extends\s*\(\s*$/,
  /@include\s*\(\s*$/,
  /@includeIf\s*\(\s*$/,
  /@includeWhen\s*\([^,]*,\s*$/,
  /@includeUnless\s*\([^,]*,\s*$/,
  /@includeFirst\s*\(\s*\[\s*$/,
  /@each\s*\(\s*$/,
];

function isViewReference(textBefore: string): boolean {
  if (/Route::view\s*\([^)]*,\s*$/.test(textBefore)) {
    return true;
  }

  if (/Route::view\s*\([^)]*\bview\s*:\s*$/.test(textBefore)) {
    return true;
  }

  return VIEW_FUNCTION_PATTERNS.some((p) => p.test(textBefore));
}

function viewContextFromString(
  line: string,
  lineNum: number,
  openIdx: number,
  closeIdx: number
): { range: Range; value: string } | null {
  const textBefore = line.substring(0, openIdx);

  if (!isViewReference(textBefore)) {
    return null;
  }

  return {
    range: Range.create(lineNum, openIdx + 1, lineNum, closeIdx),
    value: line.substring(openIdx + 1, closeIdx),
  };
}

/**
 * Checks if the cursor is inside a view reference and returns
 * the range of the view name string if so.
 */
function getViewContext(
  document: TextDocument,
  position: Position
): { range: Range; value: string } | null {
  const line = document.getText(
    Range.create(position.line, 0, position.line + 1, 0)
  );

  const quoteChars = ["'", '"'];

  for (const quote of quoteChars) {
    // Find all quoted strings on this line
    let searchStart = 0;
    while (searchStart < line.length) {
      const openIdx = line.indexOf(quote, searchStart);
      if (openIdx === -1) break;

      const closeIdx = line.indexOf(quote, openIdx + 1);
      if (closeIdx === -1) break;

      // Check if cursor is within this quoted string
      if (position.character > openIdx && position.character <= closeIdx) {
        return viewContextFromString(line, position.line, openIdx, closeIdx);
      }

      searchStart = closeIdx + 1;
    }
  }

  return null;
}

/**
 * Scans the entire document for view references and returns them all.
 */
function findAllViewReferences(
  document: TextDocument
): { range: Range; value: string }[] {
  const results: { range: Range; value: string }[] = [];
  const text = document.getText();
  const lines = text.split("\n");

  // Skip patterns -- these are not view references
  const skipPatterns = [/@section\s*\(/, /@push\s*\(/, /@stack\s*\(/];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    let searchStart = 0;
    while (searchStart < line.length) {
      const singleQuoteIdx = line.indexOf("'", searchStart);
      const doubleQuoteIdx = line.indexOf('"', searchStart);
      const openIdx =
        singleQuoteIdx === -1
          ? doubleQuoteIdx
          : doubleQuoteIdx === -1
            ? singleQuoteIdx
            : Math.min(singleQuoteIdx, doubleQuoteIdx);

      if (openIdx === -1) break;

      const quote = line[openIdx];
      const closeIdx = line.indexOf(quote, openIdx + 1);
      if (closeIdx === -1) break;

      const context = viewContextFromString(line, lineNum, openIdx, closeIdx);
      if (context) {
        const textFromView = line.substring(context.range.start.character);
        const shouldSkip = skipPatterns.some((sp) => sp.test(textFromView));

        if (!shouldSkip && context.value) {
          results.push(context);
        }
      }

      searchStart = closeIdx + 1;
    }
  }

  return results;
}

export function provideViewCompletion(
  document: TextDocument,
  position: Position
): CompletionItem[] {
  const context = getViewContext(document, position);
  if (!context) return [];

  const views = getViews();

  return views
    .sort((a, b) => {
      // Local views first, vendor views second
      if (a.isVendor !== b.isVendor) {
        return a.isVendor ? 1 : -1;
      }
      return a.key.localeCompare(b.key);
    })
    .map((view, index) => ({
      label: view.key,
      kind: CompletionItemKind.File,
      detail: view.isVendor ? "[vendor]" : "",
      documentation: {
        kind: "markdown" as const,
        value: `**Path:** \`${view.path}\``,
      },
      sortText: `${view.isVendor ? "z" : "a"}_${String(index).padStart(5, "0")}`,
      filterText: view.key,
    }));
}

export function provideViewHover(
  document: TextDocument,
  position: Position
): Hover | null {
  const context = getViewContext(document, position);
  if (!context) return null;

  const views = getViews();
  const view = views.find((v) => v.key === context.value);
  if (!view) return null;

  return {
    contents: {
      kind: "markdown",
      value: `**View:** \`${view.key}\`\n\n**Path:** \`${view.path}\``,
    },
    range: context.range,
  };
}

export function provideViewDefinition(
  document: TextDocument,
  position: Position
): Location | null {
  const context = getViewContext(document, position);
  if (!context) return null;

  const views = getViews();
  const view = views.find((v) => v.key === context.value);
  if (!view) return null;

  const filePath = projectPath(view.path);
  return Location.create(
    URI.file(filePath).toString(),
    Range.create(0, 0, 0, 0)
  );
}

export function provideViewDiagnostics(
  document: TextDocument
): Diagnostic[] {
  const views = getViews();
  if (views.length === 0) return [];

  const viewKeys = new Set(views.map((v) => v.key));
  const refs = findAllViewReferences(document);
  const diagnostics: Diagnostic[] = [];

  for (const ref of refs) {
    const value = ref.value;

    // Skip empty or dynamic values
    if (!value || value.includes("$") || value.includes("{")) continue;

    // Skip if view exists
    if (viewKeys.has(value)) continue;

    diagnostics.push(
      Diagnostic.create(
        ref.range,
        `View "${value}" not found.`,
        DiagnosticSeverity.Error,
        "laravel-view",
        "laravel-lsp"
      )
    );
  }

  return diagnostics;
}
