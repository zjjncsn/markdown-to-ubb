interface TextNode {
  type: 'text'
  text: string
}

interface TagNode {
  type: 'tag'
  name: string
  raw: string
  value: string
  params: string[]
  children: UbbNode[]
}

type UbbNode = TextNode | TagNode

const recursiveTags = new Set([
  'b',
  'i',
  'u',
  's',
  'del',
  'em',
  'size',
  'color',
  'font',
  'align',
  'center',
  'left',
  'right',
  'url',
  'quote',
  'table',
  'tr',
  'td',
  'th',
])

const textTags = new Set(['code', 'img'])
const emptyTagPattern = /^(?:ac|ms|em)\d+$/i

export function renderUbbPreview(input: string): string {
  return renderNodes(parseUbb(input), 'root')
}

function parseUbb(input: string): UbbNode[] {
  const root: TagNode = {
    type: 'tag',
    name: 'root',
    raw: '',
    value: '',
    params: [],
    children: [],
  }
  const stack: TagNode[] = [root]
  let index = 0

  while (index < input.length) {
    const openIndex = input.indexOf('[', index)

    if (openIndex < 0) {
      appendText(stack, input.slice(index))
      break
    }

    if (openIndex > index) {
      appendText(stack, input.slice(index, openIndex))
    }

    const closeIndex = input.indexOf(']', openIndex)

    if (closeIndex < 0) {
      appendText(stack, input.slice(openIndex))
      break
    }

    const tagContent = input.slice(openIndex + 1, closeIndex)

    if (tagContent.startsWith('/')) {
      const tagName = tagContent.slice(1).trim().toLowerCase()
      const matchingIndex = findOpenTag(stack, tagName)

      if (matchingIndex > 0) {
        stack.length = matchingIndex
      } else {
        appendText(stack, input.slice(openIndex, closeIndex + 1))
      }

      index = closeIndex + 1
      continue
    }

    const tag = parseTag(tagContent)

    if (!tag || !isSupportedTag(tag.name)) {
      appendText(stack, input.slice(openIndex, closeIndex + 1))
      index = closeIndex + 1
      continue
    }

    if (isEmptyTag(tag.name) || isSelfClosingTag(tag.name)) {
      current(stack).children.push(tag)
      index = closeIndex + 1
      continue
    }

    if (textTags.has(tag.name)) {
      const endTag = `[/${tag.name}]`
      const endIndex = input.toLowerCase().indexOf(endTag, closeIndex + 1)

      if (endIndex < 0) {
        appendText(stack, input.slice(openIndex, closeIndex + 1))
        index = closeIndex + 1
        continue
      }

      tag.children.push({ type: 'text', text: input.slice(closeIndex + 1, endIndex) })
      current(stack).children.push(tag)
      index = endIndex + endTag.length
      continue
    }

    current(stack).children.push(tag)
    stack.push(tag)
    index = closeIndex + 1
  }

  return root.children
}

function appendText(stack: TagNode[], text: string) {
  if (!text) return

  current(stack).children.push({ type: 'text', text })
}

function current(stack: TagNode[]) {
  return stack[stack.length - 1]!
}

function findOpenTag(stack: TagNode[], name: string) {
  for (let index = stack.length - 1; index > 0; index -= 1) {
    if (stack[index]?.name === name) return index
  }

  return -1
}

function parseTag(raw: string): TagNode | null {
  const trimmed = raw.trim()

  if (!trimmed) return null

  const match = trimmed.match(/^([^\s=,]+)(?:=(.*))?$/)

  if (!match?.[1]) return null

  const value = match[2]?.trim() ?? ''

  return {
    type: 'tag',
    name: match[1].toLowerCase(),
    raw,
    value,
    params: value ? value.split(',').map((item) => item.trim()) : [],
    children: [],
  }
}

function isSupportedTag(name: string) {
  return recursiveTags.has(name) || textTags.has(name) || isEmptyTag(name) || isSelfClosingTag(name)
}

function isEmptyTag(name: string) {
  return emptyTagPattern.test(name)
}

function isSelfClosingTag(name: string) {
  return name === 'hr' || name === 'line'
}

function renderNodes(nodes: UbbNode[], parentName: string): string {
  return nodes.map((node) => renderNode(node, parentName)).join('')
}

