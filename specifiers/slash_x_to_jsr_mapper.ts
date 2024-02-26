import type { ApiLandApi } from "../apis/ApiLand.ts";
import type { JsrApi, JsrPackage } from "../apis/JsrApi.ts";

export interface SlashXToJsrPkgMapper {
  attemptFindJsrPkg(name: string): Promise<JsrPackage | undefined>;
}

export class RealSlashXToJsrPkgMapper {
  #apiLandApi: ApiLandApi;
  #jsrApi: JsrApi;
  #cache = new Map<string, JsrPackage | undefined>();

  constructor(apiLandApi: ApiLandApi, jsrApi: JsrApi) {
    this.#apiLandApi = apiLandApi;
    this.#jsrApi = jsrApi;
  }

  async attemptFindJsrPkg(name: string) {
    // no need to worry about multiple concurrent calls
    // because everything only happens sequentially atm
    if (this.#cache.has(name)) {
      return this.#cache.get(name);
    } else {
      const value = await this.#inner(name);
      this.#cache.set(name, value);
      return value;
    }
  }

  async #inner(name: string) {
    const slashXModule = await this.#apiLandApi.getModule(name);
    if (slashXModule == null) {
      return undefined;
    }
    return await this.#jsrApi.getPackageByGithubRepoId(slashXModule.repo_id);
  }
}
