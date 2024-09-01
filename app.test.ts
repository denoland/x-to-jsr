import { InMemoryFileSystemHost } from "ts-morph";
import { type Environment, runApp } from "./app.ts";
import { FileAnalyzer } from "./file_analyzer.ts";
import $ from "dax";
import type { JsrApi } from "./apis/JsrApi.ts";
import type { ApiLandApi } from "./apis/ApiLand.ts";
import { RealSpecifierMapper } from "./specifiers/specifier_mapper.ts";
import { RealSlashXToJsrPkgMapper } from "./specifiers/slash_x_to_jsr_mapper.ts";
import { DenoJsonResolver } from "./deno_json.ts";
import { assertEquals } from "@std/assert";

class TestEnvironment implements Environment, JsrApi, ApiLandApi {
  fs = new InMemoryFileSystemHost();
  cwd = $.path("/");

  isGitRepo = true;
  hasLocalChanges = false;

  execCommand = (text: string) => {
    if (text === "git rev-parse --is-inside-work-tree") {
      return Promise.resolve(this.isGitRepo ? "true" : "false");
    }
    if (text === "git status --porcelain") {
      return Promise.resolve(this.hasLocalChanges ? "M file.ts" : "");
    }
    throw new Error(`Not implemented command: ${text}`);
  };

  exitCode: number | undefined;

  exit = (code?: number | undefined) => {
    this.exitCode = code;
  };

  logs: string[] = [];

  logStep = (message: string, ...args: unknown[]) => {
    this.log("STEP:", message, ...args);
  };

  logError = (message: string, ...args: unknown[]) => {
    this.log("ERROR:", message, ...args);
  };

  log = (message: string, ...args: unknown[]) => {
    let finalMessage = message;
    for (const arg of args) {
      finalMessage += " " + arg;
    }
    this.logs.push(finalMessage);
  };

  getModule = (_moduleName: string) => {
    throw new Error("Method not implemented.");
  };

  getPackageByGithubRepoId = (_repoId: number) => {
    throw new Error("Method not implemented.");
  };
}

Deno.test("runs the app when there's nothing in the directory", async () => {
  const appOptions = build();
  const env = appOptions.environment;
  await runApp(appOptions);
  assertEquals(env.exitCode, undefined);
  assertEquals(env.logs, [
    "STEP: Analyzing /",
    "STEP: Building...",
    "STEP: Saving...",
    "STEP: Done!",
    "",
    "Next steps:",
    '  1. Fill in the "name" field in ./deno.json',
    '  2. Fill in the "version" field in ./deno.json',
  ]);
});

Deno.test("errors when not a git repo", async () => {
  const appOptions = build();
  const env = appOptions.environment;
  env.isGitRepo = false;
  await runApp(appOptions);
  assertEquals(env.exitCode, 1);
  assertEquals(env.logs, [
    "STEP: Analyzing /",
    "ERROR: Failed Not a git repository.",
  ]);
});

Deno.test("errors when has local git changes", async () => {
  const appOptions = build();
  const env = appOptions.environment;
  env.hasLocalChanges = true;
  await runApp(appOptions);
  assertEquals(env.exitCode, 1);
  assertEquals(env.logs, [
    "STEP: Analyzing /",
    "ERROR: Failed Git directory has pending changes. Please check in all changes before running this tool.",
  ]);
});

Deno.test("runs the app when there's a mod.ts file", async () => {
  const appOptions = build();
  const env = appOptions.environment;
  env.fs.writeFileSync("/mod.ts", "export class Test {}");
  await runApp(appOptions);
  assertEquals(env.exitCode, undefined);
  assertEquals(env.logs, [
    "STEP: Analyzing /",
    "STEP: Building...",
    "STEP: Analyzing /mod.ts",
    "STEP: Saving...",
    "STEP: Done!",
    "",
    "Next steps:",
    '  1. Fill in the "name" field in ./deno.json',
    '  2. Fill in the "version" field in ./deno.json',
  ]);
  assertEquals(
    env.fs.readFileSync("/deno.json"),
    `{
  "name": "",
  "version": "",
  "exports": "./mod.ts",
  "imports": {}
}
`,
  );
});

Deno.test("creates multiple exports when no mod.ts", async () => {
  const appOptions = build();
  const env = appOptions.environment;
  env.fs.writeFileSync("/.git/asdf.ts", "export class Asdf {}");
  env.fs.writeFileSync("/asdf.ts", "export class Asdf {}");
  env.fs.writeFileSync("/other.ts", "export class Other {}");
  env.fs.writeFileSync("/sub_dir/mod.ts", "export class SubDir {}");
  await runApp(appOptions);
  assertEquals(env.exitCode, undefined);
  assertEquals(env.logs, [
    "STEP: Analyzing /",
    "STEP: Building...",
    "STEP: Analyzing /sub_dir/mod.ts",
    "STEP: Analyzing /asdf.ts",
    "STEP: Analyzing /other.ts",
    "STEP: Saving...",
    "STEP: Done!",
    "",
    "Next steps:",
    '  1. Fill in the "name" field in ./deno.json',
    '  2. Fill in the "version" field in ./deno.json',
    "  3. Make sure the exports in ./deno.json are how you want the exports.",
  ]);
  assertEquals(
    env.fs.readFileSync("/deno.json"),
    `{
  "name": "",
  "version": "",
  "exports": {
    "./sub_dir/mod.ts": "./sub_dir/mod.ts",
    "./asdf.ts": "./asdf.ts",
    "./other.ts": "./other.ts"
  },
  "imports": {}
}
`,
  );
});

function build() {
  const env = new TestEnvironment();
  const slashXToSpecifierMapper = new RealSlashXToJsrPkgMapper(env, env);
  const specifierMapper = new RealSpecifierMapper(slashXToSpecifierMapper);
  const fileAnalyzer = new FileAnalyzer(specifierMapper, env.cwd);
  const denoJsonResolver = new DenoJsonResolver(env.fs);
  return {
    environment: env,
    fileAnalyzer,
    denoJsonResolver,
  };
}
