import type { FileActionKey, FileItem } from '../types';

import type { TransferFormData } from '#/components/media/TransferModal.vue';

import { h, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { findHardlinksApi } from '#/api/modules/download';
import {
  copyFilesApi,
  downloadFileApi,
  downloadSubtitleApi,
  mkdirApi,
  moveFilesApi,
  nameTestApi,
  scrapMediaPathApi,
  uploadFileApi,
} from '#/api/modules/media';
import {
  deleteFilesApi,
  manualTransferUdfApi,
  renameFileApi,
} from '#/api/modules/sync';
import { useAppNotification } from '#/utils/notify';

interface ActionsDeps {
  getBackendId: () => string;
  getCurrentPath: () => string;
  refresh: () => Promise<void>;
  clearSelection: () => void;
}

function menuIcon(icon: string) {
  return () => h(IconifyIcon, { icon, class: 'size-4' });
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useFileActions(deps: ActionsDeps) {
  const notification = useAppNotification();

  // ---- 弹窗状态 ----
  const renameDialog = ref({ show: false, path: '', name: '' });
  const deleteDialog = ref({ show: false, items: [] as FileItem[] });
  const mkdirDialog = ref({ show: false, name: '' });
  const moveCopyDialog = ref({
    show: false,
    mode: 'move' as 'copy' | 'move',
    items: [] as FileItem[],
    dest: '',
  });
  const transferModalShow = ref(false);
  const transferPath = ref('');
  const transferLoading = ref(false);
  const hardlinkConfigShow = ref(false);
  const hardlinkConfigForm = ref({ path: '', dir: '' });
  const hardlinkModalShow = ref(false);
  const hardlinkResult = ref<
    Record<string, Array<{ file: string; filename: string; filepath: string }>>
  >({});
  const hardlinkSourceFile = ref('');
  const hardlinkLoading = ref(false);
  const identifyResultShow = ref(false);
  const identifyResult = ref<Record<string, any>>({});
  const identifyLoading = ref(false);
  const uploading = ref(false);

  // ---- 菜单定义 ----
  function buildMenuOptions(items: FileItem[]) {
    if (items.length === 0) return [];
    const single = items.length === 1 ? items[0]! : null;
    const allFiles = items.every((i) => !i.is_dir);
    const options: any[] = [
      { label: '识别', key: 'identify', icon: menuIcon('lucide:scan-line') },
      { label: '刮削', key: 'scrap', icon: menuIcon('lucide:sparkles') },
      {
        label: '转移',
        key: 'transfer',
        icon: menuIcon('lucide:arrow-right-left'),
      },
    ];
    if (allFiles) {
      options.push(
        {
          label: '字幕下载',
          key: 'subtitle',
          icon: menuIcon('lucide:subtitles'),
        },
        { label: '下载', key: 'download', icon: menuIcon('lucide:download') },
      );
    }
    if (single && !single.is_dir) {
      options.push(
        { label: '硬链接查询', key: 'hardlink', icon: menuIcon('lucide:link') },
        { label: '重命名', key: 'rename', icon: menuIcon('lucide:pencil') },
      );
    }
    if (single?.is_dir) {
      options.push({
        label: '重命名',
        key: 'rename',
        icon: menuIcon('lucide:pencil'),
      });
    }
    options.push(
      { type: 'divider', key: 'd1' },
      { label: '移动', key: 'move', icon: menuIcon('lucide:folder-input') },
      { label: '复制', key: 'copy', icon: menuIcon('lucide:copy') },
      { type: 'divider', key: 'd2' },
      {
        label: '删除',
        key: 'delete',
        icon: menuIcon('lucide:trash-2'),
        props: { style: 'color: hsl(var(--destructive))' },
      },
    );
    return options;
  }

  // ---- 动作分发 ----
  function dispatch(key: FileActionKey, items: FileItem[]) {
    switch (key) {
      case 'copy': {
        moveCopyDialog.value = { show: true, mode: 'copy', items, dest: '' };
        break;
      }
      case 'delete': {
        deleteDialog.value = { show: true, items };
        break;
      }
      case 'download': {
        handleDownload(items);
        break;
      }
      case 'hardlink': {
        const item = items[0];
        if (item) openHardlinkConfig(item);
        break;
      }
      case 'identify': {
        const item = items[0];
        if (item) handleIdentify(item);
        break;
      }
      case 'mkdir': {
        mkdirDialog.value = { show: true, name: '' };
        break;
      }
      case 'move': {
        moveCopyDialog.value = { show: true, mode: 'move', items, dest: '' };
        break;
      }
      case 'rename': {
        const item = items[0];
        if (item) {
          renameDialog.value = { show: true, path: item.path, name: item.name };
        }
        break;
      }
      case 'scrap': {
        handleScrap(items);
        break;
      }
      case 'subtitle': {
        handleSubtitle(items);
        break;
      }
      case 'transfer': {
        const item = items[0];
        if (item) {
          transferPath.value = item.path;
          transferModalShow.value = true;
        }
        break;
      }
    }
  }

  // ---- 具体操作 ----
  async function handleIdentify(item: FileItem) {
    const filename = item.name || item.path?.split('/').pop() || '';
    if (!filename) {
      notification.warning('无法获取文件名');
      return;
    }
    identifyResult.value = {};
    identifyResultShow.value = true;
    identifyLoading.value = true;
    try {
      const res = await nameTestApi(filename);
      identifyResult.value = res || {};
    } catch (error: any) {
      identifyResultShow.value = false;
      notification.error('识别失败', { description: error?.message || '' });
    } finally {
      identifyLoading.value = false;
    }
  }

  async function handleScrap(items: FileItem[]) {
    try {
      for (const item of items) {
        await scrapMediaPathApi(item.path, deps.getBackendId());
      }
      notification.success('刮削任务已提交');
    } catch (error: any) {
      notification.error('刮削失败', { description: error?.message || '' });
    }
  }

  async function handleSubtitle(items: FileItem[]) {
    try {
      for (const item of items) {
        await downloadSubtitleApi(item.path, item.name);
      }
      notification.success('字幕下载任务已提交');
    } catch (error: any) {
      notification.error('字幕下载失败', { description: error?.message || '' });
    }
  }

  async function handleDownload(items: FileItem[]) {
    for (const item of items.filter((i) => !i.is_dir)) {
      try {
        const blob = await downloadFileApi(item.path, deps.getBackendId());
        saveBlob(blob, item.name);
      } catch (error: any) {
        notification.error(`下载失败: ${item.name}`, {
          description: error?.message || '',
        });
      }
    }
  }

  async function submitTransfer(data: TransferFormData) {
    transferLoading.value = true;
    try {
      await manualTransferUdfApi({
        inpath: data.path,
        outpath: data.outpath || undefined,
        syncmod: data.syncmod,
        type: data.type,
        tmdb: data.tmdb,
        season: data.season,
        min_filesize: data.min_filesize,
        src_backend_id: data.src_backend_id || deps.getBackendId(),
      });
      notification.success('转移任务已提交');
      transferModalShow.value = false;
    } catch (error: any) {
      notification.error('提交失败', { description: error?.message || '' });
    } finally {
      transferLoading.value = false;
    }
  }

  async function submitRename() {
    try {
      await renameFileApi({
        path: renameDialog.value.path,
        name: renameDialog.value.name,
      });
      notification.success('重命名成功');
      renameDialog.value.show = false;
      await deps.refresh();
    } catch (error: any) {
      notification.error('重命名失败', { description: error?.message || '' });
    }
  }

  async function submitMkdir() {
    try {
      await mkdirApi({
        path: deps.getCurrentPath() || '/',
        name: mkdirDialog.value.name,
        backend_id: deps.getBackendId(),
      });
      notification.success('创建成功');
      mkdirDialog.value.show = false;
      await deps.refresh();
    } catch (error: any) {
      notification.error('创建失败', { description: error?.message || '' });
    }
  }

  async function submitMoveCopy() {
    const { mode, items, dest } = moveCopyDialog.value;
    if (!dest) {
      notification.warning('请选择目标目录');
      return;
    }
    const files = items.map((i) => i.path);
    try {
      await (mode === 'move'
        ? moveFilesApi({
            files,
            dest_dir: dest,
            backend_id: deps.getBackendId(),
          })
        : copyFilesApi({
            files,
            dest_dir: dest,
            backend_id: deps.getBackendId(),
          }));
      notification.success(mode === 'move' ? '移动成功' : '复制成功');
      moveCopyDialog.value.show = false;
      deps.clearSelection();
      await deps.refresh();
    } catch (error: any) {
      notification.error(mode === 'move' ? '移动失败' : '复制失败', {
        description: error?.message || '',
      });
    }
  }

  async function confirmDelete() {
    const items = deleteDialog.value.items;
    if (items.length === 0) return;
    try {
      await deleteFilesApi({
        files: items.map((i) => i.path),
        backend_id: deps.getBackendId(),
      });
      notification.success('删除成功');
      deleteDialog.value.show = false;
      deps.clearSelection();
      await deps.refresh();
    } catch (error: any) {
      notification.error('删除失败', { description: error?.message || '' });
    }
  }

  function openHardlinkConfig(item: FileItem) {
    hardlinkConfigForm.value = {
      path: item.path,
      dir: item.path
        ? item.path.slice(0, Math.max(0, item.path.lastIndexOf('/'))) || '/'
        : '',
    };
    hardlinkConfigShow.value = true;
  }

  async function submitHardlinkQuery() {
    hardlinkConfigShow.value = false;
    hardlinkLoading.value = true;
    hardlinkResult.value = {};
    hardlinkSourceFile.value = hardlinkConfigForm.value.path;
    try {
      const res = await findHardlinksApi({
        files: [hardlinkConfigForm.value.path],
        dir: hardlinkConfigForm.value.dir || undefined,
      });
      hardlinkResult.value = (res || {}) as any;
      hardlinkModalShow.value = true;
    } catch (error: any) {
      notification.error('查询失败', { description: error?.message || '' });
    } finally {
      hardlinkLoading.value = false;
    }
  }

  async function uploadFiles(files: File[] | FileList) {
    const list = [...files];
    if (list.length === 0) return;
    uploading.value = true;
    let failed = 0;
    try {
      for (const file of list) {
        try {
          await uploadFileApi(
            deps.getCurrentPath() || '/',
            deps.getBackendId(),
            file,
          );
        } catch (error: any) {
          failed += 1;
          notification.error(`上传失败: ${file.name}`, {
            description: error?.message || '',
          });
        }
      }
      if (failed < list.length) {
        notification.success(
          failed > 0
            ? `上传完成，${list.length - failed} 个成功，${failed} 个失败`
            : `已上传 ${list.length} 个文件`,
        );
      }
      await deps.refresh();
    } finally {
      uploading.value = false;
    }
  }

  return {
    buildMenuOptions,
    confirmDelete,
    deleteDialog,
    dispatch,
    hardlinkConfigForm,
    hardlinkConfigShow,
    hardlinkLoading,
    hardlinkModalShow,
    hardlinkResult,
    hardlinkSourceFile,
    identifyLoading,
    identifyResult,
    identifyResultShow,
    mkdirDialog,
    moveCopyDialog,
    renameDialog,
    submitHardlinkQuery,
    submitMkdir,
    submitMoveCopy,
    submitRename,
    submitTransfer,
    transferLoading,
    transferModalShow,
    transferPath,
    uploadFiles,
    uploading,
  };
}
