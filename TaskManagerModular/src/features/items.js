    function applyItemFieldChange(itemId, fieldName, rawValue) {
      const item = getItemById(itemId);
      if (!item || !fieldName) return { ok: false, message: '' };

      if (fieldName === 'status') {
        item.status = normalizeItemStatus(rawValue);
        return { ok: true, message: '' };
      }

      const nextValue = normalizeUniqueReference(rawValue);

      if (fieldName === 'supplier') {
        item.supplier = nextValue;
        return { ok: true, message: '' };
      }

      if (fieldName === 'bid' || fieldName === 'tid') {
        const nextBid = fieldName === 'bid' ? nextValue : item.bid;
        const nextTid = fieldName === 'tid' ? nextValue : item.tid;
        if (!nextBid && !nextTid) {
          return { ok: false, message: 'Each item needs at least a BID or TID value.' };
        }

        item[fieldName] = nextValue;
        return { ok: true, message: '' };
      }

      return { ok: true, message: '' };
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Unable to read the selected image.'));
        reader.readAsDataURL(file);
      });
    }

    function loadImageElement(src) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Unable to process the selected image.'));
        image.src = src;
      });
    }

    async function buildItemImageData(file) {
      if (!file?.type?.startsWith('image/')) {
        throw new Error('Please choose an image file.');
      }

      const sourceDataUrl = await readFileAsDataUrl(file);
      const image = await loadImageElement(sourceDataUrl);
      const maxDimension = 900;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Image processing is not available in this browser.');
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.82);
    }

    async function applyItemImageChange(itemId, file) {
      const item = getItemById(itemId);
      if (!item || !file) return { ok: false, message: '' };

      item.imageDataUrl = await buildItemImageData(file);
      item.imageName = file.name;
      return { ok: true, message: '' };
    }

    function clearItemImage(itemId) {
      const item = getItemById(itemId);
      if (!item) return false;
      item.imageDataUrl = '';
      item.imageName = '';
      return true;
    }

    function readFileAsArrayBuffer(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read the selected workbook.'));
        reader.readAsArrayBuffer(file);
      });
    }

    function arrayBufferToBase64(value) {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      let binary = '';

      for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index]);
      }

      return btoa(binary);
    }

    function getPackageMimeType(extension) {
      return {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        bmp: 'image/bmp',
        svg: 'image/svg+xml'
      }[String(extension || '').toLowerCase()] || 'application/octet-stream';
    }

    function getPackageEntryPayload(entry) {
      if (entry == null) return null;
      if (typeof entry === 'string' || entry instanceof ArrayBuffer || entry instanceof Uint8Array || Array.isArray(entry)) {
        return entry;
      }
      if (entry.content != null) return entry.content;
      if (entry.data != null) return entry.data;
      if (entry.body != null) return entry.body;
      if (typeof entry.asNodeBuffer === 'function') {
        try {
          return entry.asNodeBuffer();
        } catch (error) {
          return null;
        }
      }
      return null;
    }

    function toUint8Array(value) {
      if (value == null) return null;
      if (value instanceof Uint8Array) return value;
      if (value instanceof ArrayBuffer) return new Uint8Array(value);
      if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      if (Array.isArray(value)) return Uint8Array.from(value);
      if (typeof value === 'string') {
        return Uint8Array.from(value, character => character.charCodeAt(0) & 255);
      }
      return null;
    }

    function decodeUtf8(value) {
      if (typeof value === 'string') return value;
      const bytes = toUint8Array(value);
      if (!bytes) return '';

      try {
        return new TextDecoder('utf-8').decode(bytes);
      } catch (error) {
        let text = '';
        bytes.forEach(byte => {
          text += String.fromCharCode(byte);
        });
        return text;
      }
    }

    function getPackageFileEntry(packageBook, path) {
      const normalizedPath = String(path || '').replace(/^\/+/, '');
      const files = packageBook?.files;
      if (!files) return null;
      if (files[normalizedPath]) return files[normalizedPath];

      const matchingKey = Object.keys(files).find(key => key.toLowerCase() === normalizedPath.toLowerCase());
      return matchingKey ? files[matchingKey] : null;
    }

    function getPackageFileText(packageBook, path) {
      const payload = getPackageEntryPayload(getPackageFileEntry(packageBook, path));
      return decodeUtf8(payload);
    }

    function getPackageFileBytes(packageBook, path) {
      const payload = getPackageEntryPayload(getPackageFileEntry(packageBook, path));
      return toUint8Array(payload);
    }

    function parseXmlDocument(text) {
      if (!text) return null;

      const documentNode = new DOMParser().parseFromString(text, 'application/xml');
      if (documentNode.querySelector('parsererror')) return null;
      return documentNode;
    }

    function getXmlNodesByLocalName(root, localName) {
      if (!root) return [];
      return Array.from(root.getElementsByTagName('*')).filter(node => node.localName === localName);
    }

    function getXmlChildNodesByLocalName(root, localName) {
      if (!root) return [];
      return Array.from(root.children || []).filter(node => node.localName === localName);
    }

    function getXmlFirstNodeByLocalName(root, localName) {
      return getXmlNodesByLocalName(root, localName)[0] || null;
    }

    function resolvePackagePath(basePath, relativePath) {
      if (!relativePath) return '';
      if (/^[a-z]+:/i.test(relativePath)) return relativePath;

      const targetParts = String(relativePath).replace(/\\/g, '/').split('/');
      const baseParts = String(basePath || '').replace(/\\/g, '/').split('/');
      baseParts.pop();

      targetParts.forEach(part => {
        if (!part || part === '.') return;
        if (part === '..') {
          baseParts.pop();
          return;
        }
        baseParts.push(part);
      });

      return baseParts.join('/');
    }

    function getSheetPathByWorksheetName(packageBook, worksheetName) {
      const workbookDoc = parseXmlDocument(getPackageFileText(packageBook, 'xl/workbook.xml'));
      const workbookRelsDoc = parseXmlDocument(getPackageFileText(packageBook, 'xl/_rels/workbook.xml.rels'));
      if (!workbookDoc || !workbookRelsDoc) return '';

      const relationshipTargetById = new Map();
      getXmlNodesByLocalName(workbookRelsDoc, 'Relationship').forEach(node => {
        relationshipTargetById.set(node.getAttribute('Id'), node.getAttribute('Target') || '');
      });

      const sheetNode = getXmlNodesByLocalName(workbookDoc, 'sheet')
        .find(node => (node.getAttribute('name') || '') === worksheetName);
      if (!sheetNode) return '';

      const relationId = sheetNode.getAttribute('r:id') || sheetNode.getAttribute('id') || '';
      const target = relationshipTargetById.get(relationId) || '';
      return target ? resolvePackagePath('xl/workbook.xml', target) : '';
    }

    function getCellAddressFromIndexes(columnNumber, rowNumber) {
      if (!columnNumber || !rowNumber) return '';
      return `${getExcelColumnLetter(columnNumber)}${rowNumber}`;
    }

    function parseCellAddress(address) {
      const match = String(address || '').match(/^([A-Z]+)(\d+)$/i);
      if (!match) return null;

      let columnNumber = 0;
      const columnLabel = match[1].toUpperCase();
      for (let index = 0; index < columnLabel.length; index += 1) {
        columnNumber = (columnNumber * 26) + (columnLabel.charCodeAt(index) - 64);
      }

      return {
        columnNumber,
        rowNumber: Number(match[2])
      };
    }

    function getCellRichValueIndexes(metadataDoc) {
      const valueMetadataNode = getXmlFirstNodeByLocalName(metadataDoc, 'valueMetadata');
      const futureMetadataNode = getXmlFirstNodeByLocalName(metadataDoc, 'futureMetadata');
      const valueIndexes = getXmlChildNodesByLocalName(valueMetadataNode, 'bk').map(node => {
        const richValueNode = getXmlNodesByLocalName(node, 'rc').find(child => child.getAttribute('t') === '1');
        return richValueNode ? Number(richValueNode.getAttribute('v')) : NaN;
      });
      const futureIndexes = getXmlChildNodesByLocalName(futureMetadataNode, 'bk').map(node => {
        const richValueBinding = getXmlNodesByLocalName(node, 'rvb')[0];
        return richValueBinding ? Number(richValueBinding.getAttribute('i')) : NaN;
      });

      return valueIndexes.map((valueIndex, index) => {
        if (Number.isFinite(valueIndex)) return valueIndex;
        return Number.isFinite(futureIndexes[index]) ? futureIndexes[index] : NaN;
      });
    }

    function getRichValueRelationIndexes(rvDataDoc) {
      return getXmlNodesByLocalName(rvDataDoc, 'rv').map(node => {
        const valueNodes = getXmlChildNodesByLocalName(node, 'v');
        return valueNodes.length ? Number(valueNodes[0].textContent || '') : NaN;
      });
    }

    function getRichDataImageCellMap(arrayBuffer, worksheetName) {
      if (!window.XLSX?.read || !window.DOMParser) return new Map();

      let packageBook = null;
      try {
        packageBook = XLSX.read(arrayBuffer, { type: 'array', bookFiles: true, dense: false });
      } catch (error) {
        return new Map();
      }

      const sheetPath = getSheetPathByWorksheetName(packageBook, worksheetName);
      if (!sheetPath) return new Map();

      const sheetDoc = parseXmlDocument(getPackageFileText(packageBook, sheetPath));
      const metadataDoc = parseXmlDocument(getPackageFileText(packageBook, 'xl/metadata.xml'));
      const richValueRelDoc = parseXmlDocument(getPackageFileText(packageBook, 'xl/richData/richValueRel.xml'));
      const richValueRelRelsDoc = parseXmlDocument(getPackageFileText(packageBook, 'xl/richData/_rels/richValueRel.xml.rels'));
      const richValueDataDoc = parseXmlDocument(getPackageFileText(packageBook, 'xl/richData/rdrichvalue.xml'));
      if (!sheetDoc || !metadataDoc || !richValueRelDoc || !richValueRelRelsDoc || !richValueDataDoc) {
        return new Map();
      }

      const richValueIndexByMetadataIndex = getCellRichValueIndexes(metadataDoc);
      const richValueRelationIndexes = getRichValueRelationIndexes(richValueDataDoc);
      const relationshipTargetById = new Map();
      getXmlNodesByLocalName(richValueRelRelsDoc, 'Relationship').forEach(node => {
        relationshipTargetById.set(node.getAttribute('Id'), node.getAttribute('Target') || '');
      });

      const relationIds = getXmlNodesByLocalName(richValueRelDoc, 'rel').map(node => node.getAttribute('r:id') || node.getAttribute('id') || '');
      const cellImageMap = new Map();

      getXmlNodesByLocalName(sheetDoc, 'c').forEach(cellNode => {
        const cellAddress = cellNode.getAttribute('r') || '';
        const metadataReference = Number(cellNode.getAttribute('vm'));
        if (!cellAddress || !Number.isFinite(metadataReference) || metadataReference < 1) return;

        const metadataIndex = metadataReference - 1;
        const richValueIndex = richValueIndexByMetadataIndex[metadataIndex];
        if (!Number.isFinite(richValueIndex)) return;

        const relationIndex = richValueRelationIndexes[richValueIndex];
        if (!Number.isFinite(relationIndex)) return;

        const relationId = relationIds[relationIndex] || '';
        const mediaTarget = relationshipTargetById.get(relationId) || '';
        if (!mediaTarget) return;

        const mediaPath = resolvePackagePath('xl/richData/richValueRel.xml', mediaTarget);
        const mediaBytes = getPackageFileBytes(packageBook, mediaPath);
        if (!mediaBytes?.length) return;

        const extension = mediaPath.split('.').pop() || 'png';
        cellImageMap.set(cellAddress.toUpperCase(), {
          dataUrl: `data:${getPackageMimeType(extension)};base64,${arrayBufferToBase64(mediaBytes)}`,
          name: mediaPath.split('/').pop() || `image.${extension}`
        });
      });

      return cellImageMap;
    }

    function normalizeImportedColumnName(value) {
      return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function readExcelCellText(cell) {
      const value = cell?.value;
      if (value == null) return '';
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value).trim();
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (Array.isArray(value?.richText)) {
        return value.richText.map(part => String(part?.text || '')).join('').trim();
      }
      if (typeof value === 'object') {
        if (typeof value.text === 'string') return value.text.trim();
        if (value.result != null) return String(value.result).trim();
        if (typeof value.hyperlink === 'string') return value.hyperlink.trim();
      }
      return String(cell?.text || '').trim();
    }

    function getWorkbookImportSheet(workbook) {
      let bestMatch = null;

      workbook.worksheets.forEach(worksheet => {
        const maxHeaderRow = Math.min(10, worksheet.rowCount || 10);

        for (let rowNumber = 1; rowNumber <= maxHeaderRow; rowNumber += 1) {
          const row = worksheet.getRow(rowNumber);
          const columns = {};

          row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
            const key = normalizeImportedColumnName(readExcelCellText(cell));
            if (!key) return;
            if (key === 'tid') columns.tid = columnNumber;
            if (key === 'bid') columns.bid = columnNumber;
            if (key === 'image') columns.image = columnNumber;
            if (key === 'status') columns.status = columnNumber;
            if (key === 'supplier') columns.supplier = columnNumber;
          });

          const score = Object.keys(columns).length;
          if (score < 3) continue;
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
              worksheet,
              headerRowNumber: rowNumber,
              columns,
              score
            };
          }
        }
      });

      return bestMatch;
    }

    function getWorkbookMediaMap(workbook) {
      const mediaMap = new Map();
      const mediaEntries = Array.isArray(workbook?.model?.media)
        ? workbook.model.media
        : Array.isArray(workbook?.media)
          ? workbook.media
          : [];

      mediaEntries.forEach(media => {
        if (media?.index != null) mediaMap.set(String(media.index), media);
        if (media?.id != null) mediaMap.set(String(media.id), media);
      });

      return mediaMap;
    }

    function getWorkbookImageMedia(workbook, imageId, mediaMap = getWorkbookMediaMap(workbook)) {
      if (imageId == null) return null;

      if (mediaMap.has(String(imageId))) {
        return mediaMap.get(String(imageId));
      }

      if (typeof workbook?.getImage === 'function') {
        try {
          return workbook.getImage(imageId) || null;
        } catch (error) {
          return null;
        }
      }

      return null;
    }

    function getWorkbookImageData(media) {
      if (!media) return null;

      const extension = String(media.extension || media.type || 'png').toLowerCase() === 'jpg'
        ? 'jpeg'
        : String(media.extension || media.type || 'png').toLowerCase();

      if (typeof media.base64 === 'string' && media.base64) {
        return {
          dataUrl: media.base64.startsWith('data:')
            ? media.base64
            : `data:image/${extension};base64,${media.base64}`,
          name: media.name || `image.${extension}`
        };
      }

      if (media.buffer instanceof ArrayBuffer || media.buffer instanceof Uint8Array) {
        return {
          dataUrl: `data:image/${extension};base64,${arrayBufferToBase64(media.buffer)}`,
          name: media.name || `image.${extension}`
        };
      }

      return null;
    }

    function getAnchorStartIndex(value) {
      return Number.isFinite(value) ? Math.floor(value) : null;
    }

    function getAnchorEndIndex(value, fallbackStart) {
      if (Number.isFinite(value)) {
        return Math.max(fallbackStart ?? 0, Math.ceil(value) - 1);
      }

      return fallbackStart ?? null;
    }

    function getWorksheetImageDescriptors(worksheet, workbook) {
      if (typeof worksheet?.getImages !== 'function') return [];

      const mediaMap = getWorkbookMediaMap(workbook);
      return worksheet.getImages().map(image => {
        const media = getWorkbookImageMedia(workbook, image?.imageId, mediaMap);
        const imageData = getWorkbookImageData(media);
        if (!imageData) return null;

        const topRowIndex = getAnchorStartIndex(image?.range?.tl?.row);
        const topColumnIndex = getAnchorStartIndex(image?.range?.tl?.col);
        const bottomRowIndex = getAnchorEndIndex(image?.range?.br?.row, topRowIndex);
        const bottomColumnIndex = getAnchorEndIndex(image?.range?.br?.col, topColumnIndex);

        return {
          imageId: image?.imageId,
          rowStart: topRowIndex == null ? null : topRowIndex + 1,
          rowEnd: bottomRowIndex == null ? (topRowIndex == null ? null : topRowIndex + 1) : bottomRowIndex + 1,
          colStart: topColumnIndex == null ? null : topColumnIndex + 1,
          colEnd: bottomColumnIndex == null ? (topColumnIndex == null ? null : topColumnIndex + 1) : bottomColumnIndex + 1,
          dataUrl: imageData.dataUrl,
          name: imageData.name,
          used: false
        };
      }).filter(Boolean);
    }

    function getImageCellDataFromText(value, rowNumber) {
      const text = String(value || '').trim();
      if (!text) return null;
      if (!/^data:image\//i.test(text)) return null;

      const extensionMatch = text.match(/^data:image\/([^;]+)/i);
      const extension = String(extensionMatch?.[1] || 'png').toLowerCase().replace('jpg', 'jpeg');
      return {
        dataUrl: text,
        name: `row-${rowNumber}-image.${extension}`
      };
    }

    function resolveWorksheetImageForRow(descriptors, rowNumber, imageColumnNumber) {
      if (!descriptors.length) return null;

      let bestDescriptor = null;
      let bestScore = Number.POSITIVE_INFINITY;

      descriptors.forEach(descriptor => {
        if (descriptor.used) return;
        if (descriptor.rowStart == null) return;

        const rowStart = descriptor.rowStart;
        const rowEnd = descriptor.rowEnd ?? descriptor.rowStart;
        const colStart = descriptor.colStart ?? imageColumnNumber ?? 1;
        const colEnd = descriptor.colEnd ?? descriptor.colStart ?? imageColumnNumber ?? 1;

        const rowDistance = rowNumber < rowStart
          ? rowStart - rowNumber
          : rowNumber > rowEnd
            ? rowNumber - rowEnd
            : 0;

        if (rowDistance > 1) return;

        const hasImageColumn = Number.isFinite(imageColumnNumber);
        const columnDistance = !hasImageColumn
          ? 0
          : imageColumnNumber < colStart
            ? colStart - imageColumnNumber
            : imageColumnNumber > colEnd
              ? imageColumnNumber - colEnd
              : 0;

        if (hasImageColumn && columnDistance > 1) return;

        const score = (rowDistance * 100)
          + (columnDistance * 10)
          + Math.max(0, (rowEnd - rowStart))
          + Math.max(0, (colEnd - colStart));

        if (score < bestScore) {
          bestScore = score;
          bestDescriptor = descriptor;
        }
      });

      if (bestDescriptor) {
        bestDescriptor.used = true;
        return {
          dataUrl: bestDescriptor.dataUrl,
          name: bestDescriptor.name
        };
      }

      return null;
    }

    async function importItemsFromWorkbook(file, taskId) {
      if (!file) return null;

      const task = getTaskById(taskId);
      if (!task) {
        throw new Error('Select a task before importing items.');
      }

      if (!window.ExcelJS?.Workbook) {
        throw new Error('Excel import is unavailable because ExcelJS did not load.');
      }

      const workbook = new ExcelJS.Workbook();
      const buffer = await readFileAsArrayBuffer(file);
      await workbook.xlsx.load(buffer);

      const importSheet = getWorkbookImportSheet(workbook);
      if (!importSheet) {
        throw new Error('No worksheet with TID, BID, Image, Status, and Supplier headers was found.');
      }

      const { worksheet, headerRowNumber, columns } = importSheet;
      const imageDescriptors = getWorksheetImageDescriptors(worksheet, workbook);
      const richDataImageCellMap = getRichDataImageCellMap(buffer, worksheet.name);
      const importedItems = [];
      let unresolvedImageCount = 0;

      for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        const bid = normalizeUniqueReference(columns.bid ? readExcelCellText(row.getCell(columns.bid)) : '');
        const tid = normalizeUniqueReference(columns.tid ? readExcelCellText(row.getCell(columns.tid)) : '');
        if (!bid && !tid) continue;

        const status = columns.status ? readExcelCellText(row.getCell(columns.status)) : DEFAULT_ITEM_STATUS;
        const supplier = columns.supplier ? readExcelCellText(row.getCell(columns.supplier)) : '';
        const imageCellValue = columns.image ? readExcelCellText(row.getCell(columns.image)) : '';
        const richDataImage = columns.image
          ? richDataImageCellMap.get(getCellAddressFromIndexes(columns.image, rowNumber))
          : null;
        const inlineImage = getImageCellDataFromText(imageCellValue, rowNumber);
        const anchoredImage = inlineImage || richDataImage || resolveWorksheetImageForRow(imageDescriptors, rowNumber, columns.image);

        const nextItem = createTaskItem({
          bid,
          tid,
          status,
          supplier,
          imageDataUrl: anchoredImage?.dataUrl || '',
          imageName: anchoredImage?.name || ''
        }, task);

        if (!nextItem) continue;
        if (imageCellValue && !anchoredImage) {
          unresolvedImageCount += 1;
        }

        importedItems.push(nextItem);
      }

      if (!importedItems.length) {
        throw new Error('No importable item rows were found in the selected workbook.');
      }

      items = [...importedItems, ...items];

      let message = `Imported ${importedItems.length} item${importedItems.length === 1 ? '' : 's'} into ${task.title}.`;
      if (unresolvedImageCount) {
        message += ` ${unresolvedImageCount} row${unresolvedImageCount === 1 ? '' : 's'} had image values that could not be resolved, so those items were imported without images.`;
      }

      return {
        count: importedItems.length,
        unresolvedImageCount,
        message
      };
    }

    function renderAllItemsList(options = {}) {
      const list = document.getElementById('allItemsList');
      const summary = document.getElementById('itemsModalSummary');
      const shell = list?.closest('.workflow-item-list-shell');
      const preserveScrollTop = options.preserveScrollTop;
      if (!list || !summary) return;

      const filteredItems = items
        .filter(item => !itemSearchQuery || getItemSearchText(item).includes(itemSearchQuery))
        .sort((a, b) => (a.bid || '').localeCompare(b.bid || '') || (a.tid || '').localeCompare(b.tid || ''));

      summary.textContent = `${filteredItems.length} of ${items.length} item${items.length === 1 ? '' : 's'}`;
      list.innerHTML = filteredItems.length
        ? getAllItemsTableMarkup(filteredItems)
        : '<div class="workflow-item-empty">No items match the current search.</div>';

      restoreScrollTop(shell, preserveScrollTop);
    }

    function openItemsModal() {
      const modal = document.getElementById('itemsModal');
      const searchInput = document.getElementById('itemSearchInput');
      if (!modal || !searchInput) return;
      itemSearchQuery = '';
      searchInput.value = '';
      modal.classList.add('open');
      renderAllItemsList();
      searchInput.focus();
    }

    function closeItemsModal() {
      const modal = document.getElementById('itemsModal');
      const searchInput = document.getElementById('itemSearchInput');
      if (!modal) return;
      modal.classList.remove('open');
      itemSearchQuery = '';
      if (searchInput) searchInput.value = '';
    }

    document.getElementById('allItemsList').addEventListener('click', e => {
      const deleteItemId = e.target.closest('[data-delete-item]')?.dataset.deleteItem;
      if (deleteItemId) {
        if (!confirm('Delete this item?')) return;
        items = items.filter(item => item.id !== deleteItemId);
        saveItems();
        renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
        return;
      }

      const clearItemImageId = e.target.closest('[data-clear-item-image]')?.dataset.clearItemImage;
      if (!clearItemImageId) return;
      if (!clearItemImage(clearItemImageId)) return;
      saveItems();
      renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    });

    document.getElementById('allItemsList').addEventListener('change', e => {
      const field = e.target.closest('[data-item-field]');
      const imageField = e.target.closest('[data-item-image-upload]');
      if (!field && !imageField) return;

      if (imageField) {
        applyItemImageChange(imageField.dataset.itemImageUpload, imageField.files?.[0])
          .then(result => {
            if (!result.ok && result.message) {
              alert(result.message);
              return;
            }

            saveItems();
            renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
          })
          .catch(error => alert(error.message || 'Unable to save the item image.'));
        return;
      }

      if (field) {
        const result = applyItemFieldChange(
          field.dataset.itemId,
          field.dataset.itemField,
          field.type === 'checkbox' ? field.checked : field.value
        );
        if (!result.ok && result.message) {
          alert(result.message);
        }
      }

      saveItems();
      renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    });
