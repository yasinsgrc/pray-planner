import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeHtmlEntities } from './htmlEntities';

test('decodeHtmlEntities decodes named entities without touching the surrounding words', () => {
  assert.equal(decodeHtmlEntities('O, &quot;Rabbimiz&quot; dedi.'), 'O, "Rabbimiz" dedi.');
  assert.equal(decodeHtmlEntities('Allah&#39;ın rahmeti'), "Allah'ın rahmeti");
  assert.equal(decodeHtmlEntities('bu &amp; şu'), 'bu & şu');
  assert.equal(decodeHtmlEntities('&lt;tag&gt;'), '<tag>');
  assert.equal(decodeHtmlEntities('a&nbsp;b'), 'a b');
});

test('decodeHtmlEntities decodes numeric decimal and hex entities', () => {
  assert.equal(decodeHtmlEntities('&#39;merhaba&#39;'), "'merhaba'");
  assert.equal(decodeHtmlEntities('&#x27;merhaba&#x27;'), "'merhaba'");
});

test('decodeHtmlEntities leaves plain text with no entities completely unchanged', () => {
  const plain = 'Rabbimiz bize dünyada da iyilik ver, ahirette de iyilik ver.';
  assert.equal(decodeHtmlEntities(plain), plain);
});
