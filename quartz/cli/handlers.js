import { promises } from "fs"
import path from "path"
import esbuild from "esbuild"
import chalk from "chalk"
import { sassPlugin } from "esbuild-sass-plugin"
import fs from "fs"
import { intro, outro, select, text } from "@clack/prompts"
import { rimraf } from "rimraf"
import chokidar from "chokidar"
import prettyBytes from "pretty-bytes"
import { execSync, spawnSync } from "child_process"
import http from "http"
import serveHandler from "serve-handler"
import { WebSocketServer } from "ws"
import { randomUUID } from "crypto"
import { Mutex } from "async-mutex"
import { CreateArgv } from "./args.js"
import { globby } from "globby"
import {
  exitIfCancel,
  escapePath,
  gitPull,
  popContentFolder,
  stashContentFolder,
} from "./helpers.js"
import {
  UPSTREAM_NAME,
  QUARTZ_SOURCE_BRANCH,
  ORIGIN_NAME,
  version,
  fp,
  cacheFile,
  cwd,
} from "./constants.js"

/**
 * Resolve content directory path
 * @param contentPath path to resolve
 */
function resolveContentPath(contentPath) {
  if (path.isAbsolute(contentPath)) return path.relative(cwd, contentPath)
  return path.join(cwd, contentPath)
}

/**
 * Handles `npx quartz create`
 * @param {*} argv arguments for `create`
 */
export async function handleCreate(argv) {
  console.log()
  intro(chalk.bgGreen.black(` Quartz v${version} `))
  const contentFolder = resolveContentPath(argv.directory)
  let setupStrategy = argv.strategy?.toLowerCase()
  let linkResolutionStrategy = argv.links?.toLowerCase()
  const sourceDirectory = argv.source

  // If all cmd arguments were provided, check if they're valid
  if (setupStrategy && linkResolutionStrategy) {
    // If setup isn't, "new", source argument is required
    if (setupStrategy !== "new") {
      // Error handling
      if (!sourceDirectory) {
        outro(
          chalk.red(
            `Setup strategies (arg '${chalk.yellow(
              `-${CreateArgv.strategy.alias[0]}`,
            )}') other than '${chalk.yellow(
              "new",
            )}' require content folder argument ('${chalk.yellow(
              `-${CreateArgv.source.alias[0]}`,
            )}') to be set`,
          ),
        )
        process.exit(1)
      } else {
        if (!fs.existsSync(sourceDirectory)) {
          outro(
            chalk.red(
              `Input directory to copy/symlink 'content' from not found ('${chalk.yellow(
                sourceDirectory,
              )}', invalid argument "${chalk.yellow(`-${CreateArgv.source.alias[0]}`)})`,
            ),
          )
          process.exit(1)
        } else if (!fs.lstatSync(sourceDirectory).isDirectory()) {
          outro(
            chalk.red(
              `Source directory to copy/symlink 'content' from is not a directory (found file at '${chalk.yellow(
                sourceDirectory,
              )}', invalid argument ${chalk.yellow(`-${CreateArgv.source.alias[0]}`)}")`,
            ),
          )
          process.exit(1)
        }
      }
    }
  }

  // Use cli process if cmd args werent provided
  if (!setupStrategy) {
    setupStrategy = exitIfCancel(
      await select({
        message: `Choose how to initialize the content in \`${contentFolder}\``,
        options: [
          { value: "new", label: "Empty Quartz" },
          { value: "copy", label: "Copy an existing folder", hint: "overwrites `content`" },
          {
            value: "symlink",
            label: "Symlink an existing folder",
            hint: "don't select this unless you know what you are doing!",
          },
        ],
      }),
    )
  }

  async function rmContentFolder() {
    const contentStat = await fs.promises.lstat(contentFolder)
    if (contentStat.isSymbolicLink()) {
      await fs.promises.unlink(contentFolder)
    } else {
      await rimraf(contentFolder)
    }
  }

  const gitkeepPath = path.join(contentFolder, ".gitkeep")
  if (fs.existsSync(gitkeepPath)) {
    await fs.promises.unlink(gitkeepPath)
  }
  if (setupStrategy === "copy" || setupStrategy === "symlink") {
    let originalFolder = sourceDirectory

    // If input directory was not passed, use cli
    if (!sourceDirectory) {
      originalFolder = escapePath(
        exitIfCancel(
          await text({
            message: "Enter the full path to existing content folder",
            placeholder:
              "On most terminal emulators, you can drag and drop a folder into the window and it will paste the full path",
            validate(fp) {
              const fullPath = escapePath(fp)
              if (!fs.existsSync(fullPath)) {
                return "The given path doesn't exist"
              } else if (!fs.lstatSync(fullPath).isDirectory()) {
                return "The given path is not a folder"
              }
            },
          }),
        ),
      )
    }

    await rmContentFolder()
    if (setupStrategy === "copy") {
      await fs.promises.cp(originalFolder, contentFolder, {
        recursive: true,
        preserveTimestamps: true,
      })
    } else if (setupStrategy === "symlink") {
      await fs.promises.symlink(originalFolder, contentFolder, "dir")
    }
  } else if (setupStrategy === "new") {
    await fs.promises.writeFile(
      path.join(contentFolder, "index.md"),
      `---
title: Welcome to Quartz
---

This is a blank Quartz installation.
See the [documentation](https://quartz.jzhao.xyz) for how to get started.
`,
    )
  }

  // Use cli process if cmd args werent provided
  if (!linkResolutionStrategy) {
    // get a preferred link resolution strategy
    linkResolutionStrategy = exitIfCancel(
      await select({
        message: `Choose how Quartz should resolve links in your content. This should match Obsidian's link format. You can change this later in \`quartz.config.ts\`.`,
        options: [
          {
            value: "shortest",
            label: "Treat links as shortest path",
            hint: "(default)",
          },
          {
            value: "absolute",
            label: "Treat links as absolute path",
          },
          {
            value: "relative",
            label: "Treat links as relative paths",
          },
        ],
      }),
    )
  }

  // now, do config changes
  const configFilePath = path.join(cwd, "quartz.config.ts")
  let configContent = await fs.promises.readFile(configFilePath, { encoding: "utf-8" })
  configContent = configContent.replace(
    /markdownLinkResolution: '(.+)'/,
    `markdownLinkResolution: '${linkResolutionStrategy}'`,
  )
  await fs.promises.writeFile(configFilePath, configContent)

  // setup remote
  execSync(
    `git remote show upstream || git remote add upstream https://github.com/jackyzha0/quartz.git`,
    { stdio: "ignore" },
  )

  outro(`You're all set! Not sure what to do next? Try:
  • Customizing Quartz a bit more by editing \`quartz.config.ts\`
  • Running \`npx quartz build --serve\` to preview your Quartz locally
  • Hosting your Quartz online (see: https://quartz.jzhao.xyz/hosting)
`)
}

