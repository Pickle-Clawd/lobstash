#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const store = require('./store');
const envparser = require('./envparser');

const program = new Command();

program
  .name('lobstash')
  .description('Stash and restore environment variable sets across projects')
  .version('1.0.0');

program
  .command('save <name>')
  .description('Save the current .env file as a named stash')
  .option('-f, --file <filename>', 'Source file to stash', '.env')
  .option('--force', 'Overwrite existing stash without prompting')
  .action((name, opts) => {
    const dir = process.cwd();
    const content = envparser.readEnvFile(dir, opts.file);

    if (content === null) {
      console.error(chalk.red(`Error: ${opts.file} not found in ${dir}`));
      process.exit(1);
    }

    if (store.stashExists(dir, name) && !opts.force) {
      console.error(chalk.yellow(`Stash "${name}" already exists. Use --force to overwrite.`));
      process.exit(1);
    }

    store.saveStash(dir, name, content);
    const vars = envparser.parseEnvString(content);
    const count = Object.keys(vars).length;
    console.log(chalk.green(`Stashed "${name}" with ${count} variable${count !== 1 ? 's' : ''}`));
  });

program
  .command('load <name>')
  .description('Restore a stash to .env')
  .option('-f, --file <filename>', 'Target file to write', '.env')
  .option('--merge', 'Merge with existing .env instead of replacing')
  .action((name, opts) => {
    const dir = process.cwd();
    const content = store.loadStash(dir, name);

    if (content === null) {
      console.error(chalk.red(`Stash "${name}" not found.`));
      process.exit(1);
    }

    if (opts.merge) {
      const existing = envparser.readEnvFile(dir, opts.file) || '';
      const existingVars = envparser.parseEnvString(existing);
      const stashVars = envparser.parseEnvString(content);
      const merged = { ...existingVars, ...stashVars };
      const lines = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
      envparser.writeEnvFile(dir, lines.join('\n') + '\n', opts.file);
      console.log(chalk.green(`Merged stash "${name}" into ${opts.file}`));
    } else {
      envparser.writeEnvFile(dir, content, opts.file);
      console.log(chalk.green(`Loaded stash "${name}" into ${opts.file}`));
    }
  });

program
  .command('list')
  .alias('ls')
  .description('List all stashes for the current project')
  .action(() => {
    const dir = process.cwd();
    const stashes = store.listStashes(dir);
    const names = Object.keys(stashes);

    if (names.length === 0) {
      console.log(chalk.dim('No stashes found for this project.'));
      return;
    }

    console.log(chalk.bold(`Stashes for ${path.basename(dir)}:\n`));
    for (const name of names.sort()) {
      const info = stashes[name];
      const date = new Date(info.savedAt).toLocaleDateString();
      console.log(
        `  ${chalk.cyan(name.padEnd(20))} ${chalk.dim(info.varCount + ' vars')}  ${chalk.dim(date)}`
      );
    }
    console.log(`\n${chalk.dim(`${names.length} stash${names.length !== 1 ? 'es' : ''} total`)}`);
  });

program
  .command('show <name>')
  .description('Display the contents of a stash')
  .option('--no-values', 'Hide values (show keys only)')
  .action((name, opts) => {
    const dir = process.cwd();
    const content = store.loadStash(dir, name);

    if (content === null) {
      console.error(chalk.red(`Stash "${name}" not found.`));
      process.exit(1);
    }

    const vars = envparser.parseEnvString(content);
    console.log(chalk.bold(`Stash: ${name}\n`));

    for (const [key, value] of Object.entries(vars)) {
      if (opts.values === false) {
        console.log(`  ${chalk.cyan(key)}`);
      } else {
        console.log(`  ${chalk.cyan(key)}=${chalk.dim(value)}`);
      }
    }

    console.log(`\n${chalk.dim(`${Object.keys(vars).length} variables`)}`);
  });

program
  .command('rm <name>')
  .alias('remove')
  .description('Delete a stash')
  .action((name) => {
    const dir = process.cwd();
    const removed = store.removeStash(dir, name);

    if (!removed) {
      console.error(chalk.red(`Stash "${name}" not found.`));
      process.exit(1);
    }

    console.log(chalk.green(`Removed stash "${name}".`));
  });

program
  .command('diff <stashA> <stashB>')
  .description('Compare two stashes')
  .action((stashA, stashB) => {
    const dir = process.cwd();
    const contentA = store.loadStash(dir, stashA);
    const contentB = store.loadStash(dir, stashB);

    if (contentA === null) {
      console.error(chalk.red(`Stash "${stashA}" not found.`));
      process.exit(1);
    }
    if (contentB === null) {
      console.error(chalk.red(`Stash "${stashB}" not found.`));
      process.exit(1);
    }

    const result = envparser.diffEnvs(contentA, contentB);

    if (result.added.length === 0 && result.removed.length === 0 && result.changed.length === 0) {
      console.log(chalk.dim('Stashes are identical.'));
      return;
    }

    console.log(chalk.bold(`Diff: ${stashA} -> ${stashB}\n`));

    for (const { key, value } of result.added) {
      console.log(chalk.green(`  + ${key}=${value}`));
    }
    for (const { key, value } of result.removed) {
      console.log(chalk.red(`  - ${key}=${value}`));
    }
    for (const { key, oldValue, newValue } of result.changed) {
      console.log(chalk.yellow(`  ~ ${key}: ${oldValue} -> ${newValue}`));
    }

    console.log();
    const parts = [];
    if (result.added.length) parts.push(chalk.green(`${result.added.length} added`));
    if (result.removed.length) parts.push(chalk.red(`${result.removed.length} removed`));
    if (result.changed.length) parts.push(chalk.yellow(`${result.changed.length} changed`));
    if (result.same.length) parts.push(chalk.dim(`${result.same.length} unchanged`));
    console.log(parts.join(', '));
  });

program
  .command('diff-env <stash>')
  .description('Compare a stash against the current .env file')
  .option('-f, --file <filename>', 'File to compare against', '.env')
  .action((stash, opts) => {
    const dir = process.cwd();
    const stashContent = store.loadStash(dir, stash);

    if (stashContent === null) {
      console.error(chalk.red(`Stash "${stash}" not found.`));
      process.exit(1);
    }

    const envContent = envparser.readEnvFile(dir, opts.file);
    if (envContent === null) {
      console.error(chalk.red(`${opts.file} not found in ${dir}`));
      process.exit(1);
    }

    const result = envparser.diffEnvs(stashContent, envContent);

    if (result.added.length === 0 && result.removed.length === 0 && result.changed.length === 0) {
      console.log(chalk.dim(`Stash "${stash}" matches ${opts.file}.`));
      return;
    }

    console.log(chalk.bold(`Diff: ${stash} -> ${opts.file}\n`));

    for (const { key, value } of result.added) {
      console.log(chalk.green(`  + ${key}=${value}`));
    }
    for (const { key, value } of result.removed) {
      console.log(chalk.red(`  - ${key}=${value}`));
    }
    for (const { key, oldValue, newValue } of result.changed) {
      console.log(chalk.yellow(`  ~ ${key}: ${oldValue} -> ${newValue}`));
    }

    console.log();
    const parts = [];
    if (result.added.length) parts.push(chalk.green(`${result.added.length} added`));
    if (result.removed.length) parts.push(chalk.red(`${result.removed.length} removed`));
    if (result.changed.length) parts.push(chalk.yellow(`${result.changed.length} changed`));
    if (result.same.length) parts.push(chalk.dim(`${result.same.length} unchanged`));
    console.log(parts.join(', '));
  });

program.parse();
