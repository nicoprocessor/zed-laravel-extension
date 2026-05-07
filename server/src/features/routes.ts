import {
  CompletionItem,
  CompletionItemKind,
  Hover,
  Location,
  CodeLens,
  Diagnostic,
  DiagnosticSeverity,
  Range,
  Position,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getRoutes, RouteItem } from "../repositories/routes";
import { projectPath, relativePath } from "../support/project";
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

function getDocumentRelativePath(document: TextDocument): string | null {
  try {
    return relativePath(URI.parse(document.uri).fsPath);
  } catch {
    return null;
  }
}

function getWordRangeAtPosition(
  document: TextDocument,
  position: Position
): { range: Range; value: string } | null {
  const line = document.getText(
    Range.create(position.line, 0, position.line + 1, 0)
  );

  const wordPattern = /[A-Za-z_][A-Za-z0-9_]*/g;
  let match: RegExpExecArray | null;

  while ((match = wordPattern.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (position.character >= start && position.character <= end) {
      return {
        range: Range.create(position.line, start, position.line, end),
        value: match[0],
      };
    }
  }

  return null;
}

function parsePhpImports(document: TextDocument): Map<string, string> {
  const imports = new Map<string, string>();
  const text = document.getText();
  const usePattern = /^\s*use\s+([^;]+);/gm;
  let match: RegExpExecArray | null;

  while ((match = usePattern.exec(text)) !== null) {
    const importValue = match[1].trim();
    if (importValue.includes("{")) continue;

    const aliasMatch = importValue.match(/\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/i);
    const fqcn = aliasMatch
      ? importValue.replace(/\s+as\s+[A-Za-z_][A-Za-z0-9_]*$/i, "").trim()
      : importValue;
    const shortName = aliasMatch
      ? aliasMatch[1]
      : fqcn.split("\\").filter(Boolean).at(-1);

    if (shortName) {
      imports.set(shortName, fqcn.replace(/^\\/, ""));
    }
  }

  return imports;
}

function parsePhpNamespace(document: TextDocument): string | null {
  const match = document
    .getText()
    .match(/^\s*namespace\s+([^;]+);/m);

  return match ? match[1].trim().replace(/^\\/, "") : null;
}

function parsePhpClassName(document: TextDocument): string | null {
  const text = document.getText();
  const classMatch = text.match(
    /\b(?:abstract\s+|final\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)\b/
  );
  if (!classMatch) return null;

  const namespace = parsePhpNamespace(document);
  return namespace ? `${namespace}\\${classMatch[1]}` : classMatch[1];
}

function resolvePhpClassName(
  className: string,
  document: TextDocument
): string {
  const normalized = className.trim().replace(/^\\/, "");
  if (normalized.includes("\\")) return normalized;

  const imports = parsePhpImports(document);
  const imported = imports.get(normalized);
  if (imported) return imported;

  const namespace = parsePhpNamespace(document);
  return namespace ? `${namespace}\\${normalized}` : normalized;
}

function findControllerGroupClass(
  document: TextDocument,
  fromLine: number
): string | null {
  for (let lineNum = fromLine; lineNum >= 0; lineNum--) {
    const line = document.getText(Range.create(lineNum, 0, lineNum + 1, 0));
    const match = line.match(
      /Route::controller\s*\(\s*([A-Za-z_\\][A-Za-z0-9_\\]*)::class\s*\)\s*->\s*group\s*\(/
    );

    if (match) {
      return resolvePhpClassName(match[1], document);
    }
  }

  return null;
}

function getRouteActionContext(
  document: TextDocument,
  position: Position
): { range: Range; controller: string | null; method: string } | null {
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
        const valueOffset = openIdx + 1;
        const atIdx = value.lastIndexOf("@");

        if (atIdx !== -1 && position.character > valueOffset + atIdx) {
          const controller = value.substring(0, atIdx);
          const method = value.substring(atIdx + 1);

          return {
            range: Range.create(
              position.line,
              valueOffset + atIdx + 1,
              position.line,
              valueOffset + value.length
            ),
            controller: resolvePhpClassName(controller, document),
            method,
          };
        }

        const beforeString = line.substring(0, openIdx);
        const arrayActionMatch = beforeString.match(
          /([A-Za-z_\\][A-Za-z0-9_\\]*)::class\s*,\s*$/
        );
        const controller = arrayActionMatch
          ? resolvePhpClassName(arrayActionMatch[1], document)
          : /Route::[A-Za-z_][A-Za-z0-9_]*\s*\(.*,\s*$/.test(beforeString)
            ? findControllerGroupClass(document, position.line)
            : null;

        if (controller) {
          return {
            range: Range.create(
              position.line,
              valueOffset,
              position.line,
              valueOffset + value.length
            ),
            controller,
            method: value,
          };
        }
      }

      searchStart = closeIdx + 1;
    }
  }

  return null;
}

