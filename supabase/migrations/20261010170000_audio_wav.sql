-- Phase 4: allow wav uploads (the demo seed generates a tone; browsers still record webm or mp4).
update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'audio/wav')
where id = 'media' and not ('audio/wav' = any (allowed_mime_types));
