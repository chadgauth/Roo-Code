import * as vscode from "vscode"
import * as path from "path"
import * as diff from "diff"
import { arePathsEqual } from "../../../utils/path"

export const DIFF_VIEW_URI_SCHEME = "cline-diff"
export const DIFF_VIEW_LABEL_CHANGES = "Original ↔ Roo's Changes"

/**
 * Manages VS Code diff view operations including opening, closing, and navigation.
 * Extracted from DiffViewProvider to separate diff view concerns.
 */
export class DiffViewManager {
	private static readonly DIFF_EDITOR_TIMEOUT = 10_000 // ms

	/**
	 * Open a VS Code diff editor for the given file
	 * @param relPath - Relative path to the file
	 * @param originalContent - Original file content for the left side of diff
	 * @param cwd - Current working directory
	 * @param editType - Whether this is creating or modifying a file
	 * @returns Promise that resolves to the opened text editor
	 */
	async openDiffEditor(
		relPath: string,
		originalContent: string,
		cwd: string,
		editType: "create" | "modify",
	): Promise<vscode.TextEditor> {
		const uri = vscode.Uri.file(path.resolve(cwd, relPath))
		const fileName = path.basename(uri.fsPath)
		const fileExists = editType === "modify"

		// Check if this diff editor is already open
		const existingDiffTab = this.findExistingDiffTab(uri)
		if (existingDiffTab && existingDiffTab.input instanceof vscode.TabInputTextDiff) {
			const editor = await vscode.window.showTextDocument(existingDiffTab.input.modified, { preserveFocus: true })
			return editor
		}

		// Open new diff editor
		return new Promise<vscode.TextEditor>((resolve, reject) => {
			let timeoutId: NodeJS.Timeout | undefined
			const disposables: vscode.Disposable[] = []

			const cleanup = () => {
				if (timeoutId) {
					clearTimeout(timeoutId)
					timeoutId = undefined
				}
				disposables.forEach((d) => d.dispose())
				disposables.length = 0
			}

			// Set timeout for the entire operation
			timeoutId = setTimeout(() => {
				cleanup()
				reject(
					new Error(
						`Failed to open diff editor for ${uri.fsPath} within ${DiffViewManager.DIFF_EDITOR_TIMEOUT / 1000} seconds. The editor may be blocked or VS Code may be unresponsive.`,
					),
				)
			}, DiffViewManager.DIFF_EDITOR_TIMEOUT)

			// Listen for document open events
			disposables.push(
				vscode.workspace.onDidOpenTextDocument(async (document) => {
					if (arePathsEqual(document.uri.fsPath, uri.fsPath)) {
						// Wait for the editor to be available
						await new Promise((r) => setTimeout(r, 0))

						const editor = vscode.window.visibleTextEditors.find((e) =>
							arePathsEqual(e.document.uri.fsPath, uri.fsPath),
						)

						if (editor) {
							cleanup()
							resolve(editor)
						}
					}
				}),
			)

			// Listen for visible editor changes as a fallback
			disposables.push(
				vscode.window.onDidChangeVisibleTextEditors((editors) => {
					const editor = editors.find((e) => arePathsEqual(e.document.uri.fsPath, uri.fsPath))
					if (editor) {
						cleanup()
						resolve(editor)
					}
				}),
			)

			// Pre-open the file as a text document to ensure it doesn't open in preview mode
			vscode.window
				.showTextDocument(uri, { preview: false, viewColumn: vscode.ViewColumn.Active, preserveFocus: true })
				.then(() => {
					// Execute the diff command after ensuring the file is open as text
					return vscode.commands.executeCommand(
						"vscode.diff",
						vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${fileName}`).with({
							query: Buffer.from(originalContent ?? "").toString("base64"),
						}),
						uri,
						`${fileName}: ${fileExists ? `${DIFF_VIEW_LABEL_CHANGES}` : "New File"} (Editable)`,
						{ preserveFocus: true },
					)
				})
				.then(
					() => {
						// Command executed successfully, now wait for the editor to appear
					},
					(err: any) => {
						cleanup()
						reject(new Error(`Failed to execute diff command for ${uri.fsPath}: ${err.message}`))
					},
				)
		})
	}

	/**
	 * Close all diff views created by this provider
	 */
	async closeAllDiffViews(): Promise<void> {
		const closeOps = vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.filter((tab) => {
				// Check for standard diff views with our URI scheme
				if (
					tab.input instanceof vscode.TabInputTextDiff &&
					tab.input.original.scheme === DIFF_VIEW_URI_SCHEME &&
					!tab.isDirty
				) {
					return true
				}

				// Also check by tab label for our specific diff views
				if (tab.label.includes(DIFF_VIEW_LABEL_CHANGES) && !tab.isDirty) {
					return true
				}

				return false
			})
			.map((tab) =>
				vscode.window.tabGroups.close(tab).then(
					() => undefined,
					(err) => {
						console.error(`Failed to close diff tab ${tab.label}`, err)
					},
				),
			)

		await Promise.all(closeOps)
	}

	/**
	 * Scroll editor to a specific line with some context
	 * @param editor - Text editor to scroll
	 * @param line - Line number to scroll to (0-based)
	 */
	scrollEditorToLine(editor: vscode.TextEditor, line: number): void {
		const scrollLine = line + 4 // Add some context

		editor.revealRange(new vscode.Range(scrollLine, 0, scrollLine, 0), vscode.TextEditorRevealType.InCenter)
	}

	/**
	 * Scroll to the first difference in the diff editor
	 * @param editor - Text editor containing the diff
	 * @param originalContent - Original file content for comparison
	 */
	scrollToFirstDiff(editor: vscode.TextEditor, originalContent: string): void {
		const currentContent = editor.document.getText()
		const diffs = diff.diffLines(originalContent || "", currentContent)

		let lineCount = 0

		for (const part of diffs) {
			if (part.added || part.removed) {
				// Found the first diff, scroll to it without stealing focus
				editor.revealRange(new vscode.Range(lineCount, 0, lineCount, 0), vscode.TextEditorRevealType.InCenter)
				return
			}

			if (!part.removed) {
				lineCount += part.count || 0
			}
		}
	}

	/**
	 * Find an existing diff tab for the given URI
	 */
	private findExistingDiffTab(uri: vscode.Uri): vscode.Tab | undefined {
		return vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.find(
				(tab) =>
					tab.input instanceof vscode.TabInputTextDiff &&
					tab.input?.original?.scheme === DIFF_VIEW_URI_SCHEME &&
					arePathsEqual(tab.input.modified.fsPath, uri.fsPath),
			)
	}

	/**
	 * Check if a diff view is currently open for the given file
	 */
	isDiffViewOpen(relPath: string, cwd: string): boolean {
		const uri = vscode.Uri.file(path.resolve(cwd, relPath))
		return !!this.findExistingDiffTab(uri)
	}

	/**
	 * Get all currently open diff views
	 */
	getOpenDiffViews(): vscode.Tab[] {
		return vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.filter(
				(tab) =>
					tab.input instanceof vscode.TabInputTextDiff &&
					(tab.input.original.scheme === DIFF_VIEW_URI_SCHEME || tab.label.includes(DIFF_VIEW_LABEL_CHANGES)),
			)
	}

	/**
	 * Focus a specific diff view if it's open
	 */
	async focusDiffView(relPath: string, cwd: string): Promise<boolean> {
		const uri = vscode.Uri.file(path.resolve(cwd, relPath))
		const existingTab = this.findExistingDiffTab(uri)

		if (existingTab && existingTab.input instanceof vscode.TabInputTextDiff) {
			await vscode.window.showTextDocument(existingTab.input.modified, { preserveFocus: false })
			return true
		}

		return false
	}
}
