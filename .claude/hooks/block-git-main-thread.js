// PreToolUse (Bash|PowerShell): fuerza que commit/push/PR pasen por el subagente git-ops.
// Dentro de un subagente el payload trae agent_id; en el hilo principal no.
let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // ante la duda, no bloquear
  }
  if (input.agent_id) process.exit(0); // ya es un subagente
  const cmd = (input.tool_input && input.tool_input.command) || "";
  const re = /\bgit\s+(?:-C\s+\S+\s+)?(commit|push)\b|\bgh\s+pr\s+(create|merge)\b/;
  if (re.test(cmd)) {
    process.stderr.write(
      "Bloqueado: commits, pushes y PRs se delegan al subagente git-ops (model: haiku). " +
        "Lánzalo con Agent(subagent_type='git-ops') pasándole ficheros, mensaje y trailer.\n"
    );
    process.exit(2);
  }
  process.exit(0);
});
