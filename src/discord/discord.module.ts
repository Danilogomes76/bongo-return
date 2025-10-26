import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { MusicModule } from '../music/music.module';
import { DiscordService } from './discord.service';

@Module({
  imports: [ConfigModule, MusicModule],
  providers: [DiscordService],
  exports: [DiscordService]
})
export class DiscordModule { }
