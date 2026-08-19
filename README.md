# White Hat CMS Lite

White Hat CMS Lite is a compact, self-hosted publishing system for teams that
need editorial control without the weight of a traditional CMS. It combines a
private publishing desk, scheduled releases, white-label presentation,
AI-assisted drafting, media management, and multi-platform distribution.

The public publication can be fully rebranded for a company, publication, or
client. The repository ships without sample posts, user data, credentials, or
personal information.

## Key capabilities

- Public journal, article pages, RSS feed, XML sitemap, and robots rules
- Private editorial calendar and post editor
- Planned, draft, scheduled, published, archived, and deleted states
- Time-zone-aware scheduling with daylight-saving handling
- Editorial approval, review comments, team roles, and revision history
- SEO title, description, excerpt, category, and featured-post controls
- Configurable publication name, colors, typography, logo, favicon, navigation,
  layout, custom domain, and custom CSS
- Versioned theme package import and export
- Encrypted bring-your-own-provider AI drafting
- Mandatory human approval for AI-assisted content
- R2-backed media library
- Checksummed backups, redacted secrets, audit history, and restore controls
- Postiz, WordPress, Ghost, Webflow, Contentful, Sanity, Strapi, HubSpot,
  Shopify, and Drupal integration paths
- HMAC-signed automation webhooks for Zapier, Make, n8n, Pipedream, and custom
  services
- Public JSON endpoints for headless frontends

## Architecture

| Area | Implementation |
| --- | --- |
| Application | Next.js 16, React 19, TypeScript |
| Worker build | Vinext and Vite |
| Database | Cloudflare D1 with Drizzle migrations |
| Media | Cloudflare R2 |
| Authentication | Hosting identity gateway with server-side CMS roles |
| Secrets | AES-GCM encryption using `CMS_ENCRYPTION_KEY` |
| Publishing | Approval-gated queue with idempotency and delivery history |

## Requirements

- Node.js 22.13 or newer
- A Cloudflare-compatible Workers deployment
- D1 database bound as `DB`
- R2 bucket bound as `MEDIA`
- An identity gateway that supplies the authenticated-user headers consumed by
  `app/auth.ts`
- HTTPS for the public site and every outbound integration target

## Local development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The example environment file contains placeholders only. Real credentials and
encryption keys must remain outside version control.

## Environment values

| Name | Required | Purpose |
| --- | --- | --- |
| `CMS_ADMIN_EMAILS` | Yes | Comma-separated bootstrap owner addresses |
| `CMS_ENCRYPTION_KEY` | Yes | Server-only encryption key for saved credentials |
| `PUBLIC_SITE_URL` | Yes | Canonical HTTPS origin for metadata, feeds, and exports |

Generate `CMS_ENCRYPTION_KEY` with a cryptographically secure random source.
Store it in the deployment platform's secret manager.

## Production installation

1. Configure the values listed in `.env.example` through the deployment
   platform.
2. Set the publication time zone and default category in `config/site.ts`.
3. Apply the SQL migrations in `drizzle/` in filename order.
4. Attach D1 as `DB` and R2 as `MEDIA`.
5. Place every `/admin/` and `/api/admin/` route behind the trusted identity
   gateway.
6. Run the full validation suite.
7. Deploy the generated Worker artifact.
8. Sign in with a bootstrap owner address and complete Appearance, Team,
   Integrations, Media, and System settings.

Detailed guidance is available in [Installation](docs/INSTALLATION.md) and
[Operations](docs/OPERATIONS.md).

## Publishing safeguards

- Draft, planned, archived, and deleted posts remain private.
- Scheduled content becomes public only after its selected date and time.
- Public content requires editorial approval.
- AI output always begins as an unapproved draft.
- Scheduled content can create external drafts but cannot publish early.
- Connector credentials remain server-side and are never returned to the
  browser.
- Delivery idempotency prevents duplicate connector jobs for the same event.
- Private editorial purpose, author email, and approval identity are excluded
  from outbound distribution payloads.

## Integrations

| Platform | Method |
| --- | --- |
| Postiz | Approval-gated webhook with retries and delivery history |
| WordPress | WXR export, connector plugin, public JSON API, and RSS |
| Ghost | Admin API |
| Webflow CMS | Data API |
| Contentful | Content Management API |
| Sanity | Mutation API |
| Strapi | REST API |
| HubSpot CMS | Blog Posts API |
| Shopify Blog | Admin GraphQL API |
| Drupal | JSON:API |
| Zapier, Make, n8n, Pipedream | Signed automation webhook |

Direct connectors default to external draft creation. Publish mode activates
only for locally approved content in the published state.

The included WordPress connector is located at
`public/integrations/wordpress/white-hat-cms-lite.php`. WordPress theme files do
not run inside White Hat CMS Lite. WordPress sites can consume the public API,
RSS feed, WXR export, or connector output.

## Public endpoints

- `GET /api/public/posts`
- `GET /api/public/theme`
- `GET /feed.xml`
- `GET /sitemap.xml`
- `GET /robots.txt`

The posts and theme endpoints permit cross-origin reads for headless frontends
and approved integrations.

## Validation

```bash
npm run lint
npm test
npm audit --audit-level=low
npm run validate:artifact
```

The automated suite covers migrations, authorization rules, approval gates,
scheduling, connector payloads, secret handling, backups, URL safety, security
headers, source hygiene, and deployment artifact structure.

External publishing accounts are not bundled with the repository. Each
connector must be acceptance-tested with its intended platform account before
client publishing is enabled.

## Project structure

```text
app/          Public pages, administrative pages, and API routes
components/   Reading and editorial interface components
config/       Publication defaults and bootstrap access configuration
db/           D1 connection and Drizzle schema
drizzle/      Ordered database migrations
lib/          Publishing, validation, authorization, and integration logic
public/       Static assets and the WordPress connector
scripts/      Installation, build, and artifact validation scripts
tests/        Automated application and security contracts
worker/       Cloudflare Worker entry point
```

## Security

Security-sensitive reports should follow [SECURITY.md](SECURITY.md). Never post
credentials, private content, or live deployment data in a public issue.

## Contributing

Development and pull request guidance is available in
[CONTRIBUTING.md](CONTRIBUTING.md). Release history is recorded in
[CHANGELOG.md](CHANGELOG.md).

## License

White Hat CMS Lite is available under the [MIT License](LICENSE).
