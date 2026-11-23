# Changelog

## 2.0.1 — 2026-11-23

- Added a per-context shortcut to the native FreeLens cluster Settings page without changing kubeconfig or credentials.
- Renamed the optional plugin-only alias editor to distinguish it from native Settings.

## 2.0.0 — 2026-11-23

- Ported to the FreeLens 2 extension API and React 19.
- Added local display-name editing for synchronized Rancher clusters, with persistence across sync and restart.
- Replaced catalog-only entries with native kubeconfig folder import; stable paths and contexts preserve native identity across routine sync.
- Reuse existing plugin storage and valid cached kubeconfigs. Never copy the Rancher API session token into persistent storage.

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
