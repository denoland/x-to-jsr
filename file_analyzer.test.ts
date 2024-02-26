import { SpecifierMapper } from "./specifiers/specifier_mapper.ts";
import { FileAnalyzer } from "./file_analyzer.ts";
import { assertEquals } from "@std/assert";
import { InMemoryFileSystemHost, Project } from "ts-morph";
import { ImportMapBuilder } from "./import_map.ts";

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
  const analyzer = new FileAnalyzer(mapper);
  const fileSystem = new InMemoryFileSystemHost();
  const project = new Project({
    fileSystem,
  });
  const file = project.createSourceFile(
    "file.ts",
    `import "https://deno.land/x/abc@1.0.0/export.ts";
import "https://deno.land/std@0.193.0/path/mod.ts";
import "./other.ts";
`,
  );
  const importMap = new ImportMapBuilder({});

  await analyzer.analyzeFile(file, importMap);
  assertEquals(
    file.getText(),
    `import "@scope/abc/export";
import "@std/path";
import "./other.ts";
`,
  );
  assertEquals(importMap.build(), {
    "@scope/abc": "jsr:@scope/abc@1",
    "@std/path": "jsr:@std/path@0.193",
  });
});