function routeMatchesControllerMethod(
  route: RouteItem,
  controller: string | null,
  method: string
): boolean {
  const [routeController, routeMethod] = route.action.split("@");
  if (routeMethod !== method) return false;
  if (!controller) return true;

  return (
    routeController === controller ||
    routeController.endsWith(`\\${controller.split("\\").at(-1)}`)
  );
}

function getPhpMethodDeclarationContext(
  document: TextDocument,
  position: Position
): { range: Range; method: string } | null {
  const line = document.getText(
    Range.create(position.line, 0, position.line + 1, 0)
  );
  const functionMatch = line.match(
    /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/
  );
  if (!functionMatch) return null;

  const methodStart = line.indexOf(functionMatch[1]);
  const methodEnd = methodStart + functionMatch[1].length;

  if (position.character < methodStart || position.character > methodEnd) {
    return null;
  }

  return {
    range: Range.create(position.line, methodStart, position.line, methodEnd),
    method: functionMatch[1],
  };
}

function routesForPhpMethod(
  document: TextDocument,
  method: string,
  line: number
): RouteItem[] {
  const relative = getDocumentRelativePath(document);
  if (!relative) return [];

  const controller = parsePhpClassName(document);

  return getRoutes().filter((route) => {
    if (route.actionFilename !== relative) return false;
    if (!routeMatchesControllerMethod(route, controller, method)) return false;

    if (!route.actionLine) return true;
    return route.actionLine - 1 === line;
  });
}

function routesForControllerMethod(
  document: TextDocument,
  position: Position
): { range: Range; method: string; routes: RouteItem[] } | null {
  const methodContext = getPhpMethodDeclarationContext(document, position);
  if (!methodContext) return null;

  const routes = routesForPhpMethod(
    document,
    methodContext.method,
    position.line
  );

  return routes.length > 0
    ? { range: methodContext.range, method: methodContext.method, routes }
    : null;
}

function formatRouteSummary(route: RouteItem): string {
  const name = route.name ? ` (${route.name})` : "";
  return `${route.method} ${formatRouteUri(route.uri)}${name}`;
}

function normalizeRouteUri(uri: string): string {
  return uri.replace(/^\/+|\/+$/g, "");
}

function formatRouteUri(uri: string): string {
  const normalized = normalizeRouteUri(uri);
  return normalized ? `/${normalized}` : "/";
}

function routeHover(route: RouteItem, range: Range): Hover {
  const parts = [
    route.name ? `**Route:** \`${route.name}\`` : "**Route**",
    `**Method:** \`${route.method}\``,
    `**URI:** \`${formatRouteUri(route.uri)}\``,
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
    range,
  };
}

