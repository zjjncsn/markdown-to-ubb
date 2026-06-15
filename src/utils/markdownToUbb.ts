import MarkdownIt from 'markdown-it'
import type { RenderRule } from 'markdown-it/lib/renderer.mjs'
import type Token from 'markdown-it/lib/token.mjs'

export interface MarkdownToUbbOptions {
  preserveSoftBreaks: boolean
  keepCodeLanguage: boolean
  boldTableHeader: boolean
  showPromotion: boolean
  headingFormats: Record<HeadingLevel, HeadingFormat>
  ubbTemplates: UbbTemplates
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface HeadingFormat {
  size: number
  bold: boolean
}

export interface UbbPair {
  enabled: boolean
  open: string
  close: string
}

export interface UbbSingle {
  enabled: boolean
  value: string
}

export interface UbbTemplates {
  bold: UbbPair
  italic: UbbPair
  strike: UbbPair
  inlineCode: UbbPair
  codeBlock: UbbPair
  quote: UbbPair
  unorderedList: UbbPair
  orderedList: UbbPair
  listItem: UbbPair
  link: UbbPair
  taskChecked: UbbSingle
  taskUnchecked: UbbSingle
  table: UbbPair
  tableRow: UbbPair
  tableCell: UbbPair
  tableHeaderCell: UbbPair
  image: UbbSingle
  horizontalRule: UbbSingle
}

export const defaultMarkdownToUbbOptions: MarkdownToUbbOptions = {
  preserveSoftBreaks: true,
  keepCodeLanguage: false,
  boldTableHeader: true,
  showPromotion: true,
  headingFormats: {
    1: { size: 6, bold: true },
    2: { size: 5, bold: true },
    3: { size: 4, bold: true },
    4: { size: 3, bold: true },
    5: { size: 2, bold: true },
    6: { size: 2, bold: true },
  },
  ubbTemplates: {
    bold: { enabled: true, open: '[b]', close: '[/b]' },
    italic: { enabled: true, open: '[i]', close: '[/i]' },
    strike: { enabled: true, open: '[s]', close: '[/s]' },
    inlineCode: { enabled: true, open: '[code]', close: '[/code]' },
    codeBlock: { enabled: true, open: '[code]', close: '[/code]' },
    quote: { enabled: true, open: '[quote]', close: '[/quote]' },
    unorderedList: { enabled: true, open: '[list]', close: '[/list]' },
    orderedList: { enabled: true, open: '[list=1]', close: '[/list]' },
    listItem: { enabled: true, open: '[*]', close: '' },
    link: { enabled: true, open: '[url={href}]', close: '[/url]' },
    taskChecked: { enabled: true, value: '[x] ' },
    taskUnchecked: { enabled: true, value: '[ ] ' },
    table: { enabled: true, open: '[table]', close: '[/table]' },
    tableRow: { enabled: true, open: '[tr]', close: '[/tr]' },
    tableCell: { enabled: true, open: '[td]', close: '[/td]' },
    tableHeaderCell: { enabled: true, open: '[td]', close: '[/td]' },
    image: { enabled: true, value: '[img]{src}[/img]' },
    horizontalRule: { enabled: true, value: '[hr]' },
  },
}

const normalizeOutput = (value: string) => value.replace(/\n{2,}/g, '\n').trim()
const promotionText =
  '该内容使用 @考拉炒酸奶 开发的 [url=https://ubb.sci-tech.top]markdown 转 ubb 工具[/url]进行转换。'

const renderText: RenderRule = (tokens, idx) => tokens[idx]?.content ?? ''

const applyTemplate = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, value), template)

const getHeadingLevel = (tag: string): HeadingLevel => {
  const level = Number(tag.replace('h', ''))

  if (level >= 1 && level <= 6) return level as HeadingLevel

  return 3
}

const getHeadingPair = (format: HeadingFormat): Pick<UbbPair, 'open' | 'close'> => {
  const open = `${format.size > 0 ? `[size=${format.size}]` : ''}${format.bold ? '[b]' : ''}`
  const close = `${format.bold ? '[/b]' : ''}${format.size > 0 ? '[/size]' : ''}`

  return { open, close }
}

