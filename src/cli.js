#!/usr/bin/env node
// parse cli args
const program = require('commander');
// read file
const fs = require('fs');
// get version defined in package.json
const { version } = require('../package.json');
const applier = require('./terraform-plan-apply');

// configure cli
program
  .version(version)
  .option('-a, --apply <file>', 'yaml validation file to apply')
  .option('-p, --plan [file]', 'output of terraform plan which can be piped in')
  .option('-d, --dry-run', 'verbose mode')
  .option('-v, --verbose', 'verbose mode');

program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ terraform plan | terraform-plan-apply -a apply.yml');
  console.log('  $ terraform-plan-apply -a apply.yml < terraform-plan.stdout');
});

program.parse(process.argv);

// no plan file given, read from stdin
if (!program.plan) {
  // grab stdin and call the main() function
  // source: https://stackoverflow.com/a/13411244
  let stdin = '';
  // listen to data and concatenate content
  process.stdin.on('data', (buf) => {
    stdin += buf.toString();
  });
  // once stdin is finished, call main
  process.stdin.on('end', () => {
    applier(stdin, program)
      .catch(console.error);
  });
} else {
  // read the plan file
  const stdin = fs.readFileSync(program.plan, { encoding: 'utf8' });
  applier(stdin, program)
    .catch(console.error);
}
