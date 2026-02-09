import { describe, it, expect } from 'vitest';

describe('project setup', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should support TypeScript features', () => {
    const greet = (name: string): string => `Hello, ${name}`;
    expect(greet('AltDocs')).toBe('Hello, AltDocs');
  });
});
