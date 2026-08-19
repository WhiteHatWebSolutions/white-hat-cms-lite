# Security

## Administrator access

Administrator pages and write APIs require an authenticated session and an
exact email match in the server-only `CMS_ADMIN_EMAILS` value or the D1-backed
team table. Review both whenever publishing access changes.

## Reporting a vulnerability

Do not open a public issue with credentials, private content, or reproduction
data from a live deployment. Contact the repository owner privately and include
only the information needed to reproduce the problem.

## Deployment checklist

- Confirm that `CMS_ADMIN_EMAILS` contains only approved owner addresses.
- Confirm that `PUBLIC_SITE_URL` uses the intended HTTPS origin.
- Keep local environment files and database files out of version control.
- Use the access policy provided by the hosting platform.
- Run `npm audit --audit-level=moderate`, `npm run lint`, and `npm test` before publishing a release.
- Verify the Content-Security-Policy, HSTS, cache-control, and no-index headers
  on the deployed administrative routes.
- Test every role against owned and non-owned posts before adding client users.
- Keep `CMS_ENCRYPTION_KEY` in the deployment secret store and rotate external
  platform credentials if the key or a backup is exposed.
- Use least-privilege tokens for external platforms. Grant only the content
  read and write scopes needed by the selected connector.
- Review connector delivery mode before enabling it. Draft mode is the default.

## Outbound request controls

AI, Postiz, and publishing connector targets must use public HTTPS URLs.
Credentialed URLs, local hostnames, private IP ranges, link-local addresses,
redirects, oversized responses, and long-running requests are rejected.
Automation webhook requests include `x-white-hat-cms-timestamp` and
`x-white-hat-cms-signature`. Verify the signature over
`timestamp + "." + rawRequestBody` with the saved signing secret before
accepting a webhook.

DNS resolution is controlled by the deployment platform. For self-hosted
Ghost, Strapi, Drupal, and webhook targets, keep DNS records pointed only to the
intended public service and restrict the destination service to the expected
source or authentication method where practical.
