# GitHub Governance Setup

## Branch model

- `staging`: integration branch that deploys to staging after verification passes
- `main`: production branch that deploys to the live website after verification passes

## Repository secrets

Add these repository secrets in `Settings > Secrets and variables > Actions`:

- `FTP_SERVER`: `ftpupload.net`
- `FTP_USERNAME`: `if0_41165587`
- `FTP_PASSWORD`: your InfinityFree FTP password
- `FTP_SERVER_DIR_STAGING`: `/htdocs/staging/`
- `FTP_SERVER_DIR_PRODUCTION`: `/htdocs/`

## Environments

Create two environments in `Settings > Environments`:

### `staging`

- no required reviewers
- secret source: repository secrets

### `production`

- add at least 1 required reviewer
- optionally wait 5 minutes before deployment

That makes production deployment a controlled promotion step even after CI passes.

## Branch protection

In `Settings > Branches`, create protection rules for:

### `staging`

- require a pull request before merging
- require approvals: `1`
- require status checks before merging
- required status check: `verify`
- require conversation resolution
- do not allow force pushes
- do not allow deletion

### `main`

- require a pull request before merging
- require approvals: `1` or `2`
- require review from code owners
- require status checks before merging
- required status check: `verify`
- require conversation resolution
- restrict force pushes
- restrict deletion

## Promotion flow

1. feature branch -> pull request into `staging`
2. merge into `staging`
3. GitHub Actions deploys to staging
4. validate staging
5. pull request from `staging` -> `main`
6. merge into `main`
7. production environment approval
8. GitHub Actions deploys to production
