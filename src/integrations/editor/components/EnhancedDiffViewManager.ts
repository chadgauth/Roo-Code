import * as vscode from "vscode"
import { AnimatedDecorationFactory } from "./AnimatedDecorationFactory"

export interface DiffChange {
	type: "addition" | "deletion" | "modification"
	lineNumber: number
	content: string
}

/**
 * Enhanced diff view manager with smooth transitions and visual feedback.
 * Provides animated diff indicators and smooth state transitions.
 */
export class EnhancedDiffViewManager {
	private diffDecorations: {
		addition?: vscode.TextEditorDecorationType
		deletion?: vscode.TextEditorDecorationType
		modification?: vscode.TextEditorDecorationType
		loading?: vscode.TextEditorDecorationType
		error?: vscode.TextEditorDecorationType
	} = {}

	private animationQueue: Array<{
		type: string
		range: vscode.Range
		delay: number
	}> = []

	private isAnimating: boolean = false

	constructor() {
		this.initializeDecorations()
	}

	/**
	 * Initialize animated diff decorations
	 */
	private initializeDecorations(): void {
		const bundle = AnimatedDecorationFactory.createDiffBundle()
		this.diffDecorations = {
			addition: bundle.addition,
			deletion: bundle.deletion,
			modification: bundle.modification,
			loading: bundle.loading,
			error: bundle.error,
		}
	}

	/**
	 * Open diff view with enhanced visual feedback
	 */
	async openDiffView(
		relPath: string,
		originalContent: string,
		newContent: string,
		editType: "create" | "modify",
	): Promise<vscode.TextEditor | undefined> {
		try {
			// Show loading indicator
			await this.showLoadingState(relPath)

			const absolutePath = vscode.Uri.file(relPath)

			// Create temporary file for diff if it's a new file
			if (editType === "create") {
				await vscode.workspace.fs.writeFile(absolutePath, Buffer.from(newContent, "utf8"))
			}

			// Open diff view with enhanced transition
			const leftUri = vscode.Uri.parse(`roo-original:${relPath}`)
			const rightUri = absolutePath

			await vscode.commands.executeCommand(
				"vscode.diff",
				leftUri,
				rightUri,
				`${editType === "create" ? "Create" : "Edit"}: ${relPath}`,
				{ viewColumn: vscode.ViewColumn.Active },
			)

			// Get the active editor
			const editor = vscode.window.activeTextEditor

			if (editor) {
				// Apply enhanced diff highlighting with animation
				await this.applyAnimatedDiffHighlighting(editor, originalContent, newContent)

				// Clear loading state
				await this.clearLoadingState(editor)
			}

			return editor
		} catch (error) {
			console.error("Failed to open enhanced diff view:", error)
			// Show error state if something goes wrong
			const editor = vscode.window.activeTextEditor
			if (editor) {
				await this.showErrorState(editor, `Failed to open diff: ${error}`)
			}
			return undefined
		}
	}

	/**
	 * Apply animated diff highlighting with smooth transitions
	 */
	private async applyAnimatedDiffHighlighting(
		editor: vscode.TextEditor,
		originalContent: string,
		newContent: string,
	): Promise<void> {
		const changes = this.calculateDiffChanges(originalContent, newContent)

		// Sort changes by line number for smooth sequential animation
		changes.sort((a, b) => a.lineNumber - b.lineNumber)

		// Apply decorations with staggered animation
		this.isAnimating = true

		for (let i = 0; i < changes.length; i++) {
			const change = changes[i]
			const delay = i * 100 // 100ms between each change highlight

			setTimeout(() => {
				this.highlightChange(editor, change)

				// Check if this is the last change
				if (i === changes.length - 1) {
					this.isAnimating = false
				}
			}, delay)
		}
	}

	/**
	 * Calculate diff changes between original and new content
	 */
	private calculateDiffChanges(originalContent: string, newContent: string): DiffChange[] {
		const originalLines = originalContent.split("\n")
		const newLines = newContent.split("\n")
		const changes: DiffChange[] = []

		// Simple line-by-line diff (could be enhanced with more sophisticated diff algorithm)
		const maxLines = Math.max(originalLines.length, newLines.length)

		for (let i = 0; i < maxLines; i++) {
			const originalLine = originalLines[i] || ""
			const newLine = newLines[i] || ""

			if (i >= originalLines.length) {
				// New line added
				changes.push({
					type: "addition",
					lineNumber: i,
					content: newLine,
				})
			} else if (i >= newLines.length) {
				// Line deleted
				changes.push({
					type: "deletion",
					lineNumber: i,
					content: originalLine,
				})
			} else if (originalLine !== newLine) {
				// Line modified
				changes.push({
					type: "modification",
					lineNumber: i,
					content: newLine,
				})
			}
		}

		return changes
	}

	/**
	 * Highlight a specific change with appropriate decoration
	 */
	private highlightChange(editor: vscode.TextEditor, change: DiffChange): void {
		const range = new vscode.Range(change.lineNumber, 0, change.lineNumber, Number.MAX_SAFE_INTEGER)

		let decoration: vscode.TextEditorDecorationType | undefined

		switch (change.type) {
			case "addition":
				decoration = this.diffDecorations.addition
				break
			case "deletion":
				decoration = this.diffDecorations.deletion
				break
			case "modification":
				decoration = this.diffDecorations.modification
				break
		}

		if (decoration) {
			// Apply decoration with fade-in effect
			AnimatedDecorationFactory.animateFadeIn(editor, decoration, [range], 200)
		}
	}

