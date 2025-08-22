import * as vscode from "vscode"
import { AnimatedDecorationFactory } from "./AnimatedDecorationFactory"
import { SmartAutoScroller } from "./SmartAutoScroller"
import { AnimationConfig } from "./AnimationConfig"

/**
 * Enhanced streaming content updater with smooth animations and visual feedback.
 * Provides typewriter effects, progress indicators, and smooth transitions.
 */
export class EnhancedStreamingUpdater {
	private streamedLines: string[] = []
	private decorations: {
		fadedOverlay?: vscode.TextEditorDecorationType
		activeLine?: vscode.TextEditorDecorationType
		typewriterCursor?: vscode.TextEditorDecorationType
		progressLine?: vscode.TextEditorDecorationType
		completion?: vscode.TextEditorDecorationType
	} = {}

	private animationState: {
		isAnimating: boolean
		currentLine: number
		typewriterPosition: number
		lastScrollUpdate: number
		contentSpeed: number
	} = {
		isAnimating: false,
		currentLine: 0,
		typewriterPosition: 0,
		lastScrollUpdate: 0,
		contentSpeed: 0,
	}

	private animationTimers: NodeJS.Timeout[] = []
	private animationFrameRequests: number[] = []
	private autoScroller: SmartAutoScroller | null = null
	private fadeInAnimations: Map<number, number> = new Map() // line -> animation frame ID

	constructor() {
		this.initializeDecorations()
		this.autoScroller = new SmartAutoScroller()
	}

	/**
	 * Initialize animated decorations with theme-aware colors
	 */
	private initializeDecorations(): void {
		const bundle = AnimatedDecorationFactory.createStreamingBundle()
		this.decorations = {
			fadedOverlay: bundle.fadedOverlay,
			activeLine: bundle.activeLine,
			typewriterCursor: bundle.typewriterCursor,
			progressLine: bundle.progressLine,
			completion: bundle.completion,
		}
	}

	/**
	 * Get theme-aware colors for animations
	 */
	private getThemeColors(): {
		addition: string
		modification: string
		deletion: string
		activeLine: string
		completed: string
		error: string
	} {
		const config = AnimationConfig.getSettings()
		return {
			addition: config.colors.addition,
			modification: config.colors.modification,
			deletion: config.colors.deletion,
			activeLine: config.colors.activeLine,
			completed: config.colors.completed,
			error: config.colors.error,
		}
	}

	/**
	 * Start streaming with smooth typewriter animation and auto-scroll
	 */
	async startStreaming(editor: vscode.TextEditor, originalContent?: string): Promise<void> {
		this.animationState.isAnimating = true
		this.animationState.currentLine = 0
		this.animationState.typewriterPosition = 0
		this.animationState.lastScrollUpdate = Date.now()
		this.animationState.contentSpeed = 0

		// Initialize smart auto-scrolling
		if (this.autoScroller && AnimationConfig.getSettings().autoScroll.enabled) {
			// Auto-scroll will be started when content updates occur
		}

		// Apply initial faded overlay to all content
		if (this.decorations.fadedOverlay && originalContent) {
			const lines = originalContent.split("\n")
			const ranges = lines.map((_, index) => new vscode.Range(index, 0, index, Number.MAX_SAFE_INTEGER))
			editor.setDecorations(this.decorations.fadedOverlay, ranges)
		}

		// Show visual indicator that streaming is starting
		await this.showStartIndicator(editor)
	}

	/**
	 * Update streaming content with typewriter effect
	 */
	async updateStreamingContent(
		editor: vscode.TextEditor,
		accumulatedContent: string,
		isFinal: boolean,
		originalContent?: string,
	): Promise<void> {
		const document = editor.document
		const newLines = accumulatedContent.split("\n")

		// Handle incremental content updates with smooth transitions
		if (!isFinal) {
			await this.animateTypewriterEffect(editor, newLines)
		} else {
			await this.finalizeFinalContent(editor, accumulatedContent, originalContent)
		}

		// Update tracked lines
		this.streamedLines = newLines
	}

