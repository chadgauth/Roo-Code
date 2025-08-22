import * as vscode from "vscode"
import { Task } from "../../core/task/Task"
import { DEFAULT_WRITE_DELAY_MS } from "@roo-code/types"
import { arePathsEqual } from "../../utils/path"

// Import all components
import { FileContentManager } from "./components/FileContentManager"
import { DiagnosticsManager } from "./components/DiagnosticsManager"
import { DiffViewManager, DIFF_VIEW_URI_SCHEME, DIFF_VIEW_LABEL_CHANGES } from "./components/DiffViewManager"
import { StreamingContentUpdater } from "./components/StreamingContentUpdater"
import { DirectFileSaver, DirectSaveOptions, DirectSaveResult } from "./components/DirectFileSaver"
import {
	DiffOperationHandler,
	SaveChangesOptions,
	SaveChangesResult,
	RevertChangesOptions,
} from "./components/DiffOperationHandler"
import { DecorationController } from "./DecorationController"
import { DecorationFactory } from "./components/DecorationFactory"

// Re-export constants for backward compatibility
export { DIFF_VIEW_URI_SCHEME, DIFF_VIEW_LABEL_CHANGES }

/**
 * Orchestrates all diff view components while maintaining backward compatibility.
 * This class maintains the exact same interface as the original DiffViewProvider
 * but delegates functionality to specialized components for better separation of concerns.
 */
export class DiffViewCoordinator {
	// Public properties to maintain compatibility
	newProblemsMessage?: string
	userEdits?: string
	editType?: "create" | "modify"
	isEditing = false
	originalContent: string | undefined

	// Private state
	private createdDirs: string[] = []
	private documentWasOpen = false
	private relPath?: string
	private newContent?: string
	private activeDiffEditor?: vscode.TextEditor
	private fadedOverlayController?: DecorationController
	private activeLineController?: DecorationController
	private taskRef: WeakRef<Task>

	// Components
	private fileContentManager: FileContentManager
	private diagnosticsManager: DiagnosticsManager
	private diffViewManager: DiffViewManager
	private streamingContentUpdater: StreamingContentUpdater
	private directFileSaver: DirectFileSaver
	private diffOperationHandler: DiffOperationHandler

	constructor(
		private cwd: string,
		task: Task,
	) {
		this.taskRef = new WeakRef(task)

		// Initialize components
		this.fileContentManager = new FileContentManager(cwd)
		this.diagnosticsManager = new DiagnosticsManager(new WeakRef(task))
		this.diffViewManager = new DiffViewManager()
		this.streamingContentUpdater = new StreamingContentUpdater()
		this.directFileSaver = new DirectFileSaver(this.fileContentManager, this.diagnosticsManager)
		this.diffOperationHandler = new DiffOperationHandler(this.fileContentManager, this.diagnosticsManager)
	}

	/**
	 * Open a diff view for the given file path
	 * Maintains exact compatibility with original DiffViewProvider.open()
	 */
	async open(relPath: string): Promise<void> {
		this.relPath = relPath
		const fileExists = this.editType === "modify"
		const absolutePath = this.fileContentManager.resolveAbsolutePath(relPath)
		this.isEditing = true

		// Handle existing open document
		if (fileExists) {
			const existingDocument = vscode.workspace.textDocuments.find((doc) =>
				arePathsEqual(doc.uri.fsPath, absolutePath),
			)

			if (existingDocument && existingDocument.isDirty) {
				await existingDocument.save()
			}
		}

		// Capture diagnostics before editing
		this.diagnosticsManager.captureDiagnostics()

		// Read original content
		if (fileExists) {
			this.originalContent = await this.fileContentManager.readFile(absolutePath)
		} else {
			this.originalContent = ""
		}

		// Create directories for new files
		this.createdDirs = await this.fileContentManager.createDirectoriesForFile(absolutePath)

		// Ensure file exists
		if (!fileExists) {
			await this.fileContentManager.createEmptyFile(absolutePath)
		}

		// Handle document closure if already open
		await this.handleExistingDocument(absolutePath)

		// Open diff editor
		this.activeDiffEditor = await this.diffViewManager.openDiffEditor(
			relPath,
			this.originalContent,
			this.cwd,
			this.editType!,
		)

		// Set up decorations
		this.setupDecorations()

		// Initialize streaming
		this.streamingContentUpdater.initializeDecorations(this.activeDiffEditor)
		this.diffViewManager.scrollEditorToLine(this.activeDiffEditor, 0)
	}

