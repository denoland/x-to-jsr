import { FileSystemHost } from "@ts-morph/common";
import { Project } from "ts-morph";
import $, { Path } from "dax";
import { DenoJsonResolver } from "./deno_json.ts";
import { ImportMapBuilder } from "./import_map.ts";
import { FileAnalyzer } from "./file_analyzer.ts";

export interface Environment {
  fs: FileSystemHost;
  cwd(): Path;
  exit(code?: number): void;
  logStep(message: string, ...args: unknown[]): void;
  logWarn(message: string, ...args: unknown[]): void;
  log(message: string, ...args: unknown[]): void;
}

export interface AppOptions {
  fileAnalyzer: FileAnalyzer;
  denoJsonResolver: DenoJsonResolver;
  environment: Environment
}

export async function runApp({
  fileAnalyzer,
  denoJsonResolver,
  environment,
}: AppOptions) {
  const { log, logStep, logWarn, fs } = environment;
  const cwd = environment.cwd();
  const denoJson = denoJsonResolver.resolve(cwd);
  if (denoJson === "exit") {
    environment.exit(1);
    return;
  }
  const importMapBuilder = new ImportMapBuilder(denoJson.value.imports ?? {});
  const project = new Project({
    fileSystem: fs,
  });

  logStep("Analyzing", cwd.toString());
  logWarn("WARNING This will modify the files in this directory.");
  log("Please check in all code to source control before continuing.");
  const confirmed = await $.confirm(`Continue?`, {
    default: false,
  });
  if (!confirmed) {
    environment.logWarn("Aborted.");
    Deno.exit(1);
  }

  const packageName = denoJson.value.name ??
    await $.prompt("Enter package name:");
  logStep("Building", packageName);

  const entries = cwd.walkSync({
    includeDirs: false,
    includeFiles: true,
    skip: [/(\/|\\)(\.git|.DS_Store|dist|build|out|target)$/],
  });
  const scriptPaths = [];
  const jsonPaths = [];
  for (const entry of entries) {
    logStep("Analyzing", entry.path.toString());
    if (!entry.isFile) {
      continue;
    }
    const ext = entry.path.extname();
    if (
      ext === ".ts" || ext === ".tsx" || ext === ".mjs" ||
      ext === ".js" || ext === ".jsx"
    ) {
      scriptPaths.push(entry.path);
      jsonPaths.push(entry.path);
      const file = project.addSourceFileAtPath(entry.path.toString());
      await fileAnalyzer.analyzeFile(file, importMapBuilder);
    } else if (ext === ".json") {
      jsonPaths.push(entry.path);
    }
  }

  logStep("Saving...");
  project.saveSync();
  fs.writeFileSync(
    denoJson.path.toString(),
    JSON.stringify({
    ...denoJson.value,
    imports: importMapBuilder.build(),
  }, undefined, 2));
  logStep("Done.");
}
