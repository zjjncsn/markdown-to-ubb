<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { computed, ref, toRaw, watch } from 'vue'
import {
  defaultMarkdownToUbbOptions,
  markdownToUbb,
  type HeadingLevel,
  type MarkdownToUbbOptions,
} from '@/utils/markdownToUbb'
import { renderUbbPreview } from '@/utils/renderUbbPreview'

const sampleMarkdown = `# Markdown 转 UBB

这是一段 **加粗**、*斜体*、~~删除线~~ 和 \`行内代码\`。

同一段里的第一行
同一段里的第二行

> 引用内容会被转换成 quote 标签。

## 列表

- 第一项
- 第二项，包含 [链接](https://example.com)
- 第三项，包含图片：![示例图](https://ubb.sci-tech.top/icon.png)

## 任务列表

- [x] 已完成的事项
- [ ] 未完成的事项

## 表格

| 语法 | UBB |
| --- | --- |
| 表格 | 【table】 |
| 行 | 【tr】 |
| 单元格 | 【td】 |

---

\`\`\`ts
const message = 'hello ubb'
console.log(message)
\`\`\`
`

interface SettingsProfile {
  id: string
  name: string
  options: MarkdownToUbbOptions
}

interface StoredProfiles {
  activeProfileId: string
  profiles: SettingsProfile[]
}

const settingsStorageKey = 'markdown-to-ubb:settings:v1'
const profilesStorageKey = 'markdown-to-ubb:profiles:v1'
const defaultProfileId = 'default'
const cc98ProfileId = 'cc98'
const headingLevels = [1, 2, 3, 4, 5, 6] as const satisfies readonly HeadingLevel[]

const createDefaultOptions = (): MarkdownToUbbOptions => structuredClone(defaultMarkdownToUbbOptions)

const cloneOptions = (value: MarkdownToUbbOptions): MarkdownToUbbOptions =>
  JSON.parse(JSON.stringify(toRaw(value))) as MarkdownToUbbOptions

function applyCc98HeadingSizes(options: MarkdownToUbbOptions) {
  options.headingFormats[1].size = '07'
  options.headingFormats[2].size = 7
}

function mergeOptions(savedOptions: Partial<MarkdownToUbbOptions>): MarkdownToUbbOptions {
  const options = createDefaultOptions()

  if (typeof savedOptions.preserveSoftBreaks === 'boolean') {
    options.preserveSoftBreaks = savedOptions.preserveSoftBreaks
  }

  if (typeof savedOptions.addBlankLineAfterBlock === 'boolean') {
    options.addBlankLineAfterBlock = savedOptions.addBlankLineAfterBlock
  }

  if (typeof savedOptions.keepCodeLanguage === 'boolean') {
    options.keepCodeLanguage = savedOptions.keepCodeLanguage
  }

  if (typeof savedOptions.boldTableHeader === 'boolean') {
    options.boldTableHeader = savedOptions.boldTableHeader
  }

  if (typeof savedOptions.showPromotion === 'boolean') {
    options.showPromotion = savedOptions.showPromotion
  }

  for (const level of headingLevels) {
    const savedHeading = savedOptions.headingFormats?.[level]

    if (!savedHeading) continue

    if (typeof savedHeading.size === 'number' || typeof savedHeading.size === 'string') {
      options.headingFormats[level].size = savedHeading.size
    }

    if (typeof savedHeading.bold === 'boolean') {
      options.headingFormats[level].bold = savedHeading.bold
    }
  }

  for (const key of Object.keys(options.ubbTemplates) as Array<keyof MarkdownToUbbOptions['ubbTemplates']>) {
    const currentTemplate = options.ubbTemplates[key]
    const savedTemplate = savedOptions.ubbTemplates?.[key]

    if (!savedTemplate) continue

    Object.assign(currentTemplate, savedTemplate)
  }

  return options
}

function createDefaultProfile(options = createDefaultOptions()): SettingsProfile {
  return {
    id: defaultProfileId,
    name: '默认配置',
    options,
  }
}

