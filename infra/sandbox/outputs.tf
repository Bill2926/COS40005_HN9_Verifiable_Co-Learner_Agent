output "region" {
  value = local.region
}

output "repository_url" {
  value = aws_ecr_repository.sandbox.repository_url
}

output "function_name" {
  value = local.function_name
}

output "server_user" {
  value = aws_iam_user.server.name
}
