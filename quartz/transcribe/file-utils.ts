import { promises as fs } from "fs"
import path from "path"
import chalk from "chalk"

export interface FileValidationResult {
  isValid: boolean
  error?: string
  fileSize?: number
  filePath?: string
}

export class FileUtils {
  static readonly SUPPORTED_EXTENSIONS = [".mkv"]
  static readonly MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2GB

  /**
   * Validate that the file exists, is readable, and is a supported format
   */
  static async validateInputFile(filePath: string): Promise<FileValidationResult> {
    try {
      // Check if file exists
      const stats = await fs.stat(filePath)

      if (!stats.isFile()) {
        return {
          isValid: false,
          error: "Path does not point to a file"
        }
      }

      // Check file size
      if (stats.size > this.MAX_FILE_SIZE) {
        return {
          isValid: false,
          error: `File size (${this.formatFileSize(stats.size)}) exceeds maximum allowed size (${this.formatFileSize(this.MAX_FILE_SIZE)})`
        }
      }

      // Check file extension
      const ext = path.extname(filePath).toLowerCase()
      if (!this.SUPPORTED_EXTENSIONS.includes(ext)) {
        return {
          isValid: false,
          error: `Unsupported file format. Supported formats: ${this.SUPPORTED_EXTENSIONS.join(", ")}`
        }
      }

      // Check if file is readable
      await fs.access(filePath, fs.constants.R_OK)

      return {
        isValid: true,
        fileSize: stats.size,
        filePath: path.resolve(filePath)
      }

    } catch (error) {
      return {
        isValid: false,
        error: `File access error: ${error.message}`
      }
    }
  }

  /**
   * Ensure the output directory exists and is writable
   */
  static async ensureOutputDirectory(outputPath: string): Promise<void> {
    const outputDir = path.dirname(outputPath)

    try {
      await fs.mkdir(outputDir, { recursive: true })

      // Test if directory is writable
      await fs.access(outputDir, fs.constants.W_OK)
    } catch (error) {
      throw new Error(`Cannot write to output directory: ${error.message}`)
    }
  }

  /**
   * Check if output file already exists and handle accordingly
   */
  static async handleExistingOutputFile(outputPath: string, overwrite = false): Promise<boolean> {
    try {
      await fs.access(outputPath)
      // File exists

      if (!overwrite) {
        console.warn(chalk.yellow(`Output file already exists: ${outputPath}`))
        console.warn(chalk.yellow("Use --overwrite flag to replace existing file"))
        return false
      } else {
        console.log(chalk.blue(`Overwriting existing file: ${outputPath}`))
        return true
      }
    } catch {
      // File doesn't exist, we can proceed
      return true
    }
  }

  /**
   * Create a safe backup of an existing file
   */
  static async createBackup(filePath: string): Promise<string | null> {
    try {
      await fs.access(filePath)

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const backupPath = `${filePath}.backup-${timestamp}`

      await fs.copyFile(filePath, backupPath)
      console.log(chalk.grey(`Created backup: ${backupPath}`))

      return backupPath
    } catch {
      // File doesn't exist, no backup needed
      return null
    }
  }

  /**
   * Clean up temporary files safely
   */
  static async cleanupFiles(filePaths: string[], verbose = false): Promise<void> {
    const cleanedFiles: string[] = []
    const failedFiles: string[] = []

    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath)
        cleanedFiles.push(filePath)
        if (verbose) {
          console.log(chalk.grey(`Cleaned up: ${path.basename(filePath)}`))
        }
      } catch (error) {
        failedFiles.push(filePath)
        if (verbose) {
          console.warn(chalk.yellow(`Failed to cleanup: ${path.basename(filePath)} - ${error.message}`))
        }
      }
    }

    if (verbose && cleanedFiles.length > 0) {
      console.log(chalk.green(`Successfully cleaned up ${cleanedFiles.length} temporary files`))
    }

    if (failedFiles.length > 0) {
      console.warn(chalk.yellow(`Failed to cleanup ${failedFiles.length} files`))
    }
  }

  /**
   * Create a temporary directory for processing
   */
  static async createTempDirectory(prefix = "quartz-transcribe"): Promise<string> {
    const tempDir = path.join(process.cwd(), "quartz", ".transcribe-cache", `${prefix}-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
    return tempDir
  }

  /**
   * Remove a directory and all its contents
   */
  static async removeDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true })
    } catch (error) {
      console.warn(chalk.yellow(`Failed to remove directory: ${dirPath} - ${error.message}`))
    }
  }

  /**
   * Get file information for logging
   */
  static async getFileInfo(filePath: string): Promise<{
    name: string
    size: string
    extension: string
    absolutePath: string
  }> {
    const stats = await fs.stat(filePath)

    return {
      name: path.basename(filePath),
      size: this.formatFileSize(stats.size),
      extension: path.extname(filePath),
      absolutePath: path.resolve(filePath)
    }
  }

  /**
   * Format file size in human-readable format
   */
  static formatFileSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"]
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  /**
   * Generate a safe filename from session info
   */
  static generateSafeFilename(sessionNumber?: number, date?: string, suffix = "transcription"): string {
    let filename = "Session"

    if (sessionNumber) {
      filename += ` ${sessionNumber}`
    } else if (date) {
      const dateObj = new Date(date)
      if (!isNaN(dateObj.getTime())) {
        filename += ` ${dateObj.toISOString().split("T")[0]}`
      }
    } else {
      const now = new Date()
      filename += ` ${now.toISOString().split("T")[0]}`
    }

    filename += ` ${suffix}.md`

    // Sanitize filename
    return filename.replace(/[^a-zA-Z0-9\s\-_.]/g, "").replace(/\s+/g, " ").trim()
  }

  /**
   * Check available disk space
   */
  static async checkDiskSpace(dirPath: string): Promise<{ available: number; total: number }> {
    try {
      const stats = await fs.statfs(dirPath)
      return {
        available: stats.bavail * stats.bsize,
        total: stats.blocks * stats.bsize
      }
    } catch {
      // If statfs is not available (Windows), return large numbers
      return {
        available: Number.MAX_SAFE_INTEGER,
        total: Number.MAX_SAFE_INTEGER
      }
    }
  }

  /**
   * Estimate required disk space for processing
   */
  static estimateRequiredSpace(inputFileSize: number): number {
    // Rough estimate:
    // - Extracted audio: ~10% of MKV size
    // - Temporary processing files: ~20% of MKV size
    // - Safety margin: 50% extra
    return Math.ceil(inputFileSize * 0.3 * 1.5)
  }

  /**
   * Validate environment requirements
   */
  static async validateEnvironment(): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = []

    // Check if FFmpeg is available
    try {
      const { execSync } = await import("child_process")
      execSync("ffmpeg -version", { stdio: "ignore" })
    } catch {
      errors.push("FFmpeg is not installed or not available in PATH. Please install FFmpeg to process MKV files.")
    }

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      errors.push("OPENAI_API_KEY environment variable is not set. Please set your OpenAI API key.")
    }

    // Check Node.js version
    const nodeVersion = process.version
    const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0])
    if (majorVersion < 18) {
      errors.push(`Node.js version ${nodeVersion} is not supported. Please upgrade to Node.js 18 or later.`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}