function getRouteDefinitionContext(
  document: TextDocument,
  position: Position
): { range: Range; kind: "name" | "uri"; value: string } | null {
  const line = document.getText(
    Range.create(position.line, 0, position.line + 1, 0)
  );

  for (const quote of ["'", '"']) {
    let searchStart = 0;
    while (searchStart < line.length) {
      const openIdx = line.indexOf(quote, searchStart);
      if (openIdx === -1) break;

      const closeIdx = line.indexOf(quote, openIdx + 1);
      if (closeIdx === -1) break;

      if (position.character > openIdx && position.character <= closeIdx) {
        const beforeString = line.substring(0, openIdx);
        const value = line.substring(openIdx + 1, closeIdx);
        const range = Range.create(
          position.line,
          openIdx + 1,
          position.line,
          closeIdx
        );

        if (/->name\s*\(\s*$/.test(beforeString)) {
          return { range, kind: "name", value };
        }

        if (
          /Route::(?:get|post|put|patch|delete|options|any|match|view|redirect|permanentRedirect)\s*\(\s*$/.test(
            beforeString
          )
        ) {
          return { range, kind: "uri", value };
        }
      }

      searchStart = closeIdx + 1;
    }
  }

  return null;
}

function routeForDefinitionContext(
  document: TextDocument,
  context: { kind: "name" | "uri"; value: string },
  line: number
): RouteItem | null {
  const routes = getRoutes();

  if (context.kind === "name") {
    return routes.find((route) => route.name === context.value) ?? null;
  }

  const relative = getDocumentRelativePath(document);
  const normalizedUri = normalizeRouteUri(context.value);

  return (
    routes.find((route) => {
      if (normalizeRouteUri(route.uri) !== normalizedUri) return false;
      if (relative && route.filename && route.filename !== relative) return false;
      if (!route.line) return true;

      return Math.abs(route.line - (line + 1)) <= 3;
    }) ?? null
  );
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
        `**URI:** \`${formatRouteUri(route.uri)}\``,
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
  const controllerMethod = routesForControllerMethod(document, position);
  if (controllerMethod) {
    return {
      contents: {
        kind: "markdown",
        value: [
          `**Laravel routes for:** \`${controllerMethod.method}\``,
          ...controllerMethod.routes.map(
            (route) => `- \`${formatRouteSummary(route)}\``
          ),
        ].join("\n"),
      },
      range: controllerMethod.range,
    };
  }

  const definitionContext = getRouteDefinitionContext(document, position);
  if (definitionContext) {
    const route = routeForDefinitionContext(
      document,
      definitionContext,
      position.line
    );

    if (route) {
      return routeHover(route, definitionContext.range);
    }
  }

  const context = getRouteContext(document, position);
  if (!context) return null;

  const routes = getRoutes();
  const route = routes.find((r) => r.name === context.value);
  if (!route) return null;

  return routeHover(route, context.range);
}

export function provideRouteDefinition(
  document: TextDocument,
  position: Position
): Location | Location[] | null {
  const controllerMethod = routesForControllerMethod(document, position);
  if (controllerMethod) {
    const locations = controllerMethod.routes
      .filter((route) => route.filename)
      .map((route) => {
        const filePath = projectPath(route.filename!);
        const line = route.line ? route.line - 1 : 0;
        return Location.create(
          URI.file(filePath).toString(),
          Range.create(line, 0, line, 0)
        );
      });

    if (locations.length === 1) return locations[0];
    if (locations.length > 1) return locations;
  }

  const actionContext = getRouteActionContext(document, position);
  if (actionContext) {
    const route = getRoutes().find((candidate) =>
      routeMatchesControllerMethod(
        candidate,
        actionContext.controller,
        actionContext.method
      )
    );

    if (route?.actionFilename) {
      const filePath = projectPath(route.actionFilename);
      const line = route.actionLine ? route.actionLine - 1 : 0;

      return Location.create(
        URI.file(filePath).toString(),
        Range.create(line, 0, line, 0)
      );
    }
  }

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

export function provideRouteCodeLens(document: TextDocument): CodeLens[] {
  const lines = document.getText().split("\n");
  const lenses: CodeLens[] = [];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const match = lines[lineNum].match(
      /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/
    );
    if (!match) continue;

    const routes = routesForPhpMethod(document, match[1], lineNum);
    if (routes.length === 0) continue;

    const title =
      routes.length === 1
        ? formatRouteSummary(routes[0])
        : `${routes.length} Laravel routes`;
    const start = lines[lineNum].indexOf(match[1]);
    const end = start + match[1].length;

    lenses.push({
      range: Range.create(lineNum, start, lineNum, end),
      command: {
        title,
        command: "laravel-lsp.route",
      },
      data: routes,
    });
  }

  return lenses;
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