	/**
	 * Update content during streaming
	 * Maintains exact compatibility with original DiffViewProvider.update()
	 */
	async update(accumulatedContent: string, isFinal: boolean): Promise<void> {
		if (!this.relPath || !this.activeLineController || !this.fadedOverlayController) {
			throw new Error("Required values not set")
		}

		this.newContent = accumulatedContent

		if (!this.activeDiffEditor) {
			throw new Error("User closed text editor, unable to edit file...")
		}

		// Delegate to streaming content updater
		await this.streamingContentUpdater.updateStreamingContent(
			this.activeDiffEditor,
			accumulatedContent,
			isFinal,
			this.originalContent,
		)

		// Handle scrolling
		if (
			this.streamingContentUpdater.shouldScrollEditor(
				this.activeDiffEditor,
				accumulatedContent.split("\n").length,
			)
		) {
			this.diffViewManager.scrollEditorToLine(this.activeDiffEditor, accumulatedContent.split("\n").length)
		}
	}

	/**
	 * Save changes with diagnostics and user edit detection
	 * Maintains exact compatibility with original DiffViewProvider.saveChanges()
	 */
	async saveChanges(
		diagnosticsEnabled: boolean = true,
		writeDelayMs: number = DEFAULT_WRITE_DELAY_MS,
	): Promise<SaveChangesResult> {
		if (!this.relPath || !this.newContent || !this.activeDiffEditor) {
			return { newProblemsMessage: undefined, userEdits: undefined, finalContent: undefined }
		}

		// Close diff views first
		await this.diffViewManager.closeAllDiffViews()

		// Delegate to operation handler
		const result = await this.diffOperationHandler.saveChanges(
			this.activeDiffEditor,
			this.relPath,
			this.newContent,
			this.originalContent || "",
			this.editType!,
			{ diagnosticsEnabled, writeDelayMs },
		)

		// Store results for compatibility
		this.newProblemsMessage = result.newProblemsMessage
		this.userEdits = result.userEdits

		return result
	}

	/**
	 * Format and push tool write result
	 * Maintains exact compatibility with original DiffViewProvider.pushToolWriteResult()
	 */
	async pushToolWriteResult(task: Task, cwd: string, isNewFile: boolean): Promise<string> {
		if (!this.relPath) {
			throw new Error("No file path available in DiffViewCoordinator")
		}

		return this.diffOperationHandler.pushToolWriteResult(
			task,
			cwd,
			this.relPath,
			isNewFile,
			this.userEdits,
			this.newProblemsMessage,
		)
	}

	/**
	 * Revert changes in diff editor
	 * Maintains exact compatibility with original DiffViewProvider.revertChanges()
	 */
	async revertChanges(): Promise<void> {
		if (!this.relPath || !this.activeDiffEditor) {
			return
		}

		// Close diff views first
		await this.diffViewManager.closeAllDiffViews()

		// Delegate to operation handler
		await this.diffOperationHandler.revertChanges(
			this.activeDiffEditor,
			this.relPath,
			this.originalContent || "",
			this.editType!,
			this.createdDirs,
			{ cleanupDirectories: true },
		)

		// Reset state
		await this.reset()
	}

