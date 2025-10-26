import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { z } from 'zod';

// Define o esquema de validação para as variáveis de ambiente usando Zod
const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN é obrigatório'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID é obrigatório'),
  DISCORD_GUILD_ID: z.string().optional(), // Opcional para desenvolvimento
  DISCORD_PUBLIC_KEY: z.string().min(1, 'DISCORD_PUBLIC_KEY é obrigatório'),
});

// Define o tipo para as variáveis de ambiente
export type Env = z.infer<typeof EnvSchema>;

@Injectable()
export class ConfigService {
  private readonly env: Env;

  constructor(private readonly nestConfigService: NestConfigService) {
    const envVars = {
      DISCORD_TOKEN: this.nestConfigService.get<string>('DISCORD_TOKEN'),
      DISCORD_CLIENT_ID: this.nestConfigService.get<string>('DISCORD_CLIENT_ID'),
      DISCORD_GUILD_ID: this.nestConfigService.get<string>('DISCORD_GUILD_ID'),
      DISCORD_PUBLIC_KEY: this.nestConfigService.get<string>('DISCORD_PUBLIC_KEY'),
    }
    // Valida as variáveis de ambiente no construtor
    const validationResult = EnvSchema.safeParse(envVars);

    if (!validationResult.success) {
      console.error('❌ Variáveis de ambiente inválidas:', validationResult.error.format());
      throw new Error('Configuração de ambiente inválida');
    }

    this.env = validationResult.data;
  }

  get discordToken(): string {
    return this.env.DISCORD_TOKEN;
  }

  get discordClientId(): string {
    return this.env.DISCORD_CLIENT_ID;
  }

  get discordGuildId(): string | undefined {
    return this.env.DISCORD_GUILD_ID;
  }

  get discordPublicKey(): string {
    return this.env.DISCORD_PUBLIC_KEY;
  }
}
