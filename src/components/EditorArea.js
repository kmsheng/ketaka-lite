import React, {PropTypes} from 'react';
import {first, get, find, findIndex, isEmpty, isNull, values,
  invert, clone, each, throttle, debounce, map, remove} from 'lodash';
import classNames from 'classnames';
import keypress from 'keypress.js';
import shouldPureComponentUpdate from 'react-pure-render/function';
import {DropdownButton, MenuItem} from 'react-bootstrap';
import {Editor, ImageZoomer, ImageUploader, TabBox, TabItem, ModalConfirm, ModalSaveConfirm,
  ModalDocSettings, ModalPageAdd, SearchBar, ModalSettings, ModalSaveAs,
  ModalProgress, ModalOpen, ModalSpellCheckExceptionList, EditorToolbar, ModalEditDocs,
  Resizer, PrintArea} from '.';
import {Helper, Ime, Event, Api, getWrappedInstance, Cursor} from '../services/';
import CodeMirror from 'codemirror';

import {MAP_COLORS, MAP_INPUT_METHODS, DIRECTION_VERTICAL, DIRECTION_HORIZONTAL,
  NON_EDITOR_AREA_HEIGHT, RESIZER_SIZE, INPUT_METHOD_SYSTEM, INPUT_METHOD_TIBETAN_EWTS,
  INPUT_METHOD_TIBETAN_SAMBHOTA, INPUT_METHOD_TIBETAN_SAMBHOTA2, IS_MAC} from '../constants/AppConstants';

import {ToastContainer, ToastMessage} from 'react-toastr';

import {checkSyllables} from 'check-tibetan';
import Path from 'path';
import {connect} from 'react-redux';

const ToastMessageFactory = React.createFactory(ToastMessage.animation);
const KEY_ADD_DOC = 'KEY_ADD_DOC';

import {setCloseConfirmStatus, setInputMethod, setImageOnly, setSpellCheck,
  setTextOnly, toggleSpellCheck, setHistoryProcessingStatus} from '../modules/app';
import {addDoc, addPage, closeDoc, createDoc, deletePage, deletePageImage, importDoc, saveFontRecord,
  receiveDoc, save, setPageIndex, updatePageImagePath, writePageContent} from '../modules/doc';
import uuid from 'node-uuid';

const eventHelper = new Event();

const UNDO_PB_HISTORY_SIZE = 200;

@connect(state => ({
  closeConfirmStatus: state.app.closeConfirmStatus,
  direction: state.app.direction,
  docs: state.doc,
  ewRatio: state.app.ewRatio,
  exceptionWords: state.app.exceptionWords,
  inputMethod: state.app.inputMethod,
  nsRatio: state.app.nsRatio,
  shortcuts: state.app.shortcuts,
  showImageOnly: state.app.showImageOnly,
  showTextOnly: state.app.showTextOnly,
  spellCheckOn: state.app.spellCheckOn
}), {addDoc, addPage, closeDoc, createDoc, deletePage, importDoc,
  save, saveFontRecord, setPageIndex, updatePageImagePath, writePageContent, receiveDoc,
  deletePageImage, setHistoryProcessingStatus,
  setInputMethod, setImageOnly, setSpellCheck, setTextOnly, toggleSpellCheck, setCloseConfirmStatus})
export default class EditorArea extends React.Component {

  static PropTypes = {
    addDoc: PropTypes.func.isRequired,
    addPage: PropTypes.func.isRequired,
    closeConfirmStatus: PropTypes.bool.isRequired,
    closeDoc: PropTypes.func.isRequired,
    createDoc: PropTypes.func.isRequired,
    deletePage: PropTypes.func.isRequired,
    deletePageImage: PropTypes.func.isRequired,
    docs: PropTypes.array.isRequired,
    ewRatio: PropTypes.number.isRequired,
    exceptionWords: PropTypes.array.isRequired,
    importDoc: PropTypes.func.isRequired,
    inputMethod: PropTypes.string.isRequired,
    nsRatio: PropTypes.number.isRequired,
    receiveDoc: PropTypes.func.isRequired,
    save: PropTypes.func.isRequired,
    saveFontRecord: PropTypes.func.isRequired,
    setImageOnly: PropTypes.func.isRequired,
    setInputMethod: PropTypes.func.isRequired,
    setPageIndex: PropTypes.func.isRequired,
    setSpellCheck: PropTypes.func.isRequired,
    setTextOnly: PropTypes.func.isRequired,
    setHistoryProcessingStatus: PropTypes.func.isRequired,
    shortcuts: PropTypes.object.isRequired,
    showImageOnly: PropTypes.bool.isRequired,
    showTextOnly: PropTypes.bool.isRequired,
    toggleSpellCheck: PropTypes.func.isRequired,
    updatePageImagePath: PropTypes.func.isRequired,
    writePageContent: PropTypes.func.isRequired
  };

  docPath = '';
  keypressListener = null;
  lastQueryRes = [];

  constructor(props, context) {
    super(props, context);

    const {docs} = this.props;

    this.state = {
      print: false,
      docKey: docs.length > 0 ? first(docs).uuid : null
    };

    this.isSaving = false;
    this.isProcessingHistory = false;
    this.lastPageBreakRecords = [];
  }

  componentWillMount() {

    const self = this;

    Api.send('get-app-data')
     .then(res => {
      self.docPath = res.docPath;
    });
  }

  getWrappedInstance = getWrappedInstance;

  closeModalSettings = () => {
    this.getWrappedInstance('modalSettings').close();
    this.bindKeyboardEvents();
  };

  findMatchCountByKeyword = (keyword, index) => {
    const doc = this.getDoc();
    const pages = doc.pages;
    const page = pages[doc.pageIndex];
    const content = page.content.substring(index);

    keyword = keyword.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
    const regexp = new RegExp(keyword, 'g');
    const match = content.match(regexp);
    let count = match ? match.length : 0;

    let pageIndex = doc.pageIndex;
    let nextPage = pages[++pageIndex];

    while (nextPage) {
      const content = nextPage.content;
      const match = content.match(regexp);
      count += match ? match.length : 0;
      nextPage = pages[++pageIndex];
    }

    return count;
  };

  handleSelect = key => {
    if (KEY_ADD_DOC === key) {
      return this.addDoc();
    }
    if (key !== this.state.docKey) {
      this.setState({
        docKey: key
      });
    }
  };

  activateTab(index) {
    const activeDoc = this.props.docs[index];

    this.setState({
      docKey: activeDoc ? activeDoc.uuid : null
    });
  }

  addDoc = () => this.props.createDoc();

