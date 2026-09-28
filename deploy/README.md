# Cloud Build and Cloud Run

Push `deploy-web` to deploy the frontend. Push `deploy-api` to deploy the API. Those are the only branches that deploy. `main` does not.

Cloud Build builds the image, pushes it to Artifact Registry, then updates the Cloud Run service. Existing Cloud Run env is kept (`gcloud run services update --image`).

Manual `gcloud builds submit` from a laptop still works and uses the same yaml.

## Project

| | |
| --- | --- |
| GCP project | `project-05eadb1c-ed58-4d17-8c7` |
| Project number | `675690952863` |
| Region | `us-central1` |
| Artifact Registry | `us-central1-docker.pkg.dev/project-05eadb1c-ed58-4d17-8c7/rovo` |
| Cloud SQL | `project-05eadb1c-ed58-4d17-8c7:us-central1:apefamily-pg` |
| GitHub | `fktona/rovo` |

| Branch | Trigger | Service | Image | URLs |
| --- | --- | --- | --- | --- |
| `deploy-web` | `deploy-web` | `rovo-web` | `…/rovo/web:latest` | https://rovo-web-675690952863.us-central1.run.app and https://rovo-web-g7wzrzoukq-uc.a.run.app |
| `deploy-api` | `deploy-api` | `rovo-api` | `…/rovo/api:latest` | https://rovo-api-675690952863.us-central1.run.app and https://rovo-api-g7wzrzoukq-uc.a.run.app |

Configs:

- `deploy/cloudbuild.web.yaml` + `deploy/web.Dockerfile`
- `deploy/cloudbuild.api.yaml` + `deploy/api.Dockerfile`

Typical flow: merge or cherry-pick what you want onto the deploy branch, then push.

```bash
git checkout deploy-web
git merge main
git push

git checkout deploy-api
git merge main
git push
```

You do not need `gcloud` on your laptop for those pushes. The first-time GitHub connection is a one-time Google + GitHub login in the browser.

## How env is stored

Nothing is in Secret Manager.

- **Web `NEXT_PUBLIC_*` values are baked into the image** at Cloud Build time (Docker `ARG` / `ENV` in `deploy/web.Dockerfile`). Changing a contract address or the API URL requires a new web build. Defaults live in `deploy/cloudbuild.web.yaml` substitutions so a GitHub push does not need extra flags.
- **Web runtime env** on Cloud Run is only `PINATA_JWT`.
- **API env** is plaintext Cloud Run service env. The API image does not bake addresses or secrets. Updating API env and pointing at a new image are separate.

`gcloud run services update --image …` keeps existing env. `--update-env-vars` merges. `--env-vars-file` replaces every variable — do not use that on `rovo-api` or you will wipe the database URL, X tokens, and signer key.

## Web

Current production substitutions (also the yaml defaults):

| Substitution | Value |
| --- | --- |
| `_API_URL` | `https://api.rovo.fun` |
| `_PRIVY_APP_ID` | `cmuix6wbb00gd0cl9h290bx2s` |
| `_WALLETCONNECT_PROJECT_ID` | empty |
| `_RPC_URL` | `https://robinhood.drpc.org` |
| `_REGISTRY` | `0x9e6D6f8FCa32E721c24D7f668a6EA1dC896C8916` |
| `_WRAPPER` | `0x5E952c8E7EB763d7d1CF318cba8ECF8259eF02da` |
| `_ZAP` | `0x98ab554F40069521161B659E02Ffbe48CC4D1a79` |
| `_SPLITTER` | `0xeF991a125b91dA6794d0D62137cF0A2e724ACc54` |
| `_NOTTINGHAM` | `0x882f00222908C63a58B215aad202c6baBdF5d575` |
| `_HOLDER_REWARDS` | `0x2A07cb48E7A1bBC6f7dbE1f7Ba06ADbE233a2911` |

Manual build (same as the trigger, including the Cloud Run update step):

```bash
gcloud builds submit \
  --project=project-05eadb1c-ed58-4d17-8c7 \
  --config=deploy/cloudbuild.web.yaml
```

