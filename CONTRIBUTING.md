# Contributing

Contributions that improve security, publishing reliability, accessibility,
documentation, or platform compatibility are welcome.

## Development setup

1. Fork the repository and create a focused branch from `main`.
2. Install Node.js 22.13 or newer.
3. Run `npm ci` from the repository root.
4. Copy `.env.example` to `.env.local` and use placeholder or test values only.
5. Run `npm run dev` for local development.

## Change standards

- Keep each pull request limited to one clear purpose.
- Preserve server-side authorization on every administrative route.
- Keep credentials, tokens, private content, and personal data out of fixtures,
  tests, screenshots, commits, and issue reports.
- Add or update tests for behavior changes.
- Add a migration for every database schema change. Never rewrite a released
  migration.
- Preserve the approval gate for AI output and external publishing.
- Preserve backward compatibility for versioned backup and theme formats.
- Keep product language neutral and direct. Limit comments to behavior that is
  not clear from the code itself.

## Validation

Run the following commands before opening a pull request:

```bash
npm run lint
npm test
npm audit --audit-level=low
npm run validate:artifact
```

## Pull requests

Include a concise summary, the reason for the change, test results, security
considerations, migration notes, and screenshots for visible interface changes.
Link the related issue when one exists.

## Security reports

Do not report vulnerabilities through a public issue. Follow the private
reporting process in [SECURITY.md](SECURITY.md).

## License

Submitted contributions are licensed under the repository's MIT License.