function createCc98Options(): MarkdownToUbbOptions {
  const options = createDefaultOptions()

  options.boldTableHeader = false
  options.ubbTemplates.strike.open = '[del]'
  options.ubbTemplates.strike.close = '[/del]'
  options.ubbTemplates.unorderedList.enabled = false
  options.ubbTemplates.orderedList.enabled = false
  options.ubbTemplates.listItem.enabled = false
  options.ubbTemplates.tableHeaderCell.open = '[th]'
  options.ubbTemplates.tableHeaderCell.close = '[/th]'
  options.ubbTemplates.horizontalRule.value = '[line]'
  applyCc98HeadingSizes(options)

  return options
}

function createCc98Profile(): SettingsProfile {
  return {
    id: cc98ProfileId,
    name: 'CC98',
    options: createCc98Options(),
  }
}

function ensureBuiltinProfiles(profiles: SettingsProfile[]) {
  const normalizedProfiles = [...profiles]

  if (!normalizedProfiles.some((profile) => profile.id === defaultProfileId)) {
    normalizedProfiles.unshift(createDefaultProfile())
  }

  if (!normalizedProfiles.some((profile) => profile.id === cc98ProfileId || profile.name === 'CC98')) {
    normalizedProfiles.push(createCc98Profile())
  }

  for (const profile of normalizedProfiles) {
    if (profile.id === cc98ProfileId || profile.name === 'CC98') {
      applyCc98HeadingSizes(profile.options)
    }
  }

  return normalizedProfiles
}

function loadStoredProfiles(): StoredProfiles {
  try {
    const storedProfiles = window.localStorage.getItem(profilesStorageKey)

    if (storedProfiles) {
      const parsedProfiles = JSON.parse(storedProfiles) as Partial<StoredProfiles>
      const profiles =
        parsedProfiles.profiles
          ?.filter((profile) => profile.id && profile.name && profile.options)
          .map((profile) => ({
            id: profile.id,
            name: profile.name,
            options: mergeOptions(profile.options),
          })) ?? []

      if (profiles.length > 0) {
        const normalizedProfiles = ensureBuiltinProfiles(profiles)
        const firstProfile = normalizedProfiles[0]
        const activeProfileId = normalizedProfiles.some((profile) => profile.id === parsedProfiles.activeProfileId)
          ? parsedProfiles.activeProfileId
          : firstProfile?.id

        return {
          activeProfileId: activeProfileId ?? firstProfile?.id ?? defaultProfileId,
          profiles: normalizedProfiles,
        }
      }
    }

    const storedOptions = window.localStorage.getItem(settingsStorageKey)
    const defaultProfile = createDefaultProfile(
      storedOptions ? mergeOptions(JSON.parse(storedOptions) as Partial<MarkdownToUbbOptions>) : undefined,
    )
    const profiles = ensureBuiltinProfiles([defaultProfile])

    return {
      activeProfileId: cc98ProfileId,
      profiles,
    }
  } catch {
    const profiles = ensureBuiltinProfiles([createDefaultProfile()])

    return {
      activeProfileId: cc98ProfileId,
      profiles,
    }
  }
}

function saveProfiles(savedProfiles: StoredProfiles) {
  window.localStorage.setItem(profilesStorageKey, JSON.stringify(savedProfiles))
}

const storedProfiles = loadStoredProfiles()
saveProfiles(storedProfiles)

const markdown = ref(sampleMarkdown)
const copied = ref(false)
const settingsOpen = ref(false)
const creatingProfile = ref(false)
const renamingProfile = ref(false)
const newProfileName = ref('')
const editingProfileName = ref('')
const profiles = ref<SettingsProfile[]>(storedProfiles.profiles)
const activeProfileId = ref(storedProfiles.activeProfileId)
const activeProfile = computed(() => profiles.value.find((profile) => profile.id === activeProfileId.value))
const editingProfile = computed(() => creatingProfile.value || renamingProfile.value)
const options = ref<MarkdownToUbbOptions>(activeProfile.value?.options ?? createDefaultOptions())

