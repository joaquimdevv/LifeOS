import test from 'node:test';
import assert from 'node:assert/strict';
import { addRecurrence, dueToday, isOverdue, isRecurringOn, isValidDateOnly, shiftDate } from '../src/validation.js';

test('datas locais validam o calendário e avançam sem deriva de fuso', () => {
  assert.equal(isValidDateOnly('2026-02-28'), true);
  assert.equal(isValidDateOnly('2026-02-29'), false);
  assert.equal(isValidDateOnly('2026-13-01'), false);
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
});

test('recorrência diária, semanal e mensal calcula a próxima ocorrência', () => {
  assert.equal(addRecurrence('2026-04-09', 'daily'), '2026-04-10');
  assert.equal(addRecurrence('2026-04-09', 'weekly'), '2026-04-16');
  assert.equal(addRecurrence('2026-01-31', 'monthly'), '2026-02-28');
});

test('eventos repetidos aparecem no dia da semana e no dia do mês configurados', () => {
  const weekly = { startAt: new Date(2026, 0, 5, 9).toISOString(), recurrence: 'weekly' };
  const monthly = { startAt: new Date(2026, 0, 5, 9).toISOString(), recurrence: 'monthly' };
  assert.equal(isRecurringOn(weekly, '2026-01-12'), true);
  assert.equal(isRecurringOn(weekly, '2026-01-13'), false);
  assert.equal(isRecurringOn(monthly, '2026-02-05'), true);
  assert.equal(isRecurringOn(monthly, '2026-02-06'), false);
});

test('hábitos consideram dias locais e tarefas atrasadas excluem concluídas', () => {
  const specificDays = { frequency: 'specific', days: [1, 3, 5] };
  assert.equal(dueToday(specificDays, '2026-03-02'), true); // segunda
  assert.equal(dueToday(specificDays, '2026-03-03'), false); // terça
  assert.equal(isOverdue({ status: 'open', dueDate: '2026-03-01' }, '2026-03-02'), true);
  assert.equal(isOverdue({ status: 'done', dueDate: '2026-03-01' }, '2026-03-02'), false);
});
