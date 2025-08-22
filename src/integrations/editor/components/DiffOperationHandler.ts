import * as vscode from "vscode"
import * as path from "path"
import { XMLBuilder } from "fast-xml-parser"
import { DEFAULT_WRITE_DELAY_MS } from "@roo-code/types"
import { formatResponse } from "../../../core/prompts/responses"
import { getReadablePath } from "../../../utils/path"
import { ClineSayTool } from "../../../shared/ExtensionMessage"
import { Task } from "../../../core/task/Task"
import { FileContentManager } from "./FileContentManager"
import { DiagnosticsManager } from "./DiagnosticsManager"

export interface SaveChangesOptions {
	diagnosticsEnabled?: boolean
	writeDelayMs?: number
}

export interface SaveChangesResult {
	newProblemsMessage: string | undefined
	userEdits: string | undefined
	finalContent: string | undefined
}

export interface RevertChangesOptions {
	cleanupDirectories?: boolean
}

/**
 * Handles diff operation workflows including save, revert, and response formatting.
 * Orchestrates other components to provide high-level diff operations.
 * Extracted from DiffViewProvider to separate operation handling concerns.
 */
export class DiffOperationHandler {
	constructor(
		private fileContentManager: FileContentManager,
		private diagnosticsManager: DiagnosticsManager,
	) {}

