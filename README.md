# Bongo Returns V2 - Discord Music Bot

Este é um bot de música para Discord construído com **NestJS**, **TypeScript** e **Discord.js**, utilizando o **yt-dlp** para reprodução de áudio.

## Índice
1. [Tecnologias Utilizadas](#tecnologias-utilizadas)
2. [Pré-requisitos](#pré-requisitos)
3. [Configuração do Bot no Discord](#configuração-do-bot-no-discord)
4. [Configuração do Projeto Local](#configuração-do-projeto-local)
5. [Comandos e Funcionalidades](#comandos-e-funcionalidades)
6. [Estrutura do Projeto](#estrutura-do-projeto)

---

## 1. Tecnologias Utilizadas

*   **Framework:** [NestJS](https://docs.nestjs.com/)
*   **Linguagem:** TypeScript
*   **Bot SDK:** [Discord.js](https://discord.js.org/) (com `@discordjs/voice`)
*   **Validação:** [Zod](https://zod.dev/)
*   **Download/Streaming:** `yt-dlp` (requer `ffmpeg` instalado no sistema)

## 2. Pré-requisitos

Para rodar este bot, você precisa ter instalado:

1.  **Node.js** (versão 18+)
2.  **npm** (gerenciador de pacotes)
3.  **ffmpeg**: Necessário para a conversão e reprodução de áudio pelo `yt-dlp`.
    ```bash
    # No Ubuntu/Debian
    sudo apt install ffmpeg
    ```
4.  **yt-dlp**: O binário `yt-dlp` deve estar acessível no seu PATH.

## 3. Configuração do Bot no Discord

1.  **Crie uma Aplicação:** Acesse o [Discord Developer Portal](https://discord.com/developers/applications) e crie uma nova aplicação (ex: "Bongo Returns V2").
2.  **Adicione um Bot:** Na aba **Bot**, clique em "Add Bot".
3.  **Obtenha o Token:** Copie o **Token** do bot. Você precisará dele na próxima seção. **Mantenha-o secreto.**
4.  **Ative os Intents:** Na aba **Bot**, ative os seguintes **Privileged Gateway Intents**:
    *   `SERVER MEMBERS INTENT`
    *   `MESSAGE CONTENT INTENT` (necessário para comandos de texto, embora este bot use Slash Commands)
5.  **Configure Permissões:** Na aba **OAuth2** -> **URL Generator**:
    *   Selecione os escopos (`Scopes`): `bot` e `applications.commands`.
    *   Selecione as permissões de bot (`Bot Permissions`): `Read Messages/View Channels`, `Send Messages`, `Connect`, `Speak`.
6.  **Convite:** Copie o URL gerado e use-o para convidar o bot para o seu servidor.

## 4. Configuração do Projeto Local

1.  **Instale Dependências:**
    ```bash
    cd bongo-returns-v2
    npm install
    ```
2.  **Configure Variáveis de Ambiente:**
    Crie um arquivo chamado `.env` na raiz do projeto e preencha com as suas credenciais do Discord:

    ```dotenv
    # Token do Bot do Discord (MANTENHA ISSO SECRETO)
    DISCORD_TOKEN="SEU_TOKEN_DO_BOT_AQUI"

    # ID do Cliente (Application ID) do seu bot
    DISCORD_CLIENT_ID="SEU_CLIENT_ID_AQUI"

    # ID do Servidor de Desenvolvimento (Guild ID) para registro rápido de comandos
    # Se omitido, os comandos serão registrados globalmente (pode levar até 1 hora)
    DISCORD_GUILD_ID="SEU_GUILD_ID_AQUI"
    ```

3.  **Inicie o Bot:**
    ```bash
    # Para rodar em modo de desenvolvimento com watch
    npm run start:dev
    ```
    O bot tentará se conectar ao Discord e registrar o comando `/play`.

## 5. Comandos e Funcionalidades

### Comando `/play`

O comando principal para iniciar a reprodução de música.

*   **Uso:** `/play query: <URL ou Termo de Busca>`
*   **Funcionalidade:**
    *   Se for uma URL de vídeo, baixa e reproduz.
    *   Se for uma URL de playlist, adiciona todas as músicas à fila.
    *   Se for um termo de busca, utiliza o primeiro resultado do YouTube.
    *   O áudio é baixado para a pasta temporária `temp_music` e removido após a reprodução.

### Painel de Música Interativo

Após o comando `/play`, um painel com botões será exibido para controle:

| Botão | Ação | Status de Implementação |
| :--- | :--- | :--- |
| **Pause/Resume** | Pausa ou retoma a reprodução. | ✅ Implementado |
| **Skip** | Pula para a próxima música na fila. | ✅ Implementado |
| **Stop** | Para a reprodução e desconecta o bot do canal de voz. | ✅ Implementado |
| **Loop** | Alterna o modo de repetição da música atual. | ✅ Implementado |
| **Shuffle** | Alterna o modo de reprodução aleatória da fila. | ✅ Implementado |
| Down/Up/Back/AutoPlay/Playlist | Botões presentes no painel, mas as funcionalidades avançadas de fila/histórico/autoplay não foram implementadas nesta versão inicial. | ❌ Desabilitado |

## 6. Estrutura do Projeto

A lógica principal está organizada em módulos NestJS:

```
bongo-returns-v2/
├── src/
│   ├── config/             # Módulo de Configuração (lê e valida o .env com Zod)
│   │   ├── config.service.ts
│   │   └── ...
│   ├── discord/            # Módulo de Integração com Discord.js
│   │   ├── discord.service.ts  # Conexão, Login, Registro de Comandos e Tratamento de Interações
│   │   └── ...
│   ├── music/              # Módulo Central da Lógica de Música
│   │   ├── music.service.ts    # Gerenciamento de Fila, Conexão de Voz, yt-dlp e Controles Interativos
│   │   └── ...
│   ├── app.module.ts       # Módulo Raiz
│   └── main.ts             # Ponto de entrada da aplicação
├── temp_music/             # Diretório criado para armazenar arquivos de áudio temporários
└── .env                    # Variáveis de ambiente (ignorado pelo git)
```
