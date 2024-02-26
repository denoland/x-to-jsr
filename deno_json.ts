import $, { Path } from "dax";
import { errors, FileSystemHost } from "@ts-morph/common";

export interface DenoJson {
  path: Path;
  value: DenoJsonValue;
}

export interface DenoJsonValue {
  name?: string;
  version?: string;
  imports?: Record<string, string>;
}

export class DenoJsonResolver {
  #fileSystem: FileSystemHost;

  constructor(fileSystem: FileSystemHost) {
    this.#fileSystem = fileSystem;
  }

  resolve(cwd: Path): DenoJson | "exit" {
    const denoJson = cwd.join("deno.json");
    if (this.#fileSystem.fileExistsSync(denoJson.toString())) {
      const json = this.#tryReadJson(denoJson);
      if (json === "exit") {
        return json;
      }
      return {
        path: denoJson,
        value: json ?? {},
      };
    } else {
      const denoJsonc = cwd.join("deno.jsonc");
      const json = this.#tryReadJson(denoJsonc);
      if (json === "exit") {
        return json;
      }
      return {
        path: denoJsonc,
        value: json ?? {},
      };
    }
  }

  #tryReadJson(path: Path) {
    try {
      const content = this.#fileSystem.readFileSync(path.toString());
      return JSON.parse(content) as DenoJsonValue;
    } catch (err) {
      if (err instanceof errors.FileNotFoundError) {
        return undefined;
      }
      $.logError(
        `error: failed reading JSON file '${path}'. Only JSON files without comments are supported at the moment.`,
        err,
      );
      return "exit";
    }
  }
}
