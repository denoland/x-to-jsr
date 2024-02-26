import { assertEquals } from "@std/assert";
import { RealSlashXToJsrPkgMapper } from "./slash_x_to_jsr_mapper.ts";
import type { JsrApi } from "../apis/JsrApi.ts";
import type { ApiLandApi } from "../apis/ApiLand.ts";

Deno.test("mapping works", async () => {
  let requestCount = 0;
  const jsrApi: JsrApi = {
    getPackageByGithubRepoId(repoId: number) {
      if (repoId === 1) {
        return Promise.resolve({
          scope: "@deno",
          name: "testing",
        });
      } else {
        return Promise.resolve(undefined);
      }
    },
  };
  const apiLandApi: ApiLandApi = {
    getModule(moduleName: string) {
      requestCount++;
      if (moduleName === "testing") {
        return Promise.resolve({ repo_id: 1 });
      }
      return Promise.resolve(undefined);
    },
  };
  const mapper = new RealSlashXToJsrPkgMapper(apiLandApi, jsrApi);

  for (let i = 0; i < 2; i++) {
    assertEquals(
      await mapper.attemptFindJsrPkg("testing"),
      {
        scope: "@deno",
        name: "testing",
      },
    );
    assertEquals(
      await mapper.attemptFindJsrPkg("other"),
      undefined,
    );
  }
  assertEquals(requestCount, 2); // will use the cache after
});
