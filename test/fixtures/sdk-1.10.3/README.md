# SDK test fixtures

Compiled classes from the published `@freelensapp/core@1.10.3` npm package, corresponding to https://github.com/freelensapp/freelens/tree/v1.10.3 . Files retain upstream copyright headers. See LICENSE for the full MIT license.

The harness removes ESM import/export wrappers and injects isolated Electron transport and dependency-injection boundaries; the original Singleton and IPC class implementations are executed, rather than replaced by permissive mocks. `singleton.cjs` is the equivalent CommonJS test adaptation.
