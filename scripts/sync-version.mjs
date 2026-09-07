import fs from "node:fs";

const version = fs.readFileSync(new URL("../VERSION", import.meta.url), "utf8").trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`VERSION is not a valid extension version: ${version}`);
}

const packagePath = new URL("../package.json", import.meta.url);
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
packageJson.version = version;
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`package.json version synchronized to ${version}`);