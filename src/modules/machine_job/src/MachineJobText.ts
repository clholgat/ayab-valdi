/** Decodes UTF-8 without relying on TextDecoder being present in every runtime. */
export function decodeMachineJobText(bytes: Uint8Array): string {
  let result = "";
  let index = 0;
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    index = 3;
  }
  while (index < bytes.length) {
    const first = bytes[index++]!;
    if (first < 0x80) {
      result += String.fromCharCode(first);
      continue;
    }
    if (first >= 0xc2 && first <= 0xdf && index < bytes.length) {
      const second = bytes[index++]!;
      if ((second & 0xc0) !== 0x80) throw new Error("Invalid UTF-8 machine job");
      result += String.fromCharCode(((first & 0x1f) << 6) | (second & 0x3f));
      continue;
    }
    if (first >= 0xe0 && first <= 0xef && index + 1 < bytes.length) {
      const second = bytes[index++]!;
      const third = bytes[index++]!;
      if ((second & 0xc0) !== 0x80 || (third & 0xc0) !== 0x80) {
        throw new Error("Invalid UTF-8 machine job");
      }
      const code =
        ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f);
      if (code >= 0xd800 && code <= 0xdfff) {
        throw new Error("Invalid UTF-8 machine job");
      }
      result += String.fromCharCode(code);
      continue;
    }
    if (first >= 0xf0 && first <= 0xf4 && index + 2 < bytes.length) {
      const second = bytes[index++]!;
      const third = bytes[index++]!;
      const fourth = bytes[index++]!;
      if (
        (second & 0xc0) !== 0x80 ||
        (third & 0xc0) !== 0x80 ||
        (fourth & 0xc0) !== 0x80
      ) {
        throw new Error("Invalid UTF-8 machine job");
      }
      const codePoint =
        ((first & 0x07) << 18) |
        ((second & 0x3f) << 12) |
        ((third & 0x3f) << 6) |
        (fourth & 0x3f);
      if (codePoint > 0x10ffff) throw new Error("Invalid UTF-8 machine job");
      const adjusted = codePoint - 0x10000;
      result += String.fromCharCode(
        0xd800 + (adjusted >> 10),
        0xdc00 + (adjusted & 0x3ff),
      );
      continue;
    }
    throw new Error("Invalid UTF-8 machine job");
  }
  return result;
}
