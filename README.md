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

## Overview

### Backend tables

- `Members`: membership records keyed by `Email`. Includes `Role` (inactive, prospect, member, board, etc.), `Name`, `Joined` date, amongst others.
- `Sessions`: PB sessions. Includes `Start` time, `Location` identifier, `Address`, etc.
- `Drinks`: Records for individual drinks consumed by a member (`Members` prop) during a session (`Sessions` prop). Includes `Time` drink was finished, `Type` and `Volume` of drink.
- `DrinkTypes`: Defines drink types for consumption (`Type` in `Drinks` table). Includes `Name`, `Emoji` for visual presentation, and `Multiplier` to calculate beer equivalent `Volume` in `Drinks` table.
- `Feedback`: Feedback and suggestions from members for PB and pbot in particular. Includes `Time`, `Author` (`Members` reference), and `Feedback` text.
- `Quotes`: Notable quotes by PB members. Includes `Time`, `Author` (`Members` reference), and `Quote` text.
