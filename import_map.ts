export class ImportMapBuilder {
  #imports: Record<string, string>;
  #unmappedRemoteImports = new Set<string>();

  constructor(imports: Record<string, string>) {
    this.#imports = imports;
  }

  addImport(bareSpecifier: string, specifier: string) {
    bareSpecifier = this.#getUniqueBareSpecifier(bareSpecifier, specifier);
    this.#imports[bareSpecifier] = specifier;
    return bareSpecifier;
  }

  addUnmappedRemoteImport(specifier: string) {
    this.#unmappedRemoteImports.add(specifier);
  }

  getUnmappedRemoteImports() {
    return [...this.#unmappedRemoteImports];
  }

  build() {
    return this.#imports;
  }

  #getUniqueBareSpecifier(bareSpecifier: string, specifier: string): string {
    if (
      this.#imports[bareSpecifier] != null &&
      this.#imports[bareSpecifier] !== specifier
    ) {
      const hasTrailingSlash = bareSpecifier.endsWith("/");
      bareSpecifier = bareSpecifier.slice(0, -1);
      bareSpecifier = bareSpecifier + "2" + (hasTrailingSlash ? "/" : "");
      return this.#getUniqueBareSpecifier(bareSpecifier, specifier);
    } else {
      return bareSpecifier;
    }
  }
}
