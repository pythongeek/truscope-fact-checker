/**
 * Generates a SHA-256 hash of the input string.
 * @param input The string to hash.
 * @returns A promise that resolves to the SHA-256 hash as a hex string.
 */
export async function generateSHA256(input: string): Promise<string> {
  // Encode the input string into a Uint8Array
  const textAsBuffer = new TextEncoder().encode(input);

  // Hash the buffer using the SHA-256 algorithm
  const hashBuffer = await crypto.subtle.digest('SHA-256', textAsBuffer);

  // Convert the ArrayBuffer to an array of bytes
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Convert bytes to a hex string
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}