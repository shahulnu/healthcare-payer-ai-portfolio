// Pattern-based identifier redaction that runs before any text reaches the model.
// This is a demo-grade layer: production systems pair it with an NLP de-identification
// service (e.g. Amazon Comprehend Medical) and keep the mapping in a secured vault.

interface Rule {
  label: string;
  pattern: RegExp;
  replacement: string;
}

const RULES: Rule[] = [
  { label: "Name", pattern: /(Patient:\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g, replacement: "$1[NAME]" },
  { label: "Date of birth", pattern: /(DOB:\s*)\d{1,2}\/\d{1,2}\/\d{4}/g, replacement: "$1[DOB]" },
  { label: "MRN", pattern: /(MRN:\s*)\d{6,10}/g, replacement: "$1[MRN]" },
  { label: "Account number", pattern: /(Account:\s*)\d{6,12}/g, replacement: "$1[ACCOUNT]" },
  { label: "Phone", pattern: /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, replacement: "[PHONE]" },
  { label: "SSN", pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN]" },
  { label: "Email", pattern: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, replacement: "[EMAIL]" },
];

export function redact(text: string): { text: string; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.pattern, (...args) => {
      counts.set(rule.label, (counts.get(rule.label) ?? 0) + 1);
      // Re-apply the rule to this one match so "$1" group references resolve.
      return (args[0] as string).replace(new RegExp(rule.pattern.source), rule.replacement);
    });
  }
  return { text: out, counts };
}
