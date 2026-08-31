# Campaign creatives are uploaded files, not remote URLs

Advertisers previously could paste any public HTTPS image URL for a campaign billboard. That hotlinks a third-party host, skips the format and size checks we already run on upload, and leaves live billboards dependent on someone else's CDN. A **Campaign Creative** must be uploaded (PNG, JPEG, or WebP) and stored as a same-origin `/advertise/uploads/{uuid}.{ext}` path. Owners cannot supply a remote URL. Admins replace a campaign's creative the same way. Existing remote URLs keep displaying until replaced.

## Considered Options

Keep paste-URL as a convenience for advertisers who already host assets. Rejected: we cannot validate bytes we do not hold, and a broken or swapped remote image still shows in-world.
