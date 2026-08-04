import type { BackendGroup, FileItem, SidebarPath } from '../types';

import type { StorageApi } from '#/api/modules/storage';

import { computed, ref } from 'vue';

import { getDirListApi, getLibraryPathsApi } from '#/api/modules/media';
import { getStorageBackendsApi } from '#/api/modules/storage';
import { useAppNotification } from '#/utils/notify';

import { parentDir } from '../utils';

export function useFileNavigation() {
  const notification = useAppNotification();

  const loading = ref(false);
  const currentPath = ref('');
  const currentBackendId = ref('local');
  const dirList = ref<FileItem[]>([]);
  const libraryPaths = ref<SidebarPath[]>([]);
  const syncSourcePaths = ref<SidebarPath[]>([]);
  const syncDestPaths = ref<SidebarPath[]>([]);
  const backends = ref<StorageApi.StorageBackend[]>([]);
  const defaultPath = ref('/');

  const backStack = ref<string[]>([]);
  const forwardStack = ref<string[]>([]);

  const backendOptions = computed(() => [
    { label: '本地', value: 'local' },
    ...backends.value.map((b) => ({ label: b.name, value: String(b.id) })),
  ]);

  const allSidebarPaths = computed(() => [
    ...libraryPaths.value,
    ...syncSourcePaths.value,
    ...syncDestPaths.value,
  ]);

  const rootBoundaries = computed(() =>
    allSidebarPaths.value.map((p) => p.path),
  );

  function getBackendLabel(backendId?: string) {
    if (!backendId || backendId === 'local') return '本地';
    return (
      backends.value.find((b) => String(b.id) === backendId)?.name || backendId
    );
  }

  function getBackendTagStyle(backendId?: string) {
    if (!backendId || backendId === 'local') {
      return { dot: 'hsl(var(--success))', text: 'hsl(var(--success))' };
    }
    const colors = [
      { dot: 'hsl(var(--primary))', text: 'hsl(var(--primary))' },
      { dot: 'hsl(var(--warning))', text: 'hsl(var(--warning))' },
      { dot: 'hsl(var(--destructive))', text: 'hsl(var(--destructive))' },
      { dot: 'hsl(var(--primary))', text: 'hsl(var(--primary))' },
    ];
    const idx = Number.parseInt(backendId, 10) % colors.length;
    return colors[idx] || colors[0];
  }

  const backendGroups = computed<BackendGroup[]>(() => {
    const byBackend = new Map<string, SidebarPath[]>();
    for (const p of allSidebarPaths.value) {
      const bid = p.backend_id || 'local';
      if (!byBackend.has(bid)) byBackend.set(bid, []);
      byBackend.get(bid)!.push(p);
    }
    const sortedIds = [...byBackend.keys()].toSorted((a, b) => {
      if (a === 'local') return -1;
      if (b === 'local') return 1;
      return Number.parseInt(a, 10) - Number.parseInt(b, 10);
    });
    return sortedIds.map((id) => {
      const items = byBackend.get(id)!;
      const style = getBackendTagStyle(id)!;
      const sections: BackendGroup['sections'] = [];
      const libs = items.filter((i) =>
        ['anime', 'movie', 'tv'].includes(i.type),
      );
      if (libs.length > 0)
        sections.push({ label: '媒体库', type: 'lib', items: libs });
      const srcs = items.filter((i) => i.type === 'sync');
      if (srcs.length > 0)
        sections.push({ label: '同步源', type: 'sync', items: srcs });
      const dsts = items.filter((i) => i.type === 'sync_dest');
      if (dsts.length > 0)
        sections.push({ label: '同步目标', type: 'sync_dest', items: dsts });
      return {
        backendId: id,
        backendName: getBackendLabel(id),
        dotColor: style.dot,
        textColor: style.text,
        sections,
      };
    });
  });

  const currentRoot = computed(() => {
    if (!currentPath.value) return null;
    const norm = currentPath.value.replaceAll('\\', '/');
    for (const boundary of rootBoundaries.value) {
      if (norm === boundary || norm.startsWith(`${boundary}/`)) {
        return boundary;
      }
    }
    return null;
  });

  const currentRootName = computed(() => {
    const root = currentRoot.value;
    if (!root) return '';
    const hit = allSidebarPaths.value.find((p) => p.path === root);
    return hit?.name || root.split('/').pop() || '根目录';
  });

  const breadcrumbs = computed(() => {
    const root = currentRoot.value;
    if (!currentPath.value || currentPath.value === '/') return [];
    const parts = currentPath.value
      .replaceAll('\\', '/')
      .split('/')
      .filter(Boolean);
    const items: Array<{ name: string; path: string }> = [];
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : `/${part}`;
      if (root && (acc === root || acc.length < root.length)) continue;
      items.push({ name: part, path: acc });
    }
    return items;
  });

  const canGoUp = computed(() => {
    if (!currentPath.value) return false;
    const root = currentRoot.value;
    if (!root) return true;
    return currentPath.value.replaceAll('\\', '/') !== root;
  });

  const canGoBack = computed(() => backStack.value.length > 0);
  const canGoForward = computed(() => forwardStack.value.length > 0);

  async function fetchDirList(path?: string) {
    loading.value = true;
    try {
      const res = await getDirListApi(
        path,
        'HIDE_FILES_FILTER',
        currentBackendId.value,
      );
      if (Array.isArray(res)) {
        dirList.value = res.toSorted((a, b) => {
          if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
          return a.is_dir ? -1 : 1;
        });
        currentPath.value = path || '';
      }
    } catch (error: any) {
      const msg = error?.message || '';
      if (
        msg.includes('No such file or directory') ||
        msg.includes('目录不存在') ||
        msg.includes('未找到存储后端')
      ) {
        dirList.value = [];
        currentPath.value = path || '';
      } else {
        notification.error('加载目录失败', { description: msg });
      }
    } finally {
      loading.value = false;
    }
  }

  function navigateTo(path: string, pushHistory = true) {
    if (pushHistory && currentPath.value !== (path || '')) {
      backStack.value.push(currentPath.value);
      forwardStack.value = [];
    }
    fetchDirList(path || undefined);
  }

  function goBack() {
    const prev = backStack.value.pop();
    if (prev === undefined) return;
    forwardStack.value.push(currentPath.value);
    fetchDirList(prev || undefined);
  }

  function goForward() {
    const next = forwardStack.value.pop();
    if (next === undefined) return;
    backStack.value.push(currentPath.value);
    fetchDirList(next || undefined);
  }

  function goUp() {
    if (!canGoUp.value) return;
    const parent = parentDir(currentPath.value);
    navigateTo(parent === '/' ? '' : parent);
  }

  function refresh() {
    return fetchDirList(currentPath.value || undefined);
  }

  function switchBackend(backendId: string) {
    currentBackendId.value = backendId;
    backStack.value = [];
    forwardStack.value = [];
    fetchDirList();
  }

  function navigateToSidebarPath(sp: SidebarPath) {
    const bid = sp.backend_id || 'local';
    if (bid !== currentBackendId.value) {
      currentBackendId.value = bid;
      backStack.value = [];
      forwardStack.value = [];
    }
    navigateTo(sp.path);
  }

  async function loadChildren(path: string, backendId: string) {
    const res = await getDirListApi(path, 'HIDE_FILES_FILTER', backendId);
    return Array.isArray(res) ? res.filter((i) => i.is_dir) : [];
  }

  async function init() {
    try {
      const [res, backendRes] = await Promise.all([
        getLibraryPathsApi(),
        getStorageBackendsApi(),
      ]);
      backends.value = backendRes.items || [];
      if (res) {
        libraryPaths.value = res.library_paths || [];
        syncSourcePaths.value = res.sync_source_paths || [];
        syncDestPaths.value = res.sync_dest_paths || [];
        defaultPath.value = res.default_path || '/';
        const all = [
          ...libraryPaths.value,
          ...syncSourcePaths.value,
          ...syncDestPaths.value,
        ];
        const matched = all.find((p) => p.path === defaultPath.value);
        if (matched?.backend_id) {
          currentBackendId.value = matched.backend_id;
        }
        const currentBackendPaths = all.filter(
          (p) => (p.backend_id || 'local') === currentBackendId.value,
        );
        if (
          defaultPath.value &&
          defaultPath.value !== '/' &&
          matched?.backend_id === currentBackendId.value
        ) {
          await fetchDirList(defaultPath.value);
        } else if (currentBackendPaths.length > 0) {
          await fetchDirList(currentBackendPaths[0]!.path);
        } else {
          await fetchDirList();
        }
      }
    } catch {
      await fetchDirList();
    }
  }

  return {
    backends,
    backendGroups,
    backendOptions,
    backStack,
    breadcrumbs,
    canGoBack,
    canGoForward,
    canGoUp,
    currentBackendId,
    currentPath,
    currentRoot,
    currentRootName,
    defaultPath,
    dirList,
    fetchDirList,
    forwardStack,
    getBackendLabel,
    goBack,
    goForward,
    goUp,
    init,
    loadChildren,
    loading,
    navigateTo,
    navigateToSidebarPath,
    refresh,
    switchBackend,
  };
}
