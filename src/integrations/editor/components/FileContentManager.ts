import * as fs from "fs/promises"
import * as path from "path"
import { Stats } from "fs"
import stripBom from "strip-bom"
import { createDirectoriesForFile } from "../../../utils/fs"

/**
 * Manages file content operations including reading, writing, and content normalization.
 * Extracted from DiffViewProvider to separate file I/O concerns.
 */
export class FileContentManager {
	constructor(private cwd: string) {}

	/**
	 * Get the current working directory
	 */
	getCwd(): string {
		return this.cwd
	}

	/**
	 * Read file content from the given absolute path
	 */
	async readFile(absolutePath: string): Promise<string> {
		try {
			return await fs.readFile(absolutePath, "utf-8")
		} catch (error) {
			throw new Error(`Failed to read file ${absolutePath}: ${error}`)
		}
	}

	/**
	 * Write content to file at the given absolute path
	 */
	async writeFile(absolutePath: string, content: string): Promise<void> {
		try {
			await fs.writeFile(absolutePath, content, "utf-8")
		} catch (error) {
			throw new Error(`Failed to write file ${absolutePath}: ${error}`)
		}
	}

	/**
	 * Create directories for the given file path and return created directories
	 */
	async createDirectoriesForFile(absolutePath: string): Promise<string[]> {
		return createDirectoriesForFile(absolutePath)
	}

	/**
	 * Delete a file at the given absolute path
	 */
	async deleteFile(absolutePath: string): Promise<void> {
		try {
			await fs.unlink(absolutePath)
		} catch (error) {
			throw new Error(`Failed to delete file ${absolutePath}: ${error}`)
		}
	}

	/**
	 * Remove created directories in reverse order
	 */
	async removeDirectories(directories: string[]): Promise<void> {
		for (let i = directories.length - 1; i >= 0; i--) {
			try {
				await fs.rmdir(directories[i])
			} catch (error) {
				// Directory might not be empty or already removed, continue cleanup
				console.warn(`Failed to remove directory ${directories[i]}:`, error)
			}
		}
	}

	/**
	 * Resolve relative path to absolute path based on current working directory
	 */
	resolveAbsolutePath(relPath: string): string {
		return path.resolve(this.cwd, relPath)
	}

	/**
	 * Strip all Byte Order Marks (BOMs) from content
	 * Handles multiple BOMs that might be present
	 */
	stripAllBOMs(input: string): string {
		let result = input

		// Strip all types of BOMs repeatedly until no more are found
		let hasMoreBOMs = true
		while (hasMoreBOMs) {
			const previous = result

			// UTF-8 BOM: \uFEFF
			result = result.replace(/^\uFEFF/, "")

			// UTF-16LE BOM: \uFFFE
			result = result.replace(/^\uFFFE/, "")

			// UTF-16BE BOM: \uFEFF (same as UTF-8, but in different context)
			// Also remove any BOMs in the middle of content
			result = result.replace(/\uFEFF/g, "")
			result = result.replace(/\uFFFE/g, "")

			hasMoreBOMs = result !== previous
		}

		return result
	}

	/**
	 * Normalize line endings in content
	 * @param content - Content to normalize
	 * @param targetEOL - Target line ending ("\n" or "\r\n")
	 */
	normalizeEOL(content: string, targetEOL: string = "\n"): string {
		return content.replace(/\r\n|\n/g, targetEOL)
	}

	/**
	 * Detect the line ending style used in content
	 */
	detectLineEnding(content: string): string {
		return content.includes("\r\n") ? "\r\n" : "\n"
	}

	/**
	 * Check if file exists at the given absolute path
	 */
	async fileExists(absolutePath: string): Promise<boolean> {
		try {
			await fs.access(absolutePath)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Get file stats for the given absolute path
	 */
	async getFileStats(absolutePath: string): Promise<Stats | null> {
		try {
			return await fs.stat(absolutePath)
		} catch {
			return null
		}
	}

	/**
	 * Create an empty file at the given absolute path
	 */
	async createEmptyFile(absolutePath: string): Promise<void> {
		await this.writeFile(absolutePath, "")
	}

	/**
	 * Safely write content with proper BOM stripping and EOL normalization
	 */
	async writeContentSafely(
		absolutePath: string,
		content: string,
		options: {
			stripBOMs?: boolean
			normalizeEOL?: boolean
			targetEOL?: string
		} = {},
	): Promise<void> {
		let processedContent = content

		if (options.stripBOMs !== false) {
			processedContent = this.stripAllBOMs(processedContent)
		}

		if (options.normalizeEOL !== false) {
			const targetEOL = options.targetEOL || this.detectLineEnding(content)
			processedContent = this.normalizeEOL(processedContent, targetEOL)
		}

		await this.writeFile(absolutePath, processedContent)
	}
}
