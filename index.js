#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import chalkAnimation from 'chalk-animation'
// @docs https://www.npmjs.com/package/inquirer
import inquirer from 'inquirer'
import { exec, spawn } from 'child_process'

// Internal
import getSitesInfo from './getLocalSiteSetting.js'
import generateSaltsObj from './generateWpSalts.js'

import yargs from 'yargs/yargs'
// import { retro } from 'gradient-string'
// Maybe use it more at some point https://github.com/yargs/yargs/blob/main/docs/examples.md#yargs-is-here-to-help-you
const options = yargs(process.argv.slice(2))
.usage('Usage: $0 <command> [options]')
.usage('Options are optiona.')
.help('v')
.alias('v', 'version')
.help('h')
.alias('h', 'help')
.argv;

// Vars
const __dirname = path.dirname(import.meta.url).replace(/^file:\/\/\//, '')
let siteSettings = {}

// const messageTiming = (time = 500) => new Promise((r) => setTimeout(r, time))
// async function welcomeMsg() {
//   const rainbowTitle = chalkAnimation.rainbow(`Welcome to project-install CLI`)

//   await messageTiming()
//   rainbowTitle.stop()
// }


// async function askForFixLocalCli() {
//   const answers = await inquirer.prompt({
//     name: 'fix_local_cli',
//     type: 'list',
//     message: 'Should we auto-fix local cli?\n',
//     choices: [
//       'Yes',
//       'Nahh'
//     ]
//   })

//   return fixWpCli(answers.fix_local_cli === 'Yes');
// }

const envExampleFile = '.env.example';
const envFile = '.env';
let envExists = false;

async function copyEnvExample() {
	envExists = fs.existsSync(envFile)

	if (!envExists && !fs.existsSync(envExampleFile)){
		console.log(`${chalk.bgYellow('Env files does not exists in the project')}`);
		return;
	}
	
	if (!envExists) {
		fs.copyFileSync(envExampleFile, envFile);
		console.log(`${chalk.bgYellow('.env.example copied to .env')}`);
	} else if (envExists) {
		console.log(`${chalk.bgGreen('.env file already exists.')}`);
	} else {
		console.log(`${chalk.bgRed('No .env file, script will fail!')}`);
	}
}

async function updateEnvVariable(variable, value) {
	if (!envExists) {
		console.log(`${chalk.bgRed('.env file is missing in the project!')}`);
		return;
	}
	let fileContent = fs.readFileSync(envFile, 'utf-8');
	
	// Remove the comment symbol from the variable if it exists
	fileContent = fileContent.replace(`#${variable}`, variable);
	
	// Update the value of the variable
	const re = new RegExp(`(#?${variable}=).*$`, 'm');

	if( variable === 'MYSQLI_DEFAULT_SOCKET' ) {
		value = `$HOME/Library/Application Support/Local/run/${value}/mysql/mysqld.sock`
	}

	fileContent = fileContent.replace(re, `$1"${value}"`);

	fs.writeFileSync(envFile, fileContent, 'utf-8');
	console.log(`${chalk.bgGreen(variable)} was set to ${chalk.bgGreen(value)} in ${chalk.bgGreen('.env')}`);
}
  
  async function askAndUpdateEnvVariable(variable, def = '') {
	if( variable === 'MYSQLI_DEFAULT_SOCKET' ) {
		console.log(`Enter LOCAL site UUID`)
	}

	const answers = await inquirer.prompt({
	  name: variable,
	  default: def,
	  type: 'input',
	  message: `Enter ${variable}:`,
	});

	await updateEnvVariable(variable, answers[variable]);
}

const setUpEnvDB = async () => {
	await copyEnvExample();
	await askAndUpdateEnvVariable('DB_NAME', 'local');
	await askAndUpdateEnvVariable('DB_PASSWORD', 'wp_');
	await askAndUpdateEnvVariable('DB_PREFIX', 'root');
	await askAndUpdateEnvVariable('DB_PASSWORD', 'root');

	// TODO: Ask user about this part

	if (siteSettings?.domain) {
		await askAndUpdateEnvVariable('WP_HOME', siteSettings.domain);
	}
}

async function fixWpCli(isCorrect) {

	if (!isCorrect) {
		return;
	}

	const maybeCreateFile = async (fileName) => {
		const pathToFile = `/${__dirname}/helpers/${fileName}`
		const {existsSync, readFileSync, writeFileSync} = fs

		try {
		  if (!existsSync(fileName)) {
			console.log(`File ${chalk.bgYellow(fileName)} does not exist, creating one ...`);
			const data = await readFileSync(pathToFile.replace(/%20/g, ' '), 'utf8');
			await writeFileSync(fileName, data);
			return true;
		  }
		} catch (err) {
		  console.error(`Error with creating file ${fileName}`, err);
		}
	}

	const addConfigToFile = async (fileName, content) => {
		if (!configString ){
			console.log('You must provide content.')
			return;
		}

		try {
			const data = await fs.readFileSync(fileName, 'utf8');
			if (data.includes(content)) {
				console.log(`Content already exists in ${fileName}`);
				return;
			}
		
			await fs.appendFileSync(fileName, content);
			console.log(`Content added to ${fileName}`);
		} catch (err) {
			console.error(`Error with reading/writing to ${fileName}`, err);
		}
	}
	
	const wpCliConfigFile = 'wp-cli.yml'

	await maybeCreateFile('wp-cli.local.php')
	await maybeCreateFile(wpCliConfigFile)
	
	const configString = `\nrequire:\n  - wp-cli.local.php`;
	await addConfigToFile(wpCliConfigFile, configString)
	
	console.log(`
${chalk.bgGreen('Config to CLI added.')}\n
${chalk.bgGrey('NOTE:')} If your WP path is different than ${chalk.bgRed('public/wp')} you have to fix it manually in the ${chalk.bgGrey('wp-cli.yml')} file.
	`)

	// TODO: SET Env if it is nto set yet. Maybe ask user if do this part?
	await copyEnvExample();

	if (siteSettings?.id) {
		await updateEnvVariable('MYSQLI_DEFAULT_SOCKET', siteSettings.id);
	} else {
		console.log(`${chalk.bgGreen('Site setting does not exists, add manually the site UUID.')}`)
		await askAndUpdateEnvVariable('MYSQLI_DEFAULT_SOCKET', '');
	}
}

async function runComposerInstall(shouldRun) {
	if (!shouldRun) {
	  return;
	}
	
	return new Promise((resolve, reject) => {
		const composer = spawn('composer', ['install', '--working-dir=./public/']);
  
	composer.stdout.on('data', (data) => {
		console.log(`${data}`);
	});
  
	composer.stderr.on('data', (data) => {
		console.error(`${data}`);
	});
  
	  composer.on('close', (code) => {
		if (code === 0) {
		  resolve(code);
		} else {
			resolve(code);

		   // reject(new Error(`composer process exited with code ${code}`));
		}
	  });
	});
  }
  
// async function askForComposerInstall() {
// 	const answers = await inquirer.prompt({
// 		name: 'run_composer_install',
// 		type: 'list',
// 		message: 'Do you want to run composer install?\n',
// 		choices: [
// 		'Yes',
// 		'No'
// 		]
// 	});

// 	return answers.run_composer_install === 'Yes';
// }
// const shouldRunComposerInstall = await askForComposerInstall();

async function runNvmUseAndNpmInstall(shouldRun) {
	if (!shouldRun) {
	  return;
	}

	return new Promise((resolve, reject) => {
	  const npmInstall = spawn('npm', ['install']);
  
	  npmInstall.stdout.on('data', (data) => {
		console.log(`stdout: ${data}`);
	  });
  
	  npmInstall.stderr.on('data', (data) => {
		console.error(`stderr: ${data}`);
	  });
  
	  npmInstall.on('close', (code) => {
		if (code === 0) {
		  resolve(code);
		} else {
		  resolve(code);
		  // reject(new Error(`npm process exited with code ${code}`));
		}
	  });
	});
  }

// RUNTIME!
console.clear();
// await welcomeMsg()

// Get site settings from local wp
await getSitesInfo().then((siteSett) => {
	siteSettings = siteSett
})

// async function askForNvmUseAndNpmInstall() {
// 	const answers = await inquirer.prompt({
// 	  name: 'run_nvm_use_and_npm_install',
// 	  type: 'list',
// 	  message: 'Do you want to run nvm use 16 && npm install?\n',
// 	  choices: [
// 		'Yes',
// 		'No'
// 	  ]
// 	});
  
// 	return answers.run_nvm_use_and_npm_install === 'Yes';
// }


//const shouldRunNvmUseAndNpmInstall = await askForNvmUseAndNpmInstall();

// await setUpEnvDB()

// await askForFixLocalCli()

// const askIfSetSalts = async () => {
// 	const answers = await inquirer.prompt({
// 		name: 'set_env_salts',
// 		type: 'list',
// 		message: `Do you want set ${chalk.bgRed('ENV SALTS')}??\n`,
// 		choices: [
// 		'Yes',
// 		'No'
// 		]
// 	});

// 	return answers.set_env_salts === 'Yes';
// }
/**
 * Set salts into .env file.
 *
 * @param {boolean} shouldRun 
 * @returns void
 */
const runSetSalts = async (shouldRun) => {
	if (!shouldRun) {
		return;
	}

	console.log(`${chalk.bgBlue('Setting up WP SALTS')}`);
	const salts = generateSaltsObj;
	if (salts?.AUTH_KEY){
		// JUST IN CASE
		await copyEnvExample();
		for (const prop in salts) {
			await updateEnvVariable(prop, salts[prop]);
		}
	} else {
		console.log(`${chalk.bgRed('Salts are missing')}`);
	}
}

// const shouldSetSalts = await askIfSetSalts();
// await runSetSalts(shouldSetSalts)

const menu = async () => {
	inquirer
	  .prompt([
		{
		  type: "list",
		  name: "menuOption",
		  prefix: `\n${chalk.cyan("[🫡]")}`,
		  message: "Select :",
		  pageSize: 14,
		  choices:  [
			new inquirer.Separator(chalk.red.bold("---- Base ----")),
			"Run Composer install",
			"Run npm install",
			new inquirer.Separator(chalk.red.bold("---- LOCAL ----")),
			"Fix WP CLI",
			new inquirer.Separator(chalk.red.bold("---- ENV ----")),
			"Set DB",
			"Set WP Salts",
			chalk.red.bold("Quit"),
			new inquirer.Separator(chalk.red.bold("---- TO BE DONE ----")),
			"DB Str Replace",
			"Activate plugins && Theme setup",
			"Fix Local multisite config",
			"Run npm build",
			"Run project setup wizard"

			]
		}
	  ])
	  .then(async answers => {
		switch (answers.menuOption) {

			case "DB Str Replace":
				console.log(chalk.red('Simpe WP CLI with inputs for strings to replace'), '\n')
				console.log(chalk.bgRed('YET TO BE DONE ...'))
				menu();
				break;

			case "Activate plugins && Theme setup":
				console.log(chalk.red('Should run WP CLI commands from actiave plugins and setup main site.'), '\n')
				console.log(chalk.bgRed('YET TO BE DONE ...'))
				menu();
				break;

			case "Fix Local multisite config":
				console.log(chalk.red('Basically fix the local multistie config.'), '\n')
				console.log(chalk.bgRed('YET TO BE DONE ...'))
				menu();
				break;

			case "Run project setup wizard":
				console.log(chalk.red('This command will guide user and ask if run command after command required to install the project.'), '\n')
				console.log(chalk.bgRed('YET TO BE DONE ...'))
				menu();
				break;

			case "Run Composer install":
				console.log(chalk.red("Trying to run composer install"));
				// TODO: Check if composer is valid command
				
				await runComposerInstall(true).then((c) => {
					if (c) {
						if (code === 0) {
							console.log( chalk.bgRed('Composer installed successfully') )
						} else {
							console.log( `${chalk.bgRed('Composer install FAILED')} with code ${code}` )
						}
					}
				});

				menu();
				break;
	
			case "Run npm install":
				await runNvmUseAndNpmInstall(true)
				menu();
				break;

			case "Run npm build":
				console.log(chalk.bgRed('YET TO BE DONE ...'))
				menu();
				break;

			case "Fix WP CLI":
				console.log(`\n${chalk.yellow("You selected Fix WP CLI")}`);
				await fixWpCli(true)
				menu();
				break;

			case "Set DB":
				console.log(chalk.blue("Set DB in the .env"));
				await setUpEnvDB(true)
				menu();
				break;

			case "Set WP Salts":
				console.log(chalk.blue("Setting up SALTS in the .env file"));
				await runSetSalts(true)
				menu();
				break;

			case chalk.red.bold("Quit"):
				const rainbowTitle = chalkAnimation.rainbow(`BYE BYE`)
				rainbowTitle.start()
				setTimeout( () => {
					rainbowTitle.stop()
				}, 500)
				break;

			default:
				console.log("Invalid option");
				menu();
			}
	});
};

await menu();
