import { Project } from "ts-morph";
import $, { Path } from "dax";
import {
  RealFileSystemHost,
} from "@ts-morph/common";
import { runApp } from "./app.ts";
import { DenoJsonResolver } from "./deno_json.ts";
import { RealSpecifierMapper } from "./specifiers/specifier_mapper.ts";
import { ImportMapBuilder } from "./import_map.ts";
import { RealApiLandApi } from "./apis/ApiLand.ts";
import { RealJsrApi } from "./apis/JsrApi.ts";
import { RealSlashXToJsrPkgMapper } from "./specifiers/slash_x_to_jsr_mapper.ts";
import { FileAnalyzer } from "./file_analyzer.ts";

const apiLandApi = new RealApiLandApi();
const jsrApi = new RealJsrApi();
const specifierMapper = new RealSpecifierMapper(
  new RealSlashXToJsrPkgMapper(apiLandApi, jsrApi),
);
const fileAnalyzer = new FileAnalyzer(specifierMapper);
const fileSystem = new RealFileSystemHost();
const denoJsonResolver = new DenoJsonResolver(fileSystem);

await runApp({
  fileAnalyzer,
  denoJsonResolver,
  environment: {
    fs: fileSystem,
    cwd() {
      return $.path(Deno.cwd());
    },
    exit(code?: number | undefined) {
      Deno.exit(code);
    },
    logStep(message: string, ...args: unknown[]) {
      $.logStep(message, ...args);
    },
    logWarn(message: string, ...args: unknown[]): void {
      $.logWarn(message, ...args);
      throw new Error("Function not implemented.");
    },
    log(message: string, ...args: unknown[]) {
      $.log(message, ...args);
    }
  }
});
