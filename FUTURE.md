So, I see a few issue with our chunk and transcribe pipeline.

- transcription happens in-memory instead of in text files, so if things go wrong, it would be hard to recover previous transripts
- unsure of what happens to the chunks if it errors. They are removed if it succeeds, which is good.
