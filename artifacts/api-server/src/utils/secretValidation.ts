const DENYLISTED_SECRET_VALUES = new Set([
  'secret',
  'changeme',
  'password',
  'your-super-secret-key-change-this',
  'replace-with-any-32-char-string-for-tests',
  'your-jwt-secret-key-at-least-32-chars',
  'replace_me_with_a_random_secret_of_at_least_32_characters',
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'replace_me_with_64_random_hex_characters',
]);

function hasShortRepeatedPattern(value: string): boolean {
  const maximumPatternLength = Math.min(32, Math.floor(value.length / 2));
  for (let patternLength = 1; patternLength <= maximumPatternLength; patternLength += 1) {
    if (value.length % patternLength !== 0) continue;
    const pattern = value.slice(0, patternLength);
    if (pattern.repeat(value.length / patternLength) === value) return true;
  }
  return false;
}

function estimateShannonBits(value: string): number {
  const counts = new Map<string, number>();
  for (const character of value) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }

  let bitsPerCharacter = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    bitsPerCharacter -= probability * Math.log2(probability);
  }
  return bitsPerCharacter * value.length;
}

function hasLongSequentialRun(value: string): boolean {
  let ascending = 1;
  let descending = 1;
  for (let index = 1; index < value.length; index += 1) {
    const difference = value.charCodeAt(index) - value.charCodeAt(index - 1);
    ascending = difference === 1 ? ascending + 1 : 1;
    descending = difference === -1 ? descending + 1 : 1;
    if (ascending >= 8 || descending >= 8) return true;
  }
  return false;
}

function hasSequentialBytes(value: string): boolean {
  if (!/^(?:[0-9a-fA-F]{2}){16,}$/.test(value)) return false;
  const bytes = Buffer.from(value, 'hex');
  let ascending = 1;
  let descending = 1;
  for (let index = 1; index < bytes.length; index += 1) {
    const difference = bytes[index] - bytes[index - 1];
    ascending = difference === 1 ? ascending + 1 : 1;
    descending = difference === -1 ? descending + 1 : 1;
    if (ascending >= 8 || descending >= 8) return true;
  }
  return false;
}

function decodedPrintableCandidate(value: string): string | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) return null;
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value || decoded.length === 0) return null;
  const text = decoded.toString('utf8');
  return /^[\x20-\x7e]+$/.test(text) ? text : null;
}

export function getSecretStrengthValidationError(
  secret: string,
  variableName: 'JWT_SECRET' | 'ENCRYPTION_KEY'
): string | null {
  const trimmed = secret.trim();
  const candidates = [trimmed];
  const decoded = decodedPrintableCandidate(trimmed);
  if (decoded) candidates.push(decoded);

  for (const candidate of candidates) {
    if (DENYLISTED_SECRET_VALUES.has(candidate.toLowerCase())) {
      return `${variableName} is using a known default, documented example, or insecure value.`;
    }

    if (
      new Set(candidate).size < 8 ||
      hasShortRepeatedPattern(candidate) ||
      hasLongSequentialRun(candidate) ||
      hasSequentialBytes(candidate) ||
      estimateShannonBits(candidate) < 80
    ) {
      return `${variableName} is too predictable and must be replaced with a cryptographically random value.`;
    }
  }

  return null;
}
