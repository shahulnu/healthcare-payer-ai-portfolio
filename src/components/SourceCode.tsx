import { CODE_PATHS, SITE } from "@/lib/site";

/** "Source code" section for a case-study page: links to this demo's code in both repos. */
export function SourceCode({ slug }: { slug: string }) {
  const paths = CODE_PATHS[slug];
  if (!paths) return null;
  const site = `${SITE.repos.site}/tree/main`;
  const services = `${SITE.repos.services}/tree/main`;

  return (
    <section className="section" id="code">
      <div className="section-head">
        <span className="eyebrow">Source code</span>
        <h2>The same engine in TypeScript and Java</h2>
      </div>
      <p>
        Both versions return the same JSON for every demo case. Contract tests generated from the TypeScript engine run
        against the Java service on every build.
      </p>
      <div className="grid g2">
        <div className="panel">
          <h3>TypeScript (this site)</h3>
          <ul>
            <li>
              <a href={`${site}/src/lib/${paths.engine}`}>Engine</a>: the model call, checks and decision rules
            </li>
            <li>
              <a href={`${site}/src/app/api/${paths.engine}`}>API route</a> and{" "}
              <a href={`${site}/src/app/apps/${slug}`}>pages</a>
            </li>
            <li>
              <a href={`${site}/data/${paths.engine}`}>Synthetic data</a> and recorded runs
            </li>
          </ul>
        </div>
        <div className="panel">
          <h3>Java (Spring Boot)</h3>
          <ul>
            <li>
              <a href={`${services}/${paths.java}`}>{paths.java}</a>
              : the service, with its contract test
            </li>
            <li>
              <a href={`${services}/payer-ai-common`}>payer-ai-common</a>
              : shared model calls, live limits and checks
            </li>
            <li>
              <a href={`${services}/contract-tests/${paths.engine}`}>Contract tests</a>: the expected output for each
              case
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
