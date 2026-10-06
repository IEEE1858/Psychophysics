# Deploying imagerank

How to publish changes to <https://imagerank.imatest.com>.

This guide is written for a collaborator who can deploy but is **not a root
user** on the production host. You can publish the front end and the API on your
own. The one privileged step, restarting the API, is granted as a single fixed
command through `sudo`; you have no other root access.

## How production is laid out

| Piece | Where |
|---|---|
| Host | `atlas` |
| SPA (what Apache serves) | `/vhosts/psychophysics/imagerank/client/dist` |
| API sources | `/vhosts/psychophysics/imagerank/server` |
| API process | systemd unit `imagerank-api.service`, runs as the `imagerank` user on `127.0.0.1:5001` |
| Database | SQLite at `/var/lib/imagerank/psychophysics.db` (readable only by the `imagerank` user) |

Apache terminates TLS, serves the built SPA with `FallbackResource /index.html`,
and reverse-proxies `/api` and `/images` to the API.

## Before your first deploy

1. Confirm you can reach the host. This must succeed without a password prompt:

   ```bash
   ssh ctran@atlas true
   ```

2. Confirm you can write to both published directories:

   ```bash
   ssh ctran@atlas 'cd /vhosts/psychophysics/imagerank &&
     touch client/dist/.probe server/.probe &&
     rm client/dist/.probe server/.probe && echo "dist and server OK"'
   ```

   `Permission denied` means the one-time setup in
   [Granting a collaborator deploy access](#granting-a-collaborator-deploy-access)
   has not been done yet. Ask an administrator rather than working around it.

3. Confirm the privileged step is available to you. This lists it without
   running anything:

   ```bash
   ssh ctran@atlas sudo -l
   ```

4. Locally you need `rsync` and Node 22 or newer (the host runs 26, and Vite 8
   needs at least 20.19).

## Deploying the client

This is the common case: anything under `imagerank/client`. It publishes static
files only. Nothing restarts, and the database is never touched.

```bash
# 1. Get the code you intend to ship
git checkout main
git pull

# 2. Install exactly what the lockfile pins
cd imagerank/client
npm ci

# 3. Check it, then build
npx eslint .
npm run build
```

`npm ci` installs exactly what `package-lock.json` pins, so the build matches
everyone else's. Use it rather than `npm install`.

```bash
# 4. Publish
cd ..        # now in imagerank/
rsync -av --delete client/dist/ ctran@atlas:/vhosts/psychophysics/imagerank/client/dist/
```

`--delete` removes files on the server that are no longer in your build, which is
what keeps old hashed bundles from piling up. It only ever touches `dist/`.

### Verify

The site should answer, and the bundle hash the browser is served should match
the one you just built:

```bash
curl -s -o /dev/null -w "home %{http_code}\n" https://imagerank.imatest.com/

grep -o 'assets/index-[A-Za-z0-9_-]*\.js' client/dist/index.html | head -1
curl -s https://imagerank.imatest.com/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1
```

If the two hashes differ, the upload did not land. Re-run the rsync and look at
its output.

Then open the site and exercise the thing you changed. The study itself is the
best smoke test: load the home page, start the study, and move a slider.

### Rolling back

There is no separate rollback step. Check out the last known-good commit,
rebuild, and rsync again:

```bash
git checkout <good-commit> -- .      # or: git checkout main~1
cd imagerank/client && npm ci && npm run build
cd .. && rsync -av --delete client/dist/ ctran@atlas:/vhosts/psychophysics/imagerank/client/dist/
```

## Deploying the server

Changes under `imagerank/server` take effect only when the API process
restarts. Deploy the server **before** the client, so the new SPA never calls an
endpoint that is not live yet.

```bash
# 1. Push the sources. The excludes matter: node_modules is built on the host,
#    and data/ and .env must never be overwritten from a laptop.
cd imagerank
rsync -av --delete --exclude node_modules --exclude data --exclude .env \
  server/ ctran@atlas:/vhosts/psychophysics/imagerank/server/

# 2. Refresh dependencies on the host, where native modules build correctly
ssh ctran@atlas 'cd /vhosts/psychophysics/imagerank/server && \
  PATH=/usr/local/lib/nodejs/v26.3.0/bin:$PATH npm install'
```

Use `npm install`, not `npm install --omit=dev`: `sharp` is a devDependency, but
`make-thumbnails.js` needs it on the host.

```bash
# 3. Back up the database and restart
ssh ctran@atlas 'sudo /usr/local/sbin/imagerank-restart'
```

That one command is the whole privileged step. It stops the service, copies the
database under a UTC timestamp, refuses to continue if the copy did not land,
starts the service again, and prints the status and recent log. You cannot skip
or misdirect the backup, which is the point: `server/db.js` runs `ALTER TABLE`
migrations at startup, so **a restart can change the live schema**.

New files on disk change nothing until that restart, so steps 1 and 2 are safe
to run on their own.

Then publish the client as above.

## What you cannot do, and why

Your `sudo` rights are exactly one deploy command plus read-only service
status. Everything else is refused.

| | Why |
|---|---|
| General `sudo` | Not granted. `sudo -l` shows the full list of what you may run. |
| Stop the API and leave it down | The restart command always starts it again. |
| Read or copy the database | `/var/lib/imagerank` is mode 700, owned by the `imagerank` user. |
| Read `/etc/imagerank/imagerank.env` | Root-only. Holds AWS credentials, the admin seed, and OAuth secrets. |

Study data includes participant email addresses and IP addresses. Please do not
copy it off the host.

## Troubleshooting

**`Permission denied (publickey)` when you SSH.** Your key is not installed, or
`~/.ssh` on the host has the wrong mode. The directory must be `700` and
`authorized_keys` `600`; a missing execute bit on `~/.ssh` stops `sshd` reading
the file at all. An administrator can check with
`sudo ls -ld /home/ctran/.ssh`.

**`rsync: mkstemp failed: Permission denied`.** You are not in the `imagerank`
group, or the target directory is not group-writable. Check with
`ssh ctran@atlas id` — the group list should include `imagerank`. Group
membership only applies to sessions started after it was granted, so log out and
back in if it was just added.

**The site looks unchanged after deploying.** Compare the bundle hashes as under
[Verify](#verify). If they match, it is browser cache: hard-reload. The file
names are content-hashed, so a genuine deploy always changes them.

**The site is up but the API fails.** Check it yourself with
`ssh ctran@atlas 'sudo systemctl status imagerank-api'`. If it is down, running
`sudo /usr/local/sbin/imagerank-restart` again is safe. If it will not come up,
escalate rather than redeploying over it.

**`Sorry, user ctran is not allowed to execute ...`.** You typed a command
outside the grant. Run `ssh ctran@atlas sudo -l` to see exactly what is
permitted. Ask rather than looking for a way around it.

## Granting a collaborator deploy access

One-time setup, run by a root user. Two separate grants: group membership for
the published directories, and one fixed `sudo` command for the restart.

The files referenced here live in `imagerank/deploy/` in this repository, so
they are reviewable and version-controlled rather than existing only on the
host.

```bash
# 1. File access to the published directories
sudo usermod -aG imagerank ctran

cd /vhosts/psychophysics/imagerank
sudo chgrp -R imagerank server client/dist
sudo chmod -R g+w server client/dist
sudo find server client/dist -type d -exec chmod g+s {} +
```

The setgid bit matches the convention already used elsewhere in this tree: it
makes files created later keep the shared group, so the next person's rsync
does not fail on a file the previous person wrote.

```bash
# 2. The privileged restart, as one fixed command
sudo install -o root -g root -m 0755 \
  imagerank/deploy/imagerank-restart /usr/local/sbin/imagerank-restart

sudo groupadd -f imagerank-deploy
sudo usermod -aG imagerank-deploy ctran
sudo usermod -aG imagerank-deploy hkoren

# Validate BEFORE installing: a malformed sudoers file can lock everyone out
visudo -cf imagerank/deploy/sudoers.d-imagerank-deploy
sudo install -o root -g root -m 0440 \
  imagerank/deploy/sudoers.d-imagerank-deploy /etc/sudoers.d/imagerank-deploy

# The old file granted the same systemctl verbs to hkoren by name; the group
# rule replaces it
sudo rm -f /etc/sudoers.d/imagerank-deploy.old
```

```bash
# 3. Fix the SSH directory mode if key login is failing.
#    ~/.ssh needs its execute bit or sshd cannot read authorized_keys at all.
sudo chmod 700 /home/ctran/.ssh
sudo chmod 600 /home/ctran/.ssh/authorized_keys
sudo chown -R ctran:ctran /home/ctran/.ssh
```

```bash
# 4. Optional: let them read the service log for troubleshooting
sudo usermod -aG systemd-journal ctran
```

### Verify the grant

Group membership only applies to new sessions, so have them log out and back in
first.

```bash
ssh ctran@atlas id                   # expect imagerank and imagerank-deploy
ssh ctran@atlas sudo -l              # expect ONLY imagerank-restart and the status verbs
ssh ctran@atlas 'sudo cat /etc/imagerank/imagerank.env'   # MUST be refused
ssh ctran@atlas 'sudo systemctl stop imagerank-api'       # MUST be refused
```

The last two are the ones that matter. If either succeeds, the grant is wider
than intended; remove `/etc/sudoers.d/imagerank-deploy` and start over.

### Why a wrapper script instead of allowing the commands directly

Granting `systemctl` or `cp` through sudo, even with the paths spelled out,
hands over root. `sudo cp` can copy any file anywhere, including over
`/etc/sudoers`; sudoers wildcards are routinely defeated with `..` in a path.
A script that accepts no arguments has nothing to subvert, and it also means
the database backup cannot be skipped.

This only holds while the script stays root-owned and not group-writable. If
`/usr/local/sbin/imagerank-restart` ever becomes writable by the deploy group,
membership in that group becomes equivalent to root.

### Revoking access

```bash
sudo gpasswd -d ctran imagerank
sudo gpasswd -d ctran imagerank-deploy
```
