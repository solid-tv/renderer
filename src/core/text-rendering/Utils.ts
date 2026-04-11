import type { NormalizedFontMetrics } from './TextRenderer.js';

const invisibleChars = /[\u200B\u200C\u200D\uFEFF\u00AD\u2060]/g;

/**
 * Returns CSS font setting string for use in canvas context.
 *
 * @param fontFace
 * @param fontStyle
 * @param fontSize
 * @param precision
 * @param defaultFontFace
 * @returns
 */
export function getFontSetting(
  fontFace: string | string[],
  fontStyle: string,
  fontSize: number,
  precision: number,
  defaultFontFace: string,
): string {
  let ff = fontFace;

  if (!Array.isArray(ff)) {
    ff = [ff];
  }

  const ffs: string[] = [];
  for (let i = 0, n = ff.length; i < n; i++) {
    let curFf = ff[i];
    // Replace the default font face `null` with the actual default font face set
    // on the stage.
    if (curFf === null || curFf === undefined) {
      curFf = defaultFontFace;
    }
    if (curFf === 'serif' || curFf === 'sans-serif') {
      ffs.push(curFf);
    } else {
      ffs.push(`"${curFf}"`);
    }
  }

  return `${fontStyle} ${fontSize * precision}px ${ffs.join(',')}`;
}

/**
 * Returns true if the given character is a zero-width space.
 *
 * @param space
 */
export function hasZeroWidthSpace(space: string): boolean {
  return invisibleChars.test(space) === true;
}

/**
 * Returns true if the given character is a zero-width space or a regular space.
 *
 * @param space
 */
export function isSpace(space: string): boolean {
  return hasZeroWidthSpace(space) || space === ' ';
}

/**
 * Converts a string into an array of tokens and the words between them.
 *
 * @param tokenRegex
 * @param text
 */
export function tokenizeString(tokenRegex: RegExp, text: string): string[] {
  const delimeters = text.match(tokenRegex) || [];
  const words = text.split(tokenRegex) || [];

  const final: string[] = [];
  for (let i = 0; i < words.length; i++) {
    final.push(words[i]!, delimeters[i]!);
  }
  final.pop();
  return final.filter((word) => word != '');
}
