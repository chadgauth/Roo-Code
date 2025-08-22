import * as vscode from "vscode"

/**
 * Enhanced decoration factory with animations and smooth transitions.
 * Provides modern, polished visual effects for diff operations.
 */
export class AnimatedDecorationFactory {
	private static decorationTypes = new Map<string, vscode.TextEditorDecorationType>()
	private static animationTimers = new Map<string, NodeJS.Timeout>()

	/**
	 * Create a smooth fade-in overlay decoration with gradient effect
	 */
	static createAnimatedFadedOverlay(): vscode.TextEditorDecorationType {
		const key = "animatedFadedOverlay"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(100, 149, 237, 0.08)", // Cornflower blue
				isWholeLine: true,
				opacity: "0.6",
				border: "none none none 3px solid rgba(100, 149, 237, 0.3)",
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Create a pulsing active line decoration with glow effect
	 */
	static createPulsingActiveLine(): vscode.TextEditorDecorationType {
		const key = "pulsingActiveLine"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(255, 215, 0, 0.15)", // Gold
				isWholeLine: true,
				border: "none none none 4px solid rgba(255, 215, 0, 0.8)",
				borderRadius: "2px",
				outline: "1px solid rgba(255, 215, 0, 0.4)",
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Create a typewriter cursor effect for streaming content
	 */
	static createTypewriterCursor(): vscode.TextEditorDecorationType {
		const key = "typewriterCursor"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				border: "none none none 2px solid rgba(0, 255, 127, 1)", // Spring green
				backgroundColor: "rgba(0, 255, 127, 0.1)",
				after: {
					contentText: "│",
					color: "rgba(0, 255, 127, 1)",
					fontWeight: "bold",
				},
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Create a progress line decoration with animated gradient
	 */
	static createProgressLine(): vscode.TextEditorDecorationType {
		const key = "progressLine"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				isWholeLine: true,
				backgroundColor: "rgba(50, 205, 50, 0.12)", // Lime green
				border: "none none none 4px solid rgba(50, 205, 50, 0.8)",
				after: {
					contentText: " ✓",
					color: "rgba(50, 205, 50, 1)",
					fontWeight: "bold",
					margin: "0 0 0 8px",
				},
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Create a diff addition decoration with slide-in effect
	 */
	static createDiffAddition(): vscode.TextEditorDecorationType {
		const key = "diffAddition"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(46, 160, 67, 0.15)", // GitHub green
				isWholeLine: true,
				border: "none none none 4px solid rgba(46, 160, 67, 0.8)",
				before: {
					contentText: "+",
					color: "rgba(46, 160, 67, 1)",
					fontWeight: "bold",
					margin: "0 8px 0 0",
				},
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Create a diff deletion decoration with fade-out effect
	 */
	static createDiffDeletion(): vscode.TextEditorDecorationType {
		const key = "diffDeletion"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(203, 36, 49, 0.15)", // GitHub red
				isWholeLine: true,
				border: "none none none 4px solid rgba(203, 36, 49, 0.8)",
				opacity: "0.7",
				textDecoration: "line-through",
				before: {
					contentText: "-",
					color: "rgba(203, 36, 49, 1)",
					fontWeight: "bold",
					margin: "0 8px 0 0",
				},
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Create a diff modification decoration with subtle highlight
	 */
	static createDiffModification(): vscode.TextEditorDecorationType {
		const key = "diffModification"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(251, 189, 8, 0.15)", // GitHub yellow
				isWholeLine: true,
				border: "none none none 4px solid rgba(251, 189, 8, 0.8)",
				before: {
					contentText: "~",
					color: "rgba(251, 189, 8, 1)",
					fontWeight: "bold",
					margin: "0 8px 0 0",
				},
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Create loading spinner decoration
	 */
	static createLoadingSpinner(): vscode.TextEditorDecorationType {
		const key = "loadingSpinner"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				after: {
					contentText: "⏳",
					color: "rgba(100, 149, 237, 1)",
					margin: "0 0 0 8px",
				},
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Create success completion decoration
	 */
	static createSuccessCompletion(): vscode.TextEditorDecorationType {
		const key = "successCompletion"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(46, 160, 67, 0.1)",
				isWholeLine: true,
				border: "none none none 4px solid rgba(46, 160, 67, 1)",
				after: {
					contentText: " ✅ Completed",
					color: "rgba(46, 160, 67, 1)",
					fontWeight: "bold",
					margin: "0 0 0 8px",
				},
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Create error state decoration
	 */
	static createErrorState(): vscode.TextEditorDecorationType {
		const key = "errorState"

		if (!this.decorationTypes.has(key)) {
			const decorationType = vscode.window.createTextEditorDecorationType({
				backgroundColor: "rgba(203, 36, 49, 0.1)",
				isWholeLine: true,
				border: "none none none 4px solid rgba(203, 36, 49, 1)",
				after: {
					contentText: " ❌ Error",
					color: "rgba(203, 36, 49, 1)",
					fontWeight: "bold",
					margin: "0 0 0 8px",
				},
			})
			this.decorationTypes.set(key, decorationType)
		}

		return this.decorationTypes.get(key)!
	}

	/**
	 * Animate a decoration with fade-in effect
	 */
	static animateFadeIn(
		editor: vscode.TextEditor,
		decoration: vscode.TextEditorDecorationType,
		ranges: vscode.Range[],
		duration: number = 300,
	): void {
		// Apply decoration immediately with low opacity
		editor.setDecorations(decoration, ranges)

		// Could implement actual animation via multiple decoration updates
		// For now, just apply the final state after a delay
		const timerId = setTimeout(() => {
			editor.setDecorations(decoration, ranges)
		}, duration)

		this.animationTimers.set(`fadeIn-${Date.now()}`, timerId)
	}

	/**
	 * Animate a decoration with typewriter effect
	 */
	static animateTypewriter(
		editor: vscode.TextEditor,
		decoration: vscode.TextEditorDecorationType,
		targetRange: vscode.Range,
		onComplete?: () => void,
	): void {
		const steps = 10
		const stepDuration = 50
		let currentStep = 0

		const animate = () => {
			if (currentStep <= steps) {
				const progress = currentStep / steps
				const endChar = Math.floor(targetRange.end.character * progress)
				const currentRange = new vscode.Range(
					targetRange.start,
					new vscode.Position(targetRange.end.line, endChar),
				)

				editor.setDecorations(decoration, [currentRange])
				currentStep++

				const timerId = setTimeout(animate, stepDuration)
				this.animationTimers.set(`typewriter-${currentStep}`, timerId)
			} else {
				onComplete?.()
			}
		}

		animate()
	}

	/**
	 * Create streaming decorations bundle
	 */
	static createStreamingBundle(): {
		fadedOverlay: vscode.TextEditorDecorationType
		activeLine: vscode.TextEditorDecorationType
		typewriterCursor: vscode.TextEditorDecorationType
		progressLine: vscode.TextEditorDecorationType
		completion: vscode.TextEditorDecorationType
	} {
		return {
			fadedOverlay: this.createAnimatedFadedOverlay(),
			activeLine: this.createPulsingActiveLine(),
			typewriterCursor: this.createTypewriterCursor(),
			progressLine: this.createProgressLine(),
			completion: this.createSuccessCompletion(),
		}
	}

	/**
	 * Create diff decorations bundle
	 */
	static createDiffBundle(): {
		addition: vscode.TextEditorDecorationType
		deletion: vscode.TextEditorDecorationType
		modification: vscode.TextEditorDecorationType
		loading: vscode.TextEditorDecorationType
		error: vscode.TextEditorDecorationType
	} {
		return {
			addition: this.createDiffAddition(),
			deletion: this.createDiffDeletion(),
			modification: this.createDiffModification(),
			loading: this.createLoadingSpinner(),
			error: this.createErrorState(),
		}
	}

	/**
	 * Clear all animation timers
	 */
	static clearAnimations(): void {
		for (const [key, timer] of this.animationTimers) {
			clearTimeout(timer)
		}
		this.animationTimers.clear()
	}

	/**
	 * Dispose all decorations and clear animations
	 */
	static disposeAll(): void {
		this.clearAnimations()

		for (const [key, decorationType] of this.decorationTypes) {
			decorationType.dispose()
		}
		this.decorationTypes.clear()
	}

	/**
	 * Get decoration by key
	 */
	static getDecoration(key: string): vscode.TextEditorDecorationType | undefined {
		return this.decorationTypes.get(key)
	}

	/**
	 * Check if decoration exists
	 */
	static hasDecoration(key: string): boolean {
		return this.decorationTypes.has(key)
	}
}
