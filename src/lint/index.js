const { lintBuild } = require("./build");

function lintDocument(text, filename) {
  if (filename === "nox.build") return lintBuild(text);
  if (filename === "noxfile") return lintNoxfile(text);
  if (filename === "nox.state") return lintState(text);
  return [];
}

function lintNoxfile(text) {
  const errors = [];
  let tasks = false;
  let tasksIndent = 0;
  let taskIndent = 0;
  let runIndent = null;
  const taskNames = new Set();
  text.split(/\r?\n/).forEach((line, lineIndex) => {
    const indentation = line.length - line.trimStart().length;
    const value = line.trim();
    if (!value || value.startsWith("#")) return;
    if (value === "tasks:") {
      tasks = true;
      tasksIndent = indentation;
      return;
    }
    if (!tasks) return;
    if (runIndent !== null) {
      if (indentation > runIndent) return;
      runIndent = null;
    }
    if (indentation > taskIndent && value.startsWith("run:")) {
      const command = value.slice(5).trim();
      if (!command)
        errors.push(
          lineError(text, lineIndex, line, "Task run command cannot be empty."),
        );
      if (command === "|" || command === ">") runIndent = indentation;
      return;
    }
    if (
      indentation > tasksIndent &&
      indentation <= tasksIndent + 4 &&
      value.endsWith(":")
    ) {
      const name = value.slice(0, -1).trim();
      if (taskNames.has(name))
        errors.push(
          lineError(text, lineIndex, line, `Duplicate task \`${name}\`.`),
        );
      taskNames.add(name);
      taskIndent = indentation;
      return;
    }
    if (
      indentation > tasksIndent &&
      indentation <= tasksIndent + 4 &&
      !value.startsWith("@nox")
    )
      errors.push(
        lineError(
          text,
          lineIndex,
          line,
          "Expected a task name ending with `:`.",
        ),
      );
    if (indentation <= tasksIndent || indentation <= taskIndent)
      errors.push(
        lineError(
          text,
          lineIndex,
          line,
          "Expected a task name ending with `:`.",
        ),
      );
  });
  return errors;
}

function lintState(text) {
  const errors = [];
  text.split(/\r?\n/).forEach((line, lineIndex) => {
    if (!line.trim()) return;
    if (!/^[^=\s]+=.*/.test(line))
      errors.push(
        lineError(text, lineIndex, line, "Expected a `key=value` state entry."),
      );
  });
  return errors;
}

function lineError(text, lineIndex, line, message) {
  const start = text
    .split(/\r?\n/)
    .slice(0, lineIndex)
    .reduce((total, current) => total + current.length + 1, 0);
  return { start, end: start + Math.max(1, line.length), message };
}

module.exports = { lintDocument, lintNoxfile, lintState };
