import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { ConfigModule } from '@nestjs/config';
import { ConfigModule as CustomConfigModule } from './config/config.module';
import { DiscordModule } from './discord/discord.module';
import { MusicModule } from './music/music.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CustomConfigModule,
    DiscordModule,
    MusicModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
