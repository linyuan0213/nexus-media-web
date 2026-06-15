<script lang="ts" setup>
import type { StorageApi } from '#/api/modules/storage';

import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  NButton,
  NCard,
  NCheckbox,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NTabPane,
  NTabs,
  useMessage,
} from 'naive-ui';

import { setSystemConfigApi } from '#/api';
import {
  addMediaLibraryPathApi,
  getMediaLibraryConfigApi,
  removeMediaLibraryPathApi,
  updateMediaLibraryPathApi,
} from '#/api/modules/media';
import { getStorageBackendsApi } from '#/api/modules/storage';
import PathPickerModal from '#/components/media/PathPickerModal.vue';
import PageHeader from '#/components/page/PageHeader.vue';

interface SectionDef {
  key: string;
  label: string;
  icon: string;
  desc: string;
}

const SECTIONS: SectionDef[] = [
  {
    key: 'movie',
    label: '电影',
    icon: 'lucide:film',
    desc: '电影资源存放目录',
  },
  { key: 'tv', label: '电视剧', icon: 'lucide:tv', desc: '电视剧资源存放目录' },
  {
    key: 'anime',
    label: '动漫',
    icon: 'lucide:sparkles',
    desc: '动漫资源存放目录',
  },
  {
    key: 'unknown',
    label: '未识别',
    icon: 'lucide:folder-question',
    desc: '未识别资源存放目录',
  },
];

interface PathItem {
  path: string;
  backend: string;
}

interface SectionData extends SectionDef {
  paths: PathItem[];
}

const message = useMessage();
const data = ref<SectionData[]>([]);
const backends = ref<StorageApi.StorageBackend[]>([]);
const backendOptions = computed(() => [
  { label: '本地', value: 'local' },
  ...backends.value.map((b) => ({
    label: `${b.name} (${b.type})`,
    value: String(b.id),
  })),
]);
const loading = ref(false);

// 路径编辑弹窗
const modal = ref({
  show: false,
  sectionKey: '',
  sectionLabel: '',
  oper: 'add' as 'add' | 'edit',
  oldPath: '',
  path: '',
  backend: 'local',
});

// 删除确认弹窗
const deleteModal = ref({
  show: false,
  sectionKey: '',
  sectionLabel: '',
  path: '',
});

// 刮削配置
const scraperModal = ref(false);
const scraperConfig = ref({
  scraper_nfo: {
    movie: { basic: true, credits: false, credits_chinese: false },
    tv: {
      basic: true,
      credits: false,
      credits_chinese: false,
      season_basic: false,
      episode_basic: false,
      episode_credits: false,
    },
  },
  scraper_pic: {
    movie: {
      poster: true,
      backdrop: false,
      background: false,
      logo: false,
      disc: false,
      banner: false,
      thumb: false,
    },
    tv: {
      poster: true,
      backdrop: false,
      background: false,
      logo: false,
      clearart: false,
      banner: false,
      thumb: false,
      season_poster: false,
      season_banner: false,
      season_thumb: false,
      episode_thumb: false,
    },
  },
});

async function saveScraper() {
  await setSystemConfigApi(
    'UserScraperConf',
    JSON.stringify(scraperConfig.value),
  );
  scraperModal.value = false;
  message.success('刮削设置已保存');
}

// 路径选择器
const pathPicker = ref({
  show: false,
  title: '选择目录',
});

function openPathPicker() {
  pathPicker.value = {
    show: true,
    title: '选择目录',
  };
}

function handlePathConfirm(path: string, backendId: string) {
  modal.value.path = path;
  modal.value.backend = backendId;
}

async function fetch() {
  loading.value = true;
  try {
    const [cfg, backendRes] = await Promise.all([
      getMediaLibraryConfigApi(),
      getStorageBackendsApi(),
    ]);
    backends.value = backendRes.items || [];
    data.value = SECTIONS.map((s) => {
      const pathKey = `${s.key}_path` as keyof typeof cfg;
      const backendKey = `${s.key}_backend` as keyof typeof cfg;
      const paths = Array.isArray(cfg[pathKey])
        ? (cfg[pathKey] as string[])
        : cfg[pathKey]
          ? [cfg[pathKey] as string]
          : [];
      const backendList = Array.isArray(cfg[backendKey])
        ? (cfg[backendKey] as string[])
        : [];
      return {
        ...s,
        paths: paths.map((p, i) => ({
          path: p,
          backend: backendList[i] || 'local',
        })),
      };
    });
  } catch {
    message.error('加载媒体库配置失败');
  } finally {
    loading.value = false;
  }
}

