![code_quality_score](https://api.codiga.io/project/33110/score/svg)![GitHub](https://img.shields.io/github/license/MELLIFERA-Labs/kyvechecker)

# KYVECHECKER

Telegram bot: https://t.me/kyvecheckerbot

This bot was created to manage KYVE (https://app.kyve.network/) nodes. You can easily add your own nodes or which you
delegate. If a node is out of your threshold, you will be notified

The bot consists of two parts Bot and Notifier.

- The Bot responsible for user interaction
- The Notifier responsible for users notifications and database updates

## How to run a bot

### node.js

Install dependencies

`npm install`

Before run store a `config.js` file in the project folder. The config sample can be find in `config.sample.js`

Otherwise, you can specify your own path to the config file

```
npm start <bot or notifier> -- --config=<path to the config file>`
```

Run a bot:

```
npm start bot
```

Run a notifier:

```
npm start notifier
```

### Docker

You can run the KYVECHECKER directly from Docker.

To pull the latest Docker image, run:

```
docker pull ruslanglaznyov/kyvechecker:latest
```

Run a bot with a docker:

```
docker run --rm --name kevechecker <repo name> -v ./config.js:/config.js bot 
```

Run a notifier with a docker:

```
docker run --rm --name kevechecker <repo name> -v ./config.js:/config.js notifier 
```

Also, you can run with `docker-compose.yaml`:

```
version: "3"
services:
  kyvechecker-bot:
    image: ruslanglaznyov/kyvechecker:latest
    command:
      - bot
    volumes:
      - ./config.js:/config.js

  kyvechecker-notifier:
    image: ruslanglaznyov/kyvechecker:latest
    command:
      - notifier
    volumes:
      - ./config.js:/config.js
```

Put the `config.js` with your `docker-compose.yaml`. The config sample can be finding here `config.sample.js`

## Contributing

To contribute to this repository please follow these steps:

1. Clone the repository
2. Install dependencies
    ```
    npm install
    ```
3. Before committing make linter check:
    ```
     npm run format:check & npm run lint:check
    ```
