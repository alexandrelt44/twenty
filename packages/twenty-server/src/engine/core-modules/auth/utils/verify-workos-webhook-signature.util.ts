import { createHmac, timingSafeEqual } from 'crypto';

const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

export const verifyWorkosWebhookSignature = ({
  signatureHeader,
  rawBody,
  secret,
  now = Date.now(),
}: {
  signatureHeader: string | undefined;
  rawBody: Buffer;
  secret: string;
  now?: number;
}): boolean => {
  if (!signatureHeader) {
    return false;
  }

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=');

      return [key, value.join('=')];
    }),
  );

  const issuedAt = Number(parts.t);
  const signature = parts.v1;

  if (!Number.isFinite(issuedAt) || !signature) {
    return false;
  }

  if (Math.abs(now - issuedAt) > SIGNATURE_TOLERANCE_MS) {
    return false;
  }

  const expected = createHmac('sha256', secret)
    .update(`${parts.t}.${rawBody.toString('utf8')}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(signature, 'hex');

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
};
