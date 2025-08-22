import { describe, it, expect, vi, beforeEach } from "vitest"
import { DiffOperationHandler } from "../DiffOperationHandler"
import { FileContentManager } from "../FileContentManager"
import { DiagnosticsManager } from "../DiagnosticsManager"
import * as vscode from "vscode"

// Mock dependencies
vi.mock("../FileContentManager")
vi.mock("../DiagnosticsManager")
vi.mock("vscode", () => ({
	window: {
		showTextDocument: vi.fn().mockResolvedValue({}),
	},
	Uri: {
		file: vi.fn((path) => ({ fsPath: path })),
	},
}))

describe("DiffOperationHandler - High Risk Operations", () => {
	let handler: DiffOperationHandler
	let mockFileManager: any
	let mockDiagnosticsManager: any
	let mockEditor: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockFileManager = {
			writeFile: vi.fn().mockResolvedValue(undefined),
			resolveAbsolutePath: vi.fn((path) => `/abs/${path}`),
			stripAllBOMs: vi.fn((content) => content),
			normalizeEOL: vi.fn((content) => content),
			detectLineEnding: vi.fn(() => "\n"),
			getCwd: vi.fn(() => "/test/cwd"),
		}

		mockDiagnosticsManager = {
			processNewDiagnostics: vi.fn().mockResolvedValue(""),
		}

		mockEditor = {
			document: {
				getText: vi.fn(),
				isDirty: false,
				save: vi.fn().mockResolvedValue(undefined),
			},
		}

		vi.mocked(FileContentManager).mockImplementation(() => mockFileManager)
		vi.mocked(DiagnosticsManager).mockImplementation(() => mockDiagnosticsManager)

		handler = new DiffOperationHandler(mockFileManager, mockDiagnosticsManager)
	})

	describe("User edit detection - Critical for data safety", () => {
		it("should correctly detect when user has made no edits", async () => {
			const originalContent = "console.log('original')"
			const newContent = "console.log('updated')"

			// Mock editor returns exactly the new content (no user edits)
			mockEditor.document.getText.mockReturnValue(newContent)

			const result = await handler.saveChanges(mockEditor, "test.js", newContent, originalContent, "modify", {
				diagnosticsEnabled: false,
			})

			expect(result.userEdits).toBeUndefined()
		})

		it("should detect user edits and include them in response", async () => {
			const originalContent = "console.log('original')"
			const newContent = "console.log('updated')"
			const userEditedContent = "console.log('user modified this')"

			// Mock editor returns user-modified content
			mockEditor.document.getText.mockReturnValue(userEditedContent)

			const result = await handler.saveChanges(mockEditor, "test.js", newContent, originalContent, "modify", {
				diagnosticsEnabled: false,
			})

			expect(result.userEdits).toBe(userEditedContent)
		})

		it("should handle whitespace-only differences correctly", async () => {
			const originalContent = "function test() {\n  return true;\n}"
			const newContent = "function test() {\n  return true;\n}"
			const userEditedContent = "function test() {\n    return true;\n}" // Added spaces

			mockEditor.document.getText.mockReturnValue(userEditedContent)

			const result = await handler.saveChanges(mockEditor, "test.js", newContent, originalContent, "modify", {
				diagnosticsEnabled: false,
			})

			// Should detect even whitespace changes as user edits
			expect(result.userEdits).toBe(userEditedContent)
		})

		it("should handle edge case of empty content correctly", async () => {
			const originalContent = ""
			const newContent = "console.log('new')"
			const userEditedContent = ""

			mockEditor.document.getText.mockReturnValue(userEditedContent)

			const result = await handler.saveChanges(mockEditor, "test.js", newContent, originalContent, "create", {
				diagnosticsEnabled: false,
			})

			// User deleted all content - should be detected as edit
			expect(result.userEdits).toBe(userEditedContent)
		})

		it("should handle Unicode content safely", async () => {
			const originalContent = "const emoji = '👍'"
			const newContent = "const emoji = '👎'"
			const userEditedContent = "const emoji = '🚀'"

			mockEditor.document.getText.mockReturnValue(userEditedContent)

			const result = await handler.saveChanges(mockEditor, "test.js", newContent, originalContent, "modify", {
				diagnosticsEnabled: false,
			})

			expect(result.userEdits).toBe(userEditedContent)
		})

		it("should correctly handle BOM in user edits", async () => {
			const originalContent = "console.log('test')"
			const newContent = "console.log('updated')"
			const userEditedContent = "\uFEFFconsole.log('user edit with BOM')"

			mockEditor.document.getText.mockReturnValue(userEditedContent)
			// Mock BOM stripping
			mockFileManager.stripAllBOMs.mockReturnValue("console.log('user edit with BOM')")

			const result = await handler.saveChanges(mockEditor, "test.js", newContent, originalContent, "modify", {
				diagnosticsEnabled: false,
			})

			// Should save the BOM-stripped version
			expect(mockFileManager.writeFile).toHaveBeenCalledWith("/abs/test.js", "console.log('user edit with BOM')")
			expect(result.userEdits).toBe(userEditedContent)
		})
	})

	describe("Content processing pipeline - File corruption risk", () => {
		it("should apply BOM stripping and EOL normalization in correct order", async () => {
			const originalContent = "line1\nline2"
			const newContent = "\uFEFFline1\r\nline2\r\n"

			mockEditor.document.getText.mockReturnValue(newContent)
			mockFileManager.stripAllBOMs.mockReturnValue("line1\r\nline2\r\n")
			mockFileManager.detectLineEnding.mockReturnValue("\r\n")
			mockFileManager.normalizeEOL.mockReturnValue("line1\r\nline2\r\n")

			await handler.saveChanges(mockEditor, "test.js", newContent, originalContent, "modify", {
				diagnosticsEnabled: false,
			})

			// Verify processing order: BOM strip -> EOL detect -> EOL normalize
			expect(mockFileManager.stripAllBOMs).toHaveBeenCalledWith(newContent)
			expect(mockFileManager.detectLineEnding).toHaveBeenCalledWith(newContent)
			expect(mockFileManager.normalizeEOL).toHaveBeenCalledWith("line1\r\nline2\r\n", "\r\n")
		})

		it("should handle processing failures gracefully", async () => {
			const originalContent = "test"
			const newContent = "updated test"

			mockEditor.document.getText.mockReturnValue(newContent)
			mockFileManager.stripAllBOMs.mockImplementation(() => {
				throw new Error("BOM processing failed")
			})

			// Should not crash the entire operation
			await expect(
				handler.saveChanges(mockEditor, "test.js", newContent, originalContent, "modify", {
					diagnosticsEnabled: false,
				}),
			).rejects.toThrow("BOM processing failed")
		})
	})

	describe("File operation safety", () => {
		it("should save user edits instead of AI content when user has modified", async () => {
			const originalContent = "original"
			const aiContent = "ai generated"
			const userContent = "user modified"

			mockEditor.document.getText.mockReturnValue(userContent)
			mockFileManager.stripAllBOMs.mockReturnValue(userContent)
			mockFileManager.normalizeEOL.mockReturnValue(userContent)

			await handler.saveChanges(mockEditor, "test.js", aiContent, originalContent, "modify", {
				diagnosticsEnabled: false,
			})

			// Critical: Must save user content, not AI content
			expect(mockFileManager.writeFile).toHaveBeenCalledWith("/abs/test.js", userContent)
		})

		it("should save AI content when no user edits detected", async () => {
			const originalContent = "original"
			const aiContent = "ai generated"

			mockEditor.document.getText.mockReturnValue(aiContent)
			mockFileManager.stripAllBOMs.mockReturnValue(aiContent)
			mockFileManager.normalizeEOL.mockReturnValue(aiContent)

			await handler.saveChanges(mockEditor, "test.js", aiContent, originalContent, "modify", {
				diagnosticsEnabled: false,
			})

			expect(mockFileManager.writeFile).toHaveBeenCalledWith("/abs/test.js", aiContent)
		})
	})
})
