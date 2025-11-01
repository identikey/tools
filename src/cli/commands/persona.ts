import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { PersonaManager } from '../utils/persona-manager';

/**
 * Persona command: Manage personas (list, switch, current)
 */
export function registerPersonaCommand(program: Command) {
  program
    .command('persona [name]')
    .description('Manage personas: list, switch, or show current')
    .option('-l, --list', 'List all personas')
    .option('-c, --current', 'Show current active persona')
    .action((name, options) => {
      try {
        const manager = new PersonaManager();

        // List personas
        if (options.list) {
          const personas = manager.listPersonas();
          
          if (personas.length === 0) {
            console.log(chalk.yellow('No personas found. Run "identikey keygen" to create one.'));
            return;
          }

          const activePersona = manager.getActivePersona();
          
          const table = new Table({
            head: [
              chalk.cyan('Active'),
              chalk.cyan('Name'),
              chalk.cyan('Fingerprint'),
              chalk.cyan('Created'),
            ],
            colWidths: [8, 20, 50, 28],
          });

          for (const persona of personas) {
            const isActive = activePersona?.name === persona.name;
            table.push([
              isActive ? chalk.green('✓') : '',
              persona.name,
              persona.fingerprint.substring(0, 16) + '...',
              new Date(persona.createdAt).toLocaleString(),
            ]);
          }

          console.log(table.toString());
          return;
        }

        // Show current persona
        if (options.current || !name) {
          const activePersona = manager.getActivePersona();
          
          if (!activePersona) {
            console.log(chalk.yellow('No active persona set. Run "identikey keygen" to create one.'));
            return;
          }

          console.log(chalk.blue('📋 Current Active Persona:'));
          console.log(chalk.gray(`  Name: ${activePersona.name}`));
          console.log(chalk.gray(`  Fingerprint: ${activePersona.fingerprint}`));
          console.log(chalk.gray(`  Key path: ${activePersona.keyPath}`));
          console.log(chalk.gray(`  Created: ${new Date(activePersona.createdAt).toLocaleString()}`));
          return;
        }

        // Switch persona
        if (name) {
          manager.setActivePersona(name);
          console.log(chalk.green(`✓ Switched to persona "${name}"`));
          
          const persona = manager.getActivePersona();
          if (persona) {
            console.log(chalk.gray(`  Fingerprint: ${persona.fingerprint.substring(0, 16)}...`));
            console.log(chalk.gray(`  Key path: ${persona.keyPath}`));
          }
          return;
        }

      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });
}

