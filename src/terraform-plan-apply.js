// read file
const fs = require('fs');
// parse terraform plan to json
const parser = require('terraform-plan-parser');
// parse yaml to json
const { safeLoad } = require('js-yaml');
// for pretty stuff
const colors = require('colors');
// promisify exec command
// source: https://stackoverflow.com/a/20643568
const util = require('util');
const exec = util.promisify(require('child_process').exec);

let logger = {};

/**
 * Validates attribute values in terraform plan using the apply yaml
 *
 * @param {object} validAttrib attribute info from apply yaml
 * @param {string} validAttrib.new expected new attribute value
 * @param {string} validAttrib.old optional expected old attribute value
 * @param {object} planAttrib attribute info from terraform plan output
 * @param {string} planAttrib.new current new attribute value
 * @param {string} planAttrib.old current old attribute value
 * @returns {boolean} true if the attributes are valid
 */
function validateAttributeValues(validAttrib, planAttrib) {
  const validateNewValues = planAttrib.new.value.match(validAttrib.new);
  if (!validateNewValues) return false;
  // check if optional old value exists
  if ('old' in validAttrib) {
    // compare old and new
    return planAttrib.old.value.match(validAttrib.old);
  }
  return true;
}

/**
 * Get the target resources that are approved using the apply yaml
 *
 * @param {object} plan json object from terraform plan
 * @param {object} apply yaml object
 * @returns {string[]} targets
 */
function getTargets(plan, apply) {
  // go through all the planned resources that will change
  return plan.changedResources
    .filter(planResource => apply.changedResources.some((validResource) => {
      // if plan resource name matches the validation resource regex
      if (planResource.path.match(validResource.path)) {
        logger.info(`plan path ${planResource.path} matches validation regex ${validResource.path}`);
        // go through all of the plan's resources' changed attributes
        for (const planAttribKey in planResource.changedAttributes) {
          // validate the attributes
          const planAttrib = planResource.changedAttributes[planAttribKey];
          if ('attributes' in validResource) {
            for (const validAttrib of validResource.attributes) {
              // if the plan attribute has a validation and
              //    a change in values and
              //    NOT validated values
              //    then do an early return
              if ((planAttribKey.match(validAttrib.name))
                  && (planAttrib.old.value !== planAttrib.new.value)
                  && (!validateAttributeValues(validAttrib, planAttrib))) {
                return false;
              }
            }
          } else {
            logger.log('no attributes');
          }
        }
        // if all the validation for this target did not fail, then return true
        return true;
      }
      return false;
    }));
}

/**
 * Read the yaml file safely and destructure it into an object
 *
 * @param {string} filePath path to yaml file
 * @returns {object} yaml object
 */
function readYaml(filePath) {
  let apply;
  try {
    apply = safeLoad(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    logger.error(e);
  }
  return apply;
}

/**
 * Create the terraform apply command with the targets
 *
 * @param {array} targets
 * @returns {string} terraform command
 */
function getCommand(targets) {
  // print out paths of approved targets
  const paths = targets.map(target => `-target ${target.path}`).join(' ');

  // return `terraform apply -auto-approve \\ \n${paths}`;
  return paths;
}

/**
 * Main function to parse the plan, apply the criteria, and run the command
 *
 * @param {string} stdin terraform plan output
 * @returns {object} output of command
 */
async function main(stdin, program) {
  logger = {
    info: (msg) => {
      // only print if verbose is enabled
      if ('verbose' in program && program.verbose) {
        console.info(msg);
      }
    },
    error: (msg) => {
      console.error(colors.red(msg));
    },
  };

  // check for apply option, if not, show error, help output, and exit
  if (!program.apply) {
    logger.error('No apply file given!\n');
    program.outputHelp();
    process.exit(1);
  }

  // use terraform-plan-parser to parse the plan
  const plan = parser.parseStdout(stdin);

  // read yaml config
  const apply = readYaml(program.apply);
  if (!apply) process.exit(1);

  // go through all the changed resources
  const targets = getTargets(plan, apply);

  // print out paths of approved targets
  const cmdTargets = getCommand(targets);

  logger.info(cmdTargets);

  if (!('dryRun' in program)) {
    return exec(`terraform plan ${cmdTargets}`)
      .then((output) => {
        // TODO: check if output contains the same targets that matched
        // if it's the same targets, run apply -auto-approve
        logger.info(output.stdout);
      })
      .catch((e) => {
        // console.error(e);
        logger.error(e.stdout);
        logger.error(e.stderr);
        logger.error(`Please run this manually\n\n  ${cmd}`);
      });
  }
  return null;
}

module.exports = main;
