import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus
} from '@discordjs/voice';
import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, GuildMember, VoiceBasedChannel } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '../config/config.service';
import { CommandProcessingResult, DiscordInteractionData } from '../types/discord.types';

// Definições de tipos para a fila de reprodução
export interface Track {
  title: string;
  url: string;
  requestedBy: string;
  duration: string;
  author: string;
  filePath?: string;
}

interface GuildQueue {
  connection: VoiceConnection;
  player: AudioPlayer;
  tracks: Track[];
  currentTrack: Track | null;
  isLooping: boolean;
  isShuffling: boolean;
  isAutoPlay: boolean;
  textChannel: ChatInputCommandInteraction['channel'] | null;
}

@Injectable()
export class MusicService {
  private readonly logger = new Logger(MusicService.name);
  private readonly queues = new Map<string, GuildQueue>();
  private readonly tempDir = path.join(process.cwd(), 'temp_music');

  constructor(private readonly configService: ConfigService) {
    // Garante que o diretório temporário exista
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir);
    }
  }

  // --- Funções de Utilitário ---

  private async searchAndDownload(query: string): Promise<Track | null> {
    const isUrl = query.startsWith('http');
    const timestamp = Date.now();
    const tempFilePath = path.join(this.tempDir, `audio-${timestamp}-%(title)s.%(ext)s`);

    // Opções do yt-dlp:
    // -x: Extrai apenas o áudio
    // --audio-format mp3: Converte para mp3 (necessita do ffmpeg)
    // --print-json: Imprime o JSON de metadados
    // --output: Define o template de nome de arquivo
    // --no-playlist: Baixa apenas o vídeo, ignora playlists automáticas (como &list=RD&start_radio=1)
    // --extractor-args "youtube:player_client=android": Usa cliente Android para evitar bloqueios 403
    // --default-search ytsearch: Se não for URL, pesquisa no YouTube
    // IMPORTANTE: URLs devem estar entre aspas para evitar que o shell interprete caracteres especiais (&, etc)
    const ytDlpCommand = `yt-dlp -x --audio-format mp3 --print-json ${isUrl ? '--no-playlist --extractor-args "youtube:player_client=android"' : ''} --output "${tempFilePath}" ${isUrl ? '' : '--default-search "ytsearch"'} ${isUrl ? `"${query}"` : `1:${query}`}`;

    return new Promise((resolve) => {
      exec(ytDlpCommand, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          this.logger.error(`Erro ao executar yt-dlp para "${query}": ${error.message}`);
          this.logger.error(`Stderr: ${stderr}`);
          return resolve(null);
        }

        try {
          const lines = stdout.trim().split('\n').filter(line => line.startsWith('{'));
          if (lines.length === 0) {
            this.logger.warn(`Nenhum resultado JSON encontrado para: ${query}`);
            return resolve(null);
          }

          const tracks: Track[] = [];
          for (const line of lines) {
            const info = JSON.parse(line);

            // Com --no-playlist, só processamos vídeos individuais, NÃO playlists
            // Ignora entradas de playlist automática e processa apenas o vídeo
            if (info._type === 'video' || (!info._type && info.title && !info.entries)) {
              const track = this.mapYtDlpInfoToTrack(info, timestamp);
              if (track) tracks.push(track);
            }
          }

          if (tracks.length === 0) {
            return resolve(null);
          }

          // Retorna apenas o primeiro vídeo (ignora qualquer playlist)
          resolve(tracks[0]);

        } catch (parseError) {
          this.logger.error(`Erro ao processar JSON do yt-dlp: ${parseError.message}`);
          resolve(null);
        }
      });
    });
  }

  private mapYtDlpInfoToTrack(info: any, timestamp: number): Track | null {
    if (!info.url || !info.title || !info.duration) return null;

    // O yt-dlp retorna o caminho do arquivo no campo '_filename' após o download.
    // IMPORTANTE: Mesmo com --audio-format mp3, o _filename pode vir com extensão diferente.
    // Vamos usar a extensão correta (mp3) ou a extensão do arquivo baixado.
    let filePath = info._filename || '';

    if (!filePath) {
      // Constrói o caminho esperado baseado no título do vídeo
      const sanitizedTitle = info.title.replace(/[<>:"/\\|?*]/g, '').substring(0, 100);
      filePath = path.join(this.tempDir, `audio-${timestamp}-${sanitizedTitle}.mp3`);
    } else {
      // Corrige a extensão se necessário (gera como mp3)
      const ext = path.extname(filePath);
      if (ext !== '.mp3') {
        filePath = filePath.replace(/\.[^.]+$/, '.mp3');
      }
    }

    return {
      title: info.title,
      url: info.webpage_url || info.url,
      requestedBy: 'Aguardando', // Será preenchido na função play
      duration: this.formatDuration(info.duration),
      author: info.uploader || 'Desconhecido',
      filePath: filePath,
    };
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(hours.toString().padStart(2, '0'));
    parts.push(minutes.toString().padStart(2, '0'));
    parts.push(remainingSeconds.toString().padStart(2, '0'));

    return parts.join(':');
  }

  // --- Funções de Controle de Voz e Fila ---

  // Método para processar comandos via HTTP (usado pelo AppController)
  async playFromHttp(
    interactionData: DiscordInteractionData,
    voiceChannel: VoiceBasedChannel,
    guildMember: GuildMember
  ): Promise<CommandProcessingResult> {
    try {
      const { data, guild_id } = interactionData;

      // Suporta tanto 'query' quanto 'url' como nome do parâmetro
      const queryOption = data?.options?.find((opt) => opt.name === 'query' || opt.name === 'url');
      const query = queryOption?.value;

      if (!query) {
        return { success: false, message: '❌ Query não fornecida.' };
      }

      if (!guild_id) {
        return { success: false, message: '❌ Servidor não encontrado.' };
      }

      // Cria uma interação mock com as informações reais do canal de voz
      const mockInteraction = {
        options: {
          getString: (name: string) => {
            const option = data?.options?.find((opt) => opt.name === name);
            return option?.value;
          }
        },
        guildId: guild_id,
        member: guildMember, // Usa o GuildMember real
        channel: {
          id: interactionData.channel_id
        },
        deferReply: async () => { },
        editReply: async (content: any) => {
          this.logger.log(`Resposta: ${content.content || content}`);
        },
        reply: async (content: any) => {
          this.logger.log(`Resposta: ${content.content || content}`);
        }
      };

      // Chama o método play existente passando o voiceChannel
      await this.play(mockInteraction as any, voiceChannel);

      return { success: true, message: `✅ Processando música: ${query}` };
    } catch (error) {
      this.logger.error('Erro ao processar comando HTTP:', error);
      return { success: false, message: '❌ Erro interno do servidor.' };
    }
  }

  async play(interaction: ChatInputCommandInteraction, voiceChannel?: VoiceBasedChannel) {
    // Tenta obter a query tanto de 'query' quanto de 'url'
    const query = interaction.options.getString('query') || interaction.options.getString('url');
    const guildId = interaction.guildId;
    const member = interaction.member as GuildMember;

    // Se voiceChannel não foi passado, tenta obter do member
    const channel = voiceChannel || member?.voice?.channel;

    if (!channel || !guildId || !query) {
      const message = 'Você precisa estar em um canal de voz para usar este comando!';
      if (interaction.reply) {
        await interaction.reply({ content: message, ephemeral: true });
      } else {
        this.logger.warn(message);
      }
      return;
    }

    if (interaction.deferReply) {
      await interaction.deferReply();
    }

    if (!this.queues.has(guildId)) {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer();
      connection.subscribe(player);

      this.queues.set(guildId, {
        connection,
        player,
        tracks: [],
        currentTrack: null,
        isLooping: false,
        isShuffling: false,
        isAutoPlay: false,
        textChannel: interaction.channel,
      });

      connection.on(VoiceConnectionStatus.Ready, () => {
        this.logger.log(`Conexão de voz estabelecida no canal ${channel.name}`);
      });

      player.on(AudioPlayerStatus.Idle, () => {
        this.logger.log('Música terminou. Próxima...');
        this.playNext(guildId);
      });

      player.on('error', (error) => {
        this.logger.error(`Erro no player de áudio: ${error.message}`);
        this.playNext(guildId);
      });
    }

    const queue = this.queues.get(guildId);
    if (!queue) {
      await interaction.editReply({ content: 'Erro ao criar fila de música.' });
      return;
    }

    // Envia resposta imediata para evitar timeout do Discord
    await interaction.editReply({ content: '🎵 Processando...' });

    // Lógica para buscar e adicionar a música na fila
    const track = await this.searchAndDownload(query);

    if (!track) {
      await interaction.editReply({ content: `Não consegui encontrar resultados para: \`${query}\`` });
      return;
    }

    // Adiciona a música à fila
    track.requestedBy = member.displayName;
    queue.tracks.push(track);

    // Se não há nada tocando, começa a reproduzir imediatamente
    if (queue.player.state.status === AudioPlayerStatus.Idle && !queue.currentTrack) {
      // Prepara o painel de música imediatamente (antes de reproduzir)
      const embed = this.createMusicEmbed(track, queue);
      const components = this.createMusicControls(queue);

      // Envia o painel imediatamente na resposta da interação
      await interaction.editReply({
        embeds: [embed],
        components: components,
        content: '' // Remove a mensagem "Processando..."
      });

      // Agora reproduz a música
      this.playNext(guildId);
    } else {
      // Se já está tocando algo, apenas adiciona à fila
      await interaction.editReply({ content: `✅ Adicionado à fila: **${track.title}**` });
    }
  }

  private async playNext(guildId: string) {
    const queue = this.queues.get(guildId);
    if (!queue) return;

    // Lógica de loop, shuffle e autoplay
    let nextTrack: Track | undefined;

    if (queue.currentTrack && queue.isLooping) {
      // Se estiver em loop, a próxima música é a atual
      nextTrack = queue.currentTrack;
    } else {
      // Limpa o arquivo da música anterior
      if (queue.currentTrack && queue.currentTrack.filePath) {
        fs.unlink(queue.currentTrack.filePath, (err) => {
          if (err) this.logger.error(`Erro ao deletar arquivo: ${err.message}`);
        });
      }

      if (queue.isShuffling && queue.tracks.length > 0) {
        // Lógica de shuffle: pega uma música aleatória e remove da fila
        const randomIndex = Math.floor(Math.random() * queue.tracks.length);
        nextTrack = queue.tracks.splice(randomIndex, 1)[0];
      } else {
        // Pega a próxima música da fila
        nextTrack = queue.tracks.shift();
      }
    }

    if (!nextTrack) {
      queue.currentTrack = null;
      if (queue.textChannel && 'send' in queue.textChannel) {
        queue.textChannel.send('Fila vazia. Desconectando em 5 minutos.');
      }
      // TODO: Implementar lógica de desconexão após inatividade
      return;
    }

    queue.currentTrack = nextTrack;

    if (!nextTrack.filePath || !fs.existsSync(nextTrack.filePath)) {
      this.logger.error(`Caminho do arquivo de áudio não encontrado para: ${nextTrack.title}`);
      this.logger.error(`Caminho esperado: ${nextTrack.filePath}`);
      this.logger.error(`Arquivos em temp_music: ${fs.readdirSync(this.tempDir).join(', ')}`);
      // Tenta a próxima música
      this.playNext(guildId);
      return;
    }

    this.logger.log(`Reproduzindo: ${nextTrack.title} do arquivo: ${nextTrack.filePath}`);
    const resource = createAudioResource(nextTrack.filePath);
    queue.player.play(resource);

    // Só envia painel se não for a primeira música (para evitar duplicação)
    // A primeira música já enviou o painel na resposta da interação
    if (queue.tracks.length > 0) {
      // Envia o painel de música apenas para músicas seguintes
      const embed = this.createMusicEmbed(nextTrack, queue);
      const components = this.createMusicControls(queue);

      if (queue.textChannel && 'send' in queue.textChannel) {
        queue.textChannel.send({ embeds: [embed], components: components });
      }
    }
  }

  // --- Funções de Utilitário para o Painel ---

  private createMusicEmbed(track: Track, queue: GuildQueue): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🎶 MUSIC PANEL')
      .setDescription(`[${track.title}](${track.url})`)
      .addFields(
        { name: '👤 Requested By', value: track.requestedBy, inline: true },
        { name: '⏱️ Music Duration', value: track.duration, inline: true },
        { name: '🎤 Music Author', value: track.author, inline: true },
      )
      .setFooter({ text: `Loop: ${queue.isLooping ? '✅' : '❌'} | Shuffle: ${queue.isShuffling ? '✅' : '❌'}` });
  }

  private createMusicControls(queue: GuildQueue): ActionRowBuilder<ButtonBuilder>[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('down').setLabel('Down').setStyle(ButtonStyle.Secondary).setDisabled(true), // Ação de Down/Up não implementada na fila simples
      new ButtonBuilder().setCustomId('back').setLabel('Back').setStyle(ButtonStyle.Secondary).setDisabled(true), // Ação de Back não implementada na fila simples
      new ButtonBuilder().setCustomId('pause_resume').setLabel(queue.player.state.status === AudioPlayerStatus.Playing ? 'Pause' : 'Resume').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('skip').setLabel('Skip').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('up').setLabel('Up').setStyle(ButtonStyle.Secondary).setDisabled(true), // Ação de Down/Up não implementada na fila simples
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('shuffle').setLabel('Shuffle').setStyle(queue.isShuffling ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('loop').setLabel('Loop').setStyle(queue.isLooping ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('stop').setLabel('Stop').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('autoplay').setLabel('AutoPlay').setStyle(queue.isAutoPlay ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(true), // AutoPlay não implementado
      new ButtonBuilder().setCustomId('playlist').setLabel('Playlist').setStyle(ButtonStyle.Secondary).setDisabled(true), // Visualização de Playlist não implementada
    );

    return [row1, row2];
  }

  // --- Funções de Controle ---

  async handleControlInteraction(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    const guildId = interaction.guildId;
    if (!guildId) return;

    const queue = this.queues.get(guildId);
    if (!queue) {
      await interaction.editReply({ content: 'Não há música tocando neste servidor.', components: [] });
      return;
    }

    switch (interaction.customId) {
      case 'skip':
        this.skip(guildId);
        break;
      case 'pause_resume':
        this.pauseResume(guildId);
        break;
      case 'stop':
        this.stop(guildId);
        break;
      case 'loop':
        this.toggleLoop(guildId);
        break;
      case 'shuffle':
        this.toggleShuffle(guildId);
        break;
      // case 'down':
      // case 'back':
      // case 'up':
      // case 'autoplay':
      // case 'playlist':
      //   await interaction.followUp({ content: 'Funcionalidade ainda não implementada.', ephemeral: true });
      //   break;
    }

    // Atualiza o painel após a ação
    if (queue.currentTrack) {
      const embed = this.createMusicEmbed(queue.currentTrack, queue);
      const components = this.createMusicControls(queue);
      await interaction.editReply({ embeds: [embed], components: components });
    }
  }

  async skip(guildId: string) {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.player.stop(); // Isso irá acionar o evento 'idle' e chamar playNext()
    }
  }

  async pauseResume(guildId: string) {
    const queue = this.queues.get(guildId);
    if (queue) {
      if (queue.player.state.status === AudioPlayerStatus.Playing) {
        queue.player.pause();
      } else if (queue.player.state.status === AudioPlayerStatus.Paused) {
        queue.player.unpause();
      }
    }
  }

  async stop(guildId: string) {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.player.stop();
      queue.connection.destroy();
      this.queues.delete(guildId);

      // Limpa o arquivo da música atual
      if (queue.currentTrack && queue.currentTrack.filePath) {
        fs.unlink(queue.currentTrack.filePath, (err) => {
          if (err) this.logger.error(`Erro ao deletar arquivo ao parar: ${err.message}`);
        });
      }
    }
  }

  async toggleLoop(guildId: string) {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.isLooping = !queue.isLooping;
      if (queue.isLooping) {
        queue.isShuffling = false; // Loop e Shuffle são mutuamente exclusivos
      }
    }
  }

  async toggleShuffle(guildId: string) {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.isShuffling = !queue.isShuffling;
      if (queue.isShuffling) {
        queue.isLooping = false; // Loop e Shuffle são mutuamente exclusivos
      }
    }
  }
}
