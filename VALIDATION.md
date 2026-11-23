# Validation — 2.0.1

The implementation targets FreeLens v2 and is based on the official v2.1.0 extension API. The native import path uses FreeLens's Kubeconfig Syncs and its cluster route; the plugin does not create catalog-only placeholder clusters.

Automated checks cover:

- URL/TLS boundaries, kubeconfig validation, cache reuse, credential refresh, cancellation and local file handling.
- Editing and resetting a cluster alias, restart and resync persistence, and unchanged kubeconfig identity.
- Verified the native entity settings route in the FreeLens v2.0.0 and v2.1.0 source. DOM regression tests cover routing to Settings from a disconnected context, exact matching of both path and context, no mutation IPC, and no navigation before native import.
- Opening a registered native context by file path plus context; no navigation to an unregistered or different cluster.
- Legacy store loading, projection of active kubeconfigs, and archive/restore of watched copies.
- Browser-compatible renderer bundle (no Node or Electron globals) and packed main/renderer entrypoints against a simulated host.

These are automation checks, not a macOS Electron GUI or live Rancher test. No real endpoints or credentials are used.
