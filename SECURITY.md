# Security policy

## Supported versions

Rivet is in alpha. Only the latest published `0.1.0-alpha` release receives security fixes; there are no backports.

## Reporting a vulnerability

Report privately through [GitHub private vulnerability reporting](https://github.com/N1XUS/rivetjs/security/advisories/new). Do not open a public issue.

Include the affected package and version, a minimal reproduction and the impact you see. Rivet has one maintainer, so handling is best effort: there is no guaranteed response time. Confirmed issues are fixed in a new release and disclosed in a GitHub security advisory that credits the reporter unless you ask otherwise.

## Scope

In scope: the published `@rivetjs/*` packages and `create-rivet`, for example output escaping, the resume format decoder, the router's loaders, actions and caches, and CSP handling.

Out of scope: the benchmark apps, the demo apps, and the `examples/` fixtures, whose session, tenant and upload rules are synthetic. Rivet also assumes untampered JavaScript built-ins, so prototype pollution that already happened in the page is not treated as a Rivet vulnerability.
