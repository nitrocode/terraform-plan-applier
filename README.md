# terraform-plan-applier

Uses [terraform-plan-parser](https://github.com/lifeomic/terraform-plan-parser) to convert plan into json. Then reads from a yaml file to look for acceptable changes. If a specific target has all acceptable changes listed for it, then it will run `terraform apply` with only that specific target as well as other targets that meet the criteria.

## Setup

    npm i -g terraform-plan-applier

## Usage

Setup `apply.yml`

The following will allow an asg named blue for any service to have an additional subnet using the regex for new. Since it's adding the subnet, the old value will be empty. Running the script using this yaml file will return a list of targets or it can be configured to run `terraform apply -auto-approve`. If any of the attribute criteria fails, the target resource will be omitted.

```
changedResources:
- path: 'module\..*\.module\.service\.module\.blue\.aws_autoscaling_group\..*'
  attributes:
    # allow only if vpc_zone_identifier is added one of 2 subnets
    - name: 'vpc_zone_identifier\.[\d]+'
      old: ''
      new: subnet-ac7b95a3|subnet-d74eeda1
```

Please see the help documentation

    terraform-plan-applier -h

## Contribute

If you have time, please contribute! Standard fork, branch, PR model.

## TODO

### High

* [x] read yml apply config
* [x] at the end should collect all validated targets and run
* [x] check for modified asg.default.image_id that matches a value
* [x] read plan from stdin
* [x] cli args
  * [x] required argument to read from the apply file
  * [x] help info with examples
  * [x] option for dryrun where it shows the cmd but doesnt run it
  * [x] option for verbosity
* [x] run `terraform plan / apply` commands on targets
* [x] package into installable cli app
  * [x] installable via npm
* [x] ensure that targets do not include other targets when planning
  * terraform plan first with the found targets and make sure the returned targets match. if not, do not apply.
* [x] option to `-auto-approve` by using `--apply`

### Low

* [ ] allow action to be set e.g. update, replace, destroy
  * also account for plan numbers like `Plan: 2 to add, 2 to change, 2 to destroy.` for more precise matching. If this fails, do not continue.
* [ ] investigate support for module / type attribute searching
  * how much more value does this bring?
* [ ] support json file type in addition to yaml for config criteria
