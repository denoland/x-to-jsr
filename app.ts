import { FileSystemHost } from "@ts-morph/common";
import { Project } from "ts-morph";
import { Path } from "dax";
import { DenoJsonResolver } from "./deno_json.ts";
import { ImportMapBuilder } from "./import_map.ts";
import { FileAnalyzer } from "./file_analyzer.ts";

export interface Environment {
  fs: FileSystemHost;
  cwd(): Path;
  execCommand(text: string): Promise<string>;
  exit(code?: number): void;
  logStep(message: string, ...args: unknown[]): void;
  logError(message: string, ...args: unknown[]): void;
  logWarn(message: string, ...args: unknown[]): void;
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
  const { logStep, logError, fs } = environment;
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
    JSON.stringify(
      {
        name: "",
        version: "",
        ...denoJson.value,
        imports: importMapBuilder.build(),
      },
      undefined,
      2,
    ),
  );
  logStep("Done.");
}