	/**
	 * Reset all state
	 * Maintains exact compatibility with original DiffViewProvider.reset()
	 */
	async reset(): Promise<void> {
		await this.diffViewManager.closeAllDiffViews()

		this.editType = undefined
		this.isEditing = false
		this.originalContent = undefined
		this.createdDirs = []
		this.documentWasOpen = false
		this.activeDiffEditor = undefined
		this.fadedOverlayController = undefined
		this.activeLineController = undefined
		this.newProblemsMessage = undefined
		this.userEdits = undefined
		this.relPath = undefined
		this.newContent = undefined

		this.streamingContentUpdater.reset()
	}

	/**
	 * Save content directly without diff view
	 * Maintains exact compatibility with original DiffViewProvider.saveDirectly()
	 */
	async saveDirectly(
		relPath: string,
		content: string,
		openFile: boolean = true,
		diagnosticsEnabled: boolean = true,
		writeDelayMs: number = DEFAULT_WRITE_DELAY_MS,
	): Promise<DirectSaveResult> {
		const options: DirectSaveOptions = {
			openFile,
			diagnosticsEnabled,
			writeDelayMs,
		}

		const result = await this.directFileSaver.saveDirectly(relPath, content, options)

		// Store results for compatibility
		this.newProblemsMessage = result.newProblemsMessage
		this.userEdits = result.userEdits
		this.relPath = relPath
		this.newContent = content

		return result
	}

	/**
	 * Scroll to first diff in the editor
	 * Maintains exact compatibility with original DiffViewProvider.scrollToFirstDiff()
	 */
	scrollToFirstDiff(): void {
		if (!this.activeDiffEditor || !this.originalContent) {
			return
		}

		this.diffViewManager.scrollToFirstDiff(this.activeDiffEditor, this.originalContent)
	}

	/**
	 * Handle existing document closure
	 */
	private async handleExistingDocument(absolutePath: string): Promise<void> {
		this.documentWasOpen = false

		const tabs = vscode.window.tabGroups.all
			.map((tg) => tg.tabs)
			.flat()
			.filter(
				(tab) => tab.input instanceof vscode.TabInputText && arePathsEqual(tab.input.uri.fsPath, absolutePath),
			)

		for (const tab of tabs) {
			if (!tab.isDirty) {
				await vscode.window.tabGroups.close(tab)
			}
			this.documentWasOpen = true
		}
	}

	/**
	 * Set up decoration controllers
	 */
	private setupDecorations(): void {
		if (!this.activeDiffEditor) return

		const decorations = DecorationFactory.createStreamingDecorations()

		this.fadedOverlayController = new DecorationController("fadedOverlay", this.activeDiffEditor)
		this.activeLineController = new DecorationController("activeLine", this.activeDiffEditor)

		// Configure streaming updater with decorations
		this.streamingContentUpdater.setDecorationControllers({
			fadedOverlay: this.fadedOverlayController,
			activeLine: this.activeLineController,
		})
	}

	/**
	 * Close all diff views - for backward compatibility with tests
	 */
	private async closeAllDiffViews(): Promise<void> {
		await this.diffViewManager.closeAllDiffViews()
	}

	/**
	 * Get component references (for advanced usage)
	 */
	getComponents() {
		return {
			fileContentManager: this.fileContentManager,
			diagnosticsManager: this.diagnosticsManager,
			diffViewManager: this.diffViewManager,
			streamingContentUpdater: this.streamingContentUpdater,
			directFileSaver: this.directFileSaver,
			diffOperationHandler: this.diffOperationHandler,
		}
	}

	/**
	 * Get current state for debugging
	 */
	getState() {
		return {
			isEditing: this.isEditing,
			editType: this.editType,
			relPath: this.relPath,
			hasOriginalContent: !!this.originalContent,
			hasNewContent: !!this.newContent,
			hasActiveDiffEditor: !!this.activeDiffEditor,
			createdDirsCount: this.createdDirs.length,
			streamingStats: this.streamingContentUpdater.getStreamingStats(),
		}
	}
}
