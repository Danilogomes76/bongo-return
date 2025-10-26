// Tipagens para interações do Discord

export interface DiscordUser {
    avatar: string | null;
    avatar_decoration_data: any;
    clan?: {
        badge: string;
        identity_enabled: boolean;
        identity_guild_id: string;
        tag: string;
    };
    collectibles: any;
    discriminator: string;
    display_name_styles: any;
    global_name: string;
    id: string;
    primary_guild?: {
        badge: string;
        identity_enabled: boolean;
        identity_guild_id: string;
        tag: string;
    };
    public_flags: number;
    username: string;
}

export interface DiscordMember {
    avatar: string | null;
    banner: string | null;
    collectibles: any;
    communication_disabled_until: string | null;
    deaf: boolean;
    display_name_styles: any;
    flags: number;
    joined_at: string;
    mute: boolean;
    nick: string;
    pending: boolean;
    permissions: string;
    premium_since: string | null;
    roles: string[];
    unusual_dm_activity_until: string | null;
    user: DiscordUser;
}

export interface DiscordChannel {
    flags: number;
    guild_id: string;
    icon_emoji: {
        id: string | null;
        name: string;
    };
    id: string;
    last_message_id: string;
    name: string;
    nsfw: boolean;
    parent_id: string;
    permissions: string;
    position: number;
    rate_limit_per_user: number;
    theme_color: string | null;
    topic: string;
    type: number;
}

export interface DiscordGuild {
    features: string[];
    id: string;
    locale: string;
}

export interface DiscordCommandOption {
    name: string;
    type: number;
    value: string;
}

export interface DiscordCommandData {
    id: string;
    name: string;
    options: DiscordCommandOption[];
    type: number;
}

export interface DiscordInteractionData {
    app_permissions: string;
    application_id: string;
    attachment_size_limit: number;
    authorizing_integration_owners: Record<string, string>;
    channel: DiscordChannel;
    channel_id: string;
    context: number;
    data: DiscordCommandData;
    entitlement_sku_ids: string[];
    entitlements: any[];
    guild: DiscordGuild;
    guild_id: string;
    guild_locale: string;
    id: string;
    locale: string;
    member: DiscordMember;
    token: string;
    type: number;
    version: number;
}

// Tipos para comandos específicos
export interface PlayCommandData extends DiscordCommandData {
    name: 'play';
    options: [
        {
            name: 'query';
            type: 3;
            value: string;
        }
    ];
}

export interface PlayUrlCommandData extends DiscordCommandData {
    name: 'play';
    options: [
        {
            name: 'url';
            type: 3;
            value: string;
        }
    ];
}

// Union type para os dados do comando play
export type PlayCommandOptions = PlayCommandData | PlayUrlCommandData;

// Interface para resposta de processamento
export interface CommandProcessingResult {
    success: boolean;
    message: string;
}
