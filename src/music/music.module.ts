import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { MusicService } from './music.service';

@Module({
  imports: [ConfigModule],
  providers: [MusicService],
  exports: [MusicService],
})
export class MusicModule { }
