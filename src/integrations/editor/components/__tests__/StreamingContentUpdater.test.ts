import { describe, it, expect, vi, beforeEach } from "vitest"
import { StreamingContentUpdater } from "../StreamingContentUpdater"
import * as vscode from "vscode"

// Mock vscode
vi.mock("vscode", () => ({
	WorkspaceEdit: vi.fn().mockImplementation(() => ({
		replace: vi.fn(),
		delete: vi.fn(),
	})),
	workspace: {
		applyEdit: vi.fn().mockResolvedValue(true),
	},
	Range: vi.fn().mockImplementation((start, end) => ({ start, end })),
	Position: vi.fn().mockImplementation((line, char) => ({ line, character: char })),
	Selection: vi.fn().mockImplementation((start, end) => ({ start, end })),
}))

describe("StreamingContentUpdater - Content Corruption Risk", () => {
	let updater: StreamingContentUpdater
	let mockEditor: any
	let mockWorkspaceEdit: any

	beforeEach(() => {
		vi.clearAllMocks()
		updater = new StreamingContentUpdater()

		mockWorkspaceEdit = {
			replace: vi.fn(),
			delete: vi.fn(),
		}
		vi.mocked(vscode.WorkspaceEdit).mockImplementation(() => mockWorkspaceEdit)

		mockEditor = {
			document: {
				uri: { fsPath: "/test/file.js" },
				getText: vi.fn(),
				lineCount: 5,
			},
			selection: {
				active: { line: 0, character: 0 },
				anchor: { line: 0, character: 0 },
			},
			edit: vi.fn().mockResolvedValue(true),
			revealRange: vi.fn(),
		}

		vi.mocked(vscode.workspace.applyEdit).mockResolvedValue(true)
	})

	describe("Real-time content replacement - File corruption risk", () => {
		it("should preserve final newline when original has one", async () => {
			const originalContent = "line1\nline2\n"
			const streamingContent = "updated1\nupdated2"

			mockEditor.document.getText.mockReturnValue(originalContent)

			await updater.updateStreamingContent(
				mockEditor,
				streamingContent,
				true, // isFinal
				originalContent,
			)

			// Should preserve the final newline from original
			expect(mockWorkspaceEdit.replace).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				"updated1\nupdated2\n",
			)
		})

		it("should not add newline when original content has none", async () => {
			const originalContent = "line1\nline2"
			const streamingContent = "updated1\nupdated2"

			mockEditor.document.getText.mockReturnValue(originalContent)

			await updater.updateStreamingContent(mockEditor, streamingContent, true, originalContent)

			// Should not add extra newline
			expect(mockWorkspaceEdit.replace).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				"updated1\nupdated2",
			)
		})

		it("should handle streaming content that already ends with newline", async () => {
			const originalContent = "line1\nline2\n"
			const streamingContent = "updated1\nupdated2\n"

			mockEditor.document.getText.mockReturnValue(originalContent)

			await updater.updateStreamingContent(mockEditor, streamingContent, true, originalContent)

			// Should not double the newline
			expect(mockWorkspaceEdit.replace).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				"updated1\nupdated2\n",
			)
		})

		it("should handle empty original content safely", async () => {
			const originalContent = ""
			const streamingContent = "new content"

			mockEditor.document.getText.mockReturnValue(originalContent)

			await updater.updateStreamingContent(mockEditor, streamingContent, true, originalContent)

			expect(mockWorkspaceEdit.replace).toHaveBeenCalledWith(expect.anything(), expect.anything(), "new content")
		})

		it("should handle empty streaming content safely", async () => {
			const originalContent = "some content\n"
			const streamingContent = ""

			mockEditor.document.getText.mockReturnValue(originalContent)

			await updater.updateStreamingContent(mockEditor, streamingContent, true, originalContent)

			// Should preserve original newline pattern even with empty content
			expect(mockWorkspaceEdit.replace).toHaveBeenCalledWith(expect.anything(), expect.anything(), "\n")
		})

		it("should handle Unicode content without corruption", async () => {
			const originalContent = "emoji: 👍\ntext: hello\n"
			const streamingContent = "emoji: 🚀\ntext: world"

			mockEditor.document.getText.mockReturnValue(originalContent)

			await updater.updateStreamingContent(mockEditor, streamingContent, true, originalContent)

			expect(mockWorkspaceEdit.replace).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				"emoji: 🚀\ntext: world\n",
			)
		})

		it("should handle content with mixed line endings during streaming", async () => {
			const originalContent = "line1\r\nline2\n"
			const streamingContent = "updated1\r\nupdated2"

			mockEditor.document.getText.mockReturnValue(originalContent)

			await updater.updateStreamingContent(mockEditor, streamingContent, true, originalContent)

			// Should preserve newline but not necessarily the exact type
			expect(mockWorkspaceEdit.replace).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				"updated1\r\nupdated2\n",
			)
		})
	})

	describe("Incremental streaming safety", () => {
		it("should handle incremental updates without corruption", async () => {
			const originalContent = "original\n"

			mockEditor.document.getText.mockReturnValue(originalContent)

			// First incremental update
			await updater.updateStreamingContent(
				mockEditor,
				"partial",
				false, // not final
				originalContent,
			)

			// Should apply partial content immediately
			expect(mockWorkspaceEdit.replace).toHaveBeenCalledWith(expect.anything(), expect.anything(), "partial")

			// Final update
			await updater.updateStreamingContent(
				mockEditor,
				"complete content",
				true, // final
				originalContent,
			)

			// Should preserve newline in final update
			expect(mockWorkspaceEdit.replace).toHaveBeenLastCalledWith(
				expect.anything(),
				expect.anything(),
				"complete content\n",
			)
		})

		it("should handle workspace edit failure gracefully", async () => {
			const originalContent = "test\n"
			const streamingContent = "updated"

			mockEditor.document.getText.mockReturnValue(originalContent)
			vi.mocked(vscode.workspace.applyEdit).mockResolvedValue(false)

			// Should not throw error on failed edit
			await expect(
				updater.updateStreamingContent(mockEditor, streamingContent, true, originalContent),
			).resolves.not.toThrow()
		})

		it("should handle editor edit failure gracefully", async () => {
			const originalContent = "test\n"
			const streamingContent = "updated"

			mockEditor.document.getText.mockReturnValue(originalContent)
			mockEditor.edit.mockResolvedValue(false)

			// Should fall back to workspace edit when editor.edit fails
			await updater.updateStreamingContent(mockEditor, streamingContent, true, originalContent)

			expect(vscode.workspace.applyEdit).toHaveBeenCalled()
		})
	})

	describe("Range calculation safety", () => {
		it("should calculate full document range correctly", async () => {
			const originalContent = "line1\nline2\nline3\n"
			const streamingContent = "new content"

			mockEditor.document.getText.mockReturnValue(originalContent)
			mockEditor.document.lineCount = 4

			await updater.updateStreamingContent(mockEditor, streamingContent, true, originalContent)

			// Should create range from start to end of document
			expect(vscode.Range).toHaveBeenCalledWith(
				expect.objectContaining({ line: 0, character: 0 }),
				expect.objectContaining({ line: 3, character: 0 }),
			)
		})
	})
})
