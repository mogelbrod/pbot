# pbot - Powerbärs Bot

## Getting started

1. Get your [Airtable API Key](https://airtable.com/account) and paste it into the config file:
    ```
    echo '{"key": "AIRTABLE API KEY", "base": "appJdrJKPgnOISywb"}' > config.js
    ```
2. Go nuts:
    ```
    node . start "Imaginary Pub"
    node . drink user@domain.com 10 Beer
    ```

## Roadmap

- [x] Basic CLI support
- [x] `start` - Start a session
- [x] `drink` - Register a drink
- [x] `list` - Show saved rows for a table
- [x] `findMember` - Show info for a member specified by email address
- [x] `currentSession` - Show info for the latest session
- [ ] `<num>` - Shorthand alias for drink
- [ ] `toplist` - List members by total volume of drinks (optionally for latest/a single session)
- [ ] Server - Pre-requisite for full Slack integration
- [ ] Slack integration - Working Bot
- [ ] `undo` - Undo last action by the user
