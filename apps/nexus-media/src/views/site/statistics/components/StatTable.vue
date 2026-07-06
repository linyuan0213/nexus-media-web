<script lang="ts" setup>
import { computed, h } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { NButton, NDataTable, NTag } from 'naive-ui';

import { type StatisticsItem, useSiteStats } from '#/composables/useSiteStats';

import SiteLogo from '../SiteLogo.vue';

interface Props {
  data: StatisticsItem[];
  favicons: Record<string, string>;
  isMobile: boolean;
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

function getColumns(isMobile: boolean): any[] {
  const baseColumns = [
    {
      title: '站点',
      key: 'site_name',
      width: isMobile ? 100 : 150,
      fixed: 'left' as const,
      render(row: any) {
        return h('div', { class: 'site-cell' }, [
          h(SiteLogo, {
            src: getFavicon(row.site_name),
            fallback: getFaviconFallback(row.site_name),
            name: row.site_name,
            url: row.url,
          }),
          h('span', { class: 'site-cell-name' }, row.site_name),
        ]);
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
        let type: any = 'default';
        if (ratio >= 5) type = 'success';
        else if (ratio >= 1) type = 'warning';
        else if (ratio > 0) type = 'error';
        return h(NTag, { size: 'small', type }, () => row.ratio);
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
        {
          title: '消息',
          key: 'message_count',
          width: 70,
          render(row: StatisticsItem) {
            if (!row.message_count)
              return h('span', { class: 'text-muted' }, '-');
            return h(NTag, { size: 'small', type: 'error' }, () =>
              String(row.message_count),
            );
          },
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
        return h('div', { class: 'flex items-center gap-1' }, [
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
    :pagination="{ pageSize: 20 }"
    :bordered="false"
    size="small"
    striped
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

.text-muted {
  color: hsl(var(--muted-foreground));
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
