terraform {
  backend "gcs" {
    bucket  = "growlyze-terraform-state"
    prefix  = "terraform/state"
  }
} 