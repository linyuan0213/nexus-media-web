<script lang="ts" setup>
import { computed, h } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NDataTable } from 'naive-ui';

import { type StatisticsItem, useSiteStats } from '#/composables/useSiteStats';

import SiteLogo from '../SiteLogo.vue';

interface Props {
  data: StatisticsItem[];
  favicons: Record<string, string>;
  isMobile: boolean;
  showAll?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  detail: [row: StatisticsItem];
  refresh: [siteName: string];
}>();

const { parseNumber, parseSize } = useSiteStats();

function getFavicon(name: string): string {
  const data = props.favicons[name];
  if (!data) return '';
  if (data.startsWith('data:') || data.startsWith('http')) return data;
  return data;
}

function getFaviconFallback(name: string): string {
  return `https://www.google.com/s2/favicons?domain=${name.toLowerCase()}.com&sz=64`;
}

function getRowClassName(row: StatisticsItem): string {
  return parseSize(row.upload) <= 0 && parseSize(row.download) <= 0
    ? 'row-inactive'
    : '';
}

function getColumns(isMobile: boolean): any[] {
  const baseColumns = [
    {
      title: '站点',
      key: 'site_name',
      width: isMobile ? 100 : 150,
      fixed: 'left' as const,
      render(row: any) {
        return h(
          'div',
          {
            class: 'site-cell',
            style: {
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
            },
          },
          [
            h('div', { style: { position: 'relative', flexShrink: '0' } }, [
              h(SiteLogo, {
                src: getFavicon(row.site_name),
                fallback: getFaviconFallback(row.site_name),
                name: row.site_name,
                url: row.url,
              }),
              row.message_count
                ? h(
                    'span',
                    {
                      style: {
                        position: 'absolute',
                        top: '-4px',
                        right: '-6px',
                        minWidth: '16px',
                        height: '16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                        fontSize: '10px',
                        fontWeight: '700',
                        lineHeight: '1',
                        color: 'hsl(var(--primary-foreground))',
                        backgroundColor: 'hsl(var(--destructive))',
                        border: '2px solid hsl(var(--background))',
                        borderRadius: '999px',
                      },
                    },
                    row.message_count > 99 ? '99+' : String(row.message_count),
                  )
                : null,
            ]),
            h('span', { class: 'site-cell-name' }, row.site_name),
          ],
        );
      },
    },
    {
      title: '用户名',
      key: 'username',
      width: isMobile ? 80 : 100,
      render(row: StatisticsItem) {
        return row.username || '-';
      },
    },
    {
      title: '等级',
      key: 'user_level',
      width: isMobile ? 60 : 80,
      render(row: StatisticsItem) {
        return row.user_level || '-';
      },
    },
    {
      title: '加入日期',
      key: 'join_at',
      width: isMobile ? 100 : 140,
      render(row: StatisticsItem) {
        if (!row.join_at) return '-';
        const d = new Date(row.join_at);
        if (Number.isNaN(d.getTime())) return row.join_at;
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      },
      sorter: (a: StatisticsItem, b: StatisticsItem) => {
        const ta = a.join_at ? Date.parse(a.join_at) : 0;
        const tb = b.join_at ? Date.parse(b.join_at) : 0;
        if (Number.isNaN(ta) && Number.isNaN(tb)) {
          return String(a.join_at || '').localeCompare(String(b.join_at || ''));
        }
        if (Number.isNaN(ta)) return 1;
        if (Number.isNaN(tb)) return -1;
        return ta - tb;
      },
    },
    {
      title: '上传',
      key: 'upload',
      width: isMobile ? 90 : 110,
      sorter: (a: StatisticsItem, b: StatisticsItem) =>
        parseSize(a.upload) - parseSize(b.upload),
    },
    {
      title: '下载',
      key: 'download',
      width: isMobile ? 90 : 110,
      sorter: (a: StatisticsItem, b: StatisticsItem) =>
        parseSize(a.download) - parseSize(b.download),
    },
    {
      title: '分享率',
      key: 'ratio',
      width: isMobile ? 75 : 90,
      render(row: StatisticsItem) {
        const ratio = Number.parseFloat(row.ratio);
        // 纯色加粗文本代替 NTag，视觉更清爽
        let color = 'hsl(var(--muted-foreground))';
        if (ratio >= 5) color = 'hsl(var(--success))';
        else if (ratio >= 1) color = 'hsl(var(--warning))';
        else if (ratio > 0) color = 'hsl(var(--destructive))';
        return h('span', { class: 'ratio-text', style: { color } }, row.ratio);
      },
      sorter: (a: StatisticsItem, b: StatisticsItem) =>
        Number.parseFloat(a.ratio) - Number.parseFloat(b.ratio),
    },
    {
      title: '做种',
      key: 'seeding_count',
      width: isMobile ? 70 : 85,
      sorter: (a: StatisticsItem, b: StatisticsItem) =>
        (a.seeding_count || 0) - (b.seeding_count || 0),
    },
  ];

  const extraColumns = isMobile
    ? []
    : [
        {
          title: '做种大小',
          key: 'seeding_size',
          width: 110,
        },
        {
          title: '魔力值',
          key: 'bonus',
          width: 100,
          sorter: (a: StatisticsItem, b: StatisticsItem) =>
            parseNumber(a.bonus) - parseNumber(b.bonus),
        },
      ];

  return [
    ...baseColumns,
    ...extraColumns,
    {
      title: '操作',
      key: 'actions',
      width: isMobile ? 75 : 90,
      fixed: 'right' as const,
      render(row: StatisticsItem) {
        return h('div', { class: 'flex items-center gap-4' }, [
          h(
            NButton,
            {
              text: true,
              size: 'small',
              onClick: () => emit('refresh', row.site_name),
              title: '刷新站点数据',
            },
            () => [
              h(IconifyIcon, {
                icon: 'lucide:refresh-cw',
                class: 'h-3.5 w-3.5',
              }),
            ],
          ),
          h(
            NButton,
            {
              text: true,
              size: 'small',
              onClick: () => emit('detail', row),
              title: '查看统计趋势',
            },
            () => [
              h(IconifyIcon, {
                icon: 'lucide:line-chart',
                class: 'h-3.5 w-3.5',
              }),
            ],
          ),
        ]);
      },
    },
  ];
}

const columns = computed(() => getColumns(props.isMobile));
</script>

<template>
  <NDataTable
    :columns="columns"
    :data="[...data]"
    :pagination="props.showAll ? false : { pageSize: 20 }"
    :bordered="false"
    size="small"
    striped
    :row-class-name="getRowClassName"
    :scroll-x="isMobile ? 500 : 1000"
  />
</template>

<style scoped>
.site-cell {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.site-cell-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: hsl(var(--card-foreground));
  white-space: nowrap;
}

.ratio-text {
  font-weight: 600;
}

:deep(.row-inactive td) {
  opacity: 0.5;
}

@media (max-width: 640px) {
  .site-cell {
    gap: 0.5rem;
  }

  .site-cell-name {
    font-size: 0.8125rem;
  }
}
</style>
