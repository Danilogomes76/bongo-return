import { Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as nacl from 'tweetnacl';
import { ConfigService } from './config/config.service';
import { DiscordService } from './discord/discord.service';
import { DiscordInteractionData } from './types/discord.types';

@Controller()
export class AppController {
  private readonly publicKey: Uint8Array;

  constructor(
    private readonly configService: ConfigService,
    private readonly discordService: DiscordService,
  ) {
    // Obtém a chave pública do bot do ConfigService
    const publicKeyHex = this.configService.discordPublicKey;
    this.publicKey = Buffer.from(publicKeyHex, 'hex');
  }

  @Post('interactions')
  async handleInteractions(@Req() req: Request, @Res() res: Response) {
    console.log('Interactions endpoint is working');

    const signature = req.headers['x-signature-ed25519'] as string;
    const timestamp = req.headers['x-signature-timestamp'] as string;
    const body = JSON.stringify(req.body);


    if (!signature || !timestamp) {
      console.log('Missing signature headers');
      return res.status(401).json({ error: 'Missing signature headers' });
    }

    try {
      // Validação da assinatura Ed25519
      const isValid = this.verifySignature(signature, timestamp, body);

      if (!isValid) {
        console.log('Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      console.log('Validation successful');

      // Resposta para PING (tipo 1)
      if (req.body?.type === 1) {
        return res.status(200).json({ type: 1 });
      }

      // Para comandos slash (tipo 2), processa através do DiscordService
      if (req.body?.type === 2) {
        try {
          const response = await this.discordService.handleSlashCommand(req.body as DiscordInteractionData);
          return res.status(200).json(response);
        } catch (error) {
          console.error('Erro ao processar comando slash:', error);
          return res.status(200).json({
            type: 4,
            data: {
              content: '❌ Erro ao processar comando.',
              flags: 64 // ephemeral
            }
          });
        }
      }

      // Para outros tipos de interação, retorna sucesso
      return res.status(200).json({
        type: 1,
        message: 'Interactions endpoint is working'
      });
    } catch (error) {
      console.error('Validation error:', error);
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  private verifySignature(signature: string, timestamp: string, body: string): boolean {
    try {
      const signatureBuffer = Buffer.from(signature, 'hex');
      const message = Buffer.concat([
        Buffer.from(timestamp),
        Buffer.from(body)
      ]);

      return nacl.sign.detached.verify(
        message,
        signatureBuffer,
        this.publicKey
      );
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }
}
