import Path, {basename} from 'path';
import _ from 'lodash';
import mkdirp from 'mkdirp';
import naturalSort from 'javascript-natural-sort';
import uuid from 'node-uuid';
import zpad from 'zpad';

import REGEXP_IMAGE from './../constants/regexpImage';
import REGEXP_PAGE from './../constants/regexpPage';
import {compare, Helper} from '.';
import {tagToStr} from './Tag';

const PATH_APP_DOC = require('../constants/appConstants').PATH_APP_DOC;

function genId(prefix = '') {
  return prefix + uuid.v4();
}

function createDoc(args) {
  return _.extend({
    chunk: '',
    changed: false,
    editChunk: false,
    name: '',
    pageIndex: 0,
    pages: [],
    nodes: [],
    uuid: genId('doc:')
  }, args);
}

function createPage(args) {
  return _.extend({
    uuid: genId('page:'),
    name: '',
    content: '',
    imagePath: '',
    pathData: {},
    config: {}
  }, args);
}

function getDoc(name) {
  const path = Path.resolve(PATH_APP_DOC, name, name + '.json');
  return Helper.readFile(path)
    .then(function(json) {
      return JSON.parse(json);
    })
    .catch(function(err) {
      return null;
    });
}

// fix legacy page data
function addMissingPageUuid(doc) {
  doc.pages = doc.pages.map(page => {
    if (! page.uuid) {
      page.uuid = genId('page:');
    }
    return page;
  });
  return doc;
}

function getImageFilenameByDoc(doc) {
  const page = doc.pages[doc.pageIndex];
  return page.name.replace(/(\d+)([abcde])?\.(\d+)/, (all, volume, char = '', page) => {
    return zpad(volume, 3) + char + '-' + zpad(page, 3);
  }) + '.jpg';
}

function getPageNameByImageFilename(filename) {
  return _.spread(function(all, volume, page, char) {
    if (! all) {
      return Path.basename(filename);
    }
    const lastChar = volume.slice(-1);
    let trailingChar = '';

    if (lastChar.match(/[abcde]/)) {
      trailingChar = lastChar;
    }
    return parseInt(volume, 10) + trailingChar + '.' + parseInt(page, 10) + char;
  })(REGEXP_IMAGE.exec(filename));
}

function getExistedDocNames() {

  return Helper.readDir(PATH_APP_DOC)
    .then(function(paths) {
      return Helper.getPathsType(paths);
    })
    .then(function(rows) {
      return rows.filter(function(row) {
        return row.stats.isDirectory();
      })
      .map(function(row) {
        return Path.basename(row.path);
      });
    });
}

function isDocNameExisted(name) {
  return getExistedDocNames()
    .then(function(names) {
      return -1 !== names.indexOf(name);
    });
}

function findUniqueUntitledName() {

  let name = 'untitled';

  return getExistedDocNames()
    .then(function(existedNames) {
      let index = 0;
      while (-1 !== existedNames.indexOf(name)) {
        name = 'untitled' + (++index);
      }
      return name;
    });
}

function writeDoc(doc) {
  let path = Path.resolve(PATH_APP_DOC, doc.name, doc.name + '.json');
  let content = JSON.stringify(doc);

  return Helper.writeFile(path, content)
    .then(function() {
      return doc;
    });
}

function replaceImageName(bambooName, path) {
  let basename = Path.basename(path);
  return basename.replace(/^(.+)\-(\d+)\-(\d+[abcd]).jpg/g, function(all, name, volume, pageName) {
    return [bambooName, volume, pageName].join('-') + '.jpg';
  });
}

function getNewIndexByPageName(pages, pageName) {
  return pages.map(function(page) {
    return page.name;
  })
  .indexOf(pageName);
}

