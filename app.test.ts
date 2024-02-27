import { InMemoryFileSystemHost } from "ts-morph";
import { Environment, runApp } from "./app.ts";
import { FileAnalyzer } from "./file_analyzer.ts";
import $ from "dax";
import { JsrApi } from "./apis/JsrApi.ts";
import { ApiLandApi } from "./apis/ApiLand.ts";
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
    '  1. Fill in the "name" field in ./deno.jsonc',
    '  2. Fill in the "version" field in ./deno.jsonc',
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
