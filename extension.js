const vscode = require("vscode");
const path = require("node:path");

const diagnosticSource = "Nox";
const projectMembers = new Set(["version", "description", "license", "edition", "dependencies"]);
const targetKinds = new Set([
  "executable",
  "static_library",
  "static",
  "shared_library",
  "shared",
  "rust_executable",
  "rust_library",
]);
const targetProperties = new Set([
  "sources",
  "dependencies",
  "depends",
  "include_dirs",
  "includes",
  "defines",
  "flags",
  "linker_flags",
  "install",
]);

function activate(context) {
  const diagnostics = vscode.languages.createDiagnosticCollection("nox");
  const lint = (document) => {
    if (document.languageId !== "nox") return;
    try {
      diagnostics.set(document.uri, lintDocument(document));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      diagnostics.set(document.uri, [runtimeDiagnostic(document, `Nox linter failed safely: ${message}`)]);
    }
  };

  context.subscriptions.push(diagnostics);
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(lint));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => lint(event.document)));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)));
  for (const document of vscode.workspace.textDocuments) lint(document);
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

function lintDocument(document) {
  const text = document.getText().replace(/^\uFEFF/, "");
  const filename = path.basename(document.uri.fsPath || document.fileName);
  const errors = filename === "nox.build"
    ? lintBuild(text)
    : filename === "noxfile"
      ? lintNoxfile(text)
      : filename === "nox.state"
        ? lintState(text)
        : [];
  return errors.map((error) => {
    const start = document.positionAt(error.start);
    const end = document.positionAt(Math.max(error.start + 1, error.end));
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(start, end),
      error.message,
      error.severity || vscode.DiagnosticSeverity.Error,
    );
    diagnostic.source = diagnosticSource;
    return diagnostic;
  });
}

function lintBuild(text) {
  const result = [];
  const tokens = tokenize(text, result);
  if (result.length) return result;
  const parser = new BuildParser(tokens, result);
  parser.parse();
  return result.slice(0, 20);
}

function tokenize(text, errors) {
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === "#") {
      index = lineEnd(text, index);
      continue;
    }
    if (character === "/" && text[index + 1] === "/") {
      index = lineEnd(text, index + 2);
      continue;
    }
    if (character === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2);
      if (end === -1) {
        errors.push({ start: index, end: text.length, message: "Unterminated block comment." });
        return tokens;
      }
      index = end + 2;
      continue;
    }
    if ("{}[]=(),".includes(character)) {
      tokens.push({ type: "symbol", value: character, start: index, end: index + 1 });
      index += 1;
      continue;
    }
    if (character === '"') {
      const start = index;
      index += 1;
      let value = "";
      let closed = false;
      while (index < text.length) {
        if (text[index] === '"') {
          closed = true;
          index += 1;
          break;
        }
        if (text[index] === "\\") {
          if (index + 1 >= text.length) break;
          value += text[index + 1];
          index += 2;
        } else {
          value += text[index];
          index += 1;
        }
      }
      if (!closed) {
        const lineEnd = text.indexOf("\n", start);
        const diagnosticEnd = lineEnd === -1 ? text.length : lineEnd;
        const firstLine = text.slice(start + 1, diagnosticEnd).trim();
        const detail = firstLine ? ` after \"${firstLine}\"` : "";
        errors.push({
          start,
          end: Math.max(start + 1, diagnosticEnd),
          message: `Unterminated string literal${detail}: expected a closing \" before the end of this line.`,
        });
        return tokens;
      }
      tokens.push({ type: "string", value, start, end: index });
      continue;
    }
    const start = index;
    while (index < text.length && !/\s/.test(text[index]) && !"{}[]=(),\"".includes(text[index])) index += 1;
    tokens.push({ type: "word", value: text.slice(start, index), start, end: index });
  }
  return tokens;
}

function lineEnd(text, index) {
  const end = text.indexOf("\n", index);
  return end === -1 ? text.length : end + 1;
}

class BuildParser {
  constructor(tokens, errors) {
    this.tokens = tokens;
    this.errors = errors;
    this.index = 0;
    this.targets = new Map();
  }

  parse() {
    if (!this.expectWord("project", "Expected a project declaration at the beginning of the file.")) return;
    this.takeValue("project name");
    this.expectSymbol("{", "Expected `{` after the project name.");
    let projectClosed = false;
    while (!this.atEnd()) {
      if (this.takeSymbol("}")) {
        projectClosed = true;
        break;
      }
      const member = this.takeWord();
      if (!member) {
        this.errorCurrent("Expected a project member.");
        this.recover();
        continue;
      }
      if (member.value === "project") {
        this.errorAtPrevious("Projects cannot be nested.");
      } else if (targetKinds.has(member.value)) {
        this.parseTarget(member.value);
      } else if (projectMembers.has(member.value)) {
        this.parseProjectProperty(member.value);
      } else {
        this.errorAtPrevious(`Unknown project member \`${member.value}\`.`);
        this.recover();
      }
    }
    if (!projectClosed) {
      this.errorCurrent("Expected `}` to close the project declaration.");
    }
    for (const target of this.targets.values()) {
      for (const dependency of target.dependencies) {
        if (!this.targets.has(dependency)) {
          this.errors.push({ start: target.start, end: target.end, message: `Unknown target dependency \`${dependency}\`.` });
        }
      }
    }
  }

  parseProjectProperty(property) {
    this.expectSymbol("=", `Expected \`=\` after ${property}.`);
    if (property === "dependencies") this.parseArray("dependency");
    else if (property === "version") this.parseValueOrFile("version");
    else this.takeValue(property);
  }