const headingSizes = [1, 2, 3, 4, 5, 6, 7, '07']
const previewMarkdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})
const tagGroups = [
  {
    title: '文本格式',
    items: [
      { key: 'bold', label: '加粗' },
      { key: 'italic', label: '斜体' },
      { key: 'strike', label: '删除线' },
    ],
  },
  {
    title: '代码与引用',
    items: [
      { key: 'inlineCode', label: '行内代码' },
      { key: 'codeBlock', label: '代码块' },
      { key: 'quote', label: '引用' },
    ],
  },
  {
    title: '链接',
    items: [{ key: 'link', label: '链接' }],
  },
  {
    title: '列表',
    items: [
      { key: 'unorderedList', label: '无序列表' },
      { key: 'orderedList', label: '有序列表' },
      { key: 'listItem', label: '列表项' },
    ],
  },
  {
    title: '表格',
    items: [
      { key: 'table', label: '表格' },
      { key: 'tableRow', label: '表格行' },
      { key: 'tableCell', label: '单元格' },
      { key: 'tableHeaderCell', label: '表头单元格' },
    ],
  },
] as const

const liveOutput = computed(() => markdownToUbb(markdown.value, options.value))
const output = computed(() => liveOutput.value)
const renderedMarkdown = computed(() => previewMarkdown.render(markdown.value))
const renderedUbb = computed(() => renderUbbPreview(output.value))

const markdownCount = computed(() => markdown.value.length)
const outputCount = computed(() => output.value.length)

watch(markdown, () => {
  copied.value = false
})

watch(activeProfileId, (profileId) => {
  const profile = profiles.value.find((item) => item.id === profileId)

  if (!profile) return

  options.value = cloneOptions(profile.options)
  saveProfiles({ activeProfileId: profileId, profiles: profiles.value })
})

watch(
  options,
  (value) => {
    const profile = activeProfile.value

    if (profile) {
      profile.options = cloneOptions(value)
    }

    copied.value = false
    saveProfiles({ activeProfileId: activeProfileId.value, profiles: profiles.value })
  },
  { deep: true },
)

function createProfile() {
  creatingProfile.value = true
  renamingProfile.value = false
  newProfileName.value = ''
}

