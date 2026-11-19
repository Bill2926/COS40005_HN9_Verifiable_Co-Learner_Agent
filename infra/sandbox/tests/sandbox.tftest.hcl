mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
  }
}

variables {
  budget_alert_email = "owner@example.com"
  image_uri          = "123456789012.dkr.ecr.ap-southeast-2.amazonaws.com/colearner-sandbox:0123abc"
}

run "sydney_sandbox" {
  command = plan

  assert {
    condition     = aws_cloudwatch_log_group.sandbox.retention_in_days == 7
    error_message = "The log group is kept for seven days."
  }

  assert {
    condition     = aws_budgets_budget.monthly.limit_amount == "50"
    error_message = "The budget alert is 50 dollars a month."
  }

  assert {
    condition     = aws_lambda_function.sandbox[0].memory_size == 512
    error_message = "The function allows 512 MB."
  }

  assert {
    condition     = length(aws_security_group.sandbox.egress) == 0 && length(aws_security_group.sandbox.ingress) == 0
    error_message = "The function security group has no traffic rules."
  }

  assert {
    condition     = strcontains(aws_iam_user_policy.invoke.policy, "lambda:InvokeFunction") && strcontains(aws_iam_user_policy.invoke.policy, "function:colearner-sandbox")
    error_message = "The server user can only invoke the sandbox function."
  }

  assert {
    condition     = strcontains(aws_iam_role_policy.sandbox.policy, "logs:PutLogEvents") && strcontains(aws_iam_role_policy.sandbox.policy, "/aws/lambda/colearner-sandbox") && !strcontains(aws_iam_role_policy.sandbox.policy, "s3:")
    error_message = "The function role writes its own log group and has no object storage."
  }
}
