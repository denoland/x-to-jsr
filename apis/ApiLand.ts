import $ from "dax";

export interface ApiLandModule {
  repo_id: number;
}

export interface ApiLandApi {
  getModule(moduleName: string): Promise<ApiLandModule | undefined>;
}

export class RealApiLandApi implements ApiLandApi {
  getModule(moduleName: string) {
    return $.request(
      `https://apiland.deno.dev/legacy_modules/${
        encodeURIComponent(moduleName)
      }`,
    )
      .showProgress()
      .json<ApiLandModule | undefined>();
  }
}
