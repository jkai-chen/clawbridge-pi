# Notice

This is a modified fork of **pi** (https://github.com/earendil-works/pi), by Mario Zechner and contributors,
licensed under the MIT License. The upstream licence text and copyright notice are in `LICENSE`, unchanged.

It is maintained for ClawBridge's dispatcher agent, which needs only the agent loop and the provider layer. Branches
`cb/vX.Y.Z` are upstream tag `vX.Y.Z` plus a short series of commits that **remove** code:

- every package except `pi-ai` (packages/ai) and `pi-agent-core` (packages/agent), with the repo scripts, nix, husky,
  biome and the `.pi` workspace config;
- `pi-telemetry` and the `telemetryContext` request option;
- the model catalogue generator (the build uses the provider model data snapshot from upstream's published
  `@earendil-works/pi-ai` release of the same version, vendored in `packages/ai/src/providers/data`);
- the `pi-ai` CLI and every OAuth login flow;
- the providers that exist only for subscription logins or pi's own gateway (github-copilot, openai-codex, radius):
  their provider definitions, generated catalogues and data, the Copilot request headers and bearer-auth paths, and
  the Sign in with ChatGPT handling;
- `streamProxy`, and the `pi-messages`, `openai-codex-responses` and `openrouter-images` APIs;
- the System One classifier transports (`typesafe-system-one`, `cloudflare-workers-ai-system-one`), the typesafe
  provider, and every catalogue entry that used them;
- upstream's GitHub workflows, replaced by this fork's CI and release workflows and checks.

Kept as inert data: the OpenRouter image model entries in the catalogue (listing works; generating an image has no
transport).

`main` mirrors upstream unchanged. These modifications are released under the same MIT License as pi.
