import {
  AYAB_SUPPORTED_KNITOUT_VERSION,
  KnitoutDiagnostic,
  KnitoutDirection,
  KnitoutDocument,
  KnitoutNeedle,
  KnitoutOperation,
  ParseKnitoutResult,
} from "./KnitoutTypes";

function addDiagnostic(
  diagnostics: KnitoutDiagnostic[],
  severity: KnitoutDiagnostic["severity"],
  code: string,
  message: string,
  line?: number,
): void {
  diagnostics.push({ severity, code, message, line });
}

function parseFiniteNumber(
  token: string | undefined,
  name: string,
  line: number,
  diagnostics: KnitoutDiagnostic[],
): number | undefined {
  if (token === undefined || token.trim() === "") {
    addDiagnostic(diagnostics, "error", "missingOperand", `Missing ${name}.`, line);
    return undefined;
  }
  const value = Number(token);
  if (!Number.isFinite(value)) {
    addDiagnostic(
      diagnostics,
      "error",
      "invalidNumber",
      `Invalid ${name} '${token}'.`,
      line,
    );
    return undefined;
  }
  return value;
}

function parseDirection(
  token: string | undefined,
  line: number,
  diagnostics: KnitoutDiagnostic[],
): KnitoutDirection | undefined {
  if (token === "+" || token === "-") return token;
  addDiagnostic(
    diagnostics,
    "error",
    "invalidDirection",
    `Direction must be '+' or '-', not '${token ?? ""}'.`,
    line,
  );
  return undefined;
}

function parseNeedle(
  token: string | undefined,
  line: number,
  diagnostics: KnitoutDiagnostic[],
): KnitoutNeedle | undefined {
  const match = /^(fs|bs|f|b)(-?\d+)$/.exec(token ?? "");
  if (!match) {
    addDiagnostic(
      diagnostics,
      "error",
      "invalidNeedle",
      `Invalid needle '${token ?? ""}'.`,
      line,
    );
    return undefined;
  }
  return {
    bed: match[1] as KnitoutNeedle["bed"],
    index: Number(match[2]),
    token: token!,
  };
}

function validateCarriers(
  tokens: string[],
  line: number,
  diagnostics: KnitoutDiagnostic[],
): string[] {
  const carriers: string[] = [];
  for (const token of tokens) {
    if (token.length === 0 || /[ ,;]/.test(token)) {
      addDiagnostic(
        diagnostics,
        "error",
        "invalidCarrier",
        `Invalid carrier name '${token}'.`,
        line,
      );
    } else if (carriers.includes(token)) {
      addDiagnostic(
        diagnostics,
        "error",
        "duplicateCarrier",
        `Carrier '${token}' is repeated in one carrier set.`,
        line,
      );
    } else {
      carriers.push(token);
    }
  }
  return carriers;
}

function requireOperandCount(
  args: string[],
  expected: number,
  opcode: string,
  line: number,
  diagnostics: KnitoutDiagnostic[],
): boolean {
  if (args.length === expected) return true;
  addDiagnostic(
    diagnostics,
    "error",
    "operandCount",
    `'${opcode}' expects ${expected} operand${expected === 1 ? "" : "s"}; found ${args.length}.`,
    line,
  );
  return false;
}

