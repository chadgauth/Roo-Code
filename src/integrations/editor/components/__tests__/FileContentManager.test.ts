import { describe, it, expect, vi, beforeEach } from "vitest"
import { FileContentManager } from "../FileContentManager"

describe("FileContentManager - High Risk Operations", () => {
	let manager: FileContentManager
	const testCwd = "/test/cwd"

	beforeEach(() => {
		manager = new FileContentManager(testCwd)
		vi.clearAllMocks()
	})

	describe("BOM stripping - File Corruption Risk", () => {
		it("should correctly strip UTF-8 BOM without corrupting content", () => {
			const utf8BOM = "\uFEFF"
			const content = "console.log('hello world')"
			const contentWithBOM = utf8BOM + content

			const result = manager.stripAllBOMs(contentWithBOM)

			expect(result).toBe(content)
			expect(result).not.toContain("\uFEFF")
		})

		it("should correctly strip UTF-16LE BOM without corrupting content", () => {
			const utf16LEBOM = "\uFFFE"
			const content = "const x = 42;"
			const contentWithBOM = utf16LEBOM + content

			const result = manager.stripAllBOMs(contentWithBOM)

			expect(result).toBe(content)
			expect(result).not.toContain("\uFFFE")
		})

		it("should correctly strip UTF-16BE BOM without corrupting content", () => {
			const utf16BEBOM = "\uFEFF"
			const content = "function test() { return true; }"
			const contentWithBOM = utf16BEBOM + content

			const result = manager.stripAllBOMs(contentWithBOM)

			expect(result).toBe(content)
			expect(result).not.toContain("\uFEFF")
		})

		it("should handle multiple BOMs in the same content", () => {
			const content = "\uFEFF\uFFFEHello\uFEFFWorld\uFFFE"
			const expected = "HelloWorld"

			const result = manager.stripAllBOMs(content)

			expect(result).toBe(expected)
		})

		it("should not corrupt content when no BOM is present", () => {
			const content = "Normal content without BOM"

			const result = manager.stripAllBOMs(content)

			expect(result).toBe(content)
		})

		it("should handle edge case of content that is only BOMs", () => {
			const content = "\uFEFF\uFFFE"

			const result = manager.stripAllBOMs(content)

			expect(result).toBe("")
		})
	})

	describe("EOL normalization - File Corruption Risk", () => {
		it("should correctly normalize Windows CRLF to Unix LF", () => {
			const windowsContent = "line1\r\nline2\r\nline3\r\n"
			const expectedUnix = "line1\nline2\nline3\n"

			const result = manager.normalizeEOL(windowsContent, "\n")

			expect(result).toBe(expectedUnix)
		})

		it("should correctly normalize Unix LF to Windows CRLF", () => {
			const unixContent = "line1\nline2\nline3\n"
			const expectedWindows = "line1\r\nline2\r\nline3\r\n"

			const result = manager.normalizeEOL(unixContent, "\r\n")

			expect(result).toBe(expectedWindows)
		})

		it("should handle mixed line endings correctly", () => {
			const mixedContent = "line1\r\nline2\nline3\r\nline4\n"
			const expectedUnix = "line1\nline2\nline3\nline4\n"

			const result = manager.normalizeEOL(mixedContent, "\n")

			expect(result).toBe(expectedUnix)
		})

		it("should preserve content with no line endings", () => {
			const content = "single line with no ending"

			const result = manager.normalizeEOL(content, "\n")

			expect(result).toBe(content)
		})

		it("should handle empty content safely", () => {
			const content = ""

			const result = manager.normalizeEOL(content, "\n")

			expect(result).toBe("")
		})
	})

	describe("Line ending detection - Critical for file integrity", () => {
		it("should detect Windows CRLF line endings", () => {
			const content = "line1\r\nline2\r\nline3\r\n"

			const result = manager.detectLineEnding(content)

			expect(result).toBe("\r\n")
		})

		it("should detect Unix LF line endings", () => {
			const content = "line1\nline2\nline3\n"

			const result = manager.detectLineEnding(content)

			expect(result).toBe("\n")
		})

		it("should handle mixed line endings by preferring CRLF", () => {
			const content = "line1\r\nline2\nline3\r\n"

			const result = manager.detectLineEnding(content)

			expect(result).toBe("\r\n")
		})

		it("should default to LF for content with no line endings", () => {
			const content = "single line"

			const result = manager.detectLineEnding(content)

			expect(result).toBe("\n")
		})

		it("should default to LF for empty content", () => {
			const content = ""

			const result = manager.detectLineEnding(content)

			expect(result).toBe("\n")
		})
	})

	describe("Combined BOM + EOL operations - Maximum risk", () => {
		it("should safely handle content with both BOM and mixed line endings", () => {
			const bomContent = "\uFEFFline1\r\nline2\nline3\r\n"
			const expected = "line1\nline2\nline3\n"

			// First strip BOM, then normalize EOL
			const strippedBOM = manager.stripAllBOMs(bomContent)
			const normalized = manager.normalizeEOL(strippedBOM, "\n")

			expect(normalized).toBe(expected)
			expect(normalized).not.toContain("\uFEFF")
		})

		it("should handle complex content with code, BOMs, and mixed line endings", () => {
			const complexContent = "\uFEFFfunction test() {\r\n  return 'hello\uFEFFworld';\n}\r\n"
			const expectedContent = "function test() {\n  return 'helloworld';\n}\n"

			const strippedBOM = manager.stripAllBOMs(complexContent)
			const normalized = manager.normalizeEOL(strippedBOM, "\n")

			expect(normalized).toBe(expectedContent)
		})
	})
})
