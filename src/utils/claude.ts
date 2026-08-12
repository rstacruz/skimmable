/** One `claude -p --output-format json` call, with retry. */

const CALL_TIMEOUT_MS = 300_000;

export type CallResult = {
  input_tokens: number;
  output_tokens: number;
  text: string;
  stop_reason?: string;
};

type ClaudeResponse = {
  type: string;
  is_error?: boolean;
  usage: { input_tokens: number; output_tokens: number };
  result?: string;
  stop_reason?: string;
};

export type CallOptions = {
  systemPrompt?: string | null;
  model?: string | null;
  cwd?: string;
};

export async function callClaude(prompt: string, opts: CallOptions = {}): Promise<CallResult> {
  const cmd = ["claude", "-p", "--output-format", "json"];
  if (opts.model) cmd.push("--model", opts.model);
  if (opts.systemPrompt) cmd.push("--append-system-prompt", opts.systemPrompt);
  cmd.push(prompt);
  // Disables all tools: implementation prompts ("implement X") make the
  // model attempt Write, and the tool loop stalls on non-TTY stdin. Pure-text
  // generation also keeps token counts comparable across modes.
  // Equals form (not "--tools", "") since --tools is variadic and would
  // otherwise swallow the next positional arg.
  cmd.push("--tools=");

  const delays = [5_000, 10_000, 20_000];
  for (let attempt = 0; ; attempt++) {
    try {
      const proc = Bun.spawn(cmd, {
        cwd: opts.cwd,
        stdout: "pipe",
        stderr: "pipe",
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS), // kills child on timeout
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exit = await proc.exited;
      // --output-format json now returns an array of stream messages
      // (system/assistant/result), not a flat object; usage/result live on
      // the "result" message.
      const data = (JSON.parse(stdout) as ClaudeResponse[]).find((m) => m.type === "result");
      if (exit !== 0 || !data || data.is_error) throw new Error(`exit=${exit} stderr=${stderr.slice(-300)}`);
      return {
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        text: data.result ?? "",
        stop_reason: data.stop_reason,
      };
    } catch (e) {
      if (attempt >= 3) throw e;
      const delay = delays[Math.min(attempt, delays.length - 1)];
      console.error(`  call failed (${e}), retrying in ${delay / 1000}s...`);
      await Bun.sleep(delay);
    }
  }
}
