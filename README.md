# pbot - Powerbärs Bot

## Getting started

1. Get your [Airtable API Key](https://airtable.com/account) and base ID
2. Create a custom [Discord application](https://discord.com/developers/applications) for the bot
3. Create a Google service account with access to the Google Calendar + JSON key (if calendar functionality is desired)
4. Create `config.json` and insert the above keys:
   ```jsonc
   {
     "backend": "baserow",
     "baserow": {
       "token": "BASEROW_DATABASE_TOKEN",
       "url": "http://path-to-baserow-server/api",
     },
     "discord": {
       "token": "a.b.c",
       "defaultChannel": "DISCORD_CHANNEL_ID",
     },
     "location": {
       "coords": "59,18", // Lat/long coordinate bias for google places lookups
       "radius": 5000,
     },
     "google": {
       "placesKey": "GOOGLE_PLACES_KEY",
       "calendarId": "a18pp1o4bqjttupjmpl0uuped4@group.calendar.google.com",
       "serviceAccount": null, // Replace with Google service account JSON file contents from step 3 here
     },
   }
   ```
5. Go nuts:
   ```sh
   npm start
   # or via CLI access:
   npm run cli start "Imaginary Pub"
   npm run cli . drink 40 Beer user
   ```
