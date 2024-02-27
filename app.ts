import { FileSystemHost } from "@ts-morph/common";
import { Project } from "ts-morph";
import { Path } from "dax";
import { DenoJsonResolver } from "./deno_json.ts";
import { ImportMapBuilder } from "./import_map.ts";
import { FileAnalyzer } from "./file_analyzer.ts";

export interface Environment {
  fs: FileSystemHost;
  cwd: Path;
  execCommand(text: string): Promise<string>;
  exit(code?: number): void;
  logStep(message: string, ...args: unknown[]): void;
  logError(message: string, ...args: unknown[]): void;
  log(message: string, ...args: unknown[]): void;
}

export interface AppOptions {
  fileAnalyzer: FileAnalyzer;
  denoJsonResolver: DenoJsonResolver;
  environment: Environment;
}

export async function runApp({
  fileAnalyzer,
  denoJsonResolver,
  environment,
}: AppOptions) {
  const { log, logStep, logError, fs } = environment;
  const cwd = environment.cwd;
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
  if (
    (await environment.execCommand("git rev-parse --is-inside-work-tree")) !==
      "true"
  ) {
    logError("Failed Not a git repository.");
    environment.exit(1);
    return;
  }
  if (
    (await environment.execCommand("git status --porcelain")).trim().length > 0
  ) {
    logError(
      "Failed Git directory has pending changes. Please check in all changes before running this tool.",
    );
    environment.exit(1);
    return;
  }

  logStep("Building...");

  const fileAnalyzerSteps: string[] = [];
  const scriptPaths = [];
  const jsonPaths = [];
  for (const path of walkFs(fs, cwd)) {
    logStep("Analyzing", path.toString());
    const ext = path.extname();
    if (
      ext === ".ts" || ext === ".tsx" || ext === ".mjs" ||
      ext === ".js" || ext === ".jsx"
    ) {
      scriptPaths.push(path);
      jsonPaths.push(path);
      const file = project.addSourceFileAtPath(path.toString());
      const foundSteps = await fileAnalyzer.analyzeFile(file, importMapBuilder);
      fileAnalyzerSteps.push(...foundSteps);
    } else if (ext === ".json") {
      jsonPaths.push(path);
    }
  }

  logStep("Saving...");
  project.saveSync();
  const imports = importMapBuilder.build();
  const outputObj = {
    name: "",
    version: "",
    exports: undefined as string | Record<string, string> | undefined,
    ...denoJson.value,
    imports,
  };
  if (outputObj.exports == null) {
    if (fs.fileExistsSync(cwd.join("mod.ts").toString())) {
      outputObj.exports = "./mod.ts";
    } else {
      outputObj.exports = {
        ...[...scriptPaths, ...jsonPaths].map((p) => {
          const path = "./" + cwd.relative(p);
          return { [path.toString()]: path.toString() };
        }).reduce((a, b) => ({ ...a, ...b }), {}),
      };
    }
  }
  fs.writeFileSync(
    denoJson.path.toString(),
    JSON.stringify(outputObj, undefined, 2),
  );
  logStep("Done!");
  outputSteps(denoJson.path);

  function outputSteps(denoJsonPath: Path) {
    const steps = getSteps(denoJsonPath);
    if (steps.length === 0) {
      return;
    }
    log("");
    log("Next steps:");
    for (const [i, step] of steps.entries()) {
      const count = i + 1;
      log(`  ${count}. ${hangingIndent(step, 4 + count.toString().length)}`);
    }
  }

  function getSteps(denoJsonPath: Path) {
    const relativeDenoJson = "./" + cwd.relative(denoJsonPath);
    const remoteImportMessage = [
      "If this is used by any export of the package, it will need ",
      "to be updated it to a jsr: or npm: import before publishing.",
    ].join("\n");
    const steps = [];
    if (outputObj.name.length === 0) {
      steps.push(`Fill in the "name" field in ${relativeDenoJson}`);
    }
    if (outputObj.version.length === 0) {
      steps.push(`Fill in the "version" field in ${relativeDenoJson}`);
    }
    for (const [key, value] of Object.entries(imports)) {
      if (value.startsWith("http:") || value.startsWith("https:")) {
        steps.push(
          `In ${relativeDenoJson}, the import "${key}" is a remote import.\n\n${remoteImportMessage}`,
        );
      }
    }
    for (const url of importMapBuilder.getUnmappedRemoteImports()) {
      steps.push(
        `Unmapped remote import:\n\n  ${url}\n\n${remoteImportMessage}`,
      );
    }
    steps.push(...fileAnalyzerSteps);
    return steps;
  }

  function hangingIndent(text: string, indent = 2) {
    return text.replace(/\n/g, "\n" + " ".repeat(indent));
  }
}

function* walkFs(fs: FileSystemHost, dir: Path): Iterable<Path> {
  for (const entry of fs.readDirSync(dir.toString())) {
    if (entry.isFile) {
      yield dir.join(entry.name);
    } else if (entry.isDirectory) {
      if (
        entry.name !== ".git" && entry.name !== ".DS_STORE" &&
        entry.name !== "dist" && entry.name !== "build" &&
        entry.name !== "out" && entry.name !== "target"
      ) {
        yield* walkFs(fs, dir.join(entry.name));
      }
    }
  }
}
