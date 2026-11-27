import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptText, deriveVaultKey, encryptText, randomBytes } from '../src/crypto.js';
import { DEFAULT_PREFERENCES, normalizePreferences } from '../src/preferences.js';

test('AES-GCM criptografa e descriptografa conteúdo autenticado', async () => {
  const salt = randomBytes(16);
  const key = await deriveVaultKey('uma senha local bem longa', salt);
  const envelope = await encryptText('{"title":"privado"}', key, 'lifeos:v1:tasks:abc');
  assert.equal(await decryptText(envelope, key, 'lifeos:v1:tasks:abc'), '{"title":"privado"}');
  assert.notEqual(envelope.ciphertext, '{"title":"privado"}');
});

test('salt diferente deriva chaves que não abrem o mesmo registro', async () => {
  const first = await deriveVaultKey('uma senha local bem longa', randomBytes(16));
  const second = await deriveVaultKey('uma senha local bem longa', randomBytes(16));
  const envelope = await encryptText('conteúdo', first, 'contexto');
  await assert.rejects(decryptText(envelope, second, 'contexto'));
});

test('alterar ciphertext ou contexto falha na autenticação', async () => {
  const key = await deriveVaultKey('outra senha segura suficientemente longa', randomBytes(16));
  const envelope = await encryptText('segredo', key, 'lifeos:v1:settings:appearance');
  const bytes = Uint8Array.from(atob(envelope.ciphertext), (char) => char.charCodeAt(0));
  bytes[0] ^= 1;
  const altered = { ...envelope, ciphertext: btoa(String.fromCharCode(...bytes)) };
  await assert.rejects(decryptText(altered, key, 'lifeos:v1:settings:appearance'));
  await assert.rejects(decryptText(envelope, key, 'lifeos:v1:settings:other'));
});

test('preferências inválidas voltam a valores seguros e preservam personalização válida', () => {
  const preferences = normalizePreferences({ theme: 'rainbow', accent: '#22aabb', textScale: 200, radius: 5, density: 'compact' });
  assert.equal(preferences.theme, DEFAULT_PREFERENCES.theme);
  assert.equal(preferences.accent, '#22aabb');
  assert.equal(preferences.textScale, 200);
  assert.equal(normalizePreferences({ textScale: 250 }).textScale, 200);
  assert.equal(normalizePreferences({ textScale: 80 }).textScale, 90);
  assert.equal(normalizePreferences({ simplified: true }).simplified, true);
  assert.equal(preferences.radius, 8);
  assert.equal(preferences.density, 'compact');
  assert.equal(normalizePreferences({ typography: 'not-a-preset' }).typography, 'system');
});
