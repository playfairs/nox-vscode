const assert = require("node:assert/strict");
const { lintBuild } = require("../src/lint/build");

const source = `project "ripnet" {
  version = file("./VERSION")
  version_files = ["VERSION", "package.json"]
  d_executable "ripnet" {
    sources = ["src/main.d"]
    install = true
  }
}`;

assert.deepEqual(lintBuild(source), []);

const currentSyntax = `project "example" {
  let source_files = ["main.c"]
  let include_paths = ["include"]
  let warning_flags = ["-Wall", "-Wextra"]
  let should_install = true

  executable "app" {
    sources = source_files
    include_dirs = include_paths
    flags = warning_flags
    install = should_install
  }

  cxx_executable "cpp-app" {
    sources = ["main.cpp"]
  }
}`;

assert.deepEqual(lintBuild(currentSyntax), []);

const duplicateBinding = `project "example" {
  let flags = ["-Wall"]
  let flags = ["-Wextra"]
  executable "app" {
    sources = ["main.c"]
  }
}`;

assert.equal(lintBuild(duplicateBinding)[0].message, "Duplicate binding `flags`.");