  parseTarget(kind) {
    const name = this.takeValue("target name");
    if (!name) return;
    this.expectSymbol("{", `Expected \`{\` after ${kind} target name.`);
    const target = { name: name.value, dependencies: [], start: name.start, end: name.end };
    if (this.targets.has(target.name)) this.errors.push({ start: name.start, end: name.end, message: `Duplicate target \`${target.name}\`.` });
    this.targets.set(target.name, target);
    let targetClosed = false;
    while (!this.atEnd()) {
      if (this.takeSymbol("}")) {
        targetClosed = true;
        break;
      }
      const property = this.takeWord();
      if (!property) {
        this.errorCurrent("Expected a target property.");
        this.recover();
        continue;
      }
      if (!targetProperties.has(property.value)) {
        this.errorAtPrevious(`Unknown target property \`${property.value}\`.`);
        this.recover();
        continue;
      }
      this.expectSymbol("=", `Expected \`=\` after ${property.value}.`);
      if (property.value === "dependencies" || property.value === "depends") {
        target.dependencies = this.parseArray("dependency");
      } else if (property.value === "install") {
        const value = this.takeWord();
        if (!value || !["true", "false"].includes(value.value)) this.errors.push({ start: value?.start || this.currentStart(), end: value?.end || this.currentEnd(), message: "Expected `true` or `false` for install." });
      } else if (property.value === "sources") {
        if (this.peek()?.value === "glob") this.parseCall("glob");
        else this.parseArray("source");
      } else {
        this.parseArray(property.value);
      }
    }
    if (!targetClosed) this.errorCurrent(`Expected \`}\` to close target \`${target.name}\`.`);
  }

  parseValueOrFile(label) {
    if (this.peek()?.value === "file") this.parseCall("file");
    else this.takeValue(label);
  }

  parseCall(name) {
    this.expectWord(name, `Expected ${name}(...).`);
    this.expectSymbol("(", `Expected \`(\` after ${name}.`);
    this.takeValue(`${name} argument`);
    this.expectSymbol(")", `Expected \`)\` after ${name} argument.`);
  }

  parseArray(label) {
    const values = [];
    this.expectSymbol("[", `Expected an array of ${label} values.`);
    while (!this.atEnd() && !this.takeSymbol("]")) {
      const before = this.index;
      const value = this.takeValue(label);
      if (value) values.push(value.value);
      if (!this.takeSymbol(",") && this.peek()?.value !== "]") this.errorCurrent("Expected `,` between array values.");
      if (this.index === before && !this.atEnd()) this.index += 1;
    }
    return values;
  }

  expectWord(value, message) {
    const token = this.peek();
    if (token?.value === value) {
      this.index += 1;
      return true;
    }
    this.errors.push({ start: token?.start || 0, end: token?.end || 1, message });
    return false;
  }

  expectSymbol(value, message) {
    return this.expectWord(value, message);
  }

  takeWord() {
    const token = this.peek();
    if (!token || token.type !== "word") return null;
    this.index += 1;
    return token;
  }

  takeSymbol(value) {
    const token = this.peek();
    if (!token || token.type !== "symbol" || token.value !== value) return false;
    this.index += 1;
    return true;
  }

  takeValue(label) {
    const token = this.peek();
    if (!token || !["word", "string"].includes(token.type)) {
      this.errors.push({ start: token?.start || 0, end: token?.end || 1, message: `Expected ${label}.` });
      return null;
    }
    this.index += 1;
    return token;
  }

  peek() { return this.tokens[this.index]; }
  atEnd() { return this.index >= this.tokens.length; }
  currentStart() { return this.peek()?.start || 0; }
  currentEnd() { return this.peek()?.end || this.currentStart() + 1; }
  errorCurrent(message) { this.errors.push({ start: this.currentStart(), end: this.currentEnd(), message }); }
  errorAtPrevious(message) { const token = this.tokens[this.index - 1]; this.errors.push({ start: token.start, end: token.end, message }); }
  recover() {
    const start = this.index;
    while (!this.atEnd() && !["}", "{"].includes(this.peek().value)) this.index += 1;
    if (this.index === start && !this.atEnd()) this.index += 1;
  }
}

function lintNoxfile(text) {
  const errors = [];
  let tasks = false;
  const taskNames = new Set();
  text.split(/\r?\n/).forEach((line, lineIndex) => {
    const indentation = line.length - line.trimStart().length;
    const value = line.trim();
    if (!value || value.startsWith("#")) return;
    if (value === "tasks:") {
      tasks = true;
      return;
    }
    if (tasks && indentation <= 2 && !value.endsWith(":")) errors.push(lineError(text, lineIndex, line, "Expected a task name ending with `:`."));
    if (tasks && indentation > 0 && value.endsWith(":") && indentation <= 4) {
      const name = value.slice(0, -1).trim();
      if (taskNames.has(name)) errors.push(lineError(text, lineIndex, line, `Duplicate task \`${name}\`.`));
      taskNames.add(name);
    }
    if (tasks && value.startsWith("run:") && !value.slice(4).trim()) errors.push(lineError(text, lineIndex, line, "Task run command cannot be empty."));
  });
  return errors;
}

function lintState(text) {
  const errors = [];
  text.split(/\r?\n/).forEach((line, lineIndex) => {
    if (!line.trim()) return;
    if (!/^[^=\s]+=.*/.test(line)) errors.push(lineError(text, lineIndex, line, "Expected a `key=value` state entry."));
  });
  return errors;
}

function lineError(text, lineIndex, line, message) {
  const start = text.split(/\r?\n/).slice(0, lineIndex).reduce((total, current) => total + current.length + 1, 0);
  return { start, end: start + Math.max(1, line.length), message };
}

module.exports = { activate, lintBuild, lintNoxfile, lintState };
