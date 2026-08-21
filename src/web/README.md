# AYAB Valdi Web

The Web app is built by Valdi's first-class `valdi_application` Web target. The
small npm wrapper in this directory only serves the generated static site and
runs the browser E2E suite.

## Run locally

```bash
cd src/web
npm start
```

This incrementally builds `//:ayab_valdi_app_web`, extracts
`bazel-bin/ayab_valdi_app_web.zip` into `web/dist`, and serves it at
<http://localhost:3030>.

To build without starting a server:

```bash
cd src
bazel build //:ayab_valdi_app_web
```

## Browser tests

```bash
cd src/web
npm run e2e
```

Run a subset while iterating:

```bash
E2E_ONLY=smoke,load-image npm run e2e
```

The globally installed Valdi CLI may not expose `valdi install web` until the
upstream Web-sync PR is released. The Bazel target above is pinned to the PR
head and is the reproducible workflow for this repository.
