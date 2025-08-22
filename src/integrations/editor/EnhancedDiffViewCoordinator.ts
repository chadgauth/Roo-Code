import * as vscode from "vscode"
import { DiffViewCoordinator } from "./DiffViewCoordinator"
import { EnhancedStreamingUpdater } from "./components/EnhancedStreamingUpdater"
import { EnhancedDiffViewManager } from "./components/EnhancedDiffViewManager"
import { AnimationConfig } from "./components/AnimationConfig"
import { AnimatedDecorationFactory } from "./components/AnimatedDecorationFactory"
import { Task } from "../../core/task/Task"

/**
 * Enhanced diff view coordinator with smooth animations and polished UI.
 * Uses composition to add enhanced features while maintaining full compatibility.
 */
export class EnhancedDiffViewCoordinator {
	private baseCoordinator: DiffViewCoordinator
	private enhancedStreamingUpdater: EnhancedStreamingUpdater
	private enhancedDiffViewManager: EnhancedDiffViewManager
	private animationSettings: any

	constructor(cwd: string, task: Task) {
		// Initialize base coordinator for full compatibility
		this.baseCoordinator = new DiffViewCoordinator(cwd, task)

		// Initialize enhanced components
		this.enhancedStreamingUpdater = new EnhancedStreamingUpdater()
		this.enhancedDiffViewManager = new EnhancedDiffViewManager()

		// Load animation settings
		this.animationSettings = AnimationConfig.loadSettings()

		// Apply system preferences
		AnimationConfig.applySystemPreferences()
	}

	// Delegate all base functionality to maintain compatibility
	get newProblemsMessage() {
		return this.baseCoordinator.newProblemsMessage
	}
	get userEdits() {
		return this.baseCoordinator.userEdits
	}
	get editType() {
		return this.baseCoordinator.editType
	}
	set editType(value) {
		this.baseCoordinator.editType = value
	}
	get isEditing() {
		return this.baseCoordinator.isEditing
	}
	get originalContent() {
		return this.baseCoordinator.originalContent
	}
	set originalContent(value) {
		this.baseCoordinator.originalContent = value
	}
	get relPath() {
		return (this.baseCoordinator as any).relPath
	}
	set relPath(value) {
		;(this.baseCoordinator as any).relPath = value
	}
	get newContent() {
		return (this.baseCoordinator as any).newContent
	}
	set newContent(value) {
		;(this.baseCoordinator as any).newContent = value
	}
	get activeDiffEditor() {
		return (this.baseCoordinator as any).activeDiffEditor
	}
	set activeDiffEditor(value) {
		;(this.baseCoordinator as any).activeDiffEditor = value
	}
	get activeLineController() {
		return (this.baseCoordinator as any).activeLineController
	}
	set activeLineController(value) {
		;(this.baseCoordinator as any).activeLineController = value
	}
	get fadedOverlayController() {
		return (this.baseCoordinator as any).fadedOverlayController
	}
	set fadedOverlayController(value) {
		;(this.baseCoordinator as any).fadedOverlayController = value
	}

	async open(relPath: string): Promise<void> {
		return this.baseCoordinator.open(relPath)
	}

	async saveChanges(diagnosticsEnabled?: boolean, writeDelayMs?: number) {
		return this.baseCoordinator.saveChanges(diagnosticsEnabled, writeDelayMs)
	}

	async pushToolWriteResult(task: Task, cwd: string, isNewFile: boolean): Promise<string> {
		return this.baseCoordinator.pushToolWriteResult(task, cwd, isNewFile)
	}

	async revertChanges(): Promise<void> {
		return this.baseCoordinator.revertChanges()
	}

	async reset(): Promise<void> {
		return this.baseCoordinator.reset()
	}

	async saveDirectly(
		relPath: string,
		content: string,
		openFile?: boolean,
		diagnosticsEnabled?: boolean,
		writeDelayMs?: number,
	) {
		return this.baseCoordinator.saveDirectly(relPath, content, openFile, diagnosticsEnabled, writeDelayMs)
	}

	scrollToFirstDiff(): void {
		return this.baseCoordinator.scrollToFirstDiff()
	}

	getComponents() {
		return this.baseCoordinator.getComponents()
	}

	getState() {
		return this.baseCoordinator.getState()
	}

