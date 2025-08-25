const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('smartCleaner', {
  // 开始扫描
  startScan: () => ipcRenderer.invoke('scan-start'),
  // 取消扫描
  cancelScan: () => ipcRenderer.send('scan-cancel'),
  // 监听扫描进度
  onScanProgress: (cb) => {
    const listener = (_e, data) => cb && cb(data);
    ipcRenderer.on('scan-progress', listener);
    return () => ipcRenderer.removeListener('scan-progress', listener);
  },
  // 扫描完成
  onScanComplete: (cb) => {
    const listener = (_e, data) => cb && cb(data);
    ipcRenderer.on('scan-complete', listener);
    return () => ipcRenderer.removeListener('scan-complete', listener);
  },

  // 开始清理（传入选中的 item id 列表）
  startClean: (ids) => ipcRenderer.invoke('clean-start', Array.isArray(ids) ? ids : []),
  // 取消清理
  cancelClean: () => ipcRenderer.send('clean-cancel'),
  // 清理进度
  onCleanProgress: (cb) => {
    const listener = (_e, data) => cb && cb(data);
    ipcRenderer.on('clean-progress', listener);
    return () => ipcRenderer.removeListener('clean-progress', listener);
  },
  // 清理完成
  onCleanComplete: (cb) => {
    const listener = (_e, data) => cb && cb(data);
    ipcRenderer.on('clean-complete', listener);
    return () => ipcRenderer.removeListener('clean-complete', listener);
  }
});