	/**
	 * Save changes from diff editor with diagnostics and user edit detection
	 * @param editor - Active diff editor
	 * @param relPath - Relative file path
	 * @param newContent - New content from AI
	 * @param originalContent - Original file content
	 * @param editType - Whether creating or modifying file
	 * @param options - Save options
	 * @returns Save result with problems and user edits
	 */
	async saveChanges(
		editor: vscode.TextEditor,
		relPath: string,
		newContent: string,
		originalContent: string,
		editType: "create" | "modify",
		options: SaveChangesOptions = {},
	): Promise<SaveChangesResult> {
		const { diagnosticsEnabled = true, writeDelayMs = DEFAULT_WRITE_DELAY_MS } = options

		const absolutePath = this.fileContentManager.resolveAbsolutePath(relPath)
		const updatedDocument = editor.document
		const editedContent = updatedDocument.getText()

		// Save the document if it's dirty
		if (updatedDocument.isDirty) {
			await updatedDocument.save()
		}

		// Show the document and close diff views
		await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), {
			preview: false,
			preserveFocus: true,
		})

		// Process diagnostics if enabled
		let newProblemsMessage = ""
		if (diagnosticsEnabled) {
			newProblemsMessage = await this.diagnosticsManager.processNewDiagnostics(
				writeDelayMs,
				this.fileContentManager.getCwd(),
			)
		}

		// Process content through the pipeline: BOM strip -> EOL detect -> EOL normalize
		const strippedEditedContent = this.fileContentManager.stripAllBOMs(editedContent)
		const newContentEOL = this.fileContentManager.detectLineEnding(newContent)
		const normalizedEditedContent = this.fileContentManager.normalizeEOL(strippedEditedContent, newContentEOL)
		const normalizedNewContent = this.fileContentManager.normalizeEOL(newContent, newContentEOL)

		// Check for user edits - preserve original content with BOM for userEdits
		let userEdits: string | undefined
		if (normalizedEditedContent !== normalizedNewContent) {
			// User made changes before approving edit - return original user content (with BOM)
			userEdits = editedContent
		}

		// Write the final content to disk (BOM-stripped and normalized)
		await this.fileContentManager.writeFile(absolutePath, normalizedEditedContent)

		return {
			newProblemsMessage,
			userEdits,
			finalContent: normalizedEditedContent,
		}
	}

	/**
	 * Revert changes in diff editor
	 * @param editor - Active diff editor
	 * @param relPath - Relative file path
	 * @param originalContent - Original file content to restore
	 * @param editType - Whether creating or modifying file
	 * @param createdDirectories - Directories created for new files
	 * @param options - Revert options
	 */
	async revertChanges(
		editor: vscode.TextEditor,
		relPath: string,
		originalContent: string,
		editType: "create" | "modify",
		createdDirectories: string[] = [],
		options: RevertChangesOptions = {},
	): Promise<void> {
		const { cleanupDirectories = true } = options
		const absolutePath = this.fileContentManager.resolveAbsolutePath(relPath)
		const updatedDocument = editor.document

		if (editType === "create") {
			// For new files, save and delete the file
			if (updatedDocument.isDirty) {
				await updatedDocument.save()
			}

			await this.fileContentManager.deleteFile(absolutePath)

			// Remove created directories if requested
			if (cleanupDirectories) {
				await this.fileContentManager.removeDirectories(createdDirectories)
			}
		} else {
			// For existing files, revert to original content
			const edit = new vscode.WorkspaceEdit()
			const fullRange = new vscode.Range(
				updatedDocument.positionAt(0),
				updatedDocument.positionAt(updatedDocument.getText().length),
			)

			const processedOriginalContent = this.fileContentManager.stripAllBOMs(originalContent)
			edit.replace(updatedDocument.uri, fullRange, processedOriginalContent)

			// Apply the edit and save
			await vscode.workspace.applyEdit(edit)
			await updatedDocument.save()

			// Show the document if it was previously open
			await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), {
				preview: false,
				preserveFocus: true,
			})
		}
	}

	/**
	 * Format a standardized XML response for file write operations
	 * @param task - Task instance for sending feedback
	 * @param cwd - Current working directory
	 * @param relPath - Relative file path
	 * @param isNewFile - Whether this is a new file
	 * @param userEdits - User edits diff if any
	 * @param problemsMessage - New problems message if any
	 * @returns Formatted XML response string
	 */
	async pushToolWriteResult(
		task: Task,
		cwd: string,
		relPath: string,
		isNewFile: boolean,
		userEdits?: string,
		problemsMessage?: string,
	): Promise<string> {
		// Send user feedback diff if userEdits exists
		if (userEdits) {
			const say: ClineSayTool = {
				tool: isNewFile ? "newFileCreated" : "editedExistingFile",
				path: getReadablePath(cwd, relPath),
				diff: userEdits,
			}

			await task.say("user_feedback_diff", JSON.stringify(say))
		}

		// Build XML response
		const xmlObj = {
			file_write_result: {
				path: relPath,
				operation: isNewFile ? "created" : "modified",
				user_edits: userEdits || undefined,
				problems: problemsMessage || undefined,
				notice: {
					i: [
						"You do not need to re-read the file, as you have seen all changes",
						"Proceed with the task using these changes as the new baseline.",
						...(userEdits
							? [
									"If the user's edits have addressed part of the task or changed the requirements, adjust your approach accordingly.",
								]
							: []),
					],
				},
			},
		}

		const builder = new XMLBuilder({
			format: true,
			indentBy: "",
			suppressEmptyNode: true,
			processEntities: false,
			tagValueProcessor: (name, value) => {
				if (typeof value === "string") {
					// Only escape <, >, and & characters
					return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
				}
				return value
			},
			attributeValueProcessor: (name, value) => {
				if (typeof value === "string") {
					// Only escape <, >, and & characters
					return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
				}
				return value
			},
		})

		return builder.build(xmlObj)
	}

	/**
	 * Handle complete save workflow with all steps
	 * @param editor - Active diff editor
	 * @param relPath - Relative file path
	 * @param newContent - New content from AI
	 * @param originalContent - Original file content
	 * @param editType - Whether creating or modifying file
	 * @param task - Task instance
	 * @param options - Save options
	 * @returns Complete save result with XML response
	 */
	async handleCompleteSaveWorkflow(
		editor: vscode.TextEditor,
		relPath: string,
		newContent: string,
		originalContent: string,
		editType: "create" | "modify",
		task: Task,
		options: SaveChangesOptions = {},
	): Promise<{ result: SaveChangesResult; xmlResponse: string }> {
		// Save changes and get result
		const result = await this.saveChanges(editor, relPath, newContent, originalContent, editType, options)

		// Generate XML response
		const xmlResponse = await this.pushToolWriteResult(
			task,
			this.fileContentManager.getCwd(),
			relPath,
			editType === "create",
			result.userEdits,
			result.newProblemsMessage,
		)

		return { result, xmlResponse }
	}

	/**
	 * Validate inputs for save operations
	 */
	validateSaveInputs(
		editor: vscode.TextEditor | undefined,
		relPath: string,
		newContent: string,
	): { valid: boolean; error?: string } {
		if (!editor) {
			return { valid: false, error: "No active diff editor provided" }
		}

		if (!relPath?.trim()) {
			return { valid: false, error: "No file path provided" }
		}

		if (!editor.document) {
			return { valid: false, error: "Editor document is not available" }
		}

		return { valid: true }
	}

	/**
	 * Get operation statistics
	 */
	getOperationStats(): {
		supportsSave: boolean
		supportsRevert: boolean
		supportsUserEditDetection: boolean
		supportsDiagnostics: boolean
		supportsXMLResponse: boolean
	} {
		return {
			supportsSave: true,
			supportsRevert: true,
			supportsUserEditDetection: true,
			supportsDiagnostics: true,
			supportsXMLResponse: true,
		}
	}

	/**
	 * Check if editor state is valid for operations
	 */
	isEditorStateValid(editor: vscode.TextEditor): boolean {
		try {
			return !!(editor && editor.document && editor.document.uri)
		} catch {
			return false
		}
	}
}
