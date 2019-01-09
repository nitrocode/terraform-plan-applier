# terraform-plan-applier

Uses [terraform-plan-parser](https://github.com/lifeomic/terraform-plan-parser) to convert plan into json. Then reads from a yaml file to look for acceptable changes. If a specific target has all acceptable changes listed for it, then it will run `terraform apply` with only that specific target as well as other targets that meet the criteria.

## Setup

    npm i -g terraform-plan-applier

## Usage

Setup `apply.yml`

The following will allow an asg named blue for any service to have an additional subnet using the regex for new. Since it's adding the subnet, the old value will be empty. Running the script using this yaml file will return a list of targets or it can be configured to run `terraform apply -auto-approve`. If any of the attribute criteria fails, the target resource will be omitted.

```yaml
changedResources:
- path: 'module\..*\.module\.service\.module\.blue\.aws_autoscaling_group\..*'
  attributes:
    # allow only if vpc_zone_identifier is added one of 2 subnets
    - name: 'vpc_zone_identifier\.[\d]+'
      old: ''
      new: subnet-ac7b95a3|subnet-d74eeda1
```

```bash
$ terraform-plan-applier -h
Usage: terraform-plan-applier [options]

Options:
  -V, --version        output the version number
  -c, --config <file>  required config criteria yaml to apply
  -p, --plan [file]    optional output of `terraform plan` which can be piped in
  --apply              Executes `terraform apply -auto-approve` if criteria is matched
  -v, --verbose        verbose mode
  -h, --help           output usage information

Dry Run Examples:
  $ terraform plan | terraform-plan-apply -c apply.yml
  $ cat terraform-plan.stdout | terraform-plan-apply -c apply.yml
  $ AWS_PROFILE=dev terraform-plan-apply -c apply.yml < terraform-plan.stdout

Apply Examples:
  $ terraform-plan-apply --config apply.yml --apply < terraform-plan.stdout
  $ AWS_PROFILE=dev terraform-plan-apply --config apply.yml --apply < terraform-plan.stdout
```

## Contribute

If you have time, please contribute! Standard fork, branch, PR model.

## TODO

* [ ] option to save plan output check to local file
* [ ] option to save applied output to local file
* [ ] allow action to be set e.g. update, replace, destroy
  * also account for plan numbers like `Plan: 2 to add, 2 to change, 2 to destroy.` for more precise matching. If this fails, do not continue.
* [ ] investigate support for module / type attribute searching
  * how much more value does this bring?
