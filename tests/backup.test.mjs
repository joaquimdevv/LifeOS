import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupFile, readBackupFile, BACKUP_FORMAT } from '../src/backup.js';

const backupPassword = 'senha de backup para teste';
const snapshot = { schema: 1, records: [
  { collection: 'tasks', id: 'task-audit-1', value: { title: 'conteúdo confidencial do teste' } },
  { collection: 'settings', id: 'appearance', value: { theme: 'dark' } }
] };

test('backup usa formato versionado e cifra snapshot sem expor conteúdo', async () => {
  const file = await createBackupFile(snapshot, backupPassword);
  assert.equal(file.format, BACKUP_FORMAT);
  assert.equal(file.version, 1);
  assert.equal(file.cipher, 'AES-256-GCM');
  assert.equal(JSON.stringify(file).includes('conteúdo confidencial do teste'), false);
  assert.deepEqual(await readBackupFile(JSON.stringify(file), backupPassword), snapshot);
});

test('senha incorreta e ciphertext adulterado são rejeitados antes da restauração', async () => {
  const file = await createBackupFile(snapshot, backupPassword);
  await assert.rejects(readBackupFile(file, 'senha de backup errada'), /autenticar/);
  const changed = { ...file, ciphertext: `${file.ciphertext.slice(0, -4)}AAAA` };
  await assert.rejects(readBackupFile(changed, backupPassword), /autenticar/);
});

test('cabeçalho, base64, IV e limite de tamanho são validados', async () => {
  const file = await createBackupFile(snapshot, backupPassword);
  await assert.rejects(readBackupFile({ ...file, version: 99 }, backupPassword), /Formato, versão/);
  await assert.rejects(readBackupFile({ ...file, iv: 'abc' }, backupPassword), /IV/);
  await assert.rejects(readBackupFile('{not json', backupPassword), /JSON válido/);
  await assert.rejects(readBackupFile(' '.repeat(50 * 1024 * 1024 + 1), backupPassword), /50 MB/);
  await assert.rejects(createBackupFile(snapshot, 'curta'), /10 caracteres/);
});

test('conteúdo autenticado rejeita IDs duplicados', async () => {
  const duplicate = { schema: 1, records: [
    { collection: 'tasks', id: 'same-id', value: 1 },
    { collection: 'goals', id: 'same-id', value: 2 }
  ] };
  await assert.rejects(createBackupFile(duplicate, backupPassword), /duplicados/);
});