/**
 * Handles `npx quartz build`
 * @param {*} argv arguments for `build`
 */
export async function handleBuild(argv) {
  if (argv.serve) {
    argv.watch = true
  }

  console.log(chalk.bgGreen.black(`\n Quartz v${version} \n`))
  const ctx = await esbuild.context({
    entryPoints: [fp],
    outfile: cacheFile,
    bundle: true,
    keepNames: true,
    minifyWhitespace: true,
    minifySyntax: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "preact",
    packages: "external",
    metafile: true,
    sourcemap: true,
    sourcesContent: false,
    plugins: [
      sassPlugin({
        type: "css-text",
        cssImports: true,
      }),
      sassPlugin({
        filter: /\.inline\.scss$/,
        type: "css",
        cssImports: true,
      }),
      {
        name: "inline-script-loader",
        setup(build) {
          build.onLoad({ filter: /\.inline\.(ts|js)$/ }, async (args) => {
            let text = await promises.readFile(args.path, "utf8")

            // remove default exports that we manually inserted
            text = text.replace("export default", "")
            text = text.replace("export", "")

            const sourcefile = path.relative(path.resolve("."), args.path)
            const resolveDir = path.dirname(sourcefile)
            const transpiled = await esbuild.build({
              stdin: {
                contents: text,
                loader: "ts",
                resolveDir,
                sourcefile,
              },
              write: false,
              bundle: true,
              minify: true,
              platform: "browser",
              format: "esm",
            })
            const rawMod = transpiled.outputFiles[0].text
            return {
              contents: rawMod,
              loader: "text",
            }
          })
        },
      },
    ],
  })

  const buildMutex = new Mutex()
  let lastBuildMs = 0
  let cleanupBuild = null
  const build = async (clientRefresh) => {
    const buildStart = new Date().getTime()
    lastBuildMs = buildStart
    const release = await buildMutex.acquire()
    if (lastBuildMs > buildStart) {
      release()
      return
    }

    if (cleanupBuild) {
      console.log(chalk.yellow("Detected a source code change, doing a hard rebuild..."))
      await cleanupBuild()
    }

    const result = await ctx.rebuild().catch((err) => {
      console.error(`${chalk.red("Couldn't parse Quartz configuration:")} ${fp}`)
      console.log(`Reason: ${chalk.grey(err)}`)
      process.exit(1)
    })
    release()

    if (argv.bundleInfo) {
      const outputFileName = "quartz/.quartz-cache/transpiled-build.mjs"
      const meta = result.metafile.outputs[outputFileName]
      console.log(
        `Successfully transpiled ${Object.keys(meta.inputs).length} files (${prettyBytes(
          meta.bytes,
        )})`,
      )
      console.log(await esbuild.analyzeMetafile(result.metafile, { color: true }))
    }

    // bypass module cache
    // https://github.com/nodejs/modules/issues/307
    const { default: buildQuartz } = await import(`../../${cacheFile}?update=${randomUUID()}`)
    // ^ this import is relative, so base "cacheFile" path can't be used

    cleanupBuild = await buildQuartz(argv, buildMutex, clientRefresh)
    clientRefresh()
  }

  let clientRefresh = () => {}
  if (argv.serve) {
    const connections = []
    clientRefresh = () => connections.forEach((conn) => conn.send("rebuild"))

    if (argv.baseDir !== "" && !argv.baseDir.startsWith("/")) {
      argv.baseDir = "/" + argv.baseDir
    }

    await build(clientRefresh)
    const server = http.createServer(async (req, res) => {
      if (argv.baseDir && !req.url?.startsWith(argv.baseDir)) {
        console.log(
          chalk.red(
            `[404] ${req.url} (warning: link outside of site, this is likely a Quartz bug)`,
          ),
        )
        res.writeHead(404)
        res.end()
        return
      }

      // strip baseDir prefix
      req.url = req.url?.slice(argv.baseDir.length)

      const serve = async () => {
        const release = await buildMutex.acquire()
        await serveHandler(req, res, {
          public: argv.output,
          directoryListing: false,
          headers: [
            {
              source: "**/*.*",
              headers: [{ key: "Content-Disposition", value: "inline" }],
            },
            {
              source: "**/*.webp",
              headers: [{ key: "Content-Type", value: "image/webp" }],
            },
            // fixes bug where avif images are displayed as text instead of images (future proof)
            {
              source: "**/*.avif",
              headers: [{ key: "Content-Type", value: "image/avif" }],
            },
          ],
        })
        const status = res.statusCode
        const statusString =
          status >= 200 && status < 300 ? chalk.green(`[${status}]`) : chalk.red(`[${status}]`)
        console.log(statusString + chalk.grey(` ${argv.baseDir}${req.url}`))
        release()
      }

      const redirect = (newFp) => {
        newFp = argv.baseDir + newFp
        res.writeHead(302, {
          Location: newFp,
        })
        console.log(chalk.yellow("[302]") + chalk.grey(` ${argv.baseDir}${req.url} -> ${newFp}`))
        res.end()
      }

      let fp = req.url?.split("?")[0] ?? "/"

      // handle redirects
      if (fp.endsWith("/")) {
        // /trailing/
        // does /trailing/index.html exist? if so, serve it
        const indexFp = path.posix.join(fp, "index.html")
        if (fs.existsSync(path.posix.join(argv.output, indexFp))) {
          req.url = fp
          return serve()
        }

        // does /trailing.html exist? if so, redirect to /trailing
        let base = fp.slice(0, -1)
        if (path.extname(base) === "") {
          base += ".html"
        }
        if (fs.existsSync(path.posix.join(argv.output, base))) {
          return redirect(fp.slice(0, -1))
        }
      } else {
        // /regular
        // does /regular.html exist? if so, serve it
        let base = fp
        if (path.extname(base) === "") {
          base += ".html"
        }
        if (fs.existsSync(path.posix.join(argv.output, base))) {
          req.url = fp
          return serve()
        }

        // does /regular/index.html exist? if so, redirect to /regular/
        let indexFp = path.posix.join(fp, "index.html")
        if (fs.existsSync(path.posix.join(argv.output, indexFp))) {
          return redirect(fp + "/")
        }
      }

      return serve()
    })

    server.listen(argv.port)
    const wss = new WebSocketServer({ port: argv.wsPort })
    wss.on("connection", (ws) => connections.push(ws))
    console.log(
      chalk.cyan(
        `Started a Quartz server listening at http://localhost:${argv.port}${argv.baseDir}`,
      ),
    )
  } else {
    await build(clientRefresh)
    ctx.dispose()
  }

  if (argv.watch) {
    const paths = await globby([
      "**/*.ts",
      "quartz/cli/*.js",
      "quartz/static/**/*",
      "**/*.tsx",
      "**/*.scss",
      "package.json",
    ])
    chokidar
      .watch(paths, { ignoreInitial: true })
      .on("add", () => build(clientRefresh))
      .on("change", () => build(clientRefresh))
      .on("unlink", () => build(clientRefresh))

    console.log(chalk.grey("hint: exit with ctrl+c"))
  }
}

