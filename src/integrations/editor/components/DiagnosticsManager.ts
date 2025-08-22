import * as vscode from "vscode"
import delay from "delay"
import { diagnosticsToProblemsString, getNewDiagnostics } from "../../diagnostics"
import { Task } from "../../../core/task/Task"

/**
 * Manages VS Code diagnostics capture and processing.
 * Extracted from DiffViewProvider to separate diagnostic concerns.
 */
export class DiagnosticsManager {
	private preDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = []

	constructor(private taskRef: WeakRef<Task>) {}

	/**
	 * Capture current diagnostics state
	 * Should be called before file operations to establish baseline
	 */
	captureDiagnostics(): void {
		this.preDiagnostics = vscode.languages.getDiagnostics()
	}

	/**
	 * Get the captured pre-operation diagnostics
	 */
	getPreDiagnostics(): [vscode.Uri, vscode.Diagnostic[]][] {
		return this.preDiagnostics
	}

	/**
	 * Clear the captured diagnostics
	 */
	clearPreDiagnostics(): void {
		this.preDiagnostics = []
	}

	/**
	 * Process and format new diagnostics that appeared after file operations
	 * @param writeDelayMs - Delay to allow linters time to process changes
	 * @param cwd - Current working directory for path resolution
	 * @returns Formatted problems message or empty string if no new problems
	 */
	async processNewDiagnostics(writeDelayMs: number = 0, cwd: string): Promise<string> {
		// Add configurable delay to allow linters time to process and clean up issues
		// like unused imports (especially important for Go and other languages)
		const safeDelayMs = Math.max(0, writeDelayMs)

		try {
			await delay(safeDelayMs)
		} catch (error) {
			// Log error but continue - delay failure shouldn't break the operation
			console.warn(`Failed to apply write delay: ${error}`)
		}

		const postDiagnostics = vscode.languages.getDiagnostics()

		// Get diagnostic settings from task state
		const task = this.taskRef.deref()
		const state = await task?.providerRef.deref()?.getState()
		const includeDiagnosticMessages = state?.includeDiagnosticMessages ?? true
		const maxDiagnosticMessages = state?.maxDiagnosticMessages ?? 50

		const newProblems = await diagnosticsToProblemsString(
			getNewDiagnostics(this.preDiagnostics, postDiagnostics),
			[
				vscode.DiagnosticSeverity.Error, // only including errors since warnings can be distracting
			],
			cwd,
			includeDiagnosticMessages,
			maxDiagnosticMessages,
		)

		return newProblems.length > 0 ? `\n\nNew problems detected after saving the file:\n${newProblems}` : ""
	}

	/**
	 * Process diagnostics for specific severities
	 * @param severities - Array of diagnostic severities to include
	 * @param writeDelayMs - Delay to allow linters time to process changes
	 * @param cwd - Current working directory for path resolution
	 * @returns Formatted problems message or empty string if no new problems
	 */
	async processNewDiagnosticsForSeverities(
		severities: vscode.DiagnosticSeverity[],
		writeDelayMs: number = 0,
		cwd: string,
	): Promise<string> {
		const safeDelayMs = Math.max(0, writeDelayMs)

		try {
			await delay(safeDelayMs)
		} catch (error) {
			console.warn(`Failed to apply write delay: ${error}`)
		}

		const postDiagnostics = vscode.languages.getDiagnostics()

		// Get diagnostic settings from task state
		const task = this.taskRef.deref()
		const state = await task?.providerRef.deref()?.getState()
		const includeDiagnosticMessages = state?.includeDiagnosticMessages ?? true
		const maxDiagnosticMessages = state?.maxDiagnosticMessages ?? 50

		const newProblems = await diagnosticsToProblemsString(
			getNewDiagnostics(this.preDiagnostics, postDiagnostics),
			severities,
			cwd,
			includeDiagnosticMessages,
			maxDiagnosticMessages,
		)

		return newProblems.length > 0 ? `\n\nNew problems detected:\n${newProblems}` : ""
	}

	/**
	 * Get diagnostic settings from task state
	 */
	async getDiagnosticSettings(): Promise<{
		includeDiagnosticMessages: boolean
		maxDiagnosticMessages: number
	}> {
		const task = this.taskRef.deref()
		const state = await task?.providerRef.deref()?.getState()

		return {
			includeDiagnosticMessages: state?.includeDiagnosticMessages ?? true,
			maxDiagnosticMessages: state?.maxDiagnosticMessages ?? 50,
		}
	}

	/**
	 * Check if diagnostics processing is enabled
	 */
	async isDiagnosticsEnabled(): Promise<boolean> {
		const task = this.taskRef.deref()
		const state = await task?.providerRef.deref()?.getState()
		return state?.diagnosticsEnabled ?? true
	}

	/**
	 * Get new diagnostics between two diagnostic captures
	 */
	static getNewDiagnosticsBetween(
		preDiagnostics: [vscode.Uri, vscode.Diagnostic[]][],
		postDiagnostics: [vscode.Uri, vscode.Diagnostic[]][],
	): [vscode.Uri, vscode.Diagnostic[]][] {
		return getNewDiagnostics(preDiagnostics, postDiagnostics)
	}

	/**
	 * Format diagnostics to problems string
	 */
	static async formatDiagnosticsToString(
		diagnostics: [vscode.Uri, vscode.Diagnostic[]][],
		severities: vscode.DiagnosticSeverity[],
		cwd: string,
		includeDiagnosticMessages: boolean = true,
		maxDiagnosticMessages: number = 50,
	): Promise<string> {
		return diagnosticsToProblemsString(
			diagnostics,
			severities,
			cwd,
			includeDiagnosticMessages,
			maxDiagnosticMessages,
		)
	}
}