function createProfileId() {
  return crypto.randomUUID?.() ?? `profile-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function confirmCreateProfile() {
  const trimmedName = newProfileName.value.trim()

  if (!trimmedName) return

  const profile: SettingsProfile = {
    id: createProfileId(),
    name: trimmedName,
    options: cloneOptions(options.value),
  }

  profiles.value.push(profile)
  activeProfileId.value = profile.id
  creatingProfile.value = false
  newProfileName.value = ''
  saveProfiles({ activeProfileId: profile.id, profiles: profiles.value })
}

function cancelCreateProfile() {
  creatingProfile.value = false
  newProfileName.value = ''
}

function renameProfile() {
  const profile = activeProfile.value

  if (!profile) return

  renamingProfile.value = true
  creatingProfile.value = false
  editingProfileName.value = profile.name
}

function confirmRenameProfile() {
  const trimmedName = editingProfileName.value.trim()
  const profile = activeProfile.value

  if (!trimmedName || !profile) return

  profile.name = trimmedName
  renamingProfile.value = false
  editingProfileName.value = ''
  saveProfiles({ activeProfileId: activeProfileId.value, profiles: profiles.value })
}

function cancelRenameProfile() {
  renamingProfile.value = false
  editingProfileName.value = ''
}

function saveCurrentProfile() {
  const profile = activeProfile.value

  if (!profile) return

  profile.options = cloneOptions(options.value)
  saveProfiles({ activeProfileId: activeProfileId.value, profiles: profiles.value })
}

function deleteCurrentProfile() {
  if (profiles.value.length <= 1) return

  const profileIndex = profiles.value.findIndex((profile) => profile.id === activeProfileId.value)

  if (profileIndex < 0) return

  profiles.value.splice(profileIndex, 1)
  activeProfileId.value = profiles.value[Math.max(0, profileIndex - 1)]?.id ?? profiles.value[0]?.id ?? defaultProfileId
}

async function copyOutput() {
  if (!output.value) return

  await navigator.clipboard.writeText(output.value)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1600)
}

function clearAll() {
  markdown.value = ''
  copied.value = false
}

function fillSample() {
  markdown.value = sampleMarkdown
  copied.value = false
}

function resetSettings() {
  options.value = createDefaultOptions()
  copied.value = false
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand">
        <img src="/icon.png" alt="" class="brand-logo" />
        <div>
          <p class="eyebrow">Markdown to UBB</p>
          <h1>论坛 UBB 转换器</h1>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="secondary" @click="fillSample">示例</button>
        <button type="button" class="secondary" @click="clearAll">清空</button>
        <button type="button" class="secondary" @click="settingsOpen = true">设置</button>
        <button type="button" class="primary" :disabled="!output" @click="copyOutput">
          {{ copied ? '已复制' : '复制 UBB' }}
        </button>
      </div>
    </header>

    <section class="workspace">
      <article class="panel">
        <div class="panel-head">
          <h2>Markdown</h2>
          <span>{{ markdownCount }} 字符</span>
        </div>
        <textarea
          v-model="markdown"
          spellcheck="false"
          placeholder="在这里粘贴 Markdown 内容..."
        ></textarea>
        <section class="render-panel">
          <div class="render-head">Markdown 预览</div>
          <div class="render-content markdown-preview" v-html="renderedMarkdown"></div>
        </section>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>UBB</h2>
          <span>{{ outputCount }} 字符</span>
        </div>
        <textarea :value="output" readonly spellcheck="false" placeholder="转换结果会显示在这里"></textarea>
        <section class="render-panel">
          <div class="render-head">UBB 预览</div>
          <div class="render-content ubb-preview" v-html="renderedUbb"></div>
        </section>
      </article>
    </section>

    <Transition name="settings">
      <div v-if="settingsOpen" class="settings-layer" @click.self="settingsOpen = false">
        <aside class="settings-drawer" aria-label="设置菜单">
          <div class="settings-head">
            <div>
              <p class="eyebrow">Settings</p>
              <h2>转换设置</h2>
            </div>
            <button type="button" class="icon-button" aria-label="关闭设置" @click="settingsOpen = false">
              ×
            </button>
          </div>

        <div class="settings-content">
          <section class="settings-section">
            <div class="section-title">
              <div>
                <h3>标题样式</h3>
                <p>分别设置 H1 到 H6 的字号，以及是否额外加粗。</p>
              </div>
            </div>

            <div class="heading-table">
              <div class="heading-row heading-row-head">
                <span>级别</span>
                <span>字号</span>
                <span>加粗</span>
              </div>
              <div v-for="level in headingLevels" :key="level" class="heading-row">
                <strong>H{{ level }}</strong>
                <select v-model="options.headingFormats[level].size">
                  <option v-for="size in headingSizes" :key="size" :value="size">
                    {{ size }}
                  </option>
                </select>
                <label class="inline-check">
                  <input v-model="options.headingFormats[level].bold" type="checkbox" />
                  加粗
                </label>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <div class="section-title">
              <div>
                <h3>格式标签</h3>
                <p>按类型修改 Markdown 语法对应的 UBB 标签。</p>
              </div>
            </div>

            <div class="tag-group-list">
              <div v-for="group in tagGroups" :key="group.title" class="tag-group">
                <h4>{{ group.title }}</h4>

                <div class="tag-card-grid">
                  <article v-for="item in group.items" :key="item.key" class="tag-card">
                    <div class="tag-card-head">
                      <h5>{{ item.label }}</h5>
                      <label class="small-check">
                        <input v-model="options.ubbTemplates[item.key].enabled" type="checkbox" />
                        启用
                      </label>
                    </div>
                    <label>
                      开始
                      <input
                        v-model="options.ubbTemplates[item.key].open"
                        type="text"
                        :disabled="!options.ubbTemplates[item.key].enabled"
                      />
                    </label>
                    <label>
                      结束
                      <input
                        v-model="options.ubbTemplates[item.key].close"
                        type="text"
                        :disabled="!options.ubbTemplates[item.key].enabled"
                      />
                    </label>
                    <label v-if="item.key === 'codeBlock'" class="small-check">
                      <input
                        v-model="options.keepCodeLanguage"
                        type="checkbox"
                        :disabled="!options.ubbTemplates.codeBlock.enabled"
                      />
                      保留代码语言
                    </label>
                  </article>
                </div>

                <div v-if="group.title === '链接'" class="single-template-grid">
                  <div class="single-template-row">
                    <label class="small-check">
                      <input v-model="options.ubbTemplates.image.enabled" type="checkbox" />
                      图片
                    </label>
                    <input
                      v-model="options.ubbTemplates.image.value"
                      type="text"
                      :disabled="!options.ubbTemplates.image.enabled"
                    />
                  </div>
                </div>

                <div v-if="group.title === '列表'" class="single-template-grid">
                  <div class="single-template-row">
                    <label class="small-check">
                      <input v-model="options.ubbTemplates.taskChecked.enabled" type="checkbox" />
                      已完成任务
                    </label>
                    <input
                      v-model="options.ubbTemplates.taskChecked.value"
                      type="text"
                      :disabled="!options.ubbTemplates.taskChecked.enabled"
                    />
                  </div>
                  <div class="single-template-row">
                    <label class="small-check">
                      <input v-model="options.ubbTemplates.taskUnchecked.enabled" type="checkbox" />
                      未完成任务
                    </label>
                    <input
                      v-model="options.ubbTemplates.taskUnchecked.value"
                      type="text"
                      :disabled="!options.ubbTemplates.taskUnchecked.enabled"
                    />
                  </div>
                </div>

                <div v-if="group.title === '表格'" class="single-template-grid">
                  <div class="single-template-row">
                    <label class="small-check">
                      <input v-model="options.boldTableHeader" type="checkbox" />
                      表头加粗
                    </label>
                    <span class="setting-note">使用“加粗”标签包裹表头单元格内容</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <div class="section-title">
              <div>
                <h3>其他模板</h3>
                <p>分割线等不属于成对标签的 Markdown 语法。</p>
              </div>
            </div>

            <div class="single-template-grid">
              <div class="single-template-row">
                <label class="small-check">
                  <input v-model="options.ubbTemplates.horizontalRule.enabled" type="checkbox" />
                  分割线
                </label>
                <input
                  v-model="options.ubbTemplates.horizontalRule.value"
                  type="text"
                  :disabled="!options.ubbTemplates.horizontalRule.enabled"
                />
              </div>
            </div>
          </section>

          <section class="settings-section">
            <div class="section-title">
              <div>
                <h3>其他设置</h3>
                <p>控制 Markdown 转换时的补充输出策略。</p>
              </div>
            </div>

            <div class="behavior-grid">
              <label class="setting-check softbreak-check">
                <input v-model="options.preserveSoftBreaks" type="checkbox" />
                <span>保留软换行</span>
                <span class="hint" tabindex="0" aria-label="查看保留软换行说明">
                  ?
                  <span class="tooltip" role="tooltip">
                    影响段落内的单个换行：开启时保留换行，关闭时会合并为空格。空行分段不受影响。
                  </span>
                </span>
              </label>
              <label class="setting-check">
                <input v-model="options.showPromotion" type="checkbox" />
                <span>显示推广内容，让更多的人知道这个工具</span>
              </label>
              <label class="setting-check">
                <input v-model="options.addBlankLineAfterBlock" type="checkbox" />
                <span>每段后面添加空行</span>
              </label>
            </div>
          </section>
        </div>

        <div class="settings-foot">
          <div class="profile-controls">
            <label v-if="!editingProfile">
              配置文件
              <select v-model="activeProfileId">
                <option v-for="profile in profiles" :key="profile.id" :value="profile.id">
                  {{ profile.name }}
                </option>
              </select>
            </label>

            <label v-if="creatingProfile">
              配置文件
              <input
                v-model="newProfileName"
                type="text"
                placeholder="输入新配置名称"
                @keyup.enter.prevent="confirmCreateProfile"
                @keyup.esc="cancelCreateProfile"
              />
            </label>

            <label v-if="renamingProfile">
              配置文件
              <input
                v-model="editingProfileName"
                type="text"
                placeholder="输入配置名称"
                @keyup.enter.prevent="confirmRenameProfile"
                @keyup.esc="cancelRenameProfile"
              />
            </label>

            <template v-if="!editingProfile">
              <button type="button" class="secondary" @click="createProfile">新建</button>
              <button type="button" class="secondary" @click="renameProfile">重命名</button>
              <button type="button" class="secondary" @click="saveCurrentProfile">保存</button>
              <button
                type="button"
                class="secondary"
                :disabled="profiles.length <= 1"
                @click="deleteCurrentProfile"
              >
                删除
              </button>
            </template>

            <template v-if="creatingProfile">
              <button type="button" class="secondary" :disabled="!newProfileName.trim()" @click="confirmCreateProfile">
                确认
              </button>
              <button type="button" class="secondary" @click="cancelCreateProfile">取消</button>
            </template>

            <template v-if="renamingProfile">
              <button
                type="button"
                class="secondary"
                :disabled="!editingProfileName.trim()"
                @click="confirmRenameProfile"
              >
                确认
              </button>
              <button type="button" class="secondary" @click="cancelRenameProfile">取消</button>
            </template>
          </div>

          <div class="settings-actions">
            <button type="button" class="secondary" @click="resetSettings">恢复默认</button>
            <button type="button" class="primary" @click="settingsOpen = false">完成</button>
          </div>
        </div>
        </aside>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  margin: 0;
  min-width: 320px;
  color: #202124;
  background: #f5f7fb;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

button,
select,
textarea,
input {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 28px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin: 0 auto 18px;
  max-width: 1280px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-logo {
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  border-radius: 8px;
  object-fit: contain;
}

.eyebrow {
  margin: 0 0 4px;
  color: #5b6472;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  line-height: 1.2;
}

h1 {
  font-size: 30px;
}

h2 {
  font-size: 16px;
}

.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

button,
select,
input[type='text'] {
  min-height: 38px;
  border: 1px solid #ccd4df;
  border-radius: 8px;
  background: #ffffff;
  color: #202124;
}

button {
  padding: 0 14px;
  cursor: pointer;
  font-weight: 700;
}

button:hover:not(:disabled) {
  border-color: #718096;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

button.primary {
  border-color: #1769e0;
  background: #1769e0;
  color: #ffffff;
}

button.secondary {
  background: #f9fafc;
}

.icon-button {
  display: inline-grid;
  place-items: center;
  width: 38px;
  min-width: 38px;
  padding: 0;
  font-size: 24px;
  font-weight: 500;
  line-height: 1;
}

.checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #3f4754;
  font-size: 14px;
  font-weight: 650;
}

input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: #1769e0;
}

select {
  padding: 0 34px 0 10px;
}

input[type='text'] {
  width: 100%;
  min-width: 0;
  padding: 0 10px;
  font-family: 'Cascadia Code', 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
}

input[type='text']:disabled,
select:disabled {
  color: #8a94a3;
  background: #f1f4f8;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 18px;
  max-width: 1280px;
  margin: 0 auto;
}

.panel {
  display: grid;
  grid-template-rows: auto minmax(360px, 1fr) auto;
  gap: 10px;
  min-width: 0;
  overflow: hidden;
  border: 1px solid #dce2ea;
  border-radius: 8px;
  background: #f2f5f9;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #e7ecf2;
}

.panel-head h2 {
  min-width: 0;
}

.panel-head span {
  flex: 0 0 auto;
  color: #6b7280;
  font-size: 13px;
  white-space: nowrap;
}

textarea {
  width: 100%;
  min-width: 0;
  height: 100%;
  resize: vertical;
  border: 0;
  outline: none;
  padding: 16px;
  color: #1f2937;
  background: #ffffff;
  font-family: 'Cascadia Code', 'SFMono-Regular', Consolas, monospace;
  font-size: 14px;
  line-height: 1.65;
}

textarea[readonly] {
  background: #fbfcfe;
}

.render-panel {
  min-width: 0;
  overflow: hidden;
  border-top: 1px solid #e7ecf2;
  background: #ffffff;
}

.render-head {
  padding: 10px 16px;
  border-bottom: 1px solid #e7ecf2;
  color: #4b5563;
  font-size: 13px;
  font-weight: 750;
}

.render-content {
  min-width: 0;
  min-height: 220px;
  max-height: 360px;
  overflow: auto;
  padding: 16px;
  color: #1f2937;
  font-size: 14px;
  line-height: 1.65;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.render-content :deep(*) {
  min-width: 0;
  max-width: 100%;
}

.render-content :deep(h1),
.render-content :deep(h2),
.render-content :deep(h3),
.render-content :deep(h4),
.render-content :deep(h5),
.render-content :deep(h6) {
  margin: 0.8em 0 0.4em;
}

.render-content :deep(p) {
  margin: 0 0 0.75em;
}

.render-content :deep(blockquote) {
  margin: 0 0 0.75em;
  padding: 8px 12px;
  border-left: 3px solid #9aa7b6;
  background: #f7f9fc;
}

.render-content :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  padding: 12px;
  border-radius: 8px;
  background: #f1f4f8;
}

.render-content :deep(code) {
  padding: 2px 5px;
  border-radius: 5px;
  background: #eef2f7;
  font-family: 'Cascadia Code', 'SFMono-Regular', Consolas, monospace;
}

.render-content :deep(pre code) {
  padding: 0;
  background: transparent;
}

.render-content :deep(table) {
  display: block;
  width: max-content;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  margin: 0 0 0.75em;
}

.render-content :deep(td),
.render-content :deep(th) {
  min-width: 80px;
  max-width: 260px;
  padding: 8px;
  border: 1px solid #d8e0ea;
  overflow-wrap: anywhere;
}

.render-content :deep(img) {
  display: block;
  max-height: 220px;
  object-fit: contain;
}

.render-content :deep(hr) {
  border: 0;
  border-top: 1px solid #d8e0ea;
}

.ubb-size-1 {
  font-size: 12px;
}

.ubb-size-2 {
  font-size: 14px;
}

.ubb-size-3 {
  font-size: 16px;
}

.ubb-size-4 {
  font-size: 19px;
}

.ubb-size-5 {
  font-size: 24px;
}

.ubb-size-6,
.ubb-size-7 {
  font-size: 30px;
}

.settings-layer {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  justify-content: flex-end;
  background: rgb(15 23 42 / 42%);
}

.settings-enter-active,
.settings-leave-active {
  transition: background-color 0.2s ease;
}

.settings-enter-active .settings-drawer,
.settings-leave-active .settings-drawer {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.settings-enter-from,
.settings-leave-to {
  background: rgb(15 23 42 / 0%);
}

.settings-enter-from .settings-drawer,
.settings-leave-to .settings-drawer {
  opacity: 0;
  transform: translateX(28px);
}

.settings-drawer {
  display: flex;
  flex-direction: column;
  width: min(680px, 100vw);
  height: 100%;
  overflow: hidden;
  background: #ffffff;
  box-shadow: -18px 0 36px rgb(15 23 42 / 18%);
}

@media (prefers-reduced-motion: reduce) {
  .settings-enter-active,
  .settings-leave-active,
  .settings-enter-active .settings-drawer,
  .settings-leave-active .settings-drawer {
    transition: none;
  }
}

.settings-head,
.settings-foot,
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.settings-head,
.settings-foot {
  flex: 0 0 auto;
  padding: 18px 20px;
  border-bottom: 1px solid #e7ecf2;
}

.settings-content {
  flex: 1 1 auto;
  overflow: auto;
  padding: 16px;
  background: #f7f9fc;
}

.settings-foot {
  border-top: 1px solid #e7ecf2;
  border-bottom: 0;
  background: #ffffff;
}

.profile-controls,
.settings-actions {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 10px;
}

.profile-controls label {
  display: grid;
  gap: 6px;
  min-width: min(220px, 100%);
  color: #3f4754;
  font-size: 13px;
  font-weight: 650;
}

.settings-actions {
  justify-content: flex-end;
  margin-left: auto;
}

.settings-section {
  padding: 16px;
  border: 1px solid #dce2ea;
  border-radius: 8px;
  background: #ffffff;
}

.settings-section + .settings-section {
  margin-top: 14px;
}

.settings-section h3 {
  margin: 0;
  font-size: 15px;
}

.settings-section p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.45;
}

.section-title h3 {
  margin: 0;
}

.behavior-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  margin-top: 14px;
}

.setting-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid #e1e7ef;
  border-radius: 8px;
  background: #fbfcfe;
  color: #3f4754;
  font-size: 14px;
  font-weight: 650;
}

.softbreak-check {
  justify-self: end;
}

.hint {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: 1px solid #b9c3d0;
  border-radius: 50%;
  color: #5b6472;
  background: #ffffff;
  cursor: help;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}

.tooltip {
  position: absolute;
  right: 0;
  bottom: calc(100% + 10px);
  z-index: 20;
  width: min(280px, 70vw);
  padding: 9px 10px;
  border: 1px solid #cfd7e3;
  border-radius: 8px;
  color: #202124;
  background: #ffffff;
  box-shadow: 0 10px 24px rgb(15 23 42 / 16%);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.hint:hover .tooltip,
.hint:focus-visible .tooltip {
  opacity: 1;
  transform: translateY(0);
}

.heading-table {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.heading-row {
  display: grid;
  grid-template-columns: 52px 120px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.heading-row strong,
.heading-row-head {
  color: #4b5563;
  font-size: 13px;
}

.heading-row-head {
  font-weight: 700;
}

.inline-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #3f4754;
  font-size: 14px;
  font-weight: 650;
}

.tag-group-list {
  display: grid;
  gap: 18px;
  margin-top: 14px;
}

.tag-group {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.tag-group > h4 {
  margin: 0;
  color: #4b5563;
  font-size: 13px;
}

.tag-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.tag-card {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid #e1e7ef;
  border-radius: 8px;
  background: #fbfcfe;
}

.tag-card h5 {
  margin: 0;
  color: #1f2937;
  font-size: 14px;
}

.tag-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.small-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #4b5563;
  font-size: 13px;
  font-weight: 650;
}

.tag-card label,
.single-template-grid label {
  display: grid;
  gap: 6px;
  color: #3f4754;
  font-size: 13px;
  font-weight: 650;
}

.single-template-grid {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.single-template-row {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.setting-note {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.45;
}

@media (max-width: 840px) {
  .app-shell {
    padding: 18px;
  }

  .topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .panel {
    grid-template-rows: auto minmax(360px, 1fr);
  }

  .heading-row,
  .tag-card-grid,
  .behavior-grid,
  .single-template-row {
    grid-template-columns: 1fr;
  }

  .heading-row-head {
    display: none;
  }

  .settings-foot {
    align-items: stretch;
    flex-direction: column;
  }

  .settings-actions {
    justify-content: flex-start;
    margin-left: 0;
  }
}
</style>