/**
 * Handles `npx quartz update`
 * @param {*} argv arguments for `update`
 */
export async function handleUpdate(argv) {
  const contentFolder = resolveContentPath(argv.directory)
  console.log(chalk.bgGreen.black(`\n Quartz v${version} \n`))
  console.log("Backing up your content")
  execSync(
    `git remote show upstream || git remote add upstream https://github.com/jackyzha0/quartz.git`,
  )
  await stashContentFolder(contentFolder)
  console.log(
    "Pulling updates... you may need to resolve some `git` conflicts if you've made changes to components or plugins.",
  )

  try {
    gitPull(UPSTREAM_NAME, QUARTZ_SOURCE_BRANCH)
  } catch {
    console.log(chalk.red("An error occurred above while pulling updates."))
    await popContentFolder(contentFolder)
    return
  }

  await popContentFolder(contentFolder)
  console.log("Ensuring dependencies are up to date")

  /*
  On Windows, if the command `npm` is really `npm.cmd', this call fails
  as it will be unable to find `npm`. This is often the case on systems
  where `npm` is installed via a package manager.

  This means `npx quartz update` will not actually update dependencies
  on Windows, without a manual `npm i` from the caller.

  However, by spawning a shell, we are able to call `npm.cmd`.
  See: https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows
  */

  const opts = { stdio: "inherit" }
  if (process.platform === "win32") {
    opts.shell = true
  }

  const res = spawnSync("npm", ["i"], opts)
  if (res.status === 0) {
    console.log(chalk.green("Done!"))
  } else {
    console.log(chalk.red("An error occurred above while installing dependencies."))
  }
}