function changeDocSettings(args) {

  let doc = args.doc;
  let oldDocName = args.oldDocName;
  let docName = args.docName;
  let oldPageName = args.oldPageName;
  let pageName = args.pageName;

  let oldPath = Path.resolve(PATH_APP_DOC, oldDocName);
  let oldImagePath = Path.resolve(oldPath, 'images');
  let path = Path.resolve(PATH_APP_DOC, docName);
  let imagePath = Path.resolve(path, 'images');

  let oldJsonPath = Path.resolve(oldPath, oldDocName + '.json');
  let newJsonPath = Path.resolve(path, docName + '.json');

  // only change page name
  if ((docName === oldDocName) && (pageName !== oldPageName)) {

    let page = _.find(doc.pages, {name: oldPageName});

    if (page) {
      page.name = pageName;
    }

    doc.pages = sortPages(doc.pages);
    doc.pageIndex = getNewIndexByPageName(doc.pages, pageName);

    return Helper.writeFile(newJsonPath, JSON.stringify(doc))
      .then(function() {
        return doc;
      });
  }

  if (docName !== oldDocName) {
    // create new folder
    return Helper.mkdirp(imagePath)
      .then(function() {
        // write new json
        doc.name = docName;
        doc.pages.map(function(page) {

          // replace new page name
          if (page.name === oldPageName) {
            page.name = pageName;
          }

          // replace image paths
          if (page.destImagePath) {
            page.destImagePath = Path.resolve(imagePath, basename(page.destImagePath));
          }
          return page;
        });
        doc.pages = sortPages(doc.pages);
        doc.pageIndex = getNewIndexByPageName(doc.pages, pageName);

        return Helper.writeFile(newJsonPath, JSON.stringify(doc));
      })
      .then(function() {
        return Helper.readDir(oldImagePath);
      })
      .then(function(subImagePaths) {
        // move image files
        let rows = subImagePaths.map(function(subImagePath) {
          let newSubImagePath = Path.resolve(imagePath, basename(subImagePath));
          return {
            source: subImagePath,
            dest: newSubImagePath
          };
        });
        return Helper.copyFiles(rows);
      })
      .then(function() {
        // remove old doc path
        return Helper.rimraf(oldPath);
      })
      .then(function() {
        return doc;
      });
  }
}

function isValidPageName(pageName) {
  return REGEXP_PAGE.exec(pageName);
}

function byCompare(a, b) {
  return compare(a.name, b.name);
}

function sortPages(pages) {

  const validPagesWithoutChar = _.filter(pages, (page) => {
    const match = REGEXP_PAGE.exec(page.name);
    const [all, num1, num2, num3, char] = match || [];
    return (!! match) && (! char);
  })
  .sort(byCompare);

  const validPagesWithChar = _.filter(pages, (page) => {
    const match = REGEXP_PAGE.exec(page.name);
    const [all, num1, num2, num3, char] = match || [];
    return (!! match) && char;
  })
  .sort(byCompare);

  const invalidPages = _.filter(pages, (page) => (! REGEXP_PAGE.test(page.name)))
    .sort((a, b) => naturalSort(a.name, b.name));

  return validPagesWithoutChar.concat(validPagesWithChar).concat(invalidPages);
}

function genPbFileContent(doc) {

  let content = _.map(doc.tags, tagToStr).join('\n');

  // https://github.com/karmapa/ketaka-lite/issues/121
  if (content) {
    content += '\n';
  }

  return content + doc.pages.map(function(page) {
    return '<pb id="' + page.name + '"/>\n' + page.content + '\n';
  }).join('');
}

module.exports = {
  genId,
  addMissingPageUuid,
  createDoc: createDoc,
  createPage: createPage,
  changeDocSettings: changeDocSettings,
  findUniqueUntitledName: findUniqueUntitledName,
  getDoc: getDoc,
  genPbFileContent: genPbFileContent,
  getImageFilenameByDoc: getImageFilenameByDoc,
  getPageNameByImageFilename: getPageNameByImageFilename,
  getExistedDocNames: getExistedDocNames,
  sortPages: sortPages,
  writeDoc: writeDoc,
  isValidPageName
};
