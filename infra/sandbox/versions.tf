# The account owner reviews this plan and applies it. Preparing the change
# does not apply anything to the account.
#
# 1. In infra/terraform-state, apply once with a globally unique bucket name.
#    That bucket is in ap-southeast-2.
# 2. Copy backend.hcl.example to backend.hcl, set the bucket, then from
#    infra/sandbox run: terraform init -backend-config=backend.hcl
# 3. terraform apply -var 'budget_alert_email=you@example.com'
#    This creates the registry, the private network, the roles, the log group
#    and the budget. Leave image_uri empty until the image has been pushed.
# 4. Build for the function's architecture and push to the registry:
#    docker build --platform linux/amd64 -t colearner-sandbox <repo>/sandbox
#    docker tag colearner-sandbox <repository_url>:sandbox
#    docker push <repository_url>:sandbox
# 5. terraform apply again with -var image_uri=<repository_url>:sandbox
# 6. Create an access key for the user colearner-server in the console and set
#    AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY on the deployed server.
#    render.yaml already sets NUXT_SANDBOX_FUNCTION=colearner-sandbox and
#    NUXT_SANDBOX_REGION=ap-southeast-2.
#
# Do not set reserved concurrency. The account allows five executions in total,
# and AWS keeps 100 unreserved, so a reservation cannot express that limit.
# The server allows at most five submissions in flight.

terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }

  backend "s3" {
    key          = "sandbox/terraform.tfstate"
    region       = "ap-southeast-2"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = "ap-southeast-2"
}

data "aws_caller_identity" "current" {}

locals {
  region        = "ap-southeast-2"
  function_name = "colearner-sandbox"
  log_group     = "/aws/lambda/colearner-sandbox"
  function_arn  = "arn:aws:lambda:${local.region}:${data.aws_caller_identity.current.account_id}:function:${local.function_name}"
}