	/**
	 * Animate typewriter effect for incremental updates with intelligent auto-scroll
	 */
	private async animateTypewriterEffect(editor: vscode.TextEditor, newLines: string[]): Promise<void> {
		if (!this.decorations.typewriterCursor) return

		// Calculate content speed for adaptive scrolling
		const now = Date.now()
		const timeDelta = now - this.animationState.lastScrollUpdate
		const newLinesCount = newLines.length - this.streamedLines.length
		this.animationState.contentSpeed = (newLinesCount / Math.max(timeDelta, 1)) * 1000 // lines per second
		this.animationState.lastScrollUpdate = now

		// Notify auto-scroller of content updates
		if (this.autoScroller) {
			this.autoScroller.onContentUpdate()
		}

		// Clear previous typewriter cursor
		editor.setDecorations(this.decorations.typewriterCursor, [])

		// Animate new content line by line with high-performance fade-in
		for (let lineIndex = this.streamedLines.length; lineIndex < newLines.length; lineIndex++) {
			await this.animateLineTypingWithFadeIn(editor, lineIndex, newLines[lineIndex])

			// Update auto-scroll target to follow new content
			if (this.autoScroller) {
				this.autoScroller.updateTarget(lineIndex)
			}
		}

		// Update active line indicator with theme colors
		if (this.decorations.activeLine && newLines.length > 0) {
			const currentLineRange = new vscode.Range(
				newLines.length - 1,
				0,
				newLines.length - 1,
				Number.MAX_SAFE_INTEGER,
			)
			editor.setDecorations(this.decorations.activeLine, [currentLineRange])
		}

		// Update overlay to show remaining faded content
		await this.updateFadedOverlay(editor, newLines.length)
	}

	/**
	 * Animate typing effect for a single line with fade-in animation
	 */
	private async animateLineTypingWithFadeIn(
		editor: vscode.TextEditor,
		lineIndex: number,
		lineContent: string,
	): Promise<void> {
		return new Promise((resolve) => {
			if (!this.decorations.typewriterCursor) {
				resolve()
				return
			}

			const config = AnimationConfig.getSettings()
			const themeColors = this.getThemeColors()

			// Adaptive typing speed based on content velocity
			let typingSpeed = config.timing.typewriterSpeed
			if (this.animationState.contentSpeed > 5) {
				// More than 5 lines per second
				typingSpeed = Math.max(typingSpeed * 2, 60) // Slow down for readability
			}

			let charIndex = 0
			let fadeAnimationId: number | null = null

			const typeNextChar = () => {
				if (charIndex <= lineContent.length) {
					// Apply content up to current position using requestAnimationFrame
					const animationFrame = requestAnimationFrame(async () => {
						const edit = new vscode.WorkspaceEdit()
						const range = new vscode.Range(lineIndex, 0, lineIndex, Number.MAX_SAFE_INTEGER)
						const partialContent = lineContent.substring(0, charIndex)

						edit.replace(editor.document.uri, range, partialContent)
						await vscode.workspace.applyEdit(edit)

						// Add fade-in effect for new characters
						if (charIndex > 0) {
							this.addLineFadeInEffect(editor, lineIndex, themeColors.addition)
						}

						// Show typewriter cursor at current position
						if (charIndex < lineContent.length && this.decorations.typewriterCursor) {
							const cursorRange = new vscode.Range(lineIndex, charIndex, lineIndex, charIndex)
							editor.setDecorations(this.decorations.typewriterCursor, [cursorRange])
						}
					})

					this.animationFrameRequests.push(animationFrame)
					charIndex++

					if (charIndex <= lineContent.length) {
						const timer = setTimeout(typeNextChar, typingSpeed)
						this.animationTimers.push(timer)
					} else {
						// Clear cursor and resolve
						if (this.decorations.typewriterCursor) {
							editor.setDecorations(this.decorations.typewriterCursor, [])
						}
						resolve()
					}
				}
			}

			typeNextChar()
		})
	}

