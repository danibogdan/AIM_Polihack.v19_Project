# Local configuration

This source snapshot excludes local environment files, assistant settings, and
Git history. Copy `.env.example` to `.env` and supply your own database URL,
OpenAI key, and signing secrets before following the README's npm commands.
Configure Google OAuth and mail delivery if using those features.
Verification/reset links are delivered by email only; they are not printed in
logs. Configure mail delivery to use those flows.

The seed scripts contain synthetic demo/test accounts with published demo
passwords. Use them only in a disposable local demo database. They are examples,
not credentials for a personal account or a live service.
