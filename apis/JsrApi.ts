import $ from "dax";

export interface JsrPackage {
  scope: string;
  name: string;
}

interface JsrPackageResponse {
  items: JsrPackage[];
}

export interface JsrApi {
  getPackageByGithubRepoId(repoId: number): Promise<JsrPackage | undefined>;
}

export class RealJsrApi implements JsrApi {
  async getPackageByGithubRepoId(repoId: number) {
    const result = await $.request(
      `https://jsr.io/api/packages?gitHubRepoId=${repoId}`,
    )
      .showProgress()
      .json<JsrPackageResponse | undefined>();
    const pkg = result?.items?.[0];
    if (pkg == null) {
      return undefined;
    }
    return pkg;
  }
}
