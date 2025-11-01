#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { registerKeygenCommand } from './commands/keygen';
import { registerPersonaCommand } from './commands/persona';
import { registerFingerprintCommand } from './commands/fingerprint';
import { registerEncryptCommand } from './commands/encrypt';
import { registerDecryptCommand } from './commands/decrypt';
import { registerInfoCommand } from './commands/info';

const program = new Command();

program
  .name('identikey')
  .description('CLI tool for IdentiKey Tools - digital sovereignty toolkit')
  .version('0.0.1');

// Register all commands
registerKeygenCommand(program);
registerPersonaCommand(program);
registerFingerprintCommand(program);
registerEncryptCommand(program);
registerDecryptCommand(program);
registerInfoCommand(program);

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Error:'), reason);
  process.exit(1);
});

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

