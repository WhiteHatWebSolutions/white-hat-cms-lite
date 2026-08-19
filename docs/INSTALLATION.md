# Installation

White Hat CMS Lite is built for Cloudflare Workers with D1 and R2. The included
production build emits a Worker entry point and the hosting manifest required by
the deployment platform.

## Requirements

- Node.js 22.13 or newer
- A Cloudflare-compatible Workers deployment
- D1 bound as `DB`
- R2 bound as `MEDIA`
- An authentication gateway that provides the authenticated user headers used
  by `app/auth.ts`
- A server-only `CMS_ENCRYPTION_KEY` secret for AI and connector credentials
- A `PUBLIC_SITE_URL` environment value for the canonical public origin

## Configure

1. Set the initial owner email in the server-only `CMS_ADMIN_EMAILS` environment value.
2. Copy `.env.example` to the local environment configuration used by the
   deployment platform. Never commit the real encryption key.
3. Set `PUBLIC_SITE_URL` to the canonical HTTPS origin. Update
   `config/site.ts` with the time zone and default category.
4. Apply every SQL migration in `drizzle/` in filename order.
5. Build and validate the application.
6. Deploy the generated Worker with D1 and R2 attached.
7. Keep administrative routes behind a trusted identity gateway. Never allow a
   public proxy to supply the authenticated-user headers.

## First sign-in

Open `/admin/blog/` through the configured authentication gateway. Complete the
following sections before launch:

- Appearance: publication identity, colors, logo, typography, navigation, and
  intended custom domain
- Team: editors, authors, reviewers, and administrators
- Integrations: AI provider, Postiz webhook, WordPress target, and external
  publishing connectors
- Media: publication images
- System: backup export and audit verification

Run an acceptance test with the intended AI provider, Postiz endpoint, external
publishing platforms, and a staging WordPress installation before enabling
those integrations for client content. Use draft delivery until the external
field mapping and permissions have been verified. Provider credentials and
external systems are not included in the repository test suite.

## Connector credentials

Create the narrowest available write credential for each platform:

- Ghost: Admin API key and the public Ghost site URL
- Webflow: API token with CMS write access and a collection ID
- Contentful: Content Management token, space, environment, content type, locale,
  and a text or Rich Text body field
- Sanity: token with read and write access, project ID, dataset, and document type
- Strapi: API token with create permission and the REST collection path
- HubSpot: private app token with content access, blog ID, and blog author ID
- Shopify: Admin API token with content write access, shop domain, and blog GraphQL ID
- Drupal: bearer token allowed to create the selected JSON:API content type
- Automation webhook: a long random signing secret and a public HTTPS endpoint

The Integrations page never displays saved credentials. Leaving a credential
field blank during an edit preserves its encrypted value.

## Authentication

Authentication is delegated to the hosting gateway. Authorization is enforced
inside the CMS through `CMS_ADMIN_EMAILS` and D1-backed team roles. Do not
expose the administrative routes through a proxy that accepts identity headers
directly from public requests.
