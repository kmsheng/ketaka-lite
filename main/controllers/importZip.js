import {first, isEmpty, endsWith} from 'lodash';
import {Importer, Helper, Doc} from '../services';
import {dialog} from 'electron';
import {ipcHandler} from '../decorators';
import Path from 'path';

const importZip = ipcHandler(function(event, args) {

  const send = this.send;
  const broadcast = this.broadcast;
  const options = {
    properties: ['openFile'],
    filters: [
      {name: 'zip', extensions: ['zip']}
    ]
  };

  if (args.override) {
    importPaths(args.paths);
  }
  else {
    dialog.showOpenDialog(options, importPaths);
  }

  function onProgress(res) {
    broadcast('import-progress', res);
  }

  async function importPaths(paths) {

    if (isEmpty(paths)) {
      return;
    }

    broadcast('import-start');

    const rows = await Helper.readZip(first(paths));
    const docNames = await Doc.getExistedDocNames();
    const filenames = rows.filter(row => endsWith(row.name, '.json'))
      .map(row => Path.basename(row.name, '.json'));

    const incomingDocName = first(filenames);

    if (docNames.includes(incomingDocName) && (! args.override)) {
      return send({error: true, duplicated: true, paths, duplicatedDocName: incomingDocName});
    }

    const doc = await Importer.handleImportZip(paths, onProgress);

    if (doc) {
      broadcast('import-progress', {progress: 100, type: 'info', message: 'Imported successfully', clean: true});
      send({message: 'Imported successfully', doc});
    }
    else {
      send({error: true, message: 'Doc not created'});
    }
  }
});

export default importZip;
