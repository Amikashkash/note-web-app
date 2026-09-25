# GitHub Actions: CI and deploy

The workflow in `firebase-deploy.yml` has two jobs:

- **test**: runs on every pull request and on every push to `main`. It lints, type-checks and builds the client and the Cloud Functions, runs both unit test suites, and runs the Firestore rules tests on the emulator. It uses no secrets.
- **deploy**: runs only on `main` (push or manual run), and only after **test** passed. It builds with the production environment variables, authenticates to Google Cloud with **Workload Identity Federation** (no key), and deploys Hosting, Firestore rules and indexes with the Firebase CLI.

Cloud Functions are **not** deployed by CI. They are built and tested there, and deployed manually:
`firebase deploy --only functions:<name>`.

## Variables and secrets

Settings → Secrets and variables → Actions.

**Variables** (not secret; the Google Cloud setup is in `thinking/ci-workload-identity.md`):

| Variable | Value |
|---|---|
| `WIF_PROVIDER` | `projects/<project-number>/locations/global/workloadIdentityPools/github/providers/github-oidc` |
| `WIF_SERVICE_ACCOUNT` | `github-deployer@notes-4-me.iam.gserviceaccount.com` |

The deploy job checks the format of both before doing anything else, and fails with a clear message if either is wrong.

**Secrets:**

| Secret | Used by | Notes |
|---|---|---|
| `VITE_FIREBASE_*` (6 values) | deploy build | Web app config from Firebase Console → Project settings → General |
| `VITE_FIREBASE_VAPID_KEY` | deploy build | Cloud Messaging → Web Push certificates. Without it the build succeeds but push reminders silently stop |

No longer used, delete after the first successful WIF deploy: `FIREBASE_SERVICE_ACCOUNT` (and revoke that key in Google Cloud), `FIREBASE_TOKEN`.

## Supply chain

- Every action is pinned to a full commit SHA, with the version in a comment. A tag can be moved, and a moved tag would receive the deploy credentials.
- The Firebase CLI comes from `firebase-tools`, pinned in `package-lock.json`, not from a third-party action.
- To update an action: resolve the new release tag to its commit SHA
  (`gh api repos/<owner>/<repo>/git/ref/tags/<tag>`, and dereference annotated tags), review the diff, and update the SHA and the comment together.

## Running the same checks locally

```bash
npm ci && (cd functions && npm ci)
npm run lint
npm run build
npm test
(cd functions && npm run build && npm run typecheck && npm test)
npm run test:rules   # needs Java 21+; starts and stops the Firestore emulator
```

## Manual run

Actions → **CI and deploy** → **Run workflow** → branch `main`. A manual run on any other branch runs only the tests.

## Troubleshooting

- **test fails, deploy skipped**: this is the gate working. Open the failing step's log.
- **Rules tests fail after changing `firestore.rules`**: a "KNOWN HOLE" test failing means a planned fix flipped it. Invert the assertion and move it to the regular tests. Any other failure is a regression.
- **Authentication fails**: see the error table at the end of `thinking/ci-workload-identity.md`.
- **Deploy fails with a permissions error**: `github-deployer` needs Firebase Hosting Admin, Firebase Rules Admin, Cloud Datastore Index Admin and Service Usage Consumer.
