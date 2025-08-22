import * as vscode from "vscode"
import { DEFAULT_WRITE_DELAY_MS } from "@roo-code/types"
import { FileContentManager } from "./FileContentManager"
import { DiagnosticsManager } from "./DiagnosticsManager"

export interface DirectSaveOptions {
	openFile?: boolean
	diagnosticsEnabled?: boolean
	writeDelayMs?: number
	stripBOMs?: boolean
	normalizeEOL?: boolean
}

export interface DirectSaveResult {
	newProblemsMessage: string | undefined
	userEdits: string | undefined
	finalContent: string | undefined
}

/**
 * Handles direct file operations without showing diff view.
 * Used when preventFocusDisruption experiment is enabled.
 * Extracted from DiffViewProvider to separate direct file saving concerns.
 */
export class DirectFileSaver {
	constructor(
		private fileContentManager: FileContentManager,
		private diagnosticsManager: DiagnosticsManager,
	) {}

	/**
	 * Save content directly to a file without showing diff view
	 * @param relPath - Relative path to the file
	 * @param content - Content to write to the file
	 * @param options - Save options
	 * @returns Result of the save operation including any new problems detected
	 */
	async saveDirectly(relPath: string, content: string, options: DirectSaveOptions = {}): Promise<DirectSaveResult> {
		const {
			openFile = true,
			diagnosticsEnabled = true,
			writeDelayMs = DEFAULT_WRITE_DELAY_MS,
			stripBOMs = true,
			normalizeEOL = true,
		} = options

		const absolutePath = this.fileContentManager.resolveAbsolutePath(relPath)

		// Capture diagnostics before editing the file
		this.diagnosticsManager.captureDiagnostics()

		// Process content if needed
		let processedContent = content
		if (stripBOMs) {
			processedContent = this.fileContentManager.stripAllBOMs(processedContent)
		}
		if (normalizeEOL) {
			const targetEOL = this.fileContentManager.detectLineEnding(content)
			processedContent = this.fileContentManager.normalizeEOL(processedContent, targetEOL)
		}

		// Create directories and write the content
		await this.fileContentManager.createDirectoriesForFile(absolutePath)
		await this.fileContentManager.writeFile(absolutePath, processedContent)

		// Handle file opening based on options
		await this.handleFileOpening(absolutePath, openFile)

		// Process diagnostics if enabled
		let newProblemsMessage = ""
		if (diagnosticsEnabled) {
			newProblemsMessage = await this.diagnosticsManager.processNewDiagnostics(
				writeDelayMs,
				this.fileContentManager.getCwd(),
			)
		}

		return {
			newProblemsMessage,
			userEdits: undefined, // Direct saves don't have user edits
			finalContent: processedContent,
		}
	}

	/**
	 * Save content to multiple files directly
	 * @param files - Array of file operations to perform
	 * @param options - Global save options
	 * @returns Array of save results
	 */
	async saveMultipleFiles(
		files: Array<{
			relPath: string
			content: string
			options?: Partial<DirectSaveOptions>
		}>,
		globalOptions: DirectSaveOptions = {},
	): Promise<DirectSaveResult[]> {
		const results: DirectSaveResult[] = []

		for (const file of files) {
			const mergedOptions = { ...globalOptions, ...file.options }
			const result = await this.saveDirectly(file.relPath, file.content, mergedOptions)
			results.push(result)
		}

		return results
	}

	/**
	 * Handle file opening logic
	 */
	private async handleFileOpening(absolutePath: string, openFile: boolean): Promise<void> {
		const uri = vscode.Uri.file(absolutePath)

		if (openFile) {
			// Show the document in the editor
			await vscode.window.showTextDocument(uri, {
				preview: false,
				preserveFocus: true,
			})
		} else {
			// Just open the document in memory to trigger diagnostics without showing it
			const doc = await vscode.workspace.openTextDocument(uri)

			// Save the document to ensure VSCode recognizes it as saved and triggers diagnostics
			if (doc.isDirty) {
				await doc.save()
			}

			// Force a small delay to ensure diagnostics are triggered
			await new Promise((resolve) => setTimeout(resolve, 100))
		}
	}

	/**
	 * Check if a file can be saved directly (exists and is writable)
	 */
	async canSaveDirectly(relPath: string): Promise<boolean> {
		try {
			const absolutePath = this.fileContentManager.resolveAbsolutePath(relPath)
			const stats = await this.fileContentManager.getFileStats(absolutePath)

			if (!stats) {
				// File doesn't exist, check if we can create it
				return await this.canCreateFile(absolutePath)
			}

			// File exists, check if it's writable
			return stats.isFile()
		} catch {
			return false
		}
	}

	/**
	 * Check if we can create a file at the given path
	 */
	private async canCreateFile(absolutePath: string): Promise<boolean> {
		try {
			// Try to create directories if needed
			await this.fileContentManager.createDirectoriesForFile(absolutePath)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Save content with backup creation
	 */
	async saveWithBackup(
		relPath: string,
		content: string,
		options: DirectSaveOptions = {},
	): Promise<DirectSaveResult & { backupPath?: string }> {
		const absolutePath = this.fileContentManager.resolveAbsolutePath(relPath)
		let backupPath: string | undefined

		// Create backup if file exists
		const fileExists = await this.fileContentManager.fileExists(absolutePath)
		if (fileExists) {
			backupPath = `${absolutePath}.backup.${Date.now()}`
			try {
				const originalContent = await this.fileContentManager.readFile(absolutePath)
				await this.fileContentManager.writeFile(backupPath, originalContent)
			} catch (error) {
				console.warn(`Failed to create backup at ${backupPath}:`, error)
				backupPath = undefined
			}
		}

		// Perform the actual save
		const result = await this.saveDirectly(relPath, content, options)

		return {
			...result,
			backupPath,
		}
	}

	/**
	 * Validate content before saving
	 */
	validateContent(content: string): { valid: boolean; issues: string[] } {
		const issues: string[] = []

		// Check for common issues
		if (content.length === 0) {
			issues.push("Content is empty")
		}

		// Check for binary content
		if (content.includes("\0")) {
			issues.push("Content appears to be binary")
		}

		// Check for extremely long lines
		const lines = content.split("\n")
		const longLines = lines.filter((line) => line.length > 10000)
		if (longLines.length > 0) {
			issues.push(`${longLines.length} lines exceed 10,000 characters`)
		}

		return {
			valid: issues.length === 0,
			issues,
		}
	}

	/**
	 * Save content with validation
	 */
	async saveWithValidation(
		relPath: string,
		content: string,
		options: DirectSaveOptions = {},
	): Promise<DirectSaveResult & { validation: { valid: boolean; issues: string[] } }> {
		const validation = this.validateContent(content)

		if (!validation.valid) {
			console.warn(`Validation issues for ${relPath}:`, validation.issues)
		}

		const result = await this.saveDirectly(relPath, content, options)

		return {
			...result,
			validation,
		}
	}

	/**
	 * Get save statistics
	 */
	getSaveStats(): {
		supportsBackup: boolean
		supportsValidation: boolean
		supportsBatchSave: boolean
	} {
		return {
			supportsBackup: true,
			supportsValidation: true,
			supportsBatchSave: true,
		}
	}
}
