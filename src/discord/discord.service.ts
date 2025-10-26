import { REST } from '@discordjs/rest';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ButtonInteraction, ChatInputCommandInteraction, Client, GatewayIntentBits, Partials, Routes, SlashCommandBuilder } from 'discord.js';
import { ConfigService } from '../config/config.service';
import { MusicService } from '../music/music.service';
import { DiscordInteractionData } from '../types/discord.types';

@Injectable()
export class DiscordService implements OnModuleInit {
  private readonly logger = new Logger(DiscordService.name);
  private client: Client;
  private rest: REST;

  constructor(
    private readonly configService: ConfigService,
    private readonly musicService: MusicService,
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [Partials.Channel],
    });

    this.rest = new REST({ version: '10' }).setToken(this.configService.discordToken);
  }

  async onModuleInit() {
    this.client.on('ready', () => {
      this.logger.log(`Bot logado como ${this.client.user?.tag}!`);
      this.registerSlashCommands();
    });

    this.client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          if (interaction.commandName === 'play') {
            await this.handlePlayCommand(interaction as ChatInputCommandInteraction);
          }
        } else if (interaction.isButton()) {
          await this.handleButtonInteraction(interaction);
        }
      } catch (error) {
        this.logger.error('Erro ao processar interação:', error);

        // Responde com erro se ainda não foi respondido
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          try {
            await interaction.reply({
              content: '❌ Ocorreu um erro ao processar sua solicitação.',
              ephemeral: true
            });
          } catch (replyError) {
            this.logger.error('Erro ao responder interação:', replyError);
          }
        }
      }
    });

    try {
      await this.client.login(this.configService.discordToken);
    } catch (error) {
      this.logger.error('Falha ao conectar ao Discord. Verifique o DISCORD_TOKEN no .env', error);
      // Não lança erro aqui para permitir que o NestJS inicie, mas o bot não estará conectado
    }
  }

  private async registerSlashCommands() {
    const commands = [
      new SlashCommandBuilder()
        .setName('play')
        .setDescription('Reproduz uma música ou playlist do YouTube.')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('URL do YouTube ou termo de busca.')
            .setRequired(true),
        ),
    ].map((command) => command.toJSON());

    const clientId = this.configService.discordClientId;
    const guildId = this.configService.discordGuildId;

    try {
      this.logger.log('Iniciando o registro dos comandos slash...');

      if (guildId) {
        // Registro de comandos em um servidor específico (mais rápido para desenvolvimento)
        await this.rest.put(Routes.applicationGuildCommands(clientId, guildId), {
          body: commands,
        });
        this.logger.log(`Comandos slash registrados no servidor (Guild ID: ${guildId}).`);
      } else {
        // Registro global (leva até 1 hora para propagar)
        await this.rest.put(Routes.applicationCommands(clientId), { body: commands });
        this.logger.log('Comandos slash registrados globalmente.');
      }
    } catch (error) {
      this.logger.error('Erro ao registrar comandos slash. Verifique o DISCORD_CLIENT_ID e DISCORD_GUILD_ID no .env', error);
    }
  }

  // O manipulador real do comando /play será implementado na Fase 4
  private async handlePlayCommand(interaction: ChatInputCommandInteraction) {
    try {
      // Responde imediatamente para evitar timeout
      await interaction.deferReply({ ephemeral: false });

      // A lógica de reprodução é delegada ao MusicService
      await this.musicService.play(interaction);
    } catch (error) {
      this.logger.error('Erro no comando play:', error);

      // Se ainda não foi respondido, responde com erro
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Erro ao processar o comando de reprodução.',
          ephemeral: true
        });
      } else if (interaction.isRepliable() && interaction.deferred) {
        // Se já foi deferido, edita a resposta
        await interaction.editReply({
          content: '❌ Erro ao processar o comando de reprodução.'
        });
      }
    }
  }

  // Método para processar comandos slash via HTTP (usado pelo AppController)
  async handleSlashCommand(interactionData: DiscordInteractionData): Promise<any> {
    try {
      const { data, guild_id, member } = interactionData;

      if (data?.name === 'play') {
        try {
          // Busca o servidor (guild) real
          const guild = await this.client.guilds.fetch(guild_id);
          if (!guild) {
            return {
              type: 4,
              data: {
                content: '❌ Servidor não encontrado.',
                flags: 64
              }
            };
          }

          // Busca o membro real do servidor
          const guildMember = await guild.members.fetch(member.user.id);
          if (!guildMember) {
            return {
              type: 4,
              data: {
                content: '❌ Membro não encontrado no servidor.',
                flags: 64
              }
            };
          }

          // Verifica se o membro está em um canal de voz
          const voiceChannel = guildMember.voice.channel;
          if (!voiceChannel) {
            return {
              type: 4,
              data: {
                content: '❌ Você precisa estar em um canal de voz para usar este comando!',
                flags: 64
              }
            };
          }

          // Usa o novo método do MusicService com as informações reais
          const result = await this.musicService.playFromHttp(interactionData, voiceChannel, guildMember);

          return {
            type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
            data: {
              content: result.message,
              flags: result.success ? 0 : 64 // ephemeral se erro
            }
          };
        } catch (error) {
          this.logger.error('Erro ao buscar informações do servidor:', error);
          return {
            type: 4,
            data: {
              content: '❌ Erro ao acessar informações do servidor.',
              flags: 64
            }
          };
        }
      }

      return {
        type: 4,
        data: {
          content: '❌ Comando não reconhecido.',
          flags: 64 // ephemeral
        }
      };
    } catch (error) {
      this.logger.error('Erro ao processar comando slash:', error);
      return {
        type: 4,
        data: {
          content: '❌ Erro interno do servidor.',
          flags: 64 // ephemeral
        }
      };
    }
  }

  private async handleButtonInteraction(interaction: ButtonInteraction) {
    try {
      // Responde imediatamente para evitar timeout
      await interaction.deferUpdate();

      // A lógica de controle de música será delegada ao MusicService
      await this.musicService.handleControlInteraction(interaction);
    } catch (error) {
      this.logger.error('Erro no botão de controle:', error);

      // Se ainda não foi respondido, responde com erro
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Erro ao processar o controle.',
          ephemeral: true
        });
      }
    }
  }
}
