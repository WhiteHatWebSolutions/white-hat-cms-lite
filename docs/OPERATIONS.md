# Operations

## Publishing

Scheduled posts become public at the selected date and time in the configured time zone.
Public queries require complete content, a scheduled or published state, and an
approved editorial state.

AI-generated content always enters the editor as a draft. Review the title,
facts, links, metadata, and article body before changing the publishing state.

## Postiz

The CMS sends scheduled and published events to the configured Postiz webhook.
The payload includes the complete post, event type, source identifier, and send
time. The webhook should point to the Postiz endpoint or adapter used by the
installation.

Only approved scheduled or published posts enter the Postiz delivery queue.
Each delivery has an idempotency key, attempt count, failure message, and manual
retry control under System. Failed webhook delivery never rolls back a saved or
approved post.

## Publishing connectors

The connector registry supports Ghost, Webflow CMS, Contentful, Sanity, Strapi,
HubSpot CMS, Shopify Blog, Drupal JSON:API, and general automation webhooks.
Automation webhooks work with Zapier, Make, n8n, Pipedream, and compatible
custom endpoints.

Every connector has an enabled switch and a delivery mode:

- Create external draft: sends approved content into the platform review queue.
- Publish after local approval: publishes only when the local post is both
  approved and in the published state.

Scheduled events never trigger immediate external publication. The connector
creates a draft until a published event is recorded. Each connector has a
separate idempotency key and delivery record. Removing a connector preserves
its delivery history, but those historical deliveries cannot be retried unless
the connector still exists.

Use Test after saving a connector. Read-capable connectors perform a small
authenticated read. Automation webhooks receive a `connection.test` event.
Testing a webhook can therefore appear in the destination workflow history.

Automation receivers should reject stale timestamps and verify the lowercase
hex HMAC SHA-256 signature in `x-white-hat-cms-signature`. The signed input is
the value of `x-white-hat-cms-timestamp`, a period, and the exact raw request body.

## WordPress

Use either integration method:

- Download the WXR export from System and import it through WordPress Tools.
- Install the connector PHP file and configure the public posts API endpoint.
  Place `[white_hat_cms_posts]` on the desired WordPress page.

## Backups

System exports include posts, publication settings, users, revisions, comments,
audit events, connector settings, delivery records, AI usage records, and media metadata. Each file
has a SHA-256 checksum. Stored API keys and webhook tokens are redacted. Only the
owner role can restore a backup, and restoration requires the explicit `RESTORE`
confirmation. R2 image objects must also be backed up through the storage provider.
Connector credentials remain redacted. Restoring onto the same installation
preserves credentials for matching connector IDs. A new installation requires
credentials to be entered again.

## Recovery

Deleting a post moves it to Trash. Restoration resets it to an unapproved draft
before returning it to the publishing desk. Media that is referenced by an
active post cannot be deleted.

## Security maintenance

Run `npm audit --audit-level=moderate`, `npm run lint`, and `npm test` before a
release. Apply dependency updates in a test environment, then repeat the full
suite and migration check before deployment.

## Updates

Before updating:

1. Export a CMS backup.
2. Back up R2 objects.
3. Apply new migrations in order.
4. Run the build and test suite.
5. Deploy the validated artifact.
6. Confirm sign-in, post editing, media delivery, and public article rendering.
