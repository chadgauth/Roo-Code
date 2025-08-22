import * as vscode from "vscode"

/**
 * Factory for creating VS Code text editor decoration types.
 * Centralizes decoration type creation and management.
 */
export class DecorationFactory {
	private static decorationTypes = new Map<string, vscode.TextEditorDecorationType>()

	/**
	 * Create or get a faded overlay decoration type
	 */
	static createFadedOverlayDecoration(): vscode.TextEditorDecorationType {
		const key = "fadedOverlay"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(255, 255, 0, 0.1)",
				opacity: "0.4",
				isWholeLine: true,
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Create or get an active line decoration type
	 */
	static createActiveLineDecoration(): vscode.TextEditorDecorationType {
		const key = "activeLine"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(255, 255, 0, 0.3)",
				opacity: "1",
				isWholeLine: true,
				border: "1px solid rgba(255, 255, 0, 0.5)",
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Create a custom decoration type
	 */
	static createCustomDecoration(
		key: string,
		options: vscode.DecorationRenderOptions,
	): vscode.TextEditorDecorationType {
		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType(options)
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Get an existing decoration type by key
	 */
	static getDecoration(key: string): vscode.TextEditorDecorationType | undefined {
		return this.decorationTypes.get(key)
	}

	/**
	 * Dispose of a specific decoration type
	 */
	static disposeDecoration(key: string): void {
		const decorationType = this.decorationTypes.get(key)
		if (decorationType) {
			decorationType.dispose()
			this.decorationTypes.delete(key)
		}
	}

	/**
	 * Dispose of all decoration types (cleanup)
	 */
	static disposeAll(): void {
		for (const [key, decorationType] of this.decorationTypes) {
			decorationType.dispose()
		}
		this.decorationTypes.clear()
	}

	/**
	 * Check if a decoration type exists
	 */
	static hasDecoration(key: string): boolean {
		return this.decorationTypes.has(key)
	}

	/**
	 * Get all decoration type keys
	 */
	static getAllDecorationKeys(): string[] {
		return Array.from(this.decorationTypes.keys())
	}

	/**
	 * Create decoration types for streaming content updates
	 */
	static createStreamingDecorations(): {
		fadedOverlay: vscode.TextEditorDecorationType
		activeLine: vscode.TextEditorDecorationType
	} {
		return {
			fadedOverlay: this.createFadedOverlayDecoration(),
			activeLine: this.createActiveLineDecoration(),
		}
	}

	/**
	 * Create highlighting decoration for errors
	 */
	static createErrorHighlightDecoration(): vscode.TextEditorDecorationType {
		const key = "errorHighlight"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(255, 0, 0, 0.1)",
				border: "1px solid rgba(255, 0, 0, 0.5)",
				isWholeLine: true,
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Create highlighting decoration for warnings
	 */
	static createWarningHighlightDecoration(): vscode.TextEditorDecorationType {
		const key = "warningHighlight"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(255, 165, 0, 0.1)",
				border: "1px solid rgba(255, 165, 0, 0.5)",
				isWholeLine: true,
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Create highlighting decoration for success/completed states
	 */
	static createSuccessHighlightDecoration(): vscode.TextEditorDecorationType {
		const key = "successHighlight"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(0, 255, 0, 0.1)",
				border: "1px solid rgba(0, 255, 0, 0.5)",
				isWholeLine: true,
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Get decoration statistics
	 */
	static getStats(): {
		totalDecorations: number
		activeDecorations: string[]
	} {
		return {
			totalDecorations: this.decorationTypes.size,
			activeDecorations: this.getAllDecorationKeys(),
		}
	}
}
