/**
 * Conditions for `when:` and gate checks. Deliberately small and side-effect free:
 *
 *   expr     := or
 *   or       := and ("||" and)*
 *   and      := unary ("&&" unary)*
 *   unary    := "!" unary | compare
 *   compare  := operand (("==" | "!=" | "<" | "<=" | ">" | ">=" | "contains") operand)?
 *   operand  := number | string | true | false | null | steps.<id>.(output|exitCode|status) | "(" expr ")"
 */

export type ConditionValue = string | number | boolean | null;

export interface StepView {
  output: string;
  exitCode: number;
  status: string;
}

type Node =
  | { kind: "literal"; value: ConditionValue }
  | { kind: "ref"; stepId: string; field: "output" | "exitCode" | "status" }
  | { kind: "not"; operand: Node }
  | { kind: "logical"; op: "&&" | "||"; left: Node; right: Node }
  | { kind: "compare"; op: CompareOp; left: Node; right: Node };

type CompareOp = "==" | "!=" | "<" | "<=" | ">" | ">=" | "contains";

type Token =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "ident"; value: string }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" };

const COMPARE_OPS = new Set<string>(["==", "!=", "<", "<=", ">", ">="]);

export class ConditionError extends Error {
  constructor(expression: string, detail: string) {
    super(`invalid condition "${expression}": ${detail}`);
    this.name = "ConditionError";
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const previousAllowsSign = () => {
    const last = tokens.at(-1);
    return !last || last.type === "op" || (last.type === "paren" && last.value === "(");
  };
  while (i < source.length) {
    const char = source[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    const two = source.slice(i, i + 2);
    if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) {
      tokens.push({ type: "op", value: two });
      i += 2;
      continue;
    }
    if (char === "<" || char === ">" || char === "!") {
      tokens.push({ type: "op", value: char });
      i += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      i += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      let value = "";
      let j = i + 1;
      while (j < source.length && source[j] !== char) {
        if (source[j] === "\\" && j + 1 < source.length) {
          j += 1;
        }
        value += source[j];
        j += 1;
      }
      if (j >= source.length) {
        throw new ConditionError(source, "unterminated string");
      }
      tokens.push({ type: "string", value });
      i = j + 1;
      continue;
    }
    const number = /^-?\d+(\.\d+)?/.exec(source.slice(i));
    if (number && (char !== "-" || previousAllowsSign())) {
      tokens.push({ type: "number", value: Number(number[0]) });
      i += number[0].length;
      continue;
    }
    const ident = /^[A-Za-z_][\w.-]*/.exec(source.slice(i));
    if (ident) {
      tokens.push(ident[0] === "contains" ? { type: "op", value: "contains" } : { type: "ident", value: ident[0] });
      i += ident[0].length;
      continue;
    }
    throw new ConditionError(source, `unexpected character "${char}"`);
  }
  return tokens;
}

export function parseCondition(source: string): Node {
  const tokens = tokenize(source);
  let position = 0;
  const peek = () => tokens[position];
  const fail = (detail: string): never => {
    throw new ConditionError(source, detail);
  };

  const parseOperand = (): Node => {
    const token = tokens[position++];
    if (!token) {
      return fail("unexpected end of expression");
    }
    if (token.type === "paren" && token.value === "(") {
      const inner = parseOr();
      const close = tokens[position++];
      if (!close || close.type !== "paren" || close.value !== ")") {
        fail('expected ")"');
      }
      return inner;
    }
    if (token.type === "number" || token.type === "string") {
      return { kind: "literal", value: token.value };
    }
    if (token.type === "ident") {
      if (token.value === "true" || token.value === "false") {
        return { kind: "literal", value: token.value === "true" };
      }
      if (token.value === "null") {
        return { kind: "literal", value: null };
      }
      const match = /^steps\.([\w-]+)\.(output|exitCode|status)$/.exec(token.value);
      if (!match) {
        return fail(`unknown reference "${token.value}" (use steps.<id>.output, steps.<id>.exitCode or steps.<id>.status)`);
      }
      return { kind: "ref", stepId: match[1], field: match[2] as "output" | "exitCode" | "status" };
    }
    return fail(`unexpected "${token.value}"`);
  };

  const parseCompare = (): Node => {
    const left = parseOperand();
    const next = peek();
    if (next?.type === "op" && (COMPARE_OPS.has(next.value) || next.value === "contains")) {
      position += 1;
      return { kind: "compare", op: next.value as CompareOp, left, right: parseOperand() };
    }
    return left;
  };

  const parseUnary = (): Node => {
    const next = peek();
    if (next?.type === "op" && next.value === "!") {
      position += 1;
      return { kind: "not", operand: parseUnary() };
    }
    return parseCompare();
  };

  const parseAnd = (): Node => {
    let left = parseUnary();
    while (peek()?.type === "op" && peek()?.value === "&&") {
      position += 1;
      left = { kind: "logical", op: "&&", left, right: parseUnary() };
    }
    return left;
  };

  const parseOr = (): Node => {
    let left = parseAnd();
    while (peek()?.type === "op" && peek()?.value === "||") {
      position += 1;
      left = { kind: "logical", op: "||", left, right: parseAnd() };
    }
    return left;
  };

  if (tokens.length === 0) {
    fail("empty expression");
  }
  const ast = parseOr();
  if (position < tokens.length) {
    fail(`unexpected "${String(tokens[position].value)}"`);
  }
  return ast;
}

/** Step IDs an expression reads, so validation can check they finish before it is evaluated. */
export function conditionReferences(source: string): string[] {
  const refs = new Set<string>();
  const walk = (node: Node): void => {
    if (node.kind === "ref") {
      refs.add(node.stepId);
    } else if (node.kind === "not") {
      walk(node.operand);
    } else if (node.kind === "logical" || node.kind === "compare") {
      walk(node.left);
      walk(node.right);
    }
  };
  walk(parseCondition(source));
  return [...refs];
}

function truthy(value: ConditionValue): boolean {
  return value !== null && value !== false && value !== 0 && value !== "";
}

function compare(op: CompareOp, left: ConditionValue, right: ConditionValue): boolean {
  if (op === "contains") {
    return String(left ?? "").includes(String(right ?? ""));
  }
  let a = left;
  let b = right;
  if (typeof a === "number" && typeof b === "string" && b.trim() !== "" && !Number.isNaN(Number(b))) {
    b = Number(b);
  } else if (typeof b === "number" && typeof a === "string" && a.trim() !== "" && !Number.isNaN(Number(a))) {
    a = Number(a);
  }
  if (typeof a === "string" && (op === "==" || op === "!=")) {
    a = a.trim();
    b = typeof b === "string" ? b.trim() : b;
  }
  switch (op) {
    case "==":
      return a === b;
    case "!=":
      return a !== b;
    default:
      if (typeof a !== "number" || typeof b !== "number") {
        return false;
      }
      return op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : a >= b;
  }
}

function evaluate(node: Node, steps: Record<string, StepView>): ConditionValue {
  switch (node.kind) {
    case "literal":
      return node.value;
    case "ref": {
      const step = steps[node.stepId];
      return step ? step[node.field] : null;
    }
    case "not":
      return !truthy(evaluate(node.operand, steps));
    case "logical":
      return node.op === "&&"
        ? truthy(evaluate(node.left, steps)) && truthy(evaluate(node.right, steps))
        : truthy(evaluate(node.left, steps)) || truthy(evaluate(node.right, steps));
    case "compare":
      return compare(node.op, evaluate(node.left, steps), evaluate(node.right, steps));
  }
}

export function evaluateCondition(source: string, steps: Record<string, StepView>): boolean {
  return truthy(evaluate(parseCondition(source), steps));
}
