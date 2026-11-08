import { Test } from '@nestjs/testing';

import { ImapFlow } from 'imapflow';
import { createTransport } from 'nodemailer';

import { ImapSmtpCaldavService } from 'src/engine/core-modules/imap-smtp-caldav-connection/services/imap-smtp-caldav-connection.service';
import { type ConnectionParameters } from 'src/engine/core-modules/imap-smtp-caldav-connection/types/imap-smtp-caldav-connection.type';
import { SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

jest.mock('imapflow', () => ({
  ImapFlow: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
    authenticated: false,
  })),
}));
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    verify: jest.fn().mockResolvedValue(true),
  })),
}));

describe('ImapSmtpCaldavService connection tests', () => {
  const params = {
    host: 'mail.example.com',
    port: 993,
    password: 'secret',
  } as ConnectionParameters;
  const verifiedTlsOptions = {
    rejectUnauthorized: true,
    servername: 'mail.example.com',
  };

  let service: ImapSmtpCaldavService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ImapSmtpCaldavService],
    })
      .useMocker((token) => {
        if (token === SecureHttpClientService) {
          return {
            getValidatedHost: jest.fn().mockResolvedValue('203.0.113.10'),
          };
        }

        return token === TwentyConfigService
          ? { get: jest.fn().mockReturnValue(false) }
          : {};
      })
      .compile();

    service = module.get(ImapSmtpCaldavService);
  });

  it('verifies the IMAP certificate by default', async () => {
    await service.testImapConnection('user@example.com', params);

    expect((ImapFlow as unknown as jest.Mock).mock.lastCall?.[0].tls).toEqual(
      verifiedTlsOptions,
    );
  });

  it('verifies the SMTP certificate by default', async () => {
    await service.testSmtpConnection('user@example.com', params);

    expect((createTransport as jest.Mock).mock.lastCall?.[0].tls).toEqual(
      verifiedTlsOptions,
    );
  });
});
