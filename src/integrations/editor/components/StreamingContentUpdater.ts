import * as vscode from "vscode"
import { DecorationController } from "../DecorationController"

/**
 * Manages real-time content updates during streaming operations.
 * Handles progressive content replacement and visual decorations.
 * Extracted from DiffViewProvider to separate streaming concerns.
 */
export class StreamingContentUpdater {
	private streamedLines: string[] = []

	constructor(
		private decorationControllers: {
			fadedOverlay?: DecorationController
			activeLine?: DecorationController
		} = {},
	) {}

	/**
	 * Set the decoration controllers for visual feedback
	 */
	setDecorationControllers(controllers: {
		fadedOverlay?: DecorationController
		activeLine?: DecorationController
	}): void {
		this.decorationControllers = controllers
	}

	/**
	 * Update editor content during streaming with visual feedback
	 * @param editor - Text editor to update
	 * @param accumulatedContent - Content accumulated so far
	 * @param isFinal - Whether this is the final update
	 * @param originalContent - Original file content for EOL preservation
	 */
	async updateStreamingContent(
		editor: vscode.TextEditor,
		accumulatedContent: string,
		isFinal: boolean,
		originalContent?: string,
	): Promise<void> {
		const document = editor.document
		const accumulatedLines = accumulatedContent.split("\n")

		// Remove the last partial line only if it's not the final update
		if (!isFinal) {
			accumulatedLines.pop()
		}

		// Place cursor at the beginning to keep it out of the way
		const beginningOfDocument = new vscode.Position(0, 0)
		editor.selection = new vscode.Selection(beginningOfDocument, beginningOfDocument)

		const endLine = accumulatedLines.length

		// Replace content up to the current line
		const edit = new vscode.WorkspaceEdit()
		const rangeToReplace = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(endLine, 0))

		// Build content to replace - for non-final updates, use exact content
		let contentToReplace: string
		if (!isFinal) {
			// For incremental updates, use the exact accumulated content
			contentToReplace = accumulatedContent
		} else {
			// For final updates, preserve original newline structure
			contentToReplace = accumulatedLines.join("\n") + (accumulatedLines.length > 0 ? "\n" : "")
		}

		edit.replace(document.uri, rangeToReplace, this.stripAllBOMs(contentToReplace))
		await vscode.workspace.applyEdit(edit)

		// Update visual decorations
		this.updateDecorations(endLine, document.lineCount)

		// Update tracked streamed lines
		this.streamedLines = accumulatedLines

		if (isFinal) {
			await this.finalizeFinalContent(editor, accumulatedContent, originalContent)
		}
	}

	/**
	 * Finalize content when streaming is complete
	 */
	private async finalizeFinalContent(
		editor: vscode.TextEditor,
		accumulatedContent: string,
		originalContent?: string,
	): Promise<void> {
		const document = editor.document

		// Handle remaining lines if new content is shorter than current
		if (this.streamedLines.length < document.lineCount) {
			const edit = new vscode.WorkspaceEdit()
			edit.delete(
				document.uri,
				new vscode.Range(
					new vscode.Position(this.streamedLines.length, 0),
					new vscode.Position(document.lineCount, 0),
				),
			)
			await vscode.workspace.applyEdit(edit)
		}

		// Preserve empty last line if original content had one
		const hasEmptyLastLine = originalContent?.endsWith("\n")
		if (hasEmptyLastLine && !accumulatedContent.endsWith("\n")) {
			accumulatedContent += "\n"
		}

		// Apply the final content - use the actual content line count for range
		const finalEdit = new vscode.WorkspaceEdit()
		const originalLines = originalContent?.split("\n") || []
		const endLineForRange = Math.max(originalLines.length - 1, 0)

		finalEdit.replace(
			document.uri,
			new vscode.Range(new vscode.Position(0, 0), new vscode.Position(endLineForRange, 0)),
			this.stripAllBOMs(accumulatedContent),
		)
		await vscode.workspace.applyEdit(finalEdit)

		// Clear all decorations at the end
		this.clearDecorations()
	}

	/**
	 * Update visual decorations to show progress
	 */
	private updateDecorations(endLine: number, totalLines: number): void {
		// Update active line decoration
		if (this.decorationControllers.activeLine) {
			this.decorationControllers.activeLine.setActiveLine(endLine)
		}

		// Update faded overlay decoration
		if (this.decorationControllers.fadedOverlay) {
			this.decorationControllers.fadedOverlay.updateOverlayAfterLine(endLine, totalLines)
		}
	}

	/**
	 * Clear all visual decorations
	 */
	clearDecorations(): void {
		if (this.decorationControllers.fadedOverlay) {
			this.decorationControllers.fadedOverlay.clear()
		}
		if (this.decorationControllers.activeLine) {
			this.decorationControllers.activeLine.clear()
		}
	}

	/**
	 * Initialize decorations for streaming
	 * @param editor - Text editor to apply decorations to
	 */
	initializeDecorations(editor: vscode.TextEditor): void {
		// Apply faded overlay to all lines initially
		if (this.decorationControllers.fadedOverlay) {
			this.decorationControllers.fadedOverlay.addLines(0, editor.document.lineCount)
		}
	}

	/**
	 * Get current streamed lines
	 */
	getStreamedLines(): string[] {
		return [...this.streamedLines]
	}

	/**
	 * Reset streaming state
	 */
	reset(): void {
		this.streamedLines = []
		this.clearDecorations()
	}

	/**
	 * Check if editor should be scrolled based on visible ranges
	 */
	shouldScrollEditor(editor: vscode.TextEditor, endLine: number): boolean {
		const ranges = editor.visibleRanges
		return ranges && ranges.length > 0 && ranges[0].start.line < endLine && ranges[0].end.line > endLine
	}

	/**
	 * Strip all Byte Order Marks (BOMs) from content
	 */
	private stripAllBOMs(input: string): string {
		// Simple BOM stripping - could be enhanced with stripBom library if needed
		return input.replace(/^\uFEFF/, "")
	}

	/**
	 * Get streaming statistics
	 */
	getStreamingStats(): {
		totalLines: number
		hasContent: boolean
		isActive: boolean
	} {
		return {
			totalLines: this.streamedLines.length,
			hasContent: this.streamedLines.length > 0,
			isActive:
				this.decorationControllers.activeLine !== undefined ||
				this.decorationControllers.fadedOverlay !== undefined,
		}
	}

	/**
	 * Validate editor state before streaming operations
	 */
	validateEditorState(editor: vscode.TextEditor | undefined): boolean {
		if (!editor || !editor.document) {
			return false
		}

		// Check if document is still valid
		try {
			editor.document.getText()
			return true
		} catch {
			return false
		}
	}

	/**
	 * Apply content edit with error handling
	 */
	private async applyContentEdit(edit: vscode.WorkspaceEdit): Promise<boolean> {
		try {
			return await vscode.workspace.applyEdit(edit)
		} catch (error) {
			console.error("Failed to apply streaming content edit:", error)
			return false
		}
	}

	/**
	 * Update content with fallback error handling
	 */
	async updateContentSafely(editor: vscode.TextEditor, content: string, range: vscode.Range): Promise<boolean> {
		if (!this.validateEditorState(editor)) {
			return false
		}

		const edit = new vscode.WorkspaceEdit()
		edit.replace(editor.document.uri, range, this.stripAllBOMs(content))

		return await this.applyContentEdit(edit)
	}
}
