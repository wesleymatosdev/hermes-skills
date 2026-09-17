# Buffer asset lookup

Use this only after securely injecting the Buffer API key inside the subprocess; never print the key or a command containing it.

## Minimal fields

Request a compact post list:

```text
items.{id,status,sentAt,text,assets},pageInfo
```

Selection rules:

1. Match `status: sent` for a published post; use `sentAt` to distinguish near-duplicates.
2. Confirm with a recognizable text prefix.
3. Inspect `assets`:
   - `VideoAsset.source` is the original video URL.
   - `DocumentAsset.source` is a carousel/PDF, not the video.
   - `thumbnail` is only a preview and should not replace the original media.
4. Download the selected `source`, then prove it is a media container with `file` and `ffprobe` before attaching it.

For Telegram, deliver the validated local file using `MEDIA:/absolute/path/to/file`; include the stable source URL only when useful for forwarding or downloading.
