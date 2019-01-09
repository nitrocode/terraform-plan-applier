// read file
const fs = require('fs');
// parse terraform plan to json
const parser = require('terraform-plan-parser');
// custom logger
const createLogger = require('./logger');
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
 * @param {object} stdin input plan to parse into json object
 * @param {object} apply yaml object
 * @returns {string[]} targets
 */
function getTargets(plan, apply) {
  // go through all the planned resources that will change
  logger.msg(`Filtering ${plan.changedResources.length} potential changedResources...`);
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
              // if the plan attribute is the same as the validation attrib iteration and
              //    then do an early return
              if ((planAttribKey.match(validAttrib.name))
                  // and there is a change in values and
                  && ('old' in planAttrib && planAttrib.old.value !== planAttrib.new.value)
                  // and values are NOT validated
                  && (!validateAttributeValues(validAttrib, planAttrib))) {
                logger.info('This target was rejected for one of these reasons.');
                logger.info(`1) ${planAttribKey} == ${validAttrib.name} which is ${planAttribKey.match(validAttrib.name)}`);
                logger.info(`2) ${planAttrib.old.value} != ${planAttrib.new.value} which is ${planAttrib.old.value !== planAttrib.new.value}`);
                logger.info(`3) ${planAttrib.new.value} != ${validAttrib.new} which is ${planAttrib.new.value.match(validAttrib.new)}`);
                if ('old' in validAttrib) {
                  // compare old and new
                  logger.info(`4) ${planAttrib.old.value} != ${validAttrib.old} which is ${planAttrib.old.value.match(validAttrib.old)}`);
                }
                // then throw it out!
                return false;
              }
            }
          } else {
            logger.info('no attributes');
          }
        }
        // if all the validation for this target did not fail, then return true
        logger.info('This target was accepted.');
        return true;
      }
      return false;
    }));
}

/**
 * Create the terraform apply command with the targets
 *
 * @param {array} targets
 * @returns {string} partial terraform command for targets
 */
function getCommand(targets) {
  // print out paths of approved targets
  const paths = targets.map(target => `-target ${target.path}`).join(' ');

  return paths;
}

/**
 * Execute terraform code with catches to log the error
 *
 * @param {string} cmd terraform command
 */
function terraformExec(cmd) {
  return exec(cmd)
    .catch((e) => {
      logger.error(e.stdout);
      logger.error(e.stderr);
      logger.error(`Please run this manually\n\n\t${cmd}`);
    });
}

/**
 * Main function to parse the plan, apply the criteria, and run the command
 *
 * @param {string} stdin terraform plan output
 * @param {object} config parsed yaml config
 * @param {boolean} apply if terraform apply should run
 * @param {boolean} verbose verbosity for logger
 * @returns {boolean} true if it was or was to be applied
 */
async function applier(stdin, config, apply, verbose) {
  // create the logger
  logger = createLogger(verbose);

  // print out current plan
  console.log(stdin);

  // use terraform-plan-parser to parse the plan
  const plan = parser.parseStdout(stdin);

  // go through all the changed resources to get the targets
  // const targets = getTargets(plan, config);
  const targets = getTargets(plan, config);
  // early return if no targets were found because there's nothing to apply
  if (targets === undefined || targets.length == 0) {
    logger.msg('No changes to apply or nothing matched.')
    return;
  }

  // print out paths of approved targets
  const cmdTargets = getCommand(targets);

  logger.info(`\nMATCHING TARGETS\n\t${cmdTargets}\n`);

  let cmd = `terraform plan ${cmdTargets}`;
  logger.msg(`Rerunning plan with matching targets (${targets.length}) to confirm targets...`);
  logger.msg(`\n\t$ ${cmd}\n`);
  return terraformExec(cmd)
    .then((output) => {
      console.log(output.stdout);
      // check if the targets are the same
      targetsCheck = getTargets(parser.parseStdout(output.stdout), config);
      cmdTargetsCheck = getCommand(targetsCheck);
      // if matching targets before and after targetted plan
      if (cmdTargets === cmdTargetsCheck) {
        // print command
        logger.msg(`The same ${targetsCheck.length} targets confirmed in the targetted plan.`);
        cmd = `terraform apply ${cmdTargets}`;
        cmd = `${cmd} -auto-approve`;
        logger.msg(`Running terraform apply -auto-approve with matching targets...`);
        logger.msg(`\n\t$ ${cmd}\n`);
        // only apply and auto approve if option has been set
        if (apply) {
          return terraformExec(cmd)
            .then((output) => {
              console.log(output.stdout);
              return true;
            })
        } else {
          logger.error('--apply was omitted so skipping apply.');
          return true;
        }
      } else {
        throw new Error(`Targets did not match!\n\t${cmdTargets}\n\t${cmdTargetsCheck}`);
      }
    });
}

module.exports = applier;
