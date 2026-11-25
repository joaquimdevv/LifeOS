export const KDF_ITERATIONS = 310_000;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function webCrypto() {
  if (!globalThis.crypto?.subtle) throw new Error('Criptografia indisponível. Abra o LifeOS em localhost ou em uma conexão HTTPS atualizada.');
  return globalThis.crypto;
}

export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  webCrypto().getRandomValues(bytes);
  return bytes;
}

export function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function deriveVaultKey(passphrase, salt, iterations = KDF_ITERATIONS) {
  const cryptoApi = webCrypto();
  const source = await cryptoApi.subtle.importKey('raw', textEncoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return cryptoApi.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, source,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

export async function encryptText(plaintext, key, additionalData) {
  const cryptoApi = webCrypto();
  const iv = randomBytes(12);
  const algorithm = { name: 'AES-GCM', iv, tagLength: 128 };
  if (additionalData) algorithm.additionalData = textEncoder.encode(additionalData);
  const ciphertext = await cryptoApi.subtle.encrypt(algorithm, key, textEncoder.encode(plaintext));
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptText(envelope, key, additionalData) {
  const cryptoApi = webCrypto();
  const algorithm = { name: 'AES-GCM', iv: fromBase64(envelope.iv), tagLength: 128 };
  if (additionalData) algorithm.additionalData = textEncoder.encode(additionalData);
  const plaintext = await cryptoApi.subtle.decrypt(algorithm, key, fromBase64(envelope.ciphertext));
  return textDecoder.decode(plaintext);
}
