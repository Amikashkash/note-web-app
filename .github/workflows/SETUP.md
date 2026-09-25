# GitHub Actions: CI and deploy

The workflow in `firebase-deploy.yml` has two jobs:

- **test**: runs on every pull request and on every push to `main`. It lints, type-checks and builds the client and the Cloud Functions, runs both unit test suites, and runs the Firestore rules tests on the emulator. It uses no secrets.
- **deploy**: runs only on `main` (push or manual run), and only after **test** passed. It builds with the production environment variables, deploys Hosting, then deploys Firestore rules and indexes.

Cloud Functions are **not** deployed by CI. They are built and tested there, and deployed manually:
`firebase deploy --only functions:<name>`.

## Secrets

Settings → Secrets and variables → Actions:

| Secret | Used by | Notes |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | deploy | JSON key of a service account. Planned to be replaced by Workload Identity Federation, see `thinking/ci-workload-identity.md` |
| `VITE_FIREBASE_*` (6 values) | deploy build | Web app config from Firebase Console → Project settings → General |
| `VITE_FIREBASE_VAPID_KEY` | deploy build | Cloud Messaging → Web Push certificates. Without it the build succeeds but push reminders silently stop |

`FIREBASE_TOKEN` (from `firebase login:ci`) is no longer used and can be deleted.

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
- **Firestore deploy fails with a permissions error**: the service account needs Firebase Rules Admin and Cloud Datastore Index Admin.