function renderNode(node: UbbNode, parentName: string): string {
  if (node.type === 'text') {
    if (isTableStructureTag(parentName) && node.text.trim() === '') return ''

    return escapeHtml(node.text).replace(/\n/g, '<br />')
  }

  const content = renderNodes(node.children, node.name)

  switch (node.name) {
    case 'b':
      return `<span style="font-weight: bold">${content}</span>`
    case 'i':
      return `<span style="font-style: italic">${content}</span>`
    case 'u':
      return `<span style="text-decoration: underline">${content}</span>`
    case 's':
    case 'del':
      return `<span style="text-decoration: line-through">${content}</span>`
    case 'em':
      return `<span class="ubb-emphasis">${content}</span>`
    case 'size':
      return renderSize(node, content)
    case 'color':
      return node.value ? `<span style="color: ${escapeAttribute(node.value)}">${content}</span>` : content
    case 'font':
      return node.value ? `<span style="font-family: ${escapeAttribute(node.value)}">${content}</span>` : content
    case 'align':
      return renderAlign(node.value, content)
    case 'center':
      return renderAlign('center', content)
    case 'left':
      return renderAlign('left', content)
    case 'right':
      return renderAlign('right', content)
    case 'url':
      return renderUrl(node, content)
    case 'img':
      return renderImage(node)
    case 'quote':
      return `<blockquote>${content}</blockquote>`
    case 'code':
      return `<pre><code>${escapeHtml(node.children.map((child) => (child.type === 'text' ? child.text : '')).join(''))}</code></pre>`
    case 'table':
      return `<table class="UBBTableTag">${content}</table>`
    case 'tr':
      return `<tr>${content}</tr>`
    case 'td':
      return renderTableCell('td', node, content)
    case 'th':
      return renderTableCell('th', node, content)
    case 'hr':
    case 'line':
      return '<hr />'
    default:
      if (isEmptyTag(node.name)) {
        return `<span class="ubb-placeholder">:${escapeHtml(node.name)}:</span>`
      }

      return content
  }
}

function renderSize(node: TagNode, content: string) {
  const size = Number.parseInt(node.value, 10)

  if (Number.isNaN(size) || size <= 0) return content

  const fontSize = size > 7 ? 3.5 : size / 2

  return `<span style="font-size: ${fontSize / 1.5}rem">${content}</span>`
}

function renderAlign(value: string, content: string) {
  const align = ['left', 'center', 'right'].includes(value) ? value : 'left'

  return `<div style="text-align: ${align}">${content}</div>`
}

function renderUrl(node: TagNode, content: string) {
  const href = node.value || stripHtml(content)

  if (!isSafeUrl(href)) return content

  return `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener" class="urlStyle">${content}</a>`
}

function renderImage(node: TagNode) {
  const src = node.children.map((child) => (child.type === 'text' ? child.text : '')).join('').trim()

  if (!src || !isSafeUrl(src, true)) {
    return escapeHtml(src)
  }

  const title = node.value ? ` title="${escapeAttribute(node.value)}"` : ''

  return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(node.value)}"${title} />`
}

function renderTableCell(tagName: 'td' | 'th', node: TagNode, content: string) {
  const [rowSpanValue, colSpanValue] = node.params
  const rowSpan = Number.parseInt(rowSpanValue ?? '', 10)
  const colSpan = Number.parseInt(colSpanValue ?? '', 10)
  const rowSpanAttribute = Number.isFinite(rowSpan) && rowSpan > 1 ? ` rowspan="${rowSpan}"` : ''
  const colSpanAttribute = Number.isFinite(colSpan) && colSpan > 1 ? ` colspan="${colSpan}"` : ''

  return `<${tagName}${rowSpanAttribute}${colSpanAttribute}>${content}</${tagName}>`
}

function isTableStructureTag(name: string) {
  return name === 'table' || name === 'tr'
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '')
}

function isSafeUrl(value: string, allowDataImage = false) {
  const trimmed = value.trim().toLowerCase()

  if (!trimmed) return false
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('vbscript:')) return false
  if (trimmed.startsWith('data:')) return allowDataImage && trimmed.startsWith('data:image/')

  return true
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('\n', ' ')
}
