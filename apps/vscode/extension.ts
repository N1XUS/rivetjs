// VS Code shell around @rivetjs/typescript-plugin (contributed through `typescriptServerPlugins`, so
// it runs inside the TypeScript server with bundled or workspace TypeScript): plugin settings,
// Rivet: Doctor, a status bar item (resume | dom | off), resume inlay hints and optional region tinting.
import * as vscode from "vscode";

const PLUGIN = "@rivetjs/typescript-plugin";

interface Site {
  kind: string;
  id: string;
  runsOn: "client" | "both";
  start: number;
  end: number;
  /** Inlay hint text (plugin's `siteLabel`). */
  label?: string;
}

interface Finding {
  severity: "error" | "warning" | "info";
  message: string;
  fix?: string;
}

/** Custom tsserver request (`_rivet:*` protocol handlers); undefined when the plugin is not loaded. */
async function request<T>(command: string, file: string): Promise<T | undefined> {
  try {
    const result = (await vscode.commands.executeCommand("typescript.tsserverRequest", command, { file })) as { body?: T } | T | undefined;
    return result && typeof result === "object" && "body" in result ? result.body : (result as T | undefined);
  } catch {
    return undefined;
  }
}

async function configurePlugin(): Promise<void> {
  const extension = vscode.extensions.getExtension("vscode.typescript-language-features");
  if (!extension) return;
  const api = ((await extension.activate()) as { getAPI?(version: 0): { configurePlugin(id: string, config: unknown): void } } | undefined)?.getAPI?.(0);
  const settings = vscode.workspace.getConfiguration("rivet");
  // Inlay hints come from the native provider below: the TypeScript extension only asks plugins for
  // hints when its own `typescript.inlayHints.*` settings are on (all off by default).
  api?.configurePlugin(PLUGIN, { inlayHints: false, typeAware: settings.get<boolean>("typeAware", true) });
}

/** Resume inlay hints (`rivet.inlayHints`: browser-only closures, every site, or off) from `_rivet:sites`. */
const inlayHints: vscode.InlayHintsProvider = {
  async provideInlayHints(document, range) {
    const mode = vscode.workspace.getConfiguration("rivet").get<string>("inlayHints", "client");
    if (mode === "off") return [];
    const result = await request<{ resume: boolean; sites: Site[] }>("_rivet:sites", document.uri.fsPath);
    const start = document.offsetAt(range.start),
      end = document.offsetAt(range.end);
    return (result?.sites ?? [])
      .filter((site) => site.label && (mode === "all" || site.runsOn === "client") && site.start >= start && site.start <= end)
      .map((site) => {
        const hint = new vscode.InlayHint(document.positionAt(site.start), site.label!, vscode.InlayHintKind.Type);
        hint.paddingRight = true;
        return hint;
      });
  },
};

const tsx = (editor: vscode.TextEditor | undefined): editor is vscode.TextEditor =>
  Boolean(editor && ["typescriptreact", "javascriptreact"].includes(editor.document.languageId) && editor.document.uri.scheme === "file");

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Rivet");
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = "rivet.doctor";
  const client = vscode.window.createTextEditorDecorationType({ backgroundColor: new vscode.ThemeColor("diffEditor.insertedTextBackground"), isWholeLine: false });
  const both = vscode.window.createTextEditorDecorationType({ backgroundColor: new vscode.ThemeColor("editor.wordHighlightBackground"), isWholeLine: false });
  context.subscriptions.push(output, status, client, both);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = (editor = vscode.window.activeTextEditor) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!tsx(editor)) return void status.hide();
      const result = await request<{ resume: boolean; sites: Site[] }>("_rivet:sites", editor.document.uri.fsPath);
      status.text = `Rivet: ${result ? (result.resume ? "resume" : "dom") : "off"}`;
      status.tooltip = result ? (result.resume ? "Compiled in resume mode (.rivet/editor.json)" : "Compiled as a DOM/server module") : "Rivet plugin not active: run Rivet: Doctor";
      status.show();
      const tint = vscode.workspace.getConfiguration("rivet").get<boolean>("regions", false);
      const range = (s: Site) => new vscode.Range(editor.document.positionAt(s.start), editor.document.positionAt(s.end));
      const sites = tint ? (result?.sites ?? []) : [];
      editor.setDecorations(client, sites.filter((s) => s.runsOn === "client").map(range));
      editor.setDecorations(both, sites.filter((s) => s.runsOn === "both" && s.kind !== "region").map(range));
    }, 300);
  };

  context.subscriptions.push(
    vscode.languages.registerInlayHintsProvider(
      ["typescriptreact", "javascriptreact"].map((language) => ({ language, scheme: "file" })),
      inlayHints,
    ),
    vscode.commands.registerCommand("rivet.doctor", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!tsx(editor)) return void vscode.window.showInformationMessage("Rivet: Doctor checks the active .tsx/.jsx file.");
      const result = await request<{ findings: Finding[] }>("_rivet:doctor", editor.document.uri.fsPath);
      const findings: Finding[] = result?.findings ?? [
        {
          severity: "warning",
          message: "The Rivet TypeScript plugin did not answer: TypeScript may be starting, or the plugin failed to load (see the TypeScript server log).",
          fix: 'Run "TypeScript: Restart TS Server"; with workspace TypeScript, build the plugin: nx run typescript-plugin:build.',
        },
      ];
      output.clear();
      output.appendLine(`Rivet: Doctor — ${editor.document.uri.fsPath}`);
      for (const f of findings) output.appendLine(`[${f.severity}] ${f.message}${f.fix ? `\n    → ${f.fix}` : ""}`);
      if (!findings.length) output.appendLine("No problems found.");
      output.show(true);
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => refresh(editor)),
    vscode.workspace.onDidSaveTextDocument(() => refresh()),
    vscode.workspace.onDidChangeTextDocument((event) => event.document === vscode.window.activeTextEditor?.document && refresh()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("rivet")) return;
      void configurePlugin();
      refresh();
    }),
  );
  void configurePlugin();
  refresh();
}

export function deactivate(): void {}
