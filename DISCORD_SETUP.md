# 🎵 Bongo Returns Bot - Guia de Configuração

## 📋 Pré-requisitos

1. **Node.js** (versão 18 ou superior)
2. **pnpm** (gerenciador de pacotes)
3. **Conta Discord** com permissões de desenvolvedor
4. **Servidor Discord** para testes

## 🔧 Configuração do Bot Discord

### 1. Criar Aplicação no Discord Developer Portal

1. Acesse: https://discord.com/developers/applications
2. Clique em "New Application"
3. Nomeie sua aplicação (ex: "Bongo Returns")
4. Vá para a aba "Bot"
5. Clique em "Add Bot"
6. Copie o **Token** do bot
7. Vá para a aba "General Information"
8. Copie o **Application ID** (Client ID)

### 2. Configurar Permissões do Bot

Na aba "Bot", configure as seguintes permissões:

- ✅ Send Messages
- ✅ Use Slash Commands
- ✅ Connect
- ✅ Speak
- ✅ Use Voice Activity

### 3. Obter Chave Pública do Bot

1. Na aba "General Information"
2. Copie o **Public Key** (chave pública)
3. Esta chave é necessária para validar as assinaturas das interações

### 4. Configurar URL de Interações

1. Na aba "General Information"
2. Em "Interactions Endpoint URL", coloque:
   ```
   https://seu-dominio.com/interactions
   ```
   ou para desenvolvimento local:
   ```
   https://seu-ngrok-url.ngrok.io/interactions
   ```

### 5. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Configurações do Discord Bot
DISCORD_TOKEN=seu_token_aqui
DISCORD_CLIENT_ID=seu_client_id_aqui
DISCORD_GUILD_ID=seu_guild_id_aqui
DISCORD_PUBLIC_KEY=sua_chave_publica_aqui

# Porta do servidor (opcional)
PORT=3000
```

**Como obter o Guild ID:**

1. No Discord, vá em Configurações > Avançado > Modo Desenvolvedor
2. Clique com botão direito no servidor
3. Selecione "Copiar ID"

## 🚀 Executando o Bot

### Instalação de Dependências

```bash
pnpm install
```

### Desenvolvimento

```bash
pnpm run start:dev
```

### Produção

```bash
pnpm run build
pnpm run start:prod
```

## 🔍 Testando a Conexão

1. Execute o bot: `pnpm run start:dev`
2. Verifique os logs para confirmar a conexão
3. No Discord, use o comando `/play` para testar

## 🛠️ Solução de Problemas

### Erro: "O aplicativo não respondeu a tempo"

- ✅ **Corrigido**: Implementamos `deferReply()` para evitar timeout
- ✅ **Corrigido**: Tratamento de erros adequado

### Erro: "interactions_endpoint_url could not be verified"

- ✅ **Corrigido**: Endpoint `/interactions` criado
- Configure a URL no Discord Developer Portal

### Bot não conecta

- Verifique se o `DISCORD_TOKEN` está correto
- Verifique se o bot tem as permissões necessárias
- Verifique se o bot foi adicionado ao servidor

## 📚 Comandos Disponíveis

- `/play <query>` - Reproduz música do YouTube

## 🔧 Estrutura do Projeto

```
src/
├── discord/          # Serviço do Discord
├── music/           # Serviço de música
├── config/          # Configurações
└── app.controller.ts # Endpoint de interações
```

## 📝 Próximos Passos

1. Configure suas credenciais no `.env`
2. Execute o bot
3. Teste o comando `/play`
4. Personalize conforme necessário

---

**Modelo de IA usado:** Claude Sonnet 4
**Framework:** NestJS + Discord.js v14
