import * as vscode from "vscode"
import { AnimationConfig } from "./AnimationConfig"

export interface ScrollState {
	isAutoScrolling: boolean
	isUserScrolling: boolean
	userScrollTimeout?: NodeJS.Timeout
	lastUserScrollTime: number
	currentLine: number
	targetLine: number
	animationFrame?: number
}

export interface LineAnimationState {
	line: number
	type: "addition" | "deletion" | "modification" | "existing"
	fadeProgress: number
	animationFrame?: number
	isVisible: boolean
}

/**
 * Advanced auto-scrolling system with intelligent user interaction detection
 * and smooth, performant line-by-line animations using requestAnimationFrame
 */
export class SmartAutoScroller {
	private scrollState: ScrollState = {
		isAutoScrolling: false,
		isUserScrolling: false,
		lastUserScrollTime: 0,
		currentLine: 0,
		targetLine: 0,
	}

	private lineAnimations = new Map<number, LineAnimationState>()
	private editor?: vscode.TextEditor
	private disposables: vscode.Disposable[] = []
	private lastContentLength = 0
	private additionQueue: number[] = []
	private processingQueue = false

	constructor(editor?: vscode.TextEditor) {
		this.editor = editor
		this.setupScrollListeners()
	}

	/**
	 * Set up intelligent scroll detection
	 */
	private setupScrollListeners(): void {
		try {
			// Check if VSCode APIs are available (not in test environment)
			if (!vscode.window?.onDidChangeTextEditorSelection || !vscode.window?.onDidChangeTextEditorVisibleRanges) {
				return
			}

			// Listen for editor selection changes (includes scroll events)
			const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection((event) => {
				if (this.editor && event.textEditor === this.editor) {
					this.detectUserScroll(event)
				}
			})

			// Listen for visible range changes (scroll events)
			const visibleRangeListener = vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
				if (this.editor && event.textEditor === this.editor) {
					this.handleVisibleRangeChange(event)
				}
			})

