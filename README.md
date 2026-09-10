# [Nox](https://github.com/playfairs/nox) v1.1.5 Language Support for Visual Studio Code

Syntax highlighting and live diagnostics for Nox project and task files. This
extension supports Nox versions up to and including `v1.1.5`.

The extension version is defined in `VERSION`. Before packaging locally, synchronize the VS Code manifest:

```sh
npm run package
```

The extension lints open `nox.build`, `noxfile`, and `nox.state` documents as you edit them. Syntax errors, malformed arrays, missing braces, unknown project or target properties, duplicate targets/tasks/bindings, invalid `install` values, and malformed state entries appear in VS Code's Problems panel with source ranges. The `nox.build` linter recognizes project-level `let` bindings, binding references, and `cxx_executable` targets.

Recognized files:

- `nox.build`
- `noxfile`
- `nox.state`

The extension highlights Nox project declarations, `let` bindings, targets, properties, strings, comments, booleans, numbers, and native expressions such as `file()` and `glob()`.

The runtime is organized under `src/`: activation lives in `src/extension.js`, document linting in `src/lint/index.js`, and build parsing in `src/lint/build.js`.

## Development

Open this folder in VS Code and press `F5` to launch an Extension Development Host. Open a `nox.build` or `noxfile` there to inspect the highlighting.

Use `Developer: Inspect Editor Tokens and Scopes` from the Command Palette to inspect grammar scopes.

Run `npm test` to verify build-file linting, including D targets such as `d_executable`.

Run `nox task install` to package the extension, remove the existing
`playfairs.nox-language-support` installation, and install the new VSIX.
On macOS, it falls back to launching Visual Studio Code with `open` when the
`code` command is not on your `PATH`.
