const { contextBridge, ipcRenderer } = require('electron');

// The only bridge between the Angular UI and the shell. Udemy lives on the main-process
// side (its own session partition + Chromium's network stack), so the renderer never sees
// a token — it just asks for connect/sync/disconnect and gets the API's status back.
contextBridge.exposeInMainWorld('learnmore', {
  isDesktop: true,
  udemyConnect: () => ipcRenderer.invoke('udemy:connect'),
  udemySync: () => ipcRenderer.invoke('udemy:sync'),
  udemyDisconnect: () => ipcRenderer.invoke('udemy:disconnect')
});
