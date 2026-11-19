resource "aws_ecr_repository" "sandbox" {
  name                 = "colearner-sandbox"
  image_tag_mutability = "IMMUTABLE"
}

resource "aws_vpc" "sandbox" {
  cidr_block           = "10.42.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "colearner-sandbox"
  }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.sandbox.id
  cidr_block        = "10.42.1.0/24"
  availability_zone = "ap-southeast-2a"

  tags = {
    Name = "colearner-sandbox-a"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.sandbox.id
  cidr_block        = "10.42.2.0/24"
  availability_zone = "ap-southeast-2b"

  tags = {
    Name = "colearner-sandbox-b"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.sandbox.id

  tags = {
    Name = "colearner-sandbox"
  }
}

resource "aws_route_table_association" "private_a" {
  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_b" {
  subnet_id      = aws_subnet.private_b.id
  route_table_id = aws_route_table.private.id
}

resource "aws_security_group" "sandbox" {
  name        = "colearner-sandbox"
  description = "Sandbox function with no inbound or outbound traffic."
  vpc_id      = aws_vpc.sandbox.id
  ingress     = []
  egress      = []

  tags = {
    Name = "colearner-sandbox"
  }
}

resource "aws_cloudwatch_log_group" "sandbox" {
  name              = local.log_group
  retention_in_days = 7
}

resource "aws_iam_role" "sandbox" {
  name = "colearner-sandbox"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "sandbox" {
  name = "colearner-sandbox"
  role = aws_iam_role.sandbox.id

  # PlaceInPrivateNetwork is the set AWS requires on this role to attach the
  # function to the private subnets. OwnLogs is the only permission the
  # function's own work uses.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "OwnLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = [
          "arn:aws:logs:${local.region}:${data.aws_caller_identity.current.account_id}:log-group:${local.log_group}",
          "arn:aws:logs:${local.region}:${data.aws_caller_identity.current.account_id}:log-group:${local.log_group}:*",
        ]
      },
      {
        Sid    = "PlaceInPrivateNetwork"
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DescribeSubnets",
          "ec2:DeleteNetworkInterface",
          "ec2:AssignPrivateIpAddresses",
          "ec2:UnassignPrivateIpAddresses",
        ]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_user" "server" {
  name = "colearner-server"
}

resource "aws_iam_user_policy" "invoke" {
  name = "invoke-sandbox"
  user = aws_iam_user.server.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = local.function_arn
    }]
  })
}

resource "aws_lambda_function" "sandbox" {
  count         = var.image_uri == "" ? 0 : 1
  function_name = local.function_name
  role          = aws_iam_role.sandbox.arn
  package_type  = "Image"
  image_uri     = var.image_uri
  memory_size   = 512
  timeout       = 20
  architectures = ["x86_64"]

  vpc_config {
    subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_group_ids = [aws_security_group.sandbox.id]
  }

  depends_on = [
    aws_iam_role_policy.sandbox,
    aws_cloudwatch_log_group.sandbox,
  ]
}

# Budgets is a global API. A policy that denies every region except Sydney
# still needs to allow budgets.amazonaws.com for this alert to apply.
resource "aws_budgets_budget" "monthly" {
  name              = "colearner-monthly"
  budget_type       = "COST"
  limit_amount      = "50"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2026-11-01_00:00"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