function parseOperation(
  operationText: string,
  raw: string,
  comment: string | undefined,
  line: number,
  diagnostics: KnitoutDiagnostic[],
): KnitoutOperation | undefined {
  const tokens = operationText.trim().split(/[ \t]+/).filter((token) => token.length > 0);
  const opcode = tokens[0];
  if (!opcode) return undefined;
  const args = tokens.slice(1);
  const source = comment?.startsWith("!source: ")
    ? comment.slice("!source: ".length)
    : undefined;
  const base = { line, raw, comment, source };

  if (["in", "inhook", "releasehook", "out", "outhook"].includes(opcode)) {
    if (args.length === 0) {
      addDiagnostic(
        diagnostics,
        "error",
        "missingCarrier",
        `'${opcode}' requires at least one carrier.`,
        line,
      );
      return undefined;
    }
    return {
      ...base,
      opcode: opcode as "in" | "inhook" | "releasehook" | "out" | "outhook",
      carriers: validateCarriers(args, line, diagnostics),
    };
  }

  if (opcode === "stitch") {
    if (!requireOperandCount(args, 2, opcode, line, diagnostics)) return undefined;
    const loopLength = parseFiniteNumber(args[0], "loop stitch value", line, diagnostics);
    const tuckLength = parseFiniteNumber(args[1], "tuck stitch value", line, diagnostics);
    if (loopLength === undefined || tuckLength === undefined) return undefined;
    return { ...base, opcode, loopLength, tuckLength };
  }

  if (opcode === "rack") {
    if (!requireOperandCount(args, 1, opcode, line, diagnostics)) return undefined;
    const value = parseFiniteNumber(args[0], "racking value", line, diagnostics);
    return value === undefined ? undefined : { ...base, opcode, value };
  }

  if (opcode === "knit" || opcode === "tuck" || opcode === "miss") {
    if (args.length < 2) {
      addDiagnostic(
        diagnostics,
        "error",
        "operandCount",
        `'${opcode}' requires a direction and needle.`,
        line,
      );
      return undefined;
    }
    const direction = parseDirection(args[0], line, diagnostics);
    const needle = parseNeedle(args[1], line, diagnostics);
    const carriers = validateCarriers(args.slice(2), line, diagnostics);
    if (!direction || !needle) return undefined;
    return { ...base, opcode, direction, needle, carriers };
  }

  if (opcode === "split") {
    if (args.length < 3) {
      addDiagnostic(
        diagnostics,
        "error",
        "operandCount",
        "'split' requires a direction, source needle, and target needle.",
        line,
      );
      return undefined;
    }
    const direction = parseDirection(args[0], line, diagnostics);
    const needle = parseNeedle(args[1], line, diagnostics);
    const target = parseNeedle(args[2], line, diagnostics);
    const carriers = validateCarriers(args.slice(3), line, diagnostics);
    if (!direction || !needle || !target) return undefined;
    return { ...base, opcode, direction, needle, target, carriers };
  }

  if (opcode === "drop" || opcode === "amiss") {
    if (!requireOperandCount(args, 1, opcode, line, diagnostics)) return undefined;
    const needle = parseNeedle(args[0], line, diagnostics);
    return needle === undefined ? undefined : { ...base, opcode, needle };
  }

  if (opcode === "xfer") {
    if (!requireOperandCount(args, 2, opcode, line, diagnostics)) return undefined;
    const needle = parseNeedle(args[0], line, diagnostics);
    const target = parseNeedle(args[1], line, diagnostics);
    return !needle || !target ? undefined : { ...base, opcode, needle, target };
  }

  if (opcode === "pause") {
    if (!requireOperandCount(args, 0, opcode, line, diagnostics)) return undefined;
    return { ...base, opcode };
  }

  if (opcode.startsWith("x-")) {
    return { ...base, opcode: opcode as `x-${string}`, arguments: args };
  }

  addDiagnostic(
    diagnostics,
    "error",
    "unknownOpcode",
    `Unknown Knitout opcode '${opcode}'.`,
    line,
  );
  return undefined;
}

function carriersFromHeader(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((carrier) => carrier.trim())
    .filter((carrier) => carrier.length > 0);
}

