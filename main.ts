import $, { CommandBuilder } from "dax";
import { RealFileSystemHost } from "@ts-morph/common";
import { type Environment, runApp } from "./app.ts";
import { DenoJsonResolver } from "./deno_json.ts";
import { RealSpecifierMapper } from "./specifiers/specifier_mapper.ts";
import { RealApiLandApi } from "./apis/ApiLand.ts";
import { RealJsrApi } from "./apis/JsrApi.ts";
import { RealSlashXToJsrPkgMapper } from "./specifiers/slash_x_to_jsr_mapper.ts";
import { FileAnalyzer } from "./file_analyzer.ts";

const cwd = $.path(Deno.cwd());
const fileSystem = new RealFileSystemHost();
const environment: Environment = {
  fs: fileSystem,
  cwd,
  async execCommand(text: string) {
    return await new CommandBuilder().command(text).text();
  },
  exit(code?: number | undefined) {
    Deno.exit(code);
  },
  logStep(message: string, ...args: unknown[]) {
    $.logStep(message, ...args);
  },
  logError(message: string, ...args: unknown[]): void {
    $.logError(message, ...args);
  },
  log(message: string, ...args: unknown[]) {
    $.log(message, ...args);
  },
};
const apiLandApi = new RealApiLandApi();
const jsrApi = new RealJsrApi();
const specifierMapper = new RealSpecifierMapper(
  new RealSlashXToJsrPkgMapper(apiLandApi, jsrApi),
);
const fileAnalyzer = new FileAnalyzer(specifierMapper, cwd);
const denoJsonResolver = new DenoJsonResolver(fileSystem);

await runApp({
  fileAnalyzer,
  denoJsonResolver,
  environment,
});