  markFontColor(codemirror = this.getCurrentCodemirror(), page = this.getCurrentPage()) {

    if (! codemirror) {
      return false;
    }

    const fontRecords = get(page, 'config.fontRecords', []);
    fontRecords.forEach(record => {
      const {from, to, css} = record;
      codemirror.markText(from, to, css);
    });
  }

  componentDidUpdate(previousProps, previousState) {

    const docs = this.props.docs;
    const codemirror = this.getCurrentCodemirror();

    if (this.props.closeConfirmStatus) {
      this.closeConfirm();
      return false;
    }

    if (previousProps.docs.length < docs.length) {
      this.activateTab(docs.length - 1);
    }

    const searchBar = this.refs.searchBar;

    if (searchBar) {
      searchBar.cm = codemirror;
    }

    // doc changed and codemirror exists
    if (((previousState.docKey !== this.state.docKey) || (previousProps.docs.length !== docs.length)) && codemirror) {
      codemirror.refresh();
      this.markFontColor(codemirror);

      if (searchBar) {
        searchBar.doDefault();
      }
    }

    if (previousProps.direction !== this.props.direction) {
      const editor = this.getEditor();
      if (editor) {
        editor.refresh();
      }
    }

  }

  getDocIndexByUuid(uuid) {
    return this.props.docs.findIndex(doc => doc.uuid === uuid);
  }

  changeActiveDocWhenClosing(uuid) {
    // don't do anything for non-active doc
    if (uuid !== this.state.docKey) {
      return false;
    }
    const docs = this.props.docs;
    const index = this.getDocIndexByUuid(uuid);
    const nextIndex = index + 1;
    const previousIndex = index - 1;
    const nextDoc = docs[nextIndex];
    const previousDoc = docs[previousIndex];

    if (nextDoc) {
      this.activateTab(nextIndex);
    }
    else if (previousDoc) {
      this.activateTab(previousIndex);
    }
  }

  closeTab(key) {

    const doc = this.getDocByKey(key);

    if (doc && this.docChanged(doc)) {

      // close a tab that's not active
      if (doc.uuid !== this.state.docKey) {
        const index = this.getDocIndexByUuid(doc.uuid);
        this.activateTab(index);
      }

      this.refs.modalSaveConfirm.open({
        title: 'Oops',
        message: 'You have unsaved content ! Do you want to save it ?'
      });
      return false;
    }
    this.closeDoc(key);
  }

  saveAndClose = () => {
    this.save();
    this.closeDoc();
    this.refs.modalSaveConfirm.close();
  };

  discard = () => {
    this.closeDoc();
    this.refs.modalSaveConfirm.close();
  };

  closeDoc(key) {

    if (! key) {
      key = this.state.docKey;
    }
    this.changeActiveDocWhenClosing(key);
    this.props.closeDoc(key);
  }

  getDocByKey = key => find(this.props.docs, {uuid: key});

  docChanged(doc = this.getDoc()) {
    return doc.changed;
  }