	/**
	 * Add high-performance fade-in effect for a line using requestAnimationFrame
	 */
	private addLineFadeInEffect(editor: vscode.TextEditor, lineIndex: number, color: string): void {
		// Cancel any existing fade animation for this line
		const existingId = this.fadeInAnimations.get(lineIndex)
		if (existingId) {
			cancelAnimationFrame(existingId)
		}

		const startTime = performance.now()
		const duration = AnimationConfig.getSettings().timing.fadeInDuration

		const animate = (currentTime: number) => {
			const elapsed = currentTime - startTime
			const progress = Math.min(elapsed / duration, 1)

			// Smooth easing function
			const easedProgress = 1 - Math.pow(1 - progress, 3) // Cubic ease-out
			const opacity = easedProgress

			// Create dynamic decoration with current opacity
			const fadeDecoration = vscode.window.createTextEditorDecorationType({
				backgroundColor: color,
				opacity: opacity.toString(),
			})

			const range = new vscode.Range(lineIndex, 0, lineIndex, Number.MAX_SAFE_INTEGER)
			editor.setDecorations(fadeDecoration, [range])

			if (progress < 1) {
				// Continue animation
				const frameId = requestAnimationFrame(animate)
				this.fadeInAnimations.set(lineIndex, frameId)
			} else {
				// Animation complete, clean up
				this.fadeInAnimations.delete(lineIndex)
				setTimeout(() => {
					fadeDecoration.dispose()
				}, 500) // Keep visible briefly before cleanup
			}
		}

		const frameId = requestAnimationFrame(animate)
		this.fadeInAnimations.set(lineIndex, frameId)
	}

	/**
	 * Update faded overlay to show remaining content
	 */
	private async updateFadedOverlay(editor: vscode.TextEditor, completedLines: number): Promise<void> {
		if (!this.decorations.fadedOverlay) return

		const totalLines = editor.document.lineCount

		if (completedLines < totalLines) {
			const fadedRanges = []
			for (let i = completedLines; i < totalLines; i++) {
				fadedRanges.push(new vscode.Range(i, 0, i, Number.MAX_SAFE_INTEGER))
			}
			editor.setDecorations(this.decorations.fadedOverlay, fadedRanges)
		} else {
			editor.setDecorations(this.decorations.fadedOverlay, [])
		}
	}

	/**
	 * Finalize content with completion animation
	 */
	private async finalizeFinalContent(
		editor: vscode.TextEditor,
		accumulatedContent: string,
		originalContent?: string,
	): Promise<void> {
		const document = editor.document

		// Clear all streaming decorations
		this.clearStreamingDecorations(editor)

		// Apply final content with smooth transition
		const finalEdit = new vscode.WorkspaceEdit()

		// Preserve newline structure from original
		let finalContent = accumulatedContent
		const hasEmptyLastLine = originalContent?.endsWith("\n")
		if (hasEmptyLastLine && !accumulatedContent.endsWith("\n")) {
			finalContent += "\n"
		}

		// Replace entire document content
		const fullRange = new vscode.Range(0, 0, document.lineCount, 0)
		finalEdit.replace(document.uri, fullRange, finalContent)
		await vscode.workspace.applyEdit(finalEdit)

		// Show completion animation
		await this.showCompletionAnimation(editor)

		// Reset animation state
		this.animationState.isAnimating = false
	}

	/**
	 * Show visual indicator that streaming is starting
	 */
	private async showStartIndicator(editor: vscode.TextEditor): Promise<void> {
		// Could add a subtle pulse or glow effect here
		// For now, just set initial active line
		if (this.decorations.activeLine) {
			const range = new vscode.Range(0, 0, 0, Number.MAX_SAFE_INTEGER)
			editor.setDecorations(this.decorations.activeLine, [range])
		}
	}

