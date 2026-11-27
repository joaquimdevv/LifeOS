import { decryptText, deriveVaultKey, encryptText, fromBase64, randomBytes, toBase64, KDF_ITERATIONS } from './crypto.js';

export const BACKUP_FORMAT = 'application/vnd.lifeos.backup+json';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export const MAX_BACKUP_RECORDS = 100_000;
const AAD = 'lifeos-backup:v1';
const MIN_ITERATIONS = 310_000;
const MAX_ITERATIONS = 2_000_000;

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.schema !== 1 || !Array.isArray(snapshot.records) || snapshot.records.length > MAX_BACKUP_RECORDS) {
    throw new Error('O conteúdo do backup não corresponde a um formato LifeOS suportado.');
  }
  const keys = new Set();
  for (const row of snapshot.records) {
    if (!row || typeof row.collection !== 'string' || !row.collection.trim() || row.collection.length > 120 ||
        typeof row.id !== 'string' || !row.id.trim() || row.id.length > 200 || !Object.hasOwn(row, 'value')) {
      throw new Error('O backup contém um registro inválido.');
    }
    const key = row.id;
    if (keys.has(key)) throw new Error('O backup contém identificadores duplicados.');
    keys.add(key);
    const json = JSON.stringify(row.value);
    if (json === undefined) throw new Error('O backup contém um registro que não pode ser validado.');
  }
  return snapshot;
}

function parseCanonicalBase64(value, expectedBytes, label, minBytes = expectedBytes) {
  if (typeof value !== 'string' || value.length > MAX_BACKUP_BYTES * 2 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error(`Campo ${label} inválido no backup.`);
  }
  let bytes;
  try { bytes = fromBase64(value); } catch { throw new Error(`Campo ${label} inválido no backup.`); }
  if (toBase64(bytes) !== value || bytes.length < minBytes || (expectedBytes !== null && bytes.length !== expectedBytes)) {
    throw new Error(`Tamanho inválido para ${label} no backup.`);
  }
  return bytes;
}

export async function createBackupFile(snapshot, passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 10) throw new Error('Use uma senha de backup com pelo menos 10 caracteres.');
  const safeSnapshot = validateSnapshot(snapshot);
  const plaintext = JSON.stringify(safeSnapshot);
  if (new TextEncoder().encode(plaintext).byteLength > MAX_BACKUP_BYTES) throw new Error('O backup excede o limite de 50 MB.');
  const salt = randomBytes(16);
  const key = await deriveVaultKey(passphrase, salt, KDF_ITERATIONS);
  const encrypted = await encryptText(plaintext, key, AAD);
  const file = {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(),
    kdf: 'PBKDF2-SHA-256', iterations: KDF_ITERATIONS, salt: toBase64(salt), cipher: 'AES-256-GCM',
    iv: encrypted.iv, ciphertext: encrypted.ciphertext
  };
  if (new TextEncoder().encode(JSON.stringify(file)).byteLength > MAX_BACKUP_BYTES) throw new Error('O arquivo de backup cifrado excede o limite de 50 MB.');
  return file;
}

export async function readBackupFile(input, passphrase) {
  const raw = typeof input === 'string' ? input : JSON.stringify(input);
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) throw new Error('O arquivo de backup excede o limite de 50 MB.');
  let file;
  try { file = JSON.parse(raw); } catch { throw new Error('O arquivo não contém JSON válido.'); }
  if (!file || file.format !== BACKUP_FORMAT || file.version !== BACKUP_VERSION || file.kdf !== 'PBKDF2-SHA-256' || file.cipher !== 'AES-256-GCM' ||
      !Number.isInteger(file.iterations) || file.iterations < MIN_ITERATIONS || file.iterations > MAX_ITERATIONS ||
      typeof file.createdAt !== 'string' || !Number.isFinite(Date.parse(file.createdAt))) {
    throw new Error('Formato, versão ou parâmetros criptográficos do backup não são compatíveis.');
  }
  if (typeof passphrase !== 'string' || !passphrase.length) throw new Error('Informe a senha usada para criar este backup.');
  const salt = parseCanonicalBase64(file.salt, 16, 'salt');
  parseCanonicalBase64(file.iv, 12, 'IV');
  parseCanonicalBase64(file.ciphertext, null, 'conteúdo cifrado', 16);
  const key = await deriveVaultKey(passphrase, salt, file.iterations);
  let plaintext;
  try { plaintext = await decryptText(file, key, AAD); }
  catch { throw new Error('Não foi possível autenticar o backup. Verifique a senha e se o arquivo está íntegro.'); }
  let snapshot;
  try { snapshot = JSON.parse(plaintext); } catch { throw new Error('O conteúdo autenticado do backup não é JSON válido.'); }
  return validateSnapshot(snapshot);
}
