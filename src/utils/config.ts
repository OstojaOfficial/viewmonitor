type ENV = {
	discord_bot_token: string;
	discord_guild_id: string;
	discord_alert_channel: string;
	pagerduty_token: string;
	pagerduty_enable: boolean;
	discord_enable: boolean;
}

const getConfig = (): ENV => {
	return {
		discord_bot_token: process.env.DISCORD_BOT_TOKEN ? String(process.env.DISCORD_BOT_TOKEN) : '',
		discord_guild_id: process.env.DISCORD_GUILD_ID ? String(process.env.DISCORD_GUILD_ID) : '',
		discord_alert_channel: process.env.DISCORD_ALERT_CHANNEL ? String(process.env.DISCORD_ALERT_CHANNEL) : '',
		pagerduty_token: process.env.PAGERDUTY_TOKEN ? String(process.env.PAGERDUTY_TOKEN) : '',
		pagerduty_enable: process.env.PAGERDUTY_ENABLE ? Boolean(process.env.PAGERDUTY_ENABLE) : false,
		discord_enable: process.env.DISCORD_ENABLE ? Boolean(process.env.DISCORD_ENABLE) : false
	};
};

export const config = getConfig();