  handleClose = (props, e) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    this.closeTab(props.eventKey);
  };

  rotateTabLeft = () => {
    const docs = this.props.docs;
    if (docs.length < 2) {
      return false;
    }
    const index = this.getDocIndexByUuid(this.state.docKey);
    const nextIndex = (index - 1) < 0 ? docs.length - 1 : index - 1;
    this.activateTab(nextIndex);
  };

  rotateTabRight = () => {
    const docs = this.props.docs;
    if (docs.length < 2) {
      return false;
    }
    const index = this.getDocIndexByUuid(this.state.docKey);
    const nextIndex = (index + 1) > docs.length - 1 ? 0 : index + 1;
    this.activateTab(nextIndex);
  };

  getDoc(key = this.state.docKey, props = this.props) {
    return props.docs.find(doc => doc.uuid === key);
  }

  findPageIndexByName(name) {
    return get(this.getDoc(), 'pages', [])
      .findIndex(page => page.name === name);
  }

  handleInputChange = pageIndex => {
    if (this.props.spellCheckOn) {
      this.removeSpellCheckOverlay();
      this.addSpellCheckOverlay();
    }
    this.props.setPageIndex(this.state.docKey, pageIndex);
  };

  getPageInputValue(page = this.getCurrentPage()) {
    return get(page, 'name', '');
  }

  getPageIndex(doc = this.getDoc()) {
    return get(doc, 'pageIndex', 0);
  }

  save = async (doc = this.getDoc()) => {

    const self = this;

    if (self.isSaving || (! doc)) {
      return false;
    }

    self.isSaving = true;
    await Api.send('save', doc);
    await self.props.save(doc.uuid);
    self.isSaving = false;
  };

  saveAs = newDocName => {

    const self = this;
    const doc = self.getDoc();
    Api.send('save-as', {doc, newDocName})
      .then(res => {
        self.refs.modalSaveAs.close();
        self.closeDocByName(doc.name);
        self.props.receiveDoc(res.doc);
      })
      .catch(res => self.refs.toast.error(res.message));
  };

  closeDocByName = name => {
    const doc = find(this.props.docs, {name});
    if (doc) {
      this.closeDoc(doc.uuid);
    }
  };

  exportZip = async () => {

    const doc = this.getDoc();

    if (! doc) {
      this.refs.toast.error('Open a bamboo then try export again');
      return false;
    }

    if (doc.changed) {
      await this.save(doc);
    }

    try {
      const res = await Api.send('export-zip', {name: doc.name});
      this.refs.toast.success(res.message);
    }
    catch (err) {
      this.refs.toast.error(err.message);
    }
  };

  exportFileWithPb = async () => {

    const doc = this.getDoc();

    if (! doc) {
      this.refs.toast.error('Open a bamboo then try export again');
      return false;
    }

    if (doc.changed) {
      await this.save(doc);
    }

    try {
      const res = await Api.send('export-file-with-pb', {name: doc.name});
      this.refs.toast.success(res.message);
    }
    catch (err) {
      this.refs.toast.error(err.message);
    }
  };

  cancel = () => {
    const searchBar = this.refs.searchBar;
    if (searchBar) {
      searchBar.close();
    }
  };

  splitPage = () => {

    const doc = this.getDoc();
    const cm = this.getCurrentCodemirror();
    const page = this.getCurrentPage();

    if (isEmpty(cm)) {
      return false;
    }

    const {writePageContent, setPageIndex} = this.props;
    const cursor = cm.getCursor();
    const content = cm.getValue();
    const index = cm.indexFromPos(cursor);

    const firstPart = content.substring(0, index);
    let secondPart = content.substring(index, content.length);
    const originalSecondPart = secondPart;
    const pageIndex = doc.pageIndex;
    const pages = doc.pages;

    // https://github.com/karmapa/ketaka-lite/issues/53
    if (('\n' === secondPart[0]) && (secondPart.length > 1)) {
      secondPart = secondPart.substring(1);
    }

    if (pageIndex < (pages.length - 1)) {

      writePageContent(doc.uuid, pageIndex, firstPart);
      const nextPageIndex = pageIndex + 1;
      const nextPage = pages[nextPageIndex];
      const nextPageContent = secondPart + nextPage.content;

      let fromPageContent = firstPart + originalSecondPart;
      let cursorIndex = index;

      if (IS_MAC) {
        fromPageContent = firstPart.replace(/([\n])$/, '') + originalSecondPart;
        cursorIndex = index - 1;
      }

      this.lastPageBreakRecords.push({
        docId: doc.uuid,
        fromPageId: page.uuid,
        cursorIndex,
        fromPageContent,
        toPageId: nextPage.uuid,
        toPageContent: nextPage.content
      });

      if (this.lastPageBreakRecords.length > UNDO_PB_HISTORY_SIZE) {
        this.lastPageBreakRecords.shift();
      }

      writePageContent(doc.uuid, nextPageIndex, nextPageContent);
      setPageIndex(this.state.docKey, nextPageIndex);
    }
    else {
      this.refs.toast.error('You are on the last page');
    }
  };

  findNextQuery = (res, index) => {
    for (let i = 0, len = res.length; i < len; i++) {
      const query = res[i];
      if (index < query[0]) {
        return query;
      }
    }
    return null;
  };

  findPrevQuery = (res, index) => {
    for (let i = res.length - 1; i >= 0; i--) {
      const query = res[i];
      if (index > query[0]) {
        return query;
      }
    }
    return null;
  };

  replacePageContent = (query, text) => {

    query = query.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');

    const regexp = new RegExp(query, 'g');
    const {writePageContent} = this.props;
    const doc = this.getDoc();
    const pages = doc.pages;
    let replaceCount = 0;
    const replaceFunc = () => {
      ++replaceCount;
      return text;
    };

    let pageIndex = doc.pageIndex;
    let page = pages[pageIndex];

    while (page) {
      const content = page.content.replace(regexp, replaceFunc);
      writePageContent(doc.uuid, pageIndex, content);
      page = pages[++pageIndex];
    }
    this.refs.toast.success(replaceCount + ' keywords have been replaced.');
    return replaceCount;
  };

  getMatchIndexByQuery = (query, index) => {

    query = query.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');

    const page = this.getCurrentPage();
    const content = page.content.substring(0, index);
    return (content.match(new RegExp(query, 'g')) || []).length;
  };

  getIndexByMatchIndex = (query, index) => {
    query = query.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');

    const content = get(this.getCurrentPage(), 'content', '');

    const re = new RegExp(query, 'g');
    let match = re.exec(content);
    let count = 0;

    while (match) {
      count++;
      if (count === index) {
        return match.index + query.length;
      }
      match = re.exec(content);
    }
    return null;
  };

  nextWord = () => {

    if (isEmpty(this.lastQueryRes)) {
      return false;
    }

    const cm = this.getCurrentCodemirror();

    if (! cm) {
      return false;
    }

    const cursor = cm.getCursor();
    const index = cm.indexFromPos(cursor);
    const query = this.findNextQuery(this.lastQueryRes, index);

    if (isNull(query)) {
      return false;
    }

    const from = query[0];
    const to = from + query[1];

    const fromPos = cm.posFromIndex(from);
    const toPos = cm.posFromIndex(to);

    cm.setSelection(fromPos, toPos);
  };

  prevWord = () => {

    if (isEmpty(this.lastQueryRes)) {
      return false;
    }

    const cm = this.getCurrentCodemirror();

    if (! cm) {
      return false;
    }

    const cursor = cm.getCursor();
    const selection = cm.getSelection();
    const index = cm.indexFromPos(cursor) - selection.length;
    const query = this.findPrevQuery(this.lastQueryRes, index);

    if (isNull(query)) {
      return false;
    }

    const from = query[0];
    const to = from + query[1];

    const fromPos = cm.posFromIndex(from);
    const toPos = cm.posFromIndex(to);

    cm.setSelection(fromPos, toPos);
  };

  runWithPage = fn => {
    const self = this;
    return () => {
      const page = self.getCurrentPage();
      if (page) {
        fn();
      }
    };
  };

  bindKeyboardEvents = () => {

    const self = this;

    if (self.keypressListener) {
      self.keypressListener.destroy();
    }

    const inputMethods = values(MAP_INPUT_METHODS);
    const invertedInputMethods = invert(MAP_INPUT_METHODS);

    self.keypressListener = new keypress.Listener();
    const keypressListener = Helper.camelize(['register_combo'], self.keypressListener);

    const shortcuts = clone(this.props.shortcuts);

    // format shortcuts data
    each(shortcuts, (shortcut, prop) => {
      shortcuts[prop] = shortcut.value.split(' + ').join(' ');
    });

    const simpleCombo = (keys, cb) => {
      return keypressListener.registerCombo({
        keys,
        'on_keyup': cb,
        'prevent_default': false,
        'is_exclusive': true,
        'is_unordered': true
      });
    };

    simpleCombo(shortcuts.undo, this.handleShortCutUndo);
    simpleCombo(shortcuts.redo, this.handleShortCutRedo);
    simpleCombo(shortcuts.addTab, this.addDoc);
    simpleCombo(shortcuts.closeTab, this.closeTab.bind(this, null));
    simpleCombo(shortcuts.prevTab, this.rotateTabLeft);
    simpleCombo(shortcuts.nextTab, this.rotateTabRight);
    simpleCombo(shortcuts.save, () => this.save());

    simpleCombo(shortcuts.splitPage, this.splitPage);
    simpleCombo(shortcuts.stop, this.cancel);

    simpleCombo(shortcuts.switchInputMethod, () => {

      const currentInputMethod = MAP_INPUT_METHODS[this.props.inputMethod];
      let index = inputMethods.indexOf(currentInputMethod);
      if (-1 === index) {
        index = 0;
      }
      ++index;
      if (index >= inputMethods.length) {
        index = 0;
      }
      const newMethod = inputMethods[index];
      this.props.setInputMethod(invertedInputMethods[newMethod]);
    });

    simpleCombo(shortcuts.find, self.runWithPage(self.refs.searchBar.find));
    simpleCombo(shortcuts.replace, self.runWithPage(self.refs.searchBar.replace));
    simpleCombo(shortcuts.stop, self.runWithPage(self.refs.searchBar.escape));

    simpleCombo(shortcuts.confirmReplace, () => {
      self.refs.searchBar.yes();
    });

    simpleCombo(shortcuts.confirmReject, () => {
      self.refs.searchBar.no();
    });

    simpleCombo(shortcuts.nextWord, this.nextWord);
    simpleCombo(shortcuts.prevWord, this.prevWord);
  };

  handleAppEditDocs = () => this.getWrappedInstance('modalEditDocs').openModal();

  handleAppImport = () => this.import();

  handleAppImportZip = () => this.importZip();

  handleAppOpen = () => this.open();

  handleAppSave = () => this.save();

  handleAppSaveAs = async () => {

    const doc = this.getDoc();

    if (! doc) {
      return false;
    }

    const {docNames} = await Api.send('list-doc-name');

    this.refs.modalSaveAs.open({
      docName: doc.name,
      docNames
    });
  };

  handleAppSettings = () => {
    this.openSettingsModal();
    if (this.keypressListener) {
      this.keypressListener.destroy();
    }
  };

  handleAppExportZip = () => this.exportZip();

  handleAppExportFileWithPb = () => this.exportFileWithPb();

  handleImportStart = () => this.getWrappedInstance('modalProgress').open({title: 'Import Status'});

  handleImportProgress = (event, res) => {

    const importModal = this.getWrappedInstance('modalProgress');

    if (res.clean) {
      importModal.setMessages(res);
    }
    else {
      importModal.addMessages(res);
    }

    if (res.progress) {
      importModal.setProgress(res.progress);
    }
    importModal.setOptions({progressBarActive: true});
  };

  handleAppFind = () => this.refs.searchBar.find();

  handleAppUndo = () => {

    const editor = this.getEditor();

    if (editor && editor.hasFocus()) {
      this.undo();
    }
    else {
      Api.send('trigger-undo');
    }
  };

  handleAppRedo = () => {

    const editor = this.getEditor();

    if (editor && editor.hasFocus()) {
      this.redo();
    }
    else {
      Api.send('trigger-redo');
    }
  };

  handleAppSelectAll = () => {

    const cm = this.getCurrentCodemirror();

    if (cm && cm.hasFocus()) {
      CodeMirror.commands.selectAll(cm);
    }
    else {
      Api.send('trigger-selectall');
    }
  };

  handleAppSpellcheckExceptionList = () => this.getWrappedInstance('modalSpellCheckExceptionList').open();

  handleAppClose = () => {
    this.closeConfirm();
    this.props.setCloseConfirmStatus(true);
  };

  bindAppEvents = () => {

    eventHelper.on('app-import', this.handleAppImport);

    eventHelper.on('app-import-zip', this.handleAppImportZip);

    eventHelper.on('app-edit-docs', this.handleAppEditDocs);

    eventHelper.on('app-open', this.handleAppOpen);

    eventHelper.on('app-save', this.handleAppSave);

    eventHelper.on('app-save-as', this.handleAppSaveAs);

    eventHelper.on('app-settings', this.handleAppSettings);

    eventHelper.on('app-export-zip', this.handleAppExportZip);

    eventHelper.on('app-export-file-with-pb', this.handleAppExportFileWithPb);

    eventHelper.on('import-start', this.handleImportStart);

    eventHelper.on('import-progress', this.handleImportProgress);

    eventHelper.on('app-find', this.handleAppFind);

    eventHelper.on('app-undo', this.handleAppUndo);

    eventHelper.on('app-redo', this.handleAppRedo);

    eventHelper.on('app-select-all', this.handleAppSelectAll);

    eventHelper.on('app-replace', this.runWithPage(this.refs.searchBar.replace));

    eventHelper.on('app-spellcheck-exception-list', this.handleAppSpellcheckExceptionList);

    eventHelper.on('app-close', this.handleAppClose);

    eventHelper.on('app-undo-pb', this.handleAppUndoPb);
  };

  handleAppUndoPb = () => {
    const doc = this.getDoc();
    const record = find(this.lastPageBreakRecords, {docId: doc.uuid});
    if (record) {
      const doc = this.getDoc();
      const {writePageContent, setPageIndex} = this.props;
      const {docId, fromPageId, toPageId, fromPageContent, toPageContent, cursorIndex} = record;
      const fromPageIndex = this.getPageIndexByPageUuid(fromPageId);
      const toPageIndex = this.getPageIndexByPageUuid(toPageId);

      writePageContent(doc.uuid, fromPageIndex, fromPageContent);
      writePageContent(doc.uuid, toPageIndex, toPageContent);

      if (-1 !== fromPageIndex) {
        setPageIndex(docId, fromPageIndex);
        const cm = this.getCurrentCodemirror();
        const cursor = cm.posFromIndex(cursorIndex);
        cm.setCursor(cursor);
      }
      remove(this.lastPageBreakRecords, {docId: doc.uuid});
    }
  };

  componentDidMount() {

    const self = this;

    Ime.setInputMethod(MAP_INPUT_METHODS[self.props.inputMethod]);

    this.bindKeyboardEvents();
    this.bindAppEvents();

    window.addEventListener('resize', this.handleResize);

    if (this.props.spellCheckOn) {
      this.addSpellCheckOverlay();
    }

    if (window.matchMedia) {
      const mediaQueryList = window.matchMedia('print');
      mediaQueryList.addListener(function(mql) {
        if (mql.matches) {
          // before print
        } else {
          // after print
          self.setState({
            print: false
          });
        }
      });
    }

  }

  handleResize = throttle(() => {
    this.forceUpdate();
  }, 300);

  handleFileCountWarning = paths => {

    const modalProgress = this.getWrappedInstance('modalProgress');

    modalProgress.setMessages({
      type: 'warning',
      message: 'You are importing a large folder. Are you sure to import?'
    })
    .setOptions({
      progressBarStyle: 'warning',
      showFirstButton: true,
      firstButtonStyle: '',
      firstButtonText: 'Cancel',
      handleFirstButtonClick: () => modalProgress.close(),
      showSecondButton: true,
      secondButtonStyle: 'warning',
      secondButtonText: 'Proceed',
      handleSecondButtonClick: handleSecondButtonClick.bind(this)
    });

    async function handleSecondButtonClick() {

      modalProgress.setMessages([])
        .setOptions({
          progressBarStyle: 'info',
          showFirstButton: false,
          showSecondButton: false
        });

      try {
        const {doc, message} = await Api.send('import-button-clicked', {force: true, paths});

        this.props.importDoc(doc);
        this.refs.toast.success(message);

        modalProgress.setOptions({
          showFirstButton: true,
          firstButtonStyle: 'primary',
          firstButtonText: 'OK'
        });
      }
      catch (err) {
        const {message} = err;
        this.refs.toast.error(message);
        modalProgress.setMessages({
          type: 'danger',
          message
        })
        .setOptions({
          progressBarStyle: 'danger',
          progressBarActive: false,
          showFirstButton: true,
          handleFirstButtonClick: () => modalProgress.close(),
          firstButtonStyle: 'danger',
          firstButtonText: 'I understand.'
        });
      }
    }
  };

  handleImportError = message => {

    const modalProgress = this.getWrappedInstance('modalProgress');
    this.refs.toast.error(message);

    modalProgress.setMessages({
      type: 'danger',
      message
    })
    .setOptions({
      progressBarStyle: 'danger',
      progressBarActive: false,
      showFirstButton: true,
      handleFirstButtonClick: () => modalProgress.close(),
      firstButtonStyle: 'danger',
      firstButtonText: 'I understand.'
    });
  };

  import = async () => {

    const modalProgress = this.getWrappedInstance('modalProgress');

    try {
      const {doc, message} = await Api.send('import-button-clicked');

      this.props.importDoc(doc);
      this.refs.toast.success(message);

      modalProgress.setOptions({
        showFirstButton: true,
        firstButtonText: 'OK',
        firstButtonStyle: 'primary'
      });
    }
    catch (err) {

      const {type, paths, message} = err;

      if ('fileCountWarning' === type) {
        this.handleFileCountWarning(paths);
      }
      else {
        this.handleImportError(message);
      }
    }
  };

  importZip(args) {

    const self = this;
    const modalProgress = self.getWrappedInstance('modalProgress');

    Api.send('import-zip', args)
      .then(res => {
        self.props.importDoc(res.doc);
        self.refs.toast.success(res.message);
        modalProgress.setOptions({
          showFirstButton: true,
          firstButtonStyle: 'primary',
          firstButtonText: 'OK',
          showSecondButton: false,
          handleFirstButtonClick: modalProgress.close
        });
      })
      .catch(err => {
        if (err.duplicated) {
          this.handleDuplicatedImportZip(err);
        }
        else {
          self.refs.toast.error(err.message);
          modalProgress.setOptions({
            showFirstButton: true,
            firstButtonStyle: '',
            firstButtonText: 'Cancel',
            showSecondButton: false,
            handleFirstButtonClick: modalProgress.close
          });
        }
      });
  }

  handleDuplicatedImportZip = ({paths, duplicatedDocName}) => {
    const modalProgress = this.getWrappedInstance('modalProgress');
    modalProgress.setMessages({
      type: 'warning',
      message: 'Doc ' + duplicatedDocName + ' already exists. Are you sure you want to override ?'
    });
    modalProgress.setOptions({
      showFirstButton: true,
      firstButtonStyle: '',
      firstButtonText: 'Cancel',
      handleFirstButtonClick: () => modalProgress.close(),
      showSecondButton: true,
      secondButtonStyle: 'warning',
      secondButtonText: 'Override',
      handleSecondButtonClick: () => {
        modalProgress.setOptions({
          showFirstButton: false,
          showSecondButton: false
        });
        this.importZip({override: true, paths});
      }
    });
  };

  open() {
    const self = this;

    Api.send('open')
      .then(res => {
        self.refs.modalOpen.open({
          names: res.names
        });
      });
  }

  openSettingsModal() {
    this.getWrappedInstance('modalSettings').open();
  }

  componentWillUnmount() {
    eventHelper.off();
    this.keypressListener.destroy();
    window.removeEventListener('resize', this.handleResize);
  }

  shouldComponentUpdate = shouldPureComponentUpdate;

  getCurrentPage(doc = this.getDoc()) {
    if (! doc) {
      return null;
    }
    const pageIndex = this.getPageIndex(doc);
    return doc.pages[pageIndex];
  }

  handleLegacyPage = page => {
    if (! page.uuid) {
      page.uuid = 'page:' + uuid.v4();
    }
  };

  handleHistory = (cm, content) => {

    if (cm.disableHistory) {
      cm.disableHistory = false;
      return false;
    }

    const {setHistoryProcessingStatus} = this.props;
    const page = this.getCurrentPage();
    const key = this.getHistoryKey();

    this.handleLegacyPage(page);

    this.isProcessingHistory = true;
    setHistoryProcessingStatus(true);

    // adding history
    Api.send('add-history', {key, prevContent: page.content, content})
      .then(res => {
        this.isProcessingHistory = false;
        setHistoryProcessingStatus(false);
      });
  };

  getPageIndexByPageUuid = uuid => {
    const doc = this.getDoc();
    return findIndex(doc.pages, {uuid});
  };

  onCodemirrorChange = debounce((cm, content) => {

    const doc = this.getDoc();
    const page = this.getCurrentPage(doc);

    // switching pages
    if (page.content === content) {
      this.markFontColor(cm, page);
    }
    else {
      this.handleHistory(cm, content);
      this.props.writePageContent(doc.uuid, doc.pageIndex, content);
    }

    if (this.props.spellCheckOn) {
      this.lazyAddSpellCheckOverlay();
    }
  }, 300);

  lazyAddSpellCheckOverlay = throttle(this.addSpellCheckOverlay, 1000);

  getTabName = doc => {
    const tabName = doc.name;
    if (this.docChanged(doc)) {
      return tabName + '*';
    }
    return tabName;
  }

  onUploadButtonClick = () => {
    const self = this;
    const doc = this.getDoc();
    const {uuid, pageIndex} = doc;
    Api.send('page-image-upload-button-clicked', doc)
      .then(res => {
        self.props.updatePageImagePath(uuid, pageIndex, res.pathData);
        self.refs.toast.success(res.message);
      })
      .catch(res => self.refs.toast.error(res.message));
  }

  getImageSrc = (page, doc) => {
    const src = get(page, 'pathData.base');
    if (! src) {
      return '';
    }
    if (! src.match(/\.(bmp|gif|jpg|png)$/)) {
      return '';
    }
    const hashSrc = src + '?v=' + uuid.v4();
    return Path.resolve(this.docPath, doc.name, 'images', hashSrc);
  }

  handleSettingsButtonClick = () => {
    const self = this;

    Api.send('list-doc-name')
      .then(res => {
        const doc = self.getDoc();
        const page = self.getCurrentPage(doc);
        self.refs.modalDocSettings.open({
          docName: get(doc, 'name'),
          pageName: get(page, 'name'),
          docNames: res.docNames,
          pageNames: get(doc, 'pages', []).map(page => page.name)
        });
      });
  }

  saveAndCloseModalDocSettings = data => {
    const self = this;
    const doc = this.getDoc();
    const page = doc.pages[doc.pageIndex];
    data.doc = doc;

    if ((doc.name === data.docName) && (page.name === data.pageName)) {
      return this.refs.modalDocSettings.close();
    }

    Api.send('change-doc-settings', data)
      .then(res => {
        const doc = res.doc;
        self.props.receiveDoc(doc);
        self.refs.toast.success(res.message);
        self.refs.modalDocSettings.close();
      })
      .catch(res => self.refs.toast.error(res.message));
  }

  handlePageAddButtonClick = () => {
    this.refs.modalPageAdd.open({
      pageNames: get(this.getDoc(), 'pages', []).map(page => page.name)
    });
  }

  handlePageDeleteButtonClick = () => {
    this.refs.modalPageDeleteConfirm.open({
      title: 'Oops',
      message: 'Are you sure to delete this page ?'
    });
  }

  removeSpellCheckOverlay() {
    const lastOverlay = this.lastOverlay;
    if (lastOverlay) {
      const codemirror = this.getCurrentCodemirror();
      codemirror.removeOverlay(lastOverlay, false);
      this.lastOverlay = null;
    }
  }

  cancelSpellCheck() {
    this.removeSpellCheckOverlay();
    this.props.setSpellCheck(false);
  }

  addSpellCheckOverlay() {
    const codemirror = this.getCurrentCodemirror();

    if (! codemirror) {
      return false;
    }

    if (this.lastOverlay) {
      this.removeSpellCheckOverlay();
    }

    const content = codemirror.getValue();

    const res = checkSyllables(content);
    const {exceptionWords} = this.props;

    const queries = res.filter(row => {
      return ! exceptionWords.includes(row[2]);
    });

    this.lastQueryRes = queries;

    if (isEmpty(queries)) {
      return false;
    }

    const overlay = this.searchOverlay(queries, true);
    codemirror.addOverlay(overlay, {className: 'spellcheck'});

    this.lastOverlay = overlay;
  }

  checkSpelling() {

    const {spellCheckOn, toggleSpellCheck} = this.props;

    if (spellCheckOn) {
      this.removeSpellCheckOverlay();
    }
    else {
      this.addSpellCheckOverlay();
    }
    toggleSpellCheck();
  }

  searchOverlay(queries, caseInsensitive) {

    const tokens = map(queries, 2);
    const str = tokens.map(query => query.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&'))
      .join('|');

    const regexp = new RegExp(str, caseInsensitive ? 'gi' : 'g');

    return {
      token: function(stream) {

        regexp.lastIndex = stream.pos;

        const match = regexp.exec(stream.string);

        if (match && match.index === stream.pos) {
          const posArr = map(checkSyllables(stream.string), 0);
          const matchLine = posArr.includes(stream.pos);
          stream.pos += match[0].length;
          return matchLine ? 'typo' : null;
        }
        else if (match) {
          stream.pos = match.index;
        }
        else {
          stream.skipToEnd();
        }
      }
    };
  }

  handleColorButtonClick = color => {
    const doc = this.getDoc();
    const codemirror = this.getCurrentCodemirror();
    const hexColor = MAP_COLORS[color];
    const fontRecords = [];

    codemirror.listSelections()
      .forEach(selection => {
        const [from, to] = Helper.handleReverseSelection(selection.anchor, selection.head);
        const css = {css: 'color: ' + hexColor};
        codemirror.markText(from, to, css);
        fontRecords.push({from, to, css});
      });

    this.props.saveFontRecord(doc.uuid, doc.pageIndex, fontRecords);
  }

  handleSpellCheckButtonClick = () => {
    this.checkSpelling();
  }

  getEditorKey(uuid) {
    return uuid + '.editor';
  }

  getImageZoomerKey(uuid) {
    return uuid + '.image-zoomer';
  }

  closeModalPageAdd = () => {
    this.refs.modalPageAdd.close();
  }

  addPageAndCloseModal = pageName => {
    const doc = this.getDoc();
    this.props.addPage(doc.uuid, pageName);
    const pageIndex = findIndex(doc.pages, {name: pageName});
    this.props.setPageIndex(this.state.docKey, pageIndex);
    this.refs.modalPageAdd.close();
  }

  getImageZoomerHeight = () => {

    const {nsRatio, showImageOnly, showTextOnly} = this.props;
    let deltaRatio = showImageOnly ? 1 : nsRatio;

    if (showTextOnly) {
      deltaRatio = 0;
    }
    return (window.innerHeight - NON_EDITOR_AREA_HEIGHT - (RESIZER_SIZE / 2)) * deltaRatio;
  }

  getImageZoomerWidth = () => {

    const {ewRatio, showImageOnly, showTextOnly} = this.props;
    let deltaRatio = showImageOnly ? 1 : ewRatio;

    if (showTextOnly) {
      deltaRatio = 0;
    }
    return (window.innerWidth - (RESIZER_SIZE / 2)) * deltaRatio;
  }

  getEditorHeight() {

    const {direction, nsRatio, showTextOnly, showImageOnly} = this.props;
    let deltaRatio = showTextOnly ? 0 : nsRatio;

    if (DIRECTION_VERTICAL === direction) {
      return window.innerHeight - NON_EDITOR_AREA_HEIGHT - 7;
    }

    if (showImageOnly) {
      deltaRatio = 1;
    }
    return (window.innerHeight - NON_EDITOR_AREA_HEIGHT - (RESIZER_SIZE / 2)) * (1 - deltaRatio);
  }

  getEditorWidth() {

    const {direction} = this.props;
    const {ewRatio, showTextOnly, showImageOnly} = this.props;

    if (DIRECTION_HORIZONTAL === direction) {
      return window.innerWidth;
    }

    let deltaRatio = showTextOnly ? 0 : ewRatio;

    if (showImageOnly) {
      deltaRatio = 1;
    }
    return (window.innerWidth - (RESIZER_SIZE / 2)) * (1 - deltaRatio);
  }

  handleImageZoomerCloseButtonClick = () => {
    this.refs.modalPageImageDeleteConfirm.open({
      title: 'Oops',
      message: 'Are you sure to delete this image ?'
    });
  };

  cancelDeletePageImage = () => this.refs.modalPageImageDeleteConfirm.close();

  confirmPageImageDelete = async () => {
    const doc = this.getDoc();
    const page = this.getCurrentPage();
    const imageFilename = get(page, 'pathData.base');
    await this.props.deletePageImage({docName: doc.name, imageFilename});
    this.refs.modalPageImageDeleteConfirm.close();
  };

  renderImageArea(key, src) {

    const style = {};

    if (DIRECTION_HORIZONTAL === this.props.direction) {
      style.height = this.getImageZoomerHeight();
    }
    else {
      style.width = this.getImageZoomerWidth();
    }

    if (src) {
      const props = {
        style,
        key,
        onImageZoomerCloseButtonClick: this.handleImageZoomerCloseButtonClick,
        className: 'image-zoomer',
        direction: this.props.direction,
        src
      };
      return <ImageZoomer {...props} />;
    }
    return <ImageUploader style={style} key={key} className="image-uploader" onUploadButtonClick={this.onUploadButtonClick} />;
  }

  getCurrentCodemirror() {
    const uuid = get(this.getDoc(), 'uuid');
    const editorKey = this.getEditorKey(uuid);
    const editor = this.refs[editorKey];
    if (editor) {
      return get(editor.getWrappedInstance(), 'codemirror');
    }
    return null;
  }

  cancelDeletePage = () => {
    this.refs.modalPageDeleteConfirm.close();
  }

  deleteCurrentPage = () => {
    const doc = this.getDoc();
    const currentPageIndex = doc.pageIndex;

    if (currentPageIndex === (doc.pages.length - 1)) {
      doc.pageIndex = currentPageIndex - 1;
      this.props.setPageIndex(currentPageIndex - 1);
    }
    this.props.deletePage(doc.uuid, currentPageIndex);
    this.refs.modalPageDeleteConfirm.close();
  }

  isCurrentDoc(doc) {
    return doc.uuid === this.state.docKey;
  }

  renderDoc = doc => {

    const pageIndex = this.getPageIndex(doc);
    const page = doc.pages[pageIndex];
    const src = this.getImageSrc(page, doc);
    const key = doc.uuid;
    const imageZoomerKey = this.getImageZoomerKey(key);

    if (this.isCurrentDoc(doc)) {

      return (
        <TabItem eventKey={key} tab={this.getTabName(doc)} key={key}>

          <Resizer />

          {this.renderImageArea(imageZoomerKey, src)}
          {this.renderEditorArea(doc, pageIndex)}
        </TabItem>
      );
    }
    return <TabItem eventKey={key} tab={this.getTabName(doc)} key={key} />;
  }

  handleAddPbFileButtonClick = () => {
    const self = this;
    Api.send('add-pb-files', {doc: self.getDoc()})
      .then(res => {
        self.props.importDoc(res.doc);
        self.refs.toast.success(res.message);
      })
      .catch(res => self.refs.toast.error(res.message));
  }

  onBambooDeleteClick = name => {
    const self = this;
    self.closeDocByName(name);
    Api.send('delete-doc', {name})
      .then(res => self.refs.modalOpen.setNames(res.names));
  }

  onBambooClick = name => {
    const self = this;
    const openedDoc = find(this.props.docs, {name});
    if (openedDoc) {

      // activate this doc if its already opened
      const index = findIndex(this.props.docs, {uuid: openedDoc.uuid});
      if (-1 !== index) {
        this.activateTab(index);
      }

      this.refs.modalOpen.close();
    }
    else {

      Api.send('open-bamboo', {name})
        .then(res => {
          self.props.receiveDoc(res.doc);
          self.refs.modalOpen.close();
        });
    }
  }

  renderEditorArea = (doc, pageIndex) => {

    const page = doc.pages[pageIndex];

    const style = {
      width: this.getEditorWidth(),
      height: this.getEditorHeight()
    };

    const key = doc.uuid;
    const editorKey = this.getEditorKey(key);

    const editorProps = {
      style,
      className: classNames({'editor': true}),
      code: page.content || '',
      ref: editorKey,
      key: editorKey,
      onCodemirrorChange: this.onCodemirrorChange
    };

    return (
      <Editor {...editorProps} />
    );
  }

  getHistoryKey = () => {

    const doc = this.getDoc();
    const page = this.getCurrentPage();

    if (doc && page) {
      return doc.uuid + ':' + page.uuid;
    }
    return null;
  };

  findPrevIndexByKeyword = keyword => {
    const doc = this.getDoc();
    let pageIndex = doc.pageIndex;
    let page = doc.pages[--pageIndex];

    while (page) {
      const content = get(page, 'content', '');
      if (content.includes(keyword)) {
        return pageIndex;
      }
      page = doc.pages[--pageIndex];
    }
    return null;
  }

  findNextIndexByKeyword = keyword => {
    const doc = this.getDoc();
    let pageIndex = doc.pageIndex;
    let page = doc.pages[++pageIndex];

    while (page) {
      const content = get(page, 'content', '');
      if (content.includes(keyword)) {
        return pageIndex;
      }
      page = doc.pages[++pageIndex];
    }
    return null;
  }

  toPrevPage = () => {
    const doc = this.getDoc();
    const prevPageIndex = doc.pageIndex - 1;
    if (prevPageIndex >= 0) {
      this.props.setPageIndex(doc.uuid, prevPageIndex);
      return true;
    }
    else {
      return false;
    }
  }

  getEditor(doc = this.getDoc()) {
    if (! doc) {
      return null;
    }
    const editorKey = this.getEditorKey(doc.uuid);
    const editor = this.refs[editorKey];

    if (editor) {
      return editor.getWrappedInstance();
    }
    return null;
  }

  redo = () => {

    if (this.isProcessingHistory) {
      return false;
    }

    const key = this.getHistoryKey();
    const cm = this.getCurrentCodemirror();
    const content = cm.getValue();

    Api.send('redo-history', {key, content})
      .then((res) => {
        cm.disableHistory = true;
        cm.setValue(res.content);
        Cursor.setRedoCursor(cm, res.addedRow, res.removedRow);
        cm.focus();
      });
  };

  handleRedoButtonClick = () => this.redo();

  undo = () => {

    if (this.isProcessingHistory) {
      return false;
    }

    const key = this.getHistoryKey();
    const cm = this.getCurrentCodemirror();
    const content = cm.getValue();

    Api.send('undo-history', {key, content})
      .then((res) => {
        cm.disableHistory = true;
        cm.setValue(res.content);
        Cursor.setUndoCursor(cm, res.addedRow, res.removedRow);
        cm.focus();
      });
  };

  handleUndoButtonClick = () => this.undo();

  handleShortCutUndo = () => {
    const editor = this.getEditor();
    if (! editor) {
      return false;
    }
    if (editor.hasFocus()) {
      this.undo();
    }
    else {
      editor.focus();
    }
  }

  handleShortCutRedo = () => {
    const editor = this.getEditor();
    if (! editor) {
      return false;
    }
    if (editor.hasFocus()) {
      this.redo();
    }
    else {
      editor.focus();
    }
  }

  handleImageOnlyButtonClick = () => {

    const {showImageOnly, showTextOnly} = this.props;

    if (showTextOnly) {
      this.props.setTextOnly(false);
    }
    this.props.setImageOnly(! showImageOnly);
  };

  handleTextOnlyButtonClick = () => {

    const {showImageOnly, showTextOnly} = this.props;

    if (showImageOnly) {
      this.props.setImageOnly(false);
    }
    this.props.setTextOnly(! showTextOnly);
  };

  cancelModalSave = () => {
    this.refs.modalSaveConfirm.close();
  };

  handlePrintButtonClick = () => {
    this.setState({
      print: true
    });
  };

  renderEditorToolbar() {

    if (isEmpty(this.props.docs)) {
      return false;
    }

    const doc = this.getDoc();

    const editorToolbarProps = {
      canShowPageDeleteButton: doc && (doc.pages.length > 1),
      className: 'editor-toolbar',
      onAddPbFileButtonClick: this.handleAddPbFileButtonClick,
      onColorButtonClick: this.handleColorButtonClick,
      onInputChange: this.handleInputChange,
      onPageAddButtonClick: this.handlePageAddButtonClick,
      onPageDeleteButtonClick: this.handlePageDeleteButtonClick,
      onRedoButtonClick: this.handleRedoButtonClick,
      onSettingsButtonClick: this.handleSettingsButtonClick,
      onSpellCheckButtonClick: this.handleSpellCheckButtonClick,
      onPrintButtonClick: this.handlePrintButtonClick,
      onUndoButtonClick: this.handleUndoButtonClick,
      onImageOnlyButtonClick: this.handleImageOnlyButtonClick,
      onTextOnlyButtonClick: this.handleTextOnlyButtonClick,
      pageIndex: doc ? doc.pageIndex : 0,
      pageNames: doc ? doc.pages.map(page => page.name) : []
    };
    return <EditorToolbar {...editorToolbarProps} />;
  }

  render() {

    const {print} = this.state;
    const {docs, direction, setPageIndex, inputMethod} = this.props;
    const doc = this.getDoc();

    const classes = {
      [this.props.className]: true,
      'vertical': (DIRECTION_VERTICAL === direction)
    };

    const searchBarProps = {
      inputMethod,
      findNextIndexByKeyword: this.findNextIndexByKeyword,
      findPrevIndexByKeyword: this.findPrevIndexByKeyword,
      findMatchCountByKeyword: this.findMatchCountByKeyword,
      setPageIndex,
      toPrevPage: this.toPrevPage,
      doc,
      replacePageContent: this.replacePageContent,
      getMatchIndexByQuery: this.getMatchIndexByQuery,
      getIndexByMatchIndex: this.getIndexByMatchIndex
    };

    if (print) {
      return (
        <div className={classNames(classes)}>
          <PrintArea doc={doc} />
        </div>
      );
    }
    else {

      return (
        <div className={classNames(classes)}>
          <SearchBar ref="searchBar" {...searchBarProps} />
          {this.renderEditorToolbar()}
          <TabBox className="tab-box" activeKey={this.state.docKey} onSelect={this.handleSelect} onClose={this.handleClose}>
            {docs.map(this.renderDoc)}
            <TabItem className="button-add" eventKey={KEY_ADD_DOC} noCloseButton tab="+" />
          </TabBox>
          <ModalSaveConfirm ref="modalSaveConfirm" confirm={this.saveAndClose} discard={this.discard} cancel={this.cancelModalSave} />

          <ModalSaveConfirm ref="modalCloseConfirm" confirm={this.saveAndCloseModalClose} discard={this.discardModalClose} cancel={this.cancelModalClose} />

          <ModalConfirm ref="modalPageDeleteConfirm" confirmText="Delete"
            confirm={this.deleteCurrentPage} cancelText="Cancel" cancel={this.cancelDeletePage} />

          <ModalConfirm ref="modalPageImageDeleteConfirm" confirmText="Delete"
            confirm={this.confirmPageImageDelete} cancelText="Cancel" cancel={this.cancelDeletePageImage} />

          <ModalDocSettings ref="modalDocSettings" confirm={this.saveAndCloseModalDocSettings} />
          <ModalPageAdd ref="modalPageAdd" cancel={this.closeModalPageAdd} confirm={this.addPageAndCloseModal} />
          <ModalSettings ref="modalSettings" close={this.closeModalSettings} />
          <ModalProgress className="modal-import" ref="modalProgress" />
          <ModalOpen ref="modalOpen" onBambooClick={this.onBambooClick} onBambooDeleteClick={this.onBambooDeleteClick} />

          <ModalEditDocs ref="modalEditDocs" />

          <ModalSaveAs ref="modalSaveAs" saveAs={this.saveAs} />
          <ModalSpellCheckExceptionList ref="modalSpellCheckExceptionList" />
          <ToastContainer ref="toast" toastMessageFactory={ToastMessageFactory} className="toast-top-right" />

          <div className="section language-section">
            <DropdownButton id="dropdown" title={inputMethod}>
              {this.renderMenuItem(inputMethod, [INPUT_METHOD_SYSTEM, INPUT_METHOD_TIBETAN_EWTS, INPUT_METHOD_TIBETAN_SAMBHOTA, INPUT_METHOD_TIBETAN_SAMBHOTA2])}
            </DropdownButton>
          </div>
        </div>
      );
    }
  }

  renderCheckMark(show) {

    const className = classNames({
      'glyphicon': show,
      'glyphicon-ok': show,
      'empty': (! show)
    });

    return <i className={className}></i>;
  }

  onMenuItemSelect = method => {
    this.props.setInputMethod(method);
    const cm = this.getCurrentCodemirror();
    if (cm) {
      cm.focus();
    }
  };

  renderMenuItem(currentMethod, methods) {

    return methods.map((method, index) => {

      const props = {
        eventKey: index,
        key: index,
        onSelect: this.onMenuItemSelect.bind(this, method)
      };
      const showCheckMark = (currentMethod === method);

      return (
        <MenuItem {...props}>{this.renderCheckMark(showCheckMark)}{method}</MenuItem>
      );
    });
  }

  closeConfirm = () => {

    const unsavedDoc = this.props.docs.find(doc => doc.changed);

    if (unsavedDoc) {

      const {uuid} = unsavedDoc;

      // fix https://github.com/karmapa/ketaka-lite/issues/115
      if (uuid !== this.state.docKey) {
        this.activateTab(this.getDocIndexByUuid(uuid));
      }

      return this.refs.modalCloseConfirm.open({
        title: 'Oops! ' + unsavedDoc.name + ' is not saved !',
        message: 'Do you want to save it ?'
      });
    }
    Api.send('close');
  };

  saveAndCloseModalClose = () => {
    const unsavedDoc = this.props.docs.find(doc => doc.changed);
    this.save(unsavedDoc);
    this.closeDoc(unsavedDoc.uuid);
    this.refs.modalCloseConfirm.close();
  };

  discardModalClose = () => {
    const unsavedDoc = this.props.docs.find(doc => doc.changed);
    this.closeDoc(unsavedDoc.uuid);
    this.refs.modalCloseConfirm.close();
  };

  cancelModalClose = () => {
    this.refs.modalCloseConfirm.close();
    this.props.setCloseConfirmStatus(false);
  };
}
