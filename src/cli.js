#!/usr/bin/env node
// parse cli args
const program = require('commander');
// read file
const fs = require('fs');
// parse yaml to json
const { safeLoad } = require('js-yaml');
// get version defined in package.json
const { version } = require('../package.json');
// custom logger
const createLogger = require('./logger');
// the meat
const applier = require('./terraform-plan-apply');

/**
 * Wrapper around terraform-plan-apply with a catch statement
 *
 * @param {string} stdin standard input
 * @param {object} program commander parsed object
 */
function apply(stdin, program) {
  return applier(stdin, program)
    .catch(console.error);
}

/**
 * Read the yaml file safely and destructure it into an object
 *
 * @param {string} filePath path to yaml file
 * @returns {object} yaml object
 */
function readYaml(filePath) {
  let yaml;
  try {
    yaml = safeLoad(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    logger.error(e);
  }
  return yaml;
}

// so program.on can use it
let logger = createLogger(false);

// configure cli
program
  .version(version)
  .option('-c, --config <file>', 'required config criteria yaml to apply')
  .option('-p, --plan [file]', 'optional output of `terraform plan` which can be piped in')
  .option('--apply', 'Executes `terraform apply -auto-approve` if criteria is matched')
  .option('-v, --verbose', 'verbose mode');

program.on('--help', () => {
  logger.msg('\nDry Run Examples:');
  logger.msg('  $ terraform plan | terraform-plan-apply -c apply.yml');
  logger.msg('  $ cat terraform-plan.stdout | terraform-plan-apply -c apply.yml');
  logger.msg('  $ AWS_PROFILE=dev terraform-plan-apply -c apply.yml < terraform-plan.stdout');
  logger.msg('\nApply Examples:');
  logger.msg('  $ terraform-plan-apply --config apply.yml --apply < terraform-plan.stdout');
  logger.msg('  $ AWS_PROFILE=dev terraform-plan-apply --config apply.yml --apply < terraform-plan.stdout');
});

program.parse(process.argv);

const applyOption = 'apply' in program && program.apply;
const verbose = 'verbose' in program && program.verbose;

// check for config, if not, show error, help output, and exit
if (!program.config) {
  logger.error('No --config file given!\n');
  program.outputHelp();
  process.exit(1);
}

// read yaml config
const configFile = readYaml(program.config);

// early return if yaml read fails
if (!configFile) throw new Error('Yaml config could not be read.');

// no plan file given, read from stdin
if (!program.plan) {
  logger.msg('Reading stdin because --plan was not specified.');

  // grab stdin and call the main() function
  // source: https://stackoverflow.com/a/13411244
  let stdin = '';
  // listen to data and concatenate content
  process.stdin.on('data', (buf) => {
    stdin += buf.toString();
  });
  // once stdin is finished, call main
  process.stdin.on('end', () => {
    apply(stdin, configFile, applyOption, verbose);
  });
} else {
  // read the plan file
  const stdin = fs.readFileSync(program.plan, { encoding: 'utf8' });
  apply(stdin, configFile, applyOption, verbose);
}