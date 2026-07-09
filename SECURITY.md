# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

This project is pre-release (`0.1.0-dev`). Security fixes will be applied on the `main` branch.

## Reporting a vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities.
2. Open a [GitHub private security advisory](https://github.com/clholgat/ayab-valdi/security/advisories/new) on this repository, or contact the maintainer via the email listed on their GitHub profile.
3. Include a description of the issue, steps to reproduce, and potential impact.

You should receive a response within 7 days. We will work with you to understand and address the issue before any public disclosure.

## Scope

This app communicates with knitting hardware over serial ports (USB, Web Serial). Areas of interest:

- Serial port handling and input validation
- Web app exposure (the dev server is local-only; production deployment is not yet documented)
- Dependency vulnerabilities in npm and Bazel-fetched packages

Out of scope: vulnerabilities in the AYAB firmware or ayab-desktop (report those to the [AYAB project](https://github.com/AllYarnsAreBeautiful/ayab-desktop) instead).
