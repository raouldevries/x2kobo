# Privacy

x2kobo processes everything locally on your machine. There is no telemetry, analytics, or data collection.

## Network calls

The only network requests x2kobo makes:

1. **x.com** - To load X Article pages in the headless browser (uses your saved session cookies)
2. **pbs.twimg.com** - To download images embedded in articles
3. **api.dropboxapi.com / content.dropboxapi.com** - To exchange OAuth tokens and upload files (only when Dropbox is configured and `--no-upload` is not used)

## Stored data

All data is stored locally at `~/.x2kobo/`:

- `browser-data/` - Chromium browser profile with session cookies
- `config.json` - Dropbox OAuth tokens and app key
- `debug/` - HTML snapshots saved on extraction failure (for troubleshooting)

No data is sent to any server other than those listed above.
