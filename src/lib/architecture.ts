// Plain data shared by the server-rendered Architecture page and the client-side diagram.

export const FLOW_STEPS = [
  "A request arrives from a portal, the reviewer workbench, or as an X12 278 / FHIR PAS transaction.",
  "The gateway authenticates the caller (SSO) and applies rate limits.",
  "Identifiers are redacted and documents are screened for prompt injection before any model sees them.",
  "The use-case workflow pulls the policy, clinical records, claims data and tools it needs.",
  "The workflow calls Claude for reasoning over text, or a classic ML model for scoring.",
  "Model findings come back as structured output with verbatim quotes.",
  "Code verifies every quote against the source and applies the routing rules.",
  "The case lands in the human review queue; a nurse or physician makes the decision.",
  "Every step is written to the audit log and traced for quality, latency and cost.",
];
