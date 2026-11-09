import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { createTransport } from 'nodemailer';
import { ConnectedAccountProvider } from 'twenty-shared/types';

import { SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { ConnectedAccountTokenEncryptionService } from 'src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.service';
import { SmtpClientProvider } from 'src/modules/messaging/message-import-manager/drivers/smtp/providers/smtp-client.provider';

jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({})) }));

describe('SmtpClientProvider', () => {
  const smtpParams = {
    host: 'smtp.example.com',
    port: 587,
    password: 'secret',
  };

  const getTlsOptions = async (isSelfSignedCertificateAllowed: boolean) => {
    const module = await Test.createTestingModule({
      providers: [
        SmtpClientProvider,
        {
          provide: SecureHttpClientService,
          useValue: {
            getValidatedHost: jest.fn().mockResolvedValue('203.0.113.10'),
          },
        },
        {
          provide: TwentyConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(isSelfSignedCertificateAllowed),
          },
        },
        {
          provide: ConnectedAccountTokenEncryptionService,
          useValue: {
            decryptProtocolPassword: jest.fn().mockReturnValue(smtpParams),
          },
        },
        {
          provide: getRepositoryToken(ConnectedAccountEntity),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              provider: ConnectedAccountProvider.IMAP_SMTP_CALDAV,
              handle: 'user@example.com',
              workspaceId: 'workspace-id',
              connectionParameters: { SMTP: smtpParams },
            }),
          },
        },
      ],
    }).compile();

    await module.get(SmtpClientProvider).getClient('connected-account-id');

    return (createTransport as jest.Mock).mock.lastCall?.[0].tls;
  };

  it('verifies the certificate against the configured hostname by default', async () => {
    await expect(getTlsOptions(false)).resolves.toEqual({
      rejectUnauthorized: true,
      servername: 'smtp.example.com',
    });
  });

  it('skips verification only when self-signed certificates are allowed', async () => {
    await expect(getTlsOptions(true)).resolves.toMatchObject({
      rejectUnauthorized: false,
    });
  });
});
