# Papercuts

## 2026-08-12T15:57:41.500Z — gpt-5.6-sol — Alfredo Sandoval

Fetching ChatGPT with curl produced no usable live selector markup because the page is client-rendered; use a headless browser DOM dump for compatibility inspection.

## 2026-08-12T16:55:42.439Z — gpt-5.6-sol — Alfredo Sandoval

The first compatibility lint run caught a stale unused Pulse helper after replacing it with the Maps route; remove the obsolete helper and its dependency wiring.

## 2026-08-28T02:23:37.112Z — gpt-5.6 — Alfredo Sandoval

While inspecting the logged-in ChatGPT tab for Aether, the Brave CDP probe could not reach the existing Linux Brave session because it was not started with loopback remote debugging. The Aether workflow should document a login-preserving, background-safe inspection route or surface this prerequisite before probe execution.

## 2026-08-28T02:30:34.884Z — gpt-5.6 — Alfredo Sandoval

A live Aether DOM probe assumed the new Chat/Work radios were direct children of the radiogroup, so the selector resolved null. The current control interleaves tooltip wrappers; probes and theme selectors should anchor on the page-header radiogroup itself and inspect its actual children before using child combinators.

## 2026-08-28T02:30:50.099Z — gpt-5.6 — Alfredo Sandoval

After a browser probe threw during initialization, its top-level binding was not created and the retry failed on assignment. Persist retryable browser state on globalThis so failed initializers do not leave ambiguous bindings.

## 2026-08-28T02:32:52.124Z — gpt-5.6 — Alfredo Sandoval

While live-verifying Aether, the Brave connector blocked navigation to brave://extensions, so it cannot reload an unpacked extension after source changes. The browser-development workflow needs a policy-supported reload operation or should surface that manual reload is required before live verification.

## 2026-08-28T02:45:18.242Z — gpt-5.6-sol — Alfredo Sandoval

While updating the Work surface selectors, apply_patch rejected a patch with two Update File sections for the same CSS file. Combine all hunks under one Update File block.

## 2026-08-28T02:46:54.205Z — gpt-5.6-sol — Alfredo Sandoval

A new CSS policy test matched Prettier's pre-format selector layout and failed after formatting collapsed :has() onto one line. Keep static selector assertions whitespace-agnostic and run them after formatting.

## 2026-08-28T02:48:40.298Z — gpt-5.6-sol — Alfredo Sandoval

While tracing a stubborn Scheduled filter color, the Browser CDP CSS.getMatchedStylesForNode command hit the connector's 3-second timeout. A narrower cascade-inspection helper or configurable CDP timeout would make selector debugging more reliable.

## 2026-08-28T02:51:50.350Z — gpt-5.6-sol — Alfredo Sandoval

The Browser connector found the visible Work radio but its click timed out while waiting on a Runtime.evaluate CDP command, even though the control was actionable. Navigation-state clicks need a cheaper post-click completion signal.

## 2026-08-28T03:04:43.190Z — gpt-5.6-sol — Alfredo Sandoval

A patch for the popup preset layout missed because the CSS rule had drifted from the inspected context. Re-read the narrow rule immediately before patching to avoid stale hunks.
