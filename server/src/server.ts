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
  CodeAction,
  TextEdit,
  Diagnostic,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let workspaceRoot: string | null = null;

connection.onInitialize((params: InitializeParams): InitializeResult => {
  if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    workspaceRoot = params.workspaceFolders[0].uri;
  } else if (params.rootUri) {
    workspaceRoot = params.rootUri;
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
      codeActionProvider: true,
      documentFormattingProvider: true,
    },
  };
});

connection.onInitialized(() => {
  connection.console.log("Laravel LSP server ready.");
  // TODO: Wire up repository initialization here
});

connection.onCompletion((): CompletionItem[] => {
  return [];
});

connection.onHover((): Hover | null => {
  return null;
});

connection.onDefinition((): Definition | null => {
  return null;
});

connection.onCodeAction((): CodeAction[] => {
  return [];
});

connection.onDocumentFormatting((): TextEdit[] => {
  return [];
});

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const diagnostics: Diagnostic[] = [];
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

documents.listen(connection);
connection.listen();
