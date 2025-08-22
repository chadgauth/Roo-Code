import * as vscode from "vscode"
import { DecorationFactory } from "./components/DecorationFactory"

type DecorationType = "fadedOverlay" | "activeLine" | "errorHighlight" | "warningHighlight" | "successHighlight"

/**
 * Enhanced DecorationController that uses the DecorationFactory for better decoration management.
 * Manages VS Code text editor decorations with improved type safety and resource management.
 */
export class DecorationController {
	private decorationType: DecorationType
	private editor: vscode.TextEditor
	private ranges: vscode.Range[] = []
	private decoration: vscode.TextEditorDecorationType

	constructor(decorationType: DecorationType, editor: vscode.TextEditor) {
		this.decorationType = decorationType
		this.editor = editor
		this.decoration = this.createDecoration()
	}

	/**
	 * Create decoration using the factory pattern
	 */
	private createDecoration(): vscode.TextEditorDecorationType {
		switch (this.decorationType) {
			case "fadedOverlay":
				return DecorationFactory.createFadedOverlayDecoration()
			case "activeLine":
				return DecorationFactory.createActiveLineDecoration()
			case "errorHighlight":
				return DecorationFactory.createErrorHighlightDecoration()
			case "warningHighlight":
				return DecorationFactory.createWarningHighlightDecoration()
			case "successHighlight":
				return DecorationFactory.createSuccessHighlightDecoration()
			default:
				throw new Error(`Unknown decoration type: ${this.decorationType}`)
		}
	}

	/**
	 * Get the decoration type for this controller
	 */
	getDecoration(): vscode.TextEditorDecorationType {
		return this.decoration
	}

	/**
	 * Get the decoration type name
	 */
	getDecorationType(): DecorationType {
		return this.decorationType
	}

	/**
	 * Add line decorations to a range of lines
	 */
	addLines(startIndex: number, numLines: number): void {
		// Guard against invalid inputs
		if (startIndex < 0 || numLines <= 0) {
			return
		}

		const lastRange = this.ranges[this.ranges.length - 1]
		if (lastRange && lastRange.end.line === startIndex - 1) {
			this.ranges[this.ranges.length - 1] = lastRange.with(undefined, lastRange.end.translate(numLines))
		} else {
			const endLine = startIndex + numLines - 1
			this.ranges.push(new vscode.Range(startIndex, 0, endLine, Number.MAX_SAFE_INTEGER))
		}

		this.applyDecorations()
	}

	/**
	 * Clear all decorations
	 */
	clear(): void {
		this.ranges = []
		this.applyDecorations()
	}

	/**
	 * Update overlay decoration after a specific line
	 */
	updateOverlayAfterLine(line: number, totalLines: number): void {
		// Remove any existing ranges that start at or after the current line
		this.ranges = this.ranges.filter((range) => range.end.line < line)

		// Add a new range for all lines after the current line
		if (line < totalLines - 1) {
			this.ranges.push(
				new vscode.Range(
					new vscode.Position(line + 1, 0),
					new vscode.Position(totalLines - 1, Number.MAX_SAFE_INTEGER),
				),
			)
		}

		this.applyDecorations()
	}

	/**
	 * Set active line decoration
	 */
	setActiveLine(line: number): void {
		this.ranges = [new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER)]
		this.applyDecorations()
	}

	/**
	 * Apply decorations to the editor
	 */
	private applyDecorations(): void {
		if (this.isEditorValid()) {
			this.editor.setDecorations(this.decoration, this.ranges)
		}
	}

	/**
	 * Check if the editor is still valid
	 */
	private isEditorValid(): boolean {
		try {
			return !!(this.editor && this.editor.document)
		} catch {
			return false
		}
	}

	/**
	 * Get current decoration ranges
	 */
	getRanges(): vscode.Range[] {
		return [...this.ranges]
	}

	/**
	 * Set decoration ranges directly
	 */
	setRanges(ranges: vscode.Range[]): void {
		this.ranges = [...ranges]
		this.applyDecorations()
	}

	/**
	 * Add a single range decoration
	 */
	addRange(range: vscode.Range): void {
		this.ranges.push(range)
		this.applyDecorations()
	}

	/**
	 * Remove a specific range decoration
	 */
	removeRange(range: vscode.Range): void {
		const index = this.ranges.findIndex((r) => r.start.isEqual(range.start) && r.end.isEqual(range.end))
		if (index !== -1) {
			this.ranges.splice(index, 1)
			this.applyDecorations()
		}
	}

	/**
	 * Update the editor reference
	 */
	updateEditor(editor: vscode.TextEditor): void {
		this.editor = editor
		this.applyDecorations()
	}

	/**
	 * Get decoration statistics
	 */
	getStats(): {
		decorationType: DecorationType
		rangeCount: number
		isValid: boolean
	} {
		return {
			decorationType: this.decorationType,
			rangeCount: this.ranges.length,
			isValid: this.isEditorValid(),
		}
	}

	/**
	 * Dispose resources (if needed for cleanup)
	 */
	dispose(): void {
		this.clear()
		// Note: We don't dispose the decoration itself since it's managed by the factory
	}
}
