variable "budget_alert_email" {
  type        = string
  description = "Address that receives the alert when the monthly cost reaches $50."
}

variable "image_uri" {
  type        = string
  description = "Registry image URI, including the tag. Leave empty until the image has been pushed; the function is created on the apply that sets it."
  default     = ""
}
