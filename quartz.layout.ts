import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// Shared filter and map functions for Explorer
const explorerFilterFn = (node: any) => {
  const omit = new Set(["rime's compendium"])
  return !omit.has(node.displayName.toLowerCase())
}

const explorerMapFn = (node: any) => {
  const emojiMap: Record<string, string> = {
    "allies, npcs, & special creatures": "🎭",
    "bestiary": "🧟",
    "chronicles": "📖",
    "events": "🗓️",
    "locations & lore": "🗺️",
    "session notes": "📓",
    "special items": "💎",
  }
  const normalized = node.displayName.replace(/^([^\w\s]|[\uD800-\uDBFF][\uDC00-\uDFFF])\s*/, "").toLowerCase()
  const emoji = emojiMap[normalized]
  if (emoji) {
    node.displayName = `${emoji} ${node.displayName.replace(/^([^\w\s]|[\uD800-\uDBFF][\uDC00-\uDFFF])\s*/, "")}`
  } else if (node.isFolder) {
    node.displayName = "📁 " + node.displayName.replace(/^([^\w\s]|[\uD800-\uDBFF][\uDC00-\uDFFF])\s*/, "")
  } else {
    node.displayName = "📄 " + node.displayName.replace(/^([^\w\s]|[\uD800-\uDBFF][\uDC00-\uDFFF])\s*/, "")
  }
}

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer({
      filterFn: explorerFilterFn,
      mapFn: explorerMapFn,
    }),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({
      filterFn: explorerFilterFn,
      mapFn: explorerMapFn,
    }),
  ],
  right: [],
}