To override addresses without editing the yaml, pass `--substitutions=_REGISTRY=0x...,_WRAPPER=0x...`.

To set or rotate Pinata without rebuilding:

```bash
gcloud run services update rovo-web \
  --project=project-05eadb1c-ed58-4d17-8c7 \
  --region=us-central1 \
  --update-env-vars=PINATA_JWT=...
```

`NEXT_PUBLIC_ROVO_TOKEN_ADDRESS` is not in the web Dockerfile. The header CA stays hidden until that is added to the image build.

## API

No substitutions. The image is `tsx apps/api/src/server.ts` on port 8080.

```bash
gcloud builds submit \
  --project=project-05eadb1c-ed58-4d17-8c7 \
  --config=deploy/cloudbuild.api.yaml
```

Cloud Run API uses database `rovo_app` over the Cloud SQL unix socket (`host=/cloudsql/project-05eadb1c-ed58-4d17-8c7:us-central1:apefamily-pg`). Do not point it at the `rovo` database. Do not change the Cloud SQL password on `apefamily-pg`.

The service already has annotation `run.googleapis.com/cloudsql-instances=project-05eadb1c-ed58-4d17-8c7:us-central1:apefamily-pg`. Leave that in place.

To change addresses or other API env after a contract redeploy, merge keys (example):

```bash
gcloud run services update rovo-api \
  --project=project-05eadb1c-ed58-4d17-8c7 \
  --region=us-central1 \
  --update-env-vars=ROVO_REGISTRY_ADDRESS=0x...,ROVO_FACTORY_WRAPPER_ADDRESS=0x...,ROVO_START_BLOCK=74534805
```

Current API env keys (values for secrets stay on the service, not in git):

- `DATABASE_URL`
- `ROBINHOOD_RPC_URL` — `https://robinhood.drpc.org`
- `PONDER_RPC_URL_4663` — `https://rpc.mainnet.chain.robinhood.com`
- `PRIVY_APP_ID` — `cmuix6wbb00gd0cl9h290bx2s`
- `PRIVY_APP_SECRET`
- `IDENTITY_SIGNER_PRIVATE_KEY`
- `X_API_BEARER_TOKEN`
- `X_API_REFRESH_TOKEN`
- `X_API_CLIENT_ID`
- `X_API_CLIENT_SECRET`
- `ROVO_FACTORY_WRAPPER_ADDRESS` — `0x5E952c8E7EB763d7d1CF318cba8ECF8259eF02da`
- `ROVO_REGISTRY_ADDRESS` — `0x9e6D6f8FCa32E721c24D7f668a6EA1dC896C8916`
- `ROVO_SPLITTER_ADDRESS` — `0xeF991a125b91dA6794d0D62137cF0A2e724ACc54`
- `ROVO_NOTTINGHAM_ADDRESS` — `0x882f00222908C63a58B215aad202c6baBdF5d575`
- `ROVO_START_BLOCK` — `74534805`
- `ROVO_WEB_ORIGIN` — `https://rovo.fun,https://www.rovo.fun`
- `NODE_ENV` — `production`
- `PONS_FACTORY_ADDRESS` — `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`
- `PONS_FEE_ESCROW_ADDRESS` — `0xd3AFEB2a57f70eF218Aa82451C51B2fb0416Ac9e`
- `PONS_MEME_HOOK_ADDRESS` — `0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044`

`IDENTITY_SIGNER_ADDRESS` is not an API env var. The signer address must match the private key on the service.

## After a new contract deploy

1. Update `packages/contracts/deployments/4663.json` and the substitutions in `deploy/cloudbuild.web.yaml`.
2. Push `deploy-web` so the new `NEXT_PUBLIC_*` addresses bake into the web image.
3. `--update-env-vars` on `rovo-api` for the matching `ROVO_*` addresses and `ROVO_START_BLOCK`. Push `deploy-api` only if API code changed.

The wrapper must still be on the Pons `canLaunch` allowlist or launches fail on-chain regardless of a successful deploy.

## What this does not do

- Pushing `main` does not build or deploy.
- No Secret Manager.
- Local `.env` and `apps/web/.env.local` are not uploaded. Cloud Build does not read them.
