# Nox Language Support for Visual Studio Code

Syntax highlighting and live diagnostics for Nox project and task files.

The extension version is defined in `VERSION`. Before packaging locally, synchronize the VS Code manifest:

```sh
npm run package
```

The extension lints open `nox.build`, `noxfile`, and `nox.state` documents as you edit them. Syntax errors, malformed arrays, missing braces, unknown project or target properties, duplicate targets/tasks, invalid `install` values, and malformed state entries appear in VS Code's Problems panel with source ranges.

Recognized files:

- `nox.build`
- `noxfile`
- `nox.state`

The extension highlights Nox project declarations, targets, properties, strings, comments, booleans, numbers, and native expressions such as `file()` and `glob()`.

## Development

Open this folder in VS Code and press `F5` to launch an Extension Development Host. Open a `nox.build` or `noxfile` there to inspect the highlighting.

Use `Developer: Inspect Editor Tokens and Scopes` from the Command Palette to inspect grammar scopes.