/**
 * Handles `npx quartz restore`
 * @param {*} argv arguments for `restore`
 */
export async function handleRestore(argv) {
  const contentFolder = resolveContentPath(argv.directory)
  await popContentFolder(contentFolder)
}

/**
 * Handles `npx quartz sync`
 * @param {*} argv arguments for `sync`
 */
export async function handleSync(argv) {
  const contentFolder = resolveContentPath(argv.directory)
  console.log(chalk.bgGreen.black(`\n Quartz v${version} \n`))
  console.log("Backing up your content")

  if (argv.commit) {
    const contentStat = await fs.promises.lstat(contentFolder)
    if (contentStat.isSymbolicLink()) {
      const linkTarg = await fs.promises.readlink(contentFolder)
      console.log(chalk.yellow("Detected symlink, trying to dereference before committing"))

      // stash symlink file
      await stashContentFolder(contentFolder)

      // follow symlink and copy content
      await fs.promises.cp(linkTarg, contentFolder, {
        recursive: true,
        preserveTimestamps: true,
      })
    }

    const currentTimestamp = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })
    const commitMessage = argv.message ?? `Quartz sync: ${currentTimestamp}`
    spawnSync("git", ["add", "."], { stdio: "inherit" })
    spawnSync("git", ["commit", "-m", commitMessage], { stdio: "inherit" })

    if (contentStat.isSymbolicLink()) {
      // put symlink back
      await popContentFolder(contentFolder)
    }
  }

  await stashContentFolder(contentFolder)

  if (argv.pull) {
    console.log(
      "Pulling updates from your repository. You may need to resolve some `git` conflicts if you've made changes to components or plugins.",
    )
    try {
      gitPull(ORIGIN_NAME, QUARTZ_SOURCE_BRANCH)
    } catch {
      console.log(chalk.red("An error occurred above while pulling updates."))
      await popContentFolder(contentFolder)
      return
    }
  }

  await popContentFolder(contentFolder)
  if (argv.push) {
    console.log("Pushing your changes")
    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim()
    const res = spawnSync("git", ["push", "-uf", ORIGIN_NAME, currentBranch], {
      stdio: "inherit",
    })
    if (res.status !== 0) {
      console.log(chalk.red(`An error occurred above while pushing to remote ${ORIGIN_NAME}.`))
      return
    }
  }

  console.log(chalk.green("Done!"))
}

