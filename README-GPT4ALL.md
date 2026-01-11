Setup: Local GPT4All bridge

1) Install GPT4All and download a ggml model that your chosen GPT4All build supports.
   - On Windows (x64) you likely installed: gpt4all-installer-win64-v3.10.0.exe
   - Note the path to the `gpt4all.exe` binary and the downloaded model file (e.g. `ggml-gpt4all-j.bin`).

2) Configure environment variables (PowerShell examples):

   $env:GPT4ALL_CMD = "C:\\path\\to\\gpt4all.exe"
   $env:GPT4ALL_MODEL = "C:\\path\\to\\models\\ggml-your-model.bin"
   # Optional: override args template; must include {model} and {prompt}
   $env:GPT4ALL_ARGS = "--model {model} --prompt \"{prompt}\""

3) Install Node dependencies and run the bridge:

   npm install
   node server.js

   The bridge listens on http://127.0.0.1:3000 by default.

4) From the browser (your local app), call the bridge POST /api/ai with JSON { prompt }
   Example response: { text: "...generated text..." }

5) Notes / troubleshooting
   - The exact CLI flags for your GPT4All build may differ. Edit `GPT4ALL_CMD`, `GPT4ALL_MODEL` and `GPT4ALL_ARGS` accordingly.
   - If the CLI supports a chat mode that requires interactive stdin/io behavior, you may need to adapt the bridge to stream or maintain a session. This minimal bridge runs a single process per request.
   - Keep the bridge bound to 127.0.0.1 when running locally to avoid accidental exposure.

If you'd like, I can:
 - Patch your `index.html` with a small `askLocalAI(prompt)` helper and an example "Summarize" button.
 - Adapt `server.js` to a specific GPT4All CLI usage if you tell me the exact command you run successfully from the terminal.