			this.disposables.push(selectionChangeListener, visibleRangeListener)
		} catch (error) {
			// Silently fail in test environments
			console.warn("Failed to setup scroll listeners:", error)
		}
	}

	/**
	 * Detect if user is manually scrolling
	 */
	private detectUserScroll(event: vscode.TextEditorSelectionChangeEvent): void {
		const now = Date.now()
		const settings = AnimationConfig.getSettings()

		// If auto-scrolling is active and user makes a selection change, it might be manual scroll
		if (this.scrollState.isAutoScrolling && event.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
			this.onUserScroll(now)
		}
	}

	/**
	 * Handle visible range changes for scroll detection
	 */
	private handleVisibleRangeChange(event: vscode.TextEditorVisibleRangesChangeEvent): void {
		const now = Date.now()
		const timeSinceLastScroll = now - this.scrollState.lastUserScrollTime

		// If auto-scrolling is active and visible range changed recently, likely user scroll
		if (this.scrollState.isAutoScrolling && timeSinceLastScroll < 100) {
			this.onUserScroll(now)
		}
	}

	/**
	 * Handle user scroll detection
	 */
	private onUserScroll(timestamp: number): void {
		const settings = AnimationConfig.getSettings()

		if (!settings.autoScroll.disableOnUserScroll) {
			return
		}

		this.scrollState.isUserScrolling = true
		this.scrollState.lastUserScrollTime = timestamp
		this.pauseAutoScroll()

		// Clear existing timeout
		if (this.scrollState.userScrollTimeout) {
			clearTimeout(this.scrollState.userScrollTimeout)
		}

		// Resume after delay
		this.scrollState.userScrollTimeout = setTimeout(() => {
			this.scrollState.isUserScrolling = false
			this.resumeAutoScroll()
		}, settings.autoScroll.resumeAfterDelay)
	}

	/**
	 * Start auto-scrolling when new content is being added
	 */
	public startAutoScroll(targetLine: number): void {
		const settings = AnimationConfig.getSettings()

		if (!settings.autoScroll.enabled || this.scrollState.isUserScrolling) {
			return
		}

		this.scrollState.isAutoScrolling = true
		this.scrollState.targetLine = targetLine
		this.scrollToLineSmooth(targetLine)
	}

	/**
	 * Smooth scroll to target line using requestAnimationFrame
	 */
	private scrollToLineSmooth(targetLine: number): void {
		if (!this.editor || this.scrollState.isUserScrolling) {
			return
		}

		const settings = AnimationConfig.getSettings()
		const currentVisibleRange = this.editor.visibleRanges[0]
		const currentMiddleLine = Math.floor((currentVisibleRange.start.line + currentVisibleRange.end.line) / 2)

		const distance = Math.abs(targetLine - currentMiddleLine)
		const maxSpeed = settings.autoScroll.maxSpeed

		// Adaptive speed - slow down for large jumps or fast content generation
		let speed = maxSpeed
		if (settings.autoScroll.adaptiveSpeed) {
			if (distance > 20) {
				speed = Math.max(maxSpeed * 0.3, 2) // Slow down for large jumps
			} else if (this.additionQueue.length > 10) {
				speed = Math.max(maxSpeed * 0.5, 3) // Slow down if content is being added quickly
			}
		}

		const step = Math.max(1, Math.ceil(distance / (speed * 0.016))) // 60fps = 16ms per frame

		if (this.scrollState.animationFrame) {
			cancelAnimationFrame(this.scrollState.animationFrame)
		}

		const animate = () => {
			if (!this.editor || this.scrollState.isUserScrolling || !this.scrollState.isAutoScrolling) {
				return
			}

			const currentRange = this.editor.visibleRanges[0]
			const currentMiddle = Math.floor((currentRange.start.line + currentRange.end.line) / 2)

			if (Math.abs(currentMiddle - targetLine) <= 1) {
				// Close enough, stop animation
				return
			}

			// Calculate next position
			const direction = targetLine > currentMiddle ? 1 : -1
			const nextLine = Math.min(Math.max(0, currentMiddle + step * direction), this.editor.document.lineCount - 1)

			// Smooth scroll to next position
			const range = new vscode.Range(nextLine, 0, nextLine, 0)
			this.editor.revealRange(range, vscode.TextEditorRevealType.InCenter)

			this.scrollState.animationFrame = requestAnimationFrame(animate)
		}

		this.scrollState.animationFrame = requestAnimationFrame(animate)
	}

	/**
	 * Add new lines with fade-in animation
	 */
	public animateNewLines(startLine: number, endLine: number, type: "addition" | "modification" = "addition"): void {
		for (let line = startLine; line <= endLine; line++) {
			this.additionQueue.push(line)
			this.lineAnimations.set(line, {
				line,
				type,
				fadeProgress: 0,
				isVisible: false,
			})
		}

		this.processAnimationQueue()

		// Start auto-scroll to follow new content
		if (AnimationConfig.getSettings().autoScroll.enabled) {
			this.startAutoScroll(endLine)
		}
	}

	/**
	 * Process line animation queue with staggered timing
	 */
	private async processAnimationQueue(): Promise<void> {
		if (this.processingQueue || this.additionQueue.length === 0) {
			return
		}

		this.processingQueue = true
		const settings = AnimationConfig.getSettings()
		const staggerDelay = settings.timing.staggerDelay

		while (this.additionQueue.length > 0) {
			const line = this.additionQueue.shift()!
			this.animateFadeIn(line)

			// Stagger animations for smooth effect
			if (staggerDelay > 0 && this.additionQueue.length > 0) {
				await new Promise((resolve) => setTimeout(resolve, staggerDelay))
			}
		}

		this.processingQueue = false
	}

	/**
	 * Animate individual line fade-in using requestAnimationFrame
	 */
	private animateFadeIn(line: number): void {
		const lineState = this.lineAnimations.get(line)
		if (!lineState || !this.editor) {
			return
		}

		const settings = AnimationConfig.getSettings()
		const duration = settings.timing.fadeInDuration
		const startTime = performance.now()

		const animate = (currentTime: number) => {
			const elapsed = currentTime - startTime
			const progress = Math.min(elapsed / duration, 1)

			// Smooth easing function (ease-out)
			const easedProgress = 1 - Math.pow(1 - progress, 3)

			lineState.fadeProgress = easedProgress
			lineState.isVisible = progress > 0.1

			// Apply decoration with fade effect
			this.applyLineDecoration(line, lineState)

			if (progress < 1) {
				lineState.animationFrame = requestAnimationFrame(animate)
			} else {
				// Animation complete
				this.lineAnimations.delete(line)
			}
		}

		lineState.animationFrame = requestAnimationFrame(animate)
	}

	/**
	 * Apply VS Code decoration with theme-aware colors and fade effect
	 */
	private applyLineDecoration(line: number, state: LineAnimationState): void {
		if (!this.editor) {
			return
		}

		const settings = AnimationConfig.getSettings()
		const themeColors = AnimationConfig.getThemeColors()

		// Get appropriate color for animation type
		let baseColor: string
		switch (state.type) {
			case "addition":
				baseColor = themeColors.addition
				break
			case "modification":
				baseColor = themeColors.modification
				break
			case "deletion":
				baseColor = themeColors.deletion
				break
			default:
				baseColor = themeColors.addition
		}

		// Apply fade opacity
		const opacity = state.fadeProgress
		const fadedColor = baseColor.replace(/[\d\.]+\)$/, `${opacity * 0.3})`)

		const decorationType = vscode.window.createTextEditorDecorationType({
			backgroundColor: fadedColor,
			isWholeLine: true,
			opacity: `${opacity}`,
		})

		const range = new vscode.Range(line, 0, line, this.editor.document.lineAt(line).text.length)
		this.editor.setDecorations(decorationType, [range])

		// Clean up decoration after a delay
		setTimeout(() => {
			decorationType.dispose()
		}, settings.timing.completionDisplayTime)
	}

	/**
	 * Handle content updates and detect new lines
	 */
	public onContentUpdate(): void {
		if (!this.editor) {
			return
		}

		const currentLength = this.editor.document.lineCount
		const previousLength = this.lastContentLength

		if (currentLength > previousLength) {
			// New lines added
			const newLines = currentLength - previousLength
			const startLine = previousLength
			const endLine = currentLength - 1

			this.animateNewLines(startLine, endLine, "addition")
		}

		this.lastContentLength = currentLength
	}

	/**
	 * Pause auto-scroll
	 */
	private pauseAutoScroll(): void {
		this.scrollState.isAutoScrolling = false
		if (this.scrollState.animationFrame) {
			cancelAnimationFrame(this.scrollState.animationFrame)
			this.scrollState.animationFrame = undefined
		}
	}

	/**
	 * Resume auto-scroll
	 */
	private resumeAutoScroll(): void {
		if (AnimationConfig.getSettings().autoScroll.enabled && this.scrollState.targetLine > 0) {
			this.scrollState.isAutoScrolling = true
			this.scrollToLineSmooth(this.scrollState.targetLine)
		}
	}

	/**
	 * Update target line for auto-scroll
	 */
	public updateTarget(line: number): void {
		this.scrollState.targetLine = line
		if (this.scrollState.isAutoScrolling && !this.scrollState.isUserScrolling) {
			this.scrollToLineSmooth(line)
		}
	}

	/**
	 * Clean up resources
	 */
	public dispose(): void {
		this.pauseAutoScroll()

		// Cancel all line animations
		for (const [line, state] of this.lineAnimations) {
			if (state.animationFrame) {
				cancelAnimationFrame(state.animationFrame)
			}
		}
		this.lineAnimations.clear()

		// Clear timeouts
		if (this.scrollState.userScrollTimeout) {
			clearTimeout(this.scrollState.userScrollTimeout)
		}

		// Dispose listeners
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
	}
}
