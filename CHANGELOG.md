# Changelog

All notable changes to White Hat CMS Lite are recorded in this file.

## [Unreleased]

## [1.3.2] - 2026-08-19

### Added

- GitHub Actions continuous integration workflow
- Dependabot configuration for npm and GitHub Actions
- Structured issue forms and pull request template
- Contribution and conduct guidelines
- Expanded installation, architecture, integration, and validation guidance

### Changed

- Added package metadata for repository discovery
- Updated the MIT copyright holder

## [1.3.1] - 2026-08-19

### Added

- Automated source-comment hygiene validation

### Changed

- Removed unused starter comments and placeholder configuration

## [1.3.0] - 2026-08-18

### Added

- Direct publishing connectors for Ghost, Webflow, Contentful, Sanity, Strapi,
  HubSpot, Shopify, and Drupal
- Signed automation webhooks for Zapier, Make, n8n, Pipedream, and custom
  services
- Encrypted connector credentials, delivery history, retries, and idempotency
- External draft delivery as the default connector behavior
- Backup redaction and restore compatibility for connector data

### Security

- Public HTTPS validation for outbound integrations
- Redirect rejection, request timeouts, and bounded response handling
- Approval gates for every distribution path
- Restricted custom CSS and theme asset loading
