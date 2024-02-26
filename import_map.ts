export class ImportMapBuilder {
  #imports: Record<string, string>;

  constructor(imports: Record<string, string>) {
    this.#imports = imports;
  }

  addImport(bareSpecifier: string, specifier: string) {
    bareSpecifier = this.#getUniqueBareSpecifier(bareSpecifier, specifier);
    this.#imports[bareSpecifier] = specifier;
    return bareSpecifier;
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
