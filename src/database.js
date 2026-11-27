import { decryptText, deriveVaultKey, encryptText, randomBytes, toBase64, fromBase64, KDF_ITERATIONS } from './crypto.js';
import { MAX_BACKUP_RECORDS } from './backup.js';

const DB_NAME = 'lifeos';
const DB_VERSION = 2;
const VERIFIER = 'LifeOS vault integrity v1';
const MIN_SUPPORTED_KDF_ITERATIONS = 310_000;
const encoder = new TextEncoder();

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('records')) {
        const records = db.createObjectStore('records', { keyPath: 'id' });
        records.createIndex('collection', 'collection', { unique: false });
      }
      // Structural migrations are additive and run inside IndexedDB's atomic upgrade transaction.
      const records = request.transaction.objectStore('records');
      if (!records.indexNames.contains('collection')) records.createIndex('collection', 'collection', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir o armazenamento local.'));
    request.onblocked = () => reject(new Error('Feche outras abas do LifeOS para concluir a atualização do armazenamento.'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha ao acessar o armazenamento local.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('A gravação local foi cancelada.'));
    transaction.onerror = () => reject(transaction.error || new Error('Falha na transação local.'));
  });
}

async function mapInBatches(items, mapper, batchSize = 32) {
  const results = [];
  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    results.push(...await Promise.all(batch.map(mapper)));
  }
  return results;
}

async function getMeta(db, key) {
  const transaction = db.transaction('meta', 'readonly');
  return requestResult(transaction.objectStore('meta').get(key));
}

async function addMeta(db, record) {
  const transaction = db.transaction('meta', 'readwrite');
  const completed = transactionDone(transaction);
  await Promise.all([requestResult(transaction.objectStore('meta').add(record)), completed]);
}

export async function hasVault(db) {
  return Boolean(await getMeta(db, 'vault'));
}

export class Vault {
  #db;
  #key;

  constructor(db, key) {
    this.#db = db;
    this.#key = key;
  }

