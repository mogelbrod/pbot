# pbot - Powerbärs Bot

## Getting started

1. Get your [Airtable API Key](https://airtable.com/account) and base ID
2. Create a custom [Discord application](https://discord.com/developers/applications) for the bot
3. Generate an API token for the Slack integration
4. Create `config.json` and insert the above keys:
   ```json
   {
     "backend": "baserow",
     "baserow": {
       "token": "BASEROW_DATABASE_TOKEN",
       "url": "http://path-to-baserow-server/api"
     },
     "discord": {
       "token": "a.b.c",
       "defaultChannel": "DISCORD_CHANNEL_ID"
     },
     "google": {
       "placesKey": "GOOGLE_PLACES_KEY"
     }
   }
   ```
5. Go nuts:
   ```
   npm start
   # or via CLI access:
   npm run cli start "Imaginary Pub"
   npm run cli . drink 40 Beer user
   ```
