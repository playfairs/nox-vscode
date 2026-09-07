const assert = require("node:assert/strict");
const { lintBuild } = require("../src/lint/build");

const source = `project "ripnet" {
  version = file("./VERSION")
  d_executable "ripnet" {
    sources = ["src/main.d"]
    install = true
  }
}`;

assert.deepEqual(lintBuild(source), []);
