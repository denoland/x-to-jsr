import {
  ExportDeclaration,
  ImportDeclaration,
  ModuleDeclarationKind,
  Node,
  SourceFile,
} from "ts-morph";
import { SpecifierMapper } from "./specifiers/specifier_mapper.ts";
import { ImportMapBuilder } from "./import_map.ts";
import { Path } from "dax";
import { StringLiteral } from "ts-morph";

const globalTypeAugNotSupported = "";
const ensureNotUsedByExport = "";

export class FileAnalyzer {
  #mapper: SpecifierMapper;
  #cwd: Path;

  constructor(mapper: SpecifierMapper, cwd: Path) {
    this.#mapper = mapper;
    this.#cwd = cwd;
  }

  async analyzeFile(file: SourceFile, importMapBuilder: ImportMapBuilder) {
    const steps = [];
    for (const statement of file.getStatements()) {
      if (Node.isImportDeclaration(statement)) {
        await this.#visitSpecifier(statement, importMapBuilder);
      } else if (Node.isExportDeclaration(statement)) {
        await this.#visitSpecifier(statement, importMapBuilder);
      } else if (Node.isModuleDeclaration(statement)) {
        const nameNodes = statement.getNameNodes();
        const hasGlobalAugmentation = nameNodes instanceof StringLiteral ||
          statement.getDeclarationKind() === ModuleDeclarationKind.Global;
        if (hasGlobalAugmentation) {
          const specifier = this.#getLineAndColumnSpecifier(statement);
          steps.push(
            `Global type augmentation is not yet supported in JSR.\n` +
              `Ensure this file is not used via any export.\n` +
              `    at ${specifier}\n`,
          );
        }
      }
    }
    return steps;
  }

  #getLineAndColumnSpecifier(node: Node) {
    const file = node.getSourceFile();
    const relativePath = "./" +
      this.#cwd.relative(file.getFilePath()).replace(/\\/g, "/");
    const { line, column } = file.getLineAndColumnAtPos(node.getStart());
    return `${relativePath}:${line}:${column}`;
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
    } else if (
      specifier.startsWith("https:") || specifier.startsWith("http:")
    ) {
      importMapBuilder.addUnmappedRemoteImport(specifier);
    }
  }
}
