import data from "../../../data/appeals/codes.json";

// Plain-language meanings for the X12 codes used in the demo claims, stored in
// data/appeals/codes.json and shared with the Java service. These are paraphrases;
// the official code lists are maintained by X12 (x12.org/codes).

export const GROUP_CODES: Record<string, string> = data.groupCodes;
export const CARC: Record<string, string> = data.carc;
export const RARC: Record<string, string> = data.rarc;

export function describeCode(code: string): string {
  const [kind, value] = code.includes("-") ? ["CARC", code.split("-")[1]] : ["RARC", code];
  return (kind === "CARC" ? CARC[value] : RARC[value]) ?? "Code not in the demo dictionary.";
}
