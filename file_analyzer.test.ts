import { SpecifierMapper } from "./specifiers/specifier_mapper.ts";
import { FileAnalyzer } from "./file_analyzer.ts";
import { assertEquals } from "@std/assert";
import { InMemoryFileSystemHost, Project } from "ts-morph";
import { ImportMapBuilder } from "./import_map.ts";
import $ from "dax";

Deno.test("file analyzer", async () => {
  const mapper: SpecifierMapper = {
    map(specifier: string) {
      if (specifier === "https://deno.land/x/abc@1.0.0/export.ts") {
        return Promise.resolve({
          bareSpecifier: "@scope/abc",
          base: "jsr:@scope/abc@1",
          subpath: "export",
        });
      } else if (specifier === "https://deno.land/std@0.193.0/path/mod.ts") {
        return Promise.resolve({
          bareSpecifier: "@std/path",
          base: "jsr:@std/path@0.193",
          subpath: undefined,
        });
      }
      return Promise.resolve(undefined);
    },
  };
  const cwd = $.path("/home/jsr/");
  const analyzer = new FileAnalyzer(mapper, cwd);
  const fileSystem = new InMemoryFileSystemHost();
  const project = new Project({
    fileSystem,
  });
  const file = project.createSourceFile(
    cwd.join("file.ts").toString(),
    `import "https://deno.land/x/abc@1.0.0/export.ts";
import "https://deno.land/std@0.193.0/path/mod.ts";
import "./other.ts";

global {
  interface GlobalTest {}
}

declare module "test" {
}
`,
  );
  const importMap = new ImportMapBuilder({});

  const steps = await analyzer.analyzeFile(file, importMap);
  assertEquals(
    file.getText(),
    `import "@scope/abc/export";
import "@std/path";
import "./other.ts";

global {
  interface GlobalTest {}
}

declare module "test" {
}
`,
  );
  assertEquals(importMap.build(), {
    "@scope/abc": "jsr:@scope/abc@1",
    "@std/path": "jsr:@std/path@0.193",
  });
  assertEquals(steps, [
    "Global type augmentation is not yet supported in JSR.\n" +
    "Ensure this file is not used via any export.\n" +
    "    at ./file.ts:5:1\n",
    "Global type augmentation is not yet supported in JSR.\n" +
    "Ensure this file is not used via any export.\n" +
    "    at ./file.ts:9:1\n",
  ]);
});
