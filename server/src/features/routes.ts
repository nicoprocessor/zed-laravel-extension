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
import { getRoutes, RouteItem } from "../repositories/routes";
import { projectPath } from "../support/project";
import { URI } from "vscode-uri";

const ROUTE_FUNCTION_PATTERNS = [
  /route\s*\(\s*['"]/,
  /signedRoute\s*\(\s*['"]/,
  /to_route\s*\(\s*['"]/,
  /redirect\s*\(\s*\)\s*->\s*route\s*\(\s*['"]/,
  /URL::route\s*\(\s*['"]/,
  /Redirect::route\s*\(\s*['"]/,
];

/**
 * Checks if the cursor is inside a route reference and returns
 * the range of the route name string if so.
 */
function getRouteContext(
  document: TextDocument,
  position: Position
): { range: Range; value: string } | null {
  const line = document.getText(
    Range.create(position.line, 0, position.line + 1, 0)
  );

  const quoteChars = ["'", '"'];

  for (const quote of quoteChars) {
    let searchStart = 0;
    while (searchStart < line.length) {
      const openIdx = line.indexOf(quote, searchStart);
      if (openIdx === -1) break;

      const closeIdx = line.indexOf(quote, openIdx + 1);
      if (closeIdx === -1) break;

      if (position.character > openIdx && position.character <= closeIdx) {
        const value = line.substring(openIdx + 1, closeIdx);

        const textBefore = line.substring(0, openIdx + 1);
        const isRouteRef = ROUTE_FUNCTION_PATTERNS.some((p) =>
          p.test(textBefore)
        );

        if (isRouteRef) {
          return {
            range: Range.create(
              position.line,
              openIdx + 1,
              position.line,
              closeIdx
            ),
            value,
          };
        }
      }

      searchStart = closeIdx + 1;
    }
  }

  return null;
}

/**
 * Scans the entire document for route references and returns them all.
 */
function findAllRouteReferences(
  document: TextDocument
): { range: Range; value: string }[] {
  const results: { range: Range; value: string }[] = [];
  const text = document.getText();
  const lines = text.split("\n");

  const routePatterns = [
    /route\s*\(\s*(['"])(.*?)\1/g,
    /signedRoute\s*\(\s*(['"])(.*?)\1/g,
    /to_route\s*\(\s*(['"])(.*?)\1/g,
    /redirect\s*\(\s*\)\s*->\s*route\s*\(\s*(['"])(.*?)\1/g,
    /URL::route\s*\(\s*(['"])(.*?)\1/g,
    /Redirect::route\s*\(\s*(['"])(.*?)\1/g,
  ];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    for (const pattern of routePatterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(line)) !== null) {
        const fullMatch = match[0];
        const routeName = match[2];
        if (!routeName) continue;

        const quote = match[1];
        const nameStart =
          match.index + fullMatch.indexOf(quote + routeName) + 1;
        const nameEnd = nameStart + routeName.length;

        results.push({
          range: Range.create(lineNum, nameStart, lineNum, nameEnd),
          value: routeName,
        });
      }
    }
  }

  return results;
}

export function provideRouteCompletion(
  document: TextDocument,
  position: Position
): CompletionItem[] {
  const context = getRouteContext(document, position);
  if (!context) return [];

  const routes = getRoutes();
  const namedRoutes = routes.filter((r) => r.name !== null);

  return namedRoutes.map((route, index) => ({
    label: route.name!,
    kind: CompletionItemKind.Constant,
    detail: `[${route.method}]`,
    documentation: {
      kind: "markdown" as const,
      value: [
        `**URI:** \`/${route.uri}\``,
        `**Action:** \`${route.action}\``,
        route.filename ? `**File:** \`${route.filename}\`` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    sortText: String(index).padStart(5, "0"),
    filterText: route.name!,
  }));
}

export function provideRouteHover(
  document: TextDocument,
  position: Position
): Hover | null {
  const context = getRouteContext(document, position);
  if (!context) return null;

  const routes = getRoutes();
  const route = routes.find((r) => r.name === context.value);
  if (!route) return null;

  const parts = [
    `**Route:** \`${route.name}\``,
    `**Method:** \`${route.method}\``,
    `**URI:** \`/${route.uri}\``,
    `**Action:** \`${route.action}\``,
  ];

  if (route.filename) {
    parts.push(`**Defined in:** \`${route.filename}:${route.line ?? ""}\``);
  }

  if (route.actionFilename && route.actionFilename !== route.filename) {
    parts.push(
      `**Controller:** \`${route.actionFilename}:${route.actionLine ?? ""}\``
    );
  }

  return {
    contents: {
      kind: "markdown",
      value: parts.join("\n\n"),
    },
    range: context.range,
  };
}

export function provideRouteDefinition(
  document: TextDocument,
  position: Position
): Location | null {
  const context = getRouteContext(document, position);
  if (!context) return null;

  const routes = getRoutes();
  const route = routes.find((r) => r.name === context.value);
  if (!route || !route.filename) return null;

  const filePath = projectPath(route.filename);
  const line = route.line ? route.line - 1 : 0; // Convert to 0-based

  return Location.create(
    URI.file(filePath).toString(),
    Range.create(line, 0, line, 0)
  );
}

export function provideRouteDiagnostics(
  document: TextDocument
): Diagnostic[] {
  const routes = getRoutes();
  if (routes.length === 0) return [];

  const routeNames = new Set(
    routes.filter((r) => r.name !== null).map((r) => r.name!)
  );

  const refs = findAllRouteReferences(document);
  const diagnostics: Diagnostic[] = [];

  for (const ref of refs) {
    const value = ref.value;

    // Skip empty or dynamic values
    if (!value || value.includes("$") || value.includes("{")) continue;

    // Skip wildcard patterns
    if (value.includes("*")) continue;

    // Skip if route exists
    if (routeNames.has(value)) continue;

    diagnostics.push(
      Diagnostic.create(
        ref.range,
        `Route "${value}" not found.`,
        DiagnosticSeverity.Error,
        "laravel-route",
        "laravel-lsp"
      )
    );
  }

  return diagnostics;
}
