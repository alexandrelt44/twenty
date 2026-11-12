import { createHmac } from 'crypto';

import { verifyWorkosWebhookSignature } from 'src/engine/core-modules/auth/utils/verify-workos-webhook-signature.util';

const SECRET = 'webhook-secret';
const NOW = 1_800_000_000_000;
const BODY = Buffer.from('{"event":"organization_membership.created"}');

const sign = (timestamp: number, body: Buffer, secret = SECRET) =>
  `t=${timestamp}, v1=${createHmac('sha256', secret)
    .update(`${timestamp}.${body.toString('utf8')}`)
    .digest('hex')}`;

describe('verifyWorkosWebhookSignature', () => {
  it('accepts a body signed with the secret', () => {
    expect(
      verifyWorkosWebhookSignature({
        signatureHeader: sign(NOW, BODY),
        rawBody: BODY,
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(true);
  });

  it('refuses a body signed with another secret', () => {
    expect(
      verifyWorkosWebhookSignature({
        signatureHeader: sign(NOW, BODY, 'other-secret'),
        rawBody: BODY,
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it('refuses a body changed after signing', () => {
    expect(
      verifyWorkosWebhookSignature({
        signatureHeader: sign(NOW, BODY),
        rawBody: Buffer.from('{"event":"organization_membership.deleted"}'),
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it('refuses a signature older than five minutes', () => {
    expect(
      verifyWorkosWebhookSignature({
        signatureHeader: sign(NOW - 6 * 60 * 1000, BODY),
        rawBody: BODY,
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it('refuses a missing or malformed header', () => {
    for (const signatureHeader of [undefined, '', 'v1=abc', 't=abc, v1=def']) {
      expect(
        verifyWorkosWebhookSignature({
          signatureHeader,
          rawBody: BODY,
          secret: SECRET,
          now: NOW,
        }),
      ).toBe(false);
    }
  });
});