  get unlocked() { return Boolean(this.#key); }

  lock() { this.#key = null; }

  #requireKey() {
    if (!this.#key) throw new Error('O cofre está bloqueado.');
    return this.#key;
  }

  async save(collection, id, value) {
    const key = this.#requireKey();
    if (typeof collection !== 'string' || !collection.trim() || typeof id !== 'string' || !id.trim()) {
      throw new Error('Coleção e identificador são obrigatórios.');
    }
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error('O registro não pode ser serializado em JSON.');
    const aad = `lifeos:v1:${collection}:${id}`;
    const encrypted = await encryptText(serialized, key, aad);
    const record = { id, collection, iv: encrypted.iv, ciphertext: encrypted.ciphertext };
    const transaction = this.#db.transaction('records', 'readwrite');
    const completed = transactionDone(transaction);
    await Promise.all([requestResult(transaction.objectStore('records').put(record)), completed]);
    return value;
  }

  async get(collection, id) {
    const key = this.#requireKey();
    const transaction = this.#db.transaction('records', 'readonly');
    const row = await requestResult(transaction.objectStore('records').get(id));
    if (!row) return undefined;
    if (row.collection !== collection) throw new Error('Registro incompatível com a coleção solicitada.');
    const plaintext = await decryptText(row, key, `lifeos:v1:${row.collection}:${row.id}`);
    return JSON.parse(plaintext);
  }

  async list(collection) {
    const key = this.#requireKey();
    const transaction = this.#db.transaction('records', 'readonly');
    const rows = await requestResult(transaction.objectStore('records').index('collection').getAll(collection));
    const values = await Promise.all(rows.map(async (row) => {
      const plaintext = await decryptText(row, key, `lifeos:v1:${row.collection}:${row.id}`);
      return { id: row.id, value: JSON.parse(plaintext) };
    }));
    return values;
  }

  async delete(collection, id) {
    const deleted = await this.deleteBatch([{ collection, id }]);
    return deleted.length > 0;
  }

  async deleteBatch(entries) {
    this.#requireKey();
    const transaction = this.#db.transaction('records', 'readwrite');
    const store = transaction.objectStore('records');
    const completed = transactionDone(transaction);
    const deleted = new Set();
    let mismatch = false;
    for (const entry of entries) {
      const request = store.get(entry.id);
      request.onsuccess = () => {
        const row = request.result;
        if (!row) return;
        if (row.collection !== entry.collection) { mismatch = true; transaction.abort(); return; }
        store.delete(entry.id);
        deleted.add(entry.id);
      };
    }
    try { await completed; }
    catch (error) {
      if (mismatch) throw new Error('Nenhum registro foi excluído porque a coleção não corresponde.');
      throw error;
    }
    return [...deleted];
  }

  async storageInfo() {
    let estimate = null;
    let persistence = 'indisponível';
    try {
      if (navigator.storage?.estimate) estimate = await navigator.storage.estimate();
      if (navigator.storage?.persisted && await navigator.storage.persisted()) persistence = 'concedida';
      else if (navigator.storage?.persist) persistence = 'disponível para solicitação';
    } catch { /* diagnóstico opcional */ }
    const transaction = this.#db.transaction('records', 'readonly');
    const rows = await requestResult(transaction.objectStore('records').getAll());
    const collectionCounts = {};
    for (const row of rows) collectionCounts[row.collection] = (collectionCounts[row.collection] || 0) + 1;
    return { estimate, persistence, count: rows.length, collectionCounts };
  }

  async exportSnapshot() {
    const key = this.#requireKey();
    const transaction = this.#db.transaction('records', 'readonly');
    const rows = await requestResult(transaction.objectStore('records').getAll());
    if (rows.length > MAX_BACKUP_RECORDS) throw new Error('O cofre excede o limite de registros aceito para backup.');
    const seen = new Set();
    const records = await mapInBatches(rows, async (row) => {
      if (!row || typeof row.id !== 'string' || !row.id.trim() || typeof row.collection !== 'string' || !row.collection.trim()) {
        throw new Error('O cofre contém um registro com metadados inválidos; o backup foi cancelado.');
      }
      const key = row.id;
      if (seen.has(key)) throw new Error('O cofre contém identificadores duplicados; o backup foi cancelado.');
      seen.add(key);
      const plaintext = await decryptText(row, this.#requireKey(), `lifeos:v1:${row.collection}:${row.id}`);
      return { id: row.id, collection: row.collection, value: JSON.parse(plaintext) };
    });
    return { schema: 1, records };
  }

  async replaceAll(logicalRecords) {
    const key = this.#requireKey();
    if (!Array.isArray(logicalRecords) || logicalRecords.length > MAX_BACKUP_RECORDS) throw new Error('Lista de registros inválida para restauração.');
    const seen = new Set();
    const encryptedRows = await mapInBatches(logicalRecords, async (row) => {
      if (!row || typeof row.id !== 'string' || !row.id.trim() || row.id.length > 200 || typeof row.collection !== 'string' || !row.collection.trim() || row.collection.length > 120 || !Object.hasOwn(row, 'value')) {
        throw new Error('A restauração contém um registro inválido; o cofre não foi alterado.');
      }
      const uniqueKey = row.id;
      if (seen.has(uniqueKey)) throw new Error('A restauração contém identificadores duplicados; o cofre não foi alterado.');
      seen.add(uniqueKey);
      const serialized = JSON.stringify(row.value);
      if (serialized === undefined) throw new Error('A restauração contém dados inválidos; o cofre não foi alterado.');
      const encrypted = await encryptText(serialized, key, `lifeos:v1:${row.collection}:${row.id}`);
      return { id: row.id, collection: row.collection, iv: encrypted.iv, ciphertext: encrypted.ciphertext };
    });
    const transaction = this.#db.transaction('records', 'readwrite');
    const completed = transactionDone(transaction);
    const store = transaction.objectStore('records');
    store.clear();
    for (const row of encryptedRows) store.put(row);
    await completed;
    return encryptedRows.length;
  }

  async validateIntegrity() {
    const key = this.#requireKey();
    const transaction = this.#db.transaction('records', 'readonly');
    const rows = await requestResult(transaction.objectStore('records').getAll());
    const failures = [];
    for (const row of rows) {
      try {
        if (!row || typeof row.id !== 'string' || typeof row.collection !== 'string') throw new Error('Metadados inválidos.');
        const plaintext = await decryptText(row, key, `lifeos:v1:${row.collection}:${row.id}`);
        JSON.parse(plaintext);
      } catch {
        failures.push({ id: typeof row?.id === 'string' ? row.id : '', collection: typeof row?.collection === 'string' ? row.collection : '' });
      }
    }
    return { total: rows.length, valid: rows.length - failures.length, failures };
  }

  async requestPersistence() {
    if (!navigator.storage?.persist) return 'unsupported';
    return await navigator.storage.persist() ? 'granted' : 'denied';
  }
}

export async function createVault(db, passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 10) throw new Error('Use uma senha com pelo menos 10 caracteres.');
  if (await hasVault(db)) throw new Error('Este dispositivo já tem um cofre configurado.');
  const salt = randomBytes(16);
  const key = await deriveVaultKey(passphrase, salt);
  const check = await encryptText(VERIFIER, key, 'lifeos:v1:verifier');
  try {
    await addMeta(db, { key: 'vault', schema: 1, kdf: 'PBKDF2-SHA-256', iterations: KDF_ITERATIONS, salt: toBase64(salt), check });
  } catch (error) {
    if (error?.name === 'ConstraintError') throw new Error('Este dispositivo já tem um cofre configurado.');
    throw error;
  }
  return new Vault(db, key);
}

export async function unlockVault(db, passphrase) {
  const config = await getMeta(db, 'vault');
  if (!config) throw new Error('Este dispositivo ainda não tem um cofre configurado.');
  if (config.schema !== 1 || config.kdf !== 'PBKDF2-SHA-256' || !Number.isInteger(config.iterations) || config.iterations < MIN_SUPPORTED_KDF_ITERATIONS || config.iterations > 2_000_000) {
    throw new Error('Formato criptográfico desconhecido. Os dados foram preservados.');
  }
  const salt = fromBase64(config.salt);
  if (salt.length !== 16 || !config.check?.iv || !config.check?.ciphertext) throw new Error('Parâmetros criptográficos inválidos. Os dados foram preservados.');
  const key = await deriveVaultKey(passphrase, salt, config.iterations);
  try {
    if (await decryptText(config.check, key, 'lifeos:v1:verifier') !== VERIFIER) throw new Error('Senha incorreta.');
  } catch {
    throw new Error('Senha incorreta. Seus dados continuam preservados.');
  }
  return new Vault(db, key);
}

export async function getRawRecord(db, id) {
  const transaction = db.transaction('records', 'readonly');
  return requestResult(transaction.objectStore('records').get(id));
}

export async function getRawVaultMeta(db) {
  return getMeta(db, 'vault');
}

export function utf8Bytes(value) { return encoder.encode(value).byteLength; }
