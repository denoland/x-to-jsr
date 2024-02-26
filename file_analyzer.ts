import {
  ExportDeclaration,
  ImportDeclaration,
  Node,
  SourceFile,
} from "ts-morph";
import { SpecifierMapper } from "./specifiers/specifier_mapper.ts";
import { ImportMapBuilder } from "./import_map.ts";

export class FileAnalyzer {
  #mapper: SpecifierMapper;

  constructor(mapper: SpecifierMapper) {
    this.#mapper = mapper;
  }

  async analyzeFile(file: SourceFile, importMapBuilder: ImportMapBuilder) {
    for (const statement of file.getStatements()) {
      if (Node.isImportDeclaration(statement)) {
        await this.#visitSpecifier(statement, importMapBuilder);
      } else if (Node.isExportDeclaration(statement)) {
        await this.#visitSpecifier(statement, importMapBuilder);
      }
    }
  }

  async #visitSpecifier(
    statement: ImportDeclaration | ExportDeclaration,
    importMapBuilder: ImportMapBuilder,
  ) {
    const specifier = statement.getModuleSpecifierValue();
    if (specifier == null) {
      return;
    }
    const mappedSpecifier = await this.#mapper.map(specifier);
    if (mappedSpecifier != null) {
      const bareSpecifier = importMapBuilder.addImport(
        mappedSpecifier.bareSpecifier,
        mappedSpecifier.base,
      );
      let finalSpecifier = bareSpecifier;
      if (
        mappedSpecifier.subpath != null && mappedSpecifier.subpath.length > 0
      ) {
        if (!finalSpecifier.endsWith("/")) {
          finalSpecifier += "/";
        }
        finalSpecifier += mappedSpecifier.subpath;
      }
      statement.setModuleSpecifier(finalSpecifier);
    }
  }
}