function openAdd(key: string) {
  const s = SECTIONS.find((x) => x.key === key)!;
  modal.value = {
    show: true,
    sectionKey: key,
    sectionLabel: s.label,
    oper: 'add',
    oldPath: '',
    path: '',
    backend: 'local',
  };
}

function openEdit(section: SectionData, item: PathItem) {
  modal.value = {
    show: true,
    sectionKey: section.key,
    sectionLabel: section.label,
    oper: 'edit',
    oldPath: item.path,
    path: item.path,
    backend: item.backend || 'local',
  };
}

async function save() {
  const m = modal.value;
  const p = m.path.trim();
  if (!p) return;

  const section = data.value.find((s) => s.key === m.sectionKey);
  if (!section) return;

  if (m.oper === 'add') {
    if (section.paths.some((x) => x.path === p)) {
      message.warning('路径已存在');
      return;
    }
    await addMediaLibraryPathApi(m.sectionKey, p, m.backend);
    section.paths.push({ path: p, backend: m.backend });
  } else {
    const idx = section.paths.findIndex((x) => x.path === m.oldPath);
    if (idx !== -1) {
      await updateMediaLibraryPathApi(m.sectionKey, m.oldPath, p, m.backend);
      section.paths[idx] = { path: p, backend: m.backend };
    }
  }

  m.show = false;
  message.success('保存成功');
}

function openDelete(section: SectionData, item: PathItem) {
  deleteModal.value = {
    show: true,
    sectionKey: section.key,
    sectionLabel: section.label,
    path: item.path,
  };
}

async function confirmDelete() {
  const m = deleteModal.value;
  await removeMediaLibraryPathApi(m.sectionKey, m.path);
  const section = data.value.find((s) => s.key === m.sectionKey);
  if (section) {
    section.paths = section.paths.filter((x) => x.path !== m.path);
  }
  deleteModal.value.show = false;
  message.success('删除成功');
}

onMounted(fetch);
</script>

