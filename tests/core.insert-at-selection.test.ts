import { insertAtSelection, normalizeInputText } from '@starisian/3iatlas-multilingual-input-core';

describe('core insertion behavior', () => {
  test('replaces selected text and moves caret to inserted character boundary', () => {
    const result = insertAtSelection(
      {
        value: 'N ka taa',
        selectionStart: 2,
        selectionEnd: 4,
      },
      'ñ'
    );

    expect(result.value).toBe('N ñ taa');
    expect(result.selectionStart).toBe(3);
    expect(result.selectionEnd).toBe(3);
  });

  test('normalizes text in configured normalization form', () => {
    const decomposed = 'e\u0301';
    expect(normalizeInputText(decomposed, 'NFC')).toBe('é');
  });
});
