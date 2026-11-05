import { describe, expect, it } from 'vitest';
import { findSecrets } from '../../scripts/scan-secrets.mjs';

describe('secret scanner', () => {
  it('detects credential-shaped strings without echoing the value', () => {
    const fake = 'ghp_' + 'a'.repeat(36);
    const hits = findSecrets(`const token = "${fake}";`, 'fixture.ts');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].type).toBe('github-pat');
    expect(JSON.stringify(hits)).not.toContain(fake);
  });

  it('allows empty environment placeholders', () => {
    expect(findSecrets('LLM_API_KEY=\nLLM_MODEL=\n', '.env.example')).toHaveLength(0);
  });
});