	/**
	 * Show loading state while diff is being prepared
	 */
	private async showLoadingState(filePath: string): Promise<void> {
		// Could show a progress indicator in the status bar
		vscode.window.setStatusBarMessage(`⏳ Preparing diff for ${filePath}...`, 2000)
	}

	/**
	 * Clear loading state decorations
	 */
	private async clearLoadingState(editor: vscode.TextEditor): Promise<void> {
		if (this.diffDecorations.loading) {
			editor.setDecorations(this.diffDecorations.loading, [])
		}
	}

	/**
	 * Show error state with visual feedback
	 */
	private async showErrorState(editor: vscode.TextEditor, errorMessage: string): Promise<void> {
		if (this.diffDecorations.error) {
			// Highlight the entire first line with error decoration
			const range = new vscode.Range(0, 0, 0, Number.MAX_SAFE_INTEGER)
			editor.setDecorations(this.diffDecorations.error, [range])

			// Show error message
			vscode.window.showErrorMessage(`Diff Error: ${errorMessage}`)

			// Clear error decoration after 5 seconds
			setTimeout(() => {
				if (this.diffDecorations.error) {
					editor.setDecorations(this.diffDecorations.error, [])
				}
			}, 5000)
		}
	}

	/**
	 * Navigate to next change with smooth scrolling
	 */
	async navigateToNextChange(editor: vscode.TextEditor, currentLine: number): Promise<void> {
		// Implementation would find next decorated line and smoothly scroll to it
		const nextChangeLineNumber = this.findNextChangeFromLine(editor, currentLine)

		if (nextChangeLineNumber !== -1) {
			const position = new vscode.Position(nextChangeLineNumber, 0)
			const range = new vscode.Range(position, position)

			// Smooth scroll to position
			editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
			editor.selection = new vscode.Selection(position, position)

			// Flash highlight the target line
			await this.flashHighlight(editor, nextChangeLineNumber)
		}
	}

	/**
	 * Navigate to previous change with smooth scrolling
	 */
	async navigateToPreviousChange(editor: vscode.TextEditor, currentLine: number): Promise<void> {
		const prevChangeLineNumber = this.findPreviousChangeFromLine(editor, currentLine)

		if (prevChangeLineNumber !== -1) {
			const position = new vscode.Position(prevChangeLineNumber, 0)
			const range = new vscode.Range(position, position)

			editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
			editor.selection = new vscode.Selection(position, position)

			await this.flashHighlight(editor, prevChangeLineNumber)
		}
	}

	/**
	 * Flash highlight a specific line
	 */
	private async flashHighlight(editor: vscode.TextEditor, lineNumber: number): Promise<void> {
		// Create a temporary highlight decoration
		const flashDecoration = vscode.window.createTextEditorDecorationType({
			backgroundColor: "rgba(255, 255, 0, 0.3)",
			isWholeLine: true,
		})

		const range = new vscode.Range(lineNumber, 0, lineNumber, Number.MAX_SAFE_INTEGER)

		// Apply and remove flash effect
		editor.setDecorations(flashDecoration, [range])

		setTimeout(() => {
			editor.setDecorations(flashDecoration, [])
			flashDecoration.dispose()
		}, 500)
	}

	/**
	 * Find next change from current line
	 */
	private findNextChangeFromLine(editor: vscode.TextEditor, currentLine: number): number {
		// Implementation would scan decorated lines to find next change
		// For now, return a placeholder
		return Math.min(currentLine + 1, editor.document.lineCount - 1)
	}

	/**
	 * Find previous change from current line
	 */
	private findPreviousChangeFromLine(editor: vscode.TextEditor, currentLine: number): number {
		// Implementation would scan decorated lines to find previous change
		// For now, return a placeholder
		return Math.max(currentLine - 1, 0)
	}

	/**
	 * Clear all diff decorations
	 */
	clearAllDecorations(editor: vscode.TextEditor): void {
		Object.values(this.diffDecorations).forEach((decoration) => {
			if (decoration) {
				editor.setDecorations(decoration, [])
			}
		})
	}

	/**
	 * Close diff view with smooth transition
	 */
	async closeDiffView(editor: vscode.TextEditor): Promise<void> {
		// Clear all decorations first
		this.clearAllDecorations(editor)

		// Close the editor
		await vscode.commands.executeCommand("workbench.action.closeActiveEditor")
	}

	/**
	 * Get diff statistics
	 */
	getDiffStats(): {
		isAnimating: boolean
		queuedAnimations: number
	} {
		return {
			isAnimating: this.isAnimating,
			queuedAnimations: this.animationQueue.length,
		}
	}

	/**
	 * Dispose resources
	 */
	dispose(): void {
		this.animationQueue = []
		this.isAnimating = false
		AnimatedDecorationFactory.clearAnimations()
	}
}
