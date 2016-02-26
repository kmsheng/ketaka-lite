import {app, ipcMain, crashReporter, screen, BrowserWindow, Menu} from 'electron';
import * as ctrls from './main/ctrls';
import bindEventName from './main/decorators/bindEventName';
import {Helper, MenuConfig} from './main/services';
import {PATH_APP_DOC} from './main/constants';

crashReporter.start({
  companyName: 'dharma-treasure',
  submitURL: 'https://log.dharma-treasure.org/ketaka-lite'
});

let mainWindow = null;

app.on('window-all-closed', () => {
  app.quit();
});

app.on('ready', () => {

  let size = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({width: size.width, height: size.height});

  Helper.mkdirp(PATH_APP_DOC)
    .then(() => {

      mainWindow.loadURL('file://' + __dirname + '/index.html');

      mainWindow.on('closed', () => {
        mainWindow = null;
      });
    });
});

app.once('ready', () => {
  let template = MenuConfig.getTemplate({mainWindow: mainWindow});
  let menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

const ipc = bindEventName(ipcMain);

ipc.on('import-button-clicked', ctrls.importButtonClicked);

ipc.on('import-zip', ctrls.importZip);

ipc.on('save', ctrls.save);

ipc.on('save-as', ctrls.saveAs);

ipc.on('page-image-upload-button-clicked', ctrls.pageImageUploadButtonClicked);

ipc.on('add-doc', ctrls.addDoc);

ipc.on('find-doc-names', ctrls.findDocNames);

ipc.on('change-doc-settings', ctrls.changeDocSettings);

ipc.on('open', ctrls.open);

ipc.on('open-bamboo', ctrls.openBamboo);

ipc.on('delete-doc', ctrls.deleteDoc);

ipc.on('export-zip', ctrls.exportZip);

ipc.on('export-file-with-pb', ctrls.exportFileWithPb);

ipc.on('add-pb-files', ctrls.addPbFiles);

ipc.on('get-app-data', ctrls.getAppData);
