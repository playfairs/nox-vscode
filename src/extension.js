const vscode = require("vscode");
const path = require("node:path");
const { lintDocument } = require("./lint");

const diagnosticSource = "Nox";

function activate(context) {
  const diagnostics = vscode.languages.createDiagnosticCollection("nox");
  const lint = (document) => {
    if (document.languageId !== "nox") return;
    if (isExcluded(document)) {
      diagnostics.delete(document.uri);
      return;
    }
    try {
      diagnostics.set(document.uri, toDiagnostics(document));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      diagnostics.set(document.uri, [
        runtimeDiagnostic(document, `Nox linter failed safely: ${message}`),
      ]);
    }
  };

  context.subscriptions.push(diagnostics);
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(lint));
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => lint(event.document)),
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) =>
      diagnostics.delete(document.uri),
    ),
  );
  for (const document of vscode.workspace.textDocuments) lint(document);
}

function isExcluded(document) {
  const excludes = vscode.workspace
    .getConfiguration("nox.lint", document.uri)
    .get("exclude", []);
  if (!Array.isArray(excludes)) return false;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) return false;
  const relativePath = path
    .relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
    .split(path.sep)
    .join("/");
  return excludes.some(
    (entry) => typeof entry === "string" && entry.replaceAll("\\", "/") === relativePath,
  );
}

function toDiagnostics(document) {
  const filename = path.basename(document.uri.fsPath || document.fileName);
  return lintDocument(document.getText().replace(/^\uFEFF/, ""), filename).map(
    (error) => {
      const start = document.positionAt(error.start);
      const end = document.positionAt(Math.max(error.start + 1, error.end));
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(start, end),
        error.message,
        error.severity || vscode.DiagnosticSeverity.Error,
      );
      diagnostic.source = diagnosticSource;
      return diagnostic;
    },
  );
}

function runtimeDiagnostic(document, message) {
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1)),
    message,
    vscode.DiagnosticSeverity.Error,
  );
  diagnostic.source = diagnosticSource;
  return diagnostic;
}

module.exports = { activate };
