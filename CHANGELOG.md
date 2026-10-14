# Changelog

## 1.0.0 — 2026-10-14

- Refined native settings layout, compact actions, instance-scoped cluster list and professional Chinese copy.
- Added instance editing, recoverable local removal and restoration.
- Preserved cached cluster credentials across rename, CA edits, archive and restore.
- Isolated changed server origins with a new identity and no credential migration.
- Added single-cluster credential refresh; ordinary synchronization reuses valid local configuration.
- Maintained 0.1.x storage compatibility and real SDK IPC lifecycle regression tests.

## 0.1.2

- Corrected both IPC endpoints to use the SDK Singleton factory.
- Added packaged-entry regression using actual SDK IPC classes.

## 0.1.1

- Embedded settings in Preferences and corrected global-page stacking.

## 0.1.0

- Initial multi-instance synchronization and native Catalog integration.
