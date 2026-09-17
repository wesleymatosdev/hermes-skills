---
name: social-media-asset-delivery
description: "Use when sharing published social-media assets."
version: 0.1.0
metadata:
  hermes:
    tags: [social-media, buffer, linkedin, media, telegram, delivery]
---

# Social-media asset delivery

Use when the user asks for the actual media or a direct download URL from a post already published or scheduled on a social platform. The goal is to identify the **exact attached asset**, retrieve it safely, verify it is valid media, and deliver it in the requested channel format.

## Workflow

1. **Identify the post from the publishing system.**
   - With Buffer, query recent posts for the relevant organization and request `id,status,sentAt,text,assets`.
   - Match by published status, approximate time, recognizable post text, and asset type. Do not assume the newest post is the intended one when there are several similar posts.
   - For a video, inspect the `VideoAsset.source`; for a carousel/document, inspect the document asset source.

2. **Use the original asset URL where possible.**
   - Prefer the stable source URL recorded by Buffer (for example, a GitHub Release asset) over transient CDN thumbnails or a social-network player URL.
   - Do not expose API keys, authorization headers, or signed private URLs in the user-facing response.

3. **Download and verify before delivery.**
   - Download to a durable cache/share path.
   - Check the detected file type and inspect duration/size with `ffprobe` for video. A successful HTTP status alone is not proof that the file is usable media.
   - If validation fails, stop; do not send an HTML error page renamed as an `.mp4`.

4. **Deliver in the requested form.**
   - On Telegram, send `MEDIA:/absolute/path/to/file` to attach the actual video or image natively.
   - Also offer the stable direct source URL if the user requested a link or may want to forward/download it separately.

## Buffer lookup pattern

Keep credentials inside the subprocess environment and keep machine parsing separate from chat output. Request only the fields necessary to identify the attachment. See `references/buffer-asset-lookup.md` for a compact extraction pattern and selection criteria.

## Pitfalls

- A Buffer CLI config file is optional when its API key is securely injected for the command; do not treat a missing default organization setting as proof that Buffer cannot be queried.
- A post can be marked `sent` while a different post is merely scheduled; verify `status` and `sentAt` before calling it published.
- LinkedIn post metadata may not provide a friendly public permalink. The stable asset source is often the most useful way to share the actual video.
- Do not mistake a carousel PDF's `DocumentAsset` for the separate video attached to another post.
