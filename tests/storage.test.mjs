import test from 'node:test';
import assert from 'node:assert/strict';
import { createVault, getRawRecord, getRawVaultMeta, unlockVault } from '../src/database.js';

class FakeRequest {}

class FakeTransaction {
  constructor(database, stores) {
    this.database = database;
    this.stores = Array.isArray(stores) ? stores : [stores];
    this.pending = 0;
    this.completed = false;
    this.aborted = false;
    this.error = null;
  }

  objectStore(name) {
    if (!this.stores.includes(name)) throw new Error(`Store não incluída na transação: ${name}`);
    const map = this.database.maps[name];
    const request = (operation, write = false) => {
      const result = new FakeRequest();
      this.pending += 1;
      setTimeout(() => {
        if (this.aborted) return;
        try {
          if (write && this.database.failNextWrite) {
            const error = this.database.failNextWrite;
            this.database.failNextWrite = null;
            throw error;
          }
          result.result = operation();
          result.onsuccess?.();
          this.pending -= 1;
          this.#completeWhenIdle();
        } catch (error) {
          result.error = error;
          result.onerror?.();
          this.abort(error);
        }
      }, 0);
      return result;
    };
    const store = {
      get: (key) => request(() => structuredClone(map.get(key))),
      getAll: () => request(() => [...map.values()].map((value) => structuredClone(value))),
      count: () => request(() => map.size),
      put: (value) => request(() => { const key = name === 'meta' ? value.key : value.id; map.set(key, structuredClone(value)); return key; }, true),
      add: (value) => request(() => {
        const key = name === 'meta' ? value.key : value.id;
        if (map.has(key)) throw Object.assign(new Error('Duplicate key'), { name: 'ConstraintError' });
        map.set(key, structuredClone(value)); return key;
      }, true),
      delete: (key) => request(() => map.delete(key), true),
      index: (indexName) => {
        if (indexName !== 'collection' || name !== 'records') throw new Error('Índice desconhecido.');
        return { getAll: (collection) => request(() => [...map.values()].filter((row) => row.collection === collection).map((row) => structuredClone(row))) };
      }
    };
    return store;
  }

  abort(error = new Error('Transaction aborted')) {
    if (this.aborted || this.completed) return;
    this.aborted = true;
    this.error = error;
    setTimeout(() => this.onabort?.(), 0);
  }

  #completeWhenIdle() {
    if (this.pending !== 0 || this.completed || this.aborted) return;
    queueMicrotask(() => {
      if (this.pending === 0 && !this.completed && !this.aborted) {
        this.completed = true;
        this.oncomplete?.();
      }
    });
  }
}

class FakeDatabase {
  constructor() {
    this.maps = { meta: new Map(), records: new Map() };
    this.failNextWrite = null;
  }

  transaction(stores) { return new FakeTransaction(this, stores); }
}

const testPassphrase = 'audit-only passphrase not for user data';

test('CRUD pelo cofre mantém conteúdo cifrado no envelope e preserva dados após lock/unlock', async () => {
  const db = new FakeDatabase();
  const vault = await createVault(db, testPassphrase);
  const privateText = 'audit-only secret payload 71c902';
  const original = { title: privateText, done: false };
  await vault.save('tasks', 'audit-task-1', original);

  const raw = await getRawRecord(db, 'audit-task-1');
  assert.deepEqual(Object.keys(raw).sort(), ['ciphertext', 'collection', 'id', 'iv']);
  assert.equal(JSON.stringify(raw).includes(privateText), false);
  assert.deepEqual(await vault.get('tasks', 'audit-task-1'), original);

  await vault.save('tasks', 'audit-task-1', { ...original, done: true });
  assert.equal((await vault.list('tasks')).length, 1);
  assert.equal((await vault.get('tasks', 'audit-task-1')).done, true);
  await vault.save('goals', 'audit-mismatch-id', { title: 'Still preserved' });
  await assert.rejects(vault.delete('tasks', 'audit-mismatch-id'), /coleção/i);
  assert.equal((await vault.get('goals', 'audit-mismatch-id')).title, 'Still preserved');
  assert.equal(await vault.delete('tasks', 'missing-audit-task'), false);
  assert.equal(await vault.delete('tasks', 'audit-task-1'), true);
  assert.equal(await vault.get('tasks', 'audit-task-1'), undefined);

  await vault.save('habits', 'audit-habit-1', { title: privateText });
  vault.lock();
  await assert.rejects(vault.get('habits', 'audit-habit-1'), /bloqueado/i);
  const reopened = await unlockVault(db, testPassphrase);
  assert.deepEqual(await reopened.get('habits', 'audit-habit-1'), { title: privateText });
});

test('senha incorreta não desbloqueia nem altera registros cifrados', async () => {
  const db = new FakeDatabase();
  const vault = await createVault(db, testPassphrase);
  await vault.save('goals', 'audit-goal-1', { title: 'Audit objective' });
  const before = await getRawRecord(db, 'audit-goal-1');
  await assert.rejects(unlockVault(db, 'wrong audit passphrase'), /Senha incorreta/);
  const after = await getRawRecord(db, 'audit-goal-1');
  assert.deepEqual(after, before);
});

test('alterar ciphertext ou AAD impede leitura e falha sem retornar texto', async () => {
  const db = new FakeDatabase();
  const vault = await createVault(db, testPassphrase);
  await vault.save('events', 'audit-event-1', { title: 'Audit event content' });
  const raw = await getRawRecord(db, 'audit-event-1');
  const bytes = Uint8Array.from(atob(raw.ciphertext), (character) => character.charCodeAt(0));
  bytes[0] ^= 1;
  raw.ciphertext = btoa(String.fromCharCode(...bytes));
  db.maps.records.set(raw.id, raw);
  await assert.rejects(vault.get('events', 'audit-event-1'));
  await assert.rejects(vault.get('tasks', 'audit-event-1'), /coleção/i);
});

test('gravação falha de forma explícita e não substitui registros existentes', async () => {
  const db = new FakeDatabase();
  const vault = await createVault(db, testPassphrase);
  await vault.save('settings', 'audit-setting', { value: 'original' });
  const before = await getRawRecord(db, 'audit-setting');
  db.failNextWrite = Object.assign(new Error('Quota exceeded'), { name: 'QuotaExceededError' });
  await assert.rejects(vault.save('settings', 'audit-setting', { value: 'replacement' }), /Quota exceeded/);
  assert.deepEqual(await getRawRecord(db, 'audit-setting'), before);
  await assert.rejects(vault.save('', '', { value: 1 }), /obrigatórios/);
  await assert.rejects(vault.save('settings', 'undefined-record', undefined), /serializado/);
});

test('duas configurações concorrentes não substituem a chave do cofre', async () => {
  const db = new FakeDatabase();
  const outcomes = await Promise.allSettled([
    createVault(db, testPassphrase),
    createVault(db, 'second audit passphrase only')
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1);
  const metadata = await getRawVaultMeta(db);
  assert.equal(metadata.schema, 1);
});
