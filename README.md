# pbot - Powerbärs Bot

## Getting started

1. Get your [Airtable API Key](https://airtable.com/account) and base ID
2. Create a custom [Slack integration](https://YOUR-SLACK-TEAM.slack.com/apps/manage/custom-integrations) for the bot
3. Generate an API token for the Slack integration
4. Create `config.json` and insert the above keys:
    ```json
    {
      "key": "AIRTABLE API KEY",
      "base": "AIRTABLE BASE ID",
      "slackToken": "SLACK API TOKEN"
    }
    ```
5. Go nuts:
    ```
    node . bot
    # or via CLI access:
    node . start "Imaginary Pub"
    node . drink user 40 Beer
    ```

