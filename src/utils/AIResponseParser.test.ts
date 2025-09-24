import { AIResponseParser } from './AIResponseParser';

describe('AIResponseParser', () => {
  it('should parse a valid JSON string', () => {
    const jsonString = '{"key": "value", "number": 123}';
    const expected = { key: 'value', number: 123 };
    expect(AIResponseParser.parseAIResponse(jsonString)).toEqual(expected);
  });

  it('should handle leading and trailing whitespace', () => {
    const jsonString = '  {"key": "value"}  ';
    const expected = { key: 'value' };
    expect(AIResponseParser.parseAIResponse(jsonString)).toEqual(expected);
  });

  it('should remove markdown code blocks', () => {
    const jsonString = '```json\n{"key": "value"}\n```';
    const expected = { key: 'value' };
    expect(AIResponseParser.parseAIResponse(jsonString)).toEqual(expected);
  });

  it('should handle trailing commas in objects', () => {
    const jsonString = '{"key": "value",}';
    const expected = { key: 'value' };
    expect(AIResponseParser.parseAIResponse(jsonString)).toEqual(expected);
  });

  it('should handle trailing commas in arrays', () => {
    const jsonString = '{"key": ["value1", "value2",]}';
    const expected = { key: ['value1', 'value2'] };
    expect(AIResponseParser.parseAIResponse(jsonString)).toEqual(expected);
  });

  it('should quote unquoted keys', () => {
    const jsonString = '{key: "value", "another-key": 123}';
    const expected = { key: 'value', 'another-key': 123 };
    expect(AIResponseParser.parseAIResponse(jsonString)).toEqual(expected);
  });

  it('should handle a combination of issues', () => {
    const jsonString = '```json\n{ key: "value", items: [1, 2, 3,], }  \n```';
    const expected = { key: 'value', items: [1, 2, 3] };
    expect(AIResponseParser.parseAIResponse(jsonString)).toEqual(expected);
  });

  it('should throw an error for completely malformed JSON', () => {
    const jsonString = 'this is not json';
    expect(() => AIResponseParser.parseAIResponse(jsonString)).toThrow();
  });

  it('should throw an error for unfixable JSON', () => {
    const jsonString = '{"key": "value"'; // Missing closing brace
    expect(() => AIResponseParser.parseAIResponse(jsonString)).toThrow();
  });
});