const wrapContent = (content: string, pair: UbbPair) =>
  pair.enabled ? `${pair.open}${content}${pair.close}` : content

function enableTaskList(md: MarkdownIt) {
  md.core.ruler.after('inline', 'ubb_task_list', (state) => {
    for (let index = 2; index < state.tokens.length; index += 1) {
      const token = state.tokens[index]
      const previousToken = state.tokens[index - 1]
      const listItemToken = state.tokens[index - 2]

      if (token?.type !== 'inline' || previousToken?.type !== 'paragraph_open') continue
      if (listItemToken?.type !== 'list_item_open') continue

      const match = token.content.match(/^\[([ xX])\]\s+/)

      if (!match) continue

      const checked = match[1]?.toLowerCase() === 'x'
      token.content = token.content.slice(match[0].length)
      token.children = removeTaskMarker(token.children)
      listItemToken.attrSet('data-task', checked ? 'checked' : 'unchecked')
    }
  })
}

function removeTaskMarker(children: Token[] | null) {
  if (!children?.length) return children

  const firstToken = children[0]

  if (firstToken?.type === 'text') {
    firstToken.content = firstToken.content.replace(/^\[([ xX])\]\s+/, '')
  }

  return children
}

export function markdownToUbb(
  markdown: string,
  userOptions: Partial<MarkdownToUbbOptions> = {},
): string {
  const options: MarkdownToUbbOptions = {
    ...defaultMarkdownToUbbOptions,
    ...userOptions,
    headingFormats: {
      ...defaultMarkdownToUbbOptions.headingFormats,
      ...userOptions.headingFormats,
    },
    ubbTemplates: {
      ...defaultMarkdownToUbbOptions.ubbTemplates,
      ...userOptions.ubbTemplates,
    },
  }
  const tags = options.ubbTemplates

  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: options.preserveSoftBreaks,
    typographer: false,
  })
  enableTaskList(md)

  md.renderer.rules.text = renderText
  md.renderer.rules.paragraph_open = () => ''
  md.renderer.rules.paragraph_close = (tokens, idx) => (tokens[idx + 1]?.type === 'blockquote_close' ? '' : '\n')
  md.renderer.rules.softbreak = () => (options.preserveSoftBreaks ? '\n' : ' ')
  md.renderer.rules.hardbreak = () => '\n'

  md.renderer.rules.strong_open = () => (tags.bold.enabled ? tags.bold.open : '')
  md.renderer.rules.strong_close = () => (tags.bold.enabled ? tags.bold.close : '')
  md.renderer.rules.em_open = () => (tags.italic.enabled ? tags.italic.open : '')
  md.renderer.rules.em_close = () => (tags.italic.enabled ? tags.italic.close : '')
  md.renderer.rules.s_open = () => (tags.strike.enabled ? tags.strike.open : '')
  md.renderer.rules.s_close = () => (tags.strike.enabled ? tags.strike.close : '')

  md.renderer.rules.heading_open = (tokens, idx) => {
    const tag = tokens[idx]?.tag ?? 'h3'
    return getHeadingPair(options.headingFormats[getHeadingLevel(tag)]).open
  }
  md.renderer.rules.heading_close = (tokens, idx) => {
    const tag = tokens[idx]?.tag ?? 'h3'
    return `${getHeadingPair(options.headingFormats[getHeadingLevel(tag)]).close}\n`
  }

  md.renderer.rules.link_open = (tokens, idx) => {
    const href = tokens[idx]?.attrGet('href') ?? ''
    return href && tags.link.enabled ? applyTemplate(tags.link.open, { href }) : ''
  }
  md.renderer.rules.link_close = () => (tags.link.enabled ? tags.link.close : '')

  md.renderer.rules.image = (tokens, idx) => {
    const token = tokens[idx]
    const src = token?.attrGet('src') ?? ''
    const alt = token?.content ?? ''

    if (!src) return alt
    if (!tags.image.enabled) return src

    return applyTemplate(tags.image.value, { alt, src })
  }

  md.renderer.rules.code_inline = (tokens, idx) =>
    wrapContent(tokens[idx]?.content ?? '', tags.inlineCode)
  md.renderer.rules.code_block = (tokens, idx) =>
    `${wrapContent(tokens[idx]?.content ?? '', tags.codeBlock)}\n`
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]
    const language = token?.info.trim().split(/\s+/)[0] ?? ''
    const content = token?.content ?? ''

    if (!tags.codeBlock.enabled) return `${content}\n`

    const codeTag =
      options.keepCodeLanguage && language
        ? applyTemplate(tags.codeBlock.open, { lang: language })
        : tags.codeBlock.open

    return `${codeTag}${content}${tags.codeBlock.close}\n`
  }

  md.renderer.rules.blockquote_open = () => (tags.quote.enabled ? tags.quote.open : '')
  md.renderer.rules.blockquote_close = () => (tags.quote.enabled ? `${tags.quote.close}\n` : '\n')

  md.renderer.rules.bullet_list_open = () =>
    tags.unorderedList.enabled ? `${tags.unorderedList.open}\n` : ''
  md.renderer.rules.bullet_list_close = () =>
    tags.unorderedList.enabled ? `${tags.unorderedList.close}\n` : '\n'
  md.renderer.rules.ordered_list_open = () =>
    tags.orderedList.enabled ? `${tags.orderedList.open}\n` : ''
  md.renderer.rules.ordered_list_close = () =>
    tags.orderedList.enabled ? `${tags.orderedList.close}\n` : '\n'
  md.renderer.rules.list_item_open = (tokens, idx) => {
    const token = tokens[idx]
    const taskState = token?.attrGet('data-task')
    const checked = taskState === 'checked'
    const unchecked = taskState === 'unchecked'

    if (checked && tags.taskChecked.enabled) return `${tags.listItem.enabled ? tags.listItem.open : ''}${tags.taskChecked.value}`
    if (unchecked && tags.taskUnchecked.enabled) {
      return `${tags.listItem.enabled ? tags.listItem.open : ''}${tags.taskUnchecked.value}`
    }

    return tags.listItem.enabled ? tags.listItem.open : ''
  }
  md.renderer.rules.list_item_close = () => (tags.listItem.enabled ? `${tags.listItem.close}\n` : '\n')

  md.renderer.rules.table_open = () => (tags.table.enabled ? `${tags.table.open}\n` : '')
  md.renderer.rules.table_close = () => (tags.table.enabled ? `${tags.table.close}\n` : '\n')
  md.renderer.rules.thead_open = () => ''
  md.renderer.rules.thead_close = () => ''
  md.renderer.rules.tbody_open = () => ''
  md.renderer.rules.tbody_close = () => ''
  md.renderer.rules.tr_open = () => (tags.tableRow.enabled ? tags.tableRow.open : '')
  md.renderer.rules.tr_close = () => (tags.tableRow.enabled ? `${tags.tableRow.close}\n` : '\n')
  md.renderer.rules.th_open = () => {
    const cellOpen = tags.tableHeaderCell.enabled ? tags.tableHeaderCell.open : ''
    const boldOpen = options.boldTableHeader && tags.bold.enabled ? tags.bold.open : ''

    return `${cellOpen}${boldOpen}`
  }
  md.renderer.rules.th_close = () => {
    const boldClose = options.boldTableHeader && tags.bold.enabled ? tags.bold.close : ''
    const cellClose = tags.tableHeaderCell.enabled ? tags.tableHeaderCell.close : ''

    return `${boldClose}${cellClose}`
  }
  md.renderer.rules.td_open = () => (tags.tableCell.enabled ? tags.tableCell.open : '')
  md.renderer.rules.td_close = () => (tags.tableCell.enabled ? tags.tableCell.close : '')

  md.renderer.rules.hr = () => (tags.horizontalRule.enabled ? `${tags.horizontalRule.value}\n` : '')
  md.renderer.rules.html_inline = () => ''
  md.renderer.rules.html_block = () => ''

  const result = normalizeOutput(md.render(markdown))

  if (!options.showPromotion) return result

  return [result, promotionText].filter(Boolean).join('\n')
}
