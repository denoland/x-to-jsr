import { SlashXToJsrPkgMapper } from "./slash_x_to_jsr_mapper.ts";

export interface MappedSpecifier {
  base: string;
  bareSpecifier: string;
  subpath: string | undefined;
}

interface Mapper {
  map(
    specifier: string,
  ): Promise<MappedSpecifier | undefined> | MappedSpecifier | undefined;
}

export interface SpecifierMapper {
  map(specifier: string): Promise<MappedSpecifier | undefined>;
}

export class RealSpecifierMapper implements SpecifierMapper {
  #mappers: Mapper[];

  constructor(slashXToJsrPkgMapper: SlashXToJsrPkgMapper) {
    this.#mappers = [
      new EsmShMapper(),
      new DenoStdMapper(),
      new DenoLandMapper(slashXToJsrPkgMapper),
    ];
  }

  async map(specifier: string) {
    for (const mapper of this.#mappers) {
      let mapped = mapper.map(specifier);
      if (mapped instanceof Promise) {
        mapped = await mapped;
      }
      if (mapped) {
        return mapped;
      }
    }
    return undefined;
  }
}

const esmShRe =
  /^https:\/\/esm\.sh\/(v\d+\/)?(@?[^@?]+)@([0-9.\^~\-A-Za-z]+)(?:\/([^#?]+))?$/;

class EsmShMapper {
  map(specifier: string): MappedSpecifier | undefined {
    // ignore gh repo imports
    if (specifier.includes("/gh/")) {
      return;
    }

    const match = specifier.match(esmShRe);
    if (!match) {
      return;
    }
    const [, , name, version, subpath] = match;

    if (subpath && subpath.toLowerCase().endsWith(".d.ts")) {
      return; // ignore .d.ts imports for now
    }

    return {
      base: `npm:${name}@${version}`,
      bareSpecifier: name,
      subpath,
    };
  }
}

// use url pattern instead?
const denoStdRe = /^https:\/\/deno\.land\/std@([^/]+)\/([^/]+)\/(.+)$/;

class DenoStdMapper {
  map(specifier: string): MappedSpecifier | undefined {
    const match = specifier.match(denoStdRe);
    if (!match) {
      return;
    }

    const [, version, name, subpath] = match;
    return {
      bareSpecifier: `@std/${name}`,
      base: `jsr:@std/${name}@${version}`,
      subpath: subpath.replace(/\.ts$/, "").replace(/^mod$/, ""),
    };
  }
}

const denoLandRe = /^https:\/\/deno\.land\/x\/([^@]+)@([^/]+)\/(.+)$/;

class DenoLandMapper {
  #slashXToJsrPkgMapper: SlashXToJsrPkgMapper;

  constructor(slashXToJsrPkgMapper: SlashXToJsrPkgMapper) {
    this.#slashXToJsrPkgMapper = slashXToJsrPkgMapper;
  }

  async map(specifier: string): Promise<MappedSpecifier | undefined> {
    const match = specifier.match(denoLandRe);
    if (!match) {
      return;
    }

    const [, name, version, subpath] = match;
    const jsrPkg = await this.#slashXToJsrPkgMapper.attemptFindJsrPkg(name);
    if (jsrPkg == null) {
      return {
        bareSpecifier: `${name}/`,
        base: `https://deno.land/x/${name}@${version}/`,
        subpath,
      };
    } else {
      return {
        bareSpecifier: `@${jsrPkg.scope}/${jsrPkg.name}`,
        base: `jsr:@${jsrPkg.scope}/${jsrPkg.name}@${version}`,
        subpath: subpath?.replace(/\.ts$/, "").replace(/^mod$/, ""),
      };
    }
  }
}