<template>
  <div class="p-4">
    <PageHeader
      title="媒体库设置"
      subtitle="配置电影、电视剧、动漫及未识别文件的媒体库目录"
    >
      <template #actions>
        <NButton size="small" @click="fetch">
          <template #icon>
            <IconifyIcon icon="lucide:refresh-cw" class="h-4 w-4" />
          </template>
          刷新
        </NButton>
        <NButton size="small" @click="scraperModal = true">
          <template #icon>
            <IconifyIcon icon="lucide:image" class="h-4 w-4" />
          </template>
          刮削设置
        </NButton>
      </template>
    </PageHeader>

    <NSpin :show="loading">
      <!-- 每个分类一个卡片 -->
      <div class="grid grid-cols-1 gap-4 auto-rows-fr lg:grid-cols-2">
        <NCard
          v-for="section in data"
          :key="section.key"
          size="small"
          :bordered="false"
          class="flex h-full flex-col"
        >
          <!-- 头部 -->
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <IconifyIcon :icon="section.icon" class="h-5 w-5 section-icon" />
              <span class="text-sm font-semibold section-label">
                {{ section.label }}
              </span>
              <span class="ml-1 rounded-full count-badge px-1.5 py-0.5 text-xs">
                {{ section.paths.length }}
              </span>
            </div>
            <NButton size="tiny" type="primary" @click="openAdd(section.key)">
              <template #icon>
                <IconifyIcon icon="lucide:plus" class="h-3.5 w-3.5" />
              </template>
              新增
            </NButton>
          </div>

          <!-- 内容区 -->
          <div class="flex-1 flex flex-col">
            <!-- 路径列表 -->
            <div v-if="section.paths.length > 0" class="flex flex-col gap-2">
              <div
                v-for="(item, idx) in section.paths"
                :key="idx"
                class="path-row flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors"
              >
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <IconifyIcon
                    icon="lucide:folder"
                    class="h-4 w-4 flex-shrink-0 path-icon"
                  />
                  <div class="min-w-0 flex-1">
                    <div
                      class="truncate font-mono text-sm path-text"
                      :title="item.path"
                    >
                      {{ item.path }}
                    </div>
                    <div
                      class="text-xs mt-0.5"
                      style="color: hsl(var(--muted-foreground))"
                    >
                      {{
                        backendOptions.find(
                          (b) => b.value === (item.backend || 'local'),
                        )?.label || '本地'
                      }}
                    </div>
                  </div>
                </div>

                <NSpace size="small">
                  <NButton
                    size="tiny"
                    quaternary
                    @click="openEdit(section, item)"
                  >
                    <template #icon>
                      <IconifyIcon icon="lucide:pencil" class="h-3.5 w-3.5" />
                    </template>
                    编辑
                  </NButton>
                  <NButton
                    size="tiny"
                    quaternary
                    type="error"
                    @click="openDelete(section, item)"
                  >
                    <template #icon>
                      <IconifyIcon icon="lucide:trash-2" class="h-3.5 w-3.5" />
                    </template>
                    删除
                  </NButton>
                </NSpace>
              </div>
            </div>

            <!-- 空状态 -->
            <NEmpty
              v-else
              :description="`暂无 ${section.label} 目录`"
              class="flex-1 items-center justify-center py-6"
            >
              <template #icon>
                <IconifyIcon
                  icon="lucide:folder-open"
                  class="h-10 w-10 empty-icon"
                />
              </template>
              <template #extra>
                <NButton size="small" @click="openAdd(section.key)">
                  <template #icon>
                    <IconifyIcon icon="lucide:plus" class="h-3.5 w-3.5" />
                  </template>
                  添加目录
                </NButton>
              </template>
            </NEmpty>
          </div>
        </NCard>
      </div>
    </NSpin>

    <!-- 路径编辑弹窗 -->
    <NModal
      v-model:show="modal.show"
      :title="`${modal.oper === 'add' ? '新增' : '编辑'}${modal.sectionLabel}目录`"
      preset="card"
      :style="{ width: '520px', maxWidth: '92vw' }"
    >
      <NForm label-placement="left" label-width="60">
        <NFormItem label="路径" required>
          <NInput
            v-model:value="modal.path"
            placeholder="/mnt/media/movie（可手动输入或浏览选择）"
            clearable
          >
            <template #prefix>
              <IconifyIcon icon="lucide:folder" class="h-4 w-4 input-icon" />
            </template>
            <template #suffix>
              <NButton
                size="tiny"
                text
                @click="openPathPicker"
                title="浏览选择目录"
              >
                <template #icon>
                  <IconifyIcon icon="lucide:folder-open" class="h-4 w-4" />
                </template>
              </NButton>
            </template>
          </NInput>
        </NFormItem>
        <NFormItem label="后端">
          <NSelect v-model:value="modal.backend" :options="backendOptions" />
        </NFormItem>
      </NForm>
      <div class="mt-1 text-xs hint-text">
        下载文件转移、目录同步未配置目的目录时，媒体文件将重命名转移到该目录
      </div>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="modal.show = false">取消</NButton>
          <NButton type="primary" @click="save">确定</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 删除确认弹窗 -->
    <NModal
      v-model:show="deleteModal.show"
      title="确认删除"
      preset="dialog"
      type="warning"
      positive-text="删除"
      negative-text="取消"
      @positive-click="confirmDelete"
    >
      <div>
        确定要删除 {{ deleteModal.sectionLabel }} 目录「{{
          deleteModal.path
        }}」吗？
      </div>
    </NModal>

    <!-- 刮削设置模态框 -->
    <NModal
      v-model:show="scraperModal"
      title="刮削设置"
      preset="card"
      :style="{ width: '800px', maxWidth: '92vw' }"
    >
      <NTabs type="line">
        <NTabPane name="nfo" tab="元数据">
          <div class="space-y-4">
            <div>
              <div class="font-medium mb-2">电影</div>
              <NSpace>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_nfo.movie.basic"
                >
                  基础信息
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_nfo.movie.credits"
                >
                  演职人员
                </NCheckbox>
                <NCheckbox
                  v-model:checked="
                    scraperConfig.scraper_nfo.movie.credits_chinese
                  "
                >
                  演职人员中文
                </NCheckbox>
              </NSpace>
            </div>
            <div>
              <div class="font-medium mb-2">电视剧</div>
              <NSpace>
                <NCheckbox v-model:checked="scraperConfig.scraper_nfo.tv.basic">
                  基础信息
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_nfo.tv.credits"
                >
                  演职人员
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_nfo.tv.credits_chinese"
                >
                  演职人员中文
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_nfo.tv.season_basic"
                >
                  季-基础信息
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_nfo.tv.episode_basic"
                >
                  集-基础信息
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_nfo.tv.episode_credits"
                >
                  集-演职人员
                </NCheckbox>
              </NSpace>
            </div>
          </div>
        </NTabPane>
        <NTabPane name="pic" tab="图片">
          <div class="space-y-4">
            <div>
              <div class="font-medium mb-2">电影图片</div>
              <NSpace>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.movie.poster"
                >
                  poster
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.movie.backdrop"
                >
                  fanart
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.movie.background"
                >
                  background
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.movie.logo"
                >
                  logo
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.movie.disc"
                >
                  disc
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.movie.banner"
                >
                  banner
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.movie.thumb"
                >
                  thumb
                </NCheckbox>
              </NSpace>
            </div>
            <div>
              <div class="font-medium mb-2">电视剧图片</div>
              <NSpace>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.tv.poster"
                >
                  poster
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.tv.backdrop"
                >
                  fanart
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.tv.background"
                >
                  background
                </NCheckbox>
                <NCheckbox v-model:checked="scraperConfig.scraper_pic.tv.logo">
                  logo
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.tv.clearart"
                >
                  clearart
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.tv.banner"
                >
                  banner
                </NCheckbox>
                <NCheckbox v-model:checked="scraperConfig.scraper_pic.tv.thumb">
                  thumb
                </NCheckbox>
              </NSpace>
            </div>
            <div>
              <div class="font-medium mb-2">电视剧-季图片</div>
              <NSpace>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.tv.season_poster"
                >
                  poster
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.tv.season_banner"
                >
                  banner
                </NCheckbox>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.tv.season_thumb"
                >
                  thumb
                </NCheckbox>
              </NSpace>
            </div>
            <div>
              <div class="font-medium mb-2">电视剧-集图片</div>
              <NSpace>
                <NCheckbox
                  v-model:checked="scraperConfig.scraper_pic.tv.episode_thumb"
                >
                  thumb
                </NCheckbox>
              </NSpace>
            </div>
          </div>
        </NTabPane>
      </NTabs>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="scraperModal = false">取消</NButton>
          <NButton type="primary" @click="saveScraper">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 目录选择器 -->
    <PathPickerModal
      v-model:show="pathPicker.show"
      :title="pathPicker.title"
      :initial-path="modal.path"
      :initial-backend-id="modal.backend"
      @confirm="handlePathConfirm"
    />
  </div>
</template>

<style scoped>
.section-icon {
  color: hsl(var(--muted-foreground));
}

.section-label {
  color: hsl(var(--card-foreground));
}

.count-badge {
  color: hsl(var(--muted-foreground));
  background-color: hsl(var(--muted));
}

.path-row {
  background-color: hsl(var(--accent));
  border: 1px solid hsl(var(--border));
}

.path-row:hover {
  background-color: hsl(var(--muted));
  border-color: hsl(var(--border));
}

.path-icon {
  color: hsl(var(--muted-foreground));
}

.path-text {
  color: hsl(var(--card-foreground));
}

.empty-icon {
  color: hsl(var(--muted-foreground) / 50%);
}

.input-icon {
  color: hsl(var(--muted-foreground));
}

.hint-text {
  color: hsl(var(--muted-foreground));
}
</style>
