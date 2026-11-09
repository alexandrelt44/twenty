import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ImapFlow } from 'imapflow';
import { ConnectedAccountProvider } from 'twenty-shared/types';

import { SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { ConnectedAccountTokenEncryptionService } from 'src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.service';
import { ImapClientProvider } from 'src/modules/messaging/message-import-manager/drivers/imap/providers/imap-client.provider';

jest.mock('imapflow', () => ({
  ImapFlow: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('ImapClientProvider', () => {
  const imapParams = {
    host: 'imap.example.com',
    port: 993,
    password: 'secret',
  };

  const getTlsOptions = async (isSelfSignedCertificateAllowed: boolean) => {
    const module = await Test.createTestingModule({
      providers: [
        ImapClientProvider,
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
            decryptProtocolPassword: jest.fn().mockReturnValue(imapParams),
          },
        },
        {
          provide: getRepositoryToken(ConnectedAccountEntity),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              provider: ConnectedAccountProvider.IMAP_SMTP_CALDAV,
              handle: 'user@example.com',
              workspaceId: 'workspace-id',
              connectionParameters: { IMAP: imapParams },
            }),
          },
        },
      ],
    }).compile();

    await module.get(ImapClientProvider).getClient('connected-account-id');

    return (ImapFlow as unknown as jest.Mock).mock.lastCall?.[0].tls;
  };

  it('verifies the certificate against the configured hostname by default', async () => {
    await expect(getTlsOptions(false)).resolves.toEqual({
      rejectUnauthorized: true,
      servername: 'imap.example.com',
    });
  });

  it('skips verification only when self-signed certificates are allowed', async () => {
    await expect(getTlsOptions(true)).resolves.toMatchObject({
      rejectUnauthorized: false,
    });
  });
});
