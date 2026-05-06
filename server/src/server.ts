import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  Hover,
  Definition,
  CodeLens,
  CodeAction,
  TextEdit,
  Diagnostic,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { setWorkspaceRoot } from "./support/project";
import { initViewsRepository } from "./repositories/views";
import { initRoutesRepository } from "./repositories/routes";
import {
  provideViewCompletion,
  provideViewHover,
  provideViewDefinition,
  provideViewDiagnostics,
} from "./features/views";
import {
  provideRouteCompletion,
  provideRouteHover,
  provideRouteDefinition,
  provideRouteCodeLens,
  provideRouteDiagnostics,
} from "./features/routes";

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let workspaceRoot: string | null = null;

connection.onInitialize((params: InitializeParams): InitializeResult => {
  if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    workspaceRoot = params.workspaceFolders[0].uri;
  } else if (params.rootUri) {
    workspaceRoot = params.rootUri;
  }

  // Strip file:// prefix from URI to get filesystem path
  if (workspaceRoot && workspaceRoot.startsWith("file://")) {
    workspaceRoot = workspaceRoot.replace(/^file:\/\//, "");
    // Handle URL-encoded characters
    workspaceRoot = decodeURIComponent(workspaceRoot);
  }

  connection.console.log(
    `Laravel LSP initializing. Workspace root: ${workspaceRoot}`
  );

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ["'", '"', "."],
      },
      hoverProvider: true,
      definitionProvider: true,
      codeLensProvider: {
        resolveProvider: false,
      },
      codeActionProvider: true,
      documentFormattingProvider: true,
    },
  };
});

connection.onInitialized(() => {
  connection.console.log("Laravel LSP server ready.");

  if (workspaceRoot) {
    setWorkspaceRoot(workspaceRoot);
    initViewsRepository(connection);
    initRoutesRepository(connection);
  }
});

connection.onCompletion((params): CompletionItem[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const position = params.position;

  const viewCompletions = provideViewCompletion(document, position);
  const routeCompletions = provideRouteCompletion(document, position);

  return [...viewCompletions, ...routeCompletions];
});

connection.onHover((params): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const position = params.position;

  const viewHover = provideViewHover(document, position);
  if (viewHover) return viewHover;

  const routeHover = provideRouteHover(document, position);
  if (routeHover) return routeHover;

  return null;
});

connection.onDefinition((params): Definition | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const position = params.position;

  const viewDef = provideViewDefinition(document, position);
  if (viewDef) return viewDef;

  const routeDef = provideRouteDefinition(document, position);
  if (routeDef) return routeDef;

  return null;
});

connection.onCodeAction((): CodeAction[] => {
  return [];
});

connection.onCodeLens((params): CodeLens[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  return provideRouteCodeLens(document);
});

connection.onDocumentFormatting((): TextEdit[] => {
  return [];
});

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const viewDiagnostics = provideViewDiagnostics(textDocument);
  const routeDiagnostics = provideRouteDiagnostics(textDocument);

  const diagnostics: Diagnostic[] = [
    ...viewDiagnostics,
    ...routeDiagnostics,
  ];

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

documents.listen(connection);
connection.listen();