export function parseKnitout(sourceText: string): ParseKnitoutResult {
  const diagnostics: KnitoutDiagnostic[] = [];
  if (sourceText.length === 0) {
    return {
      ok: false,
      diagnostics: [{ severity: "error", code: "emptyFile", message: "Knitout file is empty." }],
    };
  }

  let text = sourceText;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
    addDiagnostic(diagnostics, "warning", "byteOrderMark", "Ignored UTF-8 byte-order mark.", 1);
  }
  if (text.includes("\r")) {
    addDiagnostic(
      diagnostics,
      "warning",
      "nonStandardLineEnding",
      "Knitout files should use LF line endings; CR characters were accepted.",
    );
  }
  const lines = text.split("\n").map((line) => line.endsWith("\r") ? line.slice(0, -1) : line);
  const magic = /^;!knitout-(\d+)$/.exec(lines[0]?.trim() ?? "");
  if (!magic) {
    addDiagnostic(
      diagnostics,
      "error",
      "missingMagic",
      "First line must be ';!knitout-VERSION'.",
      1,
    );
  }
  const version = magic ? Number(magic[1]) : 0;
  if (magic && version !== AYAB_SUPPORTED_KNITOUT_VERSION) {
    addDiagnostic(
      diagnostics,
      "warning",
      "unsupportedVersion",
      `AYAB targets Knitout ${AYAB_SUPPORTED_KNITOUT_VERSION}; file declares version ${version}.`,
      1,
    );
  }

  const headers: KnitoutDocument["headers"] = [];
  const operations: KnitoutOperation[] = [];
  let operationSectionStarted = false;
  for (let index = 1; index < lines.length; index++) {
    const raw = lines[index]!;
    const lineNumber = index + 1;
    const trimmed = raw.trim();
    if (trimmed.length === 0 || (trimmed.startsWith(";") && !trimmed.startsWith(";;"))) {
      continue;
    }
    if (trimmed.startsWith(";;")) {
      const headerMatch = /^;;([^:]+):[ \t]*(.*)$/.exec(trimmed);
      if (!headerMatch) {
        addDiagnostic(
          diagnostics,
          "warning",
          "malformedHeader",
          "Ignored malformed Knitout header comment.",
          lineNumber,
        );
        continue;
      }
      if (operationSectionStarted) {
        addDiagnostic(
          diagnostics,
          "warning",
          "lateHeader",
          `Header '${headerMatch[1]!.trim()}' appears after operations began.`,
          lineNumber,
        );
      }
      headers.push({
        name: headerMatch[1]!.trim(),
        value: headerMatch[2]!,
        line: lineNumber,
      });
      continue;
    }

    operationSectionStarted = true;
    const semicolon = raw.indexOf(";");
    const operationText = semicolon >= 0 ? raw.slice(0, semicolon) : raw;
    const comment = semicolon >= 0 ? raw.slice(semicolon + 1).trim() : undefined;
    if (operationText.trim().length === 0) continue;
    const operation = parseOperation(operationText, raw, comment, lineNumber, diagnostics);
    if (operation) operations.push(operation);
  }

  const carrierHeaders = headers.filter((header) => header.name.toLowerCase() === "carriers");
  if (carrierHeaders.length === 0) {
    addDiagnostic(
      diagnostics,
      "warning",
      "missingCarriersHeader",
      "Required ';;Carriers:' header is missing.",
    );
  } else if (carrierHeaders.length > 1) {
    addDiagnostic(
      diagnostics,
      "warning",
      "duplicateCarriersHeader",
      "Multiple ';;Carriers:' headers were found; the first is used.",
      carrierHeaders[1]!.line,
    );
  }
  const declaredCarriers = carrierHeaders.length > 0
    ? carriersFromHeader(carrierHeaders[0]!.value)
    : [];
  if (new Set(declaredCarriers).size !== declaredCarriers.length) {
    addDiagnostic(
      diagnostics,
      "error",
      "duplicateDeclaredCarrier",
      "The ';;Carriers:' header contains duplicate carrier names.",
      carrierHeaders[0]?.line,
    );
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { ok: false, diagnostics };
  }
  return {
    ok: true,
    document: { version, headers, operations, declaredCarriers, sourceText },
    diagnostics,
  };
}