	/**
	 * Close all diff views - delegate to base coordinator
	 */
	async closeAllDiffViews(): Promise<void> {
		return (this.baseCoordinator as any).closeAllDiffViews()
	}

	/**
	 * Enhanced update method with animations
	 */
	async update(accumulatedContent: string, isFinal: boolean): Promise<void> {
		// Get the current active editor from base coordinator
		const state = this.baseCoordinator.getState()

		if (AnimationConfig.isEnabled() && state.hasActiveDiffEditor) {
			// We need to access the editor somehow - let's enhance the base coordinator's update
			// For now, just use the base implementation
			await this.baseCoordinator.update(accumulatedContent, isFinal)
		} else {
			// Use base implementation
			await this.baseCoordinator.update(accumulatedContent, isFinal)
		}
	}

	/**
	 * Enhanced navigation with smooth scrolling
	 */
	async navigateToChange(direction: "next" | "previous"): Promise<void> {
		const activeEditor = vscode.window.activeTextEditor

		if (activeEditor && AnimationConfig.isEffectEnabled("smoothScrolling")) {
			const currentLine = activeEditor.selection.active.line

			if (direction === "next") {
				await this.enhancedDiffViewManager.navigateToNextChange(activeEditor, currentLine)
			} else {
				await this.enhancedDiffViewManager.navigateToPreviousChange(activeEditor, currentLine)
			}
		} else {
			// Basic navigation fallback
			if (activeEditor) {
				const currentLine = activeEditor.selection.active.line
				const targetLine = direction === "next" ? currentLine + 1 : currentLine - 1
				const position = new vscode.Position(Math.max(0, targetLine), 0)
				activeEditor.selection = new vscode.Selection(position, position)
				activeEditor.revealRange(new vscode.Range(position, position))
			}
		}
	}

	/**
	 * Toggle animation settings
	 */
	async toggleAnimations(): Promise<void> {
		const currentSettings = AnimationConfig.getSettings()
		AnimationConfig.updateSettings({ enabled: !currentSettings.enabled })
		await AnimationConfig.saveSettings()

		// Show status message
		const status = currentSettings.enabled ? "disabled" : "enabled"
		vscode.window.showInformationMessage(`Diff animations ${status}`)
	}

	/**
	 * Set animation speed
	 */
	async setAnimationSpeed(speed: "slow" | "normal" | "fast" | "instant"): Promise<void> {
		AnimationConfig.updateSettings({ speed })
		await AnimationConfig.saveSettings()

		vscode.window.showInformationMessage(`Animation speed set to ${speed}`)
	}

	/**
	 * Open animation settings
	 */
	async openAnimationSettings(): Promise<void> {
		await vscode.commands.executeCommand("workbench.action.openSettings", "roo-code.diff.animations")
	}

	/**
	 * Get enhanced features status
	 */
	getEnhancedStatus(): {
		animationsEnabled: boolean
		streamingActive: boolean
		effects: string[]
		performance: string
	} {
		const settings = AnimationConfig.getSettings()
		const activeEffects = Object.entries(settings.effects)
			.filter(([_, enabled]) => enabled)
			.map(([effect, _]) => effect)

		return {
			animationsEnabled: settings.enabled,
			streamingActive: this.enhancedStreamingUpdater.isAnimating(),
			effects: activeEffects,
			performance: settings.speed,
		}
	}

	/**
	 * Enhanced cleanup with animation disposal
	 */
	async cleanup(): Promise<void> {
		// Clean up enhanced components
		const activeEditor = vscode.window.activeTextEditor
		if (activeEditor) {
			this.enhancedStreamingUpdater.clearAll(activeEditor)
			this.enhancedDiffViewManager.clearAllDecorations(activeEditor)
		}

		// Dispose enhanced resources
		this.enhancedStreamingUpdater.dispose()
		this.enhancedDiffViewManager.dispose()

		// Reset base coordinator
		await this.baseCoordinator.reset()
	}

	/**
	 * Dispose all resources including animations
	 */
	dispose(): void {
		this.enhancedStreamingUpdater.dispose()
		this.enhancedDiffViewManager.dispose()
		AnimatedDecorationFactory.disposeAll()
		// Base coordinator doesn't have dispose method, but reset will clean up
		this.baseCoordinator.reset()
	}
}
