import { test } from 'node:test';
import assert from 'node:assert/strict';
import inputs from '../combo-inputs.js';

test('diagonal inputs are a single arrow and simultaneous buttons stay together', () => {
  const tokens = inputs.parse('d/f,1+2 ► D/B*,4');
  assert.deepEqual(tokens.filter(t => t.kind === 'direction').map(t => [t.raw, t.held]), [['df', false], ['DB', true]]);
  assert.deepEqual(tokens.filter(t => t.kind === 'buttons').map(t => t.buttons), [['1', '2'], ['4']]);
  assert.equal(tokens.filter(t => t.major).length, 1);
});
test('motions expand correctly while stance names, whiffs and timing remain visible', () => {
  const tokens = inputs.parse('qcf+2 ► (TOM.3) ► CJM.uf+3~1:2 >4');
  assert.deepEqual(tokens.filter(t => t.kind === 'direction').map(t => t.raw), ['d', 'df', 'f', 'uf']);
  assert.ok(tokens.some(t => t.text === 'TOM'));
  assert.ok(tokens.some(t => t.text === '('));
  assert.ok(tokens.some(t => t.text === ')'));
  assert.deepEqual(tokens.filter(t => t.kind === 'timing').map(t => t.text), ['FAST', 'JUST', 'DELAY']);
  assert.equal(inputs.parse('1+2*')[0].held, true);
  assert.deepEqual(inputs.parse('ws3').map(t => t.kind), ['text', 'buttons']);
  assert.deepEqual(inputs.parse('uf4').map(t => t.kind), ['direction', 'buttons']);
});
