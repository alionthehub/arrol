# Schedule

Slack app that DMs calendar briefs posted in `#schedule`. It runs on Slack's
Deno platform. It does not use Vercel, a server, or another database.

From the `arrol` repo on your Mac:

```bash
curl -fsSL https://deno.land/install.sh | sh
curl -fsSL https://downloads.slack-edge.com/slack-cli/install.sh | bash
```

Open a new terminal so `deno` and `slack` are on your PATH. If `slack` is still
not found:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

```bash
cd "/Users/ark/Codebase Dev/arrol/slack/schedule-bot"
slack login
```

Choose the **Gearbox Gurus Ltd** workspace.

```bash
slack deploy
slack trigger create --trigger-def triggers/message_posted.ts
```

In Slack, in `#schedule`:

```text
/invite @Schedule
```

Add Schedule to VIP: **Preferences → VIP**.

## Logs

```bash
slack activity --tail
```

Logs record the brief type, the message timestamp, and success or failure. They
do not include the brief.

## Redeploy

From this directory, after a code change:

```bash
slack deploy
```

Create the trigger again only if you deleted it. An existing trigger keeps
working across deploys.

## Uninstall

From this directory, `slack delete` removes the app from Gearbox Gurus Ltd and
deletes the app, including the datastore of forwarded message timestamps.
Confirm the prompt.

```bash
slack delete
```
