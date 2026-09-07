# Nox Language Support for Visual Studio Code

Minimal syntax highlighting for Nox project and task files.

The extension version is defined in `VERSION`. Before packaging locally, synchronize the VS Code manifest:

```sh
npm run package
```

Recognized files:

- `nox.build`
- `noxfile`
- `nox.state`

The extension highlights Nox project declarations, targets, properties, strings, comments, booleans, numbers, and native expressions such as `file()` and `glob()`.

## Development

Open this folder in VS Code and press `F5` to launch an Extension Development Host. Open a `nox.build` or `noxfile` there to inspect the highlighting.

Use `Developer: Inspect Editor Tokens and Scopes` from the Command Palette to inspect grammar scopes.