/**
 * Handles `npx quartz transcribe`
 * @param {*} argv arguments for `transcribe`
 */
export async function handleTranscribe(argv) {
  console.log(chalk.bgGreen.black(`\n Quartz v${version} - Transcription \n`))

  try {
    // Dynamic import for ES modules
    const { AudioProcessor } = await import("../transcribe/audio-processor.js")
    const { WhisperClient } = await import("../transcribe/whisper-client.js")
    const { LocalWhisperClient } = await import("../transcribe/local-whisper-client.js")
    const { CharacterParser } = await import("../transcribe/character-parser.js")
    const { SessionFormatter } = await import("../transcribe/session-formatter.js")

    const processor = new AudioProcessor()
    const parser = new CharacterParser()
    const formatter = new SessionFormatter()

    // Initialize appropriate Whisper client based on backend choice
    let whisperClient
    if (argv.backend === "api") {
      if (!argv.apiKey && !process.env.OPENAI_API_KEY) {
        console.error(chalk.red("OpenAI API key is required for API backend."))
        console.error(chalk.grey("Set OPENAI_API_KEY environment variable or use --api-key flag."))
        console.error(chalk.grey("Alternatively, use --backend local for offline transcription."))
        process.exit(1)
      }
      whisperClient = new WhisperClient(argv.apiKey)
      console.log(chalk.blue("Using OpenAI Whisper API"))
    } else {
      whisperClient = new LocalWhisperClient()
      console.log(chalk.blue(`Using local Whisper (${argv.whisperModel} model)`))

      // Check local installation
      const installation = await whisperClient.checkInstallation()
      if (!installation.whisperInstalled) {
        console.log(chalk.yellow("Local Whisper not found."))
        if (argv.installWhisper) {
          console.log(chalk.blue("Attempting to install Whisper..."))
          const installed = await whisperClient.installWhisper()
          if (!installed) {
            console.error(chalk.red("Failed to install Whisper automatically."))
            console.error(chalk.grey("Please install manually: pip install openai-whisper"))
            process.exit(1)
          }
        } else {
          console.error(chalk.red("Whisper is not installed."))
          console.error(chalk.grey("Install with: pip install openai-whisper"))
          console.error(chalk.grey("Or use --install-whisper flag for automatic installation"))
          process.exit(1)
        }
      }

      if (!installation.pythonAvailable) {
        console.error(chalk.red("Python is not available. Please install Python 3.8+"))
        process.exit(1)
      }

      if (!installation.ffmpegAvailable) {
        console.error(chalk.red("FFmpeg is not available. Please install FFmpeg"))
        process.exit(1)
      }
    }

    // Validate input file
    console.log(chalk.blue("Validating MKV file..."))
    const isValidMkv = await processor.validateMkvFile(argv.file)
    if (!isValidMkv) {
      console.error(chalk.red("Invalid MKV file"))
      process.exit(1)
    }

    // Extract and process audio
    console.log(chalk.blue("Processing audio..."))
    const processedAudio = await processor.extractAudioFromMkv(argv.file, {
      enhanceDiscord: argv.enhanceDiscord,
      outputFormat: "wav",
    })

    console.log(
      chalk.green(
        `Audio extracted: ${processor.formatDuration(processedAudio.duration)} duration`
      )
    )

    // Split into chunks if necessary
    const audioChunks = await processor.splitAudioIntoChunks(
      processedAudio.path,
      argv.chunkSize
    )

    let transcriptionResult
    if (audioChunks.length === 1) {
      console.log(chalk.blue("Transcribing audio..."))
      if (argv.backend === "api") {
        transcriptionResult = await whisperClient.transcribeFile(audioChunks[0], {
          responseFormat: "verbose_json",
          temperature: 0,
        })
      } else {
        transcriptionResult = await whisperClient.transcribeFile(audioChunks[0], {
          model: argv.whisperModel,
          outputFormat: "json",
          temperature: 0,
          wordTimestamps: true,
        })
      }
    } else {
      console.log(chalk.blue(`Transcribing ${audioChunks.length} audio chunks...`))
      if (argv.backend === "api") {
        const chunkResults = await whisperClient.transcribeChunks(audioChunks, {
          responseFormat: "verbose_json",
          temperature: 0,
        })
        transcriptionResult = whisperClient.combineChunkResults(chunkResults)
      } else {
        const chunkResults = await whisperClient.transcribeChunks(audioChunks, {
          model: argv.whisperModel,
          outputFormat: "json",
          temperature: 0,
          wordTimestamps: true,
        })
        transcriptionResult = whisperClient.combineChunkResults(chunkResults)
      }
    }

    // Parse segments if available
    let parsedSegments = []
    if (transcriptionResult.segments) {
      parsedSegments = transcriptionResult.segments.map(segment =>
        parser.parseSegment(segment)
      )

      if (argv.groupSpeakers) {
        parsedSegments = parser.groupSegmentsBySpeaker(parsedSegments)
      }
    }

    // Generate metadata
    const metadata = {
      sessionNumber: argv.session,
      date: argv.date || new Date().toISOString().split("T")[0],
      duration: processor.formatDuration(processedAudio.duration),
      processingDate: new Date().toISOString(),
      audioQuality: parsedSegments.length > 0 ? formatter.assessAudioQuality(parsedSegments) : undefined,
      notes: formatter.generateProcessingNotes(argv.file, transcriptionResult, parsedSegments),
    }

    // Format transcription
    const formattedTranscription = formatter.formatTranscription(transcriptionResult, metadata, {
      includeTimestamps: argv.includeTimestamps,
      groupBySpeaker: argv.groupSpeakers,
      markLowConfidence: argv.markLowConfidence,
      confidenceThreshold: argv.confidenceThreshold,
      includeProcessingNotes: true,
    })

    // Determine output filename and path
    const outputFilename = argv.output || formatter.generateFilename(argv.session, argv.date)
    const contentDir = path.join(cwd, "content", "Session Notes")
    const outputPath = path.join(contentDir, outputFilename)

    // Ensure content directory exists
    await promises.mkdir(contentDir, { recursive: true })

    // Write the transcription file
    await promises.writeFile(outputPath, formattedTranscription, "utf8")

    console.log(chalk.green(`\nTranscription completed!`))
    console.log(chalk.grey(`Output: ${outputPath}`))
    console.log(chalk.grey(`Duration: ${metadata.duration}`))
    console.log(chalk.grey(`Quality: ${metadata.audioQuality || "unknown"}`))

    if (parsedSegments.length > 0) {
      const unknownSegments = parsedSegments.filter(s => s.speaker === "Unknown").length
      if (unknownSegments > 0) {
        console.log(chalk.yellow(`Note: ${unknownSegments} segments with unidentified speakers`))
      }
    }

    // Cleanup temporary files
    if (!argv.keepTemp) {
      console.log(chalk.grey("Cleaning up temporary files..."))
      await processor.cleanup([processedAudio.path, ...audioChunks])
    } else {
      console.log(chalk.grey(`Temporary files kept in: ${processor.tempDir}`))
    }

    console.log(chalk.green("\nDone! You can now review and edit the transcription."))

  } catch (error) {
    console.error(chalk.red("\nTranscription failed:"), error.message)
    if (argv.verbose) {
      console.error(error)
    }
    process.exit(1)
  }
}
