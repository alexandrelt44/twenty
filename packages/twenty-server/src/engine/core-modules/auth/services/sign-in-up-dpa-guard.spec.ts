import { readFileSync } from 'node:fs';
import path from 'node:path';

// Twenty.com PBC does not process data for this fork, so sign-up must never
// record a click-through DPA naming it. Guards against upstream merges.
describe('sign-up DPA acceptance', () => {
  it('is not recorded when a workspace is created', () => {
    const source = readFileSync(
      path.join(__dirname, 'sign-in-up.service.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/DpaAgreementEntity|buildDpaAgreementRecord/);
  });
});
