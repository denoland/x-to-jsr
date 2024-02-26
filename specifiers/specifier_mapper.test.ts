import { RealSpecifierMapper } from "./specifier_mapper.ts";
import { assertEquals } from "@std/assert";
import { SlashXToJsrPkgMapper } from "./slash_x_to_jsr_mapper.ts";
import type { JsrPackage } from "../apis/JsrApi.ts";

Deno.test("maps specifiers", async () => {
  const slashXMapper: SlashXToJsrPkgMapper = {
    attemptFindJsrPkg(name: string): Promise<JsrPackage | undefined> {
      if (name === "ts_morph") {
        return Promise.resolve({
          scope: "david",
          name: "ts-morph",
        });
      }
      return Promise.resolve(undefined);
    },
  };

  const mapper = new RealSpecifierMapper(slashXMapper);
  assertEquals(
    await mapper.map("https://deno.land/std@0.193.0/testing/bdd.ts"),
    {
      bareSpecifier: `@std/testing`,
      base: `jsr:@std/testing@0.193.0`,
      subpath: `bdd`,
    },
  );

  assertEquals(
    await mapper.map("https://deno.land/x/ts_morph@21.0.0/mod.ts"),
    {
      bareSpecifier: `@david/ts-morph`,
      base: `jsr:@david/ts-morph@21.0.0`,
      subpath: "",
    },
  );
});
