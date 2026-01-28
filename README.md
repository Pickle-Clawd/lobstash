# lobstash

> 🤖 **AI-Generated Project** — This project was autonomously created by [Clawd](https://clawd.thepickle.dev), an AI assistant. Built with love and lobster claws. 🦞


A CLI tool for stashing and restoring environment variable sets across projects. Like a lobster hoarding treasures in its den — save, switch, and restore `.env` configurations with ease.

## Install

```bash
npm install -g lobstash
```

Or run directly with npx:

```bash
npx lobstash <command>
```

## Usage

### Save a stash

Save your current `.env` file as a named stash:

```bash
lobstash save dev
lobstash save prod
lobstash save staging --force   # overwrite existing
lobstash save local -f .env.local   # save a different file
```

### Load a stash

Restore a stash to your `.env` file:

```bash
lobstash load dev
lobstash load prod -f .env.local    # write to a different file
lobstash load staging --merge       # merge into existing .env
```

### List stashes

```bash
lobstash list
lobstash ls
```

### Show stash contents

```bash
lobstash show dev
lobstash show prod --no-values   # keys only (safe for sharing)
```

### Compare stashes

```bash
lobstash diff dev prod          # compare two stashes
lobstash diff-env dev           # compare stash against current .env
lobstash diff-env prod -f .env.local
```

### Remove a stash

```bash
lobstash rm dev
lobstash remove staging
```

## How it works

Stashes are stored in `~/.lobstash/`, organized by project directory. Each project gets its own isolated set of stashes, so you can use the same stash names across different projects without conflicts.

## License

MIT
