import type { Campaign, Disposition } from "@pelozen/shared";

/**
 * Safe evaluation of a campaign's success/disqualify expressions over the
 * structured outcome the LLM produced. Expressions are DATA (versioned with the
 * campaign), so we must NOT use eval(). This is a tiny recursive-descent
 * evaluator supporting: || && ! == != > < >= <= ( ), identifiers, numbers,
 * 'strings', true/false.
 *
 *   successExpr: "interested == true && wants_callback == true"
 */

type Value = boolean | number | string;
type Token = { t: "op" | "name" | "num" | "str" | "bool"; v: string };

const OPS = ["||", "&&", "==", "!=", ">=", "<=", ">", "<", "!", "(", ")"];

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) { i++; continue; }

    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) { tokens.push({ t: "op", v: op }); i += op.length; continue; }

    if (ch === "'" || ch === '"') {
      const end = src.indexOf(ch, i + 1);
      if (end === -1) throw new Error(`Unterminated string in expr: ${src}`);
      tokens.push({ t: "str", v: src.slice(i + 1, end) });
      i = end + 1; continue;
    }

    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j]!)) j++;
      tokens.push({ t: "num", v: src.slice(i, j) });
      i = j; continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j]!)) j++;
      const word = src.slice(i, j);
      tokens.push({ t: word === "true" || word === "false" ? "bool" : "name", v: word });
      i = j; continue;
    }

    throw new Error(`Unexpected char '${ch}' in expr: ${src}`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly toks: Token[], private readonly ctx: Record<string, Value>) {}

  private peek() { return this.toks[this.pos]; }
  private next() { return this.toks[this.pos++]; }
  private eat(v: string) {
    const t = this.next();
    if (!t || t.v !== v) throw new Error(`Expected '${v}'`);
  }

  parse(): boolean {
    const r = this.parseOr();
    return Boolean(r);
  }

  private parseOr(): Value {
    let left = this.parseAnd();
    while (this.peek()?.v === "||") { this.next(); const r = this.parseAnd(); left = Boolean(left) || Boolean(r); }
    return left;
  }
  private parseAnd(): Value {
    let left = this.parseCmp();
    while (this.peek()?.v === "&&") { this.next(); const r = this.parseCmp(); left = Boolean(left) && Boolean(r); }
    return left;
  }
  private parseCmp(): Value {
    const left = this.parseUnary();
    const op = this.peek()?.v;
    if (op && ["==", "!=", ">", "<", ">=", "<="].includes(op)) {
      this.next();
      const right = this.parseUnary();
      switch (op) {
        case "==": return left === right;
        case "!=": return left !== right;
        case ">": return (left as number) > (right as number);
        case "<": return (left as number) < (right as number);
        case ">=": return (left as number) >= (right as number);
        case "<=": return (left as number) <= (right as number);
      }
    }
    return left;
  }
  private parseUnary(): Value {
    if (this.peek()?.v === "!") { this.next(); return !this.parseUnary(); }
    return this.parsePrimary();
  }
  private parsePrimary(): Value {
    const t = this.next();
    if (!t) throw new Error("Unexpected end of expr");
    if (t.v === "(") { const r = this.parseOr(); this.eat(")"); return r; }
    if (t.t === "num") return Number(t.v);
    if (t.t === "str") return t.v;
    if (t.t === "bool") return t.v === "true";
    if (t.t === "name") return this.ctx[t.v] ?? false; // missing key → falsy
    throw new Error(`Unexpected token '${t.v}'`);
  }
}

/** Evaluate a boolean expression over the structured outcome. Fails closed. */
export function evalExpr(expr: string, ctx: Record<string, Value>): boolean {
  if (!expr || !expr.trim()) return false;
  try {
    return new Parser(tokenize(expr), ctx).parse();
  } catch {
    return false; // a malformed campaign expression must never qualify a lead
  }
}

/**
 * Map a structured outcome to a final Disposition. Opt-out always wins; then
 * disqualify; then success; otherwise trust the LLM's own `disposition` hint,
 * defaulting to not_relevant.
 */
export function classifyDisposition(
  campaign: Campaign,
  structured: Record<string, Value>,
): Disposition {
  const llmHint = String(structured.disposition ?? "");

  if (llmHint === "opted_out" || structured.opt_out === true) return "opted_out";
  if (evalExpr(campaign.disqualifyExpr, structured)) return "not_relevant";
  if (evalExpr(campaign.successExpr, structured)) return "qualified_for_human";

  const valid: Disposition[] = [
    "qualified_for_human", "interested", "callback_later",
    "not_relevant", "opted_out", "no_answer", "wrong_number", "failed",
  ];
  return (valid as string[]).includes(llmHint) ? (llmHint as Disposition) : "not_relevant";
}