	/**
	 * Show completion animation with success indicator
	 */
	private async showCompletionAnimation(editor: vscode.TextEditor): Promise<void> {
		if (!this.decorations.completion) return

		// Flash completion decoration briefly
		const lastLineIndex = Math.max(0, editor.document.lineCount - 1)
		const completionRange = new vscode.Range(lastLineIndex, 0, lastLineIndex, Number.MAX_SAFE_INTEGER)

		editor.setDecorations(this.decorations.completion, [completionRange])

		// Clear after 2 seconds
		const timer = setTimeout(() => {
			if (this.decorations.completion) {
				editor.setDecorations(this.decorations.completion, [])
			}
		}, 2000)
		this.animationTimers.push(timer)
	}

	/**
	 * Clear all streaming decorations
	 */
	private clearStreamingDecorations(editor: vscode.TextEditor): void {
		Object.values(this.decorations).forEach((decoration) => {
			if (decoration) {
				editor.setDecorations(decoration, [])
			}
		})
	}

	/**
	 * Clear all decorations and reset state
	 */
	clearAll(editor?: vscode.TextEditor): void {
		// Stop auto-scrolling by disposing the auto-scroller
		if (this.autoScroller) {
			this.autoScroller.dispose()
			this.autoScroller = new SmartAutoScroller()
		}

		// Clear all timers
		this.animationTimers.forEach((timer) => clearTimeout(timer))
		this.animationTimers = []

		// Cancel all animation frames
		this.animationFrameRequests.forEach((frameId) => cancelAnimationFrame(frameId))
		this.animationFrameRequests = []

		// Cancel all fade-in animations
		this.fadeInAnimations.forEach((frameId) => cancelAnimationFrame(frameId))
		this.fadeInAnimations.clear()

		// Clear decorations
		if (editor) {
			this.clearStreamingDecorations(editor)
		}

		// Reset state
		this.streamedLines = []
		this.animationState = {
			isAnimating: false,
			currentLine: 0,
			typewriterPosition: 0,
			lastScrollUpdate: 0,
			contentSpeed: 0,
		}
	}

	/**
	 * Check if currently animating
	 */
	isAnimating(): boolean {
		return this.animationState.isAnimating
	}

	/**
	 * Get current streaming statistics
	 */
	getStreamingStats(): {
		totalLines: number
		currentLine: number
		isAnimating: boolean
		hasContent: boolean
	} {
		return {
			totalLines: this.streamedLines.length,
			currentLine: this.animationState.currentLine,
			isAnimating: this.animationState.isAnimating,
			hasContent: this.streamedLines.length > 0,
		}
	}

	/**
	 * Enable or disable auto-scroll
	 */
	setAutoScrollEnabled(enabled: boolean): void {
		if (this.autoScroller) {
			if (enabled) {
				// Auto-scroll will be started when streaming begins
			} else {
				// Reset auto-scroller to stop scrolling
				this.autoScroller.dispose()
				this.autoScroller = new SmartAutoScroller()
			}
		}
	}

	/**
	 * Check if auto-scroll is currently active
	 */
	isAutoScrollActive(): boolean {
		// Check if auto-scroller exists and animation is active
		return this.autoScroller !== null && this.animationState.isAnimating
	}

	/**
	 * Get auto-scroll statistics
	 */
	getAutoScrollStats(): {
		isActive: boolean
		currentLine: number
		contentSpeed: number
		isAnimating: boolean
	} {
		return {
			isActive: this.isAutoScrollActive(),
			currentLine: this.animationState.currentLine,
			contentSpeed: this.animationState.contentSpeed,
			isAnimating: this.animationState.isAnimating,
		}
	}

	/**
	 * Dispose resources
	 */
	dispose(): void {
		this.clearAll()
		if (this.autoScroller) {
			this.autoScroller.dispose()
			this.autoScroller = null
		}
		AnimatedDecorationFactory.clearAnimations()
	